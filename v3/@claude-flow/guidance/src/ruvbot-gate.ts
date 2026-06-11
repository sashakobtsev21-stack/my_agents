/**
 * RuvBot Integration — AIDefenceGate + the optional-dependency loader
 *
 * The ruvbot dynamic-import cache (mutable let stays with its only
 * writer/readers) and the AIDefenceGate. Extracted verbatim from
 * ruvbot-integration.ts (lines 44-313) during campaign-2 wave 16
 * (W222). ruvbot-integration.ts stays the barrel.
 */

import {
  BLOCK_SEVERITY_THRESHOLDS,
  THREAT_TYPE_MAP,
  SEVERITY_MAP,
} from './ruvbot-integration-types.js';
import type {
  RuvBotAIDefenceGuard,
  AIDefenceThreat,
  AIDefenceResult,
  AIDefenceGateConfig,
} from './ruvbot-integration-types.js';
import type { GateResult, GateDecision } from './types.js';

/**
 * Minimal interface for a ruvbot instance. Mirrors the event-emitter surface
 * exposed by `createRuvBot()` without importing the package at compile time.
 */

// ============================================================================
// Dynamic Import Helper
// ============================================================================

/** Resolved ruvbot module cache (null = not attempted, undefined = failed). */
let ruvbotModuleCache: Record<string, unknown> | null = null;

/**
 * Module specifiers kept in variables so TypeScript does not attempt
 * compile-time resolution of this optional peer dependency.
 */
const RUVBOT_MODULE = 'ruvbot';
const RUVBOT_CORE_MODULE = 'ruvbot/core';

/**
 * Attempt to dynamically import the ruvbot package.
 * Throws a descriptive error if the package is not installed.
 */
async function requireRuvBot(): Promise<Record<string, unknown>> {
  if (ruvbotModuleCache) return ruvbotModuleCache;

  try {
    const mod = await import(RUVBOT_MODULE) as Record<string, unknown>;
    ruvbotModuleCache = mod;
    return mod;
  } catch {
    throw new Error(
      'ruvbot is not installed. Install it with: npm install ruvbot@0.1.8\n' +
      'ruvbot is an optional peer dependency of @claude-flow/guidance.',
    );
  }
}

/**
 * Attempt to dynamically import ruvbot/core sub-export.
 */
async function requireRuvBotCore(): Promise<Record<string, unknown>> {
  try {
    return await import(RUVBOT_CORE_MODULE) as Record<string, unknown>;
  } catch {
    // Fall back to the main export
    return requireRuvBot();
  }
}

// ============================================================================
// AIDefenceGate
// ============================================================================

/**
 * Wraps ruvbot's 6-layer AIDefence as an enforcement gate compatible with the
 * guidance control plane's GateResult / GateDecision interface.
 *
 * Supports:
 * - Prompt injection detection
 * - Jailbreak detection
 * - PII detection
 * - Control character and homoglyph detection (via ruvbot internals)
 * - Configurable sensitivity / block threshold
 *
 * Evaluates both input (pre-processing) and output (post-processing) text.
 */
export class AIDefenceGate {
  private config: AIDefenceGateConfig;
  private guard: RuvBotAIDefenceGuard | null = null;
  private guardInitPromise: Promise<void> | null = null;

  constructor(config: Partial<AIDefenceGateConfig> = {}) {
    this.config = {
      detectPromptInjection: config.detectPromptInjection ?? true,
      detectJailbreak: config.detectJailbreak ?? true,
      detectPII: config.detectPII ?? true,
      blockThreshold: config.blockThreshold ?? 'medium',
    };
  }

  /**
   * Lazily initialize the underlying ruvbot AIDefence guard.
   * Safe to call multiple times; only the first call creates the guard.
   */
  private async ensureGuard(): Promise<RuvBotAIDefenceGuard> {
    if (this.guard) return this.guard;

    if (!this.guardInitPromise) {
      this.guardInitPromise = (async () => {
        const mod = await requireRuvBot();
        const createGuard = mod['createAIDefenceGuard'] as
          | ((config?: Record<string, unknown>) => RuvBotAIDefenceGuard)
          | undefined;

        if (typeof createGuard !== 'function') {
          throw new Error(
            'ruvbot does not export createAIDefenceGuard. ' +
            'Ensure ruvbot@0.1.8 or later is installed.',
          );
        }

        this.guard = createGuard({
          detectPromptInjection: this.config.detectPromptInjection,
          detectJailbreak: this.config.detectJailbreak,
          detectPII: this.config.detectPII,
        });
      })();
    }

    await this.guardInitPromise;
    return this.guard!;
  }

  /**
   * Evaluate input text for threats (pre-processing gate).
   *
   * Checks for prompt injection, jailbreak attempts, and PII based
   * on the configured sensitivity.
   */
  async evaluateInput(input: string): Promise<AIDefenceResult> {
    const start = performance.now();

    const guard = await this.ensureGuard();
    const raw = await guard.check(input);
    const latencyMs = performance.now() - start;

    const threats = this.normalizeThreats(raw.threats);

    return {
      safe: raw.safe,
      threats,
      sanitizedInput: raw.sanitizedInput,
      latencyMs,
    };
  }

  /**
   * Evaluate output text for threats (post-processing gate).
   *
   * Primarily checks for PII leakage and secret exposure in responses.
   */
  async evaluateOutput(output: string): Promise<AIDefenceResult> {
    const start = performance.now();

    const guard = await this.ensureGuard();
    const raw = await guard.check(output);
    const latencyMs = performance.now() - start;

    // For output evaluation, focus on PII / data leakage threats
    const threats = this.normalizeThreats(raw.threats).filter(
      t => t.type === 'pii' || t.type === 'control-chars',
    );

    return {
      safe: threats.length === 0,
      threats,
      sanitizedInput: raw.sanitizedInput,
      latencyMs,
    };
  }

  /**
   * Convert an AIDefenceResult into a GateResult compatible with the
   * guidance enforcement pipeline.
   *
   * Decision logic:
   * - If no threats: 'allow'
   * - If threats above block threshold: 'block'
   * - Otherwise: 'warn'
   */
  toGateResult(result: AIDefenceResult, context?: string): GateResult {
    if (result.safe && result.threats.length === 0) {
      return {
        decision: 'allow',
        gateName: 'ai-defence',
        reason: 'AIDefence check passed with no threats detected.',
        triggeredRules: [],
        metadata: { latencyMs: result.latencyMs },
      };
    }

    const blockingSeverities = BLOCK_SEVERITY_THRESHOLDS[this.config.blockThreshold];
    const blockingThreats = result.threats.filter(
      t => blockingSeverities.has(t.severity),
    );

    const decision: GateDecision = blockingThreats.length > 0 ? 'block' : 'warn';

    const threatSummary = result.threats
      .map(t => `${t.type} (${t.severity}): ${t.detail}`)
      .join('; ');

    return {
      decision,
      gateName: 'ai-defence',
      reason: `AIDefence detected ${result.threats.length} threat(s): ${threatSummary}`,
      triggeredRules: [],
      remediation: this.buildRemediation(result.threats),
      metadata: {
        threats: result.threats,
        blockThreshold: this.config.blockThreshold,
        latencyMs: result.latencyMs,
        context,
      },
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): AIDefenceGateConfig {
    return { ...this.config };
  }

  /**
   * Update configuration. Resets the guard so the next evaluation
   * re-initializes with the new settings.
   */
  updateConfig(config: Partial<AIDefenceGateConfig>): void {
    this.config = { ...this.config, ...config };
    this.guard = null;
    this.guardInitPromise = null;
  }

  // ===== Private Helpers =====

  private normalizeThreats(
    raw: Array<{ type: string; severity: string; detail: string }>,
  ): AIDefenceThreat[] {
    return raw.map(t => ({
      type: THREAT_TYPE_MAP[t.type] ?? 'prompt-injection',
      severity: SEVERITY_MAP[t.severity] ?? 'medium',
      detail: t.detail,
    }));
  }

  private buildRemediation(threats: AIDefenceThreat[]): string {
    const parts: string[] = [];

    const hasInjection = threats.some(t => t.type === 'prompt-injection');
    const hasJailbreak = threats.some(t => t.type === 'jailbreak');
    const hasPII = threats.some(t => t.type === 'pii');

    if (hasInjection) {
      parts.push('1. Review input for prompt injection patterns and remove adversarial content.');
    }
    if (hasJailbreak) {
      parts.push('2. Input contains jailbreak attempt. Reject and log the attempt.');
    }
    if (hasPII) {
      parts.push('3. Redact or mask personally identifiable information before processing.');
    }
    if (parts.length === 0) {
      parts.push('Review flagged content and apply appropriate sanitization.');
    }

    return parts.join('\n');
  }
}

// ============================================================================
// RuvBotMemoryAdapter
// ============================================================================

/**
 * Wraps ruvbot's memory read/write operations with guidance control plane
 * governance. Every write passes through the MemoryWriteGate for authority
 * and coherence checks. All operations are logged to a proof chain.
 */

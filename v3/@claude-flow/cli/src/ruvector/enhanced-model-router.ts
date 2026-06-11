/**
 * Enhanced Model Router with Agent Booster AST Integration
 *
 * Implements ADR-026: 3-tier intelligent model routing:
 * - Tier 1: Agent Booster (WASM) - <1ms, $0 for simple transforms
 * - Tier 2: Haiku - ~500ms for low complexity
 * - Tier 3: Sonnet/Opus - 2-5s for high complexity
 *
 * @module enhanced-model-router
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { extname, isAbsolute, resolve as resolvePath } from 'path';
import { getModelRouter, ModelRouter } from './model-router.js';
import { applyCodemod, isDeterministicCodemod } from './codemods/engine.js';

/** Map a file path to the codemod engine's language, falling back to a hint. */

// Types/tables/helpers extracted into ./enhanced-model-router-defs.ts
// during campaign-2 wave 80 (W286).
export type {
  EditIntentType,
  EditIntent,
  EnhancedRouteResult,
  EnhancedModelRouterConfig,
} from './enhanced-model-router-defs.js';
import {
  codemodLanguageFor,
  FILE_PATH_PATTERNS,
  INTENT_PATTERNS,
  LANGUAGE_MAP,
  TIER3_KEYWORDS,
} from './enhanced-model-router-defs.js';
import type {
  EditIntent,
  EditIntentType,
  EnhancedModelRouterConfig,
  EnhancedRouteResult,
} from './enhanced-model-router-defs.js';

export class EnhancedModelRouter {
  private config: EnhancedModelRouterConfig;
  private tinyDancerRouter: ModelRouter;

  constructor(config?: Partial<EnhancedModelRouterConfig>) {
    this.config = {
      agentBoosterEnabled: true,
      agentBoosterConfidenceThreshold: 0.7,
      enabledIntents: [
        'var-to-const',
        'add-types',
        'add-error-handling',
        'async-await',
        'add-logging',
        'remove-console',
      ],
      complexityThresholds: {
        haiku: 0.3,
        sonnet: 0.6,
        opus: 1.0,
      },
      preferCost: false,
      preferQuality: false,
      ...config,
    };

    this.tinyDancerRouter = getModelRouter();
  }

  /**
   * Detect code editing intent from task description
   */
  detectIntent(task: string): EditIntent | null {
    const taskLower = task.toLowerCase();
    let bestIntent: EditIntent | null = null;
    let bestScore = 0;

    for (const [intentType, config] of Object.entries(INTENT_PATTERNS)) {
      if (!this.config.enabledIntents.includes(intentType as EditIntentType)) {
        continue;
      }

      for (const pattern of config.patterns) {
        if (pattern.test(taskLower)) {
          const score = config.weight;
          if (score > bestScore) {
            bestScore = score;
            bestIntent = {
              type: intentType as EditIntentType,
              confidence: score,
              description: config.description,
            };
          }
        }
      }
    }

    // Extract file path if intent found
    if (bestIntent) {
      const filePath = this.extractFilePath(task);
      if (filePath) {
        bestIntent.filePath = filePath;
        bestIntent.language = this.detectLanguage(filePath);
        // Boost confidence if file exists
        if (existsSync(filePath)) {
          bestIntent.confidence = Math.min(1.0, bestIntent.confidence + 0.1);
        }
      }
    }

    return bestIntent;
  }

  /**
   * Extract file path from task description
   */
  private extractFilePath(task: string): string | null {
    for (const pattern of FILE_PATH_PATTERNS) {
      const match = task.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return LANGUAGE_MAP[ext] || 'javascript';
  }

  /**
   * Check if task contains Tier 3 (Opus) keywords
   */
  private containsTier3Keywords(task: string): { matches: boolean; count: number } {
    let count = 0;
    for (const pattern of TIER3_KEYWORDS) {
      if (pattern.test(task)) {
        count++;
      }
    }
    return { matches: count > 0, count };
  }

  /**
   * Route a task to the optimal tier and handler
   */
  async route(task: string, context?: { filePath?: string }): Promise<EnhancedRouteResult> {
    // Step 1: Deterministic codemod detection (ADR-143).
    // Only intents that a codemod can apply *deterministically and safely* skip
    // the LLM. Intents that need inference (add-types, add-error-handling,
    // async-await) are detected but fall through to model routing below.
    if (this.config.agentBoosterEnabled) {
      const intent = this.detectIntent(task);

      if (
        intent &&
        intent.confidence >= this.config.agentBoosterConfidenceThreshold &&
        isDeterministicCodemod(intent.type)
      ) {
        // Route-time dry-run (ADR-143 #3): when a target file is known, only
        // claim Tier-1 if the codemod actually changes something. This avoids
        // recommending [CODEMOD_AVAILABLE] for no-ops (e.g. "remove console" on
        // a file with no console calls). With no file to check, recommend Tier-1
        // best-effort — the executor (hooks_codemod) verifies before writing.
        // Prefer the caller-provided path (authoritative, usually absolute) over
        // the path heuristically extracted from the task text; resolve relatives.
        const fpRaw = context?.filePath || intent.filePath;
        const fp = fpRaw ? (isAbsolute(fpRaw) ? fpRaw : resolvePath(process.cwd(), fpRaw)) : undefined;
        let tier1 = true;
        let edits: number | undefined;
        if (fp && existsSync(fp)) {
          try {
            const code = readFileSync(fp, 'utf-8');
            const res = applyCodemod(intent.type, code, { language: codemodLanguageFor(fp, intent.language) });
            if (res.success && res.changed) {
              edits = res.edits;
            } else {
              tier1 = false; // verified no-op / can't apply → fall through to model routing
            }
          } catch {
            // read error → leave best-effort Tier-1 (executor will verify)
          }
        }

        if (tier1) {
          const editsNote = edits !== undefined ? ` (${edits} edit${edits === 1 ? '' : 's'})` : '';
          return {
            tier: 1,
            handler: 'codemod',
            confidence: intent.confidence,
            reasoning: `Deterministic codemod can apply "${intent.type}" with ${(intent.confidence * 100).toFixed(0)}% confidence — $0, no LLM${editsNote}`,
            codemodIntent: intent,
            agentBoosterIntent: intent,
            deterministic: true,
            canSkipLLM: true,
            estimatedLatencyMs: 1,
            estimatedCost: 0,
          };
        }
        // verified no-op: fall through to model routing below
      }
    }

    // Step 2: Check for Tier 3 keywords (architecture, security, distributed)
    const tier3Check = this.containsTier3Keywords(task);
    if (tier3Check.matches && tier3Check.count >= 2) {
      // Strong signal for Opus - multiple complex keywords
      return {
        tier: 3,
        handler: 'opus',
        model: 'opus',
        confidence: Math.min(0.95, 0.7 + tier3Check.count * 0.1),
        complexity: 0.8 + tier3Check.count * 0.05,
        reasoning: `High complexity task (${tier3Check.count} architectural keywords) - using opus`,
        canSkipLLM: false,
        estimatedLatencyMs: 5000,
        estimatedCost: 0.015,
      };
    }

    // Step 3: AST complexity analysis (if file path provided)
    let astComplexity: number | undefined;
    const targetFile = context?.filePath || this.extractFilePath(task);

    if (targetFile && existsSync(targetFile)) {
      try {
        astComplexity = await this.analyzeASTComplexity(targetFile);
      } catch {
        // AST analysis not available, continue with text-based routing
      }
    }

    // Step 4: Text-based complexity + tiny-dancer routing
    const tinyDancerResult = await this.tinyDancerRouter.route(task);

    // Step 5: Combine AST complexity with tiny-dancer result
    // Also boost if single tier3 keyword found
    let finalComplexity = astComplexity !== undefined
      ? (astComplexity + tinyDancerResult.complexity) / 2
      : tinyDancerResult.complexity;

    // Boost complexity if tier3 keywords found (even just one)
    if (tier3Check.matches) {
      finalComplexity = Math.min(1.0, finalComplexity + 0.25);
    }

    // Step 6: Determine tier based on complexity
    const { haiku, sonnet } = this.config.complexityThresholds;

    if (finalComplexity < haiku) {
      return {
        tier: 2,
        handler: 'haiku',
        model: 'haiku',
        confidence: tinyDancerResult.confidence,
        complexity: finalComplexity,
        reasoning: `Low complexity (${(finalComplexity * 100).toFixed(0)}%) - using haiku`,
        canSkipLLM: false,
        estimatedLatencyMs: 500,
        estimatedCost: 0.0002,
      };
    }

    if (finalComplexity < sonnet) {
      return {
        tier: 2,
        handler: 'sonnet',
        model: 'sonnet',
        confidence: tinyDancerResult.confidence,
        complexity: finalComplexity,
        reasoning: `Medium complexity (${(finalComplexity * 100).toFixed(0)}%) - using sonnet`,
        canSkipLLM: false,
        estimatedLatencyMs: 2000,
        estimatedCost: 0.003,
      };
    }

    return {
      tier: 3,
      handler: 'opus',
      model: 'opus',
      confidence: tinyDancerResult.confidence,
      complexity: finalComplexity,
      reasoning: `High complexity (${(finalComplexity * 100).toFixed(0)}%) - using opus`,
      canSkipLLM: false,
      estimatedLatencyMs: 5000,
      estimatedCost: 0.015,
    };
  }

  /**
   * Analyze AST complexity of a file
   * Returns normalized complexity score (0-1)
   */
  private async analyzeASTComplexity(filePath: string): Promise<number> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Simple heuristics for complexity
      let complexity = 0;

      // Line count contribution
      complexity += Math.min(0.3, lines.length / 1000);

      // Nesting depth estimation (count indentation)
      const avgIndent = lines
        .filter((l) => l.trim().length > 0)
        .map((l) => l.match(/^(\s*)/)?.[1].length || 0)
        .reduce((sum, indent) => sum + indent, 0) / Math.max(1, lines.length);
      complexity += Math.min(0.2, avgIndent / 20);

      // Control flow complexity (count keywords)
      const controlFlowCount = (content.match(/\b(if|else|for|while|switch|case|try|catch|async|await)\b/g) || []).length;
      complexity += Math.min(0.3, controlFlowCount / 100);

      // Function/class count
      const functionCount = (content.match(/\b(function|class|=>)\b/g) || []).length;
      complexity += Math.min(0.2, functionCount / 50);

      return Math.min(1, complexity);
    } catch {
      return 0.5; // Default to medium complexity on error
    }
  }

  /**
   * Execute task using the appropriate tier.
   *
   * For Tier-1 deterministic intents this applies the codemod directly (writing
   * the file back when a path is given) — $0, no LLM. Otherwise it returns the
   * routing result and the caller invokes the recommended model.
   */
  async execute(
    task: string,
    context?: { filePath?: string; originalCode?: string }
  ): Promise<{
    result: string | { applied: boolean; changed: boolean; edits: number };
    routeResult: EnhancedRouteResult;
  }> {
    const routeResult = await this.route(task, context);
    const intent = routeResult.codemodIntent ?? routeResult.agentBoosterIntent;

    if (routeResult.tier === 1 && routeResult.deterministic && intent) {
      const cm = this.tryCodemod(intent, context);

      if (cm.success) {
        return {
          result: { applied: true, changed: cm.changed, edits: cm.edits },
          routeResult,
        };
      }

      // Codemod could not apply (no file / parse issue) — fall back to a model.
      routeResult.tier = 2;
      routeResult.handler = 'sonnet';
      routeResult.model = 'sonnet';
      routeResult.deterministic = false;
      routeResult.canSkipLLM = false;
      routeResult.reasoning += ' (codemod fallback to LLM)';
    }

    // Return routing result - caller handles LLM invocation
    return { result: routeResult.reasoning, routeResult };
  }

  /**
   * Apply a deterministic codemod to the intent's target file.
   *
   * This is the real Tier-1 execution path (ADR-143). It uses the in-process
   * TypeScript-compiler codemod engine — no `agent-booster` import, no subprocess,
   * no LLM. Writes the transformed source back to disk when it changes.
   */
  private tryCodemod(
    intent: EditIntent,
    context?: { filePath?: string; originalCode?: string }
  ): { success: boolean; changed: boolean; edits: number } {
    const filePath = intent.filePath || context?.filePath;
    if (!filePath || !existsSync(filePath)) {
      return { success: false, changed: false, edits: 0 };
    }

    const originalCode = context?.originalCode ?? readFileSync(filePath, 'utf-8');
    const language = codemodLanguageFor(filePath, intent.language);
    const result = applyCodemod(intent.type, originalCode, { language });

    if (!result.success) {
      return { success: false, changed: false, edits: 0 };
    }
    if (result.changed && !context?.originalCode) {
      writeFileSync(filePath, result.output, 'utf-8');
    }
    return { success: true, changed: result.changed, edits: result.edits };
  }

  /**
   * Get router statistics
   */
  getStats(): {
    config: EnhancedModelRouterConfig;
    tinyDancerStats: ReturnType<ModelRouter['getStats']>;
  } {
    return {
      config: { ...this.config },
      tinyDancerStats: this.tinyDancerRouter.getStats(),
    };
  }
}

// ============================================================================
// Singleton & Factory Functions
// ============================================================================

let enhancedRouterInstance: EnhancedModelRouter | null = null;

/**
 * Get or create the singleton EnhancedModelRouter instance
 */
export function getEnhancedModelRouter(
  config?: Partial<EnhancedModelRouterConfig>
): EnhancedModelRouter {
  if (!enhancedRouterInstance) {
    enhancedRouterInstance = new EnhancedModelRouter(config);
  }
  return enhancedRouterInstance;
}

/**
 * Reset the singleton instance
 */
export function resetEnhancedModelRouter(): void {
  enhancedRouterInstance = null;
}

/**
 * Create a new EnhancedModelRouter instance (non-singleton)
 */
export function createEnhancedModelRouter(
  config?: Partial<EnhancedModelRouterConfig>
): EnhancedModelRouter {
  return new EnhancedModelRouter(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick route function with enhanced routing
 */
export async function enhancedRouteToModel(
  task: string,
  context?: { filePath?: string }
): Promise<EnhancedRouteResult> {
  const router = getEnhancedModelRouter();
  return router.route(task, context);
}

/**
 * Detect if a task can be applied by a deterministic, $0 codemod (ADR-143).
 * Only the deterministic intents qualify — others need a model.
 */
export function canUseCodemod(task: string): {
  canUse: boolean;
  intent?: EditIntent;
} {
  const router = getEnhancedModelRouter();
  const intent = router.detectIntent(task);

  if (intent && intent.confidence >= 0.7 && isDeterministicCodemod(intent.type)) {
    return { canUse: true, intent };
  }

  return { canUse: false };
}

/**
 * @deprecated Agent Booster never performed these transforms. Use {@link canUseCodemod}.
 */
export const canUseAgentBooster = canUseCodemod;

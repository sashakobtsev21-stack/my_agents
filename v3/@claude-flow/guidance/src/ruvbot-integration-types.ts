/**
 * Types + threat/severity maps for the ruvbot AIDefence integration — the
 * RuvBot instance/guard/memory interfaces, the AIDefence threat/result/
 * gate-config shapes, the bridge config + event types, and the block-
 * severity / threat-type / severity lookup maps.
 *
 * Extracted from ruvbot-integration.ts (W156, P3.35 cut #1). Named
 * ruvbot-integration-types.ts (src/types.ts already exists); the bridge
 * file stays the barrel and re-exports these.
 */

export interface RuvBotInstance {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit?(event: string, ...args: unknown[]): void;
}

/**
 * Minimal interface for ruvbot's AIDefence guard returned by
 * `createAIDefenceGuard()`.
 */
export interface RuvBotAIDefenceGuard {
  check(input: string): Promise<{
    safe: boolean;
    threats: Array<{
      type: string;
      severity: string;
      detail: string;
    }>;
    sanitizedInput?: string;
  }>;
}

/**
 * Minimal interface for ruvbot's memory subsystem.
 */
export interface RuvBotMemory {
  read(key: string, namespace?: string): Promise<unknown>;
  write(key: string, value: unknown, namespace?: string): Promise<void>;
  delete?(key: string, namespace?: string): Promise<void>;
  search?(query: string, options?: Record<string, unknown>): Promise<unknown[]>;
}

// ============================================================================
// Integration Types
// ============================================================================

/**
 * Threat detected by the AIDefence layer.
 */
export interface AIDefenceThreat {
  type: 'prompt-injection' | 'jailbreak' | 'pii' | 'control-chars' | 'homoglyph';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
}

/**
 * Result of an AIDefence evaluation.
 */
export interface AIDefenceResult {
  safe: boolean;
  threats: AIDefenceThreat[];
  sanitizedInput?: string;
  latencyMs: number;
}

/**
 * Configuration for the AIDefenceGate.
 */
export interface AIDefenceGateConfig {
  detectPromptInjection: boolean;
  detectJailbreak: boolean;
  detectPII: boolean;
  blockThreshold: 'low' | 'medium' | 'high';
}

/**
 * Configuration for the RuvBotGuidanceBridge.
 */
export interface RuvBotBridgeConfig {
  enableAIDefence: boolean;
  enableMemoryGovernance: boolean;
  enableTrustTracking: boolean;
  enableProofChain: boolean;
  /** HMAC signing key for proof chains. Required when enableProofChain is true. */
  proofSigningKey?: string;
}

/**
 * A normalized ruvbot event for internal processing.
 */
export interface RuvBotEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  agentId?: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Severity Mapping
// ============================================================================

/** Maps blockThreshold to a minimum severity that triggers a block. */
export const BLOCK_SEVERITY_THRESHOLDS: Record<
  AIDefenceGateConfig['blockThreshold'],
  Set<AIDefenceThreat['severity']>
> = {
  low: new Set(['low', 'medium', 'high', 'critical']),
  medium: new Set(['medium', 'high', 'critical']),
  high: new Set(['high', 'critical']),
};

/** Maps ruvbot threat type strings to our typed threat type. */
export const THREAT_TYPE_MAP: Record<string, AIDefenceThreat['type']> = {
  'prompt-injection': 'prompt-injection',
  'prompt_injection': 'prompt-injection',
  'promptInjection': 'prompt-injection',
  'jailbreak': 'jailbreak',
  'pii': 'pii',
  'control-chars': 'control-chars',
  'control_chars': 'control-chars',
  'controlChars': 'control-chars',
  'homoglyph': 'homoglyph',
};

/** Maps ruvbot severity strings to our typed severity. */
export const SEVERITY_MAP: Record<string, AIDefenceThreat['severity']> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

/**
 * RuvBot Integration Bridge
 *
 * Bridges ruvbot (npm: ruvbot@0.1.8) with the @claude-flow/guidance control
 * plane. Wires ruvbot events to guidance hooks, wraps AIDefence as an
 * enforcement gate, governs memory operations, and feeds trust accumulation.
 *
 * ruvbot is an optional peer dependency. All types and classes are exported
 * regardless of whether ruvbot is installed. Runtime calls that require the
 * ruvbot package will throw a clear error if the package is missing.
 *
 * Components:
 * 1. RuvBotGuidanceBridge  - Event wiring, gate delegation, trust tracking
 * 2. AIDefenceGate         - Prompt injection, jailbreak, PII detection gate
 * 3. RuvBotMemoryAdapter   - Governed memory read/write with proof logging
 *
 * @module @claude-flow/guidance/ruvbot-integration
 */

import type { GateResult, GateDecision } from './types.js';
import type { MemoryAuthority, MemoryEntry, WriteDecision } from './memory-gate.js';
import type { ProofEnvelopeMetadata } from './proof.js';
import type { CoherenceScore } from './coherence.js';
import type { TrustRecord, GateOutcome } from './trust.js';
// Types + threat/severity maps moved to ./ruvbot-integration-types.ts
// (W156, P3.35 cut #1). Imported for the classes + re-exported (byte-
// identical public API).
import {
  BLOCK_SEVERITY_THRESHOLDS, THREAT_TYPE_MAP, SEVERITY_MAP,
} from './ruvbot-integration-types.js';
import type {
  RuvBotInstance, RuvBotAIDefenceGuard, RuvBotMemory, AIDefenceThreat,
  AIDefenceResult, AIDefenceGateConfig, RuvBotBridgeConfig, RuvBotEvent,
} from './ruvbot-integration-types.js';
export type {
  RuvBotInstance, RuvBotAIDefenceGuard, RuvBotMemory, AIDefenceThreat,
  AIDefenceResult, AIDefenceGateConfig, RuvBotBridgeConfig, RuvBotEvent,
} from './ruvbot-integration-types.js';

// ============================================================================
// RuvBot Ambient Types (optional peer dependency)
// ============================================================================


// The three classes were extracted into ./ruvbot-gate.ts,
// ./ruvbot-memory-adapter.ts, and ./ruvbot-bridge.ts during campaign-2
// wave 16 (W222). Re-export the public surface; the factories stay here.
export { AIDefenceGate } from './ruvbot-gate.js';
export { RuvBotMemoryAdapter } from './ruvbot-memory-adapter.js';
export { RuvBotGuidanceBridge } from './ruvbot-bridge.js';
import { AIDefenceGate } from './ruvbot-gate.js';
import { RuvBotMemoryAdapter } from './ruvbot-memory-adapter.js';
import { RuvBotGuidanceBridge } from './ruvbot-bridge.js';

export function createRuvBotBridge(
  ruvbotInstance: RuvBotInstance,
  guidancePlane: {
    gates?: import('./gates.js').EnforcementGates;
    manifestValidator?: import('./manifest-validator.js').ManifestValidator;
    trustSystem?: import('./trust.js').TrustSystem;
    aiDefenceGate?: AIDefenceGate;
    memoryAdapter?: RuvBotMemoryAdapter;
  },
  config?: Partial<RuvBotBridgeConfig>,
): RuvBotGuidanceBridge {
  const bridge = new RuvBotGuidanceBridge(config);
  bridge.attachGuidance(guidancePlane);
  bridge.connect(ruvbotInstance);
  return bridge;
}

/**
 * Create an AIDefenceGate with optional configuration.
 *
 * The gate lazily initializes the underlying ruvbot AIDefence guard
 * on the first evaluation call.
 *
 * @param config - Optional gate configuration
 * @returns A new AIDefenceGate instance
 */
export function createAIDefenceGate(
  config?: Partial<AIDefenceGateConfig>,
): AIDefenceGate {
  return new AIDefenceGate(config);
}

/**
 * Create a RuvBotMemoryAdapter with governance components.
 *
 * The adapter wraps ruvbot memory operations with MemoryWriteGate authority
 * checks and CoherenceScheduler tracking.
 *
 * @param memoryGate - The MemoryWriteGate for authority/rate/contradiction checks
 * @param coherenceScheduler - The CoherenceScheduler for drift tracking
 * @returns A new RuvBotMemoryAdapter instance
 */
export function createRuvBotMemoryAdapter(
  memoryGate: import('./memory-gate.js').MemoryWriteGate,
  coherenceScheduler: import('./coherence.js').CoherenceScheduler,
): RuvBotMemoryAdapter {
  return new RuvBotMemoryAdapter(memoryGate, coherenceScheduler);
}

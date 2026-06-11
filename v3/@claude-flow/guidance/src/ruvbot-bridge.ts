/**
 * RuvBot Integration — RuvBotGuidanceBridge
 *
 * The bridge class + the gate-decision -> trust-outcome mapper.
 * Extracted verbatim from ruvbot-integration.ts (lines 514-889) during
 * campaign-2 wave 16 (W222). ruvbot-integration.ts stays the barrel.
 */

import type {
  RuvBotInstance,
  RuvBotBridgeConfig,
  RuvBotEvent,
} from './ruvbot-integration-types.js';
import type { GateResult, GateDecision } from './types.js';
import type { GateOutcome } from './trust.js';
import { AIDefenceGate } from './ruvbot-gate.js';
import { RuvBotMemoryAdapter } from './ruvbot-memory-adapter.js';

export class RuvBotGuidanceBridge {
  private readonly config: RuvBotBridgeConfig;
  private ruvbot: RuvBotInstance | null = null;

  // Guidance components (injected)
  private gates: import('./gates.js').EnforcementGates | null = null;
  private manifestValidator: import('./manifest-validator.js').ManifestValidator | null = null;
  private trustSystem: import('./trust.js').TrustSystem | null = null;
  private aiDefenceGate: AIDefenceGate | null = null;
  private memoryAdapter: RuvBotMemoryAdapter | null = null;

  // Session proof chains keyed by sessionId
  private sessionChains: Map<string, import('./proof.js').ProofChain> = new Map();

  // Bound event handlers for cleanup
  private boundHandlers: Map<string, (...args: unknown[]) => void> = new Map();

  // Event log for diagnostics
  private eventLog: RuvBotEvent[] = [];
  private static readonly MAX_EVENT_LOG = 1000;

  constructor(config: Partial<RuvBotBridgeConfig> = {}) {
    this.config = {
      enableAIDefence: config.enableAIDefence ?? true,
      enableMemoryGovernance: config.enableMemoryGovernance ?? true,
      enableTrustTracking: config.enableTrustTracking ?? true,
      enableProofChain: config.enableProofChain ?? true,
    };
  }

  /**
   * Attach guidance control plane components.
   *
   * Accepts either a full GuidanceControlPlane instance (from which
   * sub-components are extracted) or individual components.
   */
  attachGuidance(components: {
    gates?: import('./gates.js').EnforcementGates;
    manifestValidator?: import('./manifest-validator.js').ManifestValidator;
    trustSystem?: import('./trust.js').TrustSystem;
    aiDefenceGate?: AIDefenceGate;
    memoryAdapter?: RuvBotMemoryAdapter;
  }): void {
    if (components.gates) this.gates = components.gates;
    if (components.manifestValidator) this.manifestValidator = components.manifestValidator;
    if (components.trustSystem) this.trustSystem = components.trustSystem;
    if (components.aiDefenceGate) this.aiDefenceGate = components.aiDefenceGate;
    if (components.memoryAdapter) this.memoryAdapter = components.memoryAdapter;
  }

  /**
   * Connect to a ruvbot instance and wire all event handlers.
   *
   * This is the primary entry point. Once called, the bridge will
   * intercept ruvbot events and route them through guidance gates.
   */
  connect(ruvbot: RuvBotInstance): void {
    if (this.ruvbot) {
      this.disconnect();
    }

    this.ruvbot = ruvbot;

    // Wire event handlers
    this.wireEvent('message', this.handleMessage.bind(this));
    this.wireEvent('agent:spawn', this.handleAgentSpawn.bind(this));
    this.wireEvent('session:create', this.handleSessionCreate.bind(this));
    this.wireEvent('session:end', this.handleSessionEnd.bind(this));
    this.wireEvent('ready', this.handleReady.bind(this));
    this.wireEvent('shutdown', this.handleShutdown.bind(this));
    this.wireEvent('error', this.handleError.bind(this));
    this.wireEvent('agent:stop', this.handleAgentStop.bind(this));
  }

  /**
   * Disconnect from the ruvbot instance, removing all event handlers.
   */
  disconnect(): void {
    if (!this.ruvbot) return;

    for (const [event, handler] of this.boundHandlers) {
      this.ruvbot.off(event, handler);
    }

    this.boundHandlers.clear();
    this.ruvbot = null;
  }

  /**
   * Evaluate a ruvbot AIDefence result and return a GateResult-compatible
   * decision. Can be called independently of event wiring.
   */
  async evaluateAIDefence(input: string): Promise<GateResult> {
    if (!this.aiDefenceGate) {
      throw new Error(
        'AIDefenceGate not attached. Call attachGuidance({ aiDefenceGate }) first.',
      );
    }

    const result = await this.aiDefenceGate.evaluateInput(input);
    return this.aiDefenceGate.toGateResult(result, 'manual-evaluation');
  }

  /**
   * Get the proof chain for a specific session.
   */
  getSessionProofChain(sessionId: string): import('./proof.js').ProofChain | undefined {
    return this.sessionChains.get(sessionId);
  }

  /**
   * Get all active session IDs.
   */
  getActiveSessionIds(): string[] {
    return [...this.sessionChains.keys()];
  }

  /**
   * Get the event log for diagnostics.
   */
  getEventLog(): ReadonlyArray<RuvBotEvent> {
    return this.eventLog;
  }

  /**
   * Get the current bridge configuration.
   */
  getConfig(): RuvBotBridgeConfig {
    return { ...this.config };
  }

  /**
   * Whether the bridge is currently connected to a ruvbot instance.
   */
  get connected(): boolean {
    return this.ruvbot !== null;
  }

  // ===== Event Handlers =====

  /**
   * Handle `message` events: run content through enforcement gates
   * and optionally through AIDefence.
   */
  private async handleMessage(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const content = String(data['content'] ?? data['text'] ?? '');
    const sessionId = String(data['sessionId'] ?? 'unknown');
    const agentId = String(data['agentId'] ?? 'unknown');

    this.logEvent('message', { sessionId, agentId, contentLength: content.length });

    const gateResults: GateResult[] = [];

    // Step 1: Run through EnforcementGates (secrets, destructive ops)
    if (this.gates) {
      const commandResults = this.gates.evaluateCommand(content);
      gateResults.push(...commandResults);
    }

    // Step 2: Run through AIDefence gate
    if (this.config.enableAIDefence && this.aiDefenceGate) {
      try {
        const defenceResult = await this.aiDefenceGate.evaluateInput(content);
        const gateResult = this.aiDefenceGate.toGateResult(defenceResult, `message:${sessionId}`);
        if (gateResult.decision !== 'allow') {
          gateResults.push(gateResult);
        }
      } catch {
        // AIDefence unavailable; log but do not block
      }
    }

    // Step 3: Feed outcomes into trust accumulator
    if (this.config.enableTrustTracking && this.trustSystem) {
      if (gateResults.length === 0) {
        this.trustSystem.recordOutcome(
          agentId,
          'allow',
          `Message passed all gates (session: ${sessionId})`,
        );
      } else {
        for (const result of gateResults) {
          const outcome = gateDecisionToTrustOutcome(result.decision);
          this.trustSystem.recordOutcome(
            agentId,
            outcome,
            `Gate "${result.gateName}" ${result.decision}: ${result.reason}`,
          );
        }
      }
    }
  }

  /**
   * Handle `agent:spawn` events: validate agent manifest.
   */
  private async handleAgentSpawn(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const agentId = String(data['agentId'] ?? data['id'] ?? 'unknown');
    const manifest = data['manifest'] as import('./manifest-validator.js').AgentCellManifest | undefined;

    this.logEvent('agent:spawn', { agentId, hasManifest: !!manifest });

    if (this.manifestValidator && manifest) {
      const validation = this.manifestValidator.validate(manifest);

      if (this.config.enableTrustTracking && this.trustSystem) {
        if (validation.admissionDecision === 'admit') {
          this.trustSystem.recordOutcome(
            agentId,
            'allow',
            `Agent manifest validated: admission=${validation.admissionDecision}, risk=${validation.riskScore}`,
          );
        } else {
          const outcome: GateOutcome = validation.admissionDecision === 'reject' ? 'deny' : 'warn';
          this.trustSystem.recordOutcome(
            agentId,
            outcome,
            `Agent manifest ${validation.admissionDecision}: risk=${validation.riskScore}, errors=${validation.errors.length}`,
          );
        }
      }
    }
  }

  /**
   * Handle `session:create` events: initialize a proof chain for the session.
   */
  private async handleSessionCreate(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const sessionId = String(data['sessionId'] ?? data['id'] ?? `session-${Date.now()}`);

    this.logEvent('session:create', { sessionId });

    if (this.config.enableProofChain) {
      if (!this.config.proofSigningKey) {
        throw new Error(
          'RuvBotBridgeConfig.proofSigningKey is required when enableProofChain is true',
        );
      }
      const { createProofChain } = await import('./proof.js');
      const chain = createProofChain({ signingKey: this.config.proofSigningKey });
      this.sessionChains.set(sessionId, chain);
    }
  }

  /**
   * Handle `session:end` events: finalize the proof chain and persist.
   */
  private async handleSessionEnd(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const sessionId = String(data['sessionId'] ?? data['id'] ?? 'unknown');

    this.logEvent('session:end', { sessionId });

    if (this.config.enableProofChain) {
      const chain = this.sessionChains.get(sessionId);
      if (chain) {
        // Export the finalized chain for external persistence
        const _exported = chain.export();
        // The caller can retrieve this via getSessionProofChain() before
        // the session is cleaned up, or listen for an event.

        // Clean up
        this.sessionChains.delete(sessionId);
      }
    }
  }

  /**
   * Handle `ready` events: log bridge activation.
   */
  private async handleReady(...args: unknown[]): Promise<void> {
    this.logEvent('ready', {});
  }

  /**
   * Handle `shutdown` events: clean up all session proof chains.
   */
  private async handleShutdown(...args: unknown[]): Promise<void> {
    this.logEvent('shutdown', {});
    this.sessionChains.clear();
  }

  /**
   * Handle `error` events: record a deny outcome in trust tracking.
   */
  private async handleError(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const agentId = String(data['agentId'] ?? 'unknown');
    const errorMessage = String(data['message'] ?? data['error'] ?? 'unknown error');

    this.logEvent('error', { agentId, error: errorMessage });

    if (this.config.enableTrustTracking && this.trustSystem) {
      this.trustSystem.recordOutcome(
        agentId,
        'deny',
        `Error event: ${errorMessage}`,
      );
    }
  }

  /**
   * Handle `agent:stop` events: record final trust snapshot.
   */
  private async handleAgentStop(...args: unknown[]): Promise<void> {
    const data = (args[0] ?? {}) as Record<string, unknown>;
    const agentId = String(data['agentId'] ?? data['id'] ?? 'unknown');

    this.logEvent('agent:stop', { agentId });
  }

  // ===== Private Helpers =====

  private wireEvent(event: string, handler: (...args: unknown[]) => void): void {
    this.boundHandlers.set(event, handler);
    this.ruvbot!.on(event, handler);
  }

  private logEvent(type: string, data: Record<string, unknown>): void {
    const event: RuvBotEvent = {
      type,
      timestamp: Date.now(),
      sessionId: data['sessionId'] as string | undefined,
      agentId: data['agentId'] as string | undefined,
      data,
    };

    this.eventLog.push(event);

    if (this.eventLog.length > RuvBotGuidanceBridge.MAX_EVENT_LOG) {
      this.eventLog = this.eventLog.slice(-RuvBotGuidanceBridge.MAX_EVENT_LOG);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a GateDecision to a GateOutcome for trust accumulation.
 *
 * - 'allow' -> 'allow'
 * - 'block' -> 'deny'
 * - 'require-confirmation' -> 'warn'
 * - 'warn' -> 'warn'
 */
function gateDecisionToTrustOutcome(decision: GateDecision): GateOutcome {
  switch (decision) {
    case 'allow': return 'allow';
    case 'block': return 'deny';
    case 'warn': return 'warn';
    case 'require-confirmation': return 'warn';
    default: return 'warn';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fully wired RuvBotGuidanceBridge.
 *
 * Connects the bridge to a ruvbot instance and attaches the guidance
 * control plane components. The bridge immediately begins intercepting
 * ruvbot events.
 *
 * @param ruvbotInstance - A ruvbot instance (from createRuvBot())
 * @param guidancePlane - A GuidanceControlPlane or individual components
 * @param config - Optional bridge configuration
 * @returns The connected RuvBotGuidanceBridge
 */

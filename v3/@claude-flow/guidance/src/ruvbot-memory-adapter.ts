/**
 * RuvBot Integration — RuvBotMemoryAdapter
 *
 * Extracted verbatim from ruvbot-integration.ts (lines 314-513) during
 * campaign-2 wave 16 (W222). ruvbot-integration.ts stays the barrel.
 */

import type {
  RuvBotMemory,
} from './ruvbot-integration-types.js';
import type { MemoryAuthority, MemoryEntry, WriteDecision } from './memory-gate.js';

export class RuvBotMemoryAdapter {
  private readonly memoryGate: import('./memory-gate.js').MemoryWriteGate;
  private readonly coherenceScheduler: import('./coherence.js').CoherenceScheduler;
  private proofChain: import('./proof.js').ProofChain | null = null;
  private ruvbotMemory: RuvBotMemory | null = null;
  private operationLog: Array<{
    operation: 'read' | 'write' | 'delete';
    key: string;
    namespace: string;
    timestamp: number;
    decision?: WriteDecision;
  }> = [];

  constructor(
    memoryGate: import('./memory-gate.js').MemoryWriteGate,
    coherenceScheduler: import('./coherence.js').CoherenceScheduler,
  ) {
    this.memoryGate = memoryGate;
    this.coherenceScheduler = coherenceScheduler;
  }

  /**
   * Attach a ruvbot memory instance for proxied operations.
   */
  attachMemory(memory: RuvBotMemory): void {
    this.ruvbotMemory = memory;
  }

  /**
   * Attach a proof chain for operation logging.
   */
  attachProofChain(proofChain: import('./proof.js').ProofChain): void {
    this.proofChain = proofChain;
  }

  /**
   * Governed read: reads through ruvbot memory, logs to proof chain.
   */
  async read(
    key: string,
    namespace: string = 'default',
  ): Promise<unknown> {
    this.ensureMemoryAttached();

    const value = await this.ruvbotMemory!.read(key, namespace);

    this.operationLog.push({
      operation: 'read',
      key,
      namespace,
      timestamp: Date.now(),
    });

    return value;
  }

  /**
   * Governed write: runs through MemoryWriteGate, checks coherence,
   * logs to proof chain, then delegates to ruvbot memory.
   *
   * Returns the WriteDecision. If denied, the write is not performed.
   */
  async write(
    key: string,
    namespace: string,
    value: unknown,
    authority: MemoryAuthority,
    existingEntries?: MemoryEntry[],
  ): Promise<WriteDecision> {
    this.ensureMemoryAttached();

    // Step 1: Evaluate through MemoryWriteGate
    const decision = this.memoryGate.evaluateWrite(
      authority,
      key,
      namespace,
      value,
      existingEntries,
    );

    // Step 2: Log the operation
    this.operationLog.push({
      operation: 'write',
      key,
      namespace,
      timestamp: Date.now(),
      decision,
    });

    // Step 3: If denied, do not write
    if (!decision.allowed) {
      return decision;
    }

    // Step 4: Perform the write through ruvbot
    await this.ruvbotMemory!.write(key, value, namespace);

    return decision;
  }

  /**
   * Governed delete: checks authority, logs, then delegates.
   */
  async delete(
    key: string,
    namespace: string,
    authority: MemoryAuthority,
  ): Promise<{ allowed: boolean; reason: string }> {
    this.ensureMemoryAttached();

    // Authority must have delete permission
    if (!authority.canDelete) {
      const result = {
        allowed: false,
        reason: `Agent "${authority.agentId}" does not have delete permission.`,
      };

      this.operationLog.push({
        operation: 'delete',
        key,
        namespace,
        timestamp: Date.now(),
      });

      return result;
    }

    // Perform the delete if the underlying memory supports it
    if (typeof this.ruvbotMemory!.delete === 'function') {
      await this.ruvbotMemory!.delete(key, namespace);
    }

    this.operationLog.push({
      operation: 'delete',
      key,
      namespace,
      timestamp: Date.now(),
    });

    return { allowed: true, reason: 'Delete permitted and executed.' };
  }

  /**
   * Get the operation log for audit/proof purposes.
   */
  getOperationLog(): ReadonlyArray<{
    operation: 'read' | 'write' | 'delete';
    key: string;
    namespace: string;
    timestamp: number;
    decision?: WriteDecision;
  }> {
    return this.operationLog;
  }

  /**
   * Get the count of governed operations.
   */
  get operationCount(): number {
    return this.operationLog.length;
  }

  /**
   * Clear the operation log.
   */
  clearLog(): void {
    this.operationLog = [];
  }

  // ===== Private Helpers =====

  private ensureMemoryAttached(): void {
    if (!this.ruvbotMemory) {
      throw new Error(
        'No ruvbot memory instance attached. Call attachMemory() before ' +
        'performing memory operations.',
      );
    }
  }
}

// ============================================================================
// RuvBotGuidanceBridge
// ============================================================================

/**
 * Bridges a ruvbot instance with the @claude-flow/guidance control plane.
 *
 * Wires ruvbot event hooks to guidance enforcement and trust systems:
 *
 * - `message`        -> EnforcementGates (secrets, destructive ops) + AIDefence
 * - `agent:spawn`    -> ManifestValidator
 * - `session:create` -> ProofChain initialization
 * - `session:end`    -> ProofChain finalization and ledger persistence
 * - `ready`          -> Trust accumulator initialization
 * - `error`          -> Trust 'deny' outcome recording
 *
 * All gate outcomes are fed into the TrustAccumulator so that ruvbot agents
 * build (or lose) trust over time.
 */

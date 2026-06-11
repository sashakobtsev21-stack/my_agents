/**
 * Agent Cell Conformance Kit
 *
 * Canonical acceptance test proving the entire guidance control plane works
 * end-to-end. Implements the "Memory Clerk" agent cell pattern:
 *
 * 1. Read 20 memory entries (knowledge retrieval)
 * 2. Run 1 model inference (reasoning)
 * 3. Propose 5 memory writes based on inference
 * 4. Inject a coherence drop at write #3
 * 5. Verify the system switches to read-only and blocks remaining writes
 * 6. Emit a signed proof envelope
 * 7. Return a complete, replayable trace
 *
 * @module @claude-flow/guidance/conformance-kit
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  MemoryWriteGate,
  createMemoryWriteGate,
  createMemoryEntry,
} from './memory-gate.js';
import type { MemoryAuthority, MemoryEntry } from './memory-gate.js';
import { ProofChain, createProofChain } from './proof.js';
import type { MemoryOperation } from './proof.js';
import { RunLedger, createLedger } from './ledger.js';
import {
  CoherenceScheduler,
  createCoherenceScheduler,
  EconomicGovernor,
  createEconomicGovernor,
} from './coherence.js';
import type { PrivilegeLevel } from './coherence.js';
import { DeterministicToolGateway, createToolGateway } from './gateway.js';


// The runtime types, SimulatedRuntime, and MemoryClerkCell were
// extracted into ./conformance-kit-cells.ts during campaign-2 wave 1
// (W207). Everything in that slice was public — 'export *' keeps the
// surface byte-identical. The ConformanceRunner + factories stay here.
export * from './conformance-kit-cells.js';
import {
  MemoryClerkCell,
  SimulatedRuntime,
} from './conformance-kit-cells.js';
import type { TraceEvent } from './conformance-kit-cells.js';

// ============================================================================
// Conformance Test Result
// ============================================================================

export interface ConformanceTestResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    expected: unknown;
    actual: unknown;
    details: string;
  }>;
  trace: TraceEvent[];
  proofHash: string;
  duration: number;
}

// ============================================================================
// Replay Test Result
// ============================================================================

export interface ReplayTestResult {
  identical: boolean;
  totalEvents: number;
  divergences: Array<{
    seq: number;
    originalDecision: string;
    replayDecision: string;
  }>;
}

// ============================================================================
// Conformance Runner
// ============================================================================

/**
 * Orchestrates conformance tests by creating all control plane components,
 * running the MemoryClerkCell, and verifying every invariant.
 */
export class ConformanceRunner {
  private readonly authority: MemoryAuthority;
  private readonly signingKey: string;

  constructor(authority?: MemoryAuthority, signingKey?: string) {
    if (!signingKey) {
      throw new Error('ConformanceRunner requires an explicit signingKey');
    }
    this.signingKey = signingKey;
    this.authority = authority ?? {
      agentId: 'memory-clerk-agent',
      role: 'worker',
      namespaces: ['clerk-workspace'],
      maxWritesPerMinute: 100,
      canDelete: false,
      canOverwrite: true,
      trustLevel: 0.8,
    };
  }

  /**
   * Run the full conformance test suite and return a structured result
   * with individual pass/fail checks.
   */
  runConformanceTest(): ConformanceTestResult {
    const startTime = Date.now();
    const checks: ConformanceTestResult['checks'] = [];

    // Assemble the control plane
    const memoryGate = createMemoryWriteGate({
      authorities: [this.authority],
      enableContradictionTracking: false,
    });
    const proofChain = createProofChain({ signingKey: this.signingKey });
    const ledger = createLedger();
    const coherenceScheduler = createCoherenceScheduler();
    const economicGovernor = createEconomicGovernor({
      tokenLimit: 100_000,
      toolCallLimit: 1_000,
    });

    const runtime = new SimulatedRuntime({
      memoryGate,
      proofChain,
      ledger,
      coherenceScheduler,
      economicGovernor,
      authority: this.authority,
      initialCoherenceScore: 0.9,
    });

    const cell = new MemoryClerkCell();
    const result = cell.run(runtime);

    // ----- Check 1: Exactly 20 memory reads -----
    checks.push({
      name: 'memory_reads_count',
      passed: result.memoryReads === 20,
      expected: 20,
      actual: result.memoryReads,
      details: `Expected 20 memory reads, got ${result.memoryReads}`,
    });

    // ----- Check 2: 5 memory writes attempted -----
    checks.push({
      name: 'memory_writes_attempted',
      passed: result.memoryWritesAttempted === 5,
      expected: 5,
      actual: result.memoryWritesAttempted,
      details: `Expected 5 write attempts, got ${result.memoryWritesAttempted}`,
    });

    // ----- Check 3: First 2 writes committed -----
    checks.push({
      name: 'memory_writes_committed',
      passed: result.memoryWritesCommitted === 2,
      expected: 2,
      actual: result.memoryWritesCommitted,
      details: `Expected 2 committed writes (writes 1-2 before coherence drop), got ${result.memoryWritesCommitted}`,
    });

    // ----- Check 4: Last 3 writes blocked -----
    checks.push({
      name: 'memory_writes_blocked',
      passed: result.memoryWritesBlocked === 3,
      expected: 3,
      actual: result.memoryWritesBlocked,
      details: `Expected 3 blocked writes (writes 3-5 after coherence drop), got ${result.memoryWritesBlocked}`,
    });

    // ----- Check 5: Proof envelope hash is valid SHA-256 hex -----
    const isValidHash =
      typeof result.proofEnvelopeHash === 'string' &&
      /^[0-9a-f]{64}$/.test(result.proofEnvelopeHash);
    checks.push({
      name: 'proof_envelope_hash',
      passed: isValidHash,
      expected: 'SHA-256 hex string (64 chars)',
      actual: result.proofEnvelopeHash,
      details: `Hash length: ${result.proofEnvelopeHash.length}, valid hex: ${isValidHash}`,
    });

    // ----- Check 6: Sequential seq numbers -----
    let seqValid = true;
    let seqErrorAt = -1;
    for (let i = 0; i < result.traceEvents.length; i++) {
      if (result.traceEvents[i].seq !== i) {
        seqValid = false;
        seqErrorAt = i;
        break;
      }
    }
    checks.push({
      name: 'sequential_seq_numbers',
      passed: seqValid,
      expected: 'Sequential 0..N',
      actual: seqValid
        ? `0..${result.traceEvents.length - 1}`
        : `Gap at index ${seqErrorAt} (seq=${result.traceEvents[seqErrorAt]?.seq})`,
      details: seqValid
        ? `All ${result.traceEvents.length} events have sequential seq numbers`
        : `Sequence breaks at index ${seqErrorAt}`,
    });

    // ----- Check 7: Budget tracking is consistent -----
    const budgetValid =
      result.budgetUsage.tokens > 0 && result.budgetUsage.toolCalls > 0;
    checks.push({
      name: 'budget_tracking_consistent',
      passed: budgetValid,
      expected: 'Non-zero token and tool call usage',
      actual: result.budgetUsage,
      details: `tokens=${result.budgetUsage.tokens}, toolCalls=${result.budgetUsage.toolCalls}, storageBytes=${result.budgetUsage.storageBytes}`,
    });

    // ----- Check 8: Outcome is "restricted" -----
    checks.push({
      name: 'outcome_restricted',
      passed: result.outcome === 'restricted',
      expected: 'restricted',
      actual: result.outcome,
      details:
        'Expected "restricted" when some writes committed and some blocked',
    });

    // ----- Check 9: Proof chain integrity -----
    const chainValid = proofChain.verifyChain();
    checks.push({
      name: 'proof_chain_valid',
      passed: chainValid,
      expected: true,
      actual: chainValid,
      details: 'Full proof chain HMAC and hash-chain verification',
    });

    // ----- Check 10: Trace has run_start and run_end bookends -----
    const hasRunStart = result.traceEvents.some(
      (e) => e.type === 'run_start',
    );
    const hasRunEnd = result.traceEvents.some((e) => e.type === 'run_end');
    checks.push({
      name: 'trace_bookends',
      passed: hasRunStart && hasRunEnd,
      expected: 'run_start and run_end present',
      actual: { hasRunStart, hasRunEnd },
      details: `run_start=${hasRunStart}, run_end=${hasRunEnd}`,
    });

    // ----- Check 11: Coherence history records the drop -----
    const hasCoherenceDrop = result.coherenceHistory.some(
      (s) => s < 0.3,
    );
    checks.push({
      name: 'coherence_drop_recorded',
      passed: hasCoherenceDrop,
      expected: 'At least one coherence score below 0.3',
      actual: result.coherenceHistory,
      details: `Min coherence: ${Math.min(...result.coherenceHistory).toFixed(3)}`,
    });

    const allPassed = checks.every((c) => c.passed);

    return {
      passed: allPassed,
      checks,
      trace: result.traceEvents,
      proofHash: result.proofEnvelopeHash,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Replay a previously captured trace and verify that every decision
   * is reproduced identically by the control plane logic.
   */
  runReplayTest(originalTrace: TraceEvent[]): ReplayTestResult {
    const coherenceScheduler = createCoherenceScheduler();
    const thresholds = coherenceScheduler.getThresholds();

    const divergences: ReplayTestResult['divergences'] = [];

    for (const event of originalTrace) {
      let replayDecision: string;

      switch (event.type) {
        case 'memory_read':
          replayDecision = 'read_allowed';
          break;

        case 'memory_write_proposed':
          replayDecision = 'proposed';
          break;

        case 'coherence_check': {
          const score = event.payload.score as number;
          if (score >= thresholds.healthyThreshold) {
            replayDecision = 'full';
          } else if (score >= thresholds.warningThreshold) {
            replayDecision = 'restricted';
          } else if (score >= thresholds.readOnlyThreshold) {
            replayDecision = 'read-only';
          } else {
            replayDecision = 'suspended';
          }
          break;
        }

        case 'memory_write_committed':
          replayDecision = 'committed';
          break;

        case 'memory_write_blocked': {
          const hasPrivilegeLevel =
            event.payload.privilegeLevel !== undefined;
          replayDecision = hasPrivilegeLevel
            ? 'blocked_coherence'
            : 'blocked_gate';
          break;
        }

        case 'model_infer':
          replayDecision = 'inference_complete';
          break;

        case 'tool_invoke':
          replayDecision = (event.payload.allowed as boolean)
            ? 'allowed'
            : 'blocked';
          break;

        case 'privilege_change': {
          const prev = event.payload.previousLevel as string;
          const next = event.payload.newLevel as string;
          replayDecision = `${prev}->${next}`;
          break;
        }

        case 'run_start':
          replayDecision = 'started';
          break;

        case 'run_end':
          replayDecision = event.payload.outcome as string;
          break;

        default:
          replayDecision = 'unknown';
      }

      if (replayDecision !== event.decision) {
        divergences.push({
          seq: event.seq,
          originalDecision: event.decision,
          replayDecision,
        });
      }
    }

    return {
      identical: divergences.length === 0,
      totalEvents: originalTrace.length,
      divergences,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a MemoryClerkCell with an optional cellId override.
 */
export function createMemoryClerkCell(cellId?: string): MemoryClerkCell {
  return new MemoryClerkCell(cellId);
}

/**
 * Create a ConformanceRunner with optional authority override.
 */
export function createConformanceRunner(
  authority?: MemoryAuthority,
  signingKey?: string,
): ConformanceRunner {
  return new ConformanceRunner(authority, signingKey ?? 'conformance-test-key');
}

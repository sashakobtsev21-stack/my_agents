/**
 * Uncertainty as a First-Class State
 *
 * Probabilistic belief tracking with confidence intervals, evidence counts,
 * and opposing evidence pointers. Uncertainty is preserved, not eliminated.
 *
 * Every piece of knowledge in the system carries explicit uncertainty metadata.
 * Claims can be partial, unresolved, or contested. Confidence propagates
 * through inference chains and decays over time.
 *
 * UncertaintyLedger:
 * - Asserts beliefs with explicit confidence intervals and evidence
 * - Recomputes confidence from weighted supporting/opposing evidence
 * - Propagates uncertainty through inference chains (child bounded by parent)
 * - Applies time-based decay to all beliefs
 * - Queries by namespace, status, confidence, and tags
 * - Traces full inference chains back to root beliefs
 *
 * UncertaintyAggregator:
 * - Computes aggregate confidence across multiple beliefs (geometric mean)
 * - Worst-case and best-case confidence queries
 * - Contested and confirmed status checks across belief sets
 *
 * @module @claude-flow/guidance/uncertainty
 */

import { randomUUID } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Lifecycle status of a belief.
 *
 * - confirmed: evidence strongly supports; manually or automatically resolved
 * - probable: confidence is high but not confirmed
 * - uncertain: insufficient evidence to decide
 * - contested: significant opposing evidence exists
 * - refuted: evidence strongly opposes the claim
 * - unknown: no evidence has been provided yet
 */
export type BeliefStatus =
  | 'confirmed'
  | 'probable'
  | 'uncertain'
  | 'contested'
  | 'refuted'
  | 'unknown';

/**
 * A bounded confidence estimate with lower, point, and upper values.
 * All values are in the range [0.0, 1.0].
 */
export interface ConfidenceInterval {
  /** Lower bound of the confidence interval (0.0 - 1.0) */
  lower: number;
  /** Best point estimate of confidence (0.0 - 1.0) */
  point: number;
  /** Upper bound of the confidence interval (0.0 - 1.0) */
  upper: number;
}

/**
 * A pointer to a piece of evidence that supports or opposes a belief.
 */
export interface EvidencePointer {
  /** Unique identifier of the evidence source */
  sourceId: string;
  /** Classification of the evidence origin */
  sourceType:
    | 'memory-read'
    | 'tool-output'
    | 'truth-anchor'
    | 'inference'
    | 'human-input'
    | 'agent-report';
  /** true = supporting evidence, false = opposing evidence */
  supports: boolean;
  /** Strength of this evidence (0.0 - 1.0) */
  weight: number;
  /** Unix timestamp (ms) when this evidence was recorded */
  timestamp: number;
}

/**
 * A tracked belief with full uncertainty metadata.
 */
export interface Belief {
  /** Unique belief identifier (UUID) */
  id: string;
  /** The claim this belief represents */
  claim: string;
  /** Namespace for grouping related beliefs */
  namespace: string;
  /** Bounded confidence estimate */
  confidence: ConfidenceInterval;
  /** Current lifecycle status */
  status: BeliefStatus;
  /** Evidence that supports the claim */
  evidence: EvidencePointer[];
  /** Evidence that opposes the claim */
  opposingEvidence: EvidencePointer[];
  /** Parent belief IDs this belief was inferred from */
  inferredFrom: string[];
  /** Unix timestamp (ms) when this belief was first asserted */
  firstAsserted: number;
  /** Unix timestamp (ms) of the most recent update */
  lastUpdated: number;
  /** Per-belief decay rate (confidence points lost per hour) */
  decayRate: number;
  /** Searchable tags */
  tags: string[];
}

/**
 * Configuration for the UncertaintyLedger.
 */
export interface UncertaintyConfig {
  /** Default point estimate for new beliefs (0.0 - 1.0) */
  defaultConfidence: number;
  /** Default confidence decay rate per hour */
  decayRatePerHour: number;
  /** Opposing/total evidence ratio threshold to mark a belief contested */
  contestedThreshold: number;
  /** Opposing/total evidence ratio threshold to mark a belief refuted */
  refutedThreshold: number;
  /** Minimum confidence.point required for an action; below this requires confirmation */
  minConfidenceForAction: number;
}

/**
 * Query options for filtering beliefs.
 */
export interface BeliefQueryOptions {
  /** Filter by namespace */
  namespace?: string;
  /** Filter by status */
  status?: BeliefStatus;
  /** Only include beliefs with confidence.point >= this value */
  minConfidence?: number;
  /** Only include beliefs that have all specified tags */
  tags?: string[];
}

/**
 * A node in a confidence inference chain.
 */
export interface ConfidenceChainNode {
  /** The belief at this node */
  belief: Belief;
  /** Depth in the inference chain (0 = the queried belief) */
  depth: number;
}

/**
 * Serializable ledger representation for export/import.
 */
export interface SerializedUncertaintyLedger {
  beliefs: Belief[];
  createdAt: string;
  version: number;
}

// ============================================================================
// Default Configuration
// ============================================================================


// UncertaintyLedger extracted into ./uncertainty-ledger.ts during
// campaign-2 wave 41 (W247).
export { UncertaintyLedger } from './uncertainty-ledger.js';
import { UncertaintyLedger } from './uncertainty-ledger.js';

// ============================================================================
// UncertaintyAggregator
// ============================================================================

/**
 * Computes aggregate confidence metrics across multiple beliefs.
 *
 * Provides geometric mean, worst-case, best-case, and status checks
 * over sets of beliefs referenced by ID.
 */
export class UncertaintyAggregator {
  private readonly ledger: UncertaintyLedger;

  constructor(ledger: UncertaintyLedger) {
    this.ledger = ledger;
  }

  /**
   * Compute the aggregate confidence across multiple beliefs using
   * the geometric mean of their point estimates.
   *
   * The geometric mean penalizes any single low-confidence belief more
   * heavily than an arithmetic mean, making it appropriate for combining
   * independent confidence estimates.
   *
   * @param beliefIds - IDs of beliefs to aggregate
   * @returns Geometric mean of confidence points, or 0 if no valid beliefs
   */
  aggregate(beliefIds: string[]): number {
    const confidences = this.collectConfidences(beliefIds);
    if (confidences.length === 0) return 0;

    // Geometric mean via log-space to avoid underflow
    const logSum = confidences.reduce((sum, c) => {
      // Protect against log(0)
      const safe = Math.max(c, 1e-10);
      return sum + Math.log(safe);
    }, 0);

    return Math.exp(logSum / confidences.length);
  }

  /**
   * Return the lowest confidence point among the specified beliefs.
   *
   * @param beliefIds - IDs of beliefs to check
   * @returns The minimum confidence point, or 0 if no valid beliefs
   */
  worstCase(beliefIds: string[]): number {
    const confidences = this.collectConfidences(beliefIds);
    if (confidences.length === 0) return 0;
    return Math.min(...confidences);
  }

  /**
   * Return the highest confidence point among the specified beliefs.
   *
   * @param beliefIds - IDs of beliefs to check
   * @returns The maximum confidence point, or 0 if no valid beliefs
   */
  bestCase(beliefIds: string[]): number {
    const confidences = this.collectConfidences(beliefIds);
    if (confidences.length === 0) return 0;
    return Math.max(...confidences);
  }

  /**
   * Check if any of the specified beliefs is contested.
   *
   * @param beliefIds - IDs of beliefs to check
   * @returns true if at least one belief has status 'contested'
   */
  anyContested(beliefIds: string[]): boolean {
    for (const id of beliefIds) {
      const belief = this.ledger.getBelief(id);
      if (belief && belief.status === 'contested') return true;
    }
    return false;
  }

  /**
   * Check if all of the specified beliefs are confirmed.
   *
   * @param beliefIds - IDs of beliefs to check
   * @returns true only if every belief exists and has status 'confirmed'
   */
  allConfirmed(beliefIds: string[]): boolean {
    if (beliefIds.length === 0) return false;

    for (const id of beliefIds) {
      const belief = this.ledger.getBelief(id);
      if (!belief || belief.status !== 'confirmed') return false;
    }
    return true;
  }

  // ===== Private =====

  /**
   * Collect the confidence point estimates for all valid belief IDs.
   */
  private collectConfidences(beliefIds: string[]): number[] {
    const confidences: number[] = [];
    for (const id of beliefIds) {
      const belief = this.ledger.getBelief(id);
      if (belief) {
        confidences.push(belief.confidence.point);
      }
    }
    return confidences;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an UncertaintyLedger with optional configuration.
 *
 * @param config - Partial configuration; unspecified values use defaults
 * @returns A fresh UncertaintyLedger
 */
export function createUncertaintyLedger(
  config?: Partial<UncertaintyConfig>,
): UncertaintyLedger {
  return new UncertaintyLedger(config);
}

/**
 * Create an UncertaintyAggregator backed by the given ledger.
 *
 * @param ledger - The UncertaintyLedger to aggregate over
 * @returns A fresh UncertaintyAggregator
 */
export function createUncertaintyAggregator(
  ledger: UncertaintyLedger,
): UncertaintyAggregator {
  return new UncertaintyAggregator(ledger);
}

// ============================================================================
// Helpers
// ============================================================================

// clamp moved to ./uncertainty-ledger.ts (W247).

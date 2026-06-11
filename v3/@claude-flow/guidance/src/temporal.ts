/**
 * Temporal Assertions and Validity Windows
 *
 * Bitemporal semantics for knowledge: distinguishes *assertion time* (when
 * something was recorded) from *validity time* (when the fact is/was/will be
 * true in the real world).
 *
 * The system tracks two independent timelines:
 * - Assertion time: when the assertion was recorded and when it was retracted
 * - Validity time: when the fact becomes true (validFrom) and stops being true
 *   (validUntil)
 *
 * Every assertion carries `validFrom`, `validUntil`, `assertedAt`, and
 * `supersededBy` fields. Status is computed dynamically from the current clock
 * and the assertion's lifecycle flags (retraction, supersession, expiration).
 *
 * TemporalStore:
 * - Creates assertions with explicit validity windows
 * - Retrieves assertions active at any point in time (past, present, future)
 * - Supports supersession chains (old fact replaced by new fact)
 * - Soft-delete via retraction (preserves full history)
 * - Conflict detection: finds multiple active assertions in the same namespace
 * - Export/import for persistence
 *
 * TemporalReasoner:
 * - High-level queries: whatWasTrue, whatIsTrue, whatWillBeTrue
 * - Change detection since a given timestamp
 * - Conflict detection at a point in time
 * - Forward projection of assertion validity
 *
 * @module @claude-flow/guidance/temporal
 */

import { randomUUID } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Computed lifecycle status of a temporal assertion.
 *
 * - future: the validity window has not yet opened (validFrom > now)
 * - active: the assertion is currently valid (validFrom <= now < validUntil)
 * - expired: the validity window has closed (validUntil <= now)
 * - superseded: replaced by a newer assertion
 * - retracted: explicitly withdrawn (soft-deleted, history preserved)
 */
export type TemporalStatus = 'future' | 'active' | 'expired' | 'superseded' | 'retracted';

/**
 * The temporal window describing when a fact is valid and when it was recorded.
 */
export interface ValidityWindow {
  /** Unix timestamp (ms) when the fact becomes true in the real world */
  validFrom: number;
  /** Unix timestamp (ms) when the fact stops being true, or null for indefinite */
  validUntil: number | null;
  /** Unix timestamp (ms) when the assertion was recorded in the system */
  assertedAt: number;
  /** Unix timestamp (ms) when the assertion was retracted, or null if still standing */
  retractedAt: number | null;
}

/**
 * A single temporal assertion: a claim with an explicit validity window,
 * supersession chain, confidence, and provenance metadata.
 */
export interface TemporalAssertion {
  /** Unique assertion identifier (UUID v4) */
  id: string;
  /** The claim being asserted, in natural language */
  claim: string;
  /** Namespace for grouping related assertions */
  namespace: string;
  /** The temporal validity window */
  window: ValidityWindow;
  /** Computed lifecycle status (derived from window + retraction + supersession) */
  status: TemporalStatus;
  /** ID of the assertion that replaced this one, or null */
  supersededBy: string | null;
  /** ID of the assertion that this one replaces, or null */
  supersedes: string | null;
  /** Confidence in the assertion (0.0 - 1.0) */
  confidence: number;
  /** Who or what made this assertion */
  source: string;
  /** Searchable tags */
  tags: string[];
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
}

/**
 * Query options for filtering temporal assertions.
 */
export interface TemporalQuery {
  /** Filter by namespace */
  namespace?: string;
  /** Return only assertions active at this point in time */
  pointInTime?: number;
  /** Filter by status (any match) */
  status?: TemporalStatus[];
  /** Filter by source */
  source?: string;
  /** Filter by tags (all must be present) */
  tags?: string[];
}

/**
 * Configuration for the TemporalStore.
 */
export interface TemporalConfig {
  /** Maximum number of assertions to store (default 100000) */
  maxAssertions: number;
  /** Interval (ms) for auto-expire status checks (default 60000) */
  autoExpireCheckIntervalMs: number;
}

/**
 * A full timeline for an assertion: its predecessors and successors in the
 * supersession chain.
 */
export interface TemporalTimeline {
  /** The assertion at the center of the timeline */
  assertion: TemporalAssertion;
  /** Assertions that were replaced leading up to this one (oldest first) */
  predecessors: TemporalAssertion[];
  /** Assertions that replaced this one (newest last) */
  successors: TemporalAssertion[];
}

/**
 * A detected change in the temporal store since a given timestamp.
 */
export interface TemporalChange {
  /** The assertion that changed */
  assertion: TemporalAssertion;
  /** The kind of change */
  changeType: 'asserted' | 'superseded' | 'retracted' | 'expired';
  /** When the change occurred (assertion time, retraction time, etc.) */
  changedAt: number;
}

/**
 * Optional parameters when creating a new assertion.
 */
export interface AssertOptions {
  /** Custom assertion ID (default: auto-generated UUID) */
  id?: string;
  /** Confidence in the assertion (0.0 - 1.0, default 1.0) */
  confidence?: number;
  /** Who or what is making this assertion (default 'system') */
  source?: string;
  /** Searchable tags */
  tags?: string[];
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Serializable representation for export/import.
 */
export interface SerializedTemporalStore {
  /** All assertions */
  assertions: TemporalAssertion[];
  /** When the export was created */
  createdAt: string;
  /** Schema version */
  version: number;
}


// TemporalStore was extracted into ./temporal-store.ts during campaign-2
// wave 28 (W234) (type-only back-import there — an intentional static
// cycle of the W208 function/class-decl shape). Re-export it so the
// package index resolves byte-identically.
export { TemporalStore } from './temporal-store.js';
import { TemporalStore, computeStatus } from './temporal-store.js';

// ============================================================================
// TemporalReasoner
// ============================================================================

/**
 * High-level temporal reasoning over a TemporalStore.
 *
 * Provides semantic queries like "what was true at time T", "what will be
 * true at time T", change detection, conflict detection, and forward
 * projection of assertion validity.
 */
export class TemporalReasoner {
  private readonly store: TemporalStore;

  constructor(store: TemporalStore) {
    this.store = store;
  }

  /**
   * What was true at a past point in time?
   *
   * Returns all assertions that were active (valid, not retracted, not
   * superseded) at the specified historical moment.
   *
   * @param namespace - The namespace to query
   * @param pointInTime - The historical moment (ms epoch)
   * @returns Assertions that were active at that time
   */
  whatWasTrue(namespace: string, pointInTime: number): TemporalAssertion[] {
    return this.store.getActiveAt(pointInTime, namespace);
  }

  /**
   * What is true right now?
   *
   * Returns all currently active assertions in the given namespace.
   *
   * @param namespace - The namespace to query
   * @returns Currently active assertions
   */
  whatIsTrue(namespace: string): TemporalAssertion[] {
    return this.store.getCurrentTruth(namespace);
  }

  /**
   * What will be true at a future point in time?
   *
   * Returns assertions whose validity window includes the specified future
   * time and that have not been retracted or superseded.
   *
   * @param namespace - The namespace to query
   * @param futureTime - The future moment (ms epoch)
   * @returns Assertions that will be active at that time
   */
  whatWillBeTrue(namespace: string, futureTime: number): TemporalAssertion[] {
    return this.store.getActiveAt(futureTime, namespace);
  }

  /**
   * Detect changes in a namespace since a given timestamp.
   *
   * Returns a list of changes ordered by their change time, including:
   * - New assertions created after the timestamp
   * - Assertions superseded after the timestamp
   * - Assertions retracted after the timestamp
   * - Assertions that expired after the timestamp
   *
   * @param namespace - The namespace to check
   * @param sinceTimestamp - Only include changes after this time (ms epoch)
   * @returns List of detected changes
   */
  hasChanged(namespace: string, sinceTimestamp: number): TemporalChange[] {
    const changes: TemporalChange[] = [];
    const now = Date.now();
    const all = this.store.query({ namespace });

    for (const assertion of all) {
      // New assertion
      if (assertion.window.assertedAt > sinceTimestamp) {
        changes.push({
          assertion,
          changeType: 'asserted',
          changedAt: assertion.window.assertedAt,
        });
      }

      // Retracted
      if (
        assertion.window.retractedAt !== null &&
        assertion.window.retractedAt > sinceTimestamp
      ) {
        changes.push({
          assertion,
          changeType: 'retracted',
          changedAt: assertion.window.retractedAt,
        });
      }

      // Superseded: we infer the supersession time from the successor's
      // assertedAt, since the old assertion is marked superseded when the
      // new one is created.
      if (assertion.supersededBy !== null) {
        const successor = this.store.get(assertion.supersededBy);
        if (successor && successor.window.assertedAt > sinceTimestamp) {
          changes.push({
            assertion,
            changeType: 'superseded',
            changedAt: successor.window.assertedAt,
          });
        }
      }

      // Expired: the assertion expired between sinceTimestamp and now
      if (
        assertion.window.validUntil !== null &&
        assertion.window.validUntil > sinceTimestamp &&
        assertion.window.validUntil <= now &&
        assertion.window.retractedAt === null &&
        assertion.supersededBy === null
      ) {
        changes.push({
          assertion,
          changeType: 'expired',
          changedAt: assertion.window.validUntil,
        });
      }
    }

    return changes.sort((a, b) => a.changedAt - b.changedAt);
  }

  /**
   * Detect conflicting (contradictory) assertions active at the same time
   * in the same namespace.
   *
   * Returns all concurrently active assertions if there are two or more.
   * An empty array means no conflicts.
   *
   * @param namespace - The namespace to check
   * @param pointInTime - The reference time (defaults to now)
   * @returns Conflicting assertions, or empty if no conflicts
   */
  conflictsAt(namespace: string, pointInTime?: number): TemporalAssertion[] {
    return this.store.reconcile(namespace, pointInTime);
  }

  /**
   * Project an assertion forward: will it still be valid at a future time?
   *
   * Checks whether the assertion's validity window includes the future
   * timestamp and the assertion has not been retracted or superseded.
   *
   * @param assertionId - The assertion to project
   * @param futureTimestamp - The future time to check (ms epoch)
   * @returns true if the assertion will be active at the future time
   */
  projectForward(assertionId: string, futureTimestamp: number): boolean {
    const assertion = this.store.get(assertionId);
    if (!assertion) return false;

    const futureStatus = computeStatus(assertion, futureTimestamp);
    return futureStatus === 'active';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TemporalStore with optional configuration.
 *
 * @param config - Partial configuration; unspecified values use defaults
 * @returns A fresh TemporalStore
 */
export function createTemporalStore(
  config?: Partial<TemporalConfig>,
): TemporalStore {
  return new TemporalStore(config);
}

/**
 * Create a TemporalReasoner backed by the given store.
 *
 * @param store - The TemporalStore to reason over
 * @returns A fresh TemporalReasoner
 */
export function createTemporalReasoner(
  store: TemporalStore,
): TemporalReasoner {
  return new TemporalReasoner(store);
}

// ============================================================================
// Helpers
// ============================================================================

// computeStatus/clamp moved into ./temporal-store.ts with their main
// consumer (W234); computeStatus is imported back for the reasoner.

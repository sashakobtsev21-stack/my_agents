/**
 * Convoy Observer — types, logger & validation schema
 *
 * The observer config/result shapes, the default logger, and the convoy
 * id schema. Extracted verbatim from observer.ts (lines 40-194) during
 * the P3.74 god-file decomposition (W195, cut #1). observer.ts
 * re-exports the seven originally-public types; WasmBeadNode, the
 * logger, and the schema were module-private and stay unexported from
 * the barrel.
 */

import { z } from 'zod';
import type { Convoy, ConvoyProgress } from '../types.js';
import type { BdBridge } from '../bridges/bd-bridge.js';
import type { ConvoyTracker } from './tracker.js';

// Types
// ============================================================================

/**
 * WASM graph module interface
 */
export interface WasmGraphModule {
  /** Check if dependency graph has cycles */
  has_cycle(beadsJson: string): boolean;
  /** Find nodes participating in cycles */
  find_cycle_nodes(beadsJson: string): string;
  /** Get beads with no unresolved dependencies */
  get_ready_beads(beadsJson: string): string;
  /** Compute execution levels for parallel processing */
  compute_levels(beadsJson: string): string;
  /** Topological sort of beads */
  topo_sort(beadsJson: string): string;
  /** Critical path analysis */
  critical_path(beadsJson: string): string;
}

/**
 * Bead node for WASM operations
 */
export interface WasmBeadNode {
  id: string;
  title: string;
  status: string;
  priority: number;
  blocked_by: string[];
  blocks: string[];
  duration?: number;
}

/**
 * Completion callback signature
 */
export type CompletionCallback = (convoy: Convoy, allComplete: boolean) => void;

/**
 * Observer watch handle
 */
export interface WatchHandle {
  /** Convoy ID being watched */
  convoyId: string;
  /** Stop watching */
  stop(): void;
  /** Check if still watching */
  isActive(): boolean;
}

/**
 * Observer configuration
 */
export interface ConvoyObserverConfig {
  /** BD bridge instance */
  bdBridge: BdBridge;
  /** Convoy tracker instance */
  tracker: ConvoyTracker;
  /** Optional WASM graph module */
  wasmModule?: WasmGraphModule;
  /** Initial polling interval in milliseconds */
  pollInterval?: number;
  /** Maximum poll attempts before giving up */
  maxPollAttempts?: number;
  /** Enable WASM acceleration (falls back to JS if unavailable) */
  useWasm?: boolean;
  /** Enable exponential backoff for polling */
  useExponentialBackoff?: boolean;
  /** Maximum backoff interval in milliseconds */
  maxBackoffInterval?: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Enable delta-based updates (only emit on changes) */
  deltaUpdatesOnly?: boolean;
  /** Debounce interval for progress updates in milliseconds */
  progressDebounceMs?: number;
}

/**
 * Blocker information
 */
export interface BlockerInfo {
  /** Issue ID that is blocked */
  blockedIssue: string;
  /** Issue IDs that are blocking */
  blockers: string[];
  /** True if blockers are from within the convoy */
  internalBlockers: boolean;
}

/**
 * Ready issue information
 */
export interface ReadyIssueInfo {
  /** Issue ID */
  id: string;
  /** Issue title */
  title: string;
  /** Priority */
  priority: number;
  /** Execution level (for parallel processing) */
  level: number;
}

/**
 * Completion check result
 */
export interface CompletionCheckResult {
  /** True if all issues are complete */
  allComplete: boolean;
  /** Progress statistics */
  progress: ConvoyProgress;
  /** Issues that are still open */
  openIssues: string[];
  /** Issues that are in progress */
  inProgressIssues: string[];
  /** Issues that are blocked */
  blockedIssues: BlockerInfo[];
  /** Issues ready to work on */
  readyIssues: ReadyIssueInfo[];
  /** True if there are dependency cycles */
  hasCycles: boolean;
  /** Issues involved in cycles */
  cycleIssues: string[];
}

/**
 * Logger interface
 */
export interface ObserverLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Default Logger
// ============================================================================

export const defaultLogger: ObserverLogger = {
  debug: (msg, meta) => console.debug(`[convoy-observer] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[convoy-observer] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[convoy-observer] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[convoy-observer] ${msg}`, meta ?? ''),
};

// ============================================================================
// Validation Schemas
// ============================================================================

export const ConvoyIdSchema = z.string().uuid('Invalid convoy ID format');

// ============================================================================

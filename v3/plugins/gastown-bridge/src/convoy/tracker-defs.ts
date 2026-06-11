/**
 * Convoy Tracker — event/config types, logger & validation schemas
 *
 * Extracted verbatim from tracker.ts (lines 36-143) during campaign-2
 * wave 43 (W249). tracker.ts re-exports the 4 public shapes; the
 * store shape, logger and schemas stay unexported from it.
 */

import { z } from 'zod';
import type { Convoy, ConvoyProgress, ConvoyStatus } from '../types.js';
import type { BdBridge } from '../bridges/bd-bridge.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Convoy event types
 */
export type ConvoyEventType =
  | 'convoy:created'
  | 'convoy:started'
  | 'convoy:progressed'
  | 'convoy:completed'
  | 'convoy:cancelled'
  | 'convoy:paused'
  | 'convoy:resumed'
  | 'convoy:issue:added'
  | 'convoy:issue:removed'
  | 'convoy:issue:updated';

/**
 * Convoy event payload
 */
export interface ConvoyEvent {
  /** Event type */
  type: ConvoyEventType;
  /** Convoy ID */
  convoyId: string;
  /** Convoy name */
  convoyName: string;
  /** Event timestamp */
  timestamp: Date;
  /** Previous status (for status change events) */
  previousStatus?: ConvoyStatus;
  /** Current status */
  status: ConvoyStatus;
  /** Progress at time of event */
  progress: ConvoyProgress;
  /** Issue IDs affected (for issue events) */
  issues?: string[];
  /** Cancellation reason (for cancelled events) */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Convoy tracker configuration
 */
export interface ConvoyTrackerConfig {
  /** BD bridge instance for bead operations */
  bdBridge: BdBridge;
  /** Auto-update progress on issue changes */
  autoUpdateProgress?: boolean;
  /** Progress update interval in milliseconds */
  progressUpdateInterval?: number;
  /** Enable persistent storage */
  persistConvoys?: boolean;
  /** Storage path for convoy data */
  storagePath?: string;
}

/**
 * Internal convoy storage
 */
export interface ConvoyStore {
  convoy: Convoy;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Logger interface
 */
export interface ConvoyLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Default Logger
// ============================================================================

export const defaultLogger: ConvoyLogger = {
  debug: (msg, meta) => console.debug(`[convoy-tracker] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[convoy-tracker] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[convoy-tracker] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[convoy-tracker] ${msg}`, meta ?? ''),
};

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Convoy ID schema
 */
export const ConvoyIdSchema = z.string()
  .uuid('Invalid convoy ID format');

/**
 * Issue ID array schema
 */
export const IssueIdsSchema = z.array(z.string().min(1))
  .min(1, 'At least one issue ID required');


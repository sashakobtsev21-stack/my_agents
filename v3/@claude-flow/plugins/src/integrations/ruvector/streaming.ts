/**
 * RuVector PostgreSQL Bridge - Streaming and Transaction Support
 *
 * Provides streaming capabilities for large result sets and batch operations,
 * enhanced transaction handling with savepoints and isolation levels,
 * and efficient batch processing with backpressure handling.
 *
 * @module @claude-flow/plugins/integrations/ruvector/streaming
 * @version 1.0.0
 */


// This file is now a thin barrel + factory surface: the streaming module
// was split into the sub-modules below during the P3.45 god-file
// decomposition (W166). Kept as streaming.ts so './streaming.js'
// importers keep resolving byte-identically. streaming-internal.ts is
// NOT re-exported, and only the seven originally-public type names are
// re-exported from streaming-types.ts (Pool/PgQueryResult/StreamState
// were module-private before the split).
export type {
  BatchOptions,
  InsertResult,
  IsolationLevel,
  PoolClient,
  PoolEvents,
  StreamSearchOptions,
  VectorEntry,
} from './streaming-types.js';
export * from './streaming-stream.js';
export * from './streaming-transaction.js';
export * from './streaming-batch.js';
export * from './streaming-pool-events.js';

import { RuVectorStream } from './streaming-stream.js';
import { RuVectorTransaction } from './streaming-transaction.js';
import { BatchProcessor } from './streaming-batch.js';
import { PoolEventEmitter } from './streaming-pool-events.js';
import type { BatchOptions, Pool, PoolClient } from './streaming-types.js';

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new RuVectorStream instance.
 */
export function createRuVectorStream(
  pool: Pool,
  options?: {
    schema?: string;
    defaultTableName?: string;
    highWaterMark?: number;
  }
): RuVectorStream {
  return new RuVectorStream(pool, options);
}

/**
 * Create a new RuVectorTransaction instance.
 */
export function createRuVectorTransaction(
  client: PoolClient,
  options?: {
    schema?: string;
    defaultTableName?: string;
  }
): RuVectorTransaction {
  return new RuVectorTransaction(client, options);
}

/**
 * Create a new BatchProcessor instance.
 */
export function createBatchProcessor(
  pool: Pool,
  options?: BatchOptions & { schema?: string }
): BatchProcessor {
  return new BatchProcessor(pool, options);
}

/**
 * Create a new PoolEventEmitter instance.
 */
export function createPoolEventEmitter(pool: Pool): PoolEventEmitter {
  return new PoolEventEmitter(pool);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  RuVectorStream,
  RuVectorTransaction,
  BatchProcessor,
  PoolEventEmitter,
  createRuVectorStream,
  createRuVectorTransaction,
  createBatchProcessor,
  createPoolEventEmitter,
};

/**
 * RuVector Streaming — type definitions
 *
 * Pool/client shapes and the stream/insert/batch option-result types.
 * Extracted verbatim from streaming.ts (lines 23-145) during the P3.45
 * god-file decomposition (W166). Pool, PgQueryResult, and StreamState
 * were module-private pre-split — the streaming.ts barrel re-exports
 * ONLY the seven originally-public names, keeping the API unchanged.
 */

import type { VectorSearchOptions } from './types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PostgreSQL PoolClient interface (from pg package).
 */
export interface PoolClient {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>;
  release(err?: Error): void;
}

/**
 * PostgreSQL query result interface.
 */
export interface PgQueryResult<T> {
  rows: T[];
  rowCount: number | null;
  command: string;
  fields?: Array<{ name: string; dataTypeID: number }>;
}

/**
 * Pool interface for connection management.
 */
export interface Pool {
  connect(): Promise<PoolClient>;
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>;
  end(): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): this;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/**
 * Extended search options for streaming operations.
 */
export interface StreamSearchOptions extends VectorSearchOptions {
  /** Number of results per batch (default: 1000) */
  batchSize?: number;
  /** Cursor name for server-side cursor */
  cursorName?: string;
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Whether to use a server-side cursor */
  useServerCursor?: boolean;
  /** Fetch direction for cursor */
  fetchDirection?: 'forward' | 'backward';
}

/**
 * Insert result for streaming operations.
 */
export interface InsertResult {
  /** ID of the inserted vector */
  id: string | number;
  /** Whether the insert was successful */
  success: boolean;
  /** Error message if insert failed */
  error?: string;
  /** Batch index */
  batchIndex: number;
  /** Item index within batch */
  itemIndex: number;
}

/**
 * Vector entry for streaming inserts.
 */
export interface VectorEntry {
  /** Optional ID (auto-generated if not provided) */
  id?: string | number;
  /** Vector data */
  vector: number[] | Float32Array;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transaction isolation levels.
 */
export type IsolationLevel = 'read_committed' | 'repeatable_read' | 'serializable';

/**
 * Batch processing options.
 */
export interface BatchOptions {
  /** Batch size for processing */
  batchSize?: number;
  /** Maximum concurrent batches */
  concurrency?: number;
  /** Retry failed operations */
  retryOnFailure?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable transaction mode */
  useTransaction?: boolean;
}

/**
 * Pool events interface.
 */
export interface PoolEvents {
  'pool:connect': (client: PoolClient) => void;
  'pool:acquire': (client: PoolClient) => void;
  'pool:release': (client: PoolClient) => void;
  'pool:remove': (client: PoolClient) => void;
  'pool:error': (error: Error, client?: PoolClient) => void;
}

/**
 * Stream state for backpressure handling.
 */
export interface StreamState {
  paused: boolean;
  buffer: unknown[];
  bufferSize: number;
  highWaterMark: number;
  drainPromise: Promise<void> | null;
  drainResolve: (() => void) | null;
}


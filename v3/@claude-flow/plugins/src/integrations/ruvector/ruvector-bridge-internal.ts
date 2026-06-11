/**
 * RuVector Bridge — internal shared pieces
 *
 * The pg pool shapes, plugin constants/operator maps, and the
 * RuVectorMetrics shape shared by the bridge sub-modules. These were
 * module-private in the original ruvector-bridge.ts (P3.46, W167) and
 * are deliberately NOT re-exported by the ruvector-bridge.ts barrel —
 * the public API surface (RuVectorBridge + factory + default) is
 * unchanged.
 */

import type { DistanceMetric, VectorIndexType } from './types.js';

// ============================================================================
// Type Definitions for pg (node-postgres)
// ============================================================================

/**
 * PostgreSQL Pool interface (from pg package).
 * Using interface to avoid direct dependency issues.
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

export interface PoolClient {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>;
  release(err?: Error): void;
}

export interface PgQueryResult<T> {
  rows: T[];
  rowCount: number | null;
  command: string;
  fields?: Array<{ name: string; dataTypeID: number }>;
}

export interface PoolFactory {
  Pool: new (config: PgPoolConfig) => Pool;
}

export interface PgPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  application_name?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const PLUGIN_NAME = 'ruvector-postgres';
export const PLUGIN_VERSION = '1.0.0';
export const DEFAULT_POOL_MIN = 2;
export const DEFAULT_POOL_MAX = 10;
export const DEFAULT_IDLE_TIMEOUT_MS = 30000;
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;
export const DEFAULT_QUERY_TIMEOUT_MS = 30000;
export const DEFAULT_VECTOR_COLUMN = 'embedding';
export const DEFAULT_DIMENSIONS = 1536;
export const SLOW_QUERY_THRESHOLD_MS = 1000;

/**
 * Distance metric to pgvector operator mapping.
 */
export const DISTANCE_OPERATORS: Record<DistanceMetric, string> = {
  cosine: '<=>',
  euclidean: '<->',
  dot: '<#>',
  hamming: '<~>',
  manhattan: '<+>',
  chebyshev: '<+>', // Not directly supported, fallback
  jaccard: '<~>',   // Binary similarity
  minkowski: '<->',  // Fallback to L2
  bray_curtis: '<->', // Fallback
  canberra: '<->',    // Fallback
  mahalanobis: '<->', // Fallback
  correlation: '<=>',  // Similar to cosine
};

/**
 * Index type to SQL mapping.
 */
export const INDEX_TYPE_SQL: Record<VectorIndexType, string> = {
  hnsw: 'hnsw',
  ivfflat: 'ivfflat',
  ivfpq: 'ivfflat',  // IVF with PQ uses similar syntax
  flat: '',          // No index (brute force)
  diskann: 'hnsw',   // Fallback to HNSW
};

// ============================================================================
// Metrics Interface
// ============================================================================

/**
 * Metrics collected by the RuVector Bridge.
 */
export interface RuVectorMetrics {
  queriesTotal: number;
  queriesSucceeded: number;
  queriesFailed: number;
  slowQueries: number;
  avgQueryTimeMs: number;
  vectorsInserted: number;
  vectorsUpdated: number;
  vectorsDeleted: number;
  searchesPerformed: number;
  cacheHits: number;
  cacheMisses: number;
  connectionAcquires: number;
  connectionReleases: number;
  connectionErrors: number;
  lastQueryTime: number;
  uptime: number;
}


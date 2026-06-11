/**
 * Hybrid Backend — config/query shapes & defaults
 *
 * Extracted verbatim from hybrid-backend.ts (lines 33-153) during
 * campaign-2 wave 61 (W267). The 4 public shapes are re-exported by the
 * barrel; DEFAULT_CONFIG stays unexported from it.
 */

import type { EmbeddingGenerator, MemoryQuery } from './types.js';
import type { SQLiteBackendConfig } from './sqlite-backend.js';
import type { AgentDBBackendConfig } from './agentdb-backend.js';

export interface HybridBackendConfig {
  /** SQLite configuration */
  sqlite?: Partial<SQLiteBackendConfig>;

  /** AgentDB configuration */
  agentdb?: Partial<AgentDBBackendConfig>;

  /** Default namespace */
  defaultNamespace?: string;

  /** Embedding generator function */
  embeddingGenerator?: EmbeddingGenerator;

  /** Query routing strategy */
  routingStrategy?: 'auto' | 'sqlite-first' | 'agentdb-first';

  /** Enable dual-write (write to both backends) */
  dualWrite?: boolean;

  /** Semantic search threshold for hybrid queries */
  semanticThreshold?: number;

  /** Maximum results to fetch from each backend in hybrid queries */
  hybridMaxResults?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<HybridBackendConfig> = {
  sqlite: {},
  agentdb: {},
  defaultNamespace: 'default',
  embeddingGenerator: undefined as any,
  routingStrategy: 'auto',
  dualWrite: true,
  semanticThreshold: 0.7,
  hybridMaxResults: 100,
};

/**
 * Structured Query Interface
 * Optimized for SQLite's strengths
 */
export interface StructuredQuery {
  /** Exact key match */
  key?: string;

  /** Key prefix match */
  keyPrefix?: string;

  /** Namespace filter */
  namespace?: string;

  /** Owner filter */
  ownerId?: string;

  /** Type filter */
  type?: string;

  /** Time range filters */
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;

  /** Pagination */
  limit?: number;
  offset?: number;
}

/**
 * Semantic Query Interface
 * Optimized for AgentDB's vector search
 */
export interface SemanticQuery {
  /** Content to search for (will be embedded) */
  content?: string;

  /** Pre-computed embedding */
  embedding?: Float32Array;

  /** Number of results */
  k?: number;

  /** Similarity threshold (0-1) */
  threshold?: number;

  /** Additional filters */
  filters?: Partial<MemoryQuery>;
}

/**
 * Hybrid Query Interface
 * Combines structured + semantic search
 */
export interface HybridQuery {
  /** Semantic component */
  semantic: SemanticQuery;

  /** Structured component */
  structured?: StructuredQuery;

  /** How to combine results */
  combineStrategy?: 'union' | 'intersection' | 'semantic-first' | 'structured-first';

  /** Weights for score combination */
  weights?: {
    semantic: number;
    structured: number;
  };
}

/**
 * HybridBackend Implementation
 *
 * Intelligently routes queries between SQLite and AgentDB:
 * - Exact matches, prefix queries → SQLite
 * - Semantic search, similarity → AgentDB
 * - Complex hybrid queries → Both backends with intelligent merging
 */

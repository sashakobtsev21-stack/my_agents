/**
 * @claude-flow/memory - V3 Unified Memory System
 *
 * Provides a unified memory interface backed by AgentDB with HNSW indexing
 * for ~1.9x-4.7x (measured) vector search compared to brute-force approaches.
 *
 * @module @claude-flow/memory
 *
 * @example
 * ```typescript
 * import { UnifiedMemoryService, query, QueryTemplates } from '@claude-flow/memory';
 *
 * // Initialize the memory service
 * const memory = new UnifiedMemoryService({
 *   dimensions: 1536,
 *   cacheEnabled: true,
 *   embeddingGenerator: async (text) => embeddings.embed(text),
 * });
 *
 * await memory.initialize();
 *
 * // Store entries
 * await memory.store({
 *   key: 'auth-patterns',
 *   content: 'OAuth 2.0 implementation patterns for secure authentication',
 *   tags: ['auth', 'security', 'patterns'],
 * });
 *
 * // Semantic search
 * const results = await memory.semanticSearch('user authentication best practices', 5);
 *
 * // Query with fluent builder
 * const entries = await memory.query(
 *   query()
 *     .semantic('security vulnerabilities')
 *     .inNamespace('security')
 *     .withTags(['critical'])
 *     .threshold(0.8)
 *     .limit(10)
 *     .build()
 * );
 * ```
 */

// ===== Core Types =====
export type {
  // Memory Entry Types
  MemoryType,
  AccessLevel,
  ConsistencyLevel,
  DistanceMetric,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryUpdate,

  // Query Types
  QueryType,
  MemoryQuery,
  SearchResult,
  SearchOptions,

  // HNSW Types
  HNSWConfig,
  HNSWStats,
  QuantizationConfig,

  // Backend Types
  IMemoryBackend,
  BackendStats,
  HealthCheckResult,
  ComponentHealth,

  // Cache Types
  CacheConfig,
  CacheStats,
  CachedEntry,

  // Migration Types
  MigrationSource,
  MigrationConfig,
  MigrationProgress,
  MigrationResult,
  MigrationError,

  // Event Types
  MemoryEventType,
  MemoryEvent,
  MemoryEventHandler,

  // SONA Types
  SONAMode,
  LearningPattern,

  // Utility Types
  EmbeddingGenerator,
} from './types.js';

// Utility Functions and Constants (runtime values)
export {
  generateMemoryId,
  createDefaultEntry,
  PERFORMANCE_TARGETS,
} from './types.js';

// ===== Auto Memory Bridge (ADR-048) =====
export { AutoMemoryBridge, resolveAutoMemoryDir, findGitRoot } from './auto-memory-bridge.js';
export type {
  AutoMemoryBridgeConfig,
  MemoryInsight,
  InsightCategory,
  SyncDirection,
  SyncMode,
  PruneStrategy,
  SyncResult,
  ImportResult,
} from './auto-memory-bridge.js';

// ===== Learning Bridge =====
export { LearningBridge } from './learning-bridge.js';
export type {
  LearningBridgeConfig,
  LearningStats,
  ConsolidateResult,
  PatternMatch,
} from './learning-bridge.js';

// ===== RVF Learning Persistence (ADR-057 Phase 6) =====
export { RvfLearningStore } from './rvf-learning-store.js';
export type {
  RvfLearningStoreConfig,
  PatternRecord,
  LoraRecord,
  EwcRecord,
  TrajectoryRecord,
} from './rvf-learning-store.js';
export { PersistentSonaCoordinator } from './persistent-sona.js';
export type { PersistentSonaConfig } from './persistent-sona.js';

// ===== RVF Migration (Bidirectional) =====
export { RvfMigrator } from './rvf-migration.js';
export type { RvfMigrationOptions, RvfMigrationResult } from './rvf-migration.js';

// ===== Knowledge Graph =====
export { MemoryGraph } from './memory-graph.js';
export type {
  MemoryGraphConfig,
  GraphNode,
  GraphEdge,
  GraphStats,
  RankedResult,
  EdgeType,
} from './memory-graph.js';

// ===== Agent-Scoped Memory =====
export {
  resolveAgentMemoryDir,
  createAgentBridge,
  transferKnowledge,
  listAgentScopes,
} from './agent-memory-scope.js';
export type {
  AgentMemoryScope,
  AgentScopedConfig,
  TransferOptions,
  TransferResult,
} from './agent-memory-scope.js';

// ===== Controller Registry (ADR-053) =====
export { ControllerRegistry, INIT_LEVELS } from './controller-registry.js';
export type {
  AgentDBControllerName,
  CLIControllerName,
  ControllerName,
  InitLevel,
  ControllerHealth,
  RegistryHealthReport,
  RuntimeConfig,
} from './controller-registry.js';

// ===== Core Components =====
export { AgentDBAdapter } from './agentdb-adapter.js';
export type { AgentDBAdapterConfig } from './agentdb-adapter.js';
export { AgentDBBackend } from './agentdb-backend.js';
export type { AgentDBBackendConfig } from './agentdb-backend.js';
export { SQLiteBackend } from './sqlite-backend.js';
export type { SQLiteBackendConfig } from './sqlite-backend.js';
export { SqlJsBackend } from './sqljs-backend.js';
export type { SqlJsBackendConfig } from './sqljs-backend.js';
export { HybridBackend } from './hybrid-backend.js';
export type {
  HybridBackendConfig,
  StructuredQuery,
  SemanticQuery,
  HybridQuery,
} from './hybrid-backend.js';
// `RvfBackend` and `HnswLite` are intentionally NOT re-exported from the top level
// per ADR-125 Phase 1. `RvfBackend` remains reachable via
// `createDatabase({ provider: 'rvf' })`. The legacy `hnsw-lite.ts` module was
// deleted by ADR-125 Phase 3; its brute-force-degrading code is inlined into
// `rvf-backend.ts` as a private helper.
export { HNSWIndex } from './hnsw-index.js';
export { CacheManager, TieredCacheManager } from './cache-manager.js';
export { QueryBuilder, query, QueryTemplates } from './query-builder.js';
export type { SortDirection, SortField } from './query-builder.js';
export { MemoryMigrator, createMigrator, migrateMultipleSources } from './migration.js';
export { createDatabase, getPlatformInfo, getAvailableProviders } from './database-provider.js';
export type { DatabaseProvider, DatabaseOptions } from './database-provider.js';

// ===== Smart Retrieval (ADR-090) =====
export { smartSearch, defaultQueryExpansions } from './smart-retrieval.js';
export type {
  SearchCandidate,
  RawSearchRequest,
  RawSearchResponse,
  SearchFn,
  SmartSearchOptions,
  SmartSearchStats,
  SmartSearchResult,
} from './smart-retrieval.js';

// ===== Unified Memory Service =====
import { EventEmitter } from 'node:events';
import {
  IMemoryBackend,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryUpdate,
  MemoryQuery,
  SearchResult,
  SearchOptions,
  BackendStats,
  HealthCheckResult,
  EmbeddingGenerator,
  MigrationSource,
  MigrationConfig,
  MigrationResult,
} from './types.js';
import { AgentDBAdapter, AgentDBAdapterConfig } from './agentdb-adapter.js';
import { MemoryMigrator } from './migration.js';

/**
 * Configuration for UnifiedMemoryService
 */
export interface UnifiedMemoryServiceConfig extends Partial<AgentDBAdapterConfig> {
  /** Enable automatic embedding generation */
  autoEmbed?: boolean;

  /** Default embedding dimensions */
  dimensions?: number;

  /** Embedding generator function */
  embeddingGenerator?: EmbeddingGenerator;

  /**
   * Take an HNSW + metadata snapshot every N successful `store()` calls.
   * Set to `0` (or `Infinity`) to disable interval-based snapshots — `close()`
   * still flushes. Default: 1000.
   *
   * Only takes effect when `persistenceEnabled === true` and `persistencePath`
   * is set. Added by ADR-125 Phase 3.
   */
  snapshotInterval?: number;

  /**
   * Configuration for the background {@link MemoryConsolidator}. Added by
   * ADR-125 Phase 4. When `autoRun: true`, the service starts a `setInterval`
   * timer (default 6h) that runs sweep + dedup + compact and emits the
   * result via `'consolidation:complete'`.
   */
  consolidator?: {
    autoRun?: boolean;
    intervalMs?: number;
    dedupStrategy?: 'keep-newest' | 'keep-oldest' | 'merge-tags';
  };
}

/**
 * Memory Service implementation (legacy class name).
 *
 * @deprecated Use {@link MemoryService} — the canonical name introduced by
 *   ADR-125 Phase 1. `UnifiedMemoryService` is preserved as an alias and will
 *   continue to work through `@claude-flow/memory@3.0.0-rc`. Both names refer
 *   to the same class.
 *
 * High-level interface that provides:
 * - Simple API for common operations
 * - Automatic embedding generation
 * - Cross-agent memory sharing
 * - SONA integration for learning
 * - Event-driven notifications
 * - Performance monitoring
 *
 * @see {@link MemoryService} for the canonical alias.
 */

// UnifiedMemoryService extracted into ./unified-memory-service.ts during
// campaign-2 wave 31 (W237).
export { UnifiedMemoryService, MemoryService } from './unified-memory-service.js';
import { UnifiedMemoryService } from './unified-memory-service.js';

export function createInMemoryService(): UnifiedMemoryService {
  return new UnifiedMemoryService({
    persistenceEnabled: false,
    cacheEnabled: true,
  });
}

/**
 * Create a persistent memory service
 */
export function createPersistentService(path: string): UnifiedMemoryService {
  return new UnifiedMemoryService({
    persistenceEnabled: true,
    persistencePath: path,
    cacheEnabled: true,
  });
}

/**
 * Create a memory service with embedding support
 */
export function createEmbeddingService(
  embeddingGenerator: EmbeddingGenerator,
  dimensions: number = 1536
): UnifiedMemoryService {
  return new UnifiedMemoryService({
    embeddingGenerator,
    dimensions,
    autoEmbed: true,
    cacheEnabled: true,
  });
}

/**
 * Create a hybrid memory service (SQLite + AgentDB).
 *
 * This is the DEFAULT recommended configuration per ADR-009. ADR-125 Phase 2
 * delivers the real wiring: the returned service's backend is a `HybridBackend`
 * created through `createDatabase({ provider: 'hybrid' })`, not an AgentDB-only
 * downgrade as in earlier versions.
 *
 * @example
 * ```typescript
 * const memory = await createHybridService('./data/memory.db', embeddingFn);
 * await memory.initialize();
 *
 * // Structured queries go to SQLite
 * const user = await memory.getByKey('users', 'john@example.com');
 *
 * // Semantic queries go to AgentDB
 * const similar = await memory.semanticSearch('authentication patterns', 10);
 *
 * // Verify the backend is actually hybrid
 * import { HybridBackend } from '@claude-flow/memory';
 * memory.backend instanceof HybridBackend; // true
 * ```
 */
export async function createHybridService(
  databasePath: string,
  embeddingGenerator: EmbeddingGenerator,
  dimensions: number = 1536
): Promise<UnifiedMemoryService> {
  const { createDatabase } = await import('./database-provider.js');
  const hybridBackend = await createDatabase(databasePath, {
    provider: 'hybrid',
    embeddingGenerator,
    dimensions,
  });
  const service = new UnifiedMemoryService({
    embeddingGenerator,
    dimensions,
    autoEmbed: true,
    cacheEnabled: true,
    persistenceEnabled: true,
    persistencePath: databasePath,
  });
  return service.withBackend(hybridBackend);
}

// Default export
export default UnifiedMemoryService;

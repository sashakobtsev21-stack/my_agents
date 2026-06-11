/**
 * V3 Unified Memory Types
 *
 * Type definitions for the unified memory system based on AgentDB with HNSW indexing.
 * Supports ~1.9x-4.7x (measured) vector search compared to brute-force approaches.
 *
 * @module v3/memory/types
 */

// ===== Core Memory Entry Types =====

/**
 * Memory entry type classification
 */

// The core shapes and the migration/event/learning shapes were split
// into the two modules below during campaign-2 wave 70 (W276).
export * from './types-core.js';
export * from './types-migration.js';


export type {
  LearningBridgeConfig,
  LearningStats,
  ConsolidateResult,
  PatternMatch,
} from './learning-bridge.js';

export type {
  MemoryGraphConfig,
  GraphNode,
  GraphEdge,
  GraphStats,
  RankedResult,
  EdgeType,
} from './memory-graph.js';

export type {
  AgentMemoryScope,
  AgentScopedConfig,
  TransferOptions,
  TransferResult,
} from './agent-memory-scope.js';

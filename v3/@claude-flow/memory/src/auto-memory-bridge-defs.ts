/**
 * Auto-Memory Bridge — types, topic mapping & default config
 *
 * The 8 public insight/sync/config shapes, the private ParsedEntry/
 * ResolvedConfig, and the topic/category tables + DEFAULT_CONFIG.
 * Extracted verbatim from auto-memory-bridge.ts (lines 30-180) during
 * campaign-2 wave 8 (W214). auto-memory-bridge.ts re-exports ONLY the
 * eight originally-public names.
 */

import type { LearningBridgeConfig } from './learning-bridge.js';
import type { MemoryGraphConfig } from './memory-graph.js';

// ===== Types =====

/** Insight category for organization in MEMORY.md */
export type InsightCategory =
  | 'project-patterns'
  | 'debugging'
  | 'architecture'
  | 'performance'
  | 'security'
  | 'preferences'
  | 'swarm-results';

/** Sync direction */
export type SyncDirection = 'to-auto' | 'from-auto' | 'bidirectional';

/** Sync mode determines when syncs occur */
export type SyncMode = 'on-write' | 'on-session-end' | 'periodic';

/** Prune strategy for keeping MEMORY.md under line limit */
export type PruneStrategy = 'confidence-weighted' | 'fifo' | 'lru';

/** Configuration for AutoMemoryBridge */
export interface AutoMemoryBridgeConfig {
  /** Auto memory directory path (auto-resolved if not provided) */
  memoryDir?: string;

  /** Working directory for git root detection */
  workingDir?: string;

  /** Max lines for MEMORY.md index (default: 180, Claude reads first 200) */
  maxIndexLines?: number;

  /** Topic file mapping: category → filename */
  topicMapping?: Partial<Record<InsightCategory, string>>;

  /** Sync mode (default: 'on-session-end') */
  syncMode?: SyncMode;

  /** Periodic sync interval in ms (if syncMode is 'periodic') */
  syncIntervalMs?: number;

  /** Minimum confidence for syncing to auto memory (default: 0.7) */
  minConfidence?: number;

  /** Maximum lines per topic file (default: 500) */
  maxTopicFileLines?: number;

  /** Prune strategy for MEMORY.md (default: 'confidence-weighted') */
  pruneStrategy?: PruneStrategy;

  /** Learning bridge config (ADR-049). When set, insights trigger neural learning. */
  learning?: LearningBridgeConfig;

  /** Knowledge graph config (ADR-049). When set, graph-aware curation is enabled. */
  graph?: MemoryGraphConfig;
}

/** A memory insight to record */
export interface MemoryInsight {
  /** Category for organization */
  category: InsightCategory;

  /** One-line summary for MEMORY.md index */
  summary: string;

  /** Detailed content (goes in topic file if > 2 lines) */
  detail?: string;

  /** Source: which agent/hook discovered this */
  source: string;

  /** Confidence score (0-1), used for curation priority */
  confidence: number;

  /** AgentDB entry ID for cross-reference */
  agentDbId?: string;
}

/** Result of a sync operation */
export interface SyncResult {
  /** Number of entries synced */
  synced: number;

  /** Categories that were updated */
  categories: string[];

  /** Duration of sync in milliseconds */
  durationMs: number;

  /** Any errors encountered */
  errors: string[];
}

/** Result of an import operation */
export interface ImportResult {
  /** Number of entries imported */
  imported: number;

  /** Number of entries skipped (already in AgentDB) */
  skipped: number;

  /** Files processed */
  files: string[];

  /** Duration in milliseconds */
  durationMs: number;
}

/** Parsed markdown entry from a topic file */
export interface ParsedEntry {
  heading: string;
  content: string;
  metadata: Record<string, string>;
}

// ===== Constants =====

export const DEFAULT_TOPIC_MAPPING: Record<InsightCategory, string> = {
  'project-patterns': 'patterns.md',
  'debugging': 'debugging.md',
  'architecture': 'architecture.md',
  'performance': 'performance.md',
  'security': 'security.md',
  'preferences': 'preferences.md',
  'swarm-results': 'swarm-results.md',
};

export const CATEGORY_LABELS: Record<string, string> = {
  'project-patterns': 'Project Patterns',
  'debugging': 'Debugging',
  'architecture': 'Architecture',
  'performance': 'Performance',
  'security': 'Security',
  'preferences': 'Preferences',
  'swarm-results': 'Swarm Results',
};

export type ResolvedConfig = Required<Omit<AutoMemoryBridgeConfig, 'learning' | 'graph'>> & Pick<AutoMemoryBridgeConfig, 'learning' | 'graph'>;

export const DEFAULT_CONFIG: ResolvedConfig = {
  memoryDir: '',
  workingDir: process.env.CLAUDE_FLOW_CWD || process.cwd(),
  maxIndexLines: 180,
  topicMapping: DEFAULT_TOPIC_MAPPING,
  syncMode: 'on-session-end',
  syncIntervalMs: 60_000,
  minConfidence: 0.7,
  maxTopicFileLines: 500,
  pruneStrategy: 'confidence-weighted',
};


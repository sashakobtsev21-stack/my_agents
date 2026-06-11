/**
 * Sync Bridge — caches, schemas, types & error
 *
 * The LRU/dedup caches, zod validation schemas with their z.infer type
 * twins, the config/result/conflict/state shapes, IAgentDBService/
 * SyncLogger, and SyncBridgeError. Extracted verbatim from
 * sync-bridge.ts (lines 26-275) during campaign-2 wave 12 (W218).
 * sync-bridge.ts re-exports ONLY the twelve originally-public names.
 */

import { z } from 'zod';
import { LRUCache, BatchDeduplicator } from '../cache.js';
import type { Bead, BdBridgeConfig } from './bd-bridge.js';

// ============================================================================
// Performance Caches
// ============================================================================

/** Cache for AgentDB lookups during sync */
export const agentDBLookupCache = new LRUCache<string, AgentDBEntry | null>({
  maxEntries: 500,
  ttlMs: 30 * 1000, // 30 sec TTL
});

/** Cache for conflict detection results */
export const conflictCache = new LRUCache<string, boolean>({
  maxEntries: 200,
  ttlMs: 10 * 1000, // 10 sec TTL
});

/** Deduplicator for concurrent sync operations */
export const syncDedup = new BatchDeduplicator<SyncResult>();

/**
 * FNV-1a hash for cache keys
 */
export function hashKey(parts: string[]): string {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    hash ^= 0xff;
  }
  return hash.toString(36);
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Sync conflict resolution strategy
 */
export const ConflictStrategySchema = z.enum([
  'beads-wins',      // Beads data takes precedence
  'agentdb-wins',    // AgentDB data takes precedence
  'newest-wins',     // Most recent timestamp wins
  'merge',           // Attempt to merge fields
  'manual',          // Flag for manual resolution
]);

/**
 * Sync direction
 */
export const SyncDirectionSchema = z.enum([
  'to-agentdb',      // Beads -> AgentDB
  'from-agentdb',    // AgentDB -> Beads
  'bidirectional',   // Both directions
]);

/**
 * Sync status
 */
export const SyncStatusSchema = z.enum([
  'pending',
  'in-progress',
  'completed',
  'failed',
  'conflict',
]);

/**
 * AgentDB entry schema (compatible with claude-flow memory)
 */
export const AgentDBEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  namespace: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  version: z.number().optional(),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Conflict resolution strategy type
 */
export type ConflictStrategy = z.infer<typeof ConflictStrategySchema>;

/**
 * Sync direction type
 */
export type SyncDirection = z.infer<typeof SyncDirectionSchema>;

/**
 * Sync status type
 */
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/**
 * AgentDB entry type
 */
export type AgentDBEntry = z.infer<typeof AgentDBEntrySchema>;

/**
 * Sync bridge configuration
 */
export interface SyncBridgeConfig {
  /**
   * Beads bridge configuration
   */
  beadsBridge?: BdBridgeConfig;

  /**
   * AgentDB namespace for beads
   * Default: 'beads'
   */
  agentdbNamespace?: string;

  /**
   * Conflict resolution strategy
   * Default: 'newest-wins'
   */
  conflictStrategy?: ConflictStrategy;

  /**
   * Batch size for sync operations
   * Default: 100
   */
  batchSize?: number;

  /**
   * Whether to preserve embeddings during sync
   * Default: true
   */
  preserveEmbeddings?: boolean;

  /**
   * Whether to sync metadata
   * Default: true
   */
  syncMetadata?: boolean;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: Array<{ id: string; error: string }>;
  durationMs: number;
  timestamp: string;
}

/**
 * Conflict record
 */
export interface SyncConflict {
  beadId: string;
  beadData: Bead;
  agentdbData: AgentDBEntry;
  conflictType: 'update' | 'delete' | 'create';
  resolution?: 'beads' | 'agentdb' | 'merged' | 'pending';
  resolvedAt?: string;
}

/**
 * Sync state for incremental sync
 */
export interface SyncState {
  lastSyncTime: string;
  lastBeadId?: string;
  lastAgentDBKey?: string;
  pendingConflicts: string[];
  version: number;
}

/**
 * AgentDB interface (to be provided by claude-flow)
 */
export interface IAgentDBService {
  store(key: string, value: unknown, namespace?: string, metadata?: Record<string, unknown>): Promise<void>;
  retrieve(key: string, namespace?: string): Promise<AgentDBEntry | null>;
  search(query: string, namespace?: string, limit?: number): Promise<AgentDBEntry[]>;
  list(namespace?: string, limit?: number, offset?: number): Promise<AgentDBEntry[]>;
  delete(key: string, namespace?: string): Promise<void>;
  getNamespaceStats(namespace: string): Promise<{ count: number; lastUpdated?: string }>;
}

/**
 * Logger interface
 */
export interface SyncLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Sync bridge error codes
 */
export type SyncErrorCode =
  | 'NOT_INITIALIZED'
  | 'SYNC_FAILED'
  | 'CONFLICT_UNRESOLVED'
  | 'AGENTDB_ERROR'
  | 'BEADS_ERROR'
  | 'VALIDATION_ERROR'
  | 'TRANSACTION_FAILED';

/**
 * Sync bridge error
 */
export class SyncBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: SyncErrorCode,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SyncBridgeError';
  }
}

// ============================================================================
// Default Logger
// ============================================================================

export const defaultLogger: SyncLogger = {
  debug: (msg, meta) => console.debug(`[sync-bridge] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[sync-bridge] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[sync-bridge] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[sync-bridge] ${msg}`, meta ?? ''),
};


/**
 * Beads Bridge — caches, schemas, types & constants
 *
 * The LRU caches/dedup instances, zod validation schemas, public
 * bead/result types, error class, default logger, and the allowed-
 * command table. Extracted verbatim from bd-bridge.ts (lines 31-334)
 * during the P3.76 god-file decomposition (W197). bd-bridge.ts
 * re-exports ONLY the eleven originally-public names; the private
 * pieces are imported back without re-export.
 */

import type { ChildProcess } from 'child_process';
import { z } from 'zod';
import { BatchDeduplicator, LRUCache } from '../cache.js';

// Performance Caches
// ============================================================================

/** Result cache for memoizing bead queries */
export const beadQueryCache = new LRUCache<string, Bead[]>({
  maxEntries: 100,
  ttlMs: 30 * 1000, // 30 sec TTL (beads may change)
});

/** Single bead cache */
export const singleBeadCache = new LRUCache<string, Bead>({
  maxEntries: 500,
  ttlMs: 60 * 1000, // 1 min TTL
});

/** Static data cache (version, stats) */
export const staticCache = new LRUCache<string, unknown>({
  maxEntries: 50,
  ttlMs: 5 * 60 * 1000, // 5 min TTL
});

/** Deduplicator for concurrent CLI calls */
export const execDedup = new BatchDeduplicator<BdResult<string>>();

/** Parsed JSONL cache */
export const parsedCache = new LRUCache<string, Bead[]>({
  maxEntries: 100,
  ttlMs: 30 * 1000,
});

/**
 * FNV-1a hash for cache keys
 */
export function hashArgs(args: string[]): string {
  let hash = 2166136261;
  for (const arg of args) {
    for (let i = 0; i < arg.length; i++) {
      hash ^= arg.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    hash ^= 0xff; // separator
  }
  return hash.toString(36);
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Safe string pattern - no shell metacharacters
 */
export const SafeStringSchema = z.string()
  .max(4096, 'String too long')
  .refine(
    (val) => !/[;&|`$(){}><\n\r\0]/.test(val),
    'String contains shell metacharacters'
  );

/**
 * Safe identifier pattern
 */
export const IdentifierSchema = z.string()
  .min(1, 'Identifier cannot be empty')
  .max(128, 'Identifier too long')
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Invalid identifier format');

/**
 * Bead ID schema (UUID or custom format)
 */
export const BeadIdSchema = z.string()
  .min(1, 'Bead ID cannot be empty')
  .max(64, 'Bead ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bead ID format');

/**
 * Bead type schema
 */
export const BeadTypeSchema = z.enum([
  'prompt',
  'response',
  'code',
  'context',
  'memory',
  'tool-call',
  'tool-result',
  'system',
  'error',
  'metadata',
]);

/**
 * Bead schema
 */
export const BeadSchema = z.object({
  id: BeadIdSchema,
  type: BeadTypeSchema,
  content: z.string(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  parentId: BeadIdSchema.optional(),
  threadId: z.string().optional(),
  agentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  embedding: z.array(z.number()).optional(),
  hash: z.string().optional(),
});

/**
 * BD command argument schema
 */
export const BdArgumentSchema = z.string()
  .max(1024, 'Argument too long')
  .refine(
    (val) => !val.includes('\0'),
    'Argument contains null byte'
  )
  .refine(
    (val) => !/[;&|`$(){}><]/.test(val),
    'Argument contains shell metacharacters'
  );

// ============================================================================
// Types
// ============================================================================

/**
 * Bead type (inferred from schema)
 */
export type Bead = z.infer<typeof BeadSchema>;

/**
 * Bead type enum
 */
export type BeadType = z.infer<typeof BeadTypeSchema>;

/**
 * Beads bridge configuration
 */
export interface BdBridgeConfig {
  /**
   * Path to bd executable
   * Default: 'bd' (assumes in PATH)
   */
  bdPath?: string;

  /**
   * Working directory for execution
   */
  cwd?: string;

  /**
   * Execution timeout in milliseconds
   * Default: 60000 (60 seconds)
   */
  timeout?: number;

  /**
   * Maximum buffer size for output
   * Default: 50MB (beads can be large)
   */
  maxBuffer?: number;

  /**
   * Environment variables
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Default storage path
   */
  storagePath?: string;
}

/**
 * Bead query parameters
 */
export interface BeadQuery {
  type?: BeadType | BeadType[];
  threadId?: string;
  agentId?: string;
  tags?: string[];
  after?: string; // ISO timestamp
  before?: string; // ISO timestamp
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'id' | 'type';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Bead creation parameters
 */
export interface CreateBeadParams {
  type: BeadType;
  content: string;
  parentId?: string;
  threadId?: string;
  agentId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * BD execution result
 */
export interface BdResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  command: string;
  args: string[];
  durationMs: number;
}

/**
 * Streaming execution result
 */
export interface BdStreamResult {
  process: ChildProcess;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  promise: Promise<BdResult<string>>;
}

/**
 * Logger interface
 */
export interface BdLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Beads bridge error codes
 */
export type BdErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'INVALID_ARGUMENT'
  | 'INVALID_OUTPUT'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'BEAD_NOT_FOUND';

/**
 * Beads bridge error
 */
export class BdBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: BdErrorCode,
    public readonly command?: string,
    public readonly args?: string[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BdBridgeError';
  }
}

// ============================================================================
// Default Logger
// ============================================================================

export const defaultLogger: BdLogger = {
  debug: (msg, meta) => console.debug(`[bd-bridge] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[bd-bridge] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[bd-bridge] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[bd-bridge] ${msg}`, meta ?? ''),
};

// ============================================================================
// Allowed Commands
// ============================================================================

/**
 * Allowed bd subcommands (allowlist)
 */
export const ALLOWED_BD_COMMANDS = new Set([
  'list',
  'get',
  'create',
  'update',
  'delete',
  'search',
  'export',
  'import',
  'thread',
  'stats',
  'help',
  'version',
  'config',
  'sync',
]);

// ============================================================================

/**
 * GT Bridge — caches, validation schemas, types, error & allow-list
 *
 * Extracted verbatim from gt-bridge.ts (lines 27-332) during campaign-2
 * wave 32 (W238). gt-bridge.ts re-exports ONLY the nine
 * originally-public names; caches/schemas/allow-list stay private.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { LRUCache, BatchDeduplicator } from '../cache.js';

export const execFileAsync = promisify(execFile);


// ============================================================================
// Performance Caches
// ============================================================================

/** Result cache for memoizing expensive CLI calls */
export const resultCache = new LRUCache<string, GtResult<string>>({
  maxEntries: 200,
  ttlMs: 30 * 1000, // 30 sec TTL (gas prices change frequently)
});

/** Longer cache for static data like tx status */
export const staticCache = new LRUCache<string, unknown>({
  maxEntries: 500,
  ttlMs: 5 * 60 * 1000, // 5 min TTL
});

/** Deduplicator for concurrent identical CLI calls */
export const execDedup = new BatchDeduplicator<GtResult<string>>();

/** Lazy parsed output cache */
export const parsedCache = new LRUCache<string, unknown>({
  maxEntries: 500,
  ttlMs: 60 * 1000, // 1 min TTL
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
  .max(1024, 'String too long')
  .refine(
    (val) => !/[;&|`$(){}><\n\r\0]/.test(val),
    'String contains shell metacharacters'
  );

/**
 * Safe identifier pattern - alphanumeric with underscore/hyphen
 */
export const IdentifierSchema = z.string()
  .min(1, 'Identifier cannot be empty')
  .max(64, 'Identifier too long')
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Invalid identifier format');

/**
 * Gas price schema
 */
export const GasPriceSchema = z.number()
  .positive('Gas price must be positive')
  .max(1_000_000, 'Gas price exceeds maximum');

/**
 * Gas limit schema
 */
export const GasLimitSchema = z.number()
  .int('Gas limit must be an integer')
  .positive('Gas limit must be positive')
  .max(30_000_000, 'Gas limit exceeds maximum');

/**
 * Transaction hash schema (0x prefixed hex)
 */
export const TxHashSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

/**
 * Address schema (0x prefixed hex)
 */
export const AddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');

/**
 * Network schema
 */
export const NetworkSchema = z.enum([
  'mainnet',
  'goerli',
  'sepolia',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'local',
]);

/**
 * GT command argument schema
 */
export const GtArgumentSchema = z.string()
  .max(512, 'Argument too long')
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
 * Gas Town executor configuration
 */
export interface GtBridgeConfig {
  /**
   * Path to gt executable
   * Default: 'gt' (assumes in PATH)
   */
  gtPath?: string;

  /**
   * Working directory for execution
   */
  cwd?: string;

  /**
   * Execution timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum buffer size for output
   * Default: 10MB
   */
  maxBuffer?: number;

  /**
   * Environment variables
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Default network
   */
  defaultNetwork?: z.infer<typeof NetworkSchema>;
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  gasLimit: number;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  estimatedCostUsd?: number;
}

/**
 * Transaction status
 */
export interface TxStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'dropped';
  blockNumber?: number;
  confirmations?: number;
  gasUsed?: number;
  effectiveGasPrice?: string;
  error?: string;
}

/**
 * Network status
 */
export interface NetworkStatus {
  network: string;
  chainId: number;
  blockNumber: number;
  baseFee?: string;
  gasPrice?: string;
  connected: boolean;
}

/**
 * GT execution result
 */
export interface GtResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  command: string;
  args: string[];
  durationMs: number;
}

/**
 * Logger interface
 */
export interface GtLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Gas Town bridge error codes
 */
export type GtErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'INVALID_ARGUMENT'
  | 'INVALID_OUTPUT'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Gas Town bridge error
 */
export class GtBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: GtErrorCode,
    public readonly command?: string,
    public readonly args?: string[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GtBridgeError';
  }
}

// ============================================================================
// Default Logger
// ============================================================================

export const defaultLogger: GtLogger = {
  debug: (msg, meta) => console.debug(`[gt-bridge] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[gt-bridge] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[gt-bridge] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[gt-bridge] ${msg}`, meta ?? ''),
};

// ============================================================================
// Allowed Commands
// ============================================================================

/**
 * Allowed gt subcommands (allowlist)
 */
export const ALLOWED_GT_COMMANDS = new Set([
  'estimate',
  'status',
  'network',
  'price',
  'tx',
  'simulate',
  'decode',
  'encode',
  'help',
  'version',
  'config',
]);

// ============================================================================
// Gas Town Bridge Implementation
// ============================================================================

/**
 * Gas Town CLI Bridge
 *
 * Secure wrapper around the `gt` CLI tool for gas estimation
 * and transaction management.
 *
 * @example
 * ```typescript
 * const gtBridge = new GtBridge({ gtPath: '/usr/local/bin/gt' });
 * await gtBridge.initialize();
 *
 * const estimate = await gtBridge.estimateGas({
 *   to: '0x...',
 *   data: '0x...',
 *   network: 'mainnet',
 * });
 * ```
 */

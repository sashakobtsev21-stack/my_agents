/**
 * Type definitions for the headless worker executor — worker-type /
 * sandbox / model / output / execution-mode / priority unions, the
 * worker + headless option/result configs, and the pool/queue/cache
 * internal entry shapes.
 *
 * Extracted from headless-worker-executor.ts (W143, P3.25 cut #1).
 */
import type { ChildProcess } from 'child_process';
import type { WorkerType } from '../worker-daemon.js';

export type HeadlessWorkerType =
  | 'audit'
  | 'optimize'
  | 'testgaps'
  | 'document'
  | 'ultralearn'
  | 'refactor'
  | 'deepdive'
  | 'predict';

/**
 * Local worker types - workers that run locally without AI
 */
export type LocalWorkerType = 'map' | 'consolidate' | 'benchmark' | 'preload';

/**
 * Sandbox mode for headless execution
 */
export type SandboxMode = 'strict' | 'permissive' | 'disabled';

/**
 * Model types for Claude Code
 */
export type ModelType = 'sonnet' | 'opus' | 'haiku';

/**
 * Output format for worker results
 */
export type OutputFormat = 'text' | 'json' | 'markdown';

/**
 * Execution mode for workers
 */
export type ExecutionMode = 'local' | 'headless';

/**
 * Worker priority levels
 */
export type WorkerPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================
// Interfaces
// ============================================

/**
 * Base worker configuration (matching worker-daemon.ts)
 */
export interface WorkerConfig {
  type: WorkerType;
  intervalMs: number;
  priority: WorkerPriority;
  description: string;
  enabled: boolean;
}

/**
 * Headless-specific options
 */
export interface HeadlessOptions {
  /** Prompt template for Claude Code */
  promptTemplate: string;

  /** Sandbox profile: strict, permissive, or disabled */
  sandbox: SandboxMode;

  /** Model to use: sonnet, opus, or haiku */
  model?: ModelType;

  /** Maximum tokens for output */
  maxOutputTokens?: number;

  /** Timeout in milliseconds (overrides default) */
  timeoutMs?: number;

  /** File glob patterns to include as context */
  contextPatterns?: string[];

  /** Output parsing format */
  outputFormat?: OutputFormat;
}

/**
 * Extended worker configuration with headless options
 */
export interface HeadlessWorkerConfig extends WorkerConfig {
  /** Execution mode: local or headless */
  mode: ExecutionMode;

  /** Headless-specific options (required when mode is 'headless') */
  headless?: HeadlessOptions;
}

/**
 * Executor configuration options
 */
export interface HeadlessExecutorConfig {
  /** Maximum concurrent headless processes */
  maxConcurrent?: number;

  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;

  /** Maximum files to include in context */
  maxContextFiles?: number;

  /** Maximum characters per file in context */
  maxCharsPerFile?: number;

  /** Log directory for execution logs */
  logDir?: string;

  /** Whether to cache context between runs */
  cacheContext?: boolean;

  /** Context cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Result from headless execution
 */
export interface HeadlessExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;

  /** Raw output from Claude Code */
  output: string;

  /** Parsed output (if outputFormat is json or markdown) */
  parsedOutput?: unknown;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Estimated tokens used (if available) */
  tokensUsed?: number;

  /** Model used for execution */
  model: string;

  /** Sandbox mode used */
  sandboxMode: SandboxMode;

  /** Worker type that was executed */
  workerType: HeadlessWorkerType;

  /** Timestamp of execution */
  timestamp: Date;

  /** Error message if execution failed */
  error?: string;

  /** Execution ID for tracking */
  executionId: string;
}

/**
 * Process pool entry
 */
export interface PoolEntry {
  process: ChildProcess;
  executionId: string;
  workerType: HeadlessWorkerType;
  startTime: Date;
  timeout: NodeJS.Timeout;
}

/**
 * Pending queue entry
 */
export interface QueueEntry {
  workerType: HeadlessWorkerType;
  config?: Partial<HeadlessOptions>;
  resolve: (result: HeadlessExecutionResult) => void;
  reject: (error: Error) => void;
  queuedAt: Date;
}

/**
 * Context cache entry
 */
export interface CacheEntry {
  content: string;
  timestamp: number;
  patterns: string[];
}

/**
 * Pool status information
 */
export interface PoolStatus {
  activeCount: number;
  queueLength: number;
  maxConcurrent: number;
  activeWorkers: Array<{
    executionId: string;
    workerType: HeadlessWorkerType;
    startTime: Date;
    elapsedMs: number;
  }>;
  queuedWorkers: Array<{
    workerType: HeadlessWorkerType;
    queuedAt: Date;
    waitingMs: number;
  }>;
}

// ============================================
// Constants
// ============================================


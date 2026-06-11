/**
 * Worker Dispatch — public types
 *
 * The 12 worker-trigger union, status/config/instance/result/metrics
 * shapes, and dispatch options. Extracted verbatim from
 * worker-dispatch.ts (lines 28-139) during the P3.55 god-file
 * decomposition (W176). worker-dispatch.ts stays the barrel.
 */

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Worker trigger types (matching agentic-flow@alpha)
 */
export type WorkerTrigger =
  | 'ultralearn'    // Deep knowledge acquisition
  | 'optimize'      // Performance optimization
  | 'consolidate'   // Memory consolidation
  | 'predict'       // Predictive preloading
  | 'audit'         // Security analysis
  | 'map'           // Codebase mapping
  | 'preload'       // Resource preloading
  | 'deepdive'      // Deep code analysis
  | 'document'      // Auto-documentation
  | 'refactor'      // Refactoring suggestions
  | 'benchmark'     // Performance benchmarks
  | 'testgaps';     // Test coverage analysis

/**
 * Worker status
 */
export type WorkerStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Maximum concurrent workers */
  maxConcurrent: number;
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Memory limit per worker in MB */
  memoryLimit: number;
  /** Enable auto-dispatch based on context */
  autoDispatch: boolean;
  /** Priority queue for workers */
  priorityQueue: boolean;
}

/**
 * Worker instance
 */
export interface WorkerInstance {
  id: string;
  trigger: WorkerTrigger;
  context: string;
  sessionId: string;
  status: WorkerStatus;
  progress: number;
  phase: string;
  startedAt: Date;
  completedAt?: Date;
  result?: WorkerResult;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Worker result
 */
export interface WorkerResult {
  success: boolean;
  data?: unknown;
  artifacts?: WorkerArtifact[];
  metrics?: WorkerMetrics;
  summary?: string;
}

/**
 * Worker artifact
 */
export interface WorkerArtifact {
  type: 'file' | 'data' | 'report' | 'suggestion';
  name: string;
  content: string | Buffer | Record<string, unknown>;
  size?: number;
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
  duration: number;
  tokensUsed?: number;
  filesProcessed?: number;
  itemsAnalyzed?: number;
  memoryUsed?: number;
}

/**
 * Trigger detection result
 */
export interface TriggerDetectionResult {
  detected: boolean;
  triggers: WorkerTrigger[];
  confidence: number;
  context?: string;
}

/**
 * Worker dispatch options
 */
export interface DispatchOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  context?: Record<string, unknown>;
  callback?: (worker: WorkerInstance) => void;
}


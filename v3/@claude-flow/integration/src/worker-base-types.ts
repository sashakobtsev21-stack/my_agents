/**
 * Worker Base — config/output/metrics/health shapes
 *
 * Extracted verbatim from worker-base.ts (lines 26-218) during
 * campaign-2 wave 49 (W255). worker-base.ts stays the barrel.
 */

export interface WorkerConfig {
  /** Unique worker identifier */
  id: string;
  /** Worker type classification */
  type: WorkerType;
  /** Human-readable name */
  name?: string;
  /** Worker capabilities */
  capabilities: string[];
  /** Specialization embedding vector (for similarity-based routing) */
  specialization?: Float32Array | number[];
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  /** Task execution timeout in milliseconds */
  timeout?: number;
  /** Worker priority (0-100, higher = more preferred) */
  priority?: number;
  /** Memory configuration */
  memory?: WorkerMemoryConfig;
  /** Coordination configuration */
  coordination?: WorkerCoordinationConfig;
  /** Provider configuration for multi-model support */
  provider?: WorkerProviderConfig;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Worker type classification
 */
export type WorkerType =
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'researcher'
  | 'planner'
  | 'architect'
  | 'coordinator'
  | 'security'
  | 'performance'
  | 'specialized'
  | 'long-running'
  | 'generic';

/**
 * Worker memory configuration
 */
export interface WorkerMemoryConfig {
  /** Enable persistent memory */
  enabled: boolean;
  /** Memory namespace for isolation */
  namespace?: string;
  /** Maximum memory entries */
  maxEntries?: number;
  /** Enable embedding-based retrieval */
  enableEmbeddings?: boolean;
  /** Memory bank ID (for cross-session persistence) */
  memoryBankId?: string;
}

/**
 * Worker coordination configuration
 */
export interface WorkerCoordinationConfig {
  /** Enable coordination with other workers */
  enabled: boolean;
  /** Coordination protocol */
  protocol?: 'direct' | 'broadcast' | 'pub-sub' | 'request-response';
  /** Message queue capacity */
  queueCapacity?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
}

/**
 * Worker provider configuration for multi-model support
 */
export interface WorkerProviderConfig {
  /** Provider identifier */
  providerId?: string;
  /** Model identifier */
  modelId?: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Agent output interface (compatible with agentic-flow)
 */
export interface AgentOutput {
  /** Output content */
  content: string | Record<string, unknown>;
  /** Success indicator */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Execution duration in milliseconds */
  duration: number;
  /** Tokens used (if applicable) */
  tokensUsed?: number;
  /** Artifacts produced */
  artifacts?: WorkerArtifact[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Worker artifact - files or data produced by task execution
 */
export interface WorkerArtifact {
  /** Artifact identifier */
  id: string;
  /** Artifact type */
  type: 'file' | 'data' | 'code' | 'log' | 'metric';
  /** Artifact name */
  name: string;
  /** Artifact content or path */
  content: string | Buffer | Record<string, unknown>;
  /** Content size in bytes */
  size?: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Worker metrics for monitoring
 */
export interface WorkerMetrics {
  /** Total tasks executed */
  tasksExecuted: number;
  /** Successful task count */
  tasksSucceeded: number;
  /** Failed task count */
  tasksFailed: number;
  /** Average execution duration */
  avgDuration: number;
  /** Total tokens used */
  totalTokensUsed: number;
  /** Current load (0.0-1.0) */
  currentLoad: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Health score (0.0-1.0) */
  healthScore: number;
}

/**
 * Worker health status
 */
export interface WorkerHealth {
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health score (0.0-1.0) */
  score: number;
  /** Active issues */
  issues: string[];
  /** Last health check timestamp */
  lastCheck: number;
  /** Resource usage */
  resources: {
    memoryMb: number;
    cpuPercent: number;
  };
}

/**
 * WorkerBase - Abstract base class for all workers
 *
 * This class provides the foundation for:
 * - SpecializedWorker: Domain-specific task processing
 * - LongRunningWorker: Checkpoint-based long-running tasks
 * - Generic workers for various use cases
 *
 * Usage:
 * ```typescript
 * class CoderWorker extends WorkerBase {
 *   async execute(task: Task): Promise<AgentOutput> {
 *     // Implementation
 *   }
 * }
 *
 * const worker = new CoderWorker({
 *   id: 'coder-1',
 *   type: 'coder',
 *   capabilities: ['code-generation', 'refactoring'],
 * });
 *
 * await worker.initialize();
 * const result = await worker.execute(task);
 * ```
 */

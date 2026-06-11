/**
 * Worker Queue — task/config/stats shapes, defaults & in-memory store
 *
 * Extracted verbatim from worker-queue.ts (lines 24-272) during
 * campaign-2 wave 79 (W285). The public shapes are re-exported by the
 * barrel; DEFAULT_CONFIG/PRIORITY_SCORES/InMemoryStore stay unexported
 * from it.
 */

import type {
  HeadlessWorkerType,
  HeadlessExecutionResult,
  WorkerPriority,
} from './headless-worker-executor.js';

// ============================================
// Type Definitions
// ============================================

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout' | 'cancelled';

/**
 * Queue task
 */
export interface QueueTask {
  id: string;
  workerType: HeadlessWorkerType;
  priority: WorkerPriority;
  payload: {
    prompt?: string;
    contextPatterns?: string[];
    sandbox?: string;
    model?: string;
    timeoutMs?: number;
  };
  status: TaskStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  workerId?: string;
  retryCount: number;
  maxRetries: number;
  result?: HeadlessExecutionResult;
  error?: string;
}

/**
 * Queue configuration
 */
export interface WorkerQueueConfig {
  /** Redis connection URL */
  redisUrl: string;

  /** Queue name prefix */
  queuePrefix: string;

  /** Default task timeout in ms */
  defaultTimeoutMs: number;

  /** Maximum retries for failed tasks */
  maxRetries: number;

  /** Task result TTL in seconds */
  resultTtlSeconds: number;

  /** Worker heartbeat interval in ms */
  heartbeatIntervalMs: number;

  /** Dead letter queue enabled */
  deadLetterEnabled: boolean;

  /** Visibility timeout in ms (task processing lock) */
  visibilityTimeoutMs: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  byPriority: Record<WorkerPriority, number>;
  byWorkerType: Partial<Record<HeadlessWorkerType, number>>;
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
}

/**
 * Worker registration info
 */
export interface WorkerRegistration {
  workerId: string;
  workerTypes: HeadlessWorkerType[];
  maxConcurrent: number;
  currentTasks: number;
  lastHeartbeat: Date;
  registeredAt: Date;
  hostname?: string;
  containerId?: string;
}

// ============================================
// Constants
// ============================================

export const DEFAULT_CONFIG: WorkerQueueConfig = {
  redisUrl: 'redis://localhost:6379',
  queuePrefix: 'claude-flow:queue',
  defaultTimeoutMs: 300000, // 5 minutes
  maxRetries: 3,
  resultTtlSeconds: 86400, // 24 hours
  heartbeatIntervalMs: 30000, // 30 seconds
  deadLetterEnabled: true,
  visibilityTimeoutMs: 60000, // 1 minute
};

export const PRIORITY_SCORES: Record<WorkerPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

// ============================================
// In-Memory Redis Simulation (for non-Redis environments)
// ============================================

/**
 * Simple in-memory queue implementation for environments without Redis
 * Production should use actual Redis connection
 */
export class InMemoryStore {
  private tasks: Map<string, QueueTask> = new Map();
  private queues: Map<string, string[]> = new Map();
  private workers: Map<string, WorkerRegistration> = new Map();
  private results: Map<string, { result: HeadlessExecutionResult; expiresAt: number }> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * Start cleanup timer (called after initialization)
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60000);
    this.cleanupTimer.unref();
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // Task operations
  setTask(id: string, task: QueueTask): void {
    this.tasks.set(id, task);
  }

  getTask(id: string): QueueTask | undefined {
    return this.tasks.get(id);
  }

  deleteTask(id: string): void {
    this.tasks.delete(id);
  }

  // Queue operations
  pushToQueue(queue: string, taskId: string, priority: number): void {
    const queueTasks = this.queues.get(queue) || [];
    // Insert based on priority (higher priority = earlier in queue)
    let insertIndex = queueTasks.length;
    for (let i = 0; i < queueTasks.length; i++) {
      const task = this.tasks.get(queueTasks[i]);
      if (task && PRIORITY_SCORES[task.priority] < priority) {
        insertIndex = i;
        break;
      }
    }
    queueTasks.splice(insertIndex, 0, taskId);
    this.queues.set(queue, queueTasks);
  }

  popFromQueue(queue: string): string | null {
    const queueTasks = this.queues.get(queue) || [];
    if (queueTasks.length === 0) return null;
    return queueTasks.shift() || null;
  }

  getQueueLength(queue: string): number {
    return (this.queues.get(queue) || []).length;
  }

  // Worker operations
  setWorker(workerId: string, registration: WorkerRegistration): void {
    this.workers.set(workerId, registration);
  }

  getWorker(workerId: string): WorkerRegistration | undefined {
    return this.workers.get(workerId);
  }

  deleteWorker(workerId: string): void {
    this.workers.delete(workerId);
  }

  getAllWorkers(): WorkerRegistration[] {
    return Array.from(this.workers.values());
  }

  // Result operations
  setResult(taskId: string, result: HeadlessExecutionResult, ttlSeconds: number): void {
    this.results.set(taskId, {
      result,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  getResult(taskId: string): HeadlessExecutionResult | undefined {
    const entry = this.results.get(taskId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.results.delete(taskId);
      return undefined;
    }
    return entry.result;
  }

  // Stats
  getStats(): { tasks: number; workers: number; results: number } {
    return {
      tasks: this.tasks.size,
      workers: this.workers.size,
      results: this.results.size,
    };
  }

  // Cleanup
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.results) {
      if (now > entry.expiresAt) {
        this.results.delete(id);
      }
    }
  }
}

// ============================================
// WorkerQueue Class
// ============================================

/**
 * WorkerQueue - Redis-based task queue for distributed worker execution
 */

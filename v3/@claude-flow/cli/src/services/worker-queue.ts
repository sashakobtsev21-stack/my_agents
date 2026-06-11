/**
 * Worker Queue Service
 * Redis-based task queue for distributed headless worker execution.
 *
 * ADR-020: Headless Worker Integration Architecture - Phase 4
 * - Priority-based task scheduling
 * - Result persistence and retrieval
 * - Distributed locking for task assignment
 * - Dead letter queue for failed tasks
 * - Metrics and monitoring
 *
 * Key Features:
 * - FIFO with priority levels (critical, high, normal, low)
 * - Automatic retry with exponential backoff
 * - Task timeout detection
 * - Result caching with TTL
 * - Worker heartbeat monitoring
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { HeadlessWorkerType, HeadlessExecutionResult, WorkerPriority } from './headless-worker-executor.js';


// Types/defaults/store extracted into ./worker-queue-store.ts during
// campaign-2 wave 79 (W285).
export type {
  TaskStatus,
  QueueTask,
  WorkerQueueConfig,
  QueueStats,
  WorkerRegistration,
} from './worker-queue-store.js';
import {
  DEFAULT_CONFIG,
  InMemoryStore,
  PRIORITY_SCORES,
} from './worker-queue-store.js';
import type {
  QueueStats,
  QueueTask,
  WorkerQueueConfig,
  WorkerRegistration,
} from './worker-queue-store.js';

export class WorkerQueue extends EventEmitter {
  private config: WorkerQueueConfig;
  private store: InMemoryStore;
  private workerId: string;
  private heartbeatTimer?: NodeJS.Timeout;
  private processingTasks: Set<string> = new Set();
  private isShuttingDown = false;
  private maxConcurrent = 1;
  private initialized = false;

  constructor(config?: Partial<WorkerQueueConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new InMemoryStore();
    this.workerId = `worker-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Initialize the queue (starts cleanup timers)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.store.startCleanup();
    this.initialized = true;
    this.emit('initialized', { workerId: this.workerId });
  }

  // ============================================
  // Public API - Task Management
  // ============================================

  /**
   * Enqueue a new task
   */
  async enqueue(
    workerType: HeadlessWorkerType,
    payload: QueueTask['payload'] = {},
    options?: {
      priority?: WorkerPriority;
      maxRetries?: number;
      timeoutMs?: number;
    }
  ): Promise<string> {
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate worker type
    if (!workerType || typeof workerType !== 'string') {
      throw new Error('Invalid worker type');
    }

    // Validate priority
    const priority = options?.priority || 'normal';
    if (!['critical', 'high', 'normal', 'low'].includes(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    const taskId = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const task: QueueTask = {
      id: taskId,
      workerType,
      priority,
      payload: {
        ...payload,
        timeoutMs: options?.timeoutMs || this.config.defaultTimeoutMs,
      },
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.config.maxRetries,
    };

    // Store task
    this.store.setTask(taskId, task);

    // Add to priority queue
    const queueName = this.getQueueName(workerType);
    this.store.pushToQueue(queueName, taskId, PRIORITY_SCORES[priority]);

    this.emit('taskEnqueued', { taskId, workerType, priority });

    return taskId;
  }

  /**
   * Dequeue a task for processing
   */
  async dequeue(workerTypes: HeadlessWorkerType[]): Promise<QueueTask | null> {
    if (this.isShuttingDown) return null;

    // Check queues in priority order
    for (const workerType of workerTypes) {
      const queueName = this.getQueueName(workerType);
      const taskId = this.store.popFromQueue(queueName);

      if (taskId) {
        const task = this.store.getTask(taskId);
        if (task && task.status === 'pending') {
          task.status = 'processing';
          task.startedAt = new Date();
          task.workerId = this.workerId;
          this.store.setTask(taskId, task);
          this.processingTasks.add(taskId);

          this.emit('taskDequeued', { taskId, workerType });
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Complete a task with result
   */
  async complete(taskId: string, result: HeadlessExecutionResult): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      this.emit('warning', { message: `Task ${taskId} not found for completion` });
      return;
    }

    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    this.store.setTask(taskId, task);

    // Store result with TTL
    this.store.setResult(taskId, result, this.config.resultTtlSeconds);

    this.processingTasks.delete(taskId);
    this.emit('taskCompleted', { taskId, result, duration: task.completedAt.getTime() - (task.startedAt?.getTime() || 0) });
  }

  /**
   * Fail a task with error
   */
  async fail(taskId: string, error: string, retryable = true): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      this.emit('warning', { message: `Task ${taskId} not found for failure` });
      return;
    }

    this.processingTasks.delete(taskId);

    // Check if we should retry
    if (retryable && task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = 'pending';
      task.startedAt = undefined;
      task.workerId = undefined;
      task.error = error;
      this.store.setTask(taskId, task);

      // Re-queue with delay (exponential backoff)
      const delay = Math.min(30000, 1000 * Math.pow(2, task.retryCount));
      setTimeout(() => {
        const queueName = this.getQueueName(task.workerType);
        this.store.pushToQueue(queueName, taskId, PRIORITY_SCORES[task.priority]);
      }, delay);

      this.emit('taskRetrying', { taskId, retryCount: task.retryCount, delay });
    } else {
      // Move to failed/dead letter
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error;
      this.store.setTask(taskId, task);

      if (this.config.deadLetterEnabled) {
        const dlqName = `${this.config.queuePrefix}:dlq`;
        this.store.pushToQueue(dlqName, taskId, 0);
      }

      this.emit('taskFailed', { taskId, error, retryCount: task.retryCount });
    }
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<QueueTask | null> {
    return this.store.getTask(taskId) || null;
  }

  /**
   * Get task result
   */
  async getResult(taskId: string): Promise<HeadlessExecutionResult | null> {
    return this.store.getResult(taskId) || null;
  }

  /**
   * Cancel a pending task
   */
  async cancel(taskId: string): Promise<boolean> {
    const task = this.store.getTask(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    this.store.setTask(taskId, task);

    this.emit('taskCancelled', { taskId });
    return true;
  }

  // ============================================
  // Public API - Worker Management
  // ============================================

  /**
   * Register this instance as a worker
   */
  async registerWorker(
    workerTypes: HeadlessWorkerType[],
    options?: { maxConcurrent?: number; hostname?: string; containerId?: string }
  ): Promise<string> {
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate worker types
    if (!Array.isArray(workerTypes) || workerTypes.length === 0) {
      throw new Error('Worker types must be a non-empty array');
    }

    this.maxConcurrent = options?.maxConcurrent || 1;

    const registration: WorkerRegistration = {
      workerId: this.workerId,
      workerTypes,
      maxConcurrent: this.maxConcurrent,
      currentTasks: 0,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
      hostname: options?.hostname,
      containerId: options?.containerId,
    };

    this.store.setWorker(this.workerId, registration);

    // Start heartbeat
    this.startHeartbeat();

    this.emit('workerRegistered', { workerId: this.workerId, workerTypes });
    return this.workerId;
  }

  /**
   * Unregister this worker
   */
  async unregisterWorker(): Promise<void> {
    this.stopHeartbeat();
    this.store.deleteWorker(this.workerId);
    this.emit('workerUnregistered', { workerId: this.workerId });
  }

  /**
   * Get all registered workers
   */
  async getWorkers(): Promise<WorkerRegistration[]> {
    return this.store.getAllWorkers();
  }

  // ============================================
  // Public API - Statistics
  // ============================================

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    // store.getStats() probe is the store-warmup signal; the aggregate
    // pending/completed renderer below currently returns 0 placeholders
    // (TODO: aggregate across all queues), so the per-store stats aren't
    // piped through yet.
    this.store.getStats();

    // This is a simplified implementation
    // Full implementation would aggregate across all queues
    const stats: QueueStats = {
      pending: 0,
      processing: this.processingTasks.size,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      byPriority: { critical: 0, high: 0, normal: 0, low: 0 },
      byWorkerType: {},
      averageWaitTimeMs: 0,
      averageProcessingTimeMs: 0,
    };

    return stats;
  }

  // ============================================
  // Public API - Lifecycle
  // ============================================

  /**
   * Start processing tasks
   */
  async start(
    workerTypes: HeadlessWorkerType[],
    handler: (task: QueueTask) => Promise<HeadlessExecutionResult>,
    options?: { maxConcurrent?: number }
  ): Promise<void> {
    await this.registerWorker(workerTypes, { maxConcurrent: options?.maxConcurrent });

    const processLoop = async () => {
      while (!this.isShuttingDown) {
        try {
          // Respect concurrency limit
          if (this.processingTasks.size >= this.maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }

          const task = await this.dequeue(workerTypes);

          if (task) {
            // Process task without blocking the loop (allows concurrency)
            this.processTask(task, handler).catch(error => {
              this.emit('error', { taskId: task.id, error: String(error) });
            });
          } else {
            // No task available, wait before polling again
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          this.emit('error', { error: error instanceof Error ? error.message : String(error) });
          // Wait before retrying to avoid tight error loop
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    // Start processing
    processLoop().catch(error => {
      this.emit('error', { error: error instanceof Error ? error.message : String(error) });
    });
  }

  /**
   * Process a single task
   */
  private async processTask(
    task: QueueTask,
    handler: (task: QueueTask) => Promise<HeadlessExecutionResult>
  ): Promise<void> {
    try {
      const result = await handler(task);
      await this.complete(task.id, result);
    } catch (error) {
      await this.fail(task.id, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Shutdown the queue gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // Wait for processing tasks to complete (with timeout)
    const timeout = 30000;
    const start = Date.now();

    while (this.processingTasks.size > 0 && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force fail remaining tasks
    for (const taskId of this.processingTasks) {
      await this.fail(taskId, 'Worker shutdown', false);
    }

    // Stop store cleanup
    this.store.stopCleanup();

    await this.unregisterWorker();
    this.initialized = false;
    this.emit('shutdown', {});
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Get queue name for worker type
   */
  private getQueueName(workerType: HeadlessWorkerType): string {
    return `${this.config.queuePrefix}:${workerType}`;
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const registration = this.store.getWorker(this.workerId);
      if (registration) {
        registration.lastHeartbeat = new Date();
        registration.currentTasks = this.processingTasks.size;
        this.store.setWorker(this.workerId, registration);
      }
    }, this.config.heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}

// Export default
export default WorkerQueue;

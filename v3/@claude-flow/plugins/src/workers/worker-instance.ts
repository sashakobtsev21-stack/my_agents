/**
 * Plugin Workers — WorkerInstance
 *
 * The worker-event table, task/result/config/pool shapes and the
 * WorkerInstance class. Extracted verbatim from index.ts (lines 23-292)
 * during campaign-2 wave 93 (W299). index.ts stays the barrel.
 */

import { EventEmitter } from 'events';
import type {
  WorkerDefinition,
  WorkerType,
  WorkerResult,
  WorkerMetrics,
  WorkerHealth,
  ILogger,
  IEventBus,
} from '../types/index.js';

export const WORKER_EVENTS = {
  SPAWNED: 'worker:spawned',
  STARTED: 'worker:started',
  COMPLETED: 'worker:completed',
  FAILED: 'worker:failed',
  TERMINATED: 'worker:terminated',
  HEALTH_CHECK: 'worker:health-check',
  METRICS_UPDATE: 'worker:metrics-update',
} as const;

export type WorkerEvent = typeof WORKER_EVENTS[keyof typeof WORKER_EVENTS];

// ============================================================================
// Worker Task
// ============================================================================

export interface WorkerTask {
  readonly id: string;
  readonly type: string;
  readonly input: unknown;
  readonly priority?: number;
  readonly timeout?: number;
  readonly retries?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface WorkerTaskResult extends WorkerResult {
  readonly taskId: string;
  readonly taskType: string;
  readonly retryCount?: number;
}

// ============================================================================
// Worker Pool Configuration
// ============================================================================

export interface WorkerPoolConfig {
  readonly minWorkers: number;
  readonly maxWorkers: number;
  readonly taskQueueSize: number;
  readonly workerIdleTimeout: number;
  readonly healthCheckInterval: number;
  readonly scalingThreshold: number;
  readonly logger?: ILogger;
  readonly eventBus?: IEventBus;
}

export const DEFAULT_POOL_CONFIG: WorkerPoolConfig = {
  minWorkers: 1,
  maxWorkers: 10,
  taskQueueSize: 100,
  workerIdleTimeout: 60000,
  healthCheckInterval: 30000,
  scalingThreshold: 0.8,
};

// ============================================================================
// Worker Instance
// ============================================================================

export interface IWorkerInstance {
  readonly id: string;
  readonly definition: WorkerDefinition;
  readonly status: 'idle' | 'busy' | 'error' | 'terminated';
  readonly currentTask?: WorkerTask;
  readonly metrics: WorkerMetrics;

  execute(task: WorkerTask): Promise<WorkerTaskResult>;
  terminate(): Promise<void>;
  healthCheck(): Promise<WorkerHealth>;
  getMetrics(): WorkerMetrics;
}

/**
 * Worker instance implementation.
 */
export class WorkerInstance extends EventEmitter implements IWorkerInstance {
  readonly id: string;
  readonly definition: WorkerDefinition;
  private _status: 'idle' | 'busy' | 'error' | 'terminated' = 'idle';
  private _currentTask?: WorkerTask;
  private _metrics: WorkerMetrics;
  private readonly startTime: number;
  // Track last activity for idle detection
  public lastActivity: number;

  constructor(id: string, definition: WorkerDefinition) {
    super();
    this.id = id;
    this.definition = definition;
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    this._metrics = this.initMetrics();
  }

  get status(): 'idle' | 'busy' | 'error' | 'terminated' {
    return this._status;
  }

  get currentTask(): WorkerTask | undefined {
    return this._currentTask;
  }

  get metrics(): WorkerMetrics {
    return { ...this._metrics };
  }

  private initMetrics(): WorkerMetrics {
    return {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      avgDuration: 0,
      totalTokensUsed: 0,
      currentLoad: 0,
      uptime: 0,
      lastActivity: Date.now(),
      healthScore: 1.0,
    };
  }

  async execute(task: WorkerTask): Promise<WorkerTaskResult> {
    if (this._status === 'terminated') {
      throw new Error(`Worker ${this.id} is terminated`);
    }

    this._status = 'busy';
    this._currentTask = task;
    this.lastActivity = Date.now();
    const startTime = Date.now();

    try {
      // Execute task via agentic-flow task runner
      const result = await this.executeTask(task);

      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration, result.tokensUsed);

      this._status = 'idle';
      this._currentTask = undefined;

      return {
        workerId: this.id,
        taskId: task.id,
        taskType: task.type,
        success: true,
        output: result.output,
        duration,
        tokensUsed: result.tokensUsed,
        metadata: result.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration);

      this._status = 'error';
      this._currentTask = undefined;

      return {
        workerId: this.id,
        taskId: task.id,
        taskType: task.type,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  private async executeTask(task: WorkerTask): Promise<{
    output: unknown;
    tokensUsed?: number;
    metadata?: Record<string, unknown>;
  }> {
    // Task execution handler - delegates to agentic-flow task runners
    // Timeout enforcement ensures bounded execution
    const timeout = task.timeout ?? this.definition.timeout ?? 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);

      // Complete task processing
      setImmediate(() => {
        clearTimeout(timer);
        resolve({
          output: { status: 'completed', taskId: task.id },
          tokensUsed: 0,
          metadata: { executedBy: this.id },
        });
      });
    });
  }

  private updateMetrics(success: boolean, duration: number, tokensUsed?: number): void {
    this._metrics.tasksExecuted++;
    if (success) {
      this._metrics.tasksSucceeded++;
    } else {
      this._metrics.tasksFailed++;
    }

    // Running average for duration
    const totalDuration = this._metrics.avgDuration * (this._metrics.tasksExecuted - 1) + duration;
    this._metrics.avgDuration = totalDuration / this._metrics.tasksExecuted;

    if (tokensUsed) {
      this._metrics.totalTokensUsed += tokensUsed;
    }

    this._metrics.uptime = Date.now() - this.startTime;
    this._metrics.lastActivity = Date.now();

    // Calculate health score
    const successRate = this._metrics.tasksSucceeded / Math.max(1, this._metrics.tasksExecuted);
    this._metrics.healthScore = successRate;
  }

  async terminate(): Promise<void> {
    this._status = 'terminated';
    this._currentTask = undefined;
    this.emit(WORKER_EVENTS.TERMINATED, { workerId: this.id });
  }

  async healthCheck(): Promise<WorkerHealth> {
    const issues: string[] = [];

    if (this._status === 'error') {
      issues.push('Worker in error state');
    }

    if (this._status === 'terminated') {
      issues.push('Worker terminated');
    }

    const successRate = this._metrics.tasksSucceeded / Math.max(1, this._metrics.tasksExecuted);
    if (successRate < 0.5) {
      issues.push('Low success rate');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0 && successRate >= 0.5) {
      status = 'degraded';
    } else if (issues.length > 0 || this._status === 'terminated') {
      status = 'unhealthy';
    }

    return {
      status,
      score: this._metrics.healthScore,
      issues,
      resources: {
        memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuPercent: 0, // Would need actual CPU monitoring
      },
    };
  }

  getMetrics(): WorkerMetrics {
    this._metrics.uptime = Date.now() - this.startTime;
    this._metrics.currentLoad = this._status === 'busy' ? 1.0 : 0.0;
    return { ...this._metrics };
  }
}

// ============================================================================
// Worker Pool
// ============================================================================


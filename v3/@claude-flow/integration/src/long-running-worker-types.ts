/**
 * Long-Running Worker — checkpoint/progress types & in-memory storage
 *
 * Extracted verbatim from long-running-worker.ts (lines 31-211) during
 * campaign-2 wave 36 (W242). The 6 shapes are re-exported by the
 * barrel; InMemoryCheckpointStorage stays unexported from it
 * (module-private pre-split).
 */

import type { WorkerArtifact, WorkerConfig } from './worker-base.js';

export interface Checkpoint {
  /** Unique checkpoint identifier */
  id: string;
  /** Associated task identifier */
  taskId: string;
  /** Worker identifier */
  workerId: string;
  /** Checkpoint sequence number */
  sequence: number;
  /** Checkpoint creation timestamp */
  timestamp: number;
  /** Checkpoint state data */
  state: CheckpointState;
  /** Execution progress (0.0-1.0) */
  progress: number;
  /** Checkpoint metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint state containing all data needed to resume
 */
export interface CheckpointState {
  /** Current execution phase */
  phase: string;
  /** Current step within phase */
  step: number;
  /** Total steps in current phase */
  totalSteps: number;
  /** Partial results accumulated so far */
  partialResults: unknown[];
  /** Context data for resumption */
  context: Record<string, unknown>;
  /** Artifacts generated so far */
  artifacts: WorkerArtifact[];
  /** Custom state data */
  custom?: Record<string, unknown>;
}

/**
 * Long-running worker configuration
 */
export interface LongRunningWorkerConfig extends WorkerConfig {
  /** Checkpoint interval in milliseconds */
  checkpointInterval?: number;
  /** Maximum checkpoints to retain */
  maxCheckpoints?: number;
  /** Enable automatic checkpoint cleanup */
  autoCleanup?: boolean;
  /** Checkpoint storage adapter */
  storage?: CheckpointStorage;
  /** Progress reporting interval in milliseconds */
  progressInterval?: number;
  /** Task timeout in milliseconds (0 = no timeout) */
  taskTimeout?: number;
  /** Enable automatic retry on failure */
  autoRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry backoff multiplier */
  retryBackoff?: number;
}

/**
 * Checkpoint storage interface
 */
export interface CheckpointStorage {
  /** Save a checkpoint */
  save(checkpoint: Checkpoint): Promise<void>;
  /** Load a checkpoint by ID */
  load(checkpointId: string): Promise<Checkpoint | null>;
  /** Load the latest checkpoint for a task */
  loadLatest(taskId: string, workerId: string): Promise<Checkpoint | null>;
  /** List all checkpoints for a task */
  list(taskId: string, workerId: string): Promise<Checkpoint[]>;
  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<void>;
  /** Delete all checkpoints for a task */
  deleteAll(taskId: string, workerId: string): Promise<void>;
}

/**
 * Execution phase for long-running tasks
 */
export interface ExecutionPhase {
  /** Phase name */
  name: string;
  /** Phase description */
  description?: string;
  /** Estimated steps in this phase */
  estimatedSteps: number;
  /** Phase weight for progress calculation */
  weight?: number;
}

/**
 * Progress update event data
 */
export interface ProgressUpdate {
  /** Task identifier */
  taskId: string;
  /** Worker identifier */
  workerId: string;
  /** Current phase */
  phase: string;
  /** Current step */
  step: number;
  /** Total steps in phase */
  totalSteps: number;
  /** Overall progress (0.0-1.0) */
  progress: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Default in-memory checkpoint storage
 */
export class InMemoryCheckpointStorage implements CheckpointStorage {
  private checkpoints: Map<string, Checkpoint> = new Map();

  async save(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  async load(checkpointId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(checkpointId) || null;
  }

  async loadLatest(taskId: string, workerId: string): Promise<Checkpoint | null> {
    const taskCheckpoints = Array.from(this.checkpoints.values())
      .filter((cp) => cp.taskId === taskId && cp.workerId === workerId)
      .sort((a, b) => b.sequence - a.sequence);

    return taskCheckpoints[0] || null;
  }

  async list(taskId: string, workerId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.taskId === taskId && cp.workerId === workerId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async delete(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId);
  }

  async deleteAll(taskId: string, workerId: string): Promise<void> {
    const entries = Array.from(this.checkpoints.entries());
    for (const [id, cp] of entries) {
      if (cp.taskId === taskId && cp.workerId === workerId) {
        this.checkpoints.delete(id);
      }
    }
  }
}

/**
 * LongRunningWorker - Handles extended task execution with checkpoints
 *
 * Usage:
 * ```typescript
 * const worker = new LongRunningWorker({
 *   id: 'long-runner-1',
 *   type: 'long-running',
 *   capabilities: ['data-processing', 'batch-analysis'],
 *   checkpointInterval: 30000, // 30 seconds
 *   maxCheckpoints: 10,
 * });
 *
 * await worker.initialize();
 *
 * // Execute task (checkpoints automatically)
 * const result = await worker.execute(task);
 *
 * // Or resume from checkpoint
 * const result = await worker.resumeFromCheckpoint(checkpointId);
 * ```
 */

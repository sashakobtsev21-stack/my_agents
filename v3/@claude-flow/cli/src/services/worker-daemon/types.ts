/**
 * Type definitions + default worker schedule for the background worker
 * daemon. Pure types + the DEFAULT_WORKERS table and timeout constant.
 *
 * Extracted from worker-daemon.ts (W108, P3.12 cut #1).
 */

export type WorkerType =
  | 'ultralearn'
  | 'optimize'
  | 'consolidate'
  | 'predict'
  | 'audit'
  | 'map'
  | 'preload'
  | 'deepdive'
  | 'document'
  | 'refactor'
  | 'benchmark'
  | 'testgaps';

export interface WorkerConfig {
  type: WorkerType;
  intervalMs: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  description: string;
  enabled: boolean;
}

export interface WorkerState {
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  isRunning: boolean;
  // #1856: track when the worker last *started* in addition to when it
  // last successfully completed (lastRun). On crash recovery we scan for
  // workers where lastStartedAt > lastRun and count them as failed —
  // otherwise their runCount drifts above successCount + failureCount
  // with no diagnostic trail.
  lastStartedAt?: Date;
}

export interface WorkerResult {
  workerId: string;
  type: WorkerType;
  success: boolean;
  durationMs: number;
  output?: unknown;
  error?: string;
  timestamp: Date;
}

export interface DaemonStatus {
  running: boolean;
  pid: number;
  startedAt?: Date;
  workers: Map<WorkerType, WorkerState>;
  config: DaemonConfig;
}

export interface DaemonConfig {
  autoStart: boolean;
  logDir: string;
  stateFile: string;
  maxConcurrent: number;
  workerTimeoutMs: number;
  resourceThresholds: {
    maxCpuLoad: number;
    minFreeMemoryPercent: number;
  };
  workers: WorkerConfig[];
}

// Worker configuration with staggered offsets to prevent overlap
export interface WorkerConfigInternal extends WorkerConfig {
  offsetMs: number; // Stagger start time
}

// Default worker configurations with improved intervals (P0 fix: map 5min -> 15min)
export const DEFAULT_WORKERS: WorkerConfigInternal[] = [
  { type: 'map', intervalMs: 15 * 60 * 1000, offsetMs: 0, priority: 'normal', description: 'Codebase mapping', enabled: true },
  { type: 'audit', intervalMs: 10 * 60 * 1000, offsetMs: 2 * 60 * 1000, priority: 'critical', description: 'Security analysis', enabled: true },
  { type: 'optimize', intervalMs: 15 * 60 * 1000, offsetMs: 4 * 60 * 1000, priority: 'high', description: 'Performance optimization', enabled: true },
  { type: 'consolidate', intervalMs: 30 * 60 * 1000, offsetMs: 6 * 60 * 1000, priority: 'low', description: 'Memory consolidation', enabled: true },
  { type: 'testgaps', intervalMs: 20 * 60 * 1000, offsetMs: 8 * 60 * 1000, priority: 'normal', description: 'Test coverage analysis', enabled: true },
  { type: 'predict', intervalMs: 10 * 60 * 1000, offsetMs: 0, priority: 'low', description: 'Predictive preloading', enabled: false },
  { type: 'document', intervalMs: 60 * 60 * 1000, offsetMs: 0, priority: 'low', description: 'Auto-documentation', enabled: false },
];

// Worker timeout — must exceed the longest per-worker headless timeout (15 min for audit/refactor).
// Previously 5 min, which caused orphan processes when daemon timeout fired before executor timeout (#1117).
export const DEFAULT_WORKER_TIMEOUT_MS = 16 * 60 * 1000;

/**
 * Type definitions + static config for the background-worker subsystem —
 * worker config/result/metrics shapes, alert thresholds, persisted
 * state, statusline data, and the WORKER_CONFIGS catalogue. Pure types
 * and data, no logic.
 *
 * Extracted from workers/index.ts (W84, P3.7 cut #1).
 */

export interface WorkerConfig {
  name: string;
  description: string;
  interval: number;  // milliseconds
  enabled: boolean;
  priority: WorkerPriority;
  timeout: number;
  platforms?: ('linux' | 'darwin' | 'win32')[];
}

export enum WorkerPriority {
  Critical = 0,
  High = 1,
  Normal = 2,
  Low = 3,
  Background = 4,
}

export interface WorkerResult {
  worker: string;
  success: boolean;
  duration: number;
  data?: Record<string, unknown>;
  error?: string;
  alerts?: WorkerAlert[];
  timestamp: Date;
}

export interface WorkerMetrics {
  name: string;
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastRun?: Date;
  lastDuration?: number;
  runCount: number;
  errorCount: number;
  avgDuration: number;
  lastResult?: Record<string, unknown>;
}

export interface WorkerManagerStatus {
  running: boolean;
  platform: string;
  workers: WorkerMetrics[];
  uptime: number;
  totalRuns: number;
  lastUpdate: Date;
}

export type WorkerHandler = () => Promise<WorkerResult>;

// ============================================================================
// Alert System Types
// ============================================================================

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export interface WorkerAlert {
  worker: string;
  severity: AlertSeverity;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
}

export interface AlertThreshold {
  metric: string;
  warning: number;
  critical: number;
  comparison: 'gt' | 'lt' | 'eq';
}

export const DEFAULT_THRESHOLDS: Record<string, AlertThreshold[]> = {
  health: [
    { metric: 'memory.usedPct', warning: 80, critical: 95, comparison: 'gt' },
    { metric: 'disk.usedPct', warning: 85, critical: 95, comparison: 'gt' },
  ],
  security: [
    { metric: 'secrets', warning: 1, critical: 5, comparison: 'gt' },
    { metric: 'vulnerabilities', warning: 10, critical: 50, comparison: 'gt' },
  ],
  adr: [
    { metric: 'compliance', warning: 70, critical: 50, comparison: 'lt' },
  ],
  performance: [
    { metric: 'memory.systemPct', warning: 80, critical: 95, comparison: 'gt' },
  ],
};

// ============================================================================
// Persistence Types
// ============================================================================

export interface PersistedWorkerState {
  version: string;
  lastSaved: string;
  workers: Record<string, {
    lastRun?: string;
    lastResult?: Record<string, unknown>;
    runCount: number;
    errorCount: number;
    avgDuration: number;
  }>;
  history: HistoricalMetric[];
}

export interface HistoricalMetric {
  timestamp: string;
  worker: string;
  metrics: Record<string, number>;
}

// ============================================================================
// Statusline Types
// ============================================================================

export interface StatuslineData {
  workers: {
    active: number;
    total: number;
    errors: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    memory: number;
    disk: number;
  };
  security: {
    status: 'clean' | 'warning' | 'critical';
    issues: number;
  };
  adr: {
    compliance: number;
  };
  ddd: {
    progress: number;
  };
  performance: {
    speedup: string;
  };
  alerts: WorkerAlert[];
  lastUpdate: string;
}

// ============================================================================
// Worker Definitions
// ============================================================================

export const WORKER_CONFIGS: Record<string, WorkerConfig> = {
  'performance': {
    name: 'performance',
    description: 'Benchmark search, memory, startup performance',
    interval: 300_000,  // 5 min
    enabled: true,
    priority: WorkerPriority.Normal,
    timeout: 30_000,
  },
  'health': {
    name: 'health',
    description: 'Monitor disk, memory, CPU, processes',
    interval: 300_000,  // 5 min
    enabled: true,
    priority: WorkerPriority.High,
    timeout: 10_000,
  },
  'patterns': {
    name: 'patterns',
    description: 'Consolidate, dedupe, optimize learned patterns',
    interval: 900_000,  // 15 min
    enabled: true,
    priority: WorkerPriority.Normal,
    timeout: 60_000,
  },
  'ddd': {
    name: 'ddd',
    description: 'Track DDD domain implementation progress',
    interval: 600_000,  // 10 min
    enabled: true,
    priority: WorkerPriority.Low,
    timeout: 30_000,
  },
  'adr': {
    name: 'adr',
    description: 'Check ADR compliance across codebase',
    interval: 900_000,  // 15 min
    enabled: true,
    priority: WorkerPriority.Low,
    timeout: 60_000,
  },
  'security': {
    name: 'security',
    description: 'Scan for secrets, vulnerabilities, CVEs',
    interval: 1_800_000,  // 30 min
    enabled: true,
    priority: WorkerPriority.High,
    timeout: 120_000,
  },
  'learning': {
    name: 'learning',
    description: 'Optimize learning, SONA adaptation',
    interval: 1_800_000,  // 30 min
    enabled: true,
    priority: WorkerPriority.Normal,
    timeout: 60_000,
  },
  'cache': {
    name: 'cache',
    description: 'Clean temp files, old logs, stale cache',
    interval: 3_600_000,  // 1 hour
    enabled: true,
    priority: WorkerPriority.Background,
    timeout: 30_000,
  },
  'git': {
    name: 'git',
    description: 'Track uncommitted changes, branch status',
    interval: 300_000,  // 5 min
    enabled: true,
    priority: WorkerPriority.Normal,
    timeout: 10_000,
  },
  'swarm': {
    name: 'swarm',
    description: 'Monitor swarm activity, agent coordination',
    interval: 60_000,  // 1 min
    enabled: true,
    priority: WorkerPriority.High,
    timeout: 10_000,
  },
};

// ============================================================================
// Worker Manager with Full Features
// ============================================================================


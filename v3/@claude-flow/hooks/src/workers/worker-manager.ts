/**
 * WorkerManager — the EventEmitter-based background-worker scheduler.
 * Owns worker registration, the run loop with staggered/priority
 * scheduling + concurrency cap, per-worker metrics, JSON state
 * persistence, the threshold alert system, and the statusline snapshot.
 *
 * Extracted from workers/index.ts (W87, P3.7 cut #4 — final). The
 * PERSISTENCE_VERSION / MAX_HISTORY_ENTRIES / STATUSLINE_UPDATE_INTERVAL
 * constants are class-local and move with it.
 */
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  WorkerConfig,
  WorkerResult,
  WorkerMetrics,
  WorkerManagerStatus,
  WorkerHandler,
  WorkerAlert,
  AlertThreshold,
  PersistedWorkerState,
  HistoricalMetric,
  StatuslineData,
} from './types.js';
import {
  DEFAULT_THRESHOLDS,
  WORKER_CONFIGS,
  WorkerPriority,
  AlertSeverity,
} from './types.js';
import {
  MAX_CONCURRENCY,
  MAX_ALERTS,
  MAX_HISTORY,
  safeJsonParse,
  safeReadFile,
} from './fs-helpers.js';

const PERSISTENCE_VERSION = '1.0.0';
const MAX_HISTORY_ENTRIES = 1000;
const STATUSLINE_UPDATE_INTERVAL = 10_000; // 10 seconds

export class WorkerManager extends EventEmitter {
  private workers: Map<string, WorkerHandler> = new Map();
  private metrics: Map<string, WorkerMetrics> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;
  private startTime?: Date;
  private projectRoot: string;
  private metricsDir: string;
  private persistPath: string;
  private statuslinePath: string;

  // New features
  private alerts: WorkerAlert[] = [];
  private history: HistoricalMetric[] = [];
  private thresholds: Record<string, AlertThreshold[]> = { ...DEFAULT_THRESHOLDS };
  private statuslineTimer?: NodeJS.Timeout;
  private autoSaveTimer?: NodeJS.Timeout;
  private initialized = false;

  constructor(projectRoot?: string) {
    super();
    this.projectRoot = projectRoot || process.cwd();
    this.metricsDir = path.join(this.projectRoot, '.claude-flow', 'metrics');
    this.persistPath = path.join(this.metricsDir, 'workers-state.json');
    this.statuslinePath = path.join(this.metricsDir, 'statusline.json');
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    for (const [name, config] of Object.entries(WORKER_CONFIGS)) {
      this.metrics.set(name, {
        name,
        status: config.enabled ? 'idle' : 'disabled',
        runCount: 0,
        errorCount: 0,
        avgDuration: 0,
      });
    }
  }

  // =========================================================================
  // Persistence Methods (using AgentDB-compatible JSON storage)
  // =========================================================================

  /**
   * Load persisted state from disk
   */
  async loadState(): Promise<boolean> {
    try {
      const content = await safeReadFile(this.persistPath, 1024 * 1024); // 1MB limit
      const state: PersistedWorkerState = safeJsonParse(content);

      if (state.version !== PERSISTENCE_VERSION) {
        this.emit('persistence:version-mismatch', { expected: PERSISTENCE_VERSION, got: state.version });
        return false;
      }

      // Restore metrics
      for (const [name, data] of Object.entries(state.workers)) {
        const metrics = this.metrics.get(name);
        if (metrics) {
          metrics.runCount = data.runCount;
          metrics.errorCount = data.errorCount;
          metrics.avgDuration = data.avgDuration;
          metrics.lastResult = data.lastResult;
          if (data.lastRun) {
            metrics.lastRun = new Date(data.lastRun);
          }
        }
      }

      // Restore history (limit to max entries)
      this.history = state.history.slice(-MAX_HISTORY_ENTRIES);

      this.emit('persistence:loaded', { workers: Object.keys(state.workers).length });
      return true;
    } catch {
      // No persisted state or invalid - start fresh
      return false;
    }
  }

  /**
   * Save current state to disk
   */
  async saveState(): Promise<void> {
    try {
      await this.ensureMetricsDir();

      const state: PersistedWorkerState = {
        version: PERSISTENCE_VERSION,
        lastSaved: new Date().toISOString(),
        workers: {},
        history: this.history.slice(-MAX_HISTORY_ENTRIES),
      };

      for (const [name, metrics] of this.metrics.entries()) {
        state.workers[name] = {
          lastRun: metrics.lastRun?.toISOString(),
          lastResult: metrics.lastResult,
          runCount: metrics.runCount,
          errorCount: metrics.errorCount,
          avgDuration: metrics.avgDuration,
        };
      }

      await fs.writeFile(this.persistPath, JSON.stringify(state, null, 2));
      this.emit('persistence:saved');
    } catch (error) {
      this.emit('persistence:error', { error });
    }
  }

  // =========================================================================
  // Alert System
  // =========================================================================

  /**
   * Check result against thresholds and generate alerts
   */
  private checkAlerts(workerName: string, result: WorkerResult): WorkerAlert[] {
    const alerts: WorkerAlert[] = [];
    const thresholds = this.thresholds[workerName];

    if (!thresholds || !result.data) return alerts;

    for (const threshold of thresholds) {
      const rawValue = this.getNestedValue(result.data, threshold.metric);
      if (rawValue === undefined || rawValue === null) continue;
      if (typeof rawValue !== 'number') continue;

      const value: number = rawValue;
      let severity: AlertSeverity | null = null;

      if (threshold.comparison === 'gt') {
        if (value >= threshold.critical) severity = AlertSeverity.Critical;
        else if (value >= threshold.warning) severity = AlertSeverity.Warning;
      } else if (threshold.comparison === 'lt') {
        if (value <= threshold.critical) severity = AlertSeverity.Critical;
        else if (value <= threshold.warning) severity = AlertSeverity.Warning;
      }

      if (severity) {
        const alert: WorkerAlert = {
          worker: workerName,
          severity,
          message: `${threshold.metric} is ${value} (threshold: ${severity === AlertSeverity.Critical ? threshold.critical : threshold.warning})`,
          metric: threshold.metric,
          value: value as number,
          threshold: severity === AlertSeverity.Critical ? threshold.critical : threshold.warning,
          timestamp: new Date(),
        };
        alerts.push(alert);

        // Ring buffer: remove oldest first to avoid memory spikes
        if (this.alerts.length >= MAX_ALERTS) {
          this.alerts.shift();
        }
        this.alerts.push(alert);

        this.emit('alert', alert);
      }
    }

    return alerts;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  /**
   * Set custom alert thresholds
   */
  setThresholds(worker: string, thresholds: AlertThreshold[]): void {
    this.thresholds[worker] = thresholds;
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit = 20): WorkerAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.emit('alerts:cleared');
  }

  // =========================================================================
  // Historical Metrics
  // =========================================================================

  /**
   * Record metrics to history
   */
  private recordHistory(workerName: string, result: WorkerResult): void {
    if (!result.data) return;

    const metrics: Record<string, number> = {};

    // Extract numeric values from result
    const extractNumbers = (obj: Record<string, unknown>, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'number') {
          metrics[fullKey] = value;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          extractNumbers(value as Record<string, unknown>, fullKey);
        }
      }
    };

    extractNumbers(result.data);

    if (Object.keys(metrics).length > 0) {
      // Ring buffer: remove oldest first to avoid memory spikes
      if (this.history.length >= MAX_HISTORY) {
        this.history.shift();
      }
      this.history.push({
        timestamp: new Date().toISOString(),
        worker: workerName,
        metrics,
      });
    }
  }

  /**
   * Get historical metrics for a worker
   */
  getHistory(worker?: string, limit = 100): HistoricalMetric[] {
    let filtered = this.history;
    if (worker) {
      filtered = this.history.filter(h => h.worker === worker);
    }
    return filtered.slice(-limit);
  }

  // =========================================================================
  // Statusline Integration
  // =========================================================================

  /**
   * Generate statusline data
   */
  getStatuslineData(): StatuslineData {
    const workers = Array.from(this.metrics.values());
    const activeWorkers = workers.filter(w => w.status === 'running').length;
    const errorWorkers = workers.filter(w => w.status === 'error').length;
    const totalWorkers = workers.filter(w => w.status !== 'disabled').length;

    // Get latest results
    const healthResult = this.metrics.get('health')?.lastResult as Record<string, unknown> | undefined;
    const securityResult = this.metrics.get('security')?.lastResult as Record<string, unknown> | undefined;
    const adrResult = this.metrics.get('adr')?.lastResult as Record<string, unknown> | undefined;
    const dddResult = this.metrics.get('ddd')?.lastResult as Record<string, unknown> | undefined;
    const perfResult = this.metrics.get('performance')?.lastResult as Record<string, unknown> | undefined;

    return {
      workers: {
        active: activeWorkers,
        total: totalWorkers,
        errors: errorWorkers,
      },
      health: {
        status: healthResult?.status as 'healthy' | 'warning' | 'critical' ?? 'healthy',
        memory: (healthResult?.memory as Record<string, unknown>)?.usedPct as number ?? 0,
        disk: (healthResult?.disk as Record<string, unknown>)?.usedPct as number ?? 0,
      },
      security: {
        status: securityResult?.status as 'clean' | 'warning' | 'critical' ?? 'clean',
        issues: securityResult?.totalIssues as number ?? 0,
      },
      adr: {
        compliance: adrResult?.compliance as number ?? 0,
      },
      ddd: {
        progress: dddResult?.progress as number ?? 0,
      },
      performance: {
        speedup: perfResult?.speedup as string ?? '1.0x',
      },
      alerts: this.alerts.filter(a => a.severity === AlertSeverity.Critical).slice(-5),
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Export statusline data to file (for shell consumption)
   */
  async exportStatusline(): Promise<void> {
    try {
      const data = this.getStatuslineData();
      await fs.writeFile(this.statuslinePath, JSON.stringify(data, null, 2));
      this.emit('statusline:exported');
    } catch {
      // Ignore export errors
    }
  }

  /**
   * Generate shell-compatible statusline string
   */
  getStatuslineString(): string {
    const data = this.getStatuslineData();
    const parts: string[] = [];

    // Workers status
    parts.push(`👷${data.workers.active}/${data.workers.total}`);

    // Health
    const healthIcon = data.health.status === 'critical' ? '🔴' :
                       data.health.status === 'warning' ? '🟡' : '🟢';
    parts.push(`${healthIcon}${data.health.memory}%`);

    // Security
    const secIcon = data.security.status === 'critical' ? '🚨' :
                    data.security.status === 'warning' ? '⚠️' : '🛡️';
    parts.push(`${secIcon}${data.security.issues}`);

    // ADR Compliance
    parts.push(`📋${data.adr.compliance}%`);

    // DDD Progress
    parts.push(`🏗️${data.ddd.progress}%`);

    // Performance
    parts.push(`⚡${data.performance.speedup}`);

    return parts.join(' │ ');
  }

  // =========================================================================
  // Core Worker Methods
  // =========================================================================

  /**
   * Register a worker handler
   * Optionally pass config; if not provided, a default config is used for dynamically registered workers
   */
  register(name: string, handler: WorkerHandler, config?: Partial<WorkerConfig>): void {
    this.workers.set(name, handler);

    // Create config if not in WORKER_CONFIGS (for dynamic/test workers)
    if (!WORKER_CONFIGS[name]) {
      (WORKER_CONFIGS as Record<string, WorkerConfig>)[name] = {
        name,
        description: config?.description ?? `Dynamic worker: ${name}`,
        interval: config?.interval ?? 60_000,
        enabled: config?.enabled ?? true,
        priority: config?.priority ?? WorkerPriority.Normal,
        timeout: config?.timeout ?? 30_000,
      };
    }

    // Initialize metrics if not already present
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        status: 'idle',
        runCount: 0,
        errorCount: 0,
        avgDuration: 0,
      });
    }

    this.emit('worker:registered', { name });
  }

  /**
   * Initialize and start workers (loads persisted state)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureMetricsDir();
    await this.loadState();

    this.initialized = true;
    this.emit('manager:initialized');
  }

  /**
   * Start all workers with scheduling
   */
  async start(options?: { autoSave?: boolean; statuslineUpdate?: boolean }): Promise<void> {
    if (this.running) return;

    if (!this.initialized) {
      await this.initialize();
    }

    this.running = true;
    this.startTime = new Date();

    // Schedule all workers
    for (const [name, config] of Object.entries(WORKER_CONFIGS)) {
      if (!config.enabled) continue;
      if (config.platforms && !config.platforms.includes(os.platform() as any)) continue;

      this.scheduleWorker(name, config);
    }

    // Auto-save every 5 minutes
    if (options?.autoSave !== false) {
      this.autoSaveTimer = setInterval(() => {
        this.saveState().catch(() => {});
      }, 300_000);
    }

    // Update statusline file periodically
    if (options?.statuslineUpdate !== false) {
      this.statuslineTimer = setInterval(() => {
        this.exportStatusline().catch(() => {});
      }, STATUSLINE_UPDATE_INTERVAL);
    }

    this.emit('manager:started');
  }

  /**
   * Stop all workers and save state
   */
  async stop(): Promise<void> {
    this.running = false;

    // Clear all timers
    Array.from(this.timers.values()).forEach(timer => {
      clearTimeout(timer);
    });
    this.timers.clear();

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    if (this.statuslineTimer) {
      clearInterval(this.statuslineTimer);
      this.statuslineTimer = undefined;
    }

    // Save final state
    await this.saveState();
    await this.exportStatusline();

    this.emit('manager:stopped');
  }

  /**
   * Run a specific worker immediately
   */
  async runWorker(name: string): Promise<WorkerResult> {
    const handler = this.workers.get(name);
    const config = WORKER_CONFIGS[name];
    const metrics = this.metrics.get(name);

    if (!handler || !config || !metrics) {
      return {
        worker: name,
        success: false,
        duration: 0,
        error: `Worker '${name}' not found`,
        timestamp: new Date(),
      };
    }

    metrics.status = 'running';
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        handler(),
        new Promise<WorkerResult>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), config.timeout)
        ),
      ]);

      const duration = Date.now() - startTime;

      metrics.status = 'idle';
      metrics.lastRun = new Date();
      metrics.lastDuration = duration;
      metrics.runCount++;
      metrics.avgDuration = (metrics.avgDuration * (metrics.runCount - 1) + duration) / metrics.runCount;
      metrics.lastResult = result.data;

      // Check alerts and record history
      const alerts = this.checkAlerts(name, result);
      result.alerts = alerts;
      this.recordHistory(name, result);

      this.emit('worker:completed', { name, result, duration, alerts });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      metrics.status = 'error';
      metrics.errorCount++;
      metrics.lastRun = new Date();

      const result: WorkerResult = {
        worker: name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };

      this.emit('worker:error', { name, error, duration });

      return result;
    }
  }

  /**
   * Run all workers (non-blocking with concurrency limit)
   */
  async runAll(concurrency = MAX_CONCURRENCY): Promise<WorkerResult[]> {
    const workers = Array.from(this.workers.keys());
    const results: WorkerResult[] = [];

    // Process in batches to limit concurrency
    for (let i = 0; i < workers.length; i += concurrency) {
      const batch = workers.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(name => this.runWorker(name))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get worker status
   */
  getStatus(): WorkerManagerStatus {
    return {
      running: this.running,
      platform: os.platform(),
      workers: Array.from(this.metrics.values()),
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      totalRuns: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.runCount, 0),
      lastUpdate: new Date(),
    };
  }

  /**
   * Get statusline-friendly metrics
   */
  getStatuslineMetrics(): Record<string, unknown> {
    const workers = Array.from(this.metrics.values());
    const running = workers.filter(w => w.status === 'running').length;
    const errors = workers.filter(w => w.status === 'error').length;
    const total = workers.filter(w => w.status !== 'disabled').length;

    return {
      workersActive: running,
      workersTotal: total,
      workersError: errors,
      lastResults: Object.fromEntries(
        workers
          .filter(w => w.lastResult)
          .map(w => [w.name, w.lastResult])
      ),
    };
  }

  private scheduleWorker(name: string, config: WorkerConfig): void {
    const run = async () => {
      if (!this.running) return;

      await this.runWorker(name);

      if (this.running) {
        this.timers.set(name, setTimeout(run, config.interval));
      }
    };

    // Initial run with staggered start
    const stagger = config.priority * 1000;
    this.timers.set(name, setTimeout(run, stagger));
  }

  private async ensureMetricsDir(): Promise<void> {
    try {
      await fs.mkdir(this.metricsDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }
}

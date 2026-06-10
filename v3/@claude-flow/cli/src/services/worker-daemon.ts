/**
 * Worker Daemon Service
 * Node.js-based background worker system that auto-runs like shell daemons
 *
 * Workers:
 * - map: Codebase mapping (5 min interval)
 * - audit: Security analysis (10 min interval)
 * - optimize: Performance optimization (15 min interval)
 * - consolidate: Memory consolidation (30 min interval)
 * - testgaps: Test coverage analysis (20 min interval)
 */

import { EventEmitter } from 'events';
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync, renameSync } from 'fs';
import { cpus } from 'os';
import { join } from 'path';
import {
  HeadlessWorkerExecutor,
  isHeadlessWorker,
  type HeadlessWorkerType,
} from './headless-worker-executor.js';
// Type definitions + DEFAULT_WORKERS schedule + timeout moved to
// ./worker-daemon/types.ts (W108, P3.12 cut #1). Imported for internal
// use; WorkerType + DaemonConfig re-exported so external `import { … }
// from './worker-daemon.js'` callers keep resolving byte-identically.
import type {
  WorkerType,
  WorkerConfig,
  WorkerState,
  WorkerResult,
  DaemonStatus,
  WorkerConfigInternal,
} from './worker-daemon/types.js';
import type { DaemonConfig } from './worker-daemon/types.js';
import { DEFAULT_WORKERS, DEFAULT_WORKER_TIMEOUT_MS } from './worker-daemon/types.js';
export type { WorkerType, DaemonConfig } from './worker-daemon/types.js';
// Environment probes + file-config loader moved to ./worker-daemon/
// env-config.ts (W109, P3.12 cut #2); the class wraps these in thin
// static/private delegators that preserve the public API.
import {
  isWslEnvironment,
  getEffectiveCpuCount,
  readDaemonConfigFromFile,
  type DaemonFileConfig,
} from './worker-daemon/env-config.js';
// Metrics persistence + local-mode worker fallbacks moved to
// ./worker-daemon/local-workers.ts (W110, P3.12 cut #3) — pure functions
// of projectRoot, called from executeWorker's local-dispatch switch.
import {
  persistHeadlessResult,
  runMapWorker,
  runAuditWorkerLocal,
  runOptimizeWorkerLocal,
  runConsolidateWorker,
  runTestGapsWorkerLocal,
  runPredictWorkerLocal,
  runDocumentWorkerLocal,
  runUltralearnWorkerLocal,
  runRefactorWorkerLocal,
  runDeepdiveWorkerLocal,
  runBenchmarkWorkerLocal,
  runPreloadWorkerLocal,
} from './worker-daemon/local-workers.js';

/**
 * Worker Daemon - Manages background workers with Node.js
 */
export class WorkerDaemon extends EventEmitter {
  private config: DaemonConfig;
  private workers: Map<WorkerType, WorkerState> = new Map();
  private timers: Map<WorkerType, NodeJS.Timeout> = new Map();
  // #1845: separate timer for the MCP-dispatch queue poller. Kept off
  // the per-worker map so stop() clears both kinds without confusion.
  private queuePollTimer?: NodeJS.Timeout;
  private running = false;
  private startedAt?: Date;
  private projectRoot: string;
  private runningWorkers: Set<WorkerType> = new Set(); // Track concurrent workers
  private pendingWorkers: WorkerType[] = []; // Queue for deferred workers

  // Headless execution support
  private headlessExecutor: HeadlessWorkerExecutor | null = null;
  private headlessAvailable: boolean = false;
  // #2251 — Promise that resolves once initHeadlessExecutor() has finished
  // probing `claude --version` and constructed the executor. The constructor
  // kicks off init fire-and-forget; without awaiting this on the trigger
  // path, `ruflo daemon trigger -w <worker>` runs before headlessAvailable
  // is set and falls through to the local stub in ~2ms.
  private headlessInitPromise: Promise<void> = Promise.resolve();

  // Preserve the original constructor config so we can detect explicit overrides
  // during state restoration (R1: constructor config takes priority over stale state)
  private originalConfig?: Partial<DaemonConfig>;

  constructor(projectRoot: string, config?: Partial<DaemonConfig>) {
    super();
    this.projectRoot = projectRoot;
    this.originalConfig = config;

    const claudeFlowDir = join(projectRoot, '.claude-flow');

    // Read daemon config from .claude-flow/config.json (Layer B)
    const fileConfig = this.readDaemonConfigFromFile(claudeFlowDir);

    // CPU-proportional smart default instead of hardcoded 2.0
    const cpuCount = WorkerDaemon.getEffectiveCpuCount();
    let smartMaxCpuLoad = Math.max(cpuCount * 0.8, 2.0); // Floor of 2.0 for single-CPU machines

    // #2110 — WSL2 reports `/proc/loadavg` values that include Windows-side
    // process counts mapped into the Linux kernel. Real load on a 4-CPU
    // WSL2 host can be 200-400 even when the Linux side is idle. The
    // default gate of `cpuCount * 0.8` always trips, deferring every
    // worker as "CPU load too high" while the daemon reports healthy.
    // Bump the floor to 1000 when WSL is detected so the gate is
    // effectively disabled (real load on Linux side rarely exceeds 100
    // even under heavy contention).
    if (WorkerDaemon.isWslEnvironment()) {
      smartMaxCpuLoad = Math.max(smartMaxCpuLoad, 1000);
    }

    // Platform-aware default: macOS os.freemem() excludes reclaimable file cache,
    // so reported "free" is much lower than actually available memory.
    // Linux reports available memory (including reclaimable cache) more accurately.
    const defaultMinFreeMemory = process.platform === 'darwin' ? 5 : 10;

    // Priority: constructor arg > config.json > smart default
    // For resourceThresholds, merge field-by-field so partial overrides
    // (e.g. only --max-cpu-load) still pick up defaults for other fields.
    this.config = {
      autoStart: config?.autoStart ?? fileConfig.autoStart ?? false,
      logDir: config?.logDir ?? join(claudeFlowDir, 'logs'),
      stateFile: config?.stateFile ?? join(claudeFlowDir, 'daemon-state.json'),
      maxConcurrent: config?.maxConcurrent ?? fileConfig.maxConcurrent ?? 2,
      workerTimeoutMs: config?.workerTimeoutMs ?? fileConfig.workerTimeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS,
      resourceThresholds: {
        maxCpuLoad: config?.resourceThresholds?.maxCpuLoad ?? fileConfig.maxCpuLoad ?? smartMaxCpuLoad,
        minFreeMemoryPercent: config?.resourceThresholds?.minFreeMemoryPercent ?? fileConfig.minFreeMemoryPercent ?? defaultMinFreeMemory,
      },
      workers: config?.workers ?? DEFAULT_WORKERS,
    };

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();

    // #1855: install crash handlers so uncaught exceptions and unhandled
    // rejections don't leak the PID file or orphan child processes.
    this.installCrashHandlers();

    // Ensure directories exist
    if (!existsSync(claudeFlowDir)) {
      mkdirSync(claudeFlowDir, { recursive: true });
    }
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }

    // Initialize worker states
    this.initializeWorkerStates();

    // Initialize headless executor (async, non-blocking) — capture the
    // promise so the trigger path (#2251) can await it before checking
    // `headlessAvailable`. Scheduled fires hit a long-running daemon and
    // are unaffected; the on-demand `trigger` path was racing this init.
    this.headlessInitPromise = this.initHeadlessExecutor().catch((err) => {
      this.log('warn', `Headless executor init failed: ${err}`);
    });
  }

  /**
   * Initialize headless executor if Claude Code is available
   */
  private async initHeadlessExecutor(): Promise<void> {
    try {
      this.headlessExecutor = new HeadlessWorkerExecutor(this.projectRoot, {
        maxConcurrent: this.config.maxConcurrent,
      });

      this.headlessAvailable = await this.headlessExecutor.isAvailable();

      if (this.headlessAvailable) {
        this.log('info', 'Claude Code headless mode available - AI workers enabled');

        // Forward headless executor events. #1855: also snapshot the
        // active child PIDs to disk on every transition so the next
        // lifetime can reap orphans after a hard crash.
        this.headlessExecutor.on('execution:start', (data) => {
          this.writeChildrenSnapshot();
          this.emit('headless:start', data);
        });

        this.headlessExecutor.on('execution:complete', (data) => {
          this.writeChildrenSnapshot();
          this.emit('headless:complete', data);
        });

        this.headlessExecutor.on('execution:error', (data) => {
          this.writeChildrenSnapshot();
          this.emit('headless:error', data);
        });

        this.headlessExecutor.on('output', (data) => {
          this.emit('headless:output', data);
        });
      } else {
        this.log('info', 'Claude Code not found - AI workers will run in local fallback mode');
      }
    } catch (error) {
      this.log('warn', `Failed to initialize headless executor: ${error}`);
      this.headlessAvailable = false;
    }
  }

  /**
   * Check if headless execution is available
   */
  isHeadlessAvailable(): boolean {
    return this.headlessAvailable;
  }

  /**
   * Get headless executor instance
   */
  getHeadlessExecutor(): HeadlessWorkerExecutor | null {
    return this.headlessExecutor;
  }

  /**
   * Detect effective CPU count for the current environment.
   *
   * Inside Docker / K8s containers, os.cpus().length reports the HOST cpu
   * count, not the container limit (Node.js #28762 — wontfix).  We read
   * cgroup v2 / v1 quota files first so the maxCpuLoad threshold stays
   * meaningful under resource-limited containers.
   */
  /**
   * #2110 — detect WSL2 / WSL1 so the CPU-load gate can use a sane
   * default. `/proc/loadavg` on WSL maps in Windows-side process counts
   * and routinely reports values 100-1000x larger than real Linux load.
   *
   * Detection order:
   *   1. `WSL_DISTRO_NAME` env var (set by Microsoft's WSL launcher)
   *   2. `WSL_INTEROP` env var (set by recent WSL2)
   *   3. `/proc/sys/kernel/osrelease` contains "microsoft" or "WSL"
   *      (kernel build marker; survives env stripping)
   */
  // Thin static delegators — logic lives in ./worker-daemon/env-config.ts
  // (W109). Kept static so `WorkerDaemon.isWslEnvironment()` /
  // `WorkerDaemon.getEffectiveCpuCount()` stay part of the public API.
  static isWslEnvironment(): boolean {
    return isWslEnvironment();
  }

  static getEffectiveCpuCount(): number {
    return getEffectiveCpuCount();
  }

  /**
   * Read daemon-specific config from .claude-flow/config.{json,yaml,yml}.
   * Supports dot-notation keys like 'daemon.resourceThresholds.maxCpuLoad'.
   * #1844: prefer JSON when both exist (existing behavior) but fall back
   * to YAML so operators using the v3 canonical YAML format aren't silently
   * ignored. The chosen path is logged at info level.
   */
  // Delegates to ./worker-daemon/env-config.ts (W109), passing this.log
  // so the file-choice + parse-failure messages stay on the daemon log.
  private readDaemonConfigFromFile(claudeFlowDir: string): DaemonFileConfig {
    return readDaemonConfigFromFile(claudeFlowDir, (level, message) => this.log(level, message));
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      this.log('info', 'Received shutdown signal, stopping daemon...');
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', shutdown);
  }

  /**
   * #1855: install crash handlers for uncaught exceptions and unhandled
   * rejections. Without these, a thrown error from any timer callback,
   * worker logic path, or transitive import crashes the daemon process
   * silently — the PID file leaks and any in-flight child processes
   * orphan. With these, we log a structured crash record, run stop()
   * to clean up, then exit 1 so the process actually dies (otherwise
   * Node would crash anyway after the handler returns).
   */
  private installCrashHandlers(): void {
    const onCrash = (kind: 'uncaughtException' | 'unhandledRejection', err: unknown) => {
      // Best-effort logging; never throw from inside the crash handler.
      try {
        this.writeCrashRecord(kind, err);
      } catch { /* nothing more we can do */ }
      try {
        // Synchronous stop — don't await; the process is dying. Just
        // remove the PID file and snapshot state so the next start
        // sees a clean slate.
        this.removePidFile();
        this.saveState();
        // Snapshot any in-flight child PIDs one last time so the next
        // lifetime can reap them.
        this.writeChildrenSnapshot();
      } catch { /* ignore */ }
      // Exit non-zero so supervisors / shells see the failure.
      process.exit(1);
    };
    process.on('uncaughtException', (err) => onCrash('uncaughtException', err));
    process.on('unhandledRejection', (err) => onCrash('unhandledRejection', err));
  }

  /**
   * Append a structured crash record to .claude-flow/logs/crash.log.
   * Inspectable by hand or via `ruflo daemon status` follow-ups.
   */
  private writeCrashRecord(kind: string, err: unknown): void {
    const logDir = this.config.logDir;
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const crashLog = join(logDir, 'crash.log');
    const ts = new Date().toISOString();
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : '<no stack>';
    const record = `[${ts}] [${kind}] pid=${process.pid} ${message}\n${stack}\n---\n`;
    appendFileSync(crashLog, record, 'utf-8');
    this.log('warn', `Daemon crashed (${kind}): ${message} — see ${crashLog}`);
  }

  /**
   * Path to the on-disk children registry — list of headless worker
   * child PIDs the daemon currently owns. #1855: written on every
   * execution:start / :complete / :error transition; read by the next
   * lifetime to reap orphans after a hard crash.
   */
  private get childrenFile(): string {
    return join(this.projectRoot, '.claude-flow', 'daemon-children.json');
  }

  /**
   * #1856: detect workers that were mid-flight when the previous daemon
   * lifetime ended. A mid-flight worker has `lastStartedAt > lastRun`
   * (started after the last successful completion). On crash recovery
   * we count these as failures so the run-counter math stays consistent
   * (`runCount === successCount + failureCount`). Workers naturally
   * retry at their next scheduled interval; we deliberately don't
   * immediately re-run because the failure may have been deterministic.
   */
  private detectMidFlightFailures(): void {
    let detected = 0;
    for (const [type, state] of this.workers.entries()) {
      const startedAt = state.lastStartedAt?.getTime() ?? 0;
      const lastRunAt = state.lastRun?.getTime() ?? 0;
      // started after the last successful completion → was mid-flight
      if (startedAt > 0 && startedAt > lastRunAt) {
        state.failureCount++;
        state.isRunning = false;
        // Don't bump runCount — it was already incremented at start
        this.log(
          'info',
          `Worker ${type} was mid-flight at last crash (started ${state.lastStartedAt?.toISOString()}); counted as failure, will retry at next scheduled interval`,
        );
        detected++;
      }
    }
    if (detected > 0) {
      this.saveState();
    }
  }

  /**
   * Snapshot the currently-active headless worker child PIDs to disk.
   * Best-effort; failures don't propagate.
   */
  private writeChildrenSnapshot(): void {
    if (!this.headlessExecutor) return;
    try {
      const pids = this.headlessExecutor.getActiveChildPids();
      const dir = join(this.projectRoot, '.claude-flow');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(
        this.childrenFile,
        JSON.stringify({ pids, daemonPid: process.pid, timestamp: new Date().toISOString() }, null, 2),
        'utf-8',
      );
    } catch { /* best-effort */ }
  }

  /**
   * #1855: reap orphan headless worker children left behind by a
   * previous crashed lifetime. Reads `.claude-flow/daemon-children.json`,
   * SIGTERMs any PID still alive that doesn't belong to the current
   * daemon, then truncates the file. Called at the top of `start()`
   * so the next lifetime starts with a clean process tree.
   */
  private reapOrphanedChildren(): void {
    const file = this.childrenFile;
    if (!existsSync(file)) return;
    let snapshot: { pids?: number[]; daemonPid?: number };
    try {
      snapshot = JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      try { unlinkSync(file); } catch { /* ignore */ }
      return;
    }
    const pids = Array.isArray(snapshot.pids) ? snapshot.pids : [];
    let reaped = 0;
    for (const pid of pids) {
      if (typeof pid !== 'number' || pid <= 0) continue;
      if (pid === process.pid) continue; // never our own PID
      try {
        process.kill(pid, 0); // is alive?
        process.kill(pid, 'SIGTERM');
        reaped++;
      } catch {
        // already dead — fine
      }
    }
    if (reaped > 0) {
      this.log('info', `Reaped ${reaped} orphan headless worker child(ren) from previous lifetime`);
    }
    try { unlinkSync(file); } catch { /* ignore */ }
  }

  /**
   * Check if system resources allow worker execution
   */
  private async canRunWorker(): Promise<{ allowed: boolean; reason?: string }> {
    const os = await import('os');
    const cpuLoad = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const freePercent = (freeMem / totalMem) * 100;

    if (cpuLoad > this.config.resourceThresholds.maxCpuLoad) {
      return { allowed: false, reason: `CPU load too high: ${cpuLoad.toFixed(2)}` };
    }
    if (freePercent < this.config.resourceThresholds.minFreeMemoryPercent) {
      return { allowed: false, reason: `Memory too low: ${freePercent.toFixed(1)}% free` };
    }
    return { allowed: true };
  }

  /**
   * Process pending workers queue
   *
   * When executeWorkerWithConcurrencyControl defers a worker (returns null),
   * we break immediately to avoid a busy-wait loop — the deferred worker is
   * already back on the pendingWorkers queue by that point. If no workers are
   * currently running when we break, we schedule a backoff retry so the queue
   * does not get permanently stuck.
   */
  private async processPendingWorkers(): Promise<void> {
    while (this.pendingWorkers.length > 0 && this.runningWorkers.size < this.config.maxConcurrent) {
      const workerType = this.pendingWorkers.shift()!;
      const workerConfig = this.config.workers.find(w => w.type === workerType);
      if (workerConfig) {
        const result = await this.executeWorkerWithConcurrencyControl(workerConfig);
        if (result === null) {
          // Worker was deferred (resource pressure or concurrency limit).
          // Break to avoid tight-looping — the next executeWorker() completion
          // will call processPendingWorkers() again via the finally block.
          if (this.runningWorkers.size === 0) {
            // No workers running means nobody will trigger the finally-block
            // callback, so schedule a backoff retry to avoid a stuck queue.
            setTimeout(() => this.processPendingWorkers(), 30_000).unref();
          }
          break;
        }
      }
    }
  }

  private initializeWorkerStates(): void {
    // Try to restore state from file
    if (existsSync(this.config.stateFile)) {
      try {
        const saved = JSON.parse(readFileSync(this.config.stateFile, 'utf-8'));

        // CRITICAL: Restore worker config (including enabled flag) from saved state
        // This fixes #950: daemon enable command not persisting worker state
        if (saved.config?.workers && Array.isArray(saved.config.workers)) {
          for (const savedWorker of saved.config.workers) {
            const workerConfig = this.config.workers.find(w => w.type === savedWorker.type);
            if (workerConfig && typeof savedWorker.enabled === 'boolean') {
              workerConfig.enabled = savedWorker.enabled;
            }
          }
        }

        // Restore resourceThresholds, maxConcurrent, workerTimeoutMs from saved state
        // Only restore if valid numeric values within sane ranges
        if (saved.config?.resourceThresholds && !this.originalConfig?.resourceThresholds) {
          const rt = saved.config.resourceThresholds;
          if (typeof rt.maxCpuLoad === 'number' && rt.maxCpuLoad > 0 && rt.maxCpuLoad < 1000) {
            this.config.resourceThresholds.maxCpuLoad = rt.maxCpuLoad;
          }
          if (typeof rt.minFreeMemoryPercent === 'number' && rt.minFreeMemoryPercent >= 0 && rt.minFreeMemoryPercent <= 100) {
            this.config.resourceThresholds.minFreeMemoryPercent = rt.minFreeMemoryPercent;
          }
        }
        if (typeof saved.config?.maxConcurrent === 'number' && saved.config.maxConcurrent > 0) {
          this.config.maxConcurrent = saved.config.maxConcurrent;
        }
        if (typeof saved.config?.workerTimeoutMs === 'number' && saved.config.workerTimeoutMs > 0) {
          this.config.workerTimeoutMs = saved.config.workerTimeoutMs;
        }

        // Restore worker runtime states (runCount, successCount, etc.)
        if (saved.workers) {
          for (const [type, state] of Object.entries(saved.workers)) {
            const savedState = state as Record<string, unknown>;
            const lastRunValue = savedState.lastRun;
            const lastStartedAtValue = savedState.lastStartedAt;
            this.workers.set(type as WorkerType, {
              runCount: (savedState.runCount as number) || 0,
              successCount: (savedState.successCount as number) || 0,
              failureCount: (savedState.failureCount as number) || 0,
              averageDurationMs: (savedState.averageDurationMs as number) || 0,
              lastRun: lastRunValue ? new Date(lastRunValue as string) : undefined,
              lastStartedAt: lastStartedAtValue ? new Date(lastStartedAtValue as string) : undefined,
              nextRun: undefined,
              isRunning: false,
            });
          }
        }
      } catch {
        // Ignore parse errors, start fresh
      }
    }

    // Initialize any missing workers
    for (const workerConfig of this.config.workers) {
      if (!this.workers.has(workerConfig.type)) {
        this.workers.set(workerConfig.type, {
          runCount: 0,
          successCount: 0,
          failureCount: 0,
          averageDurationMs: 0,
          isRunning: false,
        });
      }
    }
  }

  /**
   * Get the PID file path for singleton enforcement (#1395 Bug 3).
   */
  private get pidFile(): string {
    return join(this.projectRoot, '.claude-flow', 'daemon.pid');
  }

  /**
   * Check if another daemon instance is already running.
   * Returns the existing PID if alive, or null if no daemon is running.
   *
   * #1853: ignore self-PID matches. The detached-spawn path in
   * `commands/daemon.ts` writes the child's PID into the file as a
   * fallback after a 500ms wait. If the child reaches `start()` slower
   * than the parent's 500ms wait (observed on Node 25 / macOS 26), the
   * child reads its own PID back from the file and concludes "another
   * daemon is already running" — so it exits before scheduling workers
   * and `daemon status` reports STOPPED forever. A daemon process is
   * never "another instance" of itself; treat self-match as absence.
   */
  private checkExistingDaemon(): number | null {
    if (!existsSync(this.pidFile)) return null;
    try {
      const pid = parseInt(readFileSync(this.pidFile, 'utf-8').trim(), 10);
      if (isNaN(pid)) return null;
      // #1853: a PID file containing our own PID is not "another daemon".
      // Treat as absent so the start() path proceeds normally.
      if (pid === process.pid) return null;
      // Check if process is alive (signal 0 = existence check)
      process.kill(pid, 0);
      return pid; // Process is alive
    } catch {
      // Process is dead — clean up stale PID file
      try { unlinkSync(this.pidFile); } catch { /* ignore */ }
      return null;
    }
  }

  /**
   * Write PID file for singleton enforcement.
   */
  private writePidFile(): void {
    const dir = join(this.projectRoot, '.claude-flow');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.pidFile, String(process.pid), 'utf-8');
  }

  /**
   * Remove PID file on shutdown.
   */
  private removePidFile(): void {
    try { unlinkSync(this.pidFile); } catch { /* ignore */ }
  }

  /**
   * Start the daemon and all enabled workers
   */
  async start(): Promise<void> {
    if (this.running) {
      this.emit('warning', 'Daemon already running');
      return;
    }

    // PID singleton enforcement (#1395 Bug 3): prevent daemon accumulation
    const existingPid = this.checkExistingDaemon();
    if (existingPid !== null) {
      this.log('info', `Daemon already running (PID: ${existingPid}), skipping start`);
      this.emit('warning', `Daemon already running (PID: ${existingPid})`);
      return;
    }

    // #1855: reap orphan headless worker children left by a previous
    // crashed lifetime, BEFORE we mark ourselves running and start
    // accepting new work. The children file from the prior daemon's
    // last-snapshot is the authoritative list.
    this.reapOrphanedChildren();

    // #1856: detect workers that were mid-flight at the previous crash
    // and count them as failures so runCount/successCount/failureCount
    // stay consistent. Workers retry naturally at their next scheduled
    // interval — we don't immediately re-run them, which avoids a
    // freshly-recovered daemon hammering the same code path that just
    // killed it.
    this.detectMidFlightFailures();

    this.running = true;
    this.startedAt = new Date();
    this.writePidFile();
    this.emit('started', { pid: process.pid, startedAt: this.startedAt });

    // Schedule all enabled workers
    for (const workerConfig of this.config.workers) {
      if (workerConfig.enabled) {
        this.scheduleWorker(workerConfig);
      }
    }

    // #1845: poll the MCP-dispatch queue directory so workers requested
    // via mcp__hooks_worker-dispatch (in a separate process) actually
    // execute here. Previously the dispatch wrote to a process-local Map
    // that the daemon could never see.
    this.queuePollTimer = setInterval(() => {
      void this.processDispatchQueue();
    }, 5_000);
    if (typeof this.queuePollTimer.unref === 'function') {
      this.queuePollTimer.unref();
    }

    // Save state
    this.saveState();

    this.log('info', `Daemon started (PID: ${process.pid}, CPUs: ${cpus().length}, workers: ${this.config.workers.filter(w => w.enabled).length}, maxCpuLoad: ${this.config.resourceThresholds.maxCpuLoad}, minFreeMemoryPercent: ${this.config.resourceThresholds.minFreeMemoryPercent}%)`);
  }

  /**
   * #1845: ingest queue entries written by mcp__hooks_worker-dispatch.
   * Each entry is a JSON file at `.claude-flow/daemon-queue/<id>.json`
   * with `{ workerId, trigger, context, enqueuedAt }`. We move processed
   * files to `.claude-flow/daemon-queue/.processed/` so the daemon never
   * re-runs the same dispatch and operators can inspect history.
   */
  private async processDispatchQueue(): Promise<void> {
    if (!this.running) return;
    const queueDir = join(this.projectRoot, '.claude-flow', 'daemon-queue');
    if (!existsSync(queueDir)) return;

    let entries: string[];
    try {
      const fs = await import('fs');
      entries = fs.readdirSync(queueDir).filter((n) => n.endsWith('.json'));
    } catch {
      return;
    }
    if (entries.length === 0) return;

    const fs = await import('fs');
    const processedDir = join(queueDir, '.processed');
    if (!existsSync(processedDir)) {
      try { fs.mkdirSync(processedDir, { recursive: true }); } catch { /* race ok */ }
    }

    for (const entry of entries) {
      const src = join(queueDir, entry);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any;
      try {
        payload = JSON.parse(fs.readFileSync(src, 'utf-8'));
      } catch {
        // Malformed entry — quarantine so we don't loop on it
        try { fs.renameSync(src, join(processedDir, `bad-${entry}`)); } catch { /* nothing more we can do */ }
        continue;
      }
      const trigger = payload?.trigger as WorkerType | undefined;
      const workerId = payload?.workerId as string | undefined;
      if (!trigger || !this.config.workers.some((w) => w.type === trigger)) {
        try { fs.renameSync(src, join(processedDir, `unknown-${entry}`)); } catch { /* ok */ }
        continue;
      }
      try {
        this.log('info', `Dequeued ${trigger}${workerId ? ` (id=${workerId})` : ''} from MCP dispatch queue`);
        await this.triggerWorker(trigger);
      } catch (err) {
        this.log('warn', `Queued worker ${trigger} failed: ${(err as Error).message}`);
      } finally {
        try { fs.renameSync(src, join(processedDir, entry)); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Stop the daemon and all workers
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.emit('warning', 'Daemon not running');
      return;
    }

    // Clear all timers (convert to array to avoid iterator issues)
    const timerEntries = Array.from(this.timers.entries());
    for (const [type, timer] of timerEntries) {
      clearTimeout(timer);
      this.log('info', `Stopped worker: ${type}`);
    }
    this.timers.clear();

    // #1845: stop the MCP-dispatch queue poller too.
    if (this.queuePollTimer) {
      clearInterval(this.queuePollTimer);
      this.queuePollTimer = undefined;
    }

    this.running = false;
    this.removePidFile();
    this.saveState();
    this.emit('stopped', { stoppedAt: new Date() });
    this.log('info', 'Daemon stopped');
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus {
    return {
      running: this.running,
      pid: process.pid,
      startedAt: this.startedAt,
      workers: new Map(this.workers),
      config: this.config,
    };
  }

  /**
   * Schedule a worker to run at intervals with staggered start
   */
  private scheduleWorker(workerConfig: WorkerConfig): void {
    const state = this.workers.get(workerConfig.type)!;
    const internalConfig = workerConfig as WorkerConfigInternal;
    const staggerOffset = internalConfig.offsetMs || 0;

    // Calculate initial delay with stagger offset
    let initialDelay = staggerOffset;
    if (state.lastRun) {
      const timeSinceLastRun = Date.now() - state.lastRun.getTime();
      initialDelay = Math.max(staggerOffset, workerConfig.intervalMs - timeSinceLastRun);
    }

    state.nextRun = new Date(Date.now() + initialDelay);

    const runAndReschedule = async () => {
      if (!this.running) return;

      // Use concurrency-controlled execution (P0 fix)
      await this.executeWorkerWithConcurrencyControl(workerConfig);

      // Reschedule
      if (this.running) {
        const timer = setTimeout(runAndReschedule, workerConfig.intervalMs);
        this.timers.set(workerConfig.type, timer);
        state.nextRun = new Date(Date.now() + workerConfig.intervalMs);
      }
    };

    // Schedule first run with stagger offset
    const timer = setTimeout(runAndReschedule, initialDelay);
    this.timers.set(workerConfig.type, timer);

    this.log('info', `Scheduled ${workerConfig.type} (interval: ${workerConfig.intervalMs / 1000}s, first run in ${initialDelay / 1000}s)`);
  }

  /**
   * Execute a worker with concurrency control (P0 fix)
   */
  private async executeWorkerWithConcurrencyControl(workerConfig: WorkerConfig): Promise<WorkerResult | null> {
    // Check concurrency limit
    if (this.runningWorkers.size >= this.config.maxConcurrent) {
      this.log('info', `Worker ${workerConfig.type} deferred: max concurrent (${this.config.maxConcurrent}) reached`);
      this.pendingWorkers.push(workerConfig.type);
      this.emit('worker:deferred', { type: workerConfig.type, reason: 'max_concurrent' });
      return null;
    }

    // Check resource availability
    const resourceCheck = await this.canRunWorker();
    if (!resourceCheck.allowed) {
      this.log('info', `Worker ${workerConfig.type} deferred: ${resourceCheck.reason}`);
      this.pendingWorkers.push(workerConfig.type);
      this.emit('worker:deferred', { type: workerConfig.type, reason: resourceCheck.reason });
      return null;
    }

    return this.executeWorker(workerConfig);
  }

  /**
   * Execute a worker with timeout protection
   */
  private async executeWorker(workerConfig: WorkerConfig): Promise<WorkerResult> {
    const state = this.workers.get(workerConfig.type)!;
    const workerId = `${workerConfig.type}_${Date.now()}`;
    const startTime = Date.now();

    // Track running worker
    this.runningWorkers.add(workerConfig.type);
    state.isRunning = true;
    state.lastStartedAt = new Date(); // #1856: timestamp the start
    this.saveState();                  // persist before we run anything
    this.emit('worker:start', { workerId, type: workerConfig.type });
    this.log('info', `Starting worker: ${workerConfig.type} (${this.runningWorkers.size}/${this.config.maxConcurrent} concurrent)`);

    try {
      // Execute worker logic with timeout (P1 fix)
      // Pass cleanup callback to kill orphan child processes on timeout (#1117)
      const output = await this.runWithTimeout(
        () => this.runWorkerLogic(workerConfig),
        this.config.workerTimeoutMs,
        `Worker ${workerConfig.type} timed out after ${this.config.workerTimeoutMs / 1000}s`,
        () => {
          // On timeout, cancel any headless execution to prevent orphan processes
          if (this.headlessExecutor) {
            this.headlessExecutor.cancelAll();
          }
        }
      );
      const durationMs = Date.now() - startTime;

      // Update state
      state.runCount++;
      state.successCount++;
      state.lastRun = new Date();
      state.averageDurationMs = (state.averageDurationMs * (state.runCount - 1) + durationMs) / state.runCount;
      state.isRunning = false;

      const result: WorkerResult = {
        workerId,
        type: workerConfig.type,
        success: true,
        durationMs,
        output,
        timestamp: new Date(),
      };

      this.emit('worker:complete', result);
      this.log('info', `Worker ${workerConfig.type} completed in ${durationMs}ms`);
      this.saveState();

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      state.runCount++;
      state.failureCount++;
      state.lastRun = new Date();
      state.isRunning = false;

      const result: WorkerResult = {
        workerId,
        type: workerConfig.type,
        success: false,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };

      this.emit('worker:error', result);
      this.log('error', `Worker ${workerConfig.type} failed: ${result.error}`);
      this.saveState();

      return result;
    } finally {
      // Remove from running set and process queue
      this.runningWorkers.delete(workerConfig.type);
      this.processPendingWorkers();
    }
  }

  /**
   * Run a function with timeout (P1 fix)
   * @param fn - The async function to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param timeoutMessage - Error message on timeout
   * @param onTimeout - Optional cleanup callback invoked when timeout fires (#1117: kills orphan processes)
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    onTimeout?: () => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Kill orphan child processes before rejecting (#1117)
        if (onTimeout) {
          try {
            onTimeout();
          } catch {
            // Ignore cleanup errors
          }
        }
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      fn()
        .then((result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Run the actual worker logic
   */
  private async runWorkerLogic(workerConfig: WorkerConfig): Promise<unknown> {
    // Check if this is a headless worker type and headless execution is available
    if (isHeadlessWorker(workerConfig.type) && this.headlessAvailable && this.headlessExecutor) {
      try {
        this.log('info', `Running ${workerConfig.type} in headless mode (Claude Code AI)`);
        const result = await this.headlessExecutor.execute(workerConfig.type as HeadlessWorkerType);

        // #2110 — `HeadlessWorkerExecutor.execute()` returns
        // `createErrorResult(...)` with `success: false` when
        // `isAvailable()` is false, instead of throwing. The previous
        // try/catch never fired in that path, and the result was
        // persisted as mode:"headless" despite being a stub. Downstream
        // dashboards / `memory stats` couldn't distinguish a real AI
        // run from a fallback. Treat falsy success the same as throw.
        const ok = (result as { success?: unknown })?.success === true;
        if (!ok) {
          const reason =
            (result as { error?: unknown })?.error ||
            (result as { note?: unknown })?.note ||
            'headless executor reported success=false';
          this.log('warn', `Headless ${workerConfig.type} returned success=false (${String(reason).slice(0, 200)}); falling back to local mode`);
          this.emit('headless:fallback', {
            type: workerConfig.type,
            error: String(reason).slice(0, 500),
          });
          // Fall through to local switch.
        } else {
          // #1793: persist the headless result to the same metrics files the
          // local workers write to. Without this, AI-mode runs produced rich
          // parsedOutput that lived only in `.claude-flow/logs/headless/*` and
          // never reached `.claude-flow/metrics/<name>.json` — `memory stats`
          // and downstream consumers saw nothing despite successful runs.
          try {
            persistHeadlessResult(this.projectRoot, workerConfig.type as HeadlessWorkerType, result);
          } catch (persistError) {
            this.log('warn', `Failed to persist headless result for ${workerConfig.type}: ${(persistError as Error).message}`);
          }
          return {
            mode: 'headless',
            ...result,
          };
        }
      } catch (error) {
        this.log('warn', `Headless execution failed for ${workerConfig.type}, falling back to local mode`);
        this.emit('headless:fallback', {
          type: workerConfig.type,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to local execution
      }
    }

    // Local execution (fallback or for non-headless workers). The local
    // worker bodies are free functions in ./worker-daemon/local-workers.ts
    // (W110); they only need projectRoot.
    const root = this.projectRoot;
    switch (workerConfig.type) {
      case 'map':
        return runMapWorker(root);
      case 'audit':
        return runAuditWorkerLocal(root);
      case 'optimize':
        return runOptimizeWorkerLocal(root);
      case 'consolidate':
        return runConsolidateWorker(root);
      case 'testgaps':
        return runTestGapsWorkerLocal(root);
      case 'predict':
        return runPredictWorkerLocal(root);
      case 'document':
        return runDocumentWorkerLocal(root);
      case 'ultralearn':
        return runUltralearnWorkerLocal(root);
      case 'refactor':
        return runRefactorWorkerLocal(root);
      case 'deepdive':
        return runDeepdiveWorkerLocal(root);
      case 'benchmark':
        return runBenchmarkWorkerLocal(root);
      case 'preload':
        return runPreloadWorkerLocal(root);
      default:
        return { status: 'unknown worker type', mode: 'local' };
    }
  }


  /**
   * Manually trigger a worker
   */
  async triggerWorker(type: WorkerType): Promise<WorkerResult> {
    const workerConfig = this.config.workers.find(w => w.type === type);
    if (!workerConfig) {
      throw new Error(`Unknown worker type: ${type}`);
    }
    // #2251 — wait for headless probe to settle before running. Without
    // this, on-demand `daemon trigger -w <worker>` races the constructor's
    // fire-and-forget init and ALWAYS falls through to local mode even
    // when `claude` is on PATH and scheduled fires of the same worker
    // use headless correctly. Scheduled fires already wait long enough
    // (timer + offset) that this is a no-op for them.
    await this.headlessInitPromise;
    return this.executeWorker(workerConfig);
  }

  /**
   * Enable/disable a worker
   */
  setWorkerEnabled(type: WorkerType, enabled: boolean): void {
    const workerConfig = this.config.workers.find(w => w.type === type);
    if (workerConfig) {
      workerConfig.enabled = enabled;

      if (enabled && this.running) {
        this.scheduleWorker(workerConfig);
      } else if (!enabled) {
        const timer = this.timers.get(type);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(type);
        }
      }

      this.saveState();
    }
  }

  /**
   * Save daemon state to file
   */
  private saveState(): void {
    const state = {
      running: this.running,
      startedAt: this.startedAt?.toISOString(),
      workers: Object.fromEntries(
        Array.from(this.workers.entries()).map(([type, state]) => [
          type,
          {
            ...state,
            lastRun: state.lastRun?.toISOString(),
            lastStartedAt: state.lastStartedAt?.toISOString(),
            nextRun: state.nextRun?.toISOString(),
          }
        ])
      ),
      config: {
        ...this.config,
        workers: this.config.workers.map(w => ({ ...w })),
      },
      savedAt: new Date().toISOString(),
    };

    try {
      const tmpFile = this.config.stateFile + '.tmp';
      writeFileSync(tmpFile, JSON.stringify(state, null, 2));
      renameSync(tmpFile, this.config.stateFile);
    } catch (error) {
      this.log('error', `Failed to save state: ${error}`);
    }
  }

  /**
   * Log message
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    this.emit('log', { level, message, timestamp });

    // Also write to log file
    try {
      const logFile = join(this.config.logDir, 'daemon.log');
      appendFileSync(logFile, logMessage + '\n');
    } catch {
      // Ignore log write errors
    }
  }
}

// Singleton instance for global access
let daemonInstance: WorkerDaemon | null = null;

/**
 * Get or create daemon instance
 */
export function getDaemon(projectRoot?: string, config?: Partial<DaemonConfig>): WorkerDaemon {
  if (!daemonInstance && projectRoot) {
    daemonInstance = new WorkerDaemon(projectRoot, config);
  }
  if (!daemonInstance) {
    throw new Error('Daemon not initialized. Provide projectRoot on first call.');
  }
  return daemonInstance;
}

/**
 * Start daemon (for use in session-start hook)
 */
export async function startDaemon(projectRoot: string, config?: Partial<DaemonConfig>): Promise<WorkerDaemon> {
  const daemon = getDaemon(projectRoot, config);
  await daemon.start();
  return daemon;
}

/**
 * Stop daemon
 */
export async function stopDaemon(): Promise<void> {
  if (daemonInstance) {
    await daemonInstance.stop();
  }
}

export default WorkerDaemon;

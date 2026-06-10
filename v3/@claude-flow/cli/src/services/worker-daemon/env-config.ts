/**
 * Environment probes + daemon file-config loader for the worker daemon.
 *
 *   - isWslEnvironment      (WSL detection: env vars + /proc osrelease)
 *   - getEffectiveCpuCount  (cgroup v2 → cgroup v1 → os.cpus() fallback)
 *   - readDaemonConfigFromFile (.claude-flow/config.{json,yaml,yml} reader,
 *                              dot-notation keys, JSON-preferred #1844)
 *
 * Extracted from worker-daemon.ts (W109, P3.12 cut #2). The WorkerDaemon
 * class keeps thin static delegators (`isWslEnvironment` /
 * `getEffectiveCpuCount`) so its public static API stays byte-identical.
 */
import { existsSync, readFileSync } from 'fs';
import { cpus } from 'os';
import { join } from 'path';

/** Daemon overrides parsed from the on-disk config file. */
export interface DaemonFileConfig {
  autoStart?: boolean;
  maxConcurrent?: number;
  workerTimeoutMs?: number;
  maxCpuLoad?: number;
  minFreeMemoryPercent?: number;
}

/**
 * Detect a WSL environment.
 *
 * Detection order:
 *   1. `WSL_DISTRO_NAME` env var (set by Microsoft's WSL launcher)
 *   2. `WSL_INTEROP` env var (set by recent WSL2)
 *   3. `/proc/sys/kernel/osrelease` contains "microsoft" or "WSL"
 *      (kernel build marker; survives env stripping)
 */
export function isWslEnvironment(): boolean {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    const osrelease = readFileSync('/proc/sys/kernel/osrelease', 'utf8').toLowerCase();
    if (osrelease.includes('microsoft') || osrelease.includes('wsl')) return true;
  } catch { /* not on Linux or /proc inaccessible */ }
  return false;
}

export function getEffectiveCpuCount(): number {
  // 1. Try cgroup v2: /sys/fs/cgroup/cpu.max
  try {
    const cpuMax = readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim();
    const [quotaStr, periodStr] = cpuMax.split(' ');
    if (quotaStr !== 'max') {
      const quota = parseInt(quotaStr, 10);
      const period = parseInt(periodStr, 10);
      if (quota > 0 && period > 0) return Math.ceil(quota / period);
    }
  } catch { /* not in cgroup v2 */ }

  // 2. Try cgroup v1: /sys/fs/cgroup/cpu/cpu.cfs_quota_us
  try {
    const quota = parseInt(readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf8').trim(), 10);
    const period = parseInt(readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf8').trim(), 10);
    if (quota > 0 && period > 0) return Math.ceil(quota / period);
  } catch { /* not in cgroup v1 */ }

  // 3. Fallback to os.cpus().length
  return cpus().length || 1;
}

/**
 * Read daemon-specific config from .claude-flow/config.{json,yaml,yml}.
 * Supports dot-notation keys like 'daemon.resourceThresholds.maxCpuLoad'.
 * #1844: prefer JSON when both exist (existing behavior) but fall back
 * to YAML so operators using the v3 canonical YAML format aren't silently
 * ignored. The chosen path is logged at info level via the `log` callback.
 */
export function readDaemonConfigFromFile(
  claudeFlowDir: string,
  log: (level: 'info' | 'warn' | 'error', message: string) => void,
): DaemonFileConfig {
  const jsonPath = join(claudeFlowDir, 'config.json');
  const yamlPath = join(claudeFlowDir, 'config.yaml');
  const ymlPath = join(claudeFlowDir, 'config.yml');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: Record<string, any> | undefined;
  let chosenPath: string | undefined;

  if (existsSync(jsonPath)) {
    try {
      raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      chosenPath = jsonPath;
    } catch {
      return {};
    }
  } else if (existsSync(yamlPath) || existsSync(ymlPath)) {
    const yPath = existsSync(yamlPath) ? yamlPath : ymlPath;
    try {
      // Lazy-load yaml so the daemon doesn't hard-require it; if the
      // dep isn't installed, fall back to the previous warn-only path.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const yamlMod = require('yaml') as { parse(s: string): unknown };
      const parsed = yamlMod.parse(readFileSync(yPath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw = parsed as Record<string, any>;
        chosenPath = yPath;
      }
    } catch {
      log(
        'warn',
        `Found ${yPath} but yaml parser unavailable. Install \`yaml\` or convert to JSON. Falling back to defaults.`,
      );
      return {};
    }
  }

  if (!raw || !chosenPath) {
    return {};
  }
  log('info', `Daemon config loaded from ${chosenPath}`);

  try {
    // Support both flat keys at root and nested under scopes.project
    const cfg = raw?.scopes?.project ?? raw;
    const rawCpuLoad = cfg['daemon.resourceThresholds.maxCpuLoad'] ?? raw['daemon.resourceThresholds.maxCpuLoad'];
    const rawMinMem = cfg['daemon.resourceThresholds.minFreeMemoryPercent'] ?? raw['daemon.resourceThresholds.minFreeMemoryPercent'];
    const rawMaxConcurrent = cfg['daemon.maxConcurrent'] ?? raw['daemon.maxConcurrent'];
    const rawTimeout = cfg['daemon.workerTimeoutMs'] ?? raw['daemon.workerTimeoutMs'];
    return {
      autoStart: typeof raw['daemon.autoStart'] === 'boolean' ? raw['daemon.autoStart'] : undefined,
      maxConcurrent: (typeof rawMaxConcurrent === 'number' && rawMaxConcurrent > 0) ? rawMaxConcurrent : undefined,
      workerTimeoutMs: (typeof rawTimeout === 'number' && rawTimeout > 0) ? rawTimeout : undefined,
      maxCpuLoad: (typeof rawCpuLoad === 'number' && rawCpuLoad > 0 && rawCpuLoad < 1000) ? rawCpuLoad : undefined,
      minFreeMemoryPercent: (typeof rawMinMem === 'number' && rawMinMem >= 0 && rawMinMem <= 100) ? rawMinMem : undefined,
    };
  } catch {
    return {};
  }
}

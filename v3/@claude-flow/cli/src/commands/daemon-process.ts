/**
 * Daemon process management — path/workspace validation, the background-
 * daemon spawner (fork), and the kill/reap/PID/liveness helpers (incl. the
 * POSIX + Windows stale-daemon sweeps). Shared by the start/stop/status
 * subcommands.
 *
 * Extracted from daemon.ts (W133, P3.19 cut #1).
 */
import type { CommandResult } from '../types.js';
import { output } from '../output.js';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as fs from 'fs';

/**
 * Validate path for security - prevents path traversal and injection
 */
export function validatePath(path: string, label: string): void {
  // Must be absolute after resolution
  const resolved = resolve(path);

  // Check for null bytes (injection attack)
  if (path.includes('\0')) {
    throw new Error(`${label} contains null bytes`);
  }

  // Check for shell metacharacters in path components
  if (/[;&|`$<>]/.test(path)) {
    throw new Error(`${label} contains shell metacharacters`);
  }

  // Prevent path traversal outside expected directories
  if (!resolved.includes('.claude-flow') && !resolved.includes('bin')) {
    // Allow only paths within project structure
    const cwd = process.cwd();
    if (!resolved.startsWith(cwd)) {
      throw new Error(`${label} escapes project directory`);
    }
  }
}

/**
 * #1914: Resolve the `--workspace` flag to an absolute path, or return null
 * if it is absent / not a usable string. Rejects values with null bytes or
 * shell metacharacters (defence-in-depth — the value is later embedded in a
 * forked child's argv and compared against `ps`/`tasklist` output).
 */
export function resolveWorkspaceFlag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\0') || /[;&|`$<>]/.test(trimmed)) return null;
  return resolve(trimmed);
}

/**
 * #1914: True when a process command line (from `ps -eo command` on POSIX or
 * the tasklist Window Title column on Windows) belongs to a daemon started
 * for `workspaceRoot`. The launcher (`startBackgroundDaemon`) always appends
 * `--workspace <root>` as the FINAL argv entry, so an exact trailing match
 * after stripping trailing whitespace/quotes is unambiguous — even for
 * workspace paths containing spaces — and never a bare path-prefix match,
 * so workspace `/a/proj` does not reap `/a/proj-other`'s daemon. A daemon
 * whose argv puts `--workspace` mid-list (only possible via a hand-rolled
 * invocation) simply won't be auto-reaped — `daemon stop` still handles it
 * via the PID file.
 */
export function daemonCommandLineBelongsToWorkspace(commandLine: string, workspaceRoot: string): boolean {
  return commandLine.replace(/[\s"']+$/u, '').endsWith(`--workspace ${workspaceRoot}`);
}

/**
 * Start daemon as a detached background process
 */
export interface ForwardedDaemonFlags {
  maxCpuLoad?: string;
  minFreeMemory?: string;
  workers?: string;
  headless?: boolean;
  sandbox?: string;
}

export async function startBackgroundDaemon(projectRoot: string, quiet: boolean, forwarded: ForwardedDaemonFlags = {}): Promise<CommandResult> {
  const { maxCpuLoad, minFreeMemory, workers, headless, sandbox } = forwarded;
  // Validate and resolve project root
  const resolvedRoot = resolve(projectRoot);
  validatePath(resolvedRoot, 'Project root');

  const stateDir = join(resolvedRoot, '.claude-flow');
  const pidFile = join(stateDir, 'daemon.pid');
  const logFile = join(stateDir, 'daemon.log');

  // Validate all paths
  validatePath(stateDir, 'State directory');
  validatePath(pidFile, 'PID file');
  validatePath(logFile, 'Log file');

  // Ensure state directory exists
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  // Get path to CLI (from dist/src/commands/daemon.js -> bin/cli.js)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // dist/src/commands -> dist/src -> dist -> package root -> bin/cli.js
  const cliPath = resolve(join(__dirname, '..', '..', '..', 'bin', 'cli.js'));
  validatePath(cliPath, 'CLI path');

  // Verify CLI path exists
  if (!fs.existsSync(cliPath)) {
    output.printError(`CLI not found at: ${cliPath}`);
    return { success: false, exitCode: 1 };
  }

  // Platform-aware spawn flags. We use child_process.fork() because the daemon
  // child is itself a Node script — fork() spawns Node directly and skips the
  // cmd.exe interpretation pass that broke Windows + Node 25 when
  // process.execPath contained a space (#1691). It also avoids the [DEP0190]
  // shell:true security warning.
  const forkOpts: Record<string, unknown> = {
    cwd: resolvedRoot,
    // detached: true on every platform (#1766). On Windows, leaving detached:false
    // kept the child in the parent's process group AND the IPC pipe held the
    // child to npx — when npx exited, the IPC pipe tore down and the daemon
    // died within ~1s. detached:true + child.disconnect() (below) gives the
    // child its own session/pgid and breaks the IPC pipe so the daemon
    // genuinely survives parent exit. On POSIX, detached:true was already the
    // path; this just makes Windows match.
    detached: true,
    // Use 'ignore' for all stdio + 'ignore' for the IPC channel via silent:true off.
    // fork() defaults to creating an IPC channel; we don't need it here, so we
    // pass stdio explicitly. Passing fs.openSync() FDs causes the child to die
    // on Windows when the parent exits and closes the FDs (#1478 Bug 3) — the
    // daemon writes its own logs via appendFileSync to .claude-flow/logs/.
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
    env: {
      ...process.env,
      CLAUDE_FLOW_DAEMON: '1',
      // Prevent macOS SIGHUP kill when terminal closes
      ...(process.platform === 'darwin' ? { NOHUP: '1' } : {}),
    },
  };

  // Forward args to the foreground child. fork() resolves the script path
  // via Node's normal module resolution, so cliPath does not need to be
  // shell-quoted even when it contains spaces.
  const forkArgs = ['daemon', 'start', '--foreground', '--quiet'];
  // Validate with strict numeric pattern to prevent injection via crafted flags.
  const SPAWN_NUMERIC_RE = /^\d+(\.\d+)?$/;
  if (maxCpuLoad && SPAWN_NUMERIC_RE.test(maxCpuLoad)) {
    forkArgs.push('--max-cpu-load', maxCpuLoad);
  }
  if (minFreeMemory && SPAWN_NUMERIC_RE.test(minFreeMemory)) {
    forkArgs.push('--min-free-memory', minFreeMemory);
  }
  // #1968: forward worker-selection / sandbox flags. The previous launcher
  // dropped these, so `daemon start --workers map` ran with the default
  // five-worker set instead of just `map`. Validate each before passing
  // through — argv goes straight to a forked process so reject anything
  // that doesn't look like a comma-separated worker-name list or one of
  // the allowed sandbox modes.
  const WORKERS_RE = /^[a-z][a-z0-9_-]*(,[a-z][a-z0-9_-]*)*$/;
  if (typeof workers === 'string' && workers.length > 0 && WORKERS_RE.test(workers)) {
    forkArgs.push('--workers', workers);
  }
  if (headless === true) {
    forkArgs.push('--headless');
  }
  if (typeof sandbox === 'string' && (sandbox === 'strict' || sandbox === 'permissive' || sandbox === 'disabled')) {
    forkArgs.push('--sandbox', sandbox);
  }
  // #1914: stamp the workspace into argv (kept LAST) so the foreground daemon
  // process is self-identifying and `killStaleDaemons` only reaps daemons
  // belonging to this workspace. resolvedRoot was validatePath()'d above.
  forkArgs.push('--workspace', resolvedRoot);
  const child = fork(cliPath, forkArgs, forkOpts);

  // Get PID from spawned process directly (no shell echo needed)
  const pid = child.pid;

  if (!pid || pid <= 0) {
    output.printError('Failed to get daemon PID');
    return { success: false, exitCode: 1 };
  }

  // Unref BEFORE writing PID file — prevents race where parent exits
  // but child hasn't fully detached yet (fixes macOS daemon death #1283).
  child.unref();
  // #1766: also break the IPC pipe explicitly. unref() releases the libuv
  // handle but does NOT close the IPC channel; on Windows the open IPC
  // pipe keeps the daemon tied to its parent npx, and when npx exits the
  // pipe is torn down and the daemon exits with it. disconnect() severs
  // the IPC pipe so the daemon truly stands on its own. Wrapped in try
  // because disconnect() throws if the IPC channel is already gone.
  try { child.disconnect(); } catch { /* IPC channel already closed */ }

  // Longer delay to let the child process start and write its own PID file.
  // 100ms was too short on Windows; the child's checkExistingDaemon() would
  // find the parent-written PID and return early (#1478 Bug 1).
  await new Promise(resolve => setTimeout(resolve, 500));

  // Write PID file only if the child hasn't already written its own.
  // The foreground child calls writePidFile() internally, but on some platforms
  // it may not have started yet, so we write as a fallback.
  if (!fs.existsSync(pidFile)) {
    fs.writeFileSync(pidFile, String(pid));
  }

  if (!quiet) {
    output.printSuccess(`Daemon started in background (PID: ${pid})`);
    output.printInfo(`Logs: ${logFile}`);
    output.printInfo(`Stop with: claude-flow daemon stop`);
  }

  return { success: true };
}

/** Kill background daemon process using PID file. */
export async function killBackgroundDaemon(projectRoot: string): Promise<boolean> {
  const pidFile = join(projectRoot, '.claude-flow', 'daemon.pid');

  if (!fs.existsSync(pidFile)) {
    return false;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);

    if (isNaN(pid)) {
      fs.unlinkSync(pidFile);
      return false;
    }

    // Check if process is running
    try {
      process.kill(pid, 0); // Signal 0 = check if alive
    } catch {
      // Process not running, clean up stale PID file
      fs.unlinkSync(pidFile);
      return false;
    }

    // Kill the process
    process.kill(pid, 'SIGTERM');

    // Wait a moment then force kill if needed
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      process.kill(pid, 0);
      // Still alive, force kill
      process.kill(pid, 'SIGKILL');
    } catch {
      // Process terminated
    }

    // Clean up PID file
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }

    return true;
  } catch (error) {
    // Clean up PID file on any error
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    return false;
  }
}

/**
 * Kill stale daemon processes not tracked by the PID file (#1551, #1857).
 * Uses `ps` on POSIX and `tasklist` on Windows to find all daemon
 * processes for this project and kill them.
 */
export async function killStaleDaemons(projectRoot: string, quiet: boolean): Promise<void> {
  if (process.platform === 'win32') {
    return killStaleDaemonsWindows(projectRoot, quiet);
  }
  return killStaleDaemonsPosix(projectRoot, quiet);
}

export async function killStaleDaemonsPosix(projectRoot: string, quiet: boolean): Promise<void> {
  try {
    const { execFileSync } = await import('child_process');
    const psOutput = execFileSync('ps', ['-eo', 'pid,command'], { encoding: 'utf-8', timeout: 5000 });
    const lines = psOutput.split('\n');
    const currentPid = process.pid;
    const trackedPid = getBackgroundDaemonPid(projectRoot);
    // #1914: only ever reap daemons belonging to THIS workspace (ADR-014).
    const resolvedRoot = resolve(projectRoot);
    let killed = 0;

    for (const line of lines) {
      if (!line.includes('daemon start --foreground')) continue;
      if (!line.includes('claude-flow') && !line.includes('@claude-flow/cli')) continue;
      // #1914: skip daemons from other workspaces (or pre-#1914 versions that
      // didn't stamp --workspace — let `daemon stop` handle those via PID file).
      if (!daemonCommandLineBelongsToWorkspace(line, resolvedRoot)) continue;
      const pidStr = line.trim().split(/\s+/)[0];
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid) || pid === currentPid || pid === trackedPid) continue;
      if (!isProcessRunning(pid)) continue;
      try {
        process.kill(pid, 'SIGTERM');
        killed++;
        if (!quiet) {
          output.printWarning(`Killed stale daemon process (PID: ${pid})`);
        }
      } catch { /* ignore — may have exited between check and kill */ }
    }

    if (killed > 0 && !quiet) {
      output.printInfo(`Cleaned up ${killed} stale daemon process(es)`);
    }
  } catch {
    // ps not available or failed — skip stale cleanup
  }
}

/**
 * #1857: Windows replacement for the POSIX `ps -eo pid,command` path.
 * Uses `tasklist /v /fo csv` which returns CSV with the full Window
 * Title column (last field) — Node-spawned daemon processes carry
 * their command line there. Best-effort like the POSIX path: any
 * tooling failure (tasklist missing, parse error, etc.) is swallowed
 * silently so cleanup doesn't break daemon start.
 */
export async function killStaleDaemonsWindows(projectRoot: string, quiet: boolean): Promise<void> {
  try {
    const { execFileSync } = await import('child_process');
    // /v includes the Window Title; /fo csv uses comma-separated quoted fields
    const out = execFileSync('tasklist', ['/v', '/fo', 'csv', '/nh'], { encoding: 'utf-8', timeout: 5000 });
    const lines = out.split(/\r?\n/);
    const currentPid = process.pid;
    const trackedPid = getBackgroundDaemonPid(projectRoot);
    // #1914: only ever reap daemons belonging to THIS workspace (ADR-014).
    const resolvedRoot = resolve(projectRoot);
    let killed = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      // Match daemon command line markers — the Window Title field
      // typically holds the full invocation. Skip rows that aren't ours.
      if (!line.includes('daemon start --foreground')) continue;
      if (!line.includes('claude-flow') && !line.includes('@claude-flow/cli')) continue;
      // #1914: skip daemons from other workspaces (or pre-#1914 versions).
      if (!daemonCommandLineBelongsToWorkspace(line, resolvedRoot)) continue;

      // Parse CSV: tasklist quotes each field, so split on `","`
      const fields = line.split(/","/).map(f => f.replace(/^"|"$/g, ''));
      // fields[0] = Image Name, fields[1] = PID, …
      const pidStr = fields[1];
      const pid = parseInt(pidStr ?? '', 10);
      if (isNaN(pid) || pid === currentPid || pid === trackedPid) continue;
      if (!isProcessRunning(pid)) continue;

      try {
        // taskkill is the Windows equivalent of kill — /pid <n> /f forces.
        // Use SIGTERM-equivalent (no /f) first; the daemon's signal handler
        // catches and cleans up; force-kill is the next start's job.
        execFileSync('taskkill', ['/pid', String(pid), '/t'], { encoding: 'utf-8', timeout: 5000 });
        killed++;
        if (!quiet) {
          output.printWarning(`Killed stale daemon process (PID: ${pid})`);
        }
      } catch { /* taskkill failed — process may have exited; ignore */ }
    }

    if (killed > 0 && !quiet) {
      output.printInfo(`Cleaned up ${killed} stale daemon process(es)`);
    }
  } catch {
    // tasklist not available or failed — skip stale cleanup. Defensive
    // shape matches the POSIX path. Not tested on Windows by the
    // maintainer; please report regressions on the issue tracker.
  }
}

/**
 * Get PID of background daemon from PID file
 */
export function getBackgroundDaemonPid(projectRoot: string): number | null {
  const pidFile = join(projectRoot, '.claude-flow', 'daemon.pid');

  if (!fs.existsSync(pidFile)) {
    return null;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Check if a process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = check if alive
    return true;
  } catch {
    return false;
  }
}

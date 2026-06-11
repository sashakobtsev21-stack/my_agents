/**
 * Process Command — PID-file helpers
 *
 * Module-private in the original process.ts (campaign-2 W279); NOT
 * re-exported.
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export function writePidFile(pidFile: string, pid: number, port: number): void {
  const dir = dirname(resolve(pidFile));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const data = JSON.stringify({ pid, port, startedAt: new Date().toISOString() });
  writeFileSync(resolve(pidFile), data, 'utf-8');
}

export function readPidFile(pidFile: string): { pid: number; port: number; startedAt: string } | null {
  try {
    const path = resolve(pidFile);
    if (!existsSync(path)) return null;
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function removePidFile(pidFile: string): boolean {
  try {
    const path = resolve(pidFile);
    if (existsSync(path)) {
      unlinkSync(path);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Daemon subcommand - start/stop background daemon
 */

/**
 * Persistence path resolution for the intelligence pipeline — the
 * basePath override (issue #7 pilot: avoids process.chdir() so vitest
 * worker_threads don't break on Windows) plus the neural data-dir +
 * patterns/stats file-path helpers.
 *
 * Extracted from intelligence.ts (W105, P3.11 cut #2). The foundation
 * the SonaCoordinator / ReasoningBank / module functions all build on.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let basePathOverride: string | null = null;

/** Pin the intelligence persistence base to `p`. Pass `null` to reset. */
export function setIntelligenceBasePath(p: string | null): void {
  basePathOverride = p;
}

/**
 * Get the data directory for neural pattern persistence.
 * Uses .claude-flow/neural in basePathOverride (if set) or process.cwd(),
 * falling back to the home directory.
 */
export function getDataDir(): string {
  const cwd = basePathOverride ?? process.cwd();
  const localDir = join(cwd, '.claude-flow', 'neural');
  const homeDir = join(homedir(), '.claude-flow', 'neural');

  // Prefer local directory if .claude-flow exists
  if (existsSync(join(cwd, '.claude-flow'))) {
    return localDir;
  }

  return homeDir;
}

/**
 * Ensure the data directory exists
 */
export function ensureDataDir(): string {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the patterns file path
 */
export function getPatternsPath(): string {
  return join(getDataDir(), 'patterns.json');
}

/**
 * Get the stats file path
 */
export function getStatsPath(): string {
  return join(getDataDir(), 'stats.json');
}

/**
 * System MCP Tools — version, store types & IO helpers
 *
 * Module-private in the original system-tools.ts (campaign-2 W281); NOT
 * re-exported by the barrel.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import { getProjectCwd } from './types.js';

export function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    for (const depth of ['../..', '../../..']) {
      const pkgPath = join(__dirname, depth, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name?.includes('claude-flow') || pkg.name === 'ruflo') {
          return pkg.version || '3.0.0';
        }
      }
    }
    return '3.0.0';
  } catch {
    return '3.0.0';
  }
}
export const PKG_VERSION = getPackageVersion();

// Storage paths
export const STORAGE_DIR = '.claude-flow';
export const SYSTEM_DIR = 'system';
export const METRICS_FILE = 'metrics.json';

export interface SystemMetrics {
  startTime: string;
  lastCheck: string;
  uptime: number;
  health: number;
  cpu: number;
  memory: { used: number; total: number };
  agents: { active: number; total: number };
  tasks: { pending: number; completed: number; failed: number };
  requests: { total: number; success: number; errors: number };
}

export function getSystemDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, SYSTEM_DIR);
}

export function getMetricsPath(): string {
  return join(getSystemDir(), METRICS_FILE);
}

export function ensureSystemDir(): void {
  const dir = getSystemDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadMetrics(): SystemMetrics {
  try {
    const path = getMetricsPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // Return default metrics
  }
  return {
    startTime: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
    uptime: 0,
    health: 1.0,
    cpu: os.loadavg()[0] * 100 / os.cpus().length,
    memory: { used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024), total: Math.round(os.totalmem() / 1024 / 1024) },
    agents: { active: 0, total: 0 },
    tasks: { pending: 0, completed: 0, failed: 0 },
    requests: { total: 0, success: 0, errors: 0 },
  };
}

export function saveMetrics(metrics: SystemMetrics): void {
  ensureSystemDir();
  metrics.lastCheck = new Date().toISOString();
  writeFileSync(getMetricsPath(), JSON.stringify(metrics, null, 2), 'utf-8');
}


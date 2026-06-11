/**
 * Performance MCP Tools — store types & IO helpers
 *
 * Module-private in the original performance-tools.ts (campaign-2
 * W280); NOT re-exported by the barrel.
 */

import { getProjectCwd } from './types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const STORAGE_DIR = '.claude-flow';
export const PERF_DIR = 'performance';
export const METRICS_FILE = 'metrics.json';
// BENCHMARKS_FILE used to land here from the perf_benchmark MCP tool;
// the bench data now persists through verify-bench-result.json under
// .claude-flow/data, so the legacy benchmarks.json constant is unused.

export interface PerfMetrics {
  timestamp: string;
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; heap: number };
  latency: { avg: number; p50: number; p95: number; p99: number };
  throughput: { requests: number; operations: number };
  errors: { count: number; rate: number };
}

export interface Benchmark {
  id: string;
  name: string;
  type: string;
  results: {
    duration: number;
    iterations: number;
    opsPerSecond: number;
    memory: number;
  };
  createdAt: string;
}

export interface PerfStore {
  metrics: PerfMetrics[];
  benchmarks: Record<string, Benchmark>;
  version: string;
}

export function getPerfDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, PERF_DIR);
}

export function getPerfPath(): string {
  return join(getPerfDir(), METRICS_FILE);
}

export function ensurePerfDir(): void {
  const dir = getPerfDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadPerfStore(): PerfStore {
  try {
    const path = getPerfPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // Return empty store
  }
  return { metrics: [], benchmarks: {}, version: '3.0.0' };
}

export function savePerfStore(store: PerfStore): void {
  ensurePerfDir();
  writeFileSync(getPerfPath(), JSON.stringify(store, null, 2), 'utf-8');
}


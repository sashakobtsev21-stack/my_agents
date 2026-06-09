/**
 * Memory-store helpers + intelligence stats + agent suggester.
 *
 * Extracted from hooks-tools.ts as the second natural cluster (W32
 * decomposition pilot). Pure local persistence (read-only for stats,
 * write happens via the MCP tool handlers in hooks-tools.ts) — no
 * MCP-tool dependencies inside this file.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { projectRoot } from './base-path.js';
import { extractKeywords, loadRoutingOutcomes } from './routing-patterns.js';
import { KEYWORD_PATTERNS } from './routing-helpers.js';

// ── Memory store types + path ───────────────────────────────────────

export interface MemoryEntry {
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  storedAt: string;
  accessCount: number;
  lastAccessed: string;
}

export interface MemoryStore {
  entries: Record<string, MemoryEntry>;
  version: string;
}

export const MEMORY_DIR = '.claude-flow/memory';
export const MEMORY_FILE = 'store.json';

export function getMemoryPath(): string {
  return join(projectRoot(), MEMORY_DIR, MEMORY_FILE);
}

export function loadMemoryStore(): MemoryStore {
  try {
    const path = getMemoryPath();
    if (existsSync(path)) {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Return empty store on error
  }
  return { entries: {}, version: '3.0.0' };
}

// ── Intelligence stats ──────────────────────────────────────────────

/**
 * Get real intelligence statistics from memory store.
 */
export function getIntelligenceStatsFromMemory(): {
  trajectories: { total: number; successful: number };
  patterns: { learned: number; categories: Record<string, number> };
  memory: { indexSize: number; totalAccessCount: number; memorySizeBytes: number };
  routing: { decisions: number; avgConfidence: number };
} {
  const store = loadMemoryStore();
  const entries = Object.values(store.entries);

  // Count trajectories (keys starting with "trajectory-" or containing trajectory data)
  const trajectoryEntries = entries.filter(e =>
    e.key.includes('trajectory') ||
    (e.metadata?.type === 'trajectory')
  );
  const successfulTrajectories = trajectoryEntries.filter(e =>
    e.metadata?.success === true ||
    (typeof e.value === 'object' && e.value !== null && (e.value as Record<string, unknown>).success === true)
  );

  // Count patterns
  const patternEntries = entries.filter(e =>
    e.key.includes('pattern') ||
    e.metadata?.type === 'pattern' ||
    e.key.startsWith('learned-')
  );

  // Categorize patterns
  const categories: Record<string, number> = {};
  patternEntries.forEach(e => {
    const category = (e.metadata?.category as string) || 'general';
    categories[category] = (categories[category] || 0) + 1;
  });

  // Count routing decisions
  const routingEntries = entries.filter(e =>
    e.key.includes('routing') ||
    e.metadata?.type === 'routing-decision'
  );

  // Calculate average confidence from routing decisions
  let totalConfidence = 0;
  let confidenceCount = 0;
  routingEntries.forEach(e => {
    const confidence = e.metadata?.confidence as number;
    if (typeof confidence === 'number') {
      totalConfidence += confidence;
      confidenceCount++;
    }
  });

  // Calculate total access count
  const totalAccessCount = entries.reduce((sum, e) => sum + (e.accessCount || 0), 0);

  // Calculate memory file size
  let memorySizeBytes = 0;
  try {
    const memPath = getMemoryPath();
    if (existsSync(memPath)) {
      memorySizeBytes = statSync(memPath).size;
    }
  } catch {
    // Ignore
  }

  return {
    trajectories: {
      total: trajectoryEntries.length,
      successful: successfulTrajectories.length,
    },
    patterns: {
      learned: patternEntries.length,
      categories,
    },
    memory: {
      indexSize: entries.length,
      totalAccessCount,
      memorySizeBytes,
    },
    routing: {
      decisions: routingEntries.length,
      avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    },
  };
}

// ── Agent suggester ─────────────────────────────────────────────────

/**
 * Suggest agents for a task — checks the static KEYWORD_PATTERNS
 * catalogue first, then falls back to runtime-learned patterns from
 * successful outcomes, then a default 3-agent fallback.
 */
export function suggestAgentsForTask(task: string): { agents: string[]; confidence: number } {
  const taskLower = task.toLowerCase();

  // Check static keyword patterns first
  for (const [pattern, result] of Object.entries(KEYWORD_PATTERNS)) {
    if (taskLower.includes(pattern)) {
      return result;
    }
  }

  // Check runtime-learned patterns from successful task outcomes
  const taskKeywords = extractKeywords(task);
  if (taskKeywords.length > 0) {
    const outcomes = loadRoutingOutcomes();
    let bestAgent = '';
    let bestOverlap = 0;

    for (const outcome of outcomes) {
      if (!outcome.success || !outcome.agent || !outcome.keywords?.length) continue;
      const overlap = taskKeywords.filter(kw => outcome.keywords.includes(kw)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestAgent = outcome.agent;
      }
    }

    // Require at least 2 keyword overlap to prevent false positives
    if (bestAgent && bestOverlap >= 2) {
      return { agents: [bestAgent], confidence: Math.min(0.6 + bestOverlap * 0.05, 0.85) };
    }
  }

  // Default fallback
  return { agents: ['coder', 'researcher', 'tester'], confidence: 0.7 };
}

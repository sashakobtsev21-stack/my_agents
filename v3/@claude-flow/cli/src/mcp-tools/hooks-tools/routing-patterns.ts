/**
 * Routing outcomes + task patterns for hooks-tools.
 *
 * Extracted from hooks-tools.ts as the first natural cluster — pure
 * logic with no MCP-tool dependencies (just basePath via base-path.ts).
 *
 * Closes the learning loop: post-task records outcomes, route loads
 * them, getMergedTaskPatterns merges the runtime-learned patterns with
 * the static TASK_PATTERNS catalogue below.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { projectRoot } from './base-path.js';

// ── Path resolution ─────────────────────────────────────────────────

// Was: `const ROUTING_OUTCOMES_PATH = join(resolve('.'), ...)` (module-load
// resolution of cwd). Now a lazy getter so basePath overrides work after
// module load (the only way it can work — tests import hooks-tools AFTER
// they set the override).
export function routingOutcomesPath(): string {
  return join(projectRoot(), '.claude-flow/routing-outcomes.json');
}

// ── Keyword extraction ──────────────────────────────────────────────

export const ROUTING_STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','as','into','through','during',
  'before','after','above','below','between','under','again','further','then','once',
  'it','its','this','that','these','those','i','me','my','we','our','you','your',
  'he','she','they','them','and','but','or','nor','not','no','so','if','when','than',
  'very','just','also','only','both','each','all','any','few','more','most','other',
  'some','such','same','new','now','here','there','where','how','what','which','who',
]);

export interface RoutingOutcome {
  task: string;
  agent: string;
  success: boolean;
  quality: number;
  keywords: string[];
  timestamp: string;
}

export function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !ROUTING_STOPWORDS.has(w));
}

// ── Outcome persistence ─────────────────────────────────────────────

export function loadRoutingOutcomes(): RoutingOutcome[] {
  try {
    if (existsSync(routingOutcomesPath())) {
      const data = JSON.parse(readFileSync(routingOutcomesPath(), 'utf-8'));
      return data.outcomes || [];
    }
  } catch { /* corrupt file, start fresh */ }
  return [];
}

export function saveRoutingOutcomes(outcomes: RoutingOutcome[]): void {
  try {
    const dir = dirname(routingOutcomesPath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Cap at 500 entries to bound file size
    const capped = outcomes.slice(-500);
    writeFileSync(routingOutcomesPath(), JSON.stringify({ outcomes: capped }, null, 2));
  } catch { /* non-critical */ }
}

// ── Learned + merged patterns ───────────────────────────────────────

/**
 * Build learned routing patterns from successful task outcomes.
 * Returns patterns in the same shape as TASK_PATTERNS so they can be
 * merged into both the native HNSW and pure-JS semantic routers.
 */
export function loadLearnedPatterns(): Record<string, { keywords: string[]; agents: string[] }> {
  const outcomes = loadRoutingOutcomes();
  const byAgent: Record<string, Set<string>> = {};
  for (const o of outcomes) {
    if (!o.success || !o.agent || !o.keywords?.length) continue;
    if (!byAgent[o.agent]) byAgent[o.agent] = new Set();
    for (const kw of o.keywords) byAgent[o.agent].add(kw);
  }
  const patterns: Record<string, { keywords: string[]; agents: string[] }> = {};
  for (const [agent, kwSet] of Object.entries(byAgent)) {
    patterns[`learned-${agent}`] = {
      keywords: [...kwSet].slice(0, 50),
      agents: [agent],
    };
  }
  return patterns;
}

/**
 * Merge static TASK_PATTERNS with runtime-learned patterns.
 * Static patterns take precedence (learned patterns won't overwrite them).
 */
export function getMergedTaskPatterns(): Record<string, { keywords: string[]; agents: string[] }> {
  const merged = { ...TASK_PATTERNS };
  const learned = loadLearnedPatterns();
  for (const [key, pattern] of Object.entries(learned)) {
    if (!merged[key]) {
      merged[key] = pattern;
    }
  }
  return merged;
}

// ── Static task patterns (used by both native and pure-JS routers) ──

export const TASK_PATTERNS: Record<string, { keywords: string[]; agents: string[] }> = {
  'security-task': {
    keywords: ['authentication', 'security', 'auth', 'password', 'encryption', 'vulnerability', 'cve', 'audit'],
    agents: ['security-architect', 'security-auditor', 'reviewer'],
  },
  'testing-task': {
    keywords: ['test', 'testing', 'spec', 'coverage', 'unit test', 'integration test', 'e2e'],
    agents: ['tester', 'reviewer'],
  },
  'api-task': {
    keywords: ['api', 'endpoint', 'rest', 'graphql', 'route', 'handler', 'controller'],
    agents: ['architect', 'coder', 'tester'],
  },
  'performance-task': {
    keywords: ['performance', 'optimize', 'speed', 'memory', 'benchmark', 'profiling', 'bottleneck'],
    agents: ['performance-engineer', 'coder', 'tester'],
  },
  'refactor-task': {
    keywords: ['refactor', 'restructure', 'clean', 'organize', 'modular', 'decouple'],
    agents: ['architect', 'coder', 'reviewer'],
  },
  'bugfix-task': {
    keywords: ['bug', 'fix', 'error', 'issue', 'broken', 'crash', 'debug'],
    agents: ['coder', 'tester', 'reviewer'],
  },
  'feature-task': {
    keywords: ['feature', 'implement', 'add', 'new', 'create', 'build'],
    agents: ['architect', 'coder', 'tester'],
  },
  'database-task': {
    keywords: ['database', 'sql', 'query', 'schema', 'migration', 'orm'],
    agents: ['architect', 'coder', 'tester'],
  },
  'frontend-task': {
    keywords: ['frontend', 'ui', 'component', 'react', 'css', 'style', 'layout'],
    agents: ['coder', 'reviewer', 'tester'],
  },
  'devops-task': {
    keywords: ['deploy', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'infrastructure'],
    agents: ['devops', 'coder', 'tester'],
  },
  'swarm-task': {
    keywords: ['swarm', 'agent', 'coordinator', 'hive', 'mesh', 'topology'],
    agents: ['swarm-specialist', 'coordinator', 'architect'],
  },
  'memory-task': {
    keywords: ['memory', 'cache', 'store', 'vector', 'embedding', 'persistence'],
    agents: ['memory-specialist', 'architect', 'coder'],
  },
};

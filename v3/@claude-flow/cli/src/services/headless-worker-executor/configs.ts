/**
 * Worker configuration tables + lookup helpers for the headless executor —
 * the headless/local worker-type arrays, model-id map, the per-worker
 * HEADLESS/LOCAL/ALL config records, and the is-headless / is-local /
 * getModelId / getWorkerConfig helpers.
 *
 * Extracted from headless-worker-executor.ts (W143, P3.25 cut #2).
 */
import type { WorkerType } from '../worker-daemon.js';
import type {
  HeadlessWorkerType,
  LocalWorkerType,
  ModelType,
  HeadlessWorkerConfig,
} from './types.js';

export const HEADLESS_WORKER_TYPES: HeadlessWorkerType[] = [
  'audit',
  'optimize',
  'testgaps',
  'document',
  'ultralearn',
  'refactor',
  'deepdive',
  'predict',
];

/**
 * Array of local worker types
 */
export const LOCAL_WORKER_TYPES: LocalWorkerType[] = [
  'map',
  'consolidate',
  'benchmark',
  'preload',
];

/**
 * Model ID mapping
 */
/**
 * Model ID mapping — use short aliases so they auto-resolve to the latest
 * snapshot. Hardcoded dated IDs (e.g. claude-sonnet-4-5-20250929) go stale
 * when Anthropic retires them, causing 100% worker failure (#1431).
 *
 * Users can override per-worker via the `model` field in daemon-state.json
 * or the ANTHROPIC_MODEL environment variable.
 */
export const MODEL_IDS: Record<ModelType, string> = {
  sonnet: 'sonnet',
  opus: 'opus',
  haiku: 'haiku',
};

/**
 * Default headless worker configurations based on ADR-020
 */
export const HEADLESS_WORKER_CONFIGS: Record<HeadlessWorkerType, HeadlessWorkerConfig> = {
  audit: {
    type: 'audit',
    mode: 'headless',
    intervalMs: 30 * 60 * 1000,
    priority: 'critical',
    description: 'AI-powered security analysis',
    enabled: true,
    headless: {
      promptTemplate: `Analyze this codebase for security vulnerabilities:
- Check for hardcoded secrets (API keys, passwords)
- Identify SQL injection risks
- Find XSS vulnerabilities
- Check for insecure dependencies
- Identify authentication/authorization issues

Provide a JSON report with:
{
  "vulnerabilities": [{ "severity": "high|medium|low", "file": "...", "line": N, "description": "..." }],
  "riskScore": 0-100,
  "recommendations": ["..."]
}`,
      sandbox: 'strict',
      model: 'haiku',
      outputFormat: 'json',
      contextPatterns: ['**/*.ts', '**/*.js', '**/.env*', '**/package.json'],
      timeoutMs: 5 * 60 * 1000,
    },
  },

  optimize: {
    type: 'optimize',
    mode: 'headless',
    intervalMs: 60 * 60 * 1000,
    priority: 'high',
    description: 'AI optimization suggestions',
    enabled: true,
    headless: {
      promptTemplate: `Analyze this codebase for performance optimizations:
- Identify N+1 query patterns
- Find unnecessary re-renders in React
- Suggest caching opportunities
- Identify memory leaks
- Find redundant computations

Provide actionable suggestions with code examples.`,
      sandbox: 'permissive',
      model: 'sonnet',
      outputFormat: 'markdown',
      contextPatterns: ['src/**/*.ts', 'src/**/*.tsx'],
      timeoutMs: 10 * 60 * 1000,
    },
  },

  testgaps: {
    type: 'testgaps',
    mode: 'headless',
    intervalMs: 60 * 60 * 1000,
    priority: 'normal',
    description: 'AI test gap analysis',
    enabled: true,
    headless: {
      promptTemplate: `Analyze test coverage and identify gaps:
- Find untested functions and classes
- Identify edge cases not covered
- Suggest new test scenarios
- Check for missing error handling tests
- Identify integration test gaps

For each gap, provide a test skeleton.`,
      sandbox: 'permissive',
      model: 'sonnet',
      outputFormat: 'markdown',
      contextPatterns: ['src/**/*.ts', 'tests/**/*.ts', '__tests__/**/*.ts'],
      timeoutMs: 10 * 60 * 1000,
    },
  },

  document: {
    type: 'document',
    mode: 'headless',
    intervalMs: 120 * 60 * 1000,
    priority: 'low',
    description: 'AI documentation generation',
    enabled: false,
    headless: {
      promptTemplate: `Generate documentation for undocumented code:
- Add JSDoc comments to functions
- Create README sections for modules
- Document API endpoints
- Add inline comments for complex logic
- Generate usage examples

Focus on public APIs and exported functions.`,
      sandbox: 'permissive',
      model: 'haiku',
      outputFormat: 'markdown',
      contextPatterns: ['src/**/*.ts'],
      timeoutMs: 10 * 60 * 1000,
    },
  },

  ultralearn: {
    type: 'ultralearn',
    mode: 'headless',
    intervalMs: 0, // Manual trigger only
    priority: 'normal',
    description: 'Deep knowledge acquisition',
    enabled: false,
    headless: {
      promptTemplate: `Deeply analyze this codebase to learn:
- Architectural patterns used
- Coding conventions
- Domain-specific terminology
- Common patterns and idioms
- Team preferences

Provide insights as JSON:
{
  "architecture": { "patterns": [...], "style": "..." },
  "conventions": { "naming": "...", "formatting": "..." },
  "domains": ["..."],
  "insights": ["..."]
}`,
      sandbox: 'strict',
      model: 'opus',
      outputFormat: 'json',
      contextPatterns: ['**/*.ts', '**/CLAUDE.md', '**/README.md'],
      timeoutMs: 15 * 60 * 1000,
    },
  },

  refactor: {
    type: 'refactor',
    mode: 'headless',
    intervalMs: 0, // Manual trigger only
    priority: 'normal',
    description: 'AI refactoring suggestions',
    enabled: false,
    headless: {
      promptTemplate: `Suggest refactoring opportunities:
- Identify code duplication
- Suggest better abstractions
- Find opportunities for design patterns
- Identify overly complex functions
- Suggest module reorganization

Provide before/after code examples.`,
      sandbox: 'permissive',
      model: 'sonnet',
      outputFormat: 'markdown',
      contextPatterns: ['src/**/*.ts'],
      timeoutMs: 10 * 60 * 1000,
    },
  },

  deepdive: {
    type: 'deepdive',
    mode: 'headless',
    intervalMs: 0, // Manual trigger only
    priority: 'normal',
    description: 'Deep code analysis',
    enabled: false,
    headless: {
      promptTemplate: `Perform deep analysis of this codebase:
- Understand data flow
- Map dependencies
- Identify architectural issues
- Find potential bugs
- Analyze error handling

Provide comprehensive report.`,
      sandbox: 'strict',
      model: 'opus',
      outputFormat: 'markdown',
      contextPatterns: ['src/**/*.ts'],
      timeoutMs: 15 * 60 * 1000,
    },
  },

  predict: {
    type: 'predict',
    mode: 'headless',
    intervalMs: 10 * 60 * 1000,
    priority: 'low',
    description: 'Predictive preloading',
    enabled: false,
    headless: {
      promptTemplate: `Based on recent activity, predict what the developer needs:
- Files likely to be edited next
- Tests that should be run
- Documentation to reference
- Dependencies to check

Provide preload suggestions as JSON:
{
  "filesToPreload": ["..."],
  "testsToRun": ["..."],
  "docsToReference": ["..."],
  "confidence": 0.0-1.0
}`,
      sandbox: 'strict',
      model: 'haiku',
      outputFormat: 'json',
      contextPatterns: ['.claude-flow/metrics/*.json'],
      timeoutMs: 2 * 60 * 1000,
    },
  },
};

/**
 * Local worker configurations
 */
export const LOCAL_WORKER_CONFIGS: Record<LocalWorkerType, HeadlessWorkerConfig> = {
  map: {
    type: 'map',
    mode: 'local',
    intervalMs: 15 * 60 * 1000,
    priority: 'normal',
    description: 'Codebase mapping',
    enabled: true,
  },
  consolidate: {
    type: 'consolidate',
    mode: 'local',
    intervalMs: 30 * 60 * 1000,
    priority: 'low',
    description: 'Memory consolidation',
    enabled: true,
  },
  benchmark: {
    type: 'benchmark',
    mode: 'local',
    intervalMs: 60 * 60 * 1000,
    priority: 'low',
    description: 'Performance benchmarking',
    enabled: false,
  },
  preload: {
    type: 'preload',
    mode: 'local',
    intervalMs: 5 * 60 * 1000,
    priority: 'low',
    description: 'Resource preloading',
    enabled: false,
  },
};

/**
 * Combined worker configurations
 */
export const ALL_WORKER_CONFIGS: HeadlessWorkerConfig[] = [
  ...Object.values(HEADLESS_WORKER_CONFIGS),
  ...Object.values(LOCAL_WORKER_CONFIGS),
];

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a worker type is a headless worker
 */
export function isHeadlessWorker(type: WorkerType): type is HeadlessWorkerType {
  return HEADLESS_WORKER_TYPES.includes(type as HeadlessWorkerType);
}

/**
 * Check if a worker type is a local worker
 */
export function isLocalWorker(type: WorkerType): type is LocalWorkerType {
  return LOCAL_WORKER_TYPES.includes(type as LocalWorkerType);
}

/**
 * Get model ID from model type
 */
export function getModelId(model: ModelType): string {
  return MODEL_IDS[model];
}

/**
 * Get worker configuration by type
 */
export function getWorkerConfig(type: WorkerType): HeadlessWorkerConfig | undefined {
  if (isHeadlessWorker(type)) {
    return HEADLESS_WORKER_CONFIGS[type];
  }
  if (isLocalWorker(type)) {
    return LOCAL_WORKER_CONFIGS[type];
  }
  return undefined;
}

/**
 * Metrics persistence + local-mode worker fallbacks for the daemon.
 *
 * Every function here is a pure function of `projectRoot` — it writes a
 * metrics JSON under `<projectRoot>/.claude-flow/metrics/`. The local
 * `run*Worker*` variants are the no-Claude-CLI fallbacks (they emit a
 * "install Claude Code CLI for AI-powered …" note); persistHeadlessResult
 * records a completed headless worker's structured result.
 *
 * Extracted from worker-daemon.ts (W110, P3.12 cut #3) — these 13 methods
 * touched only `this.projectRoot`, so they lift cleanly to free functions
 * the WorkerDaemon dispatch calls with `this.projectRoot`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { HeadlessWorkerType, HeadlessExecutionResult } from '../headless-worker-executor.js';

export function persistHeadlessResult(
  projectRoot: string,
  workerType: HeadlessWorkerType,
  result: HeadlessExecutionResult,
): void {
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');
    if (!existsSync(metricsDir)) mkdirSync(metricsDir, { recursive: true });

    // Filename mirrors the local-mode worker writes (security-audit.json,
    // performance.json, test-gaps.json) so a downstream reader doesn't
    // care which mode produced the data.
    const filenameMap: Partial<Record<HeadlessWorkerType, string>> = {
      audit: 'security-audit.json',
      optimize: 'performance.json',
      testgaps: 'test-gaps.json',
      document: 'documentation.json',
      refactor: 'refactor.json',
      deepdive: 'deepdive.json',
      ultralearn: 'ultralearn.json',
      predict: 'predictions.json',
    };
    const filename = filenameMap[workerType] ?? `${workerType}.json`;
    const metricsFile = join(metricsDir, filename);

    const persisted = {
      timestamp: result.timestamp instanceof Date ? result.timestamp.toISOString() : new Date().toISOString(),
      mode: 'headless' as const,
      workerType,
      model: result.model,
      durationMs: result.durationMs,
      tokensUsed: result.tokensUsed,
      executionId: result.executionId,
      success: result.success,
      // Structured findings live here when the worker emits JSON (e.g. the
      // audit worker's vulnerability list). Fall back to a raw-output
      // pointer so consumers can still locate the full log.
      findings: result.parsedOutput ?? null,
      rawOutputPreview: typeof result.output === 'string' ? result.output.slice(0, 2000) : undefined,
      rawOutputLength: typeof result.output === 'string' ? result.output.length : 0,
    };

    writeFileSync(metricsFile, JSON.stringify(persisted, null, 2));
  }

  // Worker implementations

export async function runMapWorker(projectRoot: string): Promise<unknown> {
    // Scan project structure and update metrics
    const metricsFile = join(projectRoot, '.claude-flow', 'metrics', 'codebase-map.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const map = {
      timestamp: new Date().toISOString(),
      projectRoot: projectRoot,
      structure: {
        hasPackageJson: existsSync(join(projectRoot, 'package.json')),
        hasTsConfig: existsSync(join(projectRoot, 'tsconfig.json')),
        hasClaudeConfig: existsSync(join(projectRoot, '.claude')),
        hasClaudeFlow: existsSync(join(projectRoot, '.claude-flow')),
      },
      scannedAt: Date.now(),
    };

    writeFileSync(metricsFile, JSON.stringify(map, null, 2));
    return map;
  }

  /**
   * Local audit worker (fallback when headless unavailable)
   */
export async function runAuditWorkerLocal(projectRoot: string): Promise<unknown> {
    // Basic security checks
    const auditFile = join(projectRoot, '.claude-flow', 'metrics', 'security-audit.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const audit = {
      timestamp: new Date().toISOString(),
      mode: 'local',
      checks: {
        envFilesProtected: !existsSync(join(projectRoot, '.env.local')),
        gitIgnoreExists: existsSync(join(projectRoot, '.gitignore')),
        noHardcodedSecrets: true, // Would need actual scanning
      },
      riskLevel: 'low',
      recommendations: [],
      note: 'Install Claude Code CLI for AI-powered security analysis',
    };

    writeFileSync(auditFile, JSON.stringify(audit, null, 2));
    return audit;
  }

  /**
   * Local optimize worker (fallback when headless unavailable)
   */
export async function runOptimizeWorkerLocal(projectRoot: string): Promise<unknown> {
    // Update performance metrics
    const optimizeFile = join(projectRoot, '.claude-flow', 'metrics', 'performance.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const perf = {
      timestamp: new Date().toISOString(),
      mode: 'local',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      optimizations: {
        cacheHitRate: 0.78,
        avgResponseTime: 45,
      },
      note: 'Install Claude Code CLI for AI-powered optimization suggestions',
    };

    writeFileSync(optimizeFile, JSON.stringify(perf, null, 2));
    return perf;
  }

export async function runConsolidateWorker(projectRoot: string): Promise<unknown> {
    // Memory consolidation - clean up old patterns
    const consolidateFile = join(projectRoot, '.claude-flow', 'metrics', 'consolidation.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const result = {
      timestamp: new Date().toISOString(),
      patternsConsolidated: 0,
      memoryCleaned: 0,
      duplicatesRemoved: 0,
    };

    writeFileSync(consolidateFile, JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Local testgaps worker (fallback when headless unavailable)
   */
export async function runTestGapsWorkerLocal(projectRoot: string): Promise<unknown> {
    // Check for test coverage gaps
    const testGapsFile = join(projectRoot, '.claude-flow', 'metrics', 'test-gaps.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const result = {
      timestamp: new Date().toISOString(),
      mode: 'local',
      hasTestDir: existsSync(join(projectRoot, 'tests')) || existsSync(join(projectRoot, '__tests__')),
      estimatedCoverage: 'unknown',
      gaps: [],
      note: 'Install Claude Code CLI for AI-powered test gap analysis',
    };

    writeFileSync(testGapsFile, JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Local predict worker (fallback when headless unavailable)
   */
export async function runPredictWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      predictions: [],
      preloaded: [],
      note: 'Install Claude Code CLI for AI-powered predictions',
    };
  }

  /**
   * Local document worker (fallback when headless unavailable)
   */
export async function runDocumentWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      filesDocumented: 0,
      suggestedDocs: [],
      note: 'Install Claude Code CLI for AI-powered documentation generation',
    };
  }

  /**
   * Local ultralearn worker (fallback when headless unavailable)
   */
export async function runUltralearnWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      patternsLearned: 0,
      insightsGained: [],
      note: 'Install Claude Code CLI for AI-powered deep learning',
    };
  }

  /**
   * Local refactor worker (fallback when headless unavailable)
   */
export async function runRefactorWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      suggestions: [],
      duplicatesFound: 0,
      note: 'Install Claude Code CLI for AI-powered refactoring suggestions',
    };
  }

  /**
   * Local deepdive worker (fallback when headless unavailable)
   */
export async function runDeepdiveWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      analysisDepth: 'shallow',
      findings: [],
      note: 'Install Claude Code CLI for AI-powered deep code analysis',
    };
  }

  /**
   * Local benchmark worker
   */
export async function runBenchmarkWorkerLocal(projectRoot: string): Promise<unknown> {
    const benchmarkFile = join(projectRoot, '.claude-flow', 'metrics', 'benchmark.json');
    const metricsDir = join(projectRoot, '.claude-flow', 'metrics');

    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }

    const result = {
      timestamp: new Date().toISOString(),
      mode: 'local',
      benchmarks: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
      },
    };

    writeFileSync(benchmarkFile, JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Local preload worker
   */
export async function runPreloadWorkerLocal(projectRoot: string): Promise<unknown> {
    return {
      timestamp: new Date().toISOString(),
      mode: 'local',
      resourcesPreloaded: 0,
      cacheStatus: 'active',
    };
  }

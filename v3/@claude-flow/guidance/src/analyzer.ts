/**
 * CLAUDE.md Analyzer & Auto-Optimizer
 *
 * Quantifiable, verifiable analysis of CLAUDE.md files.
 * Measures structure quality, coverage, enforceability, and produces
 * a numeric score (0-100) that can be tracked over time.
 *
 * The auto-optimizer takes analysis results and produces a concrete
 * list of changes that would improve the score. Changes can be applied
 * programmatically and the score re-measured to verify improvement.
 *
 * @module @claude-flow/guidance/analyzer
 */

import { createHash } from 'node:crypto';
import { createCompiler } from './compiler.js';
import { createGates } from './gates.js';
import { createProofChain } from './proof.js';
import type { ProofEnvelope } from './proof.js';
import type { RunEvent, TaskIntent } from './types.js';
// Analyzer type definitions + size budgets moved to ./analyzer/types.ts
// (W111, P3.13 cut #1; in a subdir to avoid clashing with ./types.js).
// Imported for internal use + re-exported so external `import { … }
// from '.../analyzer.js'` callers keep resolving byte-identically.
import type {
  DimensionScore,
  AnalysisResult,
  AnalysisMetrics,
  Suggestion,
  BenchmarkResult,
  DimensionDelta,
  OptimizeOptions,
  HeadlessBenchmarkResult,
  HeadlessTaskResult,
  IHeadlessExecutor,
  IContentAwareExecutor,
} from './analyzer/types.js';
import { SIZE_BUDGETS, isContentAwareExecutor } from './analyzer/types.js';
import { DefaultHeadlessExecutor } from './analyzer/default-executor.js';
export type {
  DimensionScore,
  AnalysisResult,
  AnalysisMetrics,
  Suggestion,
  BenchmarkResult,
  ContextSize,
  OptimizeOptions,
  HeadlessBenchmarkResult,
  HeadlessTaskResult,
  IHeadlessExecutor,
  IContentAwareExecutor,
} from './analyzer/types.js';
// Metric extraction + the 6 dimension scorers moved to ./analyzer/
// scoring.ts (W112, P3.13 cut #2); analyze() composes them below.
import {
  extractMetrics,
  scoreStructure,
  scoreCoverage,
  scoreEnforceability,
  scoreCompilability,
  scoreClarity,
  scoreCompleteness,
} from './analyzer/scoring.js';
// Restructuring transforms (used by optimizeForSize / autoOptimize) moved
// to ./analyzer/optimize-transforms.ts (W113, P3.13 cut #3).
import {
  extractRulesFromProse,
  splitOversizedSections,
  trimConstitution,
  trimCodeBlocks,
  removeDuplicateRules,
  trimToLineCount,
} from './analyzer/optimize-transforms.js';
// Empirical validation suite moved to ./analyzer/validation.ts (W114,
// P3.13 cut #4); validateEffect() composes these. Interfaces re-exported
// for byte-identical public API.
import {
  getValidationTasks,
  evaluateAssertion,
  runValidationTasks,
  runAveragedTrials,
  computeAdherence,
  computeCorrelation,
  formatValidationReport,
} from './analyzer/validation.js';
import type {
  ValidationAssertion,
  ValidationTask,
  ValidationTaskResult,
  ValidationRun,
  CorrelationResult,
  ValidationReport,
} from './analyzer/validation.js';
export type {
  ValidationAssertion,
  ValidationTask,
  ValidationTaskResult,
  ValidationRun,
  CorrelationResult,
  ValidationReport,
} from './analyzer/validation.js';

export function analyze(content: string, localContent?: string): AnalysisResult {
  const metrics = extractMetrics(content);
  const dimensions: DimensionScore[] = [];

  // 1. Structure (20%)
  dimensions.push(scoreStructure(metrics, content));

  // 2. Coverage (20%)
  dimensions.push(scoreCoverage(metrics, content));

  // 3. Enforceability (25%)
  dimensions.push(scoreEnforceability(metrics, content));

  // 4. Compilability (15%)
  dimensions.push(scoreCompilability(content, localContent));

  // 5. Clarity (10%)
  dimensions.push(scoreClarity(metrics, content));

  // 6. Completeness (10%)
  dimensions.push(scoreCompleteness(metrics, content));

  // Composite
  const compositeScore = Math.round(
    dimensions.reduce((sum, d) => sum + (d.score / d.max) * d.weight * 100, 0)
  );

  // Grade
  const grade = compositeScore >= 90 ? 'A' :
                compositeScore >= 80 ? 'B' :
                compositeScore >= 70 ? 'C' :
                compositeScore >= 60 ? 'D' : 'F';

  // Suggestions
  const suggestions = generateSuggestions(dimensions, metrics, content);

  return {
    compositeScore,
    grade,
    dimensions,
    metrics,
    suggestions,
    analyzedAt: Date.now(),
  };
}

/**
 * Run a before/after benchmark.
 * Returns the delta and per-dimension changes.
 */
export function benchmark(before: string, after: string, localContent?: string): BenchmarkResult {
  const beforeResult = analyze(before, localContent);
  const afterResult = analyze(after, localContent);

  const improvements: DimensionDelta[] = [];
  const regressions: DimensionDelta[] = [];

  for (let i = 0; i < beforeResult.dimensions.length; i++) {
    const b = beforeResult.dimensions[i];
    const a = afterResult.dimensions[i];
    const delta = a.score - b.score;

    const entry = { dimension: b.name, before: b.score, after: a.score, delta };
    if (delta > 0) improvements.push(entry);
    else if (delta < 0) regressions.push(entry);
  }

  return {
    before: beforeResult,
    after: afterResult,
    delta: afterResult.compositeScore - beforeResult.compositeScore,
    improvements,
    regressions,
  };
}

/**
 * Auto-optimize a CLAUDE.md file by applying high-priority suggestions.
 * Returns the optimized content and the benchmark result.
 */
export function autoOptimize(
  content: string,
  localContent?: string,
  maxIterations = 3,
): { optimized: string; benchmark: BenchmarkResult; appliedSuggestions: Suggestion[] } {
  let current = content;
  const applied: Suggestion[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const result = analyze(current, localContent);

    // Get high-priority suggestions with patches
    const actionable = result.suggestions
      .filter(s => s.priority === 'high' && s.patch)
      .sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);

    if (actionable.length === 0) break;

    // Apply top suggestion
    const suggestion = actionable[0];
    if (suggestion.action === 'add' && suggestion.patch) {
      current = current.trimEnd() + '\n\n' + suggestion.patch + '\n';
      applied.push(suggestion);
    } else if (suggestion.action === 'strengthen' && suggestion.patch) {
      current = current.trimEnd() + '\n\n' + suggestion.patch + '\n';
      applied.push(suggestion);
    }
  }

  const benchmarkResult = benchmark(content, current, localContent);

  return {
    optimized: current,
    benchmark: benchmarkResult,
    appliedSuggestions: applied,
  };
}

/**
 * Context-size-aware optimization that restructures content to reach 90%+.
 *
 * Unlike autoOptimize (which only appends), this function:
 * 1. Splits oversized sections into subsections
 * 2. Extracts enforcement prose into list-format rules
 * 3. Trims the constitution to budget
 * 4. Removes redundant content
 * 5. Adds missing coverage sections
 * 6. Applies iterative patch suggestions
 *
 * @param content - CLAUDE.md content
 * @param options - Optimization options with contextSize and targetScore
 * @returns Optimized content, benchmark, and proof chain
 */
export function optimizeForSize(
  content: string,
  options: OptimizeOptions = {},
): { optimized: string; benchmark: BenchmarkResult; appliedSteps: string[]; proof: ProofEnvelope[] } {
  const {
    contextSize = 'standard',
    localContent,
    maxIterations = 10,
    targetScore = 90,
    proofKey,
  } = options;

  const budget = SIZE_BUDGETS[contextSize];
  const steps: string[] = [];
  let current = content;

  // Set up proof chain if key provided
  const chain = proofKey ? createProofChain({ signingKey: proofKey }) : null;
  const proofEnvelopes: ProofEnvelope[] = [];

  function recordProof(step: string, _before: string, _after: string): void {
    if (!chain) return;
    const event: RunEvent = {
      eventId: `opt-${steps.length}`,
      taskId: 'claude-md-optimization',
      intent: 'feature' as TaskIntent,
      guidanceHash: 'analyzer',
      retrievedRuleIds: [],
      toolsUsed: ['analyzer.optimizeForSize'],
      filesTouched: ['CLAUDE.md'],
      diffSummary: { linesAdded: 0, linesRemoved: 0, filesChanged: 1 },
      testResults: { ran: false, passed: 0, failed: 0, skipped: 0 },
      violations: [],
      outcomeAccepted: true,
      reworkLines: 0,
      timestamp: Date.now(),
      durationMs: 0,
    };
    const envelope = chain.append(event, [], []);
    proofEnvelopes.push(envelope);
  }

  // ── Step 1: Extract enforcement prose into bullet-point rules ──────────
  const beforeRuleExtract = current;
  current = extractRulesFromProse(current);
  if (current !== beforeRuleExtract) {
    steps.push('Extracted enforcement statements from prose into bullet-point rules');
    recordProof('rule-extraction', beforeRuleExtract, current);
  }

  // ── Step 2: Split oversized sections ──────────────────────────────────
  const beforeSplit = current;
  current = splitOversizedSections(current, budget.maxSectionLines);
  if (current !== beforeSplit) {
    steps.push(`Split sections exceeding ${budget.maxSectionLines} lines`);
    recordProof('section-split', beforeSplit, current);
  }

  // ── Step 3: Trim constitution to budget ───────────────────────────────
  const beforeConst = current;
  current = trimConstitution(current, budget.maxConstitutionLines);
  if (current !== beforeConst) {
    steps.push(`Trimmed constitution to ${budget.maxConstitutionLines} lines`);
    recordProof('constitution-trim', beforeConst, current);
  }

  // ── Step 4: Trim code blocks if over budget ───────────────────────────
  if (contextSize === 'compact') {
    const beforeCodeTrim = current;
    current = trimCodeBlocks(current, budget.maxCodeBlocks);
    if (current !== beforeCodeTrim) {
      steps.push(`Trimmed code blocks to max ${budget.maxCodeBlocks}`);
      recordProof('code-block-trim', beforeCodeTrim, current);
    }
  }

  // ── Step 5: Remove duplicate/redundant content ────────────────────────
  const beforeDedup = current;
  current = removeDuplicateRules(current);
  if (current !== beforeDedup) {
    steps.push('Removed duplicate rules');
    recordProof('dedup', beforeDedup, current);
  }

  // ── Step 6: Apply iterative patch suggestions ─────────────────────────
  for (let i = 0; i < maxIterations; i++) {
    const result = analyze(current, localContent);
    if (result.compositeScore >= targetScore) break;

    const actionable = result.suggestions
      .filter(s => s.patch && (s.priority === 'high' || s.priority === 'medium'))
      .sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);

    if (actionable.length === 0) break;

    const suggestion = actionable[0];
    if (suggestion.patch) {
      const beforePatch = current;
      current = current.trimEnd() + '\n\n' + suggestion.patch + '\n';
      steps.push(`Applied: ${suggestion.description}`);
      recordProof(`patch-${i}`, beforePatch, current);
    }
  }

  // ── Step 7: Trim to max lines if over budget ──────────────────────────
  const lines = current.split('\n');
  if (lines.length > budget.maxLines) {
    const beforeTrim = current;
    current = trimToLineCount(current, budget.maxLines);
    steps.push(`Trimmed to ${budget.maxLines} lines (${contextSize} budget)`);
    recordProof('line-trim', beforeTrim, current);
  }

  const benchmarkResult = benchmark(content, current, localContent);

  return {
    optimized: current,
    benchmark: benchmarkResult,
    appliedSteps: steps,
    proof: proofEnvelopes,
  };
}

/**
 * Run a headless benchmark using `claude -p` to measure actual agent
 * compliance before and after optimization.
 *
 * Requires `claude` CLI to be installed. Uses the proof chain to create
 * tamper-evident records of each test run.
 *
 * @param originalContent - Original CLAUDE.md
 * @param optimizedContent - Optimized CLAUDE.md
 * @param options - Options including proof key and executor
 */

// The headless-benchmark runner and the suggestion generator were
// extracted into ./analyzer/headless-benchmark.ts and
// ./analyzer/suggestions.ts during campaign-2 wave 23 (W229).
export { headlessBenchmark } from './analyzer/headless-benchmark.js';
import { generateSuggestions } from './analyzer/suggestions.js';

export function formatReport(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push(`CLAUDE.md Analysis Report`);
  lines.push(`========================`);
  lines.push(``);
  lines.push(`Composite Score: ${result.compositeScore}/100 (${result.grade})`);
  lines.push(``);

  lines.push(`Dimensions:`);
  for (const d of result.dimensions) {
    const bar = '█'.repeat(Math.round(d.score / 5)) + '░'.repeat(20 - Math.round(d.score / 5));
    lines.push(`  ${d.name.padEnd(16)} ${bar} ${d.score}/${d.max} (${d.weight * 100}%)`);
  }
  lines.push(``);

  lines.push(`Metrics:`);
  lines.push(`  Lines: ${result.metrics.totalLines} (${result.metrics.contentLines} content)`);
  lines.push(`  Sections: ${result.metrics.sectionCount}`);
  lines.push(`  Rules: ${result.metrics.ruleCount}`);
  lines.push(`  Enforcement statements: ${result.metrics.enforcementStatements}`);
  lines.push(`  Estimated shards: ${result.metrics.estimatedShards}`);
  lines.push(`  Code blocks: ${result.metrics.codeBlockCount}`);
  lines.push(``);

  if (result.suggestions.length > 0) {
    lines.push(`Suggestions (${result.suggestions.length}):`);
    for (const s of result.suggestions.slice(0, 10)) {
      const icon = s.priority === 'high' ? '[!]' : s.priority === 'medium' ? '[~]' : '[ ]';
      lines.push(`  ${icon} ${s.description} (+${s.estimatedImprovement} pts)`);
    }
  }

  return lines.join('\n');
}

/**
 * Format benchmark result as a comparison table.
 */
export function formatBenchmark(result: BenchmarkResult): string {
  const lines: string[] = [];

  lines.push(`Before/After Benchmark`);
  lines.push(`======================`);
  lines.push(``);
  lines.push(`Score: ${result.before.compositeScore} → ${result.after.compositeScore} (${result.delta >= 0 ? '+' : ''}${result.delta})`);
  lines.push(`Grade: ${result.before.grade} → ${result.after.grade}`);
  lines.push(``);

  if (result.improvements.length > 0) {
    lines.push(`Improvements:`);
    for (const d of result.improvements) {
      lines.push(`  ${d.dimension}: ${d.before} → ${d.after} (+${d.delta})`);
    }
  }

  if (result.regressions.length > 0) {
    lines.push(`Regressions:`);
    for (const d of result.regressions) {
      lines.push(`  ${d.dimension}: ${d.before} → ${d.after} (${d.delta})`);
    }
  }

  return lines.join('\n');
}


// ============================================================================
// Suggestion Generation
// ============================================================================


export async function validateEffect(
  originalContent: string,
  optimizedContent: string,
  options: {
    executor?: IHeadlessExecutor;
    tasks?: ValidationTask[];
    proofKey?: string;
    workDir?: string;
    /** Number of trials per phase (default 1). Higher values average out noise. */
    trials?: number;
  } = {},
): Promise<ValidationReport> {
  const {
    executor = new DefaultHeadlessExecutor(),
    tasks = getValidationTasks(),
    proofKey,
    workDir = process.cwd(),
    trials = 1,
  } = options;

  const trialCount = Math.max(1, Math.round(trials));
  const contentAware = isContentAwareExecutor(executor);

  const chain = proofKey ? createProofChain({ signingKey: proofKey }) : null;
  const proofEnvelopes: ProofEnvelope[] = [];

  // ── Run before ───────────────────────────────────────────────────────
  if (contentAware) executor.setContext(originalContent);

  const beforeAnalysis = analyze(originalContent);
  let beforeResults: ValidationTaskResult[];

  if (trialCount === 1) {
    beforeResults = await runValidationTasks(executor, tasks, workDir);
  } else {
    beforeResults = await runAveragedTrials(executor, tasks, workDir, trialCount);
  }
  const beforeAdherence = computeAdherence(tasks, beforeResults);

  const beforeRun: ValidationRun = {
    analysis: beforeAnalysis,
    taskResults: beforeResults,
    adherenceRate: beforeAdherence.overall,
    dimensionAdherence: beforeAdherence.byDimension,
    timestamp: Date.now(),
  };

  // ── Run after ────────────────────────────────────────────────────────
  if (contentAware) executor.setContext(optimizedContent);

  const afterAnalysis = analyze(optimizedContent);
  let afterResults: ValidationTaskResult[];

  if (trialCount === 1) {
    afterResults = await runValidationTasks(executor, tasks, workDir);
  } else {
    afterResults = await runAveragedTrials(executor, tasks, workDir, trialCount);
  }
  const afterAdherence = computeAdherence(tasks, afterResults);

  const afterRun: ValidationRun = {
    analysis: afterAnalysis,
    taskResults: afterResults,
    adherenceRate: afterAdherence.overall,
    dimensionAdherence: afterAdherence.byDimension,
    timestamp: Date.now(),
  };

  // ── Correlation ──────────────────────────────────────────────────────
  const correlation = computeCorrelation(beforeRun, afterRun);

  // ── Proof ────────────────────────────────────────────────────────────
  if (chain) {
    const event: RunEvent = {
      eventId: 'validation-run',
      taskId: 'empirical-validation',
      intent: 'testing' as TaskIntent,
      guidanceHash: 'analyzer-validation',
      retrievedRuleIds: [],
      toolsUsed: ['claude -p', 'analyzer.validateEffect'],
      filesTouched: ['CLAUDE.md'],
      diffSummary: { linesAdded: 0, linesRemoved: 0, filesChanged: 0 },
      testResults: {
        ran: true,
        passed: afterResults.filter(r => r.passed).length,
        failed: afterResults.filter(r => !r.passed).length,
        skipped: 0,
      },
      violations: [],
      outcomeAccepted: true,
      reworkLines: 0,
      timestamp: Date.now(),
      durationMs: 0,
    };
    const envelope = chain.append(event, [], []);
    proofEnvelopes.push(envelope);
  }

  // ── Build report ─────────────────────────────────────────────────────
  const report: ValidationReport = {
    before: beforeRun,
    after: afterRun,
    correlation,
    proofChain: proofEnvelopes,
    report: '',
  };
  report.report = formatValidationReport(report);

  return report;
}


// ============================================================================
// A/B Benchmark Harness moved to ./analyzer/ab-benchmark.ts (W115, P3.13
// cut #5). Re-exported so external `import { abBenchmark, ABReport, … }
// from '.../analyzer.js'` callers keep resolving byte-identically.
// ============================================================================
export { abBenchmark, getDefaultABTasks } from './analyzer/ab-benchmark.js';
export type {
  ABTask,
  ABTaskClass,
  ABGatePattern,
  ABTaskResult,
  ABMetrics,
  ABReport,
} from './analyzer/ab-benchmark.js';

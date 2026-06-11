/**
 * Analyzer — suggestion generation
 *
 * generateSuggestions: the per-dimension improvement suggestions.
 * Extracted verbatim from analyzer.ts (lines 634-788) during campaign-2
 * wave 23 (W229). Module-private pre-split; NOT re-exported.
 */

import type {
  AnalysisMetrics,
  DimensionScore,
  Suggestion,
} from './types.js';

export function generateSuggestions(
  dimensions: DimensionScore[],
  metrics: AnalysisMetrics,
  content: string,
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Structure suggestions
  if (!metrics.hasSecuritySection) {
    suggestions.push({
      action: 'add',
      priority: 'high',
      dimension: 'Coverage',
      description: 'Add a Security section with concrete rules',
      estimatedImprovement: 8,
      patch: [
        '## Security',
        '',
        '- Never commit secrets, API keys, or credentials to git',
        '- Never run destructive commands without explicit confirmation',
        '- Validate all external input at system boundaries',
        '- Use parameterized queries for database operations',
      ].join('\n'),
    });
  }

  if (!metrics.hasArchitectureSection) {
    suggestions.push({
      action: 'add',
      priority: 'high',
      dimension: 'Coverage',
      description: 'Add an Architecture/Structure section',
      estimatedImprovement: 6,
      patch: [
        '## Project Structure',
        '',
        '- `src/` — Source code',
        '- `tests/` — Test files',
        '- `docs/` — Documentation',
      ].join('\n'),
    });
  }

  if (!metrics.hasBuildCommand) {
    suggestions.push({
      action: 'add',
      priority: 'high',
      dimension: 'Coverage',
      description: 'Add Build & Test commands',
      estimatedImprovement: 6,
      patch: [
        '## Build & Test',
        '',
        'Build: `npm run build`',
        'Test: `npm test`',
        '',
        'Run tests before committing. Run the build to catch type errors.',
      ].join('\n'),
    });
  }

  if (metrics.enforcementStatements < 3) {
    suggestions.push({
      action: 'strengthen',
      priority: 'high',
      dimension: 'Enforceability',
      description: 'Add NEVER/ALWAYS enforcement statements',
      estimatedImprovement: 8,
      patch: [
        '## Enforcement Rules',
        '',
        '- NEVER commit files containing secrets or API keys',
        '- NEVER use `any` type (use `unknown` instead)',
        '- ALWAYS run tests before committing',
        '- ALWAYS handle errors explicitly (no silent catches)',
        '- MUST include error messages in all thrown exceptions',
      ].join('\n'),
    });
  }

  if (metrics.codeBlockCount === 0) {
    suggestions.push({
      action: 'add',
      priority: 'medium',
      dimension: 'Clarity',
      description: 'Add code examples showing correct patterns',
      estimatedImprovement: 4,
    });
  }

  if (metrics.sectionCount < 3) {
    suggestions.push({
      action: 'restructure',
      priority: 'medium',
      dimension: 'Structure',
      description: 'Split content into more H2 sections for better shard retrieval',
      estimatedImprovement: 5,
    });
  }

  if (metrics.longestSectionLines > 50) {
    suggestions.push({
      action: 'split',
      priority: 'medium',
      dimension: 'Structure',
      description: `Split the longest section (${metrics.longestSectionLines} lines) into subsections`,
      estimatedImprovement: 4,
    });
  }

  if (metrics.domainRuleCount < 3) {
    suggestions.push({
      action: 'add',
      priority: 'medium',
      dimension: 'Coverage',
      description: 'Add domain-specific rules unique to this project',
      estimatedImprovement: 4,
    });
  }

  // Sort by estimated improvement
  suggestions.sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);

  return suggestions;
}


// ── Main validation entry point ────────────────────────────────────────────

/**
 * Empirically validate that score improvements produce behavioral improvements.
 *
 * Runs a suite of compliance tasks against both the original and optimized
 * CLAUDE.md, then computes statistical correlations between per-dimension
 * score deltas and per-dimension adherence rate deltas.
 *
 * **Content-aware executors**: If the executor implements `IContentAwareExecutor`,
 * `setContext()` is called before each phase with the corresponding CLAUDE.md
 * content. This is the key mechanism that allows the executor to vary its
 * behavior based on the quality of the loaded guidance — without it, the same
 * executor produces identical adherence for both phases.
 *
 * The result includes:
 * - Per-dimension concordance (did score and adherence move together?)
 * - Pearson r and Spearman rho correlation coefficients
 * - Cohen's d effect size with interpretation
 * - A verdict: positive-effect, negative-effect, no-effect, or inconclusive
 * - A formatted report with full task breakdown
 * - Optional proof chain for tamper-evident audit trail
 *
 * @param originalContent - Original CLAUDE.md content
 * @param optimizedContent - Optimized CLAUDE.md content
 * @param options - Executor, tasks, proof key, work directory, trials
 * @returns ValidationReport with statistical evidence
 */

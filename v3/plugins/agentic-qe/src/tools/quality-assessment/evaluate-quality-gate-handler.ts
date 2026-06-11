/**
 * agentic-qe evaluate-quality-gate — extended
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';
import {
  EvaluateQualityGateInputSchema,
} from './evaluate-quality-gate-defs.js';
import type {
  CollectedMetrics,
  EvaluateQualityGateInput,
  EvaluateQualityGateOutput,
  GateResult,
  QualityReport,
  RiskArea,
  ToolContext,
  TrendComparison,
} from './evaluate-quality-gate-defs.js';

export async function handler(
  input: EvaluateQualityGateInput,
  context: ToolContext
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();

  try {
    // Validate input
    const validatedInput = EvaluateQualityGateInputSchema.parse(input);

    // Get memory bridge for historical data
    const bridge = context.get<{
      searchSimilarPatterns: (q: string, k: number) => Promise<unknown[]>;
    }>('aqe.bridge');

    // Collect metrics
    const metrics = await collectMetrics(validatedInput.projectPath, validatedInput.includeMetrics);

    // Get gates to evaluate
    const gates = validatedInput.gates || GATE_PRESETS[validatedInput.defaults];

    // Evaluate gates
    const gateResults = evaluateGates(gates, metrics, validatedInput.failFast);

    // Calculate overall score
    const overallScore = calculateOverallScore(gateResults);

    // Determine pass/fail
    const blockers = gateResults.filter((g) => !g.passed && g.blocking);
    const warnings = gateResults.filter((g) => !g.passed && !g.blocking);
    const passed = blockers.length === 0;

    // Generate report if requested
    const report = validatedInput.generateReport
      ? await generateReport(metrics, gateResults, bridge)
      : null;

    // Build result
    const result: EvaluateQualityGateOutput = {
      success: true,
      passed,
      overallScore,
      gateResults,
      metrics,
      blockers,
      warnings,
      report,
      metadata: {
        evaluatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        preset: validatedInput.defaults,
        totalGates: gateResults.length,
        passedGates: gateResults.filter((g) => g.passed).length,
        failedGates: gateResults.filter((g) => !g.passed).length,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              passed: false,
              error: errorMessage,
              metadata: {
                evaluatedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

async function collectMetrics(
  projectPath: string | undefined,
  includeMetrics: string[]
): Promise<CollectedMetrics> {
  // Simulated metric collection
  // In real implementation, would integrate with coverage tools, linters, etc.

  return {
    coverage: {
      line: 78.5,
      branch: 65.2,
      function: 85.0,
      overall: 76.2,
    },
    bugs: {
      total: 5,
      critical: 0,
      major: 2,
      minor: 3,
    },
    vulnerabilities: {
      total: 3,
      critical: 0,
      high: 1,
      medium: 1,
      low: 1,
    },
    codeSmells: {
      total: 45,
      debt: '2h 30m',
      ratio: 2.1,
    },
    duplications: {
      lines: 150,
      blocks: 12,
      percentage: 4.2,
    },
    complexity: {
      cyclomatic: 180,
      cognitive: 220,
      avgPerFunction: 8.5,
    },
    technicalDebt: {
      total: '3d 4h',
      ratio: 1.8,
      rating: 'B',
    },
    ratings: {
      reliability: 'B',
      security: 'A',
      maintainability: 'B',
    },
  };
}

interface GateDefinition {
  metric: string;
  operator: string;
  threshold: number;
  weight: number;
  blocking: boolean;
}

function evaluateGates(
  gates: GateDefinition[],
  metrics: CollectedMetrics,
  failFast: boolean
): GateResult[] {
  const results: GateResult[] = [];

  for (const gate of gates) {
    const actual = getMetricValue(metrics, gate.metric);
    const passed = evaluateCondition(actual, gate.operator, gate.threshold);
    const deviation = calculateDeviation(actual, gate.threshold, gate.operator);

    results.push({
      metric: gate.metric,
      operator: gate.operator,
      threshold: gate.threshold,
      actual,
      passed,
      blocking: gate.blocking,
      weight: gate.weight,
      deviation,
      message: generateMessage(gate.metric, passed, actual, gate.threshold, gate.operator),
    });

    if (failFast && !passed && gate.blocking) {
      break;
    }
  }

  return results;
}

function getMetricValue(metrics: CollectedMetrics, metricPath: string): number {
  const parts = metricPath.split('.');
  let value: unknown = metrics;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return 0;
    }
  }

  return typeof value === 'number' ? value : 0;
}

function evaluateCondition(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':
      return actual > threshold;
    case '<':
      return actual < threshold;
    case '>=':
      return actual >= threshold;
    case '<=':
      return actual <= threshold;
    case '==':
      return actual === threshold;
    default:
      return false;
  }
}

function calculateDeviation(actual: number, threshold: number, operator: string): number {
  if (operator === '>' || operator === '>=') {
    return Math.round((actual - threshold) * 100) / 100;
  }
  if (operator === '<' || operator === '<=') {
    return Math.round((threshold - actual) * 100) / 100;
  }
  return Math.abs(actual - threshold);
}

function generateMessage(
  metric: string,
  passed: boolean,
  actual: number,
  threshold: number,
  operator: string
): string {
  if (passed) {
    return `${metric}: ${actual} ${operator} ${threshold} - PASSED`;
  }
  return `${metric}: ${actual} does not meet ${operator} ${threshold} - FAILED`;
}

function calculateOverallScore(results: GateResult[]): number {
  if (results.length === 0) return 0;

  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const weightedScore = results.reduce((sum, r) => {
    const score = r.passed ? r.weight : 0;
    return sum + score;
  }, 0);

  return Math.round((weightedScore / totalWeight) * 100);
}

async function generateReport(
  metrics: CollectedMetrics,
  results: GateResult[],
  bridge?: { searchSimilarPatterns: (q: string, k: number) => Promise<unknown[]> }
): Promise<QualityReport> {
  // Generate recommendations based on failures
  const recommendations: string[] = [];
  const failedGates = results.filter((r) => !r.passed);

  for (const gate of failedGates) {
    recommendations.push(generateRecommendation(gate));
  }

  // Get historical data for trends
  let historicalData: unknown[] = [];
  if (bridge) {
    try {
      historicalData = await bridge.searchSimilarPatterns('quality-gate', 5);
    } catch {
      // Continue without history
    }
  }

  // Generate trends
  const trends: TrendComparison[] = [
    {
      metric: 'coverage.overall',
      previous: 74.5,
      current: metrics.coverage.overall,
      trend: metrics.coverage.overall > 74.5 ? 'improving' : 'declining',
    },
    {
      metric: 'bugs.total',
      previous: 8,
      current: metrics.bugs.total,
      trend: metrics.bugs.total < 8 ? 'improving' : 'declining',
    },
    {
      metric: 'technicalDebt.ratio',
      previous: 2.0,
      current: metrics.technicalDebt.ratio,
      trend: metrics.technicalDebt.ratio < 2.0 ? 'improving' : 'declining',
    },
  ];

  // Identify risk areas
  const riskAreas: RiskArea[] = [];

  if (metrics.vulnerabilities.high > 0 || metrics.vulnerabilities.critical > 0) {
    riskAreas.push({
      name: 'Security Vulnerabilities',
      severity: metrics.vulnerabilities.critical > 0 ? 'critical' : 'high',
      description: `${metrics.vulnerabilities.total} vulnerabilities detected`,
      files: ['security-sensitive-file.ts'],
    });
  }

  if (metrics.complexity.avgPerFunction > 10) {
    riskAreas.push({
      name: 'High Complexity',
      severity: 'medium',
      description: `Average function complexity is ${metrics.complexity.avgPerFunction}`,
      files: ['complex-module.ts'],
    });
  }

  // Generate summary
  const passedCount = results.filter((r) => r.passed).length;
  const summary = `Quality gate evaluation: ${passedCount}/${results.length} gates passed. ` +
    `Overall score: ${calculateOverallScore(results)}%. ` +
    `${failedGates.length > 0 ? `${failedGates.length} gate(s) require attention.` : 'All gates passed successfully.'}`;

  return {
    summary,
    recommendations,
    trends,
    riskAreas,
  };
}

function generateRecommendation(gate: GateResult): string {
  const recommendations: Record<string, string> = {
    'coverage.overall': 'Increase test coverage by writing additional unit and integration tests',
    'coverage.branch': 'Add tests for uncovered conditional branches',
    'bugs.critical': 'Fix critical bugs immediately before release',
    'bugs.major': 'Address major bugs in the next sprint',
    'vulnerabilities.critical': 'Critical security vulnerabilities must be patched immediately',
    'vulnerabilities.high': 'High-severity vulnerabilities should be fixed before release',
    'codeSmells.ratio': 'Refactor code to reduce code smell density',
    'duplications.percentage': 'Extract duplicated code into reusable functions or modules',
    'complexity.avgPerFunction': 'Simplify complex functions by extracting smaller methods',
  };

  return recommendations[gate.metric] || `Improve ${gate.metric} to meet threshold of ${gate.threshold}`;
}

// Export tool definition for MCP registration
export const toolDefinition = {
  name: 'aqe/evaluate-quality-gate',
  description: 'Evaluate quality gates for release readiness with configurable thresholds',
  category: 'quality-assessment',
  version: '3.2.3',
  inputSchema: EvaluateQualityGateInputSchema,
  handler,
};

export default toolDefinition;

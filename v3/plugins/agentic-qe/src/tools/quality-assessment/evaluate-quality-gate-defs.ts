/**
 * agentic-qe evaluate-quality-gate — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const EvaluateQualityGateInputSchema = z.object({
  gates: z
    .array(
      z.object({
        metric: z.string().describe('Metric name'),
        operator: z.enum(['>', '<', '>=', '<=', '==']).describe('Comparison operator'),
        threshold: z.number().describe('Threshold value'),
        weight: z.number().min(0).max(1).default(1).describe('Weight for overall score'),
        blocking: z.boolean().default(true).describe('If true, failure blocks release'),
      })
    )
    .optional()
    .describe('Custom quality gate definitions'),
  defaults: z
    .enum(['strict', 'standard', 'minimal'])
    .default('standard')
    .describe('Default gate preset if custom gates not provided'),
  projectPath: z.string().optional().describe('Path to project for metric collection'),
  includeMetrics: z
    .array(
      z.enum([
        'coverage',
        'bugs',
        'vulnerabilities',
        'code-smells',
        'duplications',
        'complexity',
        'technical-debt',
        'reliability',
        'security',
        'maintainability',
      ])
    )
    .default(['coverage', 'bugs', 'vulnerabilities', 'code-smells'])
    .describe('Metrics to evaluate'),
  failFast: z.boolean().default(false).describe('Stop on first gate failure'),
  generateReport: z.boolean().default(true).describe('Generate detailed report'),
});

export type EvaluateQualityGateInput = z.infer<typeof EvaluateQualityGateInputSchema>;

// Output structures
export interface EvaluateQualityGateOutput {
  success: boolean;
  passed: boolean;
  overallScore: number;
  gateResults: GateResult[];
  metrics: CollectedMetrics;
  blockers: GateResult[];
  warnings: GateResult[];
  report: QualityReport | null;
  metadata: QualityGateMetadata;
}

export interface GateResult {
  metric: string;
  operator: string;
  threshold: number;
  actual: number;
  passed: boolean;
  blocking: boolean;
  weight: number;
  deviation: number;
  message: string;
}

export interface CollectedMetrics {
  coverage: CoverageMetrics;
  bugs: BugMetrics;
  vulnerabilities: VulnerabilityMetrics;
  codeSmells: CodeSmellMetrics;
  duplications: DuplicationMetrics;
  complexity: ComplexityMetrics;
  technicalDebt: TechnicalDebtMetrics;
  ratings: QualityRatings;
}

export interface CoverageMetrics {
  line: number;
  branch: number;
  function: number;
  overall: number;
}

export interface BugMetrics {
  total: number;
  critical: number;
  major: number;
  minor: number;
}

export interface VulnerabilityMetrics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface CodeSmellMetrics {
  total: number;
  debt: string;
  ratio: number;
}

export interface DuplicationMetrics {
  lines: number;
  blocks: number;
  percentage: number;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  avgPerFunction: number;
}

export interface TechnicalDebtMetrics {
  total: string;
  ratio: number;
  rating: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface QualityRatings {
  reliability: 'A' | 'B' | 'C' | 'D' | 'E';
  security: 'A' | 'B' | 'C' | 'D' | 'E';
  maintainability: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface QualityReport {
  summary: string;
  recommendations: string[];
  trends: TrendComparison[];
  riskAreas: RiskArea[];
}

export interface TrendComparison {
  metric: string;
  previous: number;
  current: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface RiskArea {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  files: string[];
}

export interface QualityGateMetadata {
  evaluatedAt: string;
  durationMs: number;
  preset: string;
  totalGates: number;
  passedGates: number;
  failedGates: number;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

// Default gate presets
const GATE_PRESETS = {
  strict: [
    { metric: 'coverage.overall', operator: '>=', threshold: 90, weight: 1, blocking: true },
    { metric: 'coverage.branch', operator: '>=', threshold: 85, weight: 0.9, blocking: true },
    { metric: 'bugs.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
    { metric: 'vulnerabilities.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
    { metric: 'vulnerabilities.high', operator: '==', threshold: 0, weight: 0.9, blocking: true },
    { metric: 'codeSmells.ratio', operator: '<=', threshold: 1, weight: 0.7, blocking: false },
    { metric: 'duplications.percentage', operator: '<=', threshold: 3, weight: 0.6, blocking: false },
    { metric: 'complexity.avgPerFunction', operator: '<=', threshold: 10, weight: 0.5, blocking: false },
  ],
  standard: [
    { metric: 'coverage.overall', operator: '>=', threshold: 80, weight: 1, blocking: true },
    { metric: 'coverage.branch', operator: '>=', threshold: 70, weight: 0.8, blocking: false },
    { metric: 'bugs.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
    { metric: 'vulnerabilities.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
    { metric: 'vulnerabilities.high', operator: '<=', threshold: 2, weight: 0.8, blocking: false },
    { metric: 'codeSmells.ratio', operator: '<=', threshold: 3, weight: 0.5, blocking: false },
    { metric: 'duplications.percentage', operator: '<=', threshold: 5, weight: 0.4, blocking: false },
  ],
  minimal: [
    { metric: 'coverage.overall', operator: '>=', threshold: 60, weight: 1, blocking: true },
    { metric: 'bugs.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
    { metric: 'vulnerabilities.critical', operator: '==', threshold: 0, weight: 1, blocking: true },
  ],
};

/**
 * MCP Tool Handler for evaluate-quality-gate
 */

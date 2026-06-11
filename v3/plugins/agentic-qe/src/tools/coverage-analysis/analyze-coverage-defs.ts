/**
 * agentic-qe analyze-coverage — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const AnalyzeCoverageInputSchema = z.object({
  targetPath: z.string().describe('Path to file/directory to analyze'),
  coverageReport: z.string().optional().describe('Path to coverage report (lcov/json)'),
  algorithm: z
    .enum(['johnson-lindenstrauss', 'full-scan'])
    .default('johnson-lindenstrauss')
    .describe('Analysis algorithm - JL for O(log n), full-scan for O(n)'),
  prioritize: z.boolean().default(true).describe('Prioritize gaps by risk'),
  includeFileDetails: z.boolean().default(true).describe('Include per-file breakdown'),
  thresholds: z
    .object({
      line: z.number().min(0).max(100).default(80),
      branch: z.number().min(0).max(100).default(70),
      function: z.number().min(0).max(100).default(90),
    })
    .optional()
    .describe('Coverage thresholds to flag failures'),
  projectionDimension: z
    .number()
    .min(8)
    .max(256)
    .default(32)
    .describe('JL projection dimension (higher = more accurate, slower)'),
});

export type AnalyzeCoverageInput = z.infer<typeof AnalyzeCoverageInputSchema>;

// Output structures
export interface AnalyzeCoverageOutput {
  success: boolean;
  summary: CoverageSummary;
  gaps: CoverageGap[];
  files: FileCoverage[];
  thresholdResults: ThresholdResult[];
  algorithm: AlgorithmInfo;
  metadata: AnalysisMetadata;
}

export interface CoverageSummary {
  lines: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  statements: CoverageMetric;
  overall: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface CoverageMetric {
  covered: number;
  total: number;
  percentage: number;
}

export interface CoverageGap {
  id: string;
  type: 'line' | 'branch' | 'function';
  file: string;
  location: {
    startLine: number;
    endLine: number;
  };
  risk: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  reason: string;
  suggestions: string[];
}

export interface FileCoverage {
  path: string;
  lines: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  uncoveredRanges: Array<{ start: number; end: number }>;
  complexity: number;
}

export interface ThresholdResult {
  metric: string;
  threshold: number;
  actual: number;
  passed: boolean;
  gap: number;
}

export interface AlgorithmInfo {
  name: string;
  complexity: string;
  projectionDimension?: number;
  accuracy: number;
  speedup: number;
}

export interface AnalysisMetadata {
  analyzedAt: string;
  durationMs: number;
  filesAnalyzed: number;
  totalLines: number;
  algorithm: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for analyze-coverage
 */

/**
 * agentic-qe suggest-tests — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const SuggestTestsInputSchema = z.object({
  targetPath: z.string().describe('Path to file/directory to analyze'),
  coverageReport: z.string().optional().describe('Path to existing coverage report (lcov/json)'),
  focusAreas: z
    .array(z.enum(['branches', 'functions', 'lines', 'edge-cases', 'error-handling', 'boundaries']))
    .default(['branches', 'functions'])
    .describe('Areas to focus suggestions on'),
  maxSuggestions: z.number().min(1).max(50).default(10).describe('Maximum suggestions to return'),
  priorityBy: z
    .enum(['risk', 'complexity', 'coverage-impact', 'change-frequency'])
    .default('risk')
    .describe('How to prioritize suggestions'),
  includeCode: z.boolean().default(true).describe('Include generated test code in suggestions'),
  framework: z
    .enum(['vitest', 'jest', 'mocha', 'pytest', 'junit'])
    .default('vitest')
    .describe('Test framework for generated code'),
});

export type SuggestTestsInput = z.infer<typeof SuggestTestsInputSchema>;

// Output structures
export interface SuggestTestsOutput {
  success: boolean;
  suggestions: TestSuggestion[];
  coverageAnalysis: CoverageAnalysisSummary;
  prioritization: PrioritizationInfo;
  metadata: SuggestionMetadata;
}

export interface TestSuggestion {
  id: string;
  type: 'branch' | 'function' | 'line' | 'edge-case' | 'error-handling' | 'boundary';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  targetLocation: CodeLocation;
  rationale: string;
  estimatedCoverageGain: number;
  complexity: 'simple' | 'moderate' | 'complex';
  testCode?: string;
  relatedTests?: string[];
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  functionName?: string;
  className?: string;
}

export interface CoverageAnalysisSummary {
  currentCoverage: CoverageMetrics;
  projectedCoverage: CoverageMetrics;
  uncoveredAreas: UncoveredArea[];
}

export interface CoverageMetrics {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

export interface UncoveredArea {
  type: string;
  location: CodeLocation;
  risk: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

export interface PrioritizationInfo {
  strategy: string;
  factors: PrioritizationFactor[];
  riskScore: number;
}

export interface PrioritizationFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface SuggestionMetadata {
  generatedAt: string;
  analysisTimeMs: number;
  filesAnalyzed: number;
  totalUncoveredLines: number;
  totalUncoveredBranches: number;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for suggest-tests
 */

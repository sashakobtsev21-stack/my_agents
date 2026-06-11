/**
 * agentic-qe predict-defects — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const PredictDefectsInputSchema = z.object({
  targetPath: z.string().describe('Path to file/directory to analyze'),
  depth: z
    .enum(['shallow', 'medium', 'deep'])
    .default('medium')
    .describe('Analysis depth - deeper finds more but takes longer'),
  includeRootCause: z.boolean().default(true).describe('Include root cause analysis'),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe('Minimum confidence threshold for predictions'),
  categories: z
    .array(
      z.enum([
        'null-pointer',
        'boundary',
        'resource-leak',
        'race-condition',
        'logic-error',
        'security',
        'performance',
        'type-error',
        'exception-handling',
      ])
    )
    .default(['null-pointer', 'boundary', 'logic-error', 'exception-handling'])
    .describe('Defect categories to check'),
  useSimilarPatterns: z.boolean().default(true).describe('Use historical pattern matching'),
  maxPredictions: z.number().min(1).max(100).default(20).describe('Maximum predictions to return'),
});

export type PredictDefectsInput = z.infer<typeof PredictDefectsInputSchema>;

// Output structures
export interface PredictDefectsOutput {
  success: boolean;
  predictions: DefectPrediction[];
  riskSummary: RiskSummary;
  similarDefects: SimilarDefect[];
  preventionStrategies: PreventionStrategy[];
  metadata: PredictionMetadata;
}

export interface DefectPrediction {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  location: CodeLocation;
  description: string;
  rootCause?: RootCauseAnalysis;
  evidence: Evidence[];
  suggestedFix: string;
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  functionName?: string;
  codeSnippet?: string;
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  codePattern: string;
  historicalOccurrences: number;
}

export interface Evidence {
  type: 'code-pattern' | 'complexity' | 'history' | 'semantic' | 'static-analysis';
  description: string;
  weight: number;
}

export interface RiskSummary {
  totalPredictions: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgConfidence: number;
  highRiskAreas: string[];
}

export interface SimilarDefect {
  id: string;
  similarity: number;
  originalDefect: {
    category: string;
    description: string;
    resolution: string;
    file: string;
  };
  matchedPattern: string;
}

export interface PreventionStrategy {
  category: string;
  strategy: string;
  implementation: string;
  effectiveness: number;
  affectedPredictions: string[];
}

export interface PredictionMetadata {
  analyzedAt: string;
  durationMs: number;
  filesAnalyzed: number;
  linesAnalyzed: number;
  patternsMatched: number;
  modelVersion: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for predict-defects
 */

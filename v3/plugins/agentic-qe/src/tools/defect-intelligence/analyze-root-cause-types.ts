/**
 * Analyze Root Cause — input schema, output shapes & ToolContext
 *
 * Extracted verbatim from analyze-root-cause.ts (lines 11-154) during
 * campaign-2 wave 84 (W290). analyze-root-cause.ts stays the barrel
 * ('export *').
 */

import { z } from 'zod';

export const AnalyzeRootCauseInputSchema = z.object({
  defect: z
    .object({
      id: z.string().optional().describe('Defect ID'),
      description: z.string().describe('Description of the defect'),
      location: z
        .object({
          file: z.string(),
          line: z.number().optional(),
          function: z.string().optional(),
        })
        .optional()
        .describe('Location of the defect'),
      category: z.string().optional().describe('Defect category'),
      stackTrace: z.string().optional().describe('Stack trace if available'),
    })
    .describe('Defect information'),
  analysisDepth: z
    .enum(['immediate', 'standard', 'deep'])
    .default('standard')
    .describe('Depth of analysis'),
  includeHistorical: z.boolean().default(true).describe('Include historical pattern analysis'),
  includeRemediation: z.boolean().default(true).describe('Include remediation recommendations'),
  maxContributingFactors: z.number().min(1).max(20).default(5).describe('Maximum factors to identify'),
});

export type AnalyzeRootCauseInput = z.infer<typeof AnalyzeRootCauseInputSchema>;

// Output structures
export interface AnalyzeRootCauseOutput {
  success: boolean;
  rootCause: RootCause;
  causalChain: CausalChainLink[];
  contributingFactors: ContributingFactor[];
  historicalAnalysis: HistoricalAnalysis | null;
  remediation: RemediationPlan | null;
  preventionMeasures: PreventionMeasure[];
  metadata: RootCauseMetadata;
}

export interface RootCause {
  id: string;
  type: 'code' | 'design' | 'process' | 'environment' | 'human';
  category: string;
  description: string;
  confidence: number;
  evidence: string[];
  technicalDetails: TechnicalDetails;
}

export interface TechnicalDetails {
  codePattern?: string;
  antiPattern?: string;
  affectedComponents: string[];
  dataFlow?: string;
  controlFlow?: string;
}

export interface CausalChainLink {
  level: number;
  description: string;
  type: 'symptom' | 'proximate' | 'intermediate' | 'root';
  evidence: string;
  confidence: number;
}

export interface ContributingFactor {
  id: string;
  category: 'technical' | 'process' | 'organizational' | 'environmental';
  description: string;
  severity: 'major' | 'moderate' | 'minor';
  evidence: string;
  addressable: boolean;
}

export interface HistoricalAnalysis {
  similarDefects: SimilarDefectMatch[];
  recurringPatterns: RecurringPattern[];
  trendAnalysis: TrendInfo;
}

export interface SimilarDefectMatch {
  defectId: string;
  similarity: number;
  resolution: string;
  resolvedDate: string;
  resolutionEffective: boolean;
}

export interface RecurringPattern {
  pattern: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  addressed: boolean;
}

export interface TrendInfo {
  increasing: boolean;
  frequency: string;
  hotspots: string[];
}

export interface RemediationPlan {
  immediateActions: RemediationAction[];
  shortTermActions: RemediationAction[];
  longTermActions: RemediationAction[];
  estimatedEffort: string;
  riskIfUnaddressed: string;
}

export interface RemediationAction {
  priority: number;
  action: string;
  owner: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface PreventionMeasure {
  measure: string;
  type: 'code-review' | 'testing' | 'tooling' | 'training' | 'process';
  effectiveness: number;
  implementation: string;
  cost: 'low' | 'medium' | 'high';
}

export interface RootCauseMetadata {
  analyzedAt: string;
  durationMs: number;
  analysisDepth: string;
  confidenceScore: number;
  methodsUsed: string[];
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for analyze-root-cause
 */

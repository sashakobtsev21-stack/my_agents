/**
 * agentic-qe calculate-risk — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const CalculateRiskInputSchema = z.object({
  targetPath: z.string().describe('Path to file/directory to analyze'),
  factors: z
    .array(
      z.enum([
        'complexity',
        'coverage',
        'change-frequency',
        'defect-density',
        'age',
        'coupling',
        'size',
        'team-experience',
        'documentation',
      ])
    )
    .default(['complexity', 'coverage', 'change-frequency', 'defect-density'])
    .describe('Risk factors to consider'),
  weights: z
    .object({
      complexity: z.number().min(0).max(1).default(0.2),
      coverage: z.number().min(0).max(1).default(0.25),
      changeFrequency: z.number().min(0).max(1).default(0.2),
      defectDensity: z.number().min(0).max(1).default(0.15),
      age: z.number().min(0).max(1).default(0.05),
      coupling: z.number().min(0).max(1).default(0.05),
      size: z.number().min(0).max(1).default(0.05),
      teamExperience: z.number().min(0).max(1).default(0.025),
      documentation: z.number().min(0).max(1).default(0.025),
    })
    .optional()
    .describe('Custom weights for risk factors'),
  granularity: z
    .enum(['file', 'module', 'function', 'project'])
    .default('file')
    .describe('Level of granularity for analysis'),
  riskThresholds: z
    .object({
      low: z.number().default(30),
      medium: z.number().default(60),
      high: z.number().default(80),
    })
    .optional()
    .describe('Thresholds for risk categorization'),
  includeRecommendations: z.boolean().default(true).describe('Include mitigation recommendations'),
});

export type CalculateRiskInput = z.infer<typeof CalculateRiskInputSchema>;

// Output structures
export interface CalculateRiskOutput {
  success: boolean;
  overallRisk: RiskScore;
  componentRisks: ComponentRisk[];
  factorContributions: FactorContribution[];
  hotspots: RiskHotspot[];
  recommendations: RiskRecommendation[];
  trendAnalysis: RiskTrend;
  metadata: RiskMetadata;
}

export interface RiskScore {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  breakdown: Record<string, number>;
}

export interface ComponentRisk {
  path: string;
  type: 'file' | 'module' | 'function';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Record<string, number>;
  topIssues: string[];
}

export interface FactorContribution {
  factor: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  percentageContribution: number;
  details: string;
}

export interface RiskHotspot {
  path: string;
  riskScore: number;
  primaryFactor: string;
  description: string;
  urgency: 'immediate' | 'short-term' | 'long-term';
}

export interface RiskRecommendation {
  priority: number;
  factor: string;
  action: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  affectedComponents: string[];
}

export interface RiskTrend {
  direction: 'improving' | 'stable' | 'worsening';
  changePercent: number;
  historicalScores: Array<{ date: string; score: number }>;
  projection: number;
}

export interface RiskMetadata {
  calculatedAt: string;
  durationMs: number;
  targetPath: string;
  componentsAnalyzed: number;
  factorsUsed: string[];
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

// Default weights
const DEFAULT_WEIGHTS = {
  complexity: 0.2,
  coverage: 0.25,
  changeFrequency: 0.2,
  defectDensity: 0.15,
  age: 0.05,
  coupling: 0.05,
  size: 0.05,
  teamExperience: 0.025,
  documentation: 0.025,
};

// Default thresholds
const DEFAULT_THRESHOLDS = { low: 30, medium: 60, high: 80 };

/**
 * MCP Tool Handler for calculate-risk
 */

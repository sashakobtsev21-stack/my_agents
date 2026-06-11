/**
 * agentic-qe track-trends — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const TrackTrendsInputSchema = z.object({
  targetPath: z.string().optional().describe('Path to track (or all if not specified)'),
  timeRange: z
    .enum(['7d', '14d', '30d', '90d', '180d', '365d'])
    .default('30d')
    .describe('Time range for trend analysis'),
  metrics: z
    .array(z.enum(['line', 'branch', 'function', 'statement', 'overall']))
    .default(['line', 'branch', 'overall'])
    .describe('Metrics to track'),
  detectRegressions: z.boolean().default(true).describe('Flag coverage regressions'),
  regressionThreshold: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe('Percentage drop to flag as regression'),
  groupBy: z
    .enum(['day', 'week', 'month', 'commit'])
    .default('day')
    .describe('Grouping for trend data'),
  includeProjections: z.boolean().default(true).describe('Include future projections'),
  compareBaseline: z.string().optional().describe('Baseline date to compare against (ISO format)'),
});

export type TrackTrendsInput = z.infer<typeof TrackTrendsInputSchema>;

// Output structures
export interface TrackTrendsOutput {
  success: boolean;
  trends: TrendData;
  regressions: Regression[];
  improvements: Improvement[];
  projections: Projection[];
  insights: TrendInsight[];
  metadata: TrendMetadata;
}

export interface TrendData {
  timeRange: { start: string; end: string };
  dataPoints: TrendDataPoint[];
  aggregates: TrendAggregates;
  volatility: number;
}

export interface TrendDataPoint {
  date: string;
  commitHash?: string;
  metrics: Record<string, number>;
  filesChanged: number;
  testsAdded: number;
}

export interface TrendAggregates {
  avgLine: number;
  avgBranch: number;
  avgFunction: number;
  avgOverall: number;
  minOverall: number;
  maxOverall: number;
  change: number;
  changePercent: number;
}

export interface Regression {
  id: string;
  date: string;
  metric: string;
  before: number;
  after: number;
  drop: number;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  possibleCauses: string[];
  affectedFiles: string[];
}

export interface Improvement {
  id: string;
  date: string;
  metric: string;
  before: number;
  after: number;
  gain: number;
  type: 'test-addition' | 'refactoring' | 'dead-code-removal' | 'other';
  contributors: string[];
}

export interface Projection {
  metric: string;
  currentValue: number;
  projectedValue: number;
  targetDate: string;
  confidence: number;
  requiredPace: number;
  onTrack: boolean;
}

export interface TrendInsight {
  type: 'pattern' | 'anomaly' | 'recommendation' | 'warning';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
}

export interface TrendMetadata {
  analyzedAt: string;
  durationMs: number;
  dataPointCount: number;
  timeRange: string;
  baselineDate?: string;
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for track-trends
 */

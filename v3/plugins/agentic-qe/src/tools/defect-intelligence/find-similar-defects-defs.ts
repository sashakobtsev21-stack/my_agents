/**
 * agentic-qe find-similar-defects — core
 *
 * Extracted verbatim during campaign-2 wave W306. Barrel stays.
 */
import { z } from 'zod';

export const FindSimilarDefectsInputSchema = z.object({
  query: z
    .object({
      description: z.string().describe('Defect description to search for'),
      category: z.string().optional().describe('Defect category'),
      file: z.string().optional().describe('File where defect was found'),
      codeSnippet: z.string().optional().describe('Code snippet related to defect'),
      stackTrace: z.string().optional().describe('Stack trace'),
    })
    .describe('Query parameters for finding similar defects'),
  searchScope: z
    .enum(['project', 'organization', 'global'])
    .default('project')
    .describe('Scope of search'),
  maxResults: z.number().min(1).max(50).default(10).describe('Maximum results to return'),
  minSimilarity: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe('Minimum similarity threshold'),
  includeResolved: z.boolean().default(true).describe('Include resolved defects'),
  includeAnalysis: z.boolean().default(true).describe('Include similarity analysis'),
  groupBy: z
    .enum(['none', 'category', 'resolution', 'component'])
    .default('none')
    .describe('Group results by'),
});

export type FindSimilarDefectsInput = z.infer<typeof FindSimilarDefectsInputSchema>;

// Output structures
export interface FindSimilarDefectsOutput {
  success: boolean;
  matches: DefectMatch[];
  groups: DefectGroup[];
  patterns: DetectedPattern[];
  insights: SearchInsight[];
  metadata: SearchMetadata;
}

export interface DefectMatch {
  id: string;
  similarity: number;
  defect: DefectInfo;
  matchReasons: MatchReason[];
  resolution: ResolutionInfo | null;
  relatedFiles: string[];
}

export interface DefectInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'wont-fix';
  createdAt: string;
  file?: string;
  line?: number;
  component?: string;
  tags: string[];
}

export interface MatchReason {
  type: 'semantic' | 'structural' | 'pattern' | 'location' | 'category';
  description: string;
  score: number;
}

export interface ResolutionInfo {
  status: 'resolved' | 'wont-fix' | 'duplicate';
  resolution: string;
  resolvedAt: string;
  resolvedBy: string;
  effective: boolean;
  linkedCommit?: string;
}

export interface DefectGroup {
  name: string;
  count: number;
  avgSimilarity: number;
  defectIds: string[];
}

export interface DetectedPattern {
  pattern: string;
  occurrences: number;
  affectedDefects: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface SearchInsight {
  type: 'recurring' | 'cluster' | 'trend' | 'hotspot';
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
}

export interface SearchMetadata {
  searchedAt: string;
  durationMs: number;
  totalSearched: number;
  matchesFound: number;
  searchScope: string;
  algorithms: string[];
}

// Tool context interface
export interface ToolContext {
  get<T>(key: string): T | undefined;
}

/**
 * MCP Tool Handler for find-similar-defects
 */

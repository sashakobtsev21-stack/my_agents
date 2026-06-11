/**
 * hyperbolic-reasoning types — extended
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';
import type {
  EmbeddedHierarchy,
  EntailmentRelation,
  Hierarchy,
  HyperbolicPoint,
  SearchResult,
} from './types-core.js';

export interface EntailmentQueryResult {
  /** Direct entailments */
  readonly direct: ReadonlyArray<EntailmentRelation>;
  /** Transitive entailments */
  readonly transitive?: ReadonlyArray<EntailmentRelation>;
  /** Contradiction paths */
  readonly contradictions?: ReadonlyArray<ReadonlyArray<string>>;
}

// ============================================================================
// Zod Schemas for MCP Tool Validation
// ============================================================================

export const HierarchyNodeSchema = z.object({
  id: z.string().max(200),
  parent: z.string().max(200).nullable(),
  features: z.record(z.unknown()).optional(),
  label: z.string().max(500).optional(),
  depth: z.number().int().min(0).optional(),
});

export const HierarchyEdgeSchema = z.object({
  source: z.string().max(200),
  target: z.string().max(200),
  weight: z.number().finite().optional(),
  type: z.string().max(100).optional(),
});

export const HierarchySchema = z.object({
  nodes: z.array(HierarchyNodeSchema).min(1).max(1_000_000),
  edges: z.array(HierarchyEdgeSchema).max(10_000_000).optional(),
  root: z.string().max(200).optional(),
});

export const EmbedHierarchyInputSchema = z.object({
  hierarchy: HierarchySchema,
  model: z.enum(['poincare_ball', 'lorentz', 'klein', 'half_plane']).default('poincare_ball'),
  parameters: z.object({
    dimensions: z.number().int().min(2).max(512).default(32),
    curvature: z.number().min(-10).max(-0.01).default(-1.0),
    learnCurvature: z.boolean().default(true),
    epochs: z.number().int().min(1).max(1000).default(100),
    learningRate: z.number().min(0.0001).max(1).default(0.01),
  }).optional(),
});

export type EmbedHierarchyInput = z.infer<typeof EmbedHierarchyInputSchema>;

export const TaxonomicReasonInputSchema = z.object({
  query: z.object({
    type: z.enum(['is_a', 'subsumption', 'lowest_common_ancestor', 'path', 'similarity']),
    subject: z.string().max(500),
    object: z.string().max(500).optional(),
  }),
  taxonomy: z.string().max(200),
  inference: z.object({
    transitive: z.boolean().default(true),
    fuzzy: z.boolean().default(false),
    confidence: z.number().min(0).max(1).default(0.8),
  }).optional(),
});

export type TaxonomicReasonInput = z.infer<typeof TaxonomicReasonInputSchema>;

export const SemanticSearchInputSchema = z.object({
  query: z.string().max(5000),
  index: z.string().max(200),
  searchMode: z.enum(['nearest', 'subtree', 'ancestors', 'siblings', 'cone']).default('nearest'),
  constraints: z.object({
    maxDepth: z.number().int().min(0).max(100).optional(),
    minDepth: z.number().int().min(0).max(100).optional(),
    subtreeRoot: z.string().max(200).optional(),
    nodeTypes: z.array(z.string().max(100)).optional(),
  }).optional(),
  topK: z.number().int().min(1).max(10000).default(10),
});

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

export const HierarchyCompareInputSchema = z.object({
  source: HierarchySchema,
  target: HierarchySchema,
  alignment: z.enum(['wasserstein', 'gromov_wasserstein', 'tree_edit', 'subtree_isomorphism']).default('gromov_wasserstein'),
  metrics: z.array(z.enum(['structural_similarity', 'semantic_similarity', 'coverage', 'precision'])).optional(),
});

export type HierarchyCompareInput = z.infer<typeof HierarchyCompareInputSchema>;

export const ConceptSchema = z.object({
  id: z.string().max(200),
  text: z.string().max(5000),
  type: z.string().max(100).optional(),
});

export const EntailmentGraphInputSchema = z.object({
  action: z.enum(['build', 'query', 'expand', 'prune']),
  concepts: z.array(ConceptSchema).max(100000).optional(),
  graphId: z.string().max(200).optional(),
  query: z.object({
    premise: z.string().max(200).optional(),
    hypothesis: z.string().max(200).optional(),
  }).optional(),
  entailmentThreshold: z.number().min(0).max(1).default(0.7),
  transitiveClosure: z.boolean().default(true),
  pruneStrategy: z.enum(['none', 'transitive_reduction', 'confidence_threshold']).optional(),
});

export type EntailmentGraphInput = z.infer<typeof EntailmentGraphInputSchema>;

// ============================================================================
// MCP Tool Types
// ============================================================================

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  category?: string;
  tags?: string[];
  version?: string;
  cacheable?: boolean;
  cacheTTL?: number;
  handler: (input: Record<string, unknown>, context?: ToolContext) => Promise<MCPToolResult>;
}

// ============================================================================
// Tool Context Types
// ============================================================================

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface HyperbolicReasoningConfig {
  embedding: {
    defaultDimensions: number;
    defaultCurvature: number;
    maxNodes: number;
  };
  search: {
    maxTopK: number;
    defaultTopK: number;
  };
  entailment: {
    defaultThreshold: number;
    maxConcepts: number;
  };
  resourceLimits: {
    maxMemoryBytes: number;
    maxCpuTimeMs: number;
    maxDepth: number;
  };
}

export interface HyperbolicReasoningBridge {
  initialized: boolean;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  embedHierarchy(hierarchy: Hierarchy, config: EmbedHierarchyInput['parameters']): Promise<EmbeddedHierarchy>;
  computeDistance(a: HyperbolicPoint, b: HyperbolicPoint): number;
  search(query: HyperbolicPoint, index: string, k: number): Promise<SearchResult>;
}

export interface ToolContext {
  bridge?: HyperbolicReasoningBridge;
  config?: HyperbolicReasoningConfig;
  logger?: Logger;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful MCP tool result
 */
export function successResult(data: unknown): MCPToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Create an error MCP tool result
 */
export function errorResult(error: Error | string): MCPToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: true,
        message,
        timestamp: new Date().toISOString(),
      }, null, 2),
    }],
    isError: true,
  };
}

// ============================================================================
// Security Constants
// ============================================================================

export const POINCARE_BALL_EPS = 1e-10;
export const MAX_NORM = 1 - POINCARE_BALL_EPS;

export const RESOURCE_LIMITS = {
  MAX_NODES: 1_000_000,
  MAX_EDGES: 10_000_000,
  MAX_DIMENSIONS: 512,
  MAX_DEPTH: 100,
  MAX_BRANCHING: 10000,
  MAX_MEMORY_BYTES: 2147483648, // 2GB
  MAX_CPU_TIME_MS: 300000, // 5 minutes
} as const;

// ============================================================================
// Hyperbolic Math Utilities (used by bridges)
// ============================================================================

/**
 * Clip vector to stay within Poincare ball
 */
export function clipToBall(vector: Float32Array, curvature: number): Float32Array {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  const maxNorm = MAX_NORM / Math.sqrt(-curvature);

  if (norm > maxNorm) {
    const scale = maxNorm / norm;
    return new Float32Array(vector.map(v => v * scale));
  }

  return vector;
}

/**
 * Compute hyperbolic distance in Poincare ball
 */
export function poincareDistance(x: Float32Array, y: Float32Array, c: number): number {
  const diffSq = x.reduce((s, v, i) => s + Math.pow(v - (y[i] ?? 0), 2), 0);
  const normXSq = x.reduce((s, v) => s + v * v, 0);
  const normYSq = y.reduce((s, v) => s + v * v, 0);

  const delta = 2 * Math.abs(c) * diffSq / ((1 - Math.abs(c) * normXSq) * (1 - Math.abs(c) * normYSq));
  return Math.acosh(1 + delta) / Math.sqrt(Math.abs(c));
}

/**
 * Mobius addition in Poincare ball
 */
export function mobiusAdd(x: Float32Array, y: Float32Array, c: number): Float32Array {
  const absC = Math.abs(c);
  const normXSq = x.reduce((s, v) => s + v * v, 0);
  const normYSq = y.reduce((s, v) => s + v * v, 0);
  const dotXY = x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);

  const numerator1 = 1 + 2 * absC * dotXY + absC * normYSq;
  const numerator2 = 1 - absC * normXSq;
  const denominator = 1 + 2 * absC * dotXY + absC * absC * normXSq * normYSq;

  const result = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    result[i] = (numerator1 * x[i]! + numerator2 * (y[i] ?? 0)) / denominator;
  }

  return clipToBall(result, c);
}

/**
 * Exponential map from tangent space to Poincare ball
 */
export function expMap(v: Float32Array, c: number): Float32Array {
  const norm = Math.sqrt(v.reduce((s, val) => s + val * val, 0));
  if (norm < 1e-10) {
    return new Float32Array(v.length);
  }

  const sqrtC = Math.sqrt(Math.abs(c));
  const scale = Math.tanh(sqrtC * norm / 2) / (sqrtC * norm);

  return clipToBall(new Float32Array(v.map(val => val * scale)), c);
}

/**
 * Logarithmic map from Poincare ball to tangent space
 */
export function logMap(x: Float32Array, c: number): Float32Array {
  const norm = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
  if (norm < 1e-10) {
    return new Float32Array(x.length);
  }

  const sqrtC = Math.sqrt(Math.abs(c));
  const scale = 2 * Math.atanh(sqrtC * norm) / (sqrtC * norm);

  return new Float32Array(x.map(v => v * scale));
}

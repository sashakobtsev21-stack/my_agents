/**
 * Code Intelligence — schemas, bridges, config, errors & security
 *
 * The zod tool-input schemas, bridge interfaces, configuration shapes,
 * CodeIntelligenceError, and the security utilities. Extracted verbatim
 * from types.ts (lines 634-966) during campaign-2 wave 7 (W213).
 * types.ts stays the barrel.
 */

import { z } from 'zod';
// The schema enums are zod VALUES; only the pure shapes stay type-only.
import {
  AnalysisType,
  ChangeType,
  Language,
  OutputFormat,
  PatternType,
  SearchType,
  SplitStrategy,
} from './types-domain.js';
import type {
  DependencyGraph,
  SplitConstraints,
} from './types-domain.js';

// MCP Tool Input Schemas
// ============================================================================

/**
 * Input schema for code/semantic-search
 */
export const SemanticSearchInputSchema = z.object({
  query: z.string().min(1).max(5000),
  scope: z.object({
    paths: z.array(z.string().max(500)).max(100).optional(),
    languages: z.array(Language).max(20).optional(),
    excludeTests: z.boolean().default(false),
  }).optional(),
  searchType: SearchType.default('semantic'),
  topK: z.number().int().min(1).max(1000).default(10),
});

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

/**
 * Input schema for code/architecture-analyze
 */
export const ArchitectureAnalyzeInputSchema = z.object({
  rootPath: z.string().max(500).default('.'),
  analysis: z.array(AnalysisType).optional(),
  baseline: z.string().max(100).optional(),
  outputFormat: OutputFormat.optional(),
  layers: z.record(z.string(), z.array(z.string())).optional(),
});

export type ArchitectureAnalyzeInput = z.infer<typeof ArchitectureAnalyzeInputSchema>;

/**
 * Input schema for code/refactor-impact
 */
export const RefactorImpactInputSchema = z.object({
  changes: z.array(z.object({
    file: z.string().max(500),
    type: ChangeType,
    details: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(100),
  depth: z.number().int().min(1).max(10).default(3),
  includeTests: z.boolean().default(true),
});

export type RefactorImpactInput = z.infer<typeof RefactorImpactInputSchema>;

/**
 * Input schema for code/split-suggest
 */
export const SplitSuggestInputSchema = z.object({
  targetPath: z.string().max(500),
  strategy: SplitStrategy.default('minimize_coupling'),
  constraints: z.object({
    maxModuleSize: z.number().optional(),
    minModuleSize: z.number().optional(),
    preserveBoundaries: z.array(z.string()).optional(),
  }).optional(),
  targetModules: z.number().int().min(2).max(50).optional(),
});

export type SplitSuggestInput = z.infer<typeof SplitSuggestInputSchema>;

/**
 * Input schema for code/learn-patterns
 */
export const LearnPatternsInputSchema = z.object({
  scope: z.object({
    gitRange: z.string().default('HEAD~100..HEAD'),
    authors: z.array(z.string()).optional(),
    paths: z.array(z.string()).optional(),
  }).optional(),
  patternTypes: z.array(PatternType).optional(),
  minOccurrences: z.number().int().min(1).max(100).default(3),
});

export type LearnPatternsInput = z.infer<typeof LearnPatternsInputSchema>;

// ============================================================================
// Bridge Interfaces
// ============================================================================

/**
 * GNN Bridge for code graph analysis
 */
export interface IGNNBridge {
  /**
   * Build code graph from files
   */
  buildCodeGraph(
    files: string[],
    includeCallGraph: boolean
  ): Promise<DependencyGraph>;

  /**
   * Compute node embeddings using GNN
   */
  computeNodeEmbeddings(
    graph: DependencyGraph,
    embeddingDim: number
  ): Promise<Map<string, Float32Array>>;

  /**
   * Predict impact of changes using GNN
   */
  predictImpact(
    graph: DependencyGraph,
    changedNodes: string[],
    depth: number
  ): Promise<Map<string, number>>;

  /**
   * Detect communities in code graph
   */
  detectCommunities(
    graph: DependencyGraph
  ): Promise<Map<string, number>>;

  /**
   * Find similar code patterns
   */
  findSimilarPatterns(
    graph: DependencyGraph,
    patternGraph: DependencyGraph,
    threshold: number
  ): Promise<Array<{ matchId: string; score: number }>>;

  /**
   * Initialize the WASM module
   */
  initialize(): Promise<void>;

  /**
   * Check if initialized
   */
  isInitialized(): boolean;
}

/**
 * MinCut Bridge for module splitting
 */
export interface IMinCutBridge {
  /**
   * Find optimal module boundaries using MinCut
   */
  findOptimalCuts(
    graph: DependencyGraph,
    numModules: number,
    constraints: SplitConstraints
  ): Promise<Map<string, number>>;

  /**
   * Calculate cut weight for a given partition
   */
  calculateCutWeight(
    graph: DependencyGraph,
    partition: Map<string, number>
  ): Promise<number>;

  /**
   * Find minimum s-t cut
   */
  minSTCut(
    graph: DependencyGraph,
    source: string,
    sink: string
  ): Promise<{
    cutValue: number;
    cutEdges: Array<{ from: string; to: string }>;
    sourceSet: string[];
    sinkSet: string[];
  }>;

  /**
   * Multi-way cut for module splitting
   */
  multiWayCut(
    graph: DependencyGraph,
    terminals: string[],
    weights: Map<string, number>
  ): Promise<{
    cutValue: number;
    partitions: Map<string, number>;
  }>;

  /**
   * Initialize the WASM module
   */
  initialize(): Promise<void>;

  /**
   * Check if initialized
   */
  isInitialized(): boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Plugin configuration
 */
export interface CodeIntelligenceConfig {
  /** Semantic search settings */
  search: {
    /** Embedding dimension */
    embeddingDimension: number;
    /** Default top-K results */
    defaultTopK: number;
    /** Similarity threshold */
    similarityThreshold: number;
  };
  /** Architecture analysis settings */
  architecture: {
    /** Layer definitions */
    layers?: Record<string, string[]>;
    /** Maximum graph depth */
    maxGraphDepth: number;
    /** Include vendor/node_modules */
    includeVendor: boolean;
  };
  /** Refactoring settings */
  refactoring: {
    /** Default impact depth */
    defaultDepth: number;
    /** Include test files */
    includeTests: boolean;
  };
  /** Security settings */
  security: {
    /** Allowed root paths */
    allowedRoots: string[];
    /** Block sensitive file patterns */
    blockedPatterns: string[];
    /** Mask secrets in output */
    maskSecrets: boolean;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CodeIntelligenceConfig = {
  search: {
    embeddingDimension: 384,
    defaultTopK: 10,
    similarityThreshold: 0.7,
  },
  architecture: {
    maxGraphDepth: 10,
    includeVendor: false,
  },
  refactoring: {
    defaultDepth: 3,
    includeTests: true,
  },
  security: {
    allowedRoots: ['.'],
    blockedPatterns: [
      '\\.env$',
      '\\.git/config$',
      'credentials',
      'secrets?\\.',
      '\\.pem$',
      '\\.key$',
      'id_rsa',
    ],
    maskSecrets: true,
  },
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Code intelligence plugin error codes
 */
export const CodeIntelligenceErrorCodes = {
  PATH_TRAVERSAL: 'CODE_PATH_TRAVERSAL',
  SENSITIVE_FILE: 'CODE_SENSITIVE_FILE',
  GRAPH_TOO_LARGE: 'CODE_GRAPH_TOO_LARGE',
  ANALYSIS_FAILED: 'CODE_ANALYSIS_FAILED',
  PARSER_ERROR: 'CODE_PARSER_ERROR',
  WASM_NOT_INITIALIZED: 'CODE_WASM_NOT_INITIALIZED',
  LANGUAGE_NOT_SUPPORTED: 'CODE_LANGUAGE_NOT_SUPPORTED',
  GIT_ERROR: 'CODE_GIT_ERROR',
} as const;

export type CodeIntelligenceErrorCode = (typeof CodeIntelligenceErrorCodes)[keyof typeof CodeIntelligenceErrorCodes];

/**
 * Code intelligence plugin error
 */
export class CodeIntelligenceError extends Error {
  public readonly code: CodeIntelligenceErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: CodeIntelligenceErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CodeIntelligenceError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Secret patterns for masking
 */
export const SECRET_PATTERNS = [
  /(['"])(?:api[_-]?key|apikey|secret|password|token|auth)['"]\s*[:=]\s*['"][^'"]+['"]/gi,
  /(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{24,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g,
  /AKIA[0-9A-Z]{16}/g,
];

/**
 * Mask secrets in code snippet
 */
export function maskSecrets(code: string): string {
  let masked = code;
  for (const pattern of SECRET_PATTERNS) {
    masked = masked.replace(pattern, '[REDACTED]');
  }
  return masked;
}

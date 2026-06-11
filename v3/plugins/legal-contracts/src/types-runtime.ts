/**
 * Legal Contracts — schemas, bridges, config & errors
 *
 * The MCP tool-input schemas, bridge interfaces, configuration shapes
 * and error types. Extracted verbatim from types.ts (lines 644-933)
 * during campaign-2 wave 17 (W223). types.ts stays the barrel.
 */

import { z } from 'zod';
import {
  ClauseType,
  ComparisonMode,
  ObligationType,
  PartyRole,
  PlaybookStrictness,
  RiskCategory,
  RiskSeverity,
} from './types-domain.js';
import type {
  ClauseAlignment,
  ExtractedClause,
  Obligation,
  ObligationTrackingResult,
  Playbook,
} from './types-domain.js';

// MCP Tool Input Schemas
// ============================================================================

/**
 * Input schema for legal/clause-extract
 */
export const ClauseExtractInputSchema = z.object({
  document: z.string().max(10_000_000, 'Document size exceeds 10MB limit'),
  clauseTypes: z.array(ClauseType).optional(),
  jurisdiction: z.string().max(50).default('US'),
  includePositions: z.boolean().default(true),
  includeEmbeddings: z.boolean().default(false),
  matterContext: z.object({
    matterId: z.string(),
    clientId: z.string(),
  }).optional(),
});

export type ClauseExtractInput = z.infer<typeof ClauseExtractInputSchema>;

/**
 * Input schema for legal/risk-assess
 */
export const RiskAssessInputSchema = z.object({
  document: z.string().max(10_000_000),
  partyRole: PartyRole,
  riskCategories: z.array(RiskCategory).optional(),
  industryContext: z.string().max(200).optional(),
  threshold: RiskSeverity.optional(),
  includeFinancialImpact: z.boolean().default(true),
  matterContext: z.object({
    matterId: z.string(),
    clientId: z.string(),
  }).optional(),
});

export type RiskAssessInput = z.infer<typeof RiskAssessInputSchema>;

/**
 * Input schema for legal/contract-compare
 */
export const ContractCompareInputSchema = z.object({
  baseDocument: z.string().max(10_000_000),
  compareDocument: z.string().max(10_000_000),
  comparisonMode: ComparisonMode.default('full'),
  highlightChanges: z.boolean().default(true),
  generateRedline: z.boolean().default(false),
  focusClauseTypes: z.array(ClauseType).optional(),
  matterContext: z.object({
    matterId: z.string(),
    clientId: z.string(),
  }).optional(),
});

export type ContractCompareInput = z.infer<typeof ContractCompareInputSchema>;

/**
 * Input schema for legal/obligation-track
 */
export const ObligationTrackInputSchema = z.object({
  document: z.string().max(10_000_000),
  party: z.string().max(200).optional(),
  timeframe: z.string().max(50).optional(),
  obligationTypes: z.array(ObligationType).optional(),
  includeDependencies: z.boolean().default(true),
  includeTimeline: z.boolean().default(true),
  matterContext: z.object({
    matterId: z.string(),
    clientId: z.string(),
  }).optional(),
});

export type ObligationTrackInput = z.infer<typeof ObligationTrackInputSchema>;

/**
 * Input schema for legal/playbook-match
 */
export const PlaybookMatchInputSchema = z.object({
  document: z.string().max(10_000_000),
  playbook: z.string().max(1_000_000, 'Playbook size exceeds 1MB limit'),
  strictness: PlaybookStrictness.default('moderate'),
  suggestAlternatives: z.boolean().default(true),
  prioritizeClauses: z.array(ClauseType).optional(),
  matterContext: z.object({
    matterId: z.string(),
    clientId: z.string(),
  }).optional(),
});

export type PlaybookMatchInput = z.infer<typeof PlaybookMatchInputSchema>;

// ============================================================================
// Bridge Interfaces
// ============================================================================

/**
 * Flash Attention Bridge for clause analysis
 */
export interface IAttentionBridge {
  /**
   * Compute cross-attention between clause embeddings for similarity
   */
  computeCrossAttention(
    queryEmbeddings: Float32Array[],
    keyEmbeddings: Float32Array[],
    mask?: boolean[][]
  ): Promise<Float32Array[][]>;

  /**
   * Align clauses between two documents using attention
   */
  alignClauses(
    baseClauses: ExtractedClause[],
    compareClauses: ExtractedClause[]
  ): Promise<ClauseAlignment[]>;

  /**
   * Find most relevant clauses for a given query
   */
  findRelevantClauses(
    query: string | Float32Array,
    clauses: ExtractedClause[],
    topK: number
  ): Promise<Array<{ clause: ExtractedClause; score: number }>>;

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
 * DAG Bridge for obligation tracking
 */
export interface IDAGBridge {
  /**
   * Build obligation dependency graph
   */
  buildDependencyGraph(
    obligations: Obligation[]
  ): Promise<ObligationTrackingResult['graph']>;

  /**
   * Find critical path through obligations
   */
  findCriticalPath(
    graph: ObligationTrackingResult['graph']
  ): Promise<string[]>;

  /**
   * Perform topological sort of obligations
   */
  topologicalSort(
    obligations: Obligation[]
  ): Promise<Obligation[]>;

  /**
   * Detect cycles in dependency graph
   */
  detectCycles(
    graph: ObligationTrackingResult['graph']
  ): Promise<string[][]>;

  /**
   * Calculate slack/float for each obligation
   */
  calculateFloat(
    graph: ObligationTrackingResult['graph'],
    projectEnd: Date
  ): Promise<Map<string, number>>;

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
export interface LegalContractsConfig {
  /** Clause extraction settings */
  extraction: {
    /** Minimum confidence for clause classification */
    minConfidence: number;
    /** Include semantic embeddings */
    includeEmbeddings: boolean;
    /** Embedding dimension */
    embeddingDimension: number;
  };
  /** Risk assessment settings */
  risk: {
    /** Default risk threshold */
    defaultThreshold: RiskSeverity;
    /** Include financial impact estimates */
    includeFinancialImpact: boolean;
  };
  /** Comparison settings */
  comparison: {
    /** Similarity threshold for clause alignment */
    similarityThreshold: number;
    /** Include redline generation */
    generateRedline: boolean;
  };
  /** Security settings */
  security: {
    /** Enable matter isolation */
    matterIsolation: boolean;
    /** Audit logging level */
    auditLevel: 'minimal' | 'standard' | 'comprehensive';
    /** Allowed document root for file inputs */
    allowedDocumentRoot: string;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: LegalContractsConfig = {
  extraction: {
    minConfidence: 0.7,
    includeEmbeddings: false,
    embeddingDimension: 384,
  },
  risk: {
    defaultThreshold: 'medium',
    includeFinancialImpact: true,
  },
  comparison: {
    similarityThreshold: 0.8,
    generateRedline: false,
  },
  security: {
    matterIsolation: true,
    auditLevel: 'standard',
    allowedDocumentRoot: '/documents',
  },
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Legal contracts plugin error codes
 */
export const LegalErrorCodes = {
  DOCUMENT_TOO_LARGE: 'LEGAL_DOCUMENT_TOO_LARGE',
  INVALID_DOCUMENT_FORMAT: 'LEGAL_INVALID_DOCUMENT_FORMAT',
  CLAUSE_EXTRACTION_FAILED: 'LEGAL_CLAUSE_EXTRACTION_FAILED',
  RISK_ASSESSMENT_FAILED: 'LEGAL_RISK_ASSESSMENT_FAILED',
  COMPARISON_FAILED: 'LEGAL_COMPARISON_FAILED',
  OBLIGATION_PARSING_FAILED: 'LEGAL_OBLIGATION_PARSING_FAILED',
  PLAYBOOK_INVALID: 'LEGAL_PLAYBOOK_INVALID',
  MATTER_ACCESS_DENIED: 'LEGAL_MATTER_ACCESS_DENIED',
  ETHICAL_WALL_VIOLATION: 'LEGAL_ETHICAL_WALL_VIOLATION',
  WASM_NOT_INITIALIZED: 'LEGAL_WASM_NOT_INITIALIZED',
  PRIVILEGE_VIOLATION: 'LEGAL_PRIVILEGE_VIOLATION',
} as const;

export type LegalErrorCode = (typeof LegalErrorCodes)[keyof typeof LegalErrorCodes];

/**
 * Legal contracts plugin error
 */
export class LegalContractsError extends Error {
  public readonly code: LegalErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: LegalErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'LegalContractsError';
    this.code = code;
    this.details = details;
  }
}

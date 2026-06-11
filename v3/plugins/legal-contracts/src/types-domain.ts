/**
 * Legal Contracts — domain types
 *
 * Clause/risk/comparison/obligation/playbook/document/security shapes
 * (zod-backed enums with their z.infer twins). Extracted verbatim from
 * types.ts (lines 15-643) during campaign-2 wave 17 (W223). types.ts
 * stays the barrel.
 */

import { z } from 'zod';

// Clause Types
// ============================================================================

/**
 * Supported clause types for extraction
 */
export const ClauseType = z.enum([
  'indemnification',
  'limitation_of_liability',
  'termination',
  'confidentiality',
  'ip_assignment',
  'governing_law',
  'arbitration',
  'force_majeure',
  'warranty',
  'payment_terms',
  'non_compete',
  'non_solicitation',
  'assignment',
  'insurance',
  'representations',
  'covenants',
  'data_protection',
  'audit_rights',
]);

export type ClauseType = z.infer<typeof ClauseType>;

/**
 * Extracted clause with position and classification
 */
export interface ExtractedClause {
  /** Unique identifier for this clause */
  readonly id: string;
  /** Type of clause */
  readonly type: ClauseType;
  /** Raw text content of the clause */
  readonly text: string;
  /** Clause title or heading if present */
  readonly title?: string;
  /** Start position in document */
  readonly startOffset: number;
  /** End position in document */
  readonly endOffset: number;
  /** Section/article number if identifiable */
  readonly section?: string;
  /** Confidence score for classification (0-1) */
  readonly confidence: number;
  /** Sub-clauses or nested provisions */
  readonly subClauses?: ExtractedClause[];
  /** Key terms identified within clause */
  readonly keyTerms: string[];
  /** Semantic embedding vector for similarity matching */
  readonly embedding?: Float32Array;
}

/**
 * Result from clause extraction
 */
export interface ClauseExtractionResult {
  /** Success status */
  readonly success: boolean;
  /** Extracted clauses */
  readonly clauses: ExtractedClause[];
  /** Document metadata */
  readonly metadata: DocumentMetadata;
  /** Clauses that could not be classified */
  readonly unclassified: Array<{
    text: string;
    startOffset: number;
    endOffset: number;
    reason: string;
  }>;
  /** Execution time in ms */
  readonly durationMs: number;
}

// ============================================================================
// Risk Assessment Types
// ============================================================================

/**
 * Party role in the contract
 */
export const PartyRole = z.enum([
  'buyer',
  'seller',
  'licensor',
  'licensee',
  'employer',
  'employee',
  'landlord',
  'tenant',
  'lender',
  'borrower',
  'service_provider',
  'client',
]);

export type PartyRole = z.infer<typeof PartyRole>;

/**
 * Risk categories for assessment
 */
export const RiskCategory = z.enum([
  'financial',
  'operational',
  'legal',
  'reputational',
  'compliance',
  'strategic',
  'security',
  'performance',
]);

export type RiskCategory = z.infer<typeof RiskCategory>;

/**
 * Risk severity levels
 */
export const RiskSeverity = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export type RiskSeverity = z.infer<typeof RiskSeverity>;

/**
 * Individual risk finding
 */
export interface RiskFinding {
  /** Unique identifier */
  readonly id: string;
  /** Risk category */
  readonly category: RiskCategory;
  /** Severity level */
  readonly severity: RiskSeverity;
  /** Risk title/summary */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Associated clause(s) */
  readonly clauseIds: string[];
  /** Potential financial impact range */
  readonly financialImpact?: {
    min: number;
    max: number;
    currency: string;
    probability: number;
  };
  /** Suggested mitigation strategies */
  readonly mitigations: string[];
  /** Legal precedent or standard deviation flag */
  readonly deviatesFromStandard: boolean;
  /** Confidence in assessment (0-1) */
  readonly confidence: number;
  /** Jurisdiction-specific notes */
  readonly jurisdictionNotes?: string;
}

/**
 * Overall risk assessment result
 */
export interface RiskAssessmentResult {
  /** Success status */
  readonly success: boolean;
  /** Party role perspective used */
  readonly partyRole: PartyRole;
  /** All risk findings */
  readonly risks: RiskFinding[];
  /** Summary by category */
  readonly categorySummary: Record<RiskCategory, {
    count: number;
    highestSeverity: RiskSeverity;
    averageScore: number;
  }>;
  /** Overall risk score (0-100) */
  readonly overallScore: number;
  /** Risk grade (A-F) */
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Top 5 most critical risks */
  readonly criticalRisks: RiskFinding[];
  /** Execution time in ms */
  readonly durationMs: number;
}

// ============================================================================
// Contract Comparison Types
// ============================================================================

/**
 * Comparison mode for contract analysis
 */
export const ComparisonMode = z.enum([
  'structural',  // Compare document structure only
  'semantic',    // Compare meaning/intent
  'full',        // Both structural and semantic
]);

export type ComparisonMode = z.infer<typeof ComparisonMode>;

/**
 * Type of change detected
 */
export type ChangeType = 'added' | 'removed' | 'modified' | 'moved' | 'unchanged';

/**
 * Individual change between contracts
 */
export interface ContractChange {
  /** Change type */
  readonly type: ChangeType;
  /** Clause type affected */
  readonly clauseType?: ClauseType;
  /** Section in base document */
  readonly baseSection?: string;
  /** Section in compare document */
  readonly compareSection?: string;
  /** Original text */
  readonly baseText?: string;
  /** New/changed text */
  readonly compareText?: string;
  /** Significance score (0-1) */
  readonly significance: number;
  /** Impact assessment */
  readonly impact: 'favorable' | 'unfavorable' | 'neutral' | 'requires_review';
  /** Detailed explanation of change */
  readonly explanation: string;
  /** Suggested action */
  readonly suggestedAction?: string;
}

/**
 * Semantic alignment between clauses
 */
export interface ClauseAlignment {
  /** Base document clause ID */
  readonly baseClauseId: string;
  /** Compare document clause ID */
  readonly compareClauseId: string;
  /** Similarity score (0-1) */
  readonly similarity: number;
  /** Alignment type */
  readonly alignmentType: 'exact' | 'similar' | 'related' | 'no_match';
  /** Key differences */
  readonly differences: string[];
}

/**
 * Contract comparison result
 */
export interface ContractComparisonResult {
  /** Success status */
  readonly success: boolean;
  /** Comparison mode used */
  readonly mode: ComparisonMode;
  /** All detected changes */
  readonly changes: ContractChange[];
  /** Clause alignments */
  readonly alignments: ClauseAlignment[];
  /** Overall similarity score (0-1) */
  readonly similarityScore: number;
  /** Summary statistics */
  readonly summary: {
    totalChanges: number;
    added: number;
    removed: number;
    modified: number;
    favorable: number;
    unfavorable: number;
  };
  /** Redline markup if requested */
  readonly redlineMarkup?: string;
  /** Execution time in ms */
  readonly durationMs: number;
}

// ============================================================================
// Obligation Tracking Types
// ============================================================================

/**
 * Obligation types
 */
export const ObligationType = z.enum([
  'payment',
  'delivery',
  'notification',
  'approval',
  'compliance',
  'reporting',
  'confidentiality',
  'performance',
  'insurance',
  'renewal',
  'termination',
]);

export type ObligationType = z.infer<typeof ObligationType>;

/**
 * Obligation status
 */
export type ObligationStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived';

/**
 * Extracted obligation
 */
export interface Obligation {
  /** Unique identifier */
  readonly id: string;
  /** Obligation type */
  readonly type: ObligationType;
  /** Responsible party */
  readonly party: string;
  /** Obligation description */
  readonly description: string;
  /** Due date if applicable */
  readonly dueDate?: Date;
  /** Deadline type */
  readonly deadlineType?: 'hard' | 'soft' | 'recurring';
  /** Recurrence pattern (ISO 8601 duration) */
  readonly recurrence?: string;
  /** Triggering condition */
  readonly triggerCondition?: string;
  /** Dependencies (other obligation IDs) */
  readonly dependsOn: string[];
  /** Obligations blocked by this one */
  readonly blocks: string[];
  /** Associated clause IDs */
  readonly clauseIds: string[];
  /** Monetary value if applicable */
  readonly monetaryValue?: {
    amount: number;
    currency: string;
  };
  /** Penalty for non-compliance */
  readonly penalty?: string;
  /** Current status */
  readonly status: ObligationStatus;
  /** Priority level */
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Obligation dependency graph node
 */
export interface ObligationNode {
  /** Obligation */
  readonly obligation: Obligation;
  /** Incoming edges (dependencies) */
  readonly dependencies: string[];
  /** Outgoing edges (dependents) */
  readonly dependents: string[];
  /** Critical path flag */
  readonly onCriticalPath: boolean;
  /** Earliest start date */
  readonly earliestStart?: Date;
  /** Latest finish date */
  readonly latestFinish?: Date;
  /** Float/slack time in days */
  readonly floatDays?: number;
}

/**
 * Obligation tracking result
 */
export interface ObligationTrackingResult {
  /** Success status */
  readonly success: boolean;
  /** All obligations */
  readonly obligations: Obligation[];
  /** Dependency graph */
  readonly graph: {
    nodes: ObligationNode[];
    edges: Array<{
      from: string;
      to: string;
      type: 'depends_on' | 'blocks' | 'triggers';
    }>;
  };
  /** Timeline view */
  readonly timeline: Array<{
    date: Date;
    obligations: string[];
    isMilestone: boolean;
  }>;
  /** Upcoming deadlines (next 30 days) */
  readonly upcomingDeadlines: Obligation[];
  /** Overdue obligations */
  readonly overdue: Obligation[];
  /** Execution time in ms */
  readonly durationMs: number;
}

// ============================================================================
// Playbook Types
// ============================================================================

/**
 * Strictness level for playbook matching
 */
export const PlaybookStrictness = z.enum([
  'strict',     // Exact match required
  'moderate',   // Minor deviations acceptable
  'flexible',   // Major deviations with justification
]);

export type PlaybookStrictness = z.infer<typeof PlaybookStrictness>;

/**
 * Playbook position for a clause type
 */
export interface PlaybookPosition {
  /** Clause type */
  readonly clauseType: ClauseType;
  /** Preferred language/position */
  readonly preferredLanguage: string;
  /** Acceptable variations */
  readonly acceptableVariations: string[];
  /** Red lines (non-negotiable) */
  readonly redLines: string[];
  /** Fallback positions in order of preference */
  readonly fallbackPositions: Array<{
    language: string;
    priority: number;
    conditions?: string;
  }>;
  /** Negotiation notes */
  readonly negotiationNotes: string;
  /** Business justification */
  readonly businessJustification: string;
}

/**
 * Complete playbook
 */
export interface Playbook {
  /** Playbook identifier */
  readonly id: string;
  /** Playbook name */
  readonly name: string;
  /** Contract type this applies to */
  readonly contractType: string;
  /** Jurisdiction */
  readonly jurisdiction: string;
  /** Party role perspective */
  readonly partyRole: PartyRole;
  /** Last updated */
  readonly updatedAt: Date;
  /** Version */
  readonly version: string;
  /** Positions by clause type */
  readonly positions: PlaybookPosition[];
}

/**
 * Match result for a single clause
 */
export interface PlaybookMatch {
  /** Clause from document */
  readonly clauseId: string;
  /** Matching playbook position */
  readonly position: PlaybookPosition;
  /** Match status */
  readonly status: 'matches_preferred' | 'matches_acceptable' | 'requires_fallback' | 'violates_redline' | 'no_match';
  /** Similarity to preferred position (0-1) */
  readonly preferredSimilarity: number;
  /** Best matching fallback if applicable */
  readonly matchedFallback?: {
    language: string;
    priority: number;
    similarity: number;
  };
  /** Suggested alternative language */
  readonly suggestedAlternative?: string;
  /** Negotiation recommendation */
  readonly recommendation: string;
  /** Risk if current language accepted */
  readonly riskIfAccepted?: string;
}

/**
 * Playbook matching result
 */
export interface PlaybookMatchResult {
  /** Success status */
  readonly success: boolean;
  /** Playbook used */
  readonly playbook: {
    id: string;
    name: string;
    version: string;
  };
  /** Match results per clause */
  readonly matches: PlaybookMatch[];
  /** Summary */
  readonly summary: {
    totalClauses: number;
    matchesPreferred: number;
    matchesAcceptable: number;
    requiresFallback: number;
    violatesRedline: number;
    noMatch: number;
  };
  /** Red line violations requiring attention */
  readonly redLineViolations: PlaybookMatch[];
  /** Negotiation priorities (ordered) */
  readonly negotiationPriorities: Array<{
    clauseId: string;
    priority: number;
    reason: string;
  }>;
  /** Execution time in ms */
  readonly durationMs: number;
}

// ============================================================================
// Document Types
// ============================================================================

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Document identifier */
  readonly id: string;
  /** Document title */
  readonly title?: string;
  /** Document format */
  readonly format: 'pdf' | 'docx' | 'txt' | 'html';
  /** Total pages */
  readonly pages?: number;
  /** Total words */
  readonly wordCount: number;
  /** Total characters */
  readonly charCount: number;
  /** Detected language */
  readonly language: string;
  /** Contract type if identified */
  readonly contractType?: string;
  /** Effective date if found */
  readonly effectiveDate?: Date;
  /** Expiration date if found */
  readonly expirationDate?: Date;
  /** Parties identified */
  readonly parties: Array<{
    name: string;
    role?: PartyRole;
    address?: string;
  }>;
  /** Governing law jurisdiction */
  readonly governingLaw?: string;
  /** Document hash for integrity */
  readonly contentHash: string;
}

// ============================================================================
// Security Types (Attorney-Client Privilege Protection)
// ============================================================================

/**
 * Matter isolation context
 */
export interface MatterContext {
  /** Unique matter identifier */
  readonly matterId: string;
  /** Client identifier */
  readonly clientId: string;
  /** Authorized users */
  readonly authorizedUsers: string[];
  /** Ethical wall restrictions */
  readonly ethicalWalls?: string[];
  /** Audit log reference */
  readonly auditLogId: string;
}

/**
 * User role for access control
 */
export const UserRole = z.enum([
  'partner',
  'associate',
  'paralegal',
  'contract_manager',
  'client',
]);

export type UserRole = z.infer<typeof UserRole>;

/**
 * Tool access permissions by role
 */
export const RolePermissions: Record<UserRole, string[]> = {
  partner: ['clause-extract', 'risk-assess', 'contract-compare', 'obligation-track', 'playbook-match'],
  associate: ['clause-extract', 'risk-assess', 'contract-compare', 'obligation-track'],
  paralegal: ['clause-extract', 'obligation-track'],
  contract_manager: ['obligation-track', 'playbook-match'],
  client: [], // No direct tool access
};

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Timestamp (ISO 8601) */
  readonly timestamp: string;
  /** User ID */
  readonly userId: string;
  /** User role at time of access */
  readonly userRole: UserRole;
  /** Matter ID */
  readonly matterId: string;
  /** Tool invoked */
  readonly toolName: string;
  /** Document hash (not content) */
  readonly documentHash: string;
  /** Operation type */
  readonly operationType: 'analyze' | 'compare' | 'export';
  /** High-level result (no privileged content) */
  readonly resultSummary: string;
  /** Optional billing reference */
  readonly billingCode?: string;
}

// ============================================================================

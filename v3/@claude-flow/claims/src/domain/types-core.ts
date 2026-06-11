/**
 * Claims Domain — core claim types, value objects, entities & errors
 *
 * Extracted verbatim from types.ts (lines 11-241) during campaign-2
 * wave 45 (W251). types.ts stays the barrel.
 */

// Core Types
// =============================================================================

/**
 * Unique identifier for claims
 */
export type ClaimId = `claim-${string}`;

/**
 * Unique identifier for issues
 */
export type IssueId = string;

/**
 * Claimant type - human or agent
 */
export type ClaimantType = 'human' | 'agent';

/**
 * Claim status lifecycle
 */
export type ClaimStatus =
  | 'active'           // Claim is active and work is in progress
  | 'pending_handoff'  // Handoff has been requested but not accepted
  | 'in_review'        // Work is complete, awaiting review
  | 'completed'        // Claim is completed successfully
  | 'released'         // Claim was released voluntarily
  | 'expired'          // Claim expired due to inactivity
  | 'paused'           // Work is temporarily paused
  | 'blocked'          // Work is blocked by external dependency
  | 'stealable';       // Claim can be stolen by another agent

/**
 * Issue labels/tags
 */
export type IssueLabel = string;

/**
 * Issue priority levels
 */
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Issue complexity levels
 */
export type IssueComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';

// =============================================================================
// Value Objects
// =============================================================================

/**
 * Duration value object for time-based operations
 */
export interface Duration {
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

/**
 * Convert duration to milliseconds
 */
export function durationToMs(duration: Duration): number {
  const multipliers: Record<Duration['unit'], number> = {
    ms: 1,
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };
  return duration.value * multipliers[duration.unit];
}

// =============================================================================
// Entity Interfaces
// =============================================================================

/**
 * Claimant - a human or agent that can claim issues
 */
export interface Claimant {
  id: string;
  type: ClaimantType;
  name: string;
  capabilities?: string[];
  specializations?: string[];
  currentWorkload?: number;
  maxConcurrentClaims?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Issue - a work item that can be claimed
 */
export interface Issue {
  id: IssueId;
  title: string;
  description: string;
  labels: IssueLabel[];
  priority: IssuePriority;
  complexity: IssueComplexity;
  requiredCapabilities?: string[];
  estimatedDuration?: Duration;
  repositoryId?: string;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Issue claim - represents an active claim on an issue
 */
export interface IssueClaim {
  id: ClaimId;
  issueId: IssueId;
  claimant: Claimant;
  status: ClaimStatus;
  claimedAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
  notes?: string[];
  handoffChain?: HandoffRecord[];
  reviewers?: Claimant[];
  metadata?: Record<string, unknown>;
}

/**
 * Handoff record - tracks handoff history
 */
export interface HandoffRecord {
  id: string;
  from: Claimant;
  to: Claimant;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: Date;
  resolvedAt?: Date;
  rejectionReason?: string;
}

/**
 * Issue with claim information
 */
export interface IssueWithClaim {
  issue: Issue;
  claim: IssueClaim | null;
  pendingHandoffs: HandoffRecord[];
}

/**
 * Claim result - returned when claiming an issue
 */
export interface ClaimResult {
  success: boolean;
  claim?: IssueClaim;
  error?: ClaimError;
}

// =============================================================================
// Filter/Query Types
// =============================================================================

/**
 * Filters for querying issues
 */
export interface IssueFilters {
  labels?: IssueLabel[];
  priority?: IssuePriority[];
  complexity?: IssueComplexity[];
  requiredCapabilities?: string[];
  excludeClaimed?: boolean;
  repositoryId?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Claim error codes
 */
export type ClaimErrorCode =
  | 'ALREADY_CLAIMED'
  | 'NOT_CLAIMED'
  | 'CLAIM_NOT_FOUND'
  | 'ISSUE_NOT_FOUND'
  | 'CLAIMANT_NOT_FOUND'
  | 'INVALID_CLAIMANT'
  | 'HANDOFF_PENDING'
  | 'HANDOFF_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'MAX_CLAIMS_EXCEEDED'
  | 'CAPABILITY_MISMATCH'
  | 'INVALID_STATUS_TRANSITION'
  | 'VALIDATION_ERROR';

/**
 * Claim error with details
 */
export interface ClaimError {
  code: ClaimErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Custom error class for claim operations
 */
export class ClaimOperationError extends Error {
  constructor(
    public readonly code: ClaimErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ClaimOperationError';
  }

  toClaimError(): ClaimError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// =============================================================================

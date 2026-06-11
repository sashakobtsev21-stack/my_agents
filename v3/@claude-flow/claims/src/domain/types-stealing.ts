/**
 * Claims Domain — work-stealing types, events, ports & defaults
 *
 * Extracted verbatim from types.ts (lines 242-826) during campaign-2
 * wave 45 (W251). types.ts stays the barrel.
 */

import type {
  ClaimId,
  Claimant,
  ClaimantType,
  IssueClaim,
  IssueId,
  IssuePriority,
} from './types-core.js';

// Work Stealing Types
// =============================================================================

/**
 * Agent type for cross-type steal rules
 */
export type AgentType =
  | 'coder'
  | 'debugger'
  | 'tester'
  | 'reviewer'
  | 'researcher'
  | 'planner'
  | 'architect'
  | 'coordinator';

/**
 * Reason an issue became stealable
 */
export type StealableReason =
  | 'stale'           // No progress for staleThresholdMinutes
  | 'blocked'         // Blocked for blockedThresholdMinutes
  | 'overloaded'      // Agent has too many claims
  | 'manual'          // Manually marked as stealable
  | 'timeout';        // Task timed out

/**
 * Information about why an issue is stealable
 */
export interface StealableInfo {
  reason: StealableReason;
  markedAt: Date;
  expiresAt?: Date;
  originalProgress: number;
  allowedStealerTypes?: AgentType[];
}

/**
 * Error codes specific to steal operations
 */
export type StealErrorCode =
  | 'NOT_STEALABLE'
  | 'ALREADY_CLAIMED'
  | 'CROSS_TYPE_NOT_ALLOWED'
  | 'IN_GRACE_PERIOD'
  | 'PROTECTED_BY_PROGRESS'
  | 'STEALER_OVERLOADED'
  | 'ISSUE_NOT_FOUND'
  | 'CONTEST_PENDING';

/**
 * Result of a steal operation
 */
export interface StealResult {
  success: boolean;
  claim?: IssueClaim;
  previousClaimant?: Claimant;
  contestWindowEndsAt?: Date;
  error?: string;
  errorCode?: StealErrorCode;
}

/**
 * Information about a contested steal
 */
export interface ContestInfo {
  contestedAt: Date;
  contestedBy: Claimant;
  stolenBy: Claimant;
  reason: string;
  windowEndsAt: Date;
  resolution?: ContestResolution;
}

/**
 * Resolution of a contest
 */
export interface ContestResolution {
  resolvedAt: Date;
  winner: Claimant;
  resolvedBy: 'queen' | 'human' | 'timeout';
  reason: string;
}

/**
 * Work stealing configuration
 */
export interface WorkStealingConfig {
  /** Minutes without progress before issue becomes stealable */
  staleThresholdMinutes: number;

  /** Minutes blocked before issue becomes stealable */
  blockedThresholdMinutes: number;

  /** Max claims per agent before lowest priority becomes stealable */
  overloadThreshold: number;

  /** Minutes after claiming before work can be stolen */
  gracePeriodMinutes: number;

  /** Progress percentage that protects from stealing (0-100) */
  minProgressToProtect: number;

  /** Minutes to contest a steal */
  contestWindowMinutes: number;

  /** Enable cross-type stealing */
  allowCrossTypeSteal: boolean;

  /** Agent type pairs that can steal from each other */
  crossTypeStealRules: [AgentType, AgentType][];
}

/**
 * Default work stealing configuration
 */
export const DEFAULT_WORK_STEALING_CONFIG: WorkStealingConfig = {
  staleThresholdMinutes: 30,
  blockedThresholdMinutes: 60,
  overloadThreshold: 5,
  gracePeriodMinutes: 10,
  minProgressToProtect: 75,
  contestWindowMinutes: 5,
  allowCrossTypeSteal: true,
  crossTypeStealRules: [
    ['coder', 'debugger'],
    ['tester', 'reviewer'],
  ],
};

/**
 * Extended IssueClaim with work stealing properties
 */
export interface IssueClaimWithStealing extends IssueClaim {
  progress: number;           // 0-100 percentage
  blockedReason?: string;
  blockedAt?: Date;
  stealableAt?: Date;
  stealInfo?: StealableInfo;
  contestInfo?: ContestInfo;
}

// =============================================================================
// Work Stealing Events
// =============================================================================

/**
 * Event types for work stealing
 */
export type WorkStealingEventType =
  | 'IssueMarkedStealable'
  | 'IssueStolen'
  | 'StealContested'
  | 'StealContestResolved';

/**
 * Base event interface for work stealing
 */
export interface WorkStealingEvent {
  id: string;
  type: WorkStealingEventType;
  timestamp: Date;
  issueId: IssueId;
  claimId: ClaimId;
  payload: unknown;
}

/**
 * Event: Issue marked as stealable
 */
export interface IssueMarkedStealableEvent extends WorkStealingEvent {
  type: 'IssueMarkedStealable';
  payload: {
    info: StealableInfo;
    currentClaimant: Claimant;
    claim: IssueClaimWithStealing;
  };
}

/**
 * Event: Issue stolen
 */
export interface IssueStolenEvent extends WorkStealingEvent {
  type: 'IssueStolen';
  payload: {
    previousClaimant: Claimant;
    newClaimant: Claimant;
    stealableInfo: StealableInfo;
    contestWindowEndsAt: Date;
  };
}

/**
 * Event: Steal contested
 */
export interface StealContestedEvent extends WorkStealingEvent {
  type: 'StealContested';
  payload: {
    contestInfo: ContestInfo;
    claim: IssueClaimWithStealing;
  };
}

/**
 * Event: Contest resolved
 */
export interface StealContestResolvedEvent extends WorkStealingEvent {
  type: 'StealContestResolved';
  payload: {
    contestInfo: ContestInfo;
    resolution: ContestResolution;
    winnerClaim: IssueClaimWithStealing;
  };
}

// =============================================================================
// Repository Interface for Work Stealing
// =============================================================================

/**
 * Repository interface for issue claims with work stealing support
 */
export interface IIssueClaimRepository {
  findById(id: ClaimId): Promise<IssueClaimWithStealing | null>;
  findByIssueId(issueId: IssueId): Promise<IssueClaimWithStealing | null>;
  findByAgentId(agentId: string): Promise<IssueClaimWithStealing[]>;
  findStealable(agentType?: AgentType): Promise<IssueClaimWithStealing[]>;
  findContested(): Promise<IssueClaimWithStealing[]>;
  findAll(): Promise<IssueClaimWithStealing[]>;
  save(claim: IssueClaimWithStealing): Promise<void>;
  update(claim: IssueClaimWithStealing): Promise<void>;
  delete(id: ClaimId): Promise<void>;
  countByAgentId(agentId: string): Promise<number>;
}

// =============================================================================
// Event Bus Interface for Work Stealing
// =============================================================================

/**
 * Event bus interface for work stealing events
 */
export interface IWorkStealingEventBus {
  emit(event: WorkStealingEvent): Promise<void>;
  subscribe(
    eventType: WorkStealingEventType,
    handler: (event: WorkStealingEvent) => void | Promise<void>
  ): () => void;
  subscribeAll(handler: (event: WorkStealingEvent) => void | Promise<void>): () => void;
}

// =============================================================================
// ADR-016 Extended Types
// =============================================================================

/**
 * Extended claim status per ADR-016
 * Includes all lifecycle states for human/agent claiming
 */
export type ExtendedClaimStatus =
  | 'active'           // Claim is being actively worked on
  | 'paused'           // Work is temporarily paused
  | 'handoff-pending'  // Handoff has been requested, awaiting acceptance
  | 'review-requested' // Claimant is requesting a review
  | 'blocked'          // Work is blocked by external dependency
  | 'stealable'        // Claim can be stolen by another agent
  | 'completed';       // Work is finished

/**
 * Agent identifier type
 */
export type AgentId = `agent-${string}` | string;

/**
 * Human user identifier
 */
export type UserId = string;

/**
 * Reasons why a claim might be blocked
 */
export type BlockedReason =
  | 'dependency'       // Waiting on another issue/PR
  | 'external'         // Waiting on external resource
  | 'clarification'    // Waiting for clarification from maintainer
  | 'resource'         // Waiting for computational resource
  | 'approval'         // Waiting for approval
  | 'other';           // Other reason

/**
 * Information about a blocked claim
 */
export interface BlockedInfo {
  readonly reason: BlockedReason;
  readonly description: string;
  readonly relatedIssues: readonly IssueId[];
  readonly blockedAt: number;
  readonly estimatedUnblockTime?: number;
}

/**
 * Reason for work stealing per ADR-016
 */
export type StealReason =
  | 'timeout'          // Original claimant timed out
  | 'overloaded'       // Original claimant is overloaded
  | 'blocked'          // Claim has been blocked too long
  | 'voluntary'        // Original claimant voluntarily released
  | 'rebalancing'      // System is rebalancing load
  | 'abandoned'        // Claimant appears to have abandoned work
  | 'priority-change'; // Higher priority claimant needs this issue

/**
 * Extended StealableInfo per ADR-016
 */
export interface ExtendedStealableInfo {
  readonly reason: StealReason;
  readonly markedAt: number;
  readonly originalClaimant: Claimant;
  readonly minPriorityToSteal: IssuePriority;
  readonly requiresContest: boolean;
  readonly gracePeriodMs: number;
  readonly gracePeriodEndsAt: number;
  readonly previousSteals: number;
  readonly interestedAgents: readonly AgentId[];
}

/**
 * Handoff reason per ADR-016
 */
export type HandoffReason =
  | 'capacity'         // Current claimant at capacity
  | 'expertise'        // Target has better expertise
  | 'shift-change'     // Scheduled handoff
  | 'escalation'       // Issue needs escalation
  | 'voluntary'        // Voluntary transfer
  | 'rebalancing';     // System rebalancing

/**
 * Extended handoff info per ADR-016
 */
export interface ExtendedHandoffInfo {
  readonly initiatedBy: AgentId | UserId;
  readonly targetClaimant: Claimant;
  readonly requestedAt: number;
  readonly expiresAt: number;
  readonly reason: HandoffReason;
  readonly notes?: string;
  readonly contextSummary?: string;
  readonly artifacts: readonly string[];
}

/**
 * Claimant workload metrics per ADR-016
 */
export interface ClaimantWorkload {
  readonly activeClaims: number;
  readonly pausedClaims: number;
  readonly pendingHandoffs: number;
  readonly completedClaims: number;
  readonly averageCompletionTime: number;
  readonly loadPercentage: number;
  readonly availableCapacity: number;
}

/**
 * Extended Claimant with ADR-016 properties
 */
export interface ExtendedClaimant extends Claimant {
  readonly workload: ClaimantWorkload;
  readonly priority: number;
  readonly registeredAt: number;
  readonly lastActivityAt: number;
  readonly isAvailable: boolean;
}

/**
 * Agent load information per ADR-016
 */
export interface AgentLoadInfo {
  readonly agentId: AgentId;
  readonly name: string;
  readonly activeClaims: number;
  readonly maxClaims: number;
  readonly loadPercentage: number;
  readonly isOverloaded: boolean;
  readonly isUnderloaded: boolean;
  readonly capabilities: readonly string[];
  readonly processingRate: number;
  readonly avgClaimDuration: number;
  readonly queueDepth: number;
  readonly healthScore: number;
}

/**
 * Claim move during rebalancing
 */
export interface ClaimMove {
  readonly claimId: ClaimId;
  readonly fromAgent: AgentId;
  readonly toAgent: AgentId;
  readonly reason: string;
  readonly success: boolean;
}

/**
 * Rebalancing error
 */
export interface RebalanceError {
  readonly claimId: ClaimId;
  readonly error: string;
  readonly recoverable: boolean;
}

/**
 * Rebalance result per ADR-016
 */
export interface ExtendedRebalanceResult {
  readonly success: boolean;
  readonly claimsMoved: number;
  readonly moves: readonly ClaimMove[];
  readonly overloadedAgents: readonly AgentId[];
  readonly underloadedAgents: readonly AgentId[];
  readonly loadBefore: readonly AgentLoadInfo[];
  readonly loadAfter: readonly AgentLoadInfo[];
  readonly durationMs: number;
  readonly errors: readonly RebalanceError[];
  readonly timestamp: number;
}

/**
 * Rebalance strategy
 */
export type RebalanceStrategy =
  | 'oldest-first'      // Move oldest claims first
  | 'newest-first'      // Move newest claims first
  | 'lowest-priority'   // Move lowest priority claims first
  | 'least-progress'    // Move claims with least progress first
  | 'capability-match'; // Move to best capability match

/**
 * Load balancing configuration per ADR-016
 */
export interface LoadBalancingConfig {
  readonly enabled: boolean;
  readonly checkIntervalMs: number;
  readonly overloadThreshold: number;
  readonly underloadThreshold: number;
  readonly rebalanceThreshold: number;
  readonly maxMovesPerRebalance: number;
  readonly selectionStrategy: RebalanceStrategy;
  readonly respectCapabilities: boolean;
  readonly cooldownMs: number;
}

/**
 * Default load balancing config
 */
export const DEFAULT_LOAD_BALANCING_CONFIG: LoadBalancingConfig = {
  enabled: true,
  checkIntervalMs: 5 * 60 * 1000, // 5 minutes
  overloadThreshold: 90,
  underloadThreshold: 30,
  rebalanceThreshold: 40,
  maxMovesPerRebalance: 5,
  selectionStrategy: 'capability-match',
  respectCapabilities: true,
  cooldownMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Extended IssueClaim with all ADR-016 properties
 */
export interface ExtendedIssueClaim {
  readonly id: ClaimId;
  readonly issueId: IssueId;
  readonly repository: string;
  readonly claimant: ExtendedClaimant;
  readonly status: ExtendedClaimStatus;
  readonly claimedAt: number;
  readonly updatedAt: number;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly expiresAt?: number;
  readonly priority: IssuePriority;
  readonly tags: readonly string[];
  readonly progress: number;
  readonly blockedInfo?: BlockedInfo;
  readonly stealableInfo?: ExtendedStealableInfo;
  readonly handoffInfo?: ExtendedHandoffInfo;
  readonly pullRequestId?: number;
  readonly notes: readonly ClaimNote[];
  readonly statusHistory: readonly StatusChange[];
  readonly metadata: Record<string, unknown>;
}

/**
 * Claim note
 */
export interface ClaimNote {
  readonly id: string;
  readonly content: string;
  readonly authorId: AgentId | UserId;
  readonly createdAt: number;
  readonly type: 'progress' | 'question' | 'blocker' | 'general';
}

/**
 * Status change record
 */
export interface StatusChange {
  readonly fromStatus: ExtendedClaimStatus;
  readonly toStatus: ExtendedClaimStatus;
  readonly changedAt: number;
  readonly changedBy: AgentId | UserId;
  readonly reason?: string;
}

/**
 * Query options for claims
 */
export interface ClaimQueryOptions {
  readonly claimantId?: AgentId | UserId;
  readonly claimantType?: ClaimantType;
  readonly status?: ExtendedClaimStatus | readonly ExtendedClaimStatus[];
  readonly repository?: string;
  readonly issueId?: IssueId;
  readonly priority?: IssuePriority | readonly IssuePriority[];
  readonly tags?: readonly string[];
  readonly createdAfter?: number;
  readonly createdBefore?: number;
  readonly updatedAfter?: number;
  readonly stealableOnly?: boolean;
  readonly blockedOnly?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'claimedAt' | 'updatedAt' | 'priority' | 'progress';
  readonly sortDirection?: 'asc' | 'desc';
}

/**
 * Claim statistics
 */
export interface ClaimStatistics {
  readonly totalClaims: number;
  readonly byStatus: Record<ExtendedClaimStatus, number>;
  readonly byPriority: Record<IssuePriority, number>;
  readonly byClaimantType: Record<ClaimantType, number>;
  readonly avgDurationMs: number;
  readonly avgProgress: number;
  readonly activeSteals: number;
  readonly pendingHandoffs: number;
  readonly completedLast24h: number;
  readonly byRepository: Record<string, number>;
}

/**
 * Helper function to generate unique claim IDs
 */
export function generateClaimId(): ClaimId {
  return `claim-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if a status is an active claim status
 */
export function isActiveClaimStatus(status: ExtendedClaimStatus): boolean {
  return ['active', 'paused', 'blocked', 'handoff-pending', 'review-requested'].includes(status);
}

/**
 * Get valid status transitions per ADR-016
 */
export function getValidStatusTransitions(currentStatus: ExtendedClaimStatus): readonly ExtendedClaimStatus[] {
  const transitions: Record<ExtendedClaimStatus, readonly ExtendedClaimStatus[]> = {
    'active': ['paused', 'blocked', 'handoff-pending', 'review-requested', 'stealable', 'completed'],
    'paused': ['active', 'blocked', 'handoff-pending', 'stealable', 'completed'],
    'blocked': ['active', 'paused', 'stealable', 'completed'],
    'handoff-pending': ['active', 'completed'],
    'review-requested': ['active', 'completed', 'blocked'],
    'stealable': ['active', 'completed'],
    'completed': [],
  };
  return transitions[currentStatus];
}

/**
 * Type definitions for the claim service — claimant/status/steal-reason
 * unions, the IssueClaim / StealableInfo / *Result / AgentLoadInfo /
 * RebalanceResult / WorkStealingConfig / IssueFilters / GitHub* shapes,
 * the claim-event types, and DEFAULT_CONFIG.
 *
 * Extracted from claim-service.ts (W147, P3.28 cut #1).
 */

export type Claimant =
  | { type: 'human'; userId: string; name: string }
  | { type: 'agent'; agentId: string; agentType: string };

export type ClaimStatus =
  | 'active'
  | 'paused'
  | 'handoff-pending'
  | 'review-requested'
  | 'blocked'
  | 'stealable'
  | 'completed';

export type StealReason =
  | 'overloaded'
  | 'stale'
  | 'blocked-timeout'
  | 'voluntary';

export interface IssueClaim {
  issueId: string;
  claimant: Claimant;
  claimedAt: Date;
  status: ClaimStatus;
  statusChangedAt: Date;
  expiresAt?: Date;
  handoffTo?: Claimant;
  handoffReason?: string;
  blockReason?: string;
  progress: number; // 0-100
  context?: string;
}

export interface StealableInfo {
  reason: StealReason;
  stealableAt: Date;
  preferredTypes?: string[];
  progress: number;
  context?: string;
}

export interface ClaimResult {
  success: boolean;
  claim?: IssueClaim;
  error?: string;
}

export interface StealResult {
  success: boolean;
  claim?: IssueClaim;
  previousOwner?: Claimant;
  context?: StealableInfo;
  error?: string;
}

export interface AgentLoadInfo {
  agentId: string;
  agentType: string;
  claimCount: number;
  maxClaims: number;
  utilization: number;
  claims: IssueClaim[];
  avgCompletionTime: number;
  currentBlockedCount: number;
}

export interface RebalanceResult {
  moved: Array<{
    issueId: string;
    from: Claimant;
    to: Claimant;
  }>;
  suggested: Array<{
    issueId: string;
    currentOwner: Claimant;
    suggestedOwner: Claimant;
    reason: string;
  }>;
}

export interface WorkStealingConfig {
  staleThresholdMinutes: number;
  blockedThresholdMinutes: number;
  overloadThreshold: number;
  gracePeriodMinutes: number;
  minProgressToProtect: number;
  contestWindowMinutes: number;
  requireSameType: boolean;
  allowCrossTypeSteal: string[][];
}

export interface IssueFilters {
  status?: ClaimStatus[];
  labels?: string[];
  agentTypes?: string[];
  priority?: string[];
}

// ============================================================================
// GitHub Integration Types
// ============================================================================

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubSyncConfig {
  enabled: boolean;
  repo?: string; // owner/repo
  syncLabels: boolean;
  claimLabel: string;
  autoAssign: boolean;
  commentOnClaim: boolean;
  commentOnRelease: boolean;
}

export interface GitHubSyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  issues?: GitHubIssue[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: WorkStealingConfig = {
  staleThresholdMinutes: 30,
  blockedThresholdMinutes: 60,
  overloadThreshold: 5,
  gracePeriodMinutes: 10,
  minProgressToProtect: 75,
  contestWindowMinutes: 5,
  requireSameType: false,
  allowCrossTypeSteal: [
    ['coder', 'debugger'],
    ['tester', 'reviewer'],
  ],
};

// ============================================================================
// Claim Events
// ============================================================================

export type ClaimEventType =
  | 'issue:claimed'
  | 'issue:released'
  | 'issue:handoff:requested'
  | 'issue:handoff:accepted'
  | 'issue:handoff:rejected'
  | 'issue:status:changed'
  | 'issue:review:requested'
  | 'issue:expired'
  | 'issue:stealable'
  | 'issue:stolen'
  | 'issue:steal:contested'
  | 'issue:steal:resolved'
  | 'swarm:rebalanced'
  | 'agent:overloaded'
  | 'agent:underloaded';

export interface ClaimEvent {
  type: ClaimEventType;
  timestamp: Date;
  issueId?: string;
  claimant?: Claimant;
  previousClaimant?: Claimant;
  data?: Record<string, unknown>;
}

// ============================================================================

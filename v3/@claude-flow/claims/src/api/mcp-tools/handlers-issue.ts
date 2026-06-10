/**
 * Claims issue-lifecycle handlers — claim/release/handoff/status, listing/
 * board, mark-stealable/steal/get-stealable/contest. Operate on the shared
 * claimStore/issueStore.
 *
 * Extracted from mcp-tools.ts (W129, P3.17 cut #4).
 */
import { z } from 'zod';
import type { ToolContext } from './tool-types.js';
import type { Claim, Issue, ClaimStatus, ClaimantType, HandoffReason, IssuePriority } from './store.js';
import { claimStore, issueStore, generateSecureId, initializeMockData } from './store.js';
import {
  issueClaimSchema, issueReleaseSchema, issueHandoffSchema, issueStatusUpdateSchema,
  issueListAvailableSchema, issueListMineSchema, issueBoardSchema, issueMarkStealableSchema,
  issueStealSchema, issueGetStealableSchema, issueContestStealSchema,
} from './schemas.js';

export async function handleIssueClaim(
  input: z.infer<typeof issueClaimSchema>,
  context?: ToolContext
): Promise<{
  claimId: string;
  issueId: string;
  claimantId: string;
  claimantType: ClaimantType;
  status: ClaimStatus;
  claimedAt: string;
  expiresAt?: string;
}> {
  initializeMockData();

  // Try to use claims service if available
  if (context?.claimsService) {
    const claim = await context.claimsService.claimIssue(input);
    return {
      claimId: claim.id,
      issueId: claim.issueId,
      claimantId: claim.claimantId,
      claimantType: claim.claimantType,
      status: claim.status,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
    };
  }

  // Simple implementation
  const issue = issueStore.get(input.issueId);
  if (!issue) {
    throw new Error(`Issue not found: ${input.issueId}`);
  }

  if (issue.claimedBy) {
    throw new Error(`Issue ${input.issueId} is already claimed by ${issue.claimedBy}`);
  }

  const claimId = generateSecureId('claim');
  const claimedAt = new Date().toISOString();
  const expiresAt = input.expiresInMs
    ? new Date(Date.now() + input.expiresInMs).toISOString()
    : undefined;

  const claim: Claim = {
    id: claimId,
    issueId: input.issueId,
    claimantType: input.claimantType,
    claimantId: input.claimantId,
    status: 'active',
    priority: input.priority || issue.priority,
    stealable: false,
    claimedAt,
    lastActivityAt: claimedAt,
    expiresAt,
  };

  claimStore.set(claimId, claim);
  issue.claimedBy = input.claimantId;

  return {
    claimId,
    issueId: input.issueId,
    claimantId: input.claimantId,
    claimantType: input.claimantType,
    status: 'active',
    claimedAt,
    expiresAt,
  };
}

/**
 * Release a claim
 */
export async function handleIssueRelease(
  input: z.infer<typeof issueReleaseSchema>,
  context?: ToolContext
): Promise<{
  released: boolean;
  issueId: string;
  releasedAt: string;
  reason?: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.releaseClaim(input);
    return {
      released: result.released,
      issueId: input.issueId,
      releasedAt: result.releasedAt,
      reason: input.reason,
    };
  }

  // Simple implementation
  const issue = issueStore.get(input.issueId);
  if (!issue) {
    throw new Error(`Issue not found: ${input.issueId}`);
  }

  if (issue.claimedBy !== input.claimantId) {
    throw new Error(`Issue ${input.issueId} is not claimed by ${input.claimantId}`);
  }

  // Find and update the claim
  for (const claim of claimStore.values()) {
    if (claim.issueId === input.issueId && claim.claimantId === input.claimantId) {
      claim.status = 'released';
      claim.lastActivityAt = new Date().toISOString();
    }
  }

  issue.claimedBy = undefined;

  return {
    released: true,
    issueId: input.issueId,
    releasedAt: new Date().toISOString(),
    reason: input.reason,
  };
}

/**
 * Request handoff to another agent/human
 */
export async function handleIssueHandoff(
  input: z.infer<typeof issueHandoffSchema>,
  context?: ToolContext
): Promise<{
  handoffId: string;
  issueId: string;
  fromId: string;
  toId?: string;
  toType?: ClaimantType;
  status: 'pending' | 'accepted' | 'rejected';
  reason: HandoffReason;
  createdAt: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.requestHandoff(input);
    return {
      handoffId: result.handoffId,
      issueId: input.issueId,
      fromId: input.fromId,
      toId: input.toId,
      toType: input.toType,
      status: result.status as 'pending' | 'accepted' | 'rejected',
      reason: input.reason,
      createdAt: new Date().toISOString(),
    };
  }

  // Simple implementation
  const handoffId = generateSecureId('handoff');

  return {
    handoffId,
    issueId: input.issueId,
    fromId: input.fromId,
    toId: input.toId,
    toType: input.toType,
    status: 'pending',
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update claim status
 */
export async function handleIssueStatusUpdate(
  input: z.infer<typeof issueStatusUpdateSchema>,
  context?: ToolContext
): Promise<{
  issueId: string;
  status: ClaimStatus;
  progress?: number;
  updatedAt: string;
  notes?: string;
}> {
  if (context?.claimsService) {
    const claim = await context.claimsService.updateClaimStatus(input);
    return {
      issueId: claim.issueId,
      status: claim.status,
      progress: input.progress,
      updatedAt: claim.lastActivityAt,
      notes: input.notes,
    };
  }

  // Simple implementation
  for (const claim of claimStore.values()) {
    if (claim.issueId === input.issueId && claim.claimantId === input.claimantId) {
      claim.status = input.status;
      claim.lastActivityAt = new Date().toISOString();
      if (input.progress !== undefined) {
        claim.metadata = { ...claim.metadata, progress: input.progress };
      }
      return {
        issueId: input.issueId,
        status: input.status,
        progress: input.progress,
        updatedAt: claim.lastActivityAt,
        notes: input.notes,
      };
    }
  }

  throw new Error(`No active claim found for issue ${input.issueId} by ${input.claimantId}`);
}

/**
 * List unclaimed issues
 */
export async function handleIssueListAvailable(
  input: z.infer<typeof issueListAvailableSchema>,
  context?: ToolContext
): Promise<{
  issues: Issue[];
  total: number;
  limit: number;
  offset: number;
}> {
  initializeMockData();

  if (context?.claimsService) {
    const result = await context.claimsService.listAvailableIssues(input);
    return {
      ...result,
      limit: input.limit,
      offset: input.offset,
    };
  }

  // Simple implementation
  let issues = Array.from(issueStore.values()).filter(issue => !issue.claimedBy);

  if (input.priority) {
    issues = issues.filter(issue => issue.priority === input.priority);
  }
  if (input.labels && input.labels.length > 0) {
    issues = issues.filter(issue =>
      input.labels!.some(label => issue.labels?.includes(label))
    );
  }
  if (input.repository) {
    issues = issues.filter(issue => issue.repository === input.repository);
  }

  const total = issues.length;
  const paginated = issues.slice(input.offset, input.offset + input.limit);

  return {
    issues: paginated,
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * List my claims
 */
export async function handleIssueListMine(
  input: z.infer<typeof issueListMineSchema>,
  context?: ToolContext
): Promise<{
  claims: Claim[];
  total: number;
  limit: number;
  offset: number;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.listMyClaims(input);
    return {
      ...result,
      limit: input.limit,
      offset: input.offset,
    };
  }

  // Simple implementation
  let claims = Array.from(claimStore.values())
    .filter(claim => claim.claimantId === input.claimantId);

  if (input.status) {
    claims = claims.filter(claim => claim.status === input.status);
  }

  const total = claims.length;
  const paginated = claims.slice(input.offset, input.offset + input.limit);

  return {
    claims: paginated,
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * View claim board
 */
export async function handleIssueBoard(
  input: z.infer<typeof issueBoardSchema>,
  context?: ToolContext
): Promise<{
  claims: Claim[];
  totalClaims: number;
  byClaimant?: Record<string, number>;
  byPriority?: Record<IssuePriority, number>;
  byStatus?: Record<ClaimStatus, number>;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.getClaimBoard(input);
    return {
      claims: result.claims,
      totalClaims: result.claims.length,
      byClaimant: result.byClaimant
        ? Object.fromEntries(Object.entries(result.byClaimant).map(([k, v]) => [k, v.length]))
        : undefined,
      byPriority: result.byPriority
        ? Object.fromEntries(Object.entries(result.byPriority).map(([k, v]) => [k, v.length])) as Record<IssuePriority, number>
        : undefined,
      byStatus: result.byStatus
        ? Object.fromEntries(Object.entries(result.byStatus).map(([k, v]) => [k, v.length])) as Record<ClaimStatus, number>
        : undefined,
    };
  }

  // Simple implementation
  let claims = Array.from(claimStore.values());

  if (!input.includeAgents) {
    claims = claims.filter(c => c.claimantType !== 'agent');
  }
  if (!input.includeHumans) {
    claims = claims.filter(c => c.claimantType !== 'human');
  }

  const result: {
    claims: Claim[];
    totalClaims: number;
    byClaimant?: Record<string, number>;
    byPriority?: Record<IssuePriority, number>;
    byStatus?: Record<ClaimStatus, number>;
  } = {
    claims,
    totalClaims: claims.length,
  };

  if (input.groupBy === 'claimant') {
    result.byClaimant = {};
    claims.forEach(c => {
      result.byClaimant![c.claimantId] = (result.byClaimant![c.claimantId] || 0) + 1;
    });
  } else if (input.groupBy === 'priority') {
    result.byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
    claims.forEach(c => {
      result.byPriority![c.priority]++;
    });
  } else if (input.groupBy === 'status') {
    result.byStatus = { active: 0, blocked: 0, 'in-review': 0, completed: 0, released: 0, stolen: 0 };
    claims.forEach(c => {
      result.byStatus![c.status]++;
    });
  }

  return result;
}

/**
 * Mark claim as stealable
 */
export async function handleIssueMarkStealable(
  input: z.infer<typeof issueMarkStealableSchema>,
  context?: ToolContext
): Promise<{
  marked: boolean;
  issueId: string;
  markedAt: string;
  reason?: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.markStealable(input);
    return {
      marked: result.marked,
      issueId: input.issueId,
      markedAt: result.markedAt,
      reason: input.reason,
    };
  }

  // Simple implementation
  for (const claim of claimStore.values()) {
    if (claim.issueId === input.issueId && claim.claimantId === input.claimantId) {
      claim.stealable = true;
      claim.stealableReason = input.reason;
      claim.lastActivityAt = new Date().toISOString();
      return {
        marked: true,
        issueId: input.issueId,
        markedAt: claim.lastActivityAt,
        reason: input.reason,
      };
    }
  }

  throw new Error(`No active claim found for issue ${input.issueId} by ${input.claimantId}`);
}

/**
 * Steal a stealable issue
 */
export async function handleIssueSteal(
  input: z.infer<typeof issueStealSchema>,
  context?: ToolContext
): Promise<{
  stolen: boolean;
  issueId: string;
  newClaimId: string;
  previousClaimant: string;
  contestWindowMs: number;
  stolenAt: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.stealClaim(input);
    return {
      stolen: result.stolen,
      issueId: input.issueId,
      newClaimId: result.claim.id,
      previousClaimant: result.previousClaimant,
      contestWindowMs: result.contestWindow,
      stolenAt: result.claim.claimedAt,
    };
  }

  // Simple implementation
  for (const claim of claimStore.values()) {
    if (claim.issueId === input.issueId && claim.stealable) {
      const previousClaimant = claim.claimantId;

      // Update old claim
      claim.status = 'stolen';
      claim.lastActivityAt = new Date().toISOString();

      // Create new claim
      const newClaimId = generateSecureId('claim');
      const stolenAt = new Date().toISOString();
      const newClaim: Claim = {
        id: newClaimId,
        issueId: input.issueId,
        claimantType: input.stealerType,
        claimantId: input.stealerId,
        status: 'active',
        priority: claim.priority,
        stealable: false,
        claimedAt: stolenAt,
        lastActivityAt: stolenAt,
      };
      claimStore.set(newClaimId, newClaim);

      // Update issue
      const issue = issueStore.get(input.issueId);
      if (issue) {
        issue.claimedBy = input.stealerId;
      }

      return {
        stolen: true,
        issueId: input.issueId,
        newClaimId,
        previousClaimant,
        contestWindowMs: 300000, // 5 minutes
        stolenAt,
      };
    }
  }

  throw new Error(`Issue ${input.issueId} is not stealable or not claimed`);
}

/**
 * Get stealable issues
 */
export async function handleIssueGetStealable(
  input: z.infer<typeof issueGetStealableSchema>,
  context?: ToolContext
): Promise<{
  issues: Array<{
    issueId: string;
    title: string;
    priority: IssuePriority;
    currentClaimant: string;
    stealableReason?: string;
  }>;
  total: number;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.getStealableIssues(input);
    return {
      issues: result.issues.map(issue => ({
        issueId: issue.id,
        title: issue.title,
        priority: issue.priority,
        currentClaimant: issue.claimedBy || 'unknown',
        stealableReason: issue.stealableReason,
      })),
      total: result.total,
    };
  }

  // Simple implementation
  let stealableClaims = Array.from(claimStore.values()).filter(c => c.stealable);

  if (input.priority) {
    stealableClaims = stealableClaims.filter(c => c.priority === input.priority);
  }

  const issues = stealableClaims.slice(0, input.limit).map(claim => {
    const issue = issueStore.get(claim.issueId);
    return {
      issueId: claim.issueId,
      title: issue?.title || 'Unknown',
      priority: claim.priority,
      currentClaimant: claim.claimantId,
      stealableReason: claim.stealableReason,
    };
  });

  return {
    issues,
    total: stealableClaims.length,
  };
}

/**
 * Contest a steal
 */
export async function handleIssueContestSteal(
  input: z.infer<typeof issueContestStealSchema>,
  context?: ToolContext
): Promise<{
  contested: boolean;
  contestId: string;
  issueId: string;
  contesterId: string;
  status: 'pending' | 'upheld' | 'reversed';
  contestedAt: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.contestSteal(input);
    return {
      contested: result.contested,
      contestId: generateSecureId('contest'),
      issueId: input.issueId,
      contesterId: input.contesterId,
      status: result.resolution,
      contestedAt: result.resolvedAt || new Date().toISOString(),
    };
  }

  // Simple implementation
  return {
    contested: true,
    contestId: generateSecureId('contest'),
    issueId: input.issueId,
    contesterId: input.contesterId,
    status: 'pending',
    contestedAt: new Date().toISOString(),
  };
}


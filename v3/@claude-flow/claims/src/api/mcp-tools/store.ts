/**
 * Claims domain model + in-memory stores for the claims MCP tools — the
 * Claim/Issue/AgentLoad/ClaimHistoryEntry/ClaimsService types, the
 * claimStore/issueStore Maps (shared mutable state), the secure-id
 * generator, and the mock-data seeder.
 *
 * Extracted from mcp-tools.ts (W128, P3.17 cut #2). The handlers import
 * the stores from here so they operate on one shared state.
 */
import { randomBytes } from 'crypto';

export type ClaimantType = 'human' | 'agent';
export type ClaimStatus = 'active' | 'blocked' | 'in-review' | 'completed' | 'released' | 'stolen';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
export type HandoffReason = 'blocked' | 'expertise-needed' | 'capacity' | 'reassignment' | 'other';

export interface Claim {
  id: string;
  issueId: string;
  claimantType: ClaimantType;
  claimantId: string;
  status: ClaimStatus;
  priority: IssuePriority;
  stealable: boolean;
  stealableReason?: string;
  claimedAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Issue {
  id: string;
  title: string;
  description?: string;
  priority: IssuePriority;
  labels?: string[];
  repository?: string;
  createdAt: string;
  updatedAt?: string;
  claimedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLoad {
  agentId: string;
  agentType: string;
  currentClaims: number;
  maxClaims: number;
  utilizationPercent: number;
  activeTasks: number;
  queuedTasks: number;
  averageTaskDuration: number;
  lastActivityAt: string;
}

export interface ClaimHistoryEntry {
  timestamp: string;
  action: string;
  actorId: string;
  actorType: ClaimantType;
  details?: Record<string, unknown>;
}

/**
 * Claims Service Interface
 * Defines the contract for claims management operations
 */
export interface ClaimsService {
  claimIssue(params: {
    issueId: string;
    claimantType: ClaimantType;
    claimantId: string;
    priority?: IssuePriority;
    expiresInMs?: number;
  }): Promise<Claim>;

  releaseClaim(params: {
    issueId: string;
    claimantId: string;
    reason?: string;
  }): Promise<{ released: boolean; releasedAt: string }>;

  requestHandoff(params: {
    issueId: string;
    fromId: string;
    toId?: string;
    toType?: ClaimantType;
    reason: HandoffReason;
    notes?: string;
  }): Promise<{ handoffId: string; status: string }>;

  updateClaimStatus(params: {
    issueId: string;
    claimantId: string;
    status: ClaimStatus;
    progress?: number;
    notes?: string;
  }): Promise<Claim>;

  listAvailableIssues(params: {
    priority?: IssuePriority;
    labels?: string[];
    repository?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ issues: Issue[]; total: number }>;

  listMyClaims(params: {
    claimantId: string;
    status?: ClaimStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ claims: Claim[]; total: number }>;

  getClaimBoard(params: {
    includeAgents?: boolean;
    includeHumans?: boolean;
    groupBy?: 'claimant' | 'priority' | 'status';
  }): Promise<{
    claims: Claim[];
    byClaimant?: Record<string, Claim[]>;
    byPriority?: Record<IssuePriority, Claim[]>;
    byStatus?: Record<ClaimStatus, Claim[]>;
  }>;

  markStealable(params: {
    issueId: string;
    claimantId: string;
    reason?: string;
  }): Promise<{ marked: boolean; markedAt: string }>;

  stealClaim(params: {
    issueId: string;
    stealerId: string;
    stealerType: ClaimantType;
    reason?: string;
  }): Promise<{
    stolen: boolean;
    claim: Claim;
    previousClaimant: string;
    contestWindow: number;
  }>;

  getStealableIssues(params: {
    priority?: IssuePriority;
    limit?: number;
  }): Promise<{ issues: Array<Issue & { stealableReason?: string }>; total: number }>;

  contestSteal(params: {
    issueId: string;
    contesterId: string;
    reason: string;
  }): Promise<{
    contested: boolean;
    resolution: 'pending' | 'upheld' | 'reversed';
    resolvedAt?: string;
  }>;

  getAgentLoad(params: {
    agentId: string;
  }): Promise<AgentLoad>;

  rebalanceSwarm(params: {
    strategy?: 'round-robin' | 'least-loaded' | 'priority-based' | 'capability-based';
    dryRun?: boolean;
  }): Promise<{
    rebalanced: boolean;
    changes: Array<{ issueId: string; from: string; to: string }>;
    dryRun: boolean;
  }>;

  getLoadOverview(): Promise<{
    totalAgents: number;
    totalClaims: number;
    averageLoad: number;
    agents: AgentLoad[];
    bottlenecks: string[];
    recommendations: string[];
  }>;

  getClaimHistory(params: {
    issueId: string;
    limit?: number;
  }): Promise<{ history: ClaimHistoryEntry[]; total: number }>;

  getMetrics(): Promise<{
    totalClaims: number;
    activeClaims: number;
    completedClaims: number;
    stolenClaims: number;
    averageClaimDuration: number;
    claimsByPriority: Record<IssuePriority, number>;
    claimsByStatus: Record<ClaimStatus, number>;
  }>;
}

// ============================================================================
// Secure ID Generation
// ============================================================================

export function generateSecureId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// In-Memory Store (for simple implementation without service)
// ============================================================================

export const claimStore = new Map<string, Claim>();
export const issueStore = new Map<string, Issue>();

// Initialize with some mock data
export function initializeMockData(): void {
  if (issueStore.size === 0) {
    const mockIssues: Issue[] = [
      {
        id: 'issue-1',
        title: 'Implement user authentication',
        priority: 'high',
        labels: ['feature', 'security'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'issue-2',
        title: 'Fix memory leak in agent coordinator',
        priority: 'critical',
        labels: ['bug', 'performance'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'issue-3',
        title: 'Add unit tests for claims module',
        priority: 'medium',
        labels: ['testing'],
        createdAt: new Date().toISOString(),
      },
    ];
    mockIssues.forEach(issue => issueStore.set(issue.id, issue));
  }
}

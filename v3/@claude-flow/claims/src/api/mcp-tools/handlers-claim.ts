/**
 * Claims load/metrics handlers — agent-load info, swarm rebalance/overview,
 * and claim history/metrics/config. Operate on the shared claimStore/
 * issueStore.
 *
 * Extracted from mcp-tools.ts (W129, P3.17 cut #5).
 */
import { z } from 'zod';
import type { ToolContext } from './tool-types.js';
import type { AgentLoad, ClaimHistoryEntry, ClaimStatus, IssuePriority } from './store.js';
import { claimStore, issueStore, generateSecureId } from './store.js';
import {
  agentLoadInfoSchema, swarmRebalanceSchema, swarmLoadOverviewSchema,
  claimHistorySchema, claimMetricsSchema, claimConfigSchema,
} from './schemas.js';

/**
 * Get agent load info
 */
export async function handleAgentLoadInfo(
  input: z.infer<typeof agentLoadInfoSchema>,
  context?: ToolContext
): Promise<AgentLoad> {
  if (context?.claimsService) {
    return context.claimsService.getAgentLoad(input);
  }

  // Simple implementation
  const claims = Array.from(claimStore.values())
    .filter(c => c.claimantId === input.agentId && c.status === 'active');

  return {
    agentId: input.agentId,
    agentType: 'worker',
    currentClaims: claims.length,
    maxClaims: 5,
    utilizationPercent: Math.min(100, (claims.length / 5) * 100),
    activeTasks: claims.length,
    queuedTasks: 0,
    averageTaskDuration: 3600000, // 1 hour
    lastActivityAt: new Date().toISOString(),
  };
}

/**
 * Trigger swarm rebalancing
 */
export async function handleSwarmRebalance(
  input: z.infer<typeof swarmRebalanceSchema>,
  context?: ToolContext
): Promise<{
  rebalanced: boolean;
  strategy: string;
  changes: Array<{ issueId: string; from: string; to: string }>;
  dryRun: boolean;
  rebalancedAt: string;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.rebalanceSwarm(input);
    return {
      rebalanced: result.rebalanced,
      strategy: input.strategy,
      changes: result.changes,
      dryRun: result.dryRun,
      rebalancedAt: new Date().toISOString(),
    };
  }

  // Simple implementation - no actual rebalancing
  return {
    rebalanced: !input.dryRun,
    strategy: input.strategy,
    changes: [],
    dryRun: input.dryRun,
    rebalancedAt: new Date().toISOString(),
  };
}

/**
 * Get swarm-wide load overview
 */
export async function handleSwarmLoadOverview(
  input: z.infer<typeof swarmLoadOverviewSchema>,
  context?: ToolContext
): Promise<{
  totalAgents: number;
  totalClaims: number;
  averageLoad: number;
  agents: Array<{ agentId: string; currentClaims: number; utilizationPercent: number }>;
  bottlenecks: string[];
  recommendations: string[];
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.getLoadOverview();
    return {
      ...result,
      agents: result.agents.map(a => ({
        agentId: a.agentId,
        currentClaims: a.currentClaims,
        utilizationPercent: a.utilizationPercent,
      })),
    };
  }

  // Simple implementation
  const claimsByAgent = new Map<string, number>();
  for (const claim of claimStore.values()) {
    if (claim.status === 'active') {
      claimsByAgent.set(claim.claimantId, (claimsByAgent.get(claim.claimantId) || 0) + 1);
    }
  }

  const agents = Array.from(claimsByAgent.entries()).map(([agentId, claims]) => ({
    agentId,
    currentClaims: claims,
    utilizationPercent: Math.min(100, (claims / 5) * 100),
  }));

  const totalClaims = Array.from(claimsByAgent.values()).reduce((a, b) => a + b, 0);
  const avgLoad = agents.length > 0
    ? agents.reduce((a, b) => a + b.utilizationPercent, 0) / agents.length
    : 0;

  const result: {
    totalAgents: number;
    totalClaims: number;
    averageLoad: number;
    agents: Array<{ agentId: string; currentClaims: number; utilizationPercent: number }>;
    bottlenecks: string[];
    recommendations: string[];
  } = {
    totalAgents: agents.length,
    totalClaims,
    averageLoad: Math.round(avgLoad * 100) / 100,
    agents,
    bottlenecks: [],
    recommendations: [],
  };

  if (input.includeRecommendations) {
    const overloaded = agents.filter(a => a.utilizationPercent > 80);
    if (overloaded.length > 0) {
      result.bottlenecks = overloaded.map(a => a.agentId);
      result.recommendations.push('Consider rebalancing claims to reduce load on overloaded agents');
    }
    if (avgLoad > 70) {
      result.recommendations.push('Swarm is under high load. Consider scaling up agent count.');
    }
    if (avgLoad < 30 && agents.length > 1) {
      result.recommendations.push('Swarm has low utilization. Consider consolidating agents.');
    }
  }

  return result;
}

/**
 * Get claim history
 */
export async function handleClaimHistory(
  input: z.infer<typeof claimHistorySchema>,
  context?: ToolContext
): Promise<{
  issueId: string;
  history: ClaimHistoryEntry[];
  total: number;
}> {
  if (context?.claimsService) {
    const result = await context.claimsService.getClaimHistory(input);
    return {
      issueId: input.issueId,
      history: result.history,
      total: result.total,
    };
  }

  // Simple implementation - mock history
  const claims = Array.from(claimStore.values())
    .filter(c => c.issueId === input.issueId)
    .sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());

  const history: ClaimHistoryEntry[] = claims.flatMap(claim => [
    {
      timestamp: claim.claimedAt,
      action: 'claimed',
      actorId: claim.claimantId,
      actorType: claim.claimantType,
    },
    ...(claim.status !== 'active' ? [{
      timestamp: claim.lastActivityAt,
      action: claim.status,
      actorId: claim.claimantId,
      actorType: claim.claimantType,
    }] : []),
  ]).slice(0, input.limit);

  return {
    issueId: input.issueId,
    history,
    total: history.length,
  };
}

/**
 * Get claim metrics
 */
export async function handleClaimMetrics(
  input: z.infer<typeof claimMetricsSchema>,
  context?: ToolContext
): Promise<{
  timeRange: string;
  totalClaims: number;
  activeClaims: number;
  completedClaims: number;
  stolenClaims: number;
  averageClaimDurationMs: number;
  claimsByPriority: Record<IssuePriority, number>;
  claimsByStatus: Record<ClaimStatus, number>;
}> {
  if (context?.claimsService) {
    const metrics = await context.claimsService.getMetrics();
    return {
      timeRange: input.timeRange,
      totalClaims: metrics.totalClaims,
      activeClaims: metrics.activeClaims,
      completedClaims: metrics.completedClaims,
      stolenClaims: metrics.stolenClaims,
      averageClaimDurationMs: metrics.averageClaimDuration,
      claimsByPriority: metrics.claimsByPriority,
      claimsByStatus: metrics.claimsByStatus,
    };
  }

  // Simple implementation
  const claims = Array.from(claimStore.values());
  const byPriority: Record<IssuePriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byStatus: Record<ClaimStatus, number> = {
    active: 0, blocked: 0, 'in-review': 0, completed: 0, released: 0, stolen: 0,
  };

  claims.forEach(c => {
    byPriority[c.priority]++;
    byStatus[c.status]++;
  });

  return {
    timeRange: input.timeRange,
    totalClaims: claims.length,
    activeClaims: byStatus.active,
    completedClaims: byStatus.completed,
    stolenClaims: byStatus.stolen,
    averageClaimDurationMs: 3600000, // 1 hour mock
    claimsByPriority: byPriority,
    claimsByStatus: byStatus,
  };
}

/**
 * Get/set claim configuration
 */
export async function handleClaimConfig(
  input: z.infer<typeof claimConfigSchema>,
  _context?: ToolContext
): Promise<{
  action: 'get' | 'set';
  config: {
    defaultExpirationMs: number;
    maxClaimsPerAgent: number;
    contestWindowMs: number;
    autoReleaseOnInactivityMs: number;
  };
  updatedAt?: string;
}> {
  // Default configuration
  const defaultConfig = {
    defaultExpirationMs: 86400000, // 24 hours
    maxClaimsPerAgent: 5,
    contestWindowMs: 300000, // 5 minutes
    autoReleaseOnInactivityMs: 7200000, // 2 hours
  };

  if (input.action === 'get') {
    return {
      action: 'get',
      config: defaultConfig,
    };
  }

  // Set action
  const newConfig = {
    ...defaultConfig,
    ...input.config,
  };

  return {
    action: 'set',
    config: newConfig,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

// Core Claiming Tools


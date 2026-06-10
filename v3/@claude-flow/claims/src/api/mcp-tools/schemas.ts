/**
 * Zod input schemas for the claims MCP tools — issue claim/release/
 * handoff/status, listing/board, steal/contest, agent-load/swarm, and
 * claim history/metrics/config. Pure zod, no other deps.
 *
 * Extracted from mcp-tools.ts (W127, P3.17 cut #1).
 */
import { z } from 'zod';

// Core Claiming Schemas
export const issueClaimSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to claim'),
  claimantType: z.enum(['human', 'agent']).describe('Type of claimant'),
  claimantId: z.string().min(1).describe('ID of the claimant'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('Override priority for the claim'),
  expiresInMs: z.number().int().positive().optional()
    .describe('Claim expiration time in milliseconds'),
});

export const issueReleaseSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to release'),
  claimantId: z.string().min(1).describe('ID of the current claimant'),
  reason: z.string().optional().describe('Reason for releasing the claim'),
});

export const issueHandoffSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID for handoff'),
  fromId: z.string().min(1).describe('Current claimant ID'),
  toId: z.string().optional().describe('Target claimant ID (optional for open handoff)'),
  toType: z.enum(['human', 'agent']).optional().describe('Target claimant type'),
  reason: z.enum(['blocked', 'expertise-needed', 'capacity', 'reassignment', 'other'])
    .describe('Reason for handoff'),
  notes: z.string().optional().describe('Additional notes for handoff'),
});

export const issueStatusUpdateSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to update'),
  claimantId: z.string().min(1).describe('Current claimant ID'),
  status: z.enum(['active', 'blocked', 'in-review', 'completed']).describe('New status'),
  progress: z.number().min(0).max(100).optional().describe('Progress percentage (0-100)'),
  notes: z.string().optional().describe('Status update notes'),
});

export const issueListAvailableSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('Filter by priority'),
  labels: z.array(z.string()).optional().describe('Filter by labels'),
  repository: z.string().optional().describe('Filter by repository'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum results'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

export const issueListMineSchema = z.object({
  claimantId: z.string().min(1).describe('Claimant ID'),
  status: z.enum(['active', 'blocked', 'in-review', 'completed', 'released', 'stolen']).optional()
    .describe('Filter by status'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum results'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

export const issueBoardSchema = z.object({
  includeAgents: z.boolean().default(true).describe('Include agent claims'),
  includeHumans: z.boolean().default(true).describe('Include human claims'),
  groupBy: z.enum(['claimant', 'priority', 'status']).optional()
    .describe('Group claims by field'),
});

// Work Stealing Schemas
export const issueMarkStealableSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to mark as stealable'),
  claimantId: z.string().min(1).describe('Current claimant ID'),
  reason: z.string().optional().describe('Reason for making stealable'),
});

export const issueStealSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to steal'),
  stealerId: z.string().min(1).describe('ID of the stealer'),
  stealerType: z.enum(['human', 'agent']).describe('Type of stealer'),
  reason: z.string().optional().describe('Reason for stealing'),
});

export const issueGetStealableSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('Filter by priority'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum results'),
});

export const issueContestStealSchema = z.object({
  issueId: z.string().min(1).describe('Issue ID being contested'),
  contesterId: z.string().min(1).describe('ID of the contester'),
  reason: z.string().min(1).describe('Reason for contesting'),
});

// Load Balancing Schemas
export const agentLoadInfoSchema = z.object({
  agentId: z.string().min(1).describe('Agent ID to get load info for'),
});

export const swarmRebalanceSchema = z.object({
  strategy: z.enum(['round-robin', 'least-loaded', 'priority-based', 'capability-based'])
    .default('least-loaded').describe('Rebalancing strategy'),
  dryRun: z.boolean().default(false).describe('Simulate without making changes'),
});

export const swarmLoadOverviewSchema = z.object({
  includeRecommendations: z.boolean().default(true)
    .describe('Include optimization recommendations'),
});

// Additional Tools Schemas
export const claimHistorySchema = z.object({
  issueId: z.string().min(1).describe('Issue ID to get history for'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum entries'),
});

export const claimMetricsSchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d', 'all']).default('24h')
    .describe('Time range for metrics'),
});

export const claimConfigSchema = z.object({
  action: z.enum(['get', 'set']).describe('Get or set configuration'),
  config: z.object({
    defaultExpirationMs: z.number().int().positive().optional(),
    maxClaimsPerAgent: z.number().int().positive().optional(),
    contestWindowMs: z.number().int().positive().optional(),
    autoReleaseOnInactivityMs: z.number().int().positive().optional(),
  }).optional().describe('Configuration values (for set action)'),
});

// ============================================================================
// Tool Handlers

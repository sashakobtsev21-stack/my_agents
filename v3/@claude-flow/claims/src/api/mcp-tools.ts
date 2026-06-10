/**
 * V3 MCP Claims Tools
 *
 * MCP tools for issue claiming and work coordination:
 *
 * Core Claiming (7 tools):
 * - claims/issue_claim - Claim an issue to work on
 * - claims/issue_release - Release a claim
 * - claims/issue_handoff - Request handoff to another agent/human
 * - claims/issue_status_update - Update claim status
 * - claims/issue_list_available - List unclaimed issues
 * - claims/issue_list_mine - List my claims
 * - claims/issue_board - View claim board (who's working on what)
 *
 * Work Stealing (4 tools):
 * - claims/issue_mark_stealable - Mark my claim as stealable
 * - claims/issue_steal - Steal a stealable issue
 * - claims/issue_get_stealable - List stealable issues
 * - claims/issue_contest_steal - Contest a steal
 *
 * Load Balancing (3 tools):
 * - claims/agent_load_info - Get agent's current load
 * - claims/swarm_rebalance - Trigger swarm rebalancing
 * - claims/swarm_load_overview - Get swarm-wide load distribution
 *
 * Additionally provides:
 * - claims/claim_history - Get claim history for an issue
 * - claims/claim_metrics - Get claiming metrics
 * - claims/claim_config - Configure claiming behavior
 *
 * Implements ADR-005: MCP-First API Design
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';
// Domain model + in-memory stores moved to ./mcp-tools/store.ts
// (W128, P3.17 cut #2).
import type {
  ClaimantType,
  ClaimStatus,
  IssuePriority,
  HandoffReason,
  Claim,
  Issue,
  AgentLoad,
  ClaimHistoryEntry,
  ClaimsService,
} from './mcp-tools/store.js';
// MCP framework types moved to ./mcp-tools/tool-types.ts (W129, cut #3).
import type { JSONSchema, ToolContext, ToolHandler, MCPTool } from './mcp-tools/tool-types.js';
// Zod input schemas (./mcp-tools/schemas.ts) — the tool definitions below
// reference them for input validation.
import {
  issueClaimSchema, issueReleaseSchema, issueHandoffSchema, issueStatusUpdateSchema,
  issueListAvailableSchema, issueListMineSchema, issueBoardSchema, issueMarkStealableSchema,
  issueStealSchema, issueGetStealableSchema, issueContestStealSchema,
  agentLoadInfoSchema, swarmRebalanceSchema, swarmLoadOverviewSchema,
  claimHistorySchema, claimMetricsSchema, claimConfigSchema,
} from './mcp-tools/schemas.js';
// Handlers moved to ./mcp-tools/handlers-issue.ts + handlers-claim.ts
// (W129, P3.17 cuts #4-5). The tool objects below reference them.
import {
  handleIssueClaim, handleIssueRelease, handleIssueHandoff, handleIssueStatusUpdate,
  handleIssueListAvailable, handleIssueListMine, handleIssueBoard, handleIssueMarkStealable,
  handleIssueSteal, handleIssueGetStealable, handleIssueContestSteal,
} from './mcp-tools/handlers-issue.js';
import {
  handleAgentLoadInfo, handleSwarmRebalance, handleSwarmLoadOverview,
  handleClaimHistory, handleClaimMetrics, handleClaimConfig,
} from './mcp-tools/handlers-claim.js';


// Core Claiming Tools

export const issueClaimTool: MCPTool = {
  name: 'claims/issue_claim',
  description: 'Claim an issue to work on. Prevents duplicate work by ensuring only one agent/human works on an issue at a time.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to claim' },
      claimantType: { type: 'string', enum: ['human', 'agent'], description: 'Type of claimant' },
      claimantId: { type: 'string', description: 'ID of the claimant' },
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'Override priority for the claim',
      },
      expiresInMs: {
        type: 'number',
        description: 'Claim expiration time in milliseconds',
        minimum: 1,
      },
    },
    required: ['issueId', 'claimantType', 'claimantId'],
  },
  handler: async (input, context) => {
    const validated = issueClaimSchema.parse(input);
    return handleIssueClaim(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'coordination'],
  version: '1.0.0',
};

export const issueReleaseTool: MCPTool = {
  name: 'claims/issue_release',
  description: 'Release a claim on an issue, making it available for others to work on.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to release' },
      claimantId: { type: 'string', description: 'ID of the current claimant' },
      reason: { type: 'string', description: 'Reason for releasing the claim' },
    },
    required: ['issueId', 'claimantId'],
  },
  handler: async (input, context) => {
    const validated = issueReleaseSchema.parse(input);
    return handleIssueRelease(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'release'],
  version: '1.0.0',
};

export const issueHandoffTool: MCPTool = {
  name: 'claims/issue_handoff',
  description: 'Request handoff of an issue to another agent or human. Useful when blocked or needing specific expertise.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID for handoff' },
      fromId: { type: 'string', description: 'Current claimant ID' },
      toId: { type: 'string', description: 'Target claimant ID (optional for open handoff)' },
      toType: { type: 'string', enum: ['human', 'agent'], description: 'Target claimant type' },
      reason: {
        type: 'string',
        enum: ['blocked', 'expertise-needed', 'capacity', 'reassignment', 'other'],
        description: 'Reason for handoff',
      },
      notes: { type: 'string', description: 'Additional notes for handoff' },
    },
    required: ['issueId', 'fromId', 'reason'],
  },
  handler: async (input, context) => {
    const validated = issueHandoffSchema.parse(input);
    return handleIssueHandoff(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'handoff', 'coordination'],
  version: '1.0.0',
};

export const issueStatusUpdateTool: MCPTool = {
  name: 'claims/issue_status_update',
  description: 'Update the status of a claimed issue. Track progress and communicate blockers.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to update' },
      claimantId: { type: 'string', description: 'Current claimant ID' },
      status: {
        type: 'string',
        enum: ['active', 'blocked', 'in-review', 'completed'],
        description: 'New status',
      },
      progress: {
        type: 'number',
        description: 'Progress percentage (0-100)',
        minimum: 0,
        maximum: 100,
      },
      notes: { type: 'string', description: 'Status update notes' },
    },
    required: ['issueId', 'claimantId', 'status'],
  },
  handler: async (input, context) => {
    const validated = issueStatusUpdateSchema.parse(input);
    return handleIssueStatusUpdate(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'status', 'progress'],
  version: '1.0.0',
};

export const issueListAvailableTool: MCPTool = {
  name: 'claims/issue_list_available',
  description: 'List all unclaimed issues available for work. Filter by priority, labels, or repository.',
  inputSchema: {
    type: 'object',
    properties: {
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'Filter by priority',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by labels',
      },
      repository: { type: 'string', description: 'Filter by repository' },
      limit: {
        type: 'number',
        description: 'Maximum results',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        minimum: 0,
        default: 0,
      },
    },
  },
  handler: async (input, context) => {
    const validated = issueListAvailableSchema.parse(input);
    return handleIssueListAvailable(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'list', 'available'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

export const issueListMineTool: MCPTool = {
  name: 'claims/issue_list_mine',
  description: 'List all issues claimed by a specific claimant. Filter by status.',
  inputSchema: {
    type: 'object',
    properties: {
      claimantId: { type: 'string', description: 'Claimant ID' },
      status: {
        type: 'string',
        enum: ['active', 'blocked', 'in-review', 'completed', 'released', 'stolen'],
        description: 'Filter by status',
      },
      limit: {
        type: 'number',
        description: 'Maximum results',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        minimum: 0,
        default: 0,
      },
    },
    required: ['claimantId'],
  },
  handler: async (input, context) => {
    const validated = issueListMineSchema.parse(input);
    return handleIssueListMine(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'issue', 'list', 'my-claims'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 2000,
};

export const issueBoardTool: MCPTool = {
  name: 'claims/issue_board',
  description: 'View the claim board showing who is working on what. Group by claimant, priority, or status.',
  inputSchema: {
    type: 'object',
    properties: {
      includeAgents: {
        type: 'boolean',
        description: 'Include agent claims',
        default: true,
      },
      includeHumans: {
        type: 'boolean',
        description: 'Include human claims',
        default: true,
      },
      groupBy: {
        type: 'string',
        enum: ['claimant', 'priority', 'status'],
        description: 'Group claims by field',
      },
    },
  },
  handler: async (input, context) => {
    const validated = issueBoardSchema.parse(input);
    return handleIssueBoard(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'board', 'overview', 'coordination'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

// Work Stealing Tools

export const issueMarkStealableTool: MCPTool = {
  name: 'claims/issue_mark_stealable',
  description: 'Mark a claimed issue as stealable, allowing other agents/humans to take over the work.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to mark as stealable' },
      claimantId: { type: 'string', description: 'Current claimant ID' },
      reason: { type: 'string', description: 'Reason for making stealable' },
    },
    required: ['issueId', 'claimantId'],
  },
  handler: async (input, context) => {
    const validated = issueMarkStealableSchema.parse(input);
    return handleIssueMarkStealable(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'stealing', 'mark'],
  version: '1.0.0',
};

export const issueStealTool: MCPTool = {
  name: 'claims/issue_steal',
  description: 'Steal a stealable issue from another claimant. The previous claimant has a contest window to object.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to steal' },
      stealerId: { type: 'string', description: 'ID of the stealer' },
      stealerType: { type: 'string', enum: ['human', 'agent'], description: 'Type of stealer' },
      reason: { type: 'string', description: 'Reason for stealing' },
    },
    required: ['issueId', 'stealerId', 'stealerType'],
  },
  handler: async (input, context) => {
    const validated = issueStealSchema.parse(input);
    return handleIssueSteal(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'stealing', 'takeover'],
  version: '1.0.0',
};

export const issueGetStealableTool: MCPTool = {
  name: 'claims/issue_get_stealable',
  description: 'List all issues marked as stealable. Filter by priority.',
  inputSchema: {
    type: 'object',
    properties: {
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'Filter by priority',
      },
      limit: {
        type: 'number',
        description: 'Maximum results',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
    },
  },
  handler: async (input, context) => {
    const validated = issueGetStealableSchema.parse(input);
    return handleIssueGetStealable(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'stealing', 'list'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

export const issueContestStealTool: MCPTool = {
  name: 'claims/issue_contest_steal',
  description: 'Contest a steal within the contest window. Provide a reason for the contest.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID being contested' },
      contesterId: { type: 'string', description: 'ID of the contester' },
      reason: { type: 'string', description: 'Reason for contesting' },
    },
    required: ['issueId', 'contesterId', 'reason'],
  },
  handler: async (input, context) => {
    const validated = issueContestStealSchema.parse(input);
    return handleIssueContestSteal(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'stealing', 'contest'],
  version: '1.0.0',
};

// Load Balancing Tools

export const agentLoadInfoTool: MCPTool = {
  name: 'claims/agent_load_info',
  description: 'Get current load information for a specific agent including claims, tasks, and utilization.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Agent ID to get load info for' },
    },
    required: ['agentId'],
  },
  handler: async (input, context) => {
    const validated = agentLoadInfoSchema.parse(input);
    return handleAgentLoadInfo(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'load', 'agent', 'metrics'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 2000,
};

export const swarmRebalanceTool: MCPTool = {
  name: 'claims/swarm_rebalance',
  description: 'Trigger rebalancing of claims across the swarm to optimize load distribution.',
  inputSchema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['round-robin', 'least-loaded', 'priority-based', 'capability-based'],
        description: 'Rebalancing strategy',
        default: 'least-loaded',
      },
      dryRun: {
        type: 'boolean',
        description: 'Simulate without making changes',
        default: false,
      },
    },
  },
  handler: async (input, context) => {
    const validated = swarmRebalanceSchema.parse(input);
    return handleSwarmRebalance(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'load', 'swarm', 'rebalance'],
  version: '1.0.0',
};

export const swarmLoadOverviewTool: MCPTool = {
  name: 'claims/swarm_load_overview',
  description: 'Get swarm-wide load distribution including all agents, bottlenecks, and optimization recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      includeRecommendations: {
        type: 'boolean',
        description: 'Include optimization recommendations',
        default: true,
      },
    },
  },
  handler: async (input, context) => {
    const validated = swarmLoadOverviewSchema.parse(input);
    return handleSwarmLoadOverview(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'load', 'swarm', 'overview', 'metrics'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

// Additional Tools

export const claimHistoryTool: MCPTool = {
  name: 'claims/claim_history',
  description: 'Get the claim history for a specific issue showing all past claims and actions.',
  inputSchema: {
    type: 'object',
    properties: {
      issueId: { type: 'string', description: 'Issue ID to get history for' },
      limit: {
        type: 'number',
        description: 'Maximum entries',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
    },
    required: ['issueId'],
  },
  handler: async (input, context) => {
    const validated = claimHistorySchema.parse(input);
    return handleClaimHistory(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'history', 'audit'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 10000,
};

export const claimMetricsTool: MCPTool = {
  name: 'claims/claim_metrics',
  description: 'Get claiming metrics including totals, averages, and distributions by priority and status.',
  inputSchema: {
    type: 'object',
    properties: {
      timeRange: {
        type: 'string',
        enum: ['1h', '24h', '7d', '30d', 'all'],
        description: 'Time range for metrics',
        default: '24h',
      },
    },
  },
  handler: async (input, context) => {
    const validated = claimMetricsSchema.parse(input);
    return handleClaimMetrics(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'metrics', 'analytics'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 30000,
};

export const claimConfigTool: MCPTool = {
  name: 'claims/claim_config',
  description: 'Get or set claiming configuration including expiration times, limits, and contest windows.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set'], description: 'Get or set configuration' },
      config: {
        type: 'object',
        description: 'Configuration values (for set action)',
        properties: {
          defaultExpirationMs: { type: 'number', minimum: 1 },
          maxClaimsPerAgent: { type: 'number', minimum: 1 },
          contestWindowMs: { type: 'number', minimum: 1 },
          autoReleaseOnInactivityMs: { type: 'number', minimum: 1 },
        },
      },
    },
    required: ['action'],
  },
  handler: async (input, context) => {
    const validated = claimConfigSchema.parse(input);
    return handleClaimConfig(validated, context);
  },
  category: 'claims',
  tags: ['claims', 'config', 'settings'],
  version: '1.0.0',
};

// ============================================================================
// Tool Collections
// ============================================================================

/**
 * Core claiming tools (7 tools)
 */
export const coreClaimingTools: MCPTool[] = [
  issueClaimTool,
  issueReleaseTool,
  issueHandoffTool,
  issueStatusUpdateTool,
  issueListAvailableTool,
  issueListMineTool,
  issueBoardTool,
];

/**
 * Work stealing tools (4 tools)
 */
export const workStealingTools: MCPTool[] = [
  issueMarkStealableTool,
  issueStealTool,
  issueGetStealableTool,
  issueContestStealTool,
];

/**
 * Load balancing tools (3 tools)
 */
export const loadBalancingTools: MCPTool[] = [
  agentLoadInfoTool,
  swarmRebalanceTool,
  swarmLoadOverviewTool,
];

/**
 * Additional tools (3 tools)
 */
export const additionalClaimsTools: MCPTool[] = [
  claimHistoryTool,
  claimMetricsTool,
  claimConfigTool,
];

/**
 * All claims tools (17 tools total)
 */
export const claimsTools: MCPTool[] = [
  ...coreClaimingTools,
  ...workStealingTools,
  ...loadBalancingTools,
  ...additionalClaimsTools,
];

// ============================================================================
// Registration Function
// ============================================================================

/**
 * Register all claims tools with an MCP server or tool registry
 *
 * @param registry - Tool registry or server to register with
 * @returns Number of tools registered
 *
 * @example
 * ```typescript
 * import { registerClaimsTools, claimsTools } from '@claude-flow/claims';
 *
 * // Register all tools
 * const count = registerClaimsTools(server);
 * console.log(`Registered ${count} claims tools`);
 *
 * // Or use tools directly
 * server.registerTools(claimsTools);
 * ```
 */
export function registerClaimsTools(
  registry: { registerTool?: (tool: MCPTool) => void; register?: (tool: MCPTool) => void }
): number {
  const registerFn = registry.registerTool || registry.register;

  if (!registerFn) {
    throw new Error('Registry must have a registerTool or register method');
  }

  claimsTools.forEach(tool => registerFn.call(registry, tool));

  return claimsTools.length;
}

/**
 * Get claims tools by category
 *
 * @param category - Category name: 'core', 'stealing', 'load', or 'additional'
 * @returns Array of tools in that category
 */
export function getClaimsToolsByCategory(
  category: 'core' | 'stealing' | 'load' | 'additional'
): MCPTool[] {
  switch (category) {
    case 'core':
      return coreClaimingTools;
    case 'stealing':
      return workStealingTools;
    case 'load':
      return loadBalancingTools;
    case 'additional':
      return additionalClaimsTools;
    default:
      return [];
  }
}

/**
 * Get a specific claims tool by name
 *
 * @param name - Tool name (e.g., 'claims/issue_claim')
 * @returns The tool if found, undefined otherwise
 */
export function getClaimsToolByName(name: string): MCPTool | undefined {
  return claimsTools.find(tool => tool.name === name);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // All tools
  claimsTools,

  // Tool categories
  coreClaimingTools,
  workStealingTools,
  loadBalancingTools,
  additionalClaimsTools,

  // Individual tools
  issueClaimTool,
  issueReleaseTool,
  issueHandoffTool,
  issueStatusUpdateTool,
  issueListAvailableTool,
  issueListMineTool,
  issueBoardTool,
  issueMarkStealableTool,
  issueStealTool,
  issueGetStealableTool,
  issueContestStealTool,
  agentLoadInfoTool,
  swarmRebalanceTool,
  swarmLoadOverviewTool,
  claimHistoryTool,
  claimMetricsTool,
  claimConfigTool,

  // Utility functions
  registerClaimsTools,
  getClaimsToolsByCategory,
  getClaimsToolByName,
};

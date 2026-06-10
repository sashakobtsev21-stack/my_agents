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

// This file is now the claims-tools registrar: it assembles the tool
// collections + claimsTools[] from the objects extracted into the
// ./mcp-tools/ directory during the P3.17 god-file decomposition
// (W127-W130). Sub-modules: schemas · store · tool-types ·
// handlers-issue · handlers-claim · tools.
import type { MCPTool } from './mcp-tools/tool-types.js';
import {
  issueClaimTool, issueReleaseTool, issueHandoffTool, issueStatusUpdateTool,
  issueListAvailableTool, issueListMineTool, issueBoardTool, issueMarkStealableTool,
  issueStealTool, issueGetStealableTool, issueContestStealTool,
  agentLoadInfoTool, swarmRebalanceTool, swarmLoadOverviewTool,
  claimHistoryTool, claimMetricsTool, claimConfigTool,
} from './mcp-tools/tools.js';
// Re-export the tool objects + framework types so external/test callers
// that import them by name from this module keep resolving byte-identically.
export type { JSONSchema, ToolContext, ToolHandler, MCPTool } from './mcp-tools/tool-types.js';
export {
  issueClaimTool, issueReleaseTool, issueHandoffTool, issueStatusUpdateTool,
  issueListAvailableTool, issueListMineTool, issueBoardTool, issueMarkStealableTool,
  issueStealTool, issueGetStealableTool, issueContestStealTool,
  agentLoadInfoTool, swarmRebalanceTool, swarmLoadOverviewTool,
  claimHistoryTool, claimMetricsTool, claimConfigTool,
} from './mcp-tools/tools.js';



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

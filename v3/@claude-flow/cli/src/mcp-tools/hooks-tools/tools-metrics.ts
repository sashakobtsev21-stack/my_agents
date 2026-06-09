/**
 * MCP tool definitions for the metrics surface:
 *   - hooks_metrics  (ADR-093 F1: read from the trajectory/pattern
 *                     store that post-task + intelligence_stats write
 *                     to. Previously key-substring-filtered for
 *                     "pattern"/"route"/"task" — none of which match
 *                     the trajectory keys post-task actually writes,
 *                     so counters stayed at 0 forever / #1686.)
 *   - hooks_list     (registered hooks catalogue)
 *
 * Extracted from hooks-tools.ts (W51, P3.2 cut #21).
 */
import { type MCPTool } from '../types.js';
import { getIntelligenceStatsFromMemory } from './memory-store.js';
import { loadRoutingOutcomes } from './routing-patterns.js';

export const hooksMetrics: MCPTool = {
  name: 'hooks_metrics',
  description: 'View learning metrics dashboard Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      period: { type: 'string', description: 'Metrics period (1h, 24h, 7d, 30d)' },
      includeV3: { type: 'boolean', description: 'Include V3 performance metrics' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const period = (params.period as string) || '24h';

    // ADR-093 F1: read from the same trajectory/pattern store that
    // hooks_post-task and hooks_intelligence_stats write to. Previously
    // this handler key-substring-filtered the memory store for "pattern",
    // "route", "task" — none of which match the trajectory keys that
    // post-task actually writes — so counters stayed at 0 forever (#1686).
    const stats = getIntelligenceStatsFromMemory();

    // Routing outcomes are persisted to a separate file (loadRoutingOutcomes)
    // by post-task; surface them so the dashboard sees command counters too.
    let routingOutcomes: Array<{ success: boolean; agent?: string }> = [];
    try {
      routingOutcomes = loadRoutingOutcomes() as Array<{ success: boolean; agent?: string }>;
    } catch { /* non-fatal */ }

    const totalCommands = routingOutcomes.length;
    const successfulCommands = routingOutcomes.filter(o => o.success).length;
    const successRate = totalCommands > 0 ? successfulCommands / totalCommands : null;

    // Compute top agent from routing outcomes
    const agentCounts: Record<string, number> = {};
    for (const o of routingOutcomes) {
      if (o.agent) agentCounts[o.agent] = (agentCounts[o.agent] || 0) + 1;
    }
    const topAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const successful = stats.trajectories.successful;
    const total = stats.trajectories.total;
    const failed = Math.max(0, total - successful);

    return {
      _real: true,
      _dataSource: 'intelligence-stats + routing-outcomes',
      period,
      patterns: {
        total: stats.patterns.learned,
        successful,
        failed,
        avgConfidence: stats.routing.avgConfidence || null,
      },
      agents: {
        routingAccuracy: stats.routing.avgConfidence || null,
        totalRoutes: stats.routing.decisions,
        topAgent,
      },
      commands: {
        totalExecuted: totalCommands,
        successRate,
        avgRiskScore: null,
      },
      _note: total === 0 && totalCommands === 0
        ? 'No metrics data collected yet. Run hooks_post-task / hooks_intelligence_trajectory-end / hooks_route to populate.'
        : undefined,
      lastUpdated: new Date().toISOString(),
    };
  },
};

export const hooksList: MCPTool = {
  name: 'hooks_list',
  description: 'List all registered hooks Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    return {
      hooks: [
        // Core hooks
        { name: 'pre-edit', type: 'PreToolUse', status: 'active' },
        { name: 'post-edit', type: 'PostToolUse', status: 'active' },
        { name: 'pre-command', type: 'PreToolUse', status: 'active' },
        { name: 'post-command', type: 'PostToolUse', status: 'active' },
        { name: 'pre-task', type: 'PreToolUse', status: 'active' },
        { name: 'post-task', type: 'PostToolUse', status: 'active' },
        // Routing hooks
        { name: 'route', type: 'intelligence', status: 'active' },
        { name: 'explain', type: 'intelligence', status: 'active' },
        // Session hooks
        { name: 'session-start', type: 'SessionStart', status: 'active' },
        { name: 'session-end', type: 'SessionEnd', status: 'active' },
        { name: 'session-restore', type: 'SessionStart', status: 'active' },
        // Learning hooks
        { name: 'pretrain', type: 'intelligence', status: 'active' },
        { name: 'build-agents', type: 'intelligence', status: 'active' },
        { name: 'transfer', type: 'intelligence', status: 'active' },
        { name: 'metrics', type: 'analytics', status: 'active' },
        // System hooks
        { name: 'init', type: 'system', status: 'active' },
        { name: 'notify', type: 'coordination', status: 'active' },
        // Intelligence subcommands
        { name: 'intelligence', type: 'intelligence', status: 'active' },
        { name: 'intelligence_trajectory-start', type: 'intelligence', status: 'active' },
        { name: 'intelligence_trajectory-step', type: 'intelligence', status: 'active' },
        { name: 'intelligence_trajectory-end', type: 'intelligence', status: 'active' },
        { name: 'intelligence_pattern-store', type: 'intelligence', status: 'active' },
        { name: 'intelligence_pattern-search', type: 'intelligence', status: 'active' },
        { name: 'intelligence_stats', type: 'analytics', status: 'active' },
        { name: 'intelligence_learn', type: 'intelligence', status: 'active' },
        { name: 'intelligence_attention', type: 'intelligence', status: 'active' },
      ],
      total: 26,
    };
  },
};

/**
 * `claude-flow hooks metrics` — learning-metrics dashboard.
 *
 * Pilot extraction (issue #7).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';
import { safeNum } from './helpers.js';

export const metricsCommand: Command = {
  name: 'metrics',
  description: 'View learning metrics dashboard',
  options: [
    {
      name: 'period',
      short: 'p',
      description: 'Time period (1h, 24h, 7d, 30d, all)',
      type: 'string',
      default: '24h'
    },
    {
      name: 'v3-dashboard',
      description: 'Show V3 performance dashboard',
      type: 'boolean',
      default: false
    },
    {
      name: 'category',
      short: 'c',
      description: 'Metric category (patterns, agents, commands, performance)',
      type: 'string'
    }
  ],
  examples: [
    { command: 'claude-flow hooks metrics', description: 'View 24h metrics' },
    { command: 'claude-flow hooks metrics --period 7d --v3-dashboard', description: 'V3 metrics for 7 days' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const period = ctx.flags.period as string || '24h';
    const v3Dashboard = ctx.flags.v3Dashboard as boolean;

    output.writeln();
    output.writeln(output.bold(`Learning Metrics Dashboard (${period})`));
    output.writeln();

    try {
      // Call MCP tool for metrics. The tool returns `{ summary, routing,
      // edits, commands }` (see MetricsResult in v3/mcp/tools/hooks-tools.ts)
      // but earlier CLI versions expected `{ patterns, agents, commands.avgRiskScore }`.
      // Accept the union and normalize below — without the `?? 0` guards the
      // dashboard crashed with "Cannot read properties of null (reading 'toFixed')"
      // whenever a counter was missing (#1686).
      const rawMetrics = await callMCPTool<{
        period?: string;
        category?: string;
        timeRange?: string;
        summary?: {
          totalOperations?: number;
          successRate?: number;
          avgQuality?: number;
          patternsLearned?: number;
        };
        patterns?: {
          total?: number;
          successful?: number;
          failed?: number;
          avgConfidence?: number;
        };
        routing?: {
          totalRoutes?: number;
          avgConfidence?: number;
          topAgents?: Array<{ agent: string; count: number; successRate: number }>;
        };
        agents?: {
          routingAccuracy?: number;
          totalRoutes?: number;
          topAgent?: string;
        };
        commands?: {
          totalCommands?: number;
          totalExecuted?: number;
          successRate?: number;
          avgExecutionTime?: number;
          avgRiskScore?: number;
        };
        performance?: {
          flashAttention?: string;
          memoryReduction?: string;
          searchImprovement?: string;
          tokenReduction?: string;
        };
      }>('hooks_metrics', {
        period,
        includeV3: v3Dashboard,
        category: ctx.flags.category,
      });

      // Normalize across both shapes; default every numeric to 0 so toFixed
      // never sees null/undefined. #1686 — also coerce NaN through `safeNum`
      // because `?? 0` only catches null/undefined; an upstream NaN would
      // still land in `.toFixed(...)` and surface as `"NaN"`.
      const totalPatterns = safeNum(rawMetrics.patterns?.total ?? rawMetrics.summary?.patternsLearned);
      const successfulPatterns = safeNum(rawMetrics.patterns?.successful ?? Math.round(safeNum(rawMetrics.summary?.successRate) * totalPatterns));
      const failedPatterns = Math.max(0, safeNum(rawMetrics.patterns?.failed ?? totalPatterns - successfulPatterns));
      const avgConfidence = safeNum(rawMetrics.patterns?.avgConfidence ?? rawMetrics.summary?.avgQuality);

      const routingAccuracy = safeNum(rawMetrics.agents?.routingAccuracy ?? rawMetrics.routing?.avgConfidence);
      const totalRoutes = safeNum(rawMetrics.agents?.totalRoutes ?? rawMetrics.routing?.totalRoutes);
      const topAgent = rawMetrics.agents?.topAgent ?? rawMetrics.routing?.topAgents?.[0]?.agent ?? 'n/a';

      const totalCommands = safeNum(rawMetrics.commands?.totalExecuted ?? rawMetrics.commands?.totalCommands);
      const commandSuccessRate = safeNum(rawMetrics.commands?.successRate);
      const avgRiskScore = safeNum(rawMetrics.commands?.avgRiskScore ?? rawMetrics.commands?.avgExecutionTime);

      const result = {
        ...rawMetrics,
        patterns: { total: totalPatterns, successful: successfulPatterns, failed: failedPatterns, avgConfidence },
        agents: { routingAccuracy, totalRoutes, topAgent },
        commands: { totalExecuted: totalCommands, successRate: commandSuccessRate, avgRiskScore },
      };

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      // Patterns section
      output.writeln(output.bold('📊 Pattern Learning'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 20, align: 'right' }
        ],
        data: [
          { metric: 'Total Patterns', value: totalPatterns },
          { metric: 'Successful', value: output.success(String(successfulPatterns)) },
          { metric: 'Failed', value: output.error(String(failedPatterns)) },
          { metric: 'Avg Confidence', value: `${(avgConfidence * 100).toFixed(1)}%` }
        ]
      });

      output.writeln();

      // Agent routing section
      output.writeln(output.bold('🤖 Agent Routing'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 20, align: 'right' }
        ],
        data: [
          { metric: 'Routing Accuracy', value: `${(routingAccuracy * 100).toFixed(1)}%` },
          { metric: 'Total Routes', value: totalRoutes },
          { metric: 'Top Agent', value: output.highlight(topAgent) }
        ]
      });

      output.writeln();

      // Command execution section
      output.writeln(output.bold('⚡ Command Execution'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 20, align: 'right' }
        ],
        data: [
          { metric: 'Total Executed', value: totalCommands },
          { metric: 'Success Rate', value: `${(commandSuccessRate * 100).toFixed(1)}%` },
          { metric: 'Avg Risk Score', value: avgRiskScore.toFixed(2) }
        ]
      });

      if (v3Dashboard && result.performance) {
        const p = result.performance;
        output.writeln();
        output.writeln(output.bold('🚀 V3 Performance Gains'));
        output.printList([
          `Flash Attention: ${output.success(p.flashAttention ?? 'N/A')}`,
          `Memory Reduction: ${output.success(p.memoryReduction ?? 'N/A')}`,
          `Search Improvement: ${output.success(p.searchImprovement ?? 'N/A')}`,
          `Token Reduction: ${output.success(p.tokenReduction ?? 'N/A')}`
        ]);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Metrics error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

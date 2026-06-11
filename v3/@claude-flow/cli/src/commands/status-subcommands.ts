/**
 * Status Command — agents / tasks / memory subcommands
 *
 * Extracted verbatim from status.ts (lines 517-719) during campaign-2
 * wave 71 (W277). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import {
  formatBytes,
  formatHealth,
  formatUptime,
} from './status-helpers.js';

export const agentsCommand: Command = {
  name: 'agents',
  description: 'Show detailed agent status',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await callMCPTool<{
        agents: Array<{
          id: string;
          type: string;
          status: string;
          task?: string;
          uptime: number;
          metrics: { tasksCompleted: number; successRate: number };
        }>;
      }>('agent_list', { includeMetrics: true, status: 'all' });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Agent Status'));
      output.writeln();

      if (result.agents.length === 0) {
        output.printInfo('No agents running');
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'id', header: 'ID', width: 20 },
          { key: 'type', header: 'Type', width: 12 },
          { key: 'status', header: 'Status', width: 10 },
          { key: 'task', header: 'Current Task', width: 25 },
          { key: 'uptime', header: 'Uptime', width: 12 },
          { key: 'success', header: 'Success', width: 8 }
        ],
        data: result.agents.map(a => ({
          id: a.id,
          type: a.type,
          status: formatHealth(a.status),
          task: a.task || '-',
          uptime: formatUptime(a.uptime),
          success: `${(a.metrics.successRate * 100).toFixed(0)}%`
        }))
      });

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get agent status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Tasks subcommand
export const tasksCommand: Command = {
  name: 'tasks',
  description: 'Show detailed task status',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await callMCPTool<{
        tasks: Array<{
          id: string;
          type: string;
          status: string;
          priority: string;
          agent?: string;
          progress: number;
          createdAt: string;
        }>;
      }>('task_list', { status: 'all', limit: 50 });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Task Status'));
      output.writeln();

      if (result.tasks.length === 0) {
        output.printInfo('No tasks');
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'id', header: 'ID', width: 15 },
          { key: 'type', header: 'Type', width: 15 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'priority', header: 'Priority', width: 10 },
          { key: 'agent', header: 'Agent', width: 15 },
          { key: 'progress', header: 'Progress', width: 10 }
        ],
        data: result.tasks.map(t => ({
          id: t.id,
          type: t.type,
          status: formatHealth(t.status),
          priority: t.priority,
          agent: t.agent || '-',
          progress: `${t.progress}%`
        }))
      });

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get task status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Memory subcommand
export const memoryCommand: Command = {
  name: 'memory',
  description: 'Show detailed memory status',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await callMCPTool<{
        backend: string;
        entries: number;
        size: number;
        namespaces: Array<{ name: string; entries: number }>;
        performance: {
          avgSearchTime: number;
          avgWriteTime: number;
          cacheHitRate: number;
          hnswEnabled: boolean;
        };
        v3Gains: {
          searchImprovement: string;
          memoryReduction: string;
        };
      }>('memory_detailed-stats', {});

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Memory Status'));
      output.writeln();

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 20 },
          { key: 'value', header: 'Value', width: 25 }
        ],
        data: [
          { property: 'Backend', value: result.backend },
          { property: 'Total Entries', value: result.entries.toLocaleString() },
          { property: 'Storage Size', value: formatBytes(result.size) },
          { property: 'HNSW Index', value: result.performance.hnswEnabled ? 'Enabled' : 'Disabled' }
        ]
      });

      output.writeln();
      output.writeln(output.bold('Performance'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 20 },
          { key: 'value', header: 'Value', width: 20, align: 'right' }
        ],
        data: [
          { metric: 'Avg Search Time', value: `${result.performance.avgSearchTime.toFixed(2)}ms` },
          { metric: 'Avg Write Time', value: `${result.performance.avgWriteTime.toFixed(2)}ms` },
          { metric: 'Cache Hit Rate', value: `${(result.performance.cacheHitRate * 100).toFixed(1)}%` }
        ]
      });

      output.writeln();
      output.writeln(output.bold('V3 Performance Gains'));
      output.printList([
        `Search Speed: ${output.success(result.v3Gains.searchImprovement)}`,
        `Memory Usage: ${output.success(result.v3Gains.memoryReduction)}`
      ]);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get memory status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Main status command

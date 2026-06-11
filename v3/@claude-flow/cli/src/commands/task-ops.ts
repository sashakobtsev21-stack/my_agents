/**
 * Task Command — cancel / assign / retry subcommands
 *
 * Extracted verbatim from task.ts (lines 515-758) during campaign-2
 * wave 56 (W262). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { confirm, multiSelect } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import {
  formatStatus,
} from './task-helpers.js';

export const cancelCommand: Command = {
  name: 'cancel',
  aliases: ['abort', 'stop'],
  description: 'Cancel a running task',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force cancel without confirmation',
      type: 'boolean',
      default: false
    },
    {
      name: 'reason',
      short: 'r',
      description: 'Cancellation reason',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const taskId = ctx.args[0];
    const force = ctx.flags.force as boolean;
    const reason = ctx.flags.reason as string;

    if (!taskId) {
      output.printError('Task ID is required');
      return { success: false, exitCode: 1 };
    }

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: `Are you sure you want to cancel task ${taskId}?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    try {
      const result = await callMCPTool<{
        taskId: string;
        cancelled: boolean;
        previousStatus: string;
        cancelledAt: string;
      }>('task_cancel', {
        taskId,
        reason: reason || 'Cancelled by user via CLI'
      });

      output.writeln();
      output.printSuccess(`Task ${taskId} cancelled`);
      output.printInfo(`Previous status: ${result.previousStatus}`);

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to cancel task: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Assign subcommand
export const assignCommand: Command = {
  name: 'assign',
  description: 'Assign a task to agent(s)',
  options: [
    {
      name: 'agent',
      short: 'a',
      description: 'Agent ID(s) to assign (comma-separated)',
      type: 'string'
    },
    {
      name: 'unassign',
      description: 'Remove current assignment',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const taskId = ctx.args[0];
    const agentIds = ctx.flags.agent as string;
    const unassign = ctx.flags.unassign as boolean;

    if (!taskId) {
      output.printError('Task ID is required');
      return { success: false, exitCode: 1 };
    }

    if (!agentIds && !unassign) {
      // Interactive agent selection
      if (ctx.interactive) {
        try {
          const agents = await callMCPTool<{
            agents: Array<{ id: string; type: string; status: string }>;
          }>('agent_list', { status: 'active,idle' });

          if (agents.agents.length === 0) {
            output.printWarning('No available agents');
            return { success: false, exitCode: 1 };
          }

          const selectedAgents = await multiSelect({
            message: 'Select agent(s) to assign:',
            options: agents.agents.map(a => ({
              value: a.id,
              label: a.id,
              hint: `${a.type} - ${a.status}`
            })),
            required: true
          });

          if (selectedAgents.length === 0) {
            output.printInfo('No agents selected');
            return { success: true };
          }

          // Continue with assignment
          const result = await callMCPTool<{
            taskId: string;
            assignedTo: string[];
            previouslyAssigned: string[];
          }>('task_assign', {
            taskId,
            agentIds: selectedAgents
          });

          output.writeln();
          output.printSuccess(`Task ${taskId} assigned to ${result.assignedTo.join(', ')}`);

          return { success: true, data: result };
        } catch (error) {
          if (error instanceof Error && error.message === 'User cancelled') {
            output.printInfo('Operation cancelled');
            return { success: true };
          }
          throw error;
        }
      }

      output.printError('Agent ID is required. Use --agent flag or run in interactive mode');
      return { success: false, exitCode: 1 };
    }

    try {
      const result = await callMCPTool<{
        taskId: string;
        assignedTo: string[];
        previouslyAssigned: string[];
      }>('task_assign', {
        taskId,
        agentIds: unassign ? [] : agentIds.split(',').map(id => id.trim()),
        unassign
      });

      output.writeln();
      if (unassign) {
        output.printSuccess(`Task ${taskId} unassigned`);
      } else {
        output.printSuccess(`Task ${taskId} assigned to ${result.assignedTo.join(', ')}`);
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to assign task: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Retry subcommand
export const retryCommand: Command = {
  name: 'retry',
  aliases: ['rerun'],
  description: 'Retry a failed task',
  options: [
    {
      name: 'reset-state',
      description: 'Reset task state completely',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const taskId = ctx.args[0];
    const resetState = ctx.flags['reset-state'] as boolean;

    if (!taskId) {
      output.printError('Task ID is required');
      return { success: false, exitCode: 1 };
    }

    try {
      const result = await callMCPTool<{
        taskId: string;
        newTaskId: string;
        previousStatus: string;
        status: string;
      }>('task_retry', {
        taskId,
        resetState
      });

      output.writeln();
      output.printSuccess(`Task ${taskId} retried`);
      output.printInfo(`New task ID: ${result.newTaskId}`);
      output.printInfo(`Status: ${formatStatus(result.status)}`);

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to retry task: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Main task command

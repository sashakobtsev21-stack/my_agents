/**
 * Claims CLI — work-stealing & load-balancing subcommands
 *
 * stealable / mark-stealable / steal / contest / load / rebalance.
 * Module-private in the original cli-commands.ts (P3.77, W200); only
 * the command consts are imported back by the barrel's issuesCommand.
 */

import type { Command, CommandContext, CommandResult } from './cli-types.js';
import { output, confirm, input, callMCPTool, MCPClientError } from './cli-types.js';
import type {
  AgentLoad,
  Claim,
  ContestResult,
  RebalanceResult,
} from './cli-commands-types.js';
import {
  formatAgentStatus,
  formatClaimStatus,
  formatProgress,
} from './cli-commands-formatters.js';

// Work Stealing Commands
// ============================================

export const stealableCommand: Command = {
  name: 'stealable',
  description: 'List stealable issues',
  options: [
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum number of issues to show',
      type: 'number',
      default: 20
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const limit = ctx.flags.limit as number;

    try {
      const result = await callMCPTool<{
        claims: Claim[];
        total: number;
      }>('claims/stealable', { limit });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Stealable Issues'));
      output.writeln();

      if (result.claims.length === 0) {
        output.printInfo('No stealable issues available');
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'issue', header: 'Issue', width: 12 },
          { key: 'claimant', header: 'Current Owner', width: 15 },
          { key: 'progress', header: 'Progress', width: 10 },
          { key: 'reason', header: 'Stealable Reason', width: 30 }
        ],
        data: result.claims.map(c => ({
          issue: c.issueId,
          claimant: c.claimantId,
          progress: formatProgress(c.progress),
          reason: c.stealableReason || output.dim('No reason provided')
        }))
      });

      output.writeln();
      output.printInfo(`Showing ${result.claims.length} of ${result.total} stealable issues`);
      output.writeln();
      output.printInfo('Use "claude-flow issues steal <issueId>" to take over an issue');

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to list stealable issues: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

export const stealCommand: Command = {
  name: 'steal',
  description: 'Steal an issue from another agent',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force steal without confirmation',
      type: 'boolean',
      default: false
    },
    {
      name: 'reason',
      short: 'r',
      description: 'Reason for stealing',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    const force = ctx.flags.force as boolean;
    const reason = ctx.flags.reason as string | undefined;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues steal <issueId>');
      return { success: false, exitCode: 1 };
    }

    if (!force && ctx.interactive) {
      output.writeln();
      output.printWarning('Work stealing should be used responsibly.');
      output.printInfo('This action will reassign the issue to you.');
      output.writeln();

      const confirmed = await confirm({
        message: `Steal issue ${issueId}?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.writeln();
    output.printInfo(`Stealing issue ${output.highlight(issueId)}...`);

    try {
      const result = await callMCPTool<Claim>('claims/steal', {
        issueId,
        reason
      });

      output.writeln();
      output.printSuccess(`Issue ${issueId} stolen successfully`);
      output.writeln();

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Issue ID', value: result.issueId },
          { property: 'New Claimant', value: result.claimantId },
          { property: 'Status', value: formatClaimStatus(result.status) },
          { property: 'Progress', value: formatProgress(result.progress) }
        ]
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to steal issue: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

export const markStealableCommand: Command = {
  name: 'mark-stealable',
  description: 'Mark my claim as stealable',
  options: [
    {
      name: 'reason',
      short: 'r',
      description: 'Reason for marking as stealable',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    let reason = ctx.flags.reason as string | undefined;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues mark-stealable <issueId>');
      return { success: false, exitCode: 1 };
    }

    if (!reason && ctx.interactive) {
      reason = await input({
        message: 'Reason for marking as stealable (optional):',
        default: ''
      });
    }

    output.writeln();
    output.printInfo(`Marking issue ${output.highlight(issueId)} as stealable...`);

    try {
      const result = await callMCPTool<Claim>('claims/mark-stealable', {
        issueId,
        reason: reason || undefined
      });

      output.writeln();
      output.printSuccess(`Issue ${issueId} marked as stealable`);

      if (reason) {
        output.printInfo(`Reason: ${reason}`);
      }

      output.writeln();
      output.printWarning('Other agents can now claim this issue');

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to mark as stealable: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

export const contestCommand: Command = {
  name: 'contest',
  description: 'Contest a steal action',
  options: [
    {
      name: 'reason',
      short: 'r',
      description: 'Reason for contesting (required)',
      type: 'string',
      required: true
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    let reason = ctx.flags.reason as string;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues contest <issueId> --reason "..."');
      return { success: false, exitCode: 1 };
    }

    if (!reason && ctx.interactive) {
      reason = await input({
        message: 'Reason for contesting (required):',
        validate: (v) => v.length > 0 || 'Reason is required'
      });
    }

    if (!reason) {
      output.printError('Reason is required for contesting');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.printInfo(`Contesting steal on issue ${output.highlight(issueId)}...`);

    try {
      const result = await callMCPTool<ContestResult>('claims/contest', {
        issueId,
        reason
      });

      output.writeln();

      switch (result.resolution) {
        case 'steal-reverted':
          output.printSuccess('Contest successful - steal reverted');
          output.printInfo(`Issue ${issueId} returned to original claimant: ${result.originalClaimantId}`);
          break;
        case 'steal-upheld':
          output.printWarning('Contest denied - steal upheld');
          output.printInfo(`Issue ${issueId} remains with: ${result.contesterId}`);
          break;
        case 'pending-review':
          output.printWarning('Contest submitted for review');
          output.printInfo('A coordinator will review this contest');
          break;
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to contest steal: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Load Balancing Commands
// ============================================

export const loadCommand: Command = {
  name: 'load',
  description: 'View agent load distribution',
  options: [
    {
      name: 'agent',
      short: 'a',
      description: 'View specific agent load',
      type: 'string'
    },
    {
      name: 'sort',
      short: 's',
      description: 'Sort by field',
      type: 'string',
      choices: ['utilization', 'issues', 'agent'],
      default: 'utilization'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentId = ctx.flags.agent as string | undefined;
    const sortBy = ctx.flags.sort as string;

    try {
      const result = await callMCPTool<{
        agents: AgentLoad[];
        summary: {
          totalAgents: number;
          totalIssues: number;
          avgUtilization: number;
          overloadedCount: number;
          idleCount: number;
        };
      }>('claims/load', {
        agentId,
        sortBy
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Agent Load Distribution'));
      output.writeln();

      // Summary
      output.printList([
        `Total Agents: ${result.summary.totalAgents}`,
        `Active Issues: ${result.summary.totalIssues}`,
        `Avg Utilization: ${result.summary.avgUtilization.toFixed(1)}%`,
        `Overloaded: ${output.error(String(result.summary.overloadedCount))}`,
        `Idle: ${output.dim(String(result.summary.idleCount))}`
      ]);

      output.writeln();

      if (agentId) {
        // Single agent detail
        const agent = result.agents[0];
        if (!agent) {
          output.printError(`Agent ${agentId} not found`);
          return { success: false, exitCode: 1 };
        }

        output.printBox(
          [
            `Type:           ${agent.agentType}`,
            `Status:         ${formatAgentStatus(agent.status)}`,
            `Active Issues:  ${agent.activeIssues}`,
            `Capacity:       ${agent.totalCapacity}`,
            `Utilization:    ${output.progressBar(agent.utilizationPercent, 100, 30)}`,
            `Avg Completion: ${agent.avgCompletionTime}`
          ].join('\n'),
          `Agent: ${agent.agentId}`
        );
      } else {
        // All agents table
        output.printTable({
          columns: [
            { key: 'agent', header: 'Agent', width: 15 },
            { key: 'type', header: 'Type', width: 12 },
            { key: 'issues', header: 'Issues', width: 8, align: 'right' },
            { key: 'capacity', header: 'Cap', width: 6, align: 'right' },
            { key: 'utilization', header: 'Utilization', width: 15 },
            { key: 'status', header: 'Status', width: 12 }
          ],
          data: result.agents.map(a => ({
            agent: a.agentId,
            type: a.agentType,
            issues: a.activeIssues,
            capacity: a.totalCapacity,
            utilization: `${a.utilizationPercent.toFixed(0)}%`,
            status: formatAgentStatus(a.status)
          }))
        });
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get load info: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

export const rebalanceCommand: Command = {
  name: 'rebalance',
  description: 'Trigger swarm rebalancing',
  options: [
    {
      name: 'dry-run',
      short: 'd',
      description: 'Preview rebalancing without making changes',
      type: 'boolean',
      default: false
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force rebalancing without confirmation',
      type: 'boolean',
      default: false
    },
    {
      name: 'threshold',
      short: 't',
      description: 'Utilization threshold for rebalancing (0-100)',
      type: 'number',
      default: 80
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const dryRun = ctx.flags['dry-run'] as boolean;
    const force = ctx.flags.force as boolean;
    const threshold = ctx.flags.threshold as number;

    if (!dryRun && !force && ctx.interactive) {
      output.writeln();
      output.printWarning('This will reassign issues between agents to balance load.');

      const confirmed = await confirm({
        message: 'Proceed with rebalancing?',
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.writeln();

    if (dryRun) {
      output.printInfo('Analyzing rebalancing options (dry run)...');
    } else {
      output.printInfo('Rebalancing swarm workload...');
    }

    const spinner = output.createSpinner({ text: 'Calculating optimal distribution...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await callMCPTool<RebalanceResult>('claims/rebalance', {
        dryRun,
        threshold
      });

      spinner.stop();

      output.writeln();

      if (dryRun) {
        output.printSuccess('Rebalancing Analysis Complete (Dry Run)');
      } else {
        output.printSuccess('Rebalancing Complete');
      }

      output.writeln();

      // Summary stats
      output.printList([
        `Issues to move: ${output.highlight(String(result.moved))}`,
        `Issues skipped: ${output.dim(String(result.skipped))}`,
        `Mode: ${dryRun ? output.warning('DRY RUN') : output.success('APPLIED')}`
      ]);

      if (result.reassignments.length > 0) {
        output.writeln();
        output.writeln(output.bold('Reassignments'));

        output.printTable({
          columns: [
            { key: 'issue', header: 'Issue', width: 12 },
            { key: 'from', header: 'From', width: 15 },
            { key: 'to', header: 'To', width: 15 },
            { key: 'reason', header: 'Reason', width: 30 }
          ],
          data: result.reassignments.map(r => ({
            issue: r.issueId,
            from: r.fromAgent,
            to: r.toAgent,
            reason: r.reason
          }))
        });

        if (dryRun) {
          output.writeln();
          output.printInfo('Run without --dry-run to apply these changes');
        }
      } else {
        output.writeln();
        output.printInfo('No reassignments needed - workload is balanced');
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Rebalancing failed');

      if (error instanceof MCPClientError) {
        output.printError(`Failed to rebalance: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================

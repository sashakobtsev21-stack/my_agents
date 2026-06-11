/**
 * Claims CLI — core subcommands
 *
 * list / claim / release / handoff / status / board. Module-private in
 * the original cli-commands.ts (P3.77, W200); only the command consts
 * are imported back by the barrel's issuesCommand.
 */

import type { Command, CommandContext, CommandResult } from './cli-types.js';
import { output, confirm, input, callMCPTool, MCPClientError } from './cli-types.js';
import type {
  Claim,
  ClaimStatus,
  ClaimantType,
  HandoffRequest,
} from './cli-commands-types.js';
import {
  formatClaimStatus,
  formatClaimantType,
  formatProgress,
  formatTimeRemaining,
  parseTarget,
} from './cli-commands-formatters.js';

// List Subcommand
// ============================================

export const listCommand: Command = {
  name: 'list',
  aliases: ['ls'],
  description: 'List issues',
  options: [
    {
      name: 'available',
      short: 'a',
      description: 'Show only unclaimed issues',
      type: 'boolean',
      default: false
    },
    {
      name: 'mine',
      short: 'm',
      description: 'Show only my claims',
      type: 'boolean',
      default: false
    },
    {
      name: 'status',
      short: 's',
      description: 'Filter by status',
      type: 'string',
      choices: ['active', 'blocked', 'review-requested', 'stealable', 'completed']
    },
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum number of issues to show',
      type: 'number',
      default: 20
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const available = ctx.flags.available as boolean;
    const mine = ctx.flags.mine as boolean;
    const status = ctx.flags.status as ClaimStatus | undefined;
    const limit = ctx.flags.limit as number;

    try {
      const result = await callMCPTool<{
        claims: Claim[];
        total: number;
        available: number;
      }>('claims/list', {
        available,
        mine,
        status,
        limit
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();

      if (available) {
        output.writeln(output.bold('Available Issues (Unclaimed)'));
      } else if (mine) {
        output.writeln(output.bold('My Claims'));
      } else {
        output.writeln(output.bold('All Claims'));
      }

      output.writeln();

      if (result.claims.length === 0) {
        if (available) {
          output.printInfo('No unclaimed issues available');
        } else if (mine) {
          output.printInfo('You have no active claims');
        } else {
          output.printInfo('No claims found matching criteria');
        }
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'issueId', header: 'Issue', width: 12 },
          { key: 'claimant', header: 'Claimant', width: 15 },
          { key: 'type', header: 'Type', width: 8 },
          { key: 'status', header: 'Status', width: 16 },
          { key: 'progress', header: 'Progress', width: 10 },
          { key: 'time', header: 'Time Left', width: 12 }
        ],
        data: result.claims.map(c => ({
          issueId: c.issueId,
          claimant: c.claimantId || output.dim('unclaimed'),
          type: c.claimantType ? formatClaimantType(c.claimantType) : '-',
          status: formatClaimStatus(c.status),
          progress: formatProgress(c.progress),
          time: formatTimeRemaining(c.expiresAt)
        }))
      });

      output.writeln();
      output.printInfo(`Showing ${result.claims.length} of ${result.total} issues (${result.available} available)`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to list issues: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Claim Subcommand
// ============================================

export const claimCommand: Command = {
  name: 'claim',
  description: 'Claim an issue to work on',
  options: [
    {
      name: 'as',
      description: 'Claim as specific identity (agent:id or human:id)',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    const asIdentity = ctx.flags.as as string | undefined;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues claim <issueId>');
      return { success: false, exitCode: 1 };
    }

    let claimantId = 'current-agent';
    let claimantType: ClaimantType = 'agent';

    if (asIdentity) {
      const parsed = parseTarget(asIdentity);
      claimantId = parsed.id;
      claimantType = parsed.type;
    }

    output.writeln();
    output.printInfo(`Claiming issue ${output.highlight(issueId)}...`);

    try {
      const result = await callMCPTool<Claim>('claims/claim', {
        issueId,
        claimantId,
        claimantType
      });

      output.writeln();
      output.printSuccess(`Issue ${issueId} claimed successfully`);
      output.writeln();

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Issue ID', value: result.issueId },
          { property: 'Claimant', value: result.claimantId },
          { property: 'Type', value: formatClaimantType(result.claimantType) },
          { property: 'Status', value: formatClaimStatus(result.status) },
          { property: 'Claimed At', value: new Date(result.claimedAt).toLocaleString() },
          { property: 'Expires At', value: result.expiresAt ? new Date(result.expiresAt).toLocaleString() : 'N/A' }
        ]
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to claim issue: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Release Subcommand
// ============================================

export const releaseCommand: Command = {
  name: 'release',
  aliases: ['unclaim'],
  description: 'Release a claim on an issue',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force release without confirmation',
      type: 'boolean',
      default: false
    },
    {
      name: 'reason',
      short: 'r',
      description: 'Reason for releasing the claim',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    const force = ctx.flags.force as boolean;
    const reason = ctx.flags.reason as string | undefined;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues release <issueId>');
      return { success: false, exitCode: 1 };
    }

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: `Release your claim on issue ${issueId}?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.writeln();
    output.printInfo(`Releasing claim on issue ${output.highlight(issueId)}...`);

    try {
      await callMCPTool<void>('claims/release', {
        issueId,
        reason: reason || 'Released by user via CLI'
      });

      output.writeln();
      output.printSuccess(`Claim on issue ${issueId} released`);

      if (reason) {
        output.printInfo(`Reason: ${reason}`);
      }

      return { success: true };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to release claim: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Handoff Subcommand
// ============================================

export const handoffCommand: Command = {
  name: 'handoff',
  description: 'Request handoff of an issue to another agent or human',
  options: [
    {
      name: 'to',
      short: 't',
      description: 'Target for handoff (agent:id or human:id)',
      type: 'string',
      required: true
    },
    {
      name: 'reason',
      short: 'r',
      description: 'Reason for handoff',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];
    let target = ctx.flags.to as string;
    const reason = ctx.flags.reason as string | undefined;

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues handoff <issueId> --to <target>');
      return { success: false, exitCode: 1 };
    }

    if (!target && ctx.interactive) {
      target = await input({
        message: 'Handoff to (agent:id or human:id):',
        validate: (v) => {
          try {
            parseTarget(v);
            return true;
          } catch {
            return 'Invalid format. Use agent:<id> or human:<id>';
          }
        }
      });
    }

    if (!target) {
      output.printError('Target is required. Use --to flag (e.g., --to agent:coder-1)');
      return { success: false, exitCode: 1 };
    }

    const parsedTarget = parseTarget(target);

    output.writeln();
    output.printInfo(`Requesting handoff of ${output.highlight(issueId)} to ${output.highlight(target)}...`);

    try {
      const result = await callMCPTool<HandoffRequest>('claims/handoff', {
        issueId,
        targetId: parsedTarget.id,
        targetType: parsedTarget.type,
        reason
      });

      output.writeln();
      output.printSuccess(`Handoff requested for issue ${issueId}`);
      output.writeln();

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Issue ID', value: result.issueId },
          { property: 'From', value: result.fromId },
          { property: 'To', value: `${result.toType}:${result.toId}` },
          { property: 'Status', value: output.warning(result.status) },
          { property: 'Requested At', value: new Date(result.requestedAt).toLocaleString() }
        ]
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to request handoff: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Status Subcommand
// ============================================

export const statusCommand: Command = {
  name: 'status',
  description: 'Update or view issue claim status',
  options: [
    {
      name: 'blocked',
      short: 'b',
      description: 'Mark issue as blocked with reason',
      type: 'string'
    },
    {
      name: 'review-requested',
      short: 'r',
      description: 'Request review for the issue',
      type: 'boolean',
      default: false
    },
    {
      name: 'active',
      short: 'a',
      description: 'Mark issue as active (unblock)',
      type: 'boolean',
      default: false
    },
    {
      name: 'progress',
      short: 'p',
      description: 'Update progress percentage (0-100)',
      type: 'number'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const issueId = ctx.args[0];

    if (!issueId) {
      output.printError('Issue ID is required');
      output.printInfo('Usage: claude-flow issues status <issueId> [options]');
      return { success: false, exitCode: 1 };
    }

    const blocked = ctx.flags.blocked as string | undefined;
    const reviewRequested = ctx.flags['review-requested'] as boolean;
    const active = ctx.flags.active as boolean;
    const progress = ctx.flags.progress as number | undefined;

    // If no update flags, show current status
    if (!blocked && !reviewRequested && !active && progress === undefined) {
      try {
        const result = await callMCPTool<Claim>('claims/status', { issueId });

        if (ctx.flags.format === 'json') {
          output.printJson(result);
          return { success: true, data: result };
        }

        output.writeln();
        output.printBox(
          [
            `Claimant:    ${result.claimantId || 'unclaimed'}`,
            `Type:        ${formatClaimantType(result.claimantType)}`,
            `Status:      ${formatClaimStatus(result.status)}`,
            `Progress:    ${formatProgress(result.progress)}`,
            '',
            `Claimed At:  ${result.claimedAt ? new Date(result.claimedAt).toLocaleString() : 'N/A'}`,
            `Expires At:  ${result.expiresAt ? new Date(result.expiresAt).toLocaleString() : 'N/A'}`,
            '',
            result.blockedReason ? `Blocked:     ${result.blockedReason}` : '',
            result.stealableReason ? `Stealable:   ${result.stealableReason}` : ''
          ].filter(Boolean).join('\n'),
          `Issue: ${issueId}`
        );

        return { success: true, data: result };
      } catch (error) {
        if (error instanceof MCPClientError) {
          output.printError(`Failed to get status: ${error.message}`);
        } else {
          output.printError(`Unexpected error: ${String(error)}`);
        }
        return { success: false, exitCode: 1 };
      }
    }

    // Update status
    let newStatus: ClaimStatus | undefined;
    let reason: string | undefined;

    if (blocked) {
      newStatus = 'blocked';
      reason = blocked;
    } else if (reviewRequested) {
      newStatus = 'review-requested';
    } else if (active) {
      newStatus = 'active';
    }

    output.writeln();
    output.printInfo(`Updating issue ${output.highlight(issueId)}...`);

    try {
      const result = await callMCPTool<Claim>('claims/update', {
        issueId,
        status: newStatus,
        reason,
        progress
      });

      output.writeln();
      output.printSuccess(`Issue ${issueId} updated`);
      output.writeln();

      const updates: Array<{ property: string; value: string }> = [];

      if (newStatus) {
        updates.push({ property: 'Status', value: formatClaimStatus(result.status) });
      }

      if (reason) {
        updates.push({ property: 'Reason', value: reason });
      }

      if (progress !== undefined) {
        updates.push({ property: 'Progress', value: formatProgress(result.progress) });
      }

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: updates
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to update status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// ============================================
// Board Subcommand
// ============================================

export const boardCommand: Command = {
  name: 'board',
  description: 'View who is working on what',
  options: [
    {
      name: 'all',
      short: 'a',
      description: 'Show all issues including completed',
      type: 'boolean',
      default: false
    },
    {
      name: 'group',
      short: 'g',
      description: 'Group by claimant type',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const showAll = ctx.flags.all as boolean;
    const groupBy = ctx.flags.group as boolean;

    try {
      const result = await callMCPTool<{
        claims: Claim[];
        stats: {
          totalClaimed: number;
          totalAvailable: number;
          agentClaims: number;
          humanClaims: number;
        };
      }>('claims/board', {
        includeCompleted: showAll
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Issue Claims Board'));
      output.writeln();

      // Stats summary
      output.printList([
        `Total Claimed: ${output.highlight(String(result.stats.totalClaimed))}`,
        `Available: ${output.success(String(result.stats.totalAvailable))}`,
        `By Agents: ${output.info(String(result.stats.agentClaims))}`,
        `By Humans: ${output.highlight(String(result.stats.humanClaims))}`
      ]);

      output.writeln();

      if (result.claims.length === 0) {
        output.printInfo('No active claims');
        return { success: true, data: result };
      }

      if (groupBy) {
        // Group by claimant type
        const agents = result.claims.filter(c => c.claimantType === 'agent');
        const humans = result.claims.filter(c => c.claimantType === 'human');

        if (agents.length > 0) {
          output.writeln(output.bold('Agent Claims'));
          printBoardTable(agents);
          output.writeln();
        }

        if (humans.length > 0) {
          output.writeln(output.bold('Human Claims'));
          printBoardTable(humans);
          output.writeln();
        }
      } else {
        printBoardTable(result.claims);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to load board: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

function printBoardTable(claims: Claim[]): void {
  output.printTable({
    columns: [
      { key: 'issue', header: 'Issue', width: 12 },
      { key: 'claimant', header: 'Claimant', width: 15 },
      { key: 'type', header: 'Type', width: 8 },
      { key: 'status', header: 'Status', width: 16 },
      { key: 'progress', header: 'Progress', width: 10 },
      { key: 'time', header: 'Time', width: 12 }
    ],
    data: claims.map(c => ({
      issue: c.issueId,
      claimant: c.claimantId,
      type: formatClaimantType(c.claimantType),
      status: formatClaimStatus(c.status),
      progress: formatProgress(c.progress),
      time: formatTimeRemaining(c.expiresAt)
    }))
  });
}

// ============================================

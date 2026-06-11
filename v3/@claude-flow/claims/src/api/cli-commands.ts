/**
 * V3 CLI Claims Command
 * Issue claiming and work distribution management
 *
 * Implements:
 * - Core claiming commands (list, claim, release, handoff, status)
 * - Work stealing commands (stealable, steal, mark-stealable, contest)
 * - Load balancing commands (load, rebalance)
 */

import type { Command, CommandContext, CommandResult } from './cli-types.js';
import { output } from './cli-types.js';
// Domain types moved to ./cli-commands-types.ts (W141, P3.23 cut #1).
import type {
  ClaimServices,
  ClaimantType,
  ClaimStatus,
  Claim,
  ClaimFilter,
  HandoffRequest,
  ContestResult,
  AgentLoad,
  RebalanceResult,
} from './cli-commands-types.js';
// Re-exported so external callers importing these types from
// './cli-commands.js' keep resolving byte-identically.
export type {
  ClaimServices,
  ClaimantType,
  ClaimStatus,
  Claim,
  ClaimFilter,
  HandoffRequest,
  ContestResult,
  AgentLoad,
  RebalanceResult,
} from './cli-commands-types.js';

// ============================================
// Types
// ============================================

// ============================================

// The formatters and the ten subcommands were extracted into
// ./cli-commands-formatters.ts, ./cli-commands-core.ts, and
// ./cli-commands-stealing.ts during the P3.77 god-file decomposition
// (W200) — unblocked by the cli-types output signature fix. All were
// module-private; only issuesCommand + createIssuesCommand (and the
// W141 type re-exports above) form the public surface.
import {
  boardCommand,
  claimCommand,
  handoffCommand,
  listCommand,
  releaseCommand,
  statusCommand,
} from './cli-commands-core.js';
import {
  contestCommand,
  loadCommand,
  markStealableCommand,
  rebalanceCommand,
  stealCommand,
  stealableCommand,
} from './cli-commands-stealing.js';

// Main Issues Command
// ============================================

export const issuesCommand: Command = {
  name: 'issues',
  description: 'Manage issue claims and work distribution',
  subcommands: [
    // Core claiming
    listCommand,
    claimCommand,
    releaseCommand,
    handoffCommand,
    statusCommand,
    boardCommand,
    // Work stealing
    stealableCommand,
    stealCommand,
    markStealableCommand,
    contestCommand,
    // Load balancing
    loadCommand,
    rebalanceCommand
  ],
  options: [],
  examples: [
    { command: 'claude-flow issues list --available', description: 'List unclaimed issues' },
    { command: 'claude-flow issues list --mine', description: 'List my claims' },
    { command: 'claude-flow issues claim GH-123', description: 'Claim an issue' },
    { command: 'claude-flow issues release GH-123', description: 'Release a claim' },
    { command: 'claude-flow issues handoff GH-123 --to agent:coder-1', description: 'Request handoff to agent' },
    { command: 'claude-flow issues handoff GH-123 --to human:alice', description: 'Request handoff to human' },
    { command: 'claude-flow issues status GH-123 --blocked "Waiting for API"', description: 'Mark as blocked' },
    { command: 'claude-flow issues status GH-123 --review-requested', description: 'Request review' },
    { command: 'claude-flow issues board', description: 'View who is working on what' },
    { command: 'claude-flow issues stealable', description: 'List stealable issues' },
    { command: 'claude-flow issues steal GH-123', description: 'Steal an issue' },
    { command: 'claude-flow issues mark-stealable GH-123', description: 'Mark my claim as stealable' },
    { command: 'claude-flow issues contest GH-123 -r "I was actively working on it"', description: 'Contest a steal' },
    { command: 'claude-flow issues load', description: 'View agent load distribution' },
    { command: 'claude-flow issues load --agent coder-1', description: 'View specific agent load' },
    { command: 'claude-flow issues rebalance --dry-run', description: 'Preview rebalancing' },
    { command: 'claude-flow issues rebalance', description: 'Trigger swarm rebalancing' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Show help if no subcommand
    output.writeln();
    output.writeln(output.bold('Issue Claims Management'));
    output.writeln();
    output.writeln('Usage: claude-flow issues <subcommand> [options]');
    output.writeln();

    output.writeln(output.bold('Core Commands'));
    output.printList([
      `${output.highlight('list')}           - List issues (--available, --mine)`,
      `${output.highlight('claim')}          - Claim an issue to work on`,
      `${output.highlight('release')}        - Release a claim on an issue`,
      `${output.highlight('handoff')}        - Request handoff to another agent/human`,
      `${output.highlight('status')}         - Update or view issue claim status`,
      `${output.highlight('board')}          - View who is working on what`
    ]);

    output.writeln();
    output.writeln(output.bold('Work Stealing Commands'));
    output.printList([
      `${output.highlight('stealable')}      - List stealable issues`,
      `${output.highlight('steal')}          - Steal an issue from another agent`,
      `${output.highlight('mark-stealable')} - Mark my claim as stealable`,
      `${output.highlight('contest')}        - Contest a steal action`
    ]);

    output.writeln();
    output.writeln(output.bold('Load Balancing Commands'));
    output.printList([
      `${output.highlight('load')}           - View agent load distribution`,
      `${output.highlight('rebalance')}      - Trigger swarm rebalancing`
    ]);

    output.writeln();
    output.writeln('Run "claude-flow issues <subcommand> --help" for subcommand help');

    return { success: true };
  }
};

// ============================================
// Factory Function (for dependency injection)
// ============================================

/**
 * Create issues command with injected services
 * This allows for testing with mock services
 */
export function createIssuesCommand(services: ClaimServices): Command {
  // The command structure remains the same, but actions would use
  // the injected services instead of callMCPTool
  // For now, we return the default command which uses MCP tools
  return issuesCommand;
}

export default issuesCommand;

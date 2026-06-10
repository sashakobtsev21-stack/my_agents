/**
 * V3 CLI Agent Command
 * Agent management commands for spawning, listing, and controlling agents
 */

// This file is now a thin registrar: it assembles agentCommand from the
// subcommands + helpers extracted into the ./agent/ directory during the
// P3.20 god-file decomposition (W135-W136). Sub-modules:
//   helpers · subcommands-core · subcommands-ops
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { wasmSubcommands } from './agent-wasm.js';
import { spawnCommand, listCommand, statusCommand, stopCommand } from './agent/subcommands-core.js';
import { metricsCommand, poolCommand, healthCommand, logsCommand } from './agent/subcommands-ops.js';

export const agentCommand: Command = {
  name: 'agent',
  description: 'Agent management commands',
  subcommands: [spawnCommand, listCommand, statusCommand, stopCommand, metricsCommand, poolCommand, healthCommand, logsCommand, ...wasmSubcommands],
  options: [],
  examples: [
    { command: 'claude-flow agent spawn -t coder', description: 'Spawn a coder agent' },
    { command: 'claude-flow agent list', description: 'List all agents' },
    { command: 'claude-flow agent status agent-001', description: 'Show agent status' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // Show help if no subcommand
    output.writeln();
    output.writeln(output.bold('Agent Management Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow agent <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('spawn')}         - Spawn a new agent`,
      `${output.highlight('list')}          - List all active agents`,
      `${output.highlight('status')}        - Show detailed agent status`,
      `${output.highlight('stop')}          - Stop a running agent`,
      `${output.highlight('metrics')}       - Show agent metrics`,
      `${output.highlight('pool')}          - Manage agent pool`,
      `${output.highlight('health')}        - Show agent health`,
      `${output.highlight('logs')}          - Show agent logs`,
      `${output.highlight('wasm-status')}   - Check WASM runtime availability`,
      `${output.highlight('wasm-create')}   - Create a WASM-sandboxed agent`,
      `${output.highlight('wasm-prompt')}   - Send a prompt to a WASM agent`,
      `${output.highlight('wasm-gallery')}  - List WASM agent gallery templates`,
    ]);
    output.writeln();
    output.writeln('Run "claude-flow agent <subcommand> --help" for subcommand help');

    return { success: true };
  }
};


export default agentCommand;

/**
 * V3 CLI Swarm Command
 * Swarm coordination and management commands
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/helpers extracted into ./swarm-helpers.ts,
// ./swarm-lifecycle.ts, ./swarm-ops.ts during campaign-2 wave 15 (W221).
import { initCommand, startCommand, statusCommand } from './swarm-lifecycle.js';
import { coordinateCommand, scaleCommand, stopCommand } from './swarm-ops.js';

export const swarmCommand: Command = {
  name: 'swarm',
  description: 'Swarm coordination commands',
  subcommands: [initCommand, startCommand, statusCommand, stopCommand, scaleCommand, coordinateCommand],
  options: [],
  examples: [
    { command: 'claude-flow swarm init --v3-mode', description: 'Initialize V3 swarm' },
    { command: 'claude-flow swarm start -o "Build API" -s development', description: 'Start development swarm' },
    { command: 'claude-flow swarm coordinate --agents 15', description: 'V3 coordination' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Swarm Coordination Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow swarm <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('init')}        - Initialize a new swarm`,
      `${output.highlight('start')}       - Start swarm execution`,
      `${output.highlight('status')}      - Show swarm status`,
      `${output.highlight('stop')}        - Stop swarm execution`,
      `${output.highlight('scale')}       - Scale swarm agent count`,
      `${output.highlight('coordinate')}  - V3 15-agent coordination`
    ]);

    return { success: true };
  }
};

// Helper function

export default swarmCommand;

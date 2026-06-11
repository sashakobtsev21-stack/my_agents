/**
 * V3 CLI Process Management Command
 * Background process management, daemon mode, and monitoring
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
// Subcommands/PID helpers extracted into ./process-pid.ts,
// ./process-daemon.ts, ./process-workers.ts during campaign-2 wave 73
// (W279).
import { daemonCommand, monitorCommand } from './process-daemon.js';
import { logsCommand, signalsCommand, workersCommand } from './process-workers.js';

export const processCommand: Command = {
  name: 'process',
  description: 'Background process management, daemon, and monitoring',
  aliases: ['proc', 'ps'],
  subcommands: [daemonCommand, monitorCommand, workersCommand, signalsCommand, logsCommand],
  options: [
    {
      name: 'help',
      short: 'h',
      type: 'boolean',
      description: 'Show help for process command',
    },
  ],
  examples: [
    { command: 'claude-flow process daemon --action start', description: 'Start daemon' },
    { command: 'claude-flow process monitor --watch', description: 'Watch processes' },
    { command: 'claude-flow process workers --action list', description: 'List workers' },
    { command: 'claude-flow process logs --follow', description: 'Follow logs' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // Show help if no subcommand
    console.log('\n🔧 Process Management\n');
    console.log('Manage background processes, daemons, and workers.\n');
    console.log('Subcommands:');
    console.log('  daemon     - Manage background daemon process');
    console.log('  monitor    - Real-time process monitoring');
    console.log('  workers    - Manage background workers');
    console.log('  signals    - Send signals to processes');
    console.log('  logs       - View and manage process logs');
    console.log('\nExamples:');
    console.log('  claude-flow process daemon --action start');
    console.log('  claude-flow process monitor --watch');
    console.log('  claude-flow process workers --action spawn --type task --count 3');
    console.log('  claude-flow process logs --follow --level error');

    return { success: true, data: { help: true } };
  },
};

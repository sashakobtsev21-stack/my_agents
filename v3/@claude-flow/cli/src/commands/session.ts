/**
 * V3 CLI Session Command
 * Session management for Claude Flow
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/helpers extracted into ./session-format.ts,
// ./session-state.ts, ./session-transfer.ts during campaign-2 wave 27
// (W233). The public sessionCommand aggregate stays here.
import {
  deleteCommand,
  listCommand,
  restoreCommand,
  saveCommand,
} from './session-state.js';
import {
  currentCommand,
  exportCommand,
  importCommand,
} from './session-transfer.js';

export const sessionCommand: Command = {
  name: 'session',
  description: 'Session management commands',
  subcommands: [
    listCommand,
    saveCommand,
    restoreCommand,
    deleteCommand,
    exportCommand,
    importCommand,
    currentCommand
  ],
  options: [],
  examples: [
    { command: 'claude-flow session list', description: 'List all sessions' },
    { command: 'claude-flow session save -n "checkpoint-1"', description: 'Save current session' },
    { command: 'claude-flow session restore session-123', description: 'Restore a session' },
    { command: 'claude-flow session delete session-123', description: 'Delete a session' },
    { command: 'claude-flow session export -o backup.json', description: 'Export session to file' },
    { command: 'claude-flow session import backup.json', description: 'Import session from file' },
    { command: 'claude-flow session current', description: 'Show current session' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // Show help if no subcommand
    output.writeln();
    output.writeln(output.bold('Session Management Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow session <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('list')}    - List all sessions`,
      `${output.highlight('save')}    - Save current session state`,
      `${output.highlight('restore')} - Restore a saved session`,
      `${output.highlight('delete')}  - Delete a saved session`,
      `${output.highlight('export')}  - Export session to file`,
      `${output.highlight('import')}  - Import session from file`,
      `${output.highlight('current')} - Show current active session`
    ]);
    output.writeln();
    output.writeln('Run "claude-flow session <subcommand> --help" for subcommand help');

    return { success: true };
  }
};

export default sessionCommand;

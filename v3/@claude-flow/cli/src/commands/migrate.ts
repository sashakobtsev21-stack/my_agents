/**
 * V3 CLI Migrate Command
 * Migration tools for V2 to V3 transition
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/helpers extracted into ./migrate-helpers.ts,
// ./migrate-run.ts, ./migrate-rollback.ts during campaign-2 wave 66
// (W272).
import { runCommand, statusCommand, verifyCommand } from './migrate-run.js';
import { breakingCommand, rollbackCommand } from './migrate-rollback.js';

export const migrateCommand: Command = {
  name: 'migrate',
  description: 'V2 to V3 migration tools',
  subcommands: [statusCommand, runCommand, verifyCommand, rollbackCommand, breakingCommand],
  options: [],
  examples: [
    { command: 'claude-flow migrate status', description: 'Check migration status' },
    { command: 'claude-flow migrate run --dry-run', description: 'Preview migration' },
    { command: 'claude-flow migrate run -t all', description: 'Run full migration' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('V2 to V3 Migration Tools'));
    output.writeln();
    output.writeln('Usage: claude-flow migrate <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('status')}    - Check migration status`,
      `${output.highlight('run')}       - Run migration`,
      `${output.highlight('verify')}    - Verify migration integrity`,
      `${output.highlight('rollback')}  - Rollback to previous version`,
      `${output.highlight('breaking')}  - Show breaking changes`
    ]);

    return { success: true };
  }
};

// Helper functions

export default migrateCommand;

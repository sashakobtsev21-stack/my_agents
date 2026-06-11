/**
 * V3 CLI RuVector Backup Command
 * Backup and restore for RuVector PostgreSQL data
 */


import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
// Subcommands/helpers extracted into ./backup-helpers.ts,
// ./backup-run.ts, ./backup-restore.ts during campaign-2 wave 53
// (W259).
import { backupSubcommand } from './backup-run.js';
import { restoreSubcommand } from './backup-restore.js';

export const backupCommand: Command = {
  name: 'backup',
  description: 'Backup and restore RuVector data',
  subcommands: [backupSubcommand, restoreSubcommand],
  options: [
    {
      name: 'host',
      short: 'h',
      description: 'PostgreSQL host',
      type: 'string',
      default: 'localhost',
    },
    {
      name: 'port',
      short: 'p',
      description: 'PostgreSQL port',
      type: 'number',
      default: 5432,
    },
    {
      name: 'database',
      short: 'd',
      description: 'Database name',
      type: 'string',
    },
    {
      name: 'user',
      short: 'u',
      description: 'Database user',
      type: 'string',
    },
    {
      name: 'password',
      description: 'Database password',
      type: 'string',
    },
    {
      name: 'ssl',
      description: 'Enable SSL',
      type: 'boolean',
      default: false,
    },
    {
      name: 'schema',
      short: 's',
      description: 'Schema name',
      type: 'string',
      default: 'claude_flow',
    },
  ],
  examples: [
    { command: 'claude-flow ruvector backup create -o backup.sql', description: 'Create backup' },
    { command: 'claude-flow ruvector backup restore -i backup.sql', description: 'Restore backup' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('RuVector Backup'));
    output.writeln(output.dim('=' .repeat(60)));
    output.writeln();

    output.printBox([
      'RuVector Backup provides data backup and restore capabilities:',
      '',
      '  create   Create a backup of RuVector data',
      '  restore  Restore RuVector data from backup',
      '',
      'Supported formats:',
      '  SQL   - PostgreSQL-compatible SQL statements',
      '  JSON  - Portable JSON format with metadata',
      '  CSV   - Comma-separated values',
      '',
      'Features:',
      '  - Selective table backup',
      '  - Gzip compression',
      '  - Index preservation',
      '  - Incremental restore',
    ].join('\n'), 'Backup Commands');

    output.writeln();
    output.printInfo('Run `claude-flow ruvector backup <command> --help` for details');

    return { success: true };
  },
};

export default backupCommand;

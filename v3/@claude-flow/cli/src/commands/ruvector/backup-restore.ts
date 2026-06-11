/**
 * RuVector Backup — restore subcommand
 *
 * Extracted verbatim from backup.ts (lines 396-718) during campaign-2
 * wave 53 (W259). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { confirm } from '../../prompt.js';
import { formatBytes, getConnectionConfig } from './backup-helpers.js';

export const restoreSubcommand: Command = {
  name: 'restore',
  description: 'Restore RuVector data from backup',
  options: [
    {
      name: 'input',
      short: 'i',
      description: 'Input file path',
      type: 'string',
      required: true,
    },
    {
      name: 'clean',
      description: 'Drop existing tables first',
      type: 'boolean',
      default: false,
    },
    {
      name: 'dry-run',
      description: 'Show what would be restored without executing',
      type: 'boolean',
      default: false,
    },
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
    { command: 'claude-flow ruvector backup restore -i backup.sql', description: 'Restore from SQL backup' },
    { command: 'claude-flow ruvector backup restore -i backup.json --clean', description: 'Clean restore' },
    { command: 'claude-flow ruvector backup restore -i backup.sql --dry-run', description: 'Preview restore' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const config = getConnectionConfig(ctx);
    const inputPath = ctx.flags.input as string;
    const clean = ctx.flags.clean as boolean;
    const dryRun = ctx.flags['dry-run'] as boolean;

    output.writeln();
    output.writeln(output.bold('RuVector Restore'));
    output.writeln(output.dim('=' .repeat(60)));
    output.writeln();

    if (!config.database) {
      output.printError('Database name is required. Use --database or -d flag, or set PGDATABASE env.');
      return { success: false, exitCode: 1 };
    }

    if (!inputPath) {
      output.printError('Input path is required. Use --input or -i flag.');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Reading backup file...', spinner: 'dots' });
    spinner.start();

    try {
      const fs = await import('fs');
      const { promisify } = await import('util');

      // Check file exists
      if (!fs.existsSync(inputPath)) {
        spinner.fail('Backup file not found');
        output.printError(`File not found: ${inputPath}`);
        return { success: false, exitCode: 1 };
      }

      // Read file
      let content: string;
      if (inputPath.endsWith('.gz')) {
        const zlib = await import('zlib');
        const gunzip = promisify(zlib.gunzip);
        const compressed = fs.readFileSync(inputPath);
        const decompressed = await gunzip(compressed);
        content = decompressed.toString('utf-8');
      } else {
        content = fs.readFileSync(inputPath, 'utf-8');
      }

      const fileSize = fs.statSync(inputPath).size;
      spinner.succeed(`Read backup file (${formatBytes(fileSize)})`);

      // Determine format
      const isJson = content.trim().startsWith('{');
      const format = isJson ? 'json' : 'sql';

      if (dryRun) {
        output.printInfo('Dry run mode: showing what would be restored');
        output.writeln();

        if (isJson) {
          const data = JSON.parse(content);
          output.writeln(output.highlight('Backup metadata:'));
          output.printTable({
            columns: [
              { key: 'property', header: 'Property', width: 20 },
              { key: 'value', header: 'Value', width: 40 },
            ],
            data: [
              { property: 'Backup Date', value: data.metadata?.backupDate || 'Unknown' },
              { property: 'Database', value: data.metadata?.database || 'Unknown' },
              { property: 'Schema', value: data.schema || 'Unknown' },
              { property: 'Tables', value: String(data.tables?.length || 0) },
              { property: 'Total Rows', value: String(data.tables?.reduce((sum: number, t: { rows: unknown[] }) => sum + t.rows.length, 0) || 0) },
              { property: 'Indexes', value: String(data.indexes?.length || 0) },
            ],
          });
        } else {
          // Count SQL statements
          const insertCount = (content.match(/INSERT INTO/gi) || []).length;
          const createCount = (content.match(/CREATE (TABLE|INDEX)/gi) || []).length;
          output.writeln(`SQL statements: ${insertCount} inserts, ${createCount} creates`);
        }

        return { success: true, data: { dryRun: true } };
      }

      // Confirm clean operation
      if (clean && ctx.interactive) {
        const confirmClean = await confirm({
          message: 'This will drop existing tables. Continue?',
          default: false,
        });
        if (!confirmClean) {
          output.printInfo('Restore cancelled');
          return { success: false, exitCode: 0 };
        }
      }

      // Connect and restore
      let pg: typeof import('pg') | null = null;
      try {
        pg = await import('pg');
      } catch {
        spinner.fail('PostgreSQL driver not found');
        output.printError('Install pg package: npm install pg');
        return { success: false, exitCode: 1 };
      }

      const client = new pg.Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
      });

      await client.connect();
      spinner.succeed('Connected to PostgreSQL');

      // Clean if requested
      if (clean) {
        spinner.setText(`Dropping schema "${config.schema}"...`); spinner.start();
        await client.query(`DROP SCHEMA IF EXISTS ${config.schema} CASCADE`);
        await client.query(`CREATE SCHEMA ${config.schema}`);
        spinner.succeed('Schema cleaned');
      }

      // Restore
      let restoredRows = 0;
      let restoredTables = 0;
      let restoredIndexes = 0;

      if (isJson) {
        // Restore from JSON
        const data = JSON.parse(content);

        for (const table of data.tables || []) {
          spinner.setText(`Restoring ${table.name}...`); spinner.start();

          // Create table if needed (assuming schema matches)
          for (const row of table.rows) {
            const columns = Object.keys(row);
            const values = columns.map((_col, idx) => `$${idx + 1}`);
            const params = columns.map(col => {
              const val = row[col];
              return typeof val === 'object' ? JSON.stringify(val) : val;
            });

            try {
              await client.query(`
                INSERT INTO ${config.schema}.${table.name} (${columns.join(', ')})
                VALUES (${values.join(', ')})
                ON CONFLICT DO NOTHING
              `, params);
              restoredRows++;
            } catch {
              // Skip conflicts
            }
          }

          restoredTables++;
          spinner.setText(`Restoring ${table.name}... (${table.rows.length} rows)`);
        }

        spinner.succeed(`Restored ${restoredTables} tables, ${restoredRows} rows`);

        // Restore indexes
        if (data.indexes && data.indexes.length > 0) {
          spinner.setText('Restoring indexes...'); spinner.start();
          for (const indexDef of data.indexes) {
            try {
              await client.query(indexDef);
              restoredIndexes++;
            } catch {
              // Index may already exist
            }
          }
          spinner.succeed(`Restored ${restoredIndexes} indexes`);
        }
      } else {
        // Restore from SQL
        spinner.setText('Executing SQL restore...'); spinner.start();

        // Split by semicolons and execute
        const statements = content
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        let executed = 0;
        for (const stmt of statements) {
          try {
            await client.query(stmt);
            executed++;

            if (stmt.toUpperCase().includes('INSERT INTO')) {
              restoredRows++;
            } else if (stmt.toUpperCase().includes('CREATE INDEX')) {
              restoredIndexes++;
            }
          } catch (error) {
            // Log but continue
            if (process.env.DEBUG) {
              console.error('Statement failed:', stmt.substring(0, 100));
            }
          }

          if (executed % 100 === 0) {
            spinner.setText(`Executing SQL restore... ${executed}/${statements.length}`);
          }
        }

        spinner.succeed(`Executed ${executed} SQL statements`);
      }

      await client.end();

      output.writeln();
      output.printSuccess('Restore completed successfully!');
      output.writeln();

      output.printBox([
        `Source: ${inputPath}`,
        `Format: ${format.toUpperCase()}`,
        `Tables Restored: ${restoredTables}`,
        `Rows Restored: ${restoredRows.toLocaleString()}`,
        `Indexes Restored: ${restoredIndexes}`,
      ].join('\n'), 'Restore Summary');

      return {
        success: true,
        data: {
          inputPath,
          format,
          restoredTables,
          restoredRows,
          restoredIndexes,
        },
      };
    } catch (error) {
      spinner.fail('Restore failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * RuVector backup main command
 */

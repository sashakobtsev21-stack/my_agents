/**
 * RuVector Backup — backup subcommand
 *
 * Extracted verbatim from backup.ts (lines 40-395) during campaign-2
 * wave 53 (W259). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { input } from '../../prompt.js';
import { formatBytes, getConnectionConfig } from './backup-helpers.js';

export const backupSubcommand: Command = {
  name: 'create',
  description: 'Create a backup of RuVector data',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
      required: true,
    },
    {
      name: 'tables',
      short: 't',
      description: 'Specific tables (comma-separated)',
      type: 'string',
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format',
      type: 'string',
      default: 'sql',
      choices: ['sql', 'json', 'csv'],
    },
    {
      name: 'compress',
      short: 'c',
      description: 'Compress output (gzip)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'include-indexes',
      description: 'Include index definitions',
      type: 'boolean',
      default: true,
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
    { command: 'claude-flow ruvector backup create -o backup.sql', description: 'Create SQL backup' },
    { command: 'claude-flow ruvector backup create -o backup.json --format json', description: 'Create JSON backup' },
    { command: 'claude-flow ruvector backup create -o backup.sql.gz --compress', description: 'Compressed backup' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const config = getConnectionConfig(ctx);
    let outputPath = ctx.flags.output as string;
    const tablesFilter = ctx.flags.tables as string;
    const format = (ctx.flags.format as string) || 'sql';
    const compress = ctx.flags.compress as boolean;
    const includeIndexes = ctx.flags['include-indexes'] !== false;

    output.writeln();
    output.writeln(output.bold('RuVector Backup'));
    output.writeln(output.dim('=' .repeat(60)));
    output.writeln();

    if (!config.database) {
      output.printError('Database name is required. Use --database or -d flag, or set PGDATABASE env.');
      return { success: false, exitCode: 1 };
    }

    // Interactive mode
    if (!outputPath && ctx.interactive) {
      outputPath = await input({
        message: 'Output file path:',
        default: `ruvector_backup_${new Date().toISOString().split('T')[0]}.${format}`,
        validate: (v) => v.length > 0 || 'Output path is required',
      });
    }

    if (!outputPath) {
      output.printError('Output path is required. Use --output or -o flag.');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Connecting to PostgreSQL...', spinner: 'dots' });
    spinner.start();

    try {
      // Import dependencies
      const fs = await import('fs');
      const { promisify } = await import('util');

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

      // Get tables to backup
      spinner.setText('Discovering tables...'); spinner.start();

      let tables: string[] = [];
      if (tablesFilter) {
        tables = tablesFilter.split(',').map(t => t.trim());
      } else {
        const tablesResult = await client.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = $1 AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `, [config.schema]);
        tables = tablesResult.rows.map((r: { table_name: string }) => r.table_name);
      }

      spinner.succeed(`Found ${tables.length} tables to backup`);

      // Prepare backup data
      const backupData: {
        metadata: Record<string, unknown>;
        schema: string;
        tables: { name: string; columns: string[]; rows: unknown[] }[];
        indexes: string[];
      } = {
        metadata: {
          backupDate: new Date().toISOString(),
          database: config.database,
          schema: config.schema,
          format,
          version: '1.0.0',
        },
        schema: config.schema,
        tables: [],
        indexes: [],
      };

      let totalRows = 0;

      // Export each table
      for (const tableName of tables) {
        spinner.setText(`Exporting ${tableName}...`); spinner.start();

        // Get columns
        const columnsResult = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [config.schema, tableName]);

        const columns = columnsResult.rows.map((r: { column_name: string }) => r.column_name);

        // Get data
        const dataResult = await client.query(`
          SELECT * FROM ${config.schema}.${tableName}
        `);

        backupData.tables.push({
          name: tableName,
          columns,
          rows: dataResult.rows,
        });

        totalRows += dataResult.rows.length;
        spinner.setText(`Exporting ${tableName}... (${dataResult.rows.length} rows)`);
      }

      spinner.succeed(`Exported ${totalRows.toLocaleString()} rows from ${tables.length} tables`);

      // Get indexes
      if (includeIndexes) {
        spinner.setText('Exporting index definitions...'); spinner.start();

        const indexResult = await client.query(`
          SELECT pg_get_indexdef(i.oid) as indexdef
          FROM pg_index idx
          JOIN pg_class i ON i.oid = idx.indexrelid
          JOIN pg_class t ON t.oid = idx.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = $1
            AND NOT idx.indisprimary
        `, [config.schema]);

        backupData.indexes = indexResult.rows.map((r: { indexdef: string }) => r.indexdef);
        spinner.succeed(`Exported ${backupData.indexes.length} index definitions`);
      }

      await client.end();

      // Write backup file
      spinner.setText(`Writing backup to ${outputPath}...`); spinner.start();

      let content: string;

      if (format === 'sql') {
        // Generate SQL format
        const lines: string[] = [];
        lines.push(`-- RuVector Backup`);
        lines.push(`-- Generated: ${backupData.metadata.backupDate}`);
        lines.push(`-- Database: ${config.database}`);
        lines.push(`-- Schema: ${config.schema}`);
        lines.push('');
        lines.push(`CREATE SCHEMA IF NOT EXISTS ${config.schema};`);
        lines.push('');

        for (const table of backupData.tables) {
          lines.push(`-- Table: ${table.name}`);
          lines.push(`-- Rows: ${table.rows.length}`);
          lines.push('');

          if (table.rows.length > 0) {
            for (const row of table.rows) {
              const values = table.columns.map(col => {
                const val = (row as Record<string, unknown>)[col];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return String(val);
              });

              lines.push(`INSERT INTO ${config.schema}.${table.name} (${table.columns.join(', ')}) VALUES (${values.join(', ')});`);
            }
            lines.push('');
          }
        }

        // Add indexes
        if (includeIndexes && backupData.indexes.length > 0) {
          lines.push('-- Indexes');
          for (const idx of backupData.indexes) {
            lines.push(`${idx};`);
          }
        }

        content = lines.join('\n');
      } else if (format === 'json') {
        content = JSON.stringify(backupData, null, 2);
      } else {
        // CSV format - one file per table would be better, but we'll concatenate
        const lines: string[] = [];
        for (const table of backupData.tables) {
          lines.push(`# Table: ${table.name}`);
          lines.push(table.columns.join(','));
          for (const row of table.rows) {
            const values = table.columns.map(col => {
              const val = (row as Record<string, unknown>)[col];
              if (val === null || val === undefined) return '';
              const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            });
            lines.push(values.join(','));
          }
          lines.push('');
        }
        content = lines.join('\n');
      }

      // Compress if requested
      if (compress) {
        const zlib = await import('zlib');
        const gzip = promisify(zlib.gzip);
        const compressed = await gzip(Buffer.from(content, 'utf-8'));
        outputPath = outputPath.endsWith('.gz') ? outputPath : `${outputPath}.gz`;
        fs.writeFileSync(outputPath, compressed);
      } else {
        fs.writeFileSync(outputPath, content, 'utf-8');
      }

      const fileSize = fs.statSync(outputPath).size;
      spinner.succeed(`Backup written to ${outputPath} (${formatBytes(fileSize)})`);

      output.writeln();
      output.printSuccess('Backup completed successfully!');
      output.writeln();

      output.printBox([
        `Output: ${outputPath}`,
        `Format: ${format.toUpperCase()}${compress ? ' (gzip compressed)' : ''}`,
        `Size: ${formatBytes(fileSize)}`,
        `Tables: ${tables.length}`,
        `Total Rows: ${totalRows.toLocaleString()}`,
        `Indexes: ${backupData.indexes.length}`,
      ].join('\n'), 'Backup Summary');

      return {
        success: true,
        data: {
          outputPath,
          format,
          compressed: compress,
          tables: tables.length,
          totalRows,
          indexes: backupData.indexes.length,
          fileSize,
        },
      };
    } catch (error) {
      spinner.fail('Backup failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * RuVector restore subcommand
 */

/**
 * V3 CLI RuVector Setup Command
 * Outputs Docker files and SQL for easy RuVector PostgreSQL setup
 *
 * Usage:
 *   npx claude-flow ruvector setup              # Output to ./ruvector-postgres/
 *   npx claude-flow ruvector setup --output /path/to/dir
 *   npx claude-flow ruvector setup --print      # Print to stdout only
 *
 * Created with care by ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Docker Compose template for RuVector PostgreSQL
 */

// Templates extracted into ./setup-templates.ts during campaign-2
// wave 62 (W268).
import {
  DOCKER_COMPOSE_TEMPLATE,
  INIT_SQL_TEMPLATE,
  README_TEMPLATE,
} from './setup-templates.js';

export const setupCommand: Command = {
  name: 'setup',
  description: 'Output Docker files and SQL for RuVector PostgreSQL setup',
  aliases: ['scaffold', 'docker'],
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output directory (default: ./ruvector-postgres)',
      type: 'string',
      default: './ruvector-postgres',
    },
    {
      name: 'print',
      short: 'p',
      description: 'Print to stdout instead of writing files',
      type: 'boolean',
      default: false,
    },
    {
      name: 'force',
      short: 'f',
      description: 'Overwrite existing files',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'claude-flow ruvector setup', description: 'Output files to ./ruvector-postgres/' },
    { command: 'claude-flow ruvector setup --output /path/to/dir', description: 'Output to custom directory' },
    { command: 'claude-flow ruvector setup --print', description: 'Print files to stdout' },
    { command: 'claude-flow ruvector setup --force', description: 'Overwrite existing files' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const outputDir = (ctx.flags.output as string) || './ruvector-postgres';
    const printOnly = ctx.flags.print as boolean;
    const force = ctx.flags.force as boolean;

    output.writeln();
    output.writeln(output.bold('RuVector PostgreSQL Setup'));
    output.writeln(output.dim('=' .repeat(50)));
    output.writeln();

    if (printOnly) {
      // Print to stdout
      output.writeln(output.bold('=== docker-compose.yml ==='));
      output.writeln();
      output.writeln(DOCKER_COMPOSE_TEMPLATE);
      output.writeln();
      output.writeln(output.bold('=== scripts/init-db.sql ==='));
      output.writeln();
      output.writeln(INIT_SQL_TEMPLATE);
      output.writeln();
      output.writeln(output.bold('=== README.md ==='));
      output.writeln();
      output.writeln(README_TEMPLATE);
      return { success: true };
    }

    // Create directory structure
    const scriptsDir = path.join(outputDir, 'scripts');

    try {
      // Check if directory exists
      if (fs.existsSync(outputDir) && !force) {
        const files = fs.readdirSync(outputDir);
        if (files.length > 0) {
          output.printWarning(`Directory ${outputDir} already exists and is not empty.`);
          output.printInfo('Use --force to overwrite existing files.');
          return { success: false, message: 'Directory not empty' };
        }
      }

      // Create directories
      output.printInfo(`Creating directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.mkdirSync(scriptsDir, { recursive: true });

      // Write files
      const dockerComposePath = path.join(outputDir, 'docker-compose.yml');
      const initSqlPath = path.join(scriptsDir, 'init-db.sql');
      const readmePath = path.join(outputDir, 'README.md');

      output.printInfo(`Writing: ${dockerComposePath}`);
      fs.writeFileSync(dockerComposePath, DOCKER_COMPOSE_TEMPLATE);

      output.printInfo(`Writing: ${initSqlPath}`);
      fs.writeFileSync(initSqlPath, INIT_SQL_TEMPLATE);

      output.printInfo(`Writing: ${readmePath}`);
      fs.writeFileSync(readmePath, README_TEMPLATE);

      output.writeln();
      output.printSuccess('RuVector PostgreSQL setup files created!');
      output.writeln();

      output.printBox([
        'Files created:',
        '',
        `  ${outputDir}/`,
        '  ├── docker-compose.yml',
        '  ├── README.md',
        '  └── scripts/',
        '      └── init-db.sql',
        '',
        'Next steps:',
        '',
        `  cd ${outputDir}`,
        '  docker-compose up -d',
        '  docker exec ruvector-postgres psql -U claude -d claude_flow -c "SELECT ruvector_version();"',
      ].join('\n'), 'Setup Complete');

      output.writeln();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.printError(`Failed to create setup files: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }
  },
};

export default setupCommand;

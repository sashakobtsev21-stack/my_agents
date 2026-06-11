/**
 * Migrate Command — rollback / breaking subcommands
 *
 * Extracted verbatim from migrate.ts (lines 521-715) during campaign-2
 * wave 66 (W272). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import * as fs from 'fs';
import * as path from 'path';

export const rollbackCommand: Command = {
  name: 'rollback',
  description: 'Rollback to previous version',
  options: [
    {
      name: 'backup-id',
      description: 'Backup ID to restore',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Skip confirmation',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const cwd = ctx.cwd || process.cwd();
    const v3Dir = path.join(cwd, '.claude-flow');
    const migrationStatePath = path.join(v3Dir, 'migration-state.json');

    output.writeln();
    output.writeln(output.bold('Migration Rollback'));
    output.writeln();

    // Read migration state
    let migrationState: Record<string, unknown>;
    try {
      if (!fs.existsSync(migrationStatePath)) {
        output.printError('No migration state found.', 'Run "migrate run" first before attempting rollback.');
        return { success: false, exitCode: 1 };
      }
      const raw = fs.readFileSync(migrationStatePath, 'utf-8');
      migrationState = JSON.parse(raw);
    } catch (err) {
      output.printError('Failed to read migration state', String(err));
      return { success: false, exitCode: 1 };
    }

    const backupPath = migrationState.backupPath as string | null;
    if (!backupPath) {
      output.printError('No backup path in migration state.', 'Migration was run with --no-backup. Cannot rollback.');
      return { success: false, exitCode: 1 };
    }

    if (!fs.existsSync(backupPath)) {
      output.printError('Backup directory not found.', `Expected: ${backupPath}`);
      return { success: false, exitCode: 1 };
    }

    const restored: string[] = [];

    try {
      // Restore config
      const backupConfig = path.join(backupPath, 'claude-flow.config.json');
      if (fs.existsSync(backupConfig)) {
        const destConfig = path.join(cwd, 'claude-flow.config.json');
        fs.copyFileSync(backupConfig, destConfig);
        // Remove v3 config
        const v3Config = path.join(v3Dir, 'config.json');
        if (fs.existsSync(v3Config)) {
          fs.unlinkSync(v3Config);
        }
        output.printSuccess('Restored: config');
        restored.push('config');
      }

      // Restore memory
      const backupMemory = path.join(backupPath, 'data', 'memory');
      if (fs.existsSync(backupMemory)) {
        const destMemory = path.join(cwd, 'data', 'memory');
        fs.mkdirSync(destMemory, { recursive: true });
        const files = fs.readdirSync(backupMemory);
        for (const f of files) {
          fs.copyFileSync(path.join(backupMemory, f), path.join(destMemory, f));
        }
        output.printSuccess(`Restored: memory (${files.length} files)`);
        restored.push('memory');
      }

      // Restore sessions
      const backupSessions = path.join(backupPath, 'data', 'sessions');
      if (fs.existsSync(backupSessions)) {
        const destSessions = path.join(cwd, 'data', 'sessions');
        fs.mkdirSync(destSessions, { recursive: true });
        const files = fs.readdirSync(backupSessions);
        for (const f of files) {
          fs.copyFileSync(path.join(backupSessions, f), path.join(destSessions, f));
        }
        // Remove v3 sessions
        const v3Sessions = path.join(v3Dir, 'sessions');
        if (fs.existsSync(v3Sessions)) {
          const v3Files = fs.readdirSync(v3Sessions);
          for (const f of v3Files) {
            fs.unlinkSync(path.join(v3Sessions, f));
          }
          fs.rmdirSync(v3Sessions);
        }
        output.printSuccess(`Restored: sessions (${files.length} files)`);
        restored.push('sessions');
      }

      // Delete migration state
      fs.unlinkSync(migrationStatePath);
      output.writeln();
      output.printSuccess(`Rollback complete. Restored: ${restored.join(', ') || 'nothing to restore'}`);

      return { success: true, data: { restored } };
    } catch (err) {
      output.printError('Rollback failed', String(err));
      return { success: false, exitCode: 1 };
    }
  }
};

// Breaking changes info
export const breakingCommand: Command = {
  name: 'breaking',
  description: 'Show V3 breaking changes',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const changes = [
      {
        category: 'Configuration',
        changes: [
          { change: 'Config file renamed', from: 'claude-flow.json', to: 'claude-flow.config.json' },
          { change: 'Swarm config restructured', from: 'swarm.mode', to: 'swarm.topology' },
          { change: 'Provider config format', from: 'provider: "anthropic"', to: 'providers: [...]' }
        ]
      },
      {
        category: 'Memory',
        changes: [
          { change: 'Backend option changed', from: 'memory: { type }', to: 'memory: { backend }' },
          { change: 'HNSW enabled by default', from: 'Manual opt-in', to: 'Auto-enabled' },
          { change: 'Storage path changed', from: '.claude-flow/memory', to: 'data/memory' }
        ]
      },
      {
        category: 'CLI',
        changes: [
          { change: 'Agent command renamed', from: 'spawn <type>', to: 'agent spawn -t <type>' },
          { change: 'Memory command added', from: 'N/A', to: 'memory <subcommand>' },
          { change: 'Hook command enhanced', from: 'hook <type>', to: 'hooks <subcommand>' }
        ]
      },
      {
        category: 'API',
        changes: [
          { change: 'Removed Deno support', from: 'Deno + Node.js', to: 'Node.js 20+ only' },
          { change: 'Event system changed', from: 'EventEmitter', to: 'Event sourcing' },
          { change: 'Coordination unified', from: 'Multiple coordinators', to: 'SwarmCoordinator' }
        ]
      },
      {
        category: 'Embeddings',
        changes: [
          { change: 'Provider changed', from: 'OpenAI API / TF.js', to: 'ONNX Runtime (local)' },
          { change: 'Geometry support', from: 'Euclidean only', to: 'Hyperbolic (Poincaré ball)' },
          { change: 'Cache system', from: 'Memory-only', to: 'sql.js persistent cache' },
          { change: 'Neural substrate', from: 'None', to: 'RuVector integration' }
        ]
      }
    ];

    if (ctx.flags.format === 'json') {
      output.printJson(changes);
      return { success: true, data: changes };
    }

    output.writeln();
    output.writeln(output.bold('V3 Breaking Changes'));
    output.writeln();

    for (const category of changes) {
      output.writeln(output.highlight(category.category));
      output.printTable({
        columns: [
          { key: 'change', header: 'Change', width: 25 },
          { key: 'from', header: 'V2', width: 25 },
          { key: 'to', header: 'V3', width: 25 }
        ],
        data: category.changes,
        border: false
      });
      output.writeln();
    }

    output.printInfo('Run "claude-flow migrate run" to automatically handle these changes');

    return { success: true, data: changes };
  }
};

// Main migrate command

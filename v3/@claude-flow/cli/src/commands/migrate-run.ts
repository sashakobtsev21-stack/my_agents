/**
 * Migrate Command — status / run / verify subcommands
 *
 * Extracted verbatim from migrate.ts (lines 23-520) during campaign-2
 * wave 66 (W272). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import * as fs from 'fs';
import * as path from 'path';
import { MIGRATION_TARGETS, formatMigrationStatus } from './migrate-helpers.js';

export const statusCommand: Command = {
  name: 'status',
  description: 'Check migration status',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const cwd = ctx.cwd || process.cwd();

    interface ComponentStatus {
      component: string;
      status: string;
      migrationNeeded: string;
    }

    const components: ComponentStatus[] = [];

    // Check v2 config: claude-flow.config.json with version "2" or missing version
    const v2ConfigPath = path.join(cwd, 'claude-flow.config.json');
    const v3ConfigDir = path.join(cwd, '.claude-flow');
    let hasV2Config = false;
    let hasV3Config = false;

    try {
      if (fs.existsSync(v2ConfigPath)) {
        const raw = fs.readFileSync(v2ConfigPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === '2' || parsed.version === 2 || !parsed.version) {
          hasV2Config = true;
        }
      }
    } catch { /* ignore parse errors */ }

    try {
      hasV3Config = fs.existsSync(v3ConfigDir) && fs.statSync(v3ConfigDir).isDirectory();
    } catch { /* ignore */ }

    if (hasV2Config && hasV3Config) {
      components.push({ component: 'Config', status: 'v2 + v3', migrationNeeded: 'no' });
    } else if (hasV2Config) {
      components.push({ component: 'Config', status: 'v2', migrationNeeded: 'yes' });
    } else if (hasV3Config) {
      components.push({ component: 'Config', status: 'v3', migrationNeeded: 'no' });
    } else {
      components.push({ component: 'Config', status: 'missing', migrationNeeded: 'no' });
    }

    // Check v2 memory: ./data/memory/*.json or memory.db
    const v2MemoryDir = path.join(cwd, 'data', 'memory');
    let hasV2MemoryJson = false;
    let hasV2MemoryDb = false;

    try {
      if (fs.existsSync(v2MemoryDir)) {
        const files = fs.readdirSync(v2MemoryDir);
        hasV2MemoryJson = files.some(f => f.endsWith('.json'));
        hasV2MemoryDb = files.includes('memory.db');
      }
    } catch { /* ignore */ }

    if (hasV2MemoryJson || hasV2MemoryDb) {
      components.push({ component: 'Memory', status: 'v2', migrationNeeded: 'yes' });
    } else {
      components.push({ component: 'Memory', status: 'missing', migrationNeeded: 'no' });
    }

    // Check v2 sessions: ./data/sessions/
    const v2SessionsDir = path.join(cwd, 'data', 'sessions');
    let hasV2Sessions = false;

    try {
      if (fs.existsSync(v2SessionsDir)) {
        const files = fs.readdirSync(v2SessionsDir);
        hasV2Sessions = files.length > 0;
      }
    } catch { /* ignore */ }

    if (hasV2Sessions) {
      components.push({ component: 'Sessions', status: 'v2', migrationNeeded: 'yes' });
    } else {
      components.push({ component: 'Sessions', status: 'missing', migrationNeeded: 'no' });
    }

    // Check migration state
    const migrationStatePath = path.join(cwd, '.claude-flow', 'migration-state.json');
    let migrationState: string | null = null;
    try {
      if (fs.existsSync(migrationStatePath)) {
        const raw = fs.readFileSync(migrationStatePath, 'utf-8');
        const parsed = JSON.parse(raw);
        migrationState = parsed.status || 'unknown';
      }
    } catch { /* ignore */ }

    if (migrationState) {
      components.push({ component: 'Migration State', status: migrationState, migrationNeeded: 'no' });
    }

    // Display results
    if (ctx.flags.format === 'json') {
      output.printJson({ components, migrationState });
      return { success: true, data: { components, migrationState } };
    }

    output.writeln();
    output.writeln(output.bold('Migration Status'));
    output.writeln();

    output.printTable({
      columns: [
        { key: 'component', header: 'Component', width: 20 },
        { key: 'status', header: 'Status', width: 15 },
        { key: 'migrationNeeded', header: 'Migration Needed', width: 20 }
      ],
      data: components.map(c => ({
        component: c.component,
        status: formatMigrationStatus(c.status),
        migrationNeeded: c.migrationNeeded === 'yes' ? output.warning('yes') : output.dim('no')
      })),
      border: false
    });

    const needsMigration = components.some(c => c.migrationNeeded === 'yes');
    output.writeln();
    if (needsMigration) {
      output.printInfo('V2 artifacts detected. Run "claude-flow migrate run" to migrate.');
    } else {
      output.printSuccess('No migration needed.');
    }

    return { success: true, data: { components, needsMigration } };
  }
};

// Run migration
export const runCommand: Command = {
  name: 'run',
  description: 'Run migration',
  options: [
    {
      name: 'target',
      short: 't',
      description: 'Migration target',
      type: 'string',
      choices: MIGRATION_TARGETS.map(t => t.value)
    },
    {
      name: 'dry-run',
      description: 'Show what would be migrated without making changes',
      type: 'boolean',
      default: false
    },
    {
      name: 'backup',
      description: 'Create backup before migration',
      type: 'boolean',
      default: true
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force migration (overwrite existing)',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const cwd = ctx.cwd || process.cwd();
    const dryRun = ctx.flags['dry-run'] === true;
    const skipBackup = ctx.flags.backup === false;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const v3Dir = path.join(cwd, '.claude-flow');
    const backupDir = path.join(v3Dir, 'backup', `v2-${timestamp}`);
    const migrationStatePath = path.join(v3Dir, 'migration-state.json');

    const migrated: string[] = [];
    const skipped: string[] = [];

    output.writeln();
    output.writeln(output.bold('V2 to V3 Migration'));
    if (dryRun) {
      output.printWarning('Dry run mode — no changes will be made.');
    }
    output.writeln();

    // Ensure .claude-flow directory exists
    if (!dryRun) {
      fs.mkdirSync(v3Dir, { recursive: true });
    }

    // --- Backup ---
    if (!skipBackup && !dryRun) {
      output.writeln(output.dim('Creating backup...'));
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // --- Config migration ---
    const v2ConfigPath = path.join(cwd, 'claude-flow.config.json');
    try {
      if (fs.existsSync(v2ConfigPath)) {
        const raw = fs.readFileSync(v2ConfigPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === '2' || parsed.version === 2 || !parsed.version) {
          if (dryRun) {
            output.printInfo(`Would migrate config: ${v2ConfigPath}`);
          } else {
            // Backup
            if (!skipBackup) {
              fs.copyFileSync(v2ConfigPath, path.join(backupDir, 'claude-flow.config.json'));
            }
            // Transform to v3 format
            const v3Config: Record<string, unknown> = { ...parsed, version: '3' };
            // Rename swarm.mode -> swarm.topology if present
            if (v3Config.swarm && typeof v3Config.swarm === 'object') {
              const swarm = v3Config.swarm as Record<string, unknown>;
              if ('mode' in swarm && !('topology' in swarm)) {
                swarm.topology = swarm.mode;
                delete swarm.mode;
              }
            }
            // Rename memory.type -> memory.backend if present
            if (v3Config.memory && typeof v3Config.memory === 'object') {
              const mem = v3Config.memory as Record<string, unknown>;
              if ('type' in mem && !('backend' in mem)) {
                mem.backend = mem.type;
                delete mem.type;
              }
            }
            const v3ConfigPath = path.join(v3Dir, 'config.json');
            fs.writeFileSync(v3ConfigPath, JSON.stringify(v3Config, null, 2));
            output.printSuccess(`Config migrated to ${v3ConfigPath}`);
          }
          migrated.push('config');
        } else {
          output.printInfo('Config already at v3 — skipping.');
          skipped.push('config');
        }
      } else {
        output.writeln(output.dim('No v2 config found — skipping config migration.'));
        skipped.push('config');
      }
    } catch (err) {
      output.printError('Config migration failed', String(err));
      skipped.push('config');
    }

    // --- Memory migration ---
    const v2MemoryDir = path.join(cwd, 'data', 'memory');
    try {
      if (fs.existsSync(v2MemoryDir)) {
        const files = fs.readdirSync(v2MemoryDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        const hasDb = files.includes('memory.db');

        if (jsonFiles.length > 0 || hasDb) {
          if (dryRun) {
            output.printInfo(`Would migrate memory: ${jsonFiles.length} JSON files, ${hasDb ? '1 DB' : 'no DB'}`);
          } else {
            // Backup memory files
            if (!skipBackup) {
              const memBackup = path.join(backupDir, 'data', 'memory');
              fs.mkdirSync(memBackup, { recursive: true });
              for (const f of files) {
                const src = path.join(v2MemoryDir, f);
                if (fs.statSync(src).isFile()) {
                  fs.copyFileSync(src, path.join(memBackup, f));
                }
              }
            }
            output.printSuccess(`Memory files backed up (${jsonFiles.length} JSON, ${hasDb ? '1 DB' : '0 DB'}).`);
            output.printInfo('Run "claude-flow memory init --force" to import v2 memory into v3 AgentDB.');
          }
          migrated.push('memory');
        } else {
          output.writeln(output.dim('No v2 memory files found — skipping.'));
          skipped.push('memory');
        }
      } else {
        output.writeln(output.dim('No v2 memory directory found — skipping.'));
        skipped.push('memory');
      }
    } catch (err) {
      output.printError('Memory migration failed', String(err));
      skipped.push('memory');
    }

    // --- Session migration ---
    const v2SessionsDir = path.join(cwd, 'data', 'sessions');
    try {
      if (fs.existsSync(v2SessionsDir)) {
        const files = fs.readdirSync(v2SessionsDir);
        if (files.length > 0) {
          if (dryRun) {
            output.printInfo(`Would migrate sessions: ${files.length} files from ${v2SessionsDir}`);
          } else {
            const v3SessionsDir = path.join(v3Dir, 'sessions');
            fs.mkdirSync(v3SessionsDir, { recursive: true });

            // Backup
            if (!skipBackup) {
              const sessBackup = path.join(backupDir, 'data', 'sessions');
              fs.mkdirSync(sessBackup, { recursive: true });
              for (const f of files) {
                const src = path.join(v2SessionsDir, f);
                if (fs.statSync(src).isFile()) {
                  fs.copyFileSync(src, path.join(sessBackup, f));
                }
              }
            }

            // Copy to v3 location
            for (const f of files) {
              const src = path.join(v2SessionsDir, f);
              if (fs.statSync(src).isFile()) {
                fs.copyFileSync(src, path.join(v3SessionsDir, f));
              }
            }
            output.printSuccess(`Sessions migrated: ${files.length} files to ${v3SessionsDir}`);
          }
          migrated.push('sessions');
        } else {
          output.writeln(output.dim('No v2 session files found — skipping.'));
          skipped.push('sessions');
        }
      } else {
        output.writeln(output.dim('No v2 sessions directory found — skipping.'));
        skipped.push('sessions');
      }
    } catch (err) {
      output.printError('Session migration failed', String(err));
      skipped.push('sessions');
    }

    // --- Save migration state ---
    if (!dryRun && migrated.length > 0) {
      const state = {
        status: 'completed',
        timestamp,
        backupPath: skipBackup ? null : backupDir,
        migrated,
        skipped
      };
      fs.writeFileSync(migrationStatePath, JSON.stringify(state, null, 2));
      output.writeln();
      output.printSuccess(`Migration state saved to ${migrationStatePath}`);
    }

    // Summary
    output.writeln();
    if (dryRun) {
      output.printInfo(`Dry run complete. ${migrated.length} component(s) would be migrated.`);
    } else if (migrated.length > 0) {
      output.printSuccess(`Migration complete. ${migrated.length} component(s) migrated: ${migrated.join(', ')}`);
      output.printInfo('Run "claude-flow migrate verify" to validate the migration.');
    } else {
      output.printInfo('Nothing to migrate.');
    }

    return { success: true, data: { migrated, skipped, dryRun } };
  }
};

// Verify migration
export const verifyCommand: Command = {
  name: 'verify',
  description: 'Verify migration integrity',
  options: [
    {
      name: 'fix',
      description: 'Automatically fix issues',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const cwd = ctx.cwd || process.cwd();
    const v3Dir = path.join(cwd, '.claude-flow');
    const migrationStatePath = path.join(v3Dir, 'migration-state.json');

    interface CheckResult {
      check: string;
      result: string;
    }

    const checks: CheckResult[] = [];
    let allPassed = true;

    output.writeln();
    output.writeln(output.bold('Migration Verification'));
    output.writeln();

    // Check 1: Migration state file exists
    let migrationState: Record<string, unknown> | null = null;
    try {
      if (fs.existsSync(migrationStatePath)) {
        const raw = fs.readFileSync(migrationStatePath, 'utf-8');
        migrationState = JSON.parse(raw);
        checks.push({ check: 'Migration state file', result: 'passed' });
      } else {
        checks.push({ check: 'Migration state file', result: 'failed' });
        allPassed = false;
      }
    } catch {
      checks.push({ check: 'Migration state file', result: 'failed' });
      allPassed = false;
    }

    // Check 2: V3 config exists and is valid JSON
    const v3ConfigPath = path.join(v3Dir, 'config.json');
    try {
      if (fs.existsSync(v3ConfigPath)) {
        const raw = fs.readFileSync(v3ConfigPath, 'utf-8');
        JSON.parse(raw); // validate JSON
        checks.push({ check: 'V3 config (valid JSON)', result: 'passed' });
      } else {
        // Config might not have been migrated if there was no v2 config
        const wasMigrated = migrationState &&
          Array.isArray(migrationState.migrated) &&
          (migrationState.migrated as string[]).includes('config');
        if (wasMigrated) {
          checks.push({ check: 'V3 config (valid JSON)', result: 'failed' });
          allPassed = false;
        } else {
          checks.push({ check: 'V3 config (valid JSON)', result: 'skipped' });
        }
      }
    } catch {
      checks.push({ check: 'V3 config (valid JSON)', result: 'failed' });
      allPassed = false;
    }

    // Check 3: Backup exists
    if (migrationState && migrationState.backupPath) {
      const backupPath = migrationState.backupPath as string;
      try {
        if (fs.existsSync(backupPath) && fs.statSync(backupPath).isDirectory()) {
          checks.push({ check: 'Backup directory', result: 'passed' });
        } else {
          checks.push({ check: 'Backup directory', result: 'failed' });
          allPassed = false;
        }
      } catch {
        checks.push({ check: 'Backup directory', result: 'failed' });
        allPassed = false;
      }
    } else if (migrationState && migrationState.backupPath === null) {
      checks.push({ check: 'Backup directory', result: 'skipped (backup was disabled)' });
    } else {
      checks.push({ check: 'Backup directory', result: 'failed' });
      allPassed = false;
    }

    // Check 4: V3 sessions directory if sessions were migrated
    if (migrationState &&
        Array.isArray(migrationState.migrated) &&
        (migrationState.migrated as string[]).includes('sessions')) {
      const v3Sessions = path.join(v3Dir, 'sessions');
      try {
        if (fs.existsSync(v3Sessions) && fs.readdirSync(v3Sessions).length > 0) {
          checks.push({ check: 'V3 sessions directory', result: 'passed' });
        } else {
          checks.push({ check: 'V3 sessions directory', result: 'failed' });
          allPassed = false;
        }
      } catch {
        checks.push({ check: 'V3 sessions directory', result: 'failed' });
        allPassed = false;
      }
    }

    // Display
    if (ctx.flags.format === 'json') {
      output.printJson({ checks, allPassed });
      return { success: allPassed, data: { checks, allPassed } };
    }

    output.printTable({
      columns: [
        { key: 'check', header: 'Check', width: 30 },
        { key: 'result', header: 'Result', width: 35 }
      ],
      data: checks.map(c => ({
        check: c.check,
        result: formatMigrationStatus(c.result)
      })),
      border: false
    });

    output.writeln();
    if (allPassed) {
      output.printSuccess('All verification checks passed.');
    } else {
      output.printError('Some verification checks failed.');
      output.printInfo('Run "claude-flow migrate run" to re-run the migration, or "migrate rollback" to restore from backup.');
    }

    return { success: allPassed, data: { checks, allPassed }, exitCode: allPassed ? 0 : 1 };
  }
};

// Rollback migration

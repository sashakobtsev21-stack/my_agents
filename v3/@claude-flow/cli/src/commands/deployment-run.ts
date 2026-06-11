/**
 * Deployment Command — deploy / status / rollback subcommands
 *
 * Extracted verbatim from deployment.ts (lines 102-397) during
 * campaign-2 wave 67 (W273). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import {
  type DeploymentRecord,
  generateId,
  loadDeploymentState,
  readProjectVersion,
  saveDeploymentState,
} from './deployment-state.js';

export const deployCommand: Command = {
  name: 'deploy',
  description: 'Deploy to target environment',
  options: [
    { name: 'env', short: 'e', type: 'string', description: 'Environment: dev, staging, prod', default: 'staging' },
    { name: 'version', short: 'v', type: 'string', description: 'Version to deploy' },
    { name: 'dry-run', short: 'd', type: 'boolean', description: 'Simulate deployment without changes' },
    { name: 'description', type: 'string', description: 'Deployment description' },
  ],
  examples: [
    { command: 'claude-flow deployment deploy -e prod', description: 'Deploy to production' },
    { command: 'claude-flow deployment deploy --dry-run', description: 'Simulate deployment' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const envName = String(ctx.flags['env'] || 'staging');
      const dryRun = Boolean(ctx.flags['dry-run']);
      const description = ctx.flags['description'] ? String(ctx.flags['description']) : undefined;

      let version = ctx.flags['version'] ? String(ctx.flags['version']) : null;
      if (!version) {
        version = readProjectVersion(ctx.cwd) || '0.0.0';
      }

      const state = loadDeploymentState(ctx.cwd);

      // Ensure environment exists; auto-create if it doesn't
      if (!state.environments[envName]) {
        state.environments[envName] = {
          name: envName,
          type: envName === 'prod' || envName === 'production' ? 'production' : envName === 'staging' ? 'staging' : 'local',
          createdAt: new Date().toISOString(),
        };
      }

      const record: DeploymentRecord = {
        id: generateId(),
        environment: envName,
        version,
        status: 'deployed',
        timestamp: new Date().toISOString(),
        description,
      };

      if (dryRun) {
        output.writeln();
        output.printInfo('Dry run - no changes will be made');
        output.writeln();
        output.writeln(output.bold('Deployment Preview'));
        output.printTable({
          columns: [
            { key: 'field', header: 'Field' },
            { key: 'value', header: 'Value' },
          ],
          data: [
            { field: 'ID', value: record.id },
            { field: 'Environment', value: envName },
            { field: 'Version', value: version },
            { field: 'Status', value: 'deployed (dry-run)' },
            { field: 'Description', value: description || '-' },
          ],
        });
        return { success: true };
      }

      state.history.push(record);
      state.activeDeployment = record.id;
      saveDeploymentState(ctx.cwd, state);

      output.writeln();
      output.printSuccess(`Deployed version ${version} to ${envName}`);
      output.writeln();
      output.printTable({
        columns: [
          { key: 'field', header: 'Field' },
          { key: 'value', header: 'Value' },
        ],
        data: [
          { field: 'ID', value: record.id },
          { field: 'Environment', value: envName },
          { field: 'Version', value: version },
          { field: 'Status', value: record.status },
          { field: 'Timestamp', value: record.timestamp },
          { field: 'Description', value: description || '-' },
        ],
      });

      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Deploy failed', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Status subcommand
// ============================================

export const statusCommand: Command = {
  name: 'status',
  description: 'Check deployment status across environments',
  options: [
    { name: 'env', short: 'e', type: 'string', description: 'Specific environment to check' },
  ],
  examples: [
    { command: 'claude-flow deployment status', description: 'Show all environments' },
    { command: 'claude-flow deployment status -e prod', description: 'Check production' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const state = loadDeploymentState(ctx.cwd);
      const filterEnv = ctx.flags['env'] ? String(ctx.flags['env']) : null;

      output.writeln();
      output.writeln(output.bold('Deployment Status'));
      output.writeln();

      // Active deployment
      if (state.activeDeployment) {
        const active = state.history.find(r => r.id === state.activeDeployment);
        if (active) {
          output.printInfo(`Active deployment: ${active.id} (v${active.version} on ${active.environment})`);
        }
      } else {
        output.writeln(output.dim('No active deployment'));
      }

      // Environments table
      const envEntries = Object.values(state.environments);
      if (filterEnv) {
        const env = state.environments[filterEnv];
        if (!env) {
          output.printWarning(`Environment '${filterEnv}' not found`);
          return { success: true };
        }
        output.writeln();
        output.writeln(output.bold('Environment'));
        output.printTable({
          columns: [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
            { key: 'url', header: 'URL' },
            { key: 'createdAt', header: 'Created' },
          ],
          data: [{ name: env.name, type: env.type, url: env.url || '-', createdAt: env.createdAt }],
        });
      } else if (envEntries.length > 0) {
        output.writeln();
        output.writeln(output.bold('Environments'));
        output.printTable({
          columns: [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
            { key: 'url', header: 'URL' },
            { key: 'createdAt', header: 'Created' },
          ],
          data: envEntries.map(e => ({ name: e.name, type: e.type, url: e.url || '-', createdAt: e.createdAt })),
        });
      } else {
        output.writeln(output.dim('No environments configured'));
      }

      // Recent history (last 5)
      let recent = [...state.history].reverse().slice(0, 5);
      if (filterEnv) {
        recent = recent.filter(r => r.environment === filterEnv);
      }
      if (recent.length > 0) {
        output.writeln();
        output.writeln(output.bold('Recent Deployments'));
        output.printTable({
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'environment', header: 'Env' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status' },
            { key: 'timestamp', header: 'Time' },
          ],
          data: recent.map(r => ({ ...r })),
        });
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Status check failed', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Rollback subcommand
// ============================================

export const rollbackCommand: Command = {
  name: 'rollback',
  description: 'Rollback to previous deployment',
  options: [
    { name: 'env', short: 'e', type: 'string', description: 'Environment to rollback', required: true },
    { name: 'version', short: 'v', type: 'string', description: 'Specific version to rollback to' },
    { name: 'steps', short: 's', type: 'number', description: 'Number of versions to rollback', default: '1' },
  ],
  examples: [
    { command: 'claude-flow deployment rollback -e prod', description: 'Rollback production' },
    { command: 'claude-flow deployment rollback -e prod -v v3.0.0', description: 'Rollback to specific version' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const envName = String(ctx.flags['env'] || '');
      if (!envName) {
        output.printError('Environment is required', 'Use --env or -e to specify');
        return { success: false, exitCode: 1 };
      }

      const targetVersion = ctx.flags['version'] ? String(ctx.flags['version']) : null;
      const state = loadDeploymentState(ctx.cwd);

      // Find deployments for this environment in reverse chronological order
      const envHistory = state.history
        .filter(r => r.environment === envName && r.status === 'deployed')
        .reverse();

      if (envHistory.length < 2 && !targetVersion) {
        output.printWarning('No previous deployment to rollback to');
        return { success: false, exitCode: 1 };
      }

      let rollbackTo: DeploymentRecord | undefined;

      if (targetVersion) {
        rollbackTo = envHistory.find(r => r.version === targetVersion);
        if (!rollbackTo) {
          output.printError(`Version '${targetVersion}' not found in deployment history for '${envName}'`);
          return { success: false, exitCode: 1 };
        }
      } else {
        // Rollback to the deployment before the most recent one
        rollbackTo = envHistory[1];
      }

      // Mark current active deployment for this env as rolled-back
      const current = envHistory[0];
      if (current) {
        const idx = state.history.findIndex(r => r.id === current.id);
        if (idx >= 0) {
          state.history[idx].status = 'rolled-back';
        }
      }

      // Create a new record for the rollback
      const record: DeploymentRecord = {
        id: generateId(),
        environment: envName,
        version: rollbackTo!.version,
        status: 'deployed',
        timestamp: new Date().toISOString(),
        description: `Rollback from ${current?.version || 'unknown'} to ${rollbackTo!.version}`,
      };

      state.history.push(record);
      state.activeDeployment = record.id;
      saveDeploymentState(ctx.cwd, state);

      output.writeln();
      output.printSuccess(`Rolled back ${envName} to version ${rollbackTo!.version}`);
      output.writeln();
      output.printTable({
        columns: [
          { key: 'field', header: 'Field' },
          { key: 'value', header: 'Value' },
        ],
        data: [
          { field: 'Rollback ID', value: record.id },
          { field: 'Environment', value: envName },
          { field: 'From Version', value: current?.version || 'unknown' },
          { field: 'To Version', value: rollbackTo!.version },
          { field: 'Timestamp', value: record.timestamp },
        ],
      });

      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Rollback failed', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// History subcommand (logs)
// ============================================


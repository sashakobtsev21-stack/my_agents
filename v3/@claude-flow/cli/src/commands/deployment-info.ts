/**
 * Deployment Command — history / environments / logs / release
 *
 * Extracted verbatim from deployment.ts (lines 398-729) during
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

export const historyCommand: Command = {
  name: 'history',
  description: 'View deployment history',
  options: [
    { name: 'env', short: 'e', type: 'string', description: 'Filter by environment' },
    { name: 'limit', short: 'l', type: 'number', description: 'Number of entries', default: '10' },
  ],
  examples: [
    { command: 'claude-flow deployment history', description: 'Show all history' },
    { command: 'claude-flow deployment history -e prod', description: 'Production history' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const state = loadDeploymentState(ctx.cwd);
      const filterEnv = ctx.flags['env'] ? String(ctx.flags['env']) : null;
      const limit = Number(ctx.flags['limit']) || 10;

      let records = [...state.history].reverse();
      if (filterEnv) {
        records = records.filter(r => r.environment === filterEnv);
      }
      records = records.slice(0, limit);

      output.writeln();
      output.writeln(output.bold('Deployment History'));

      if (filterEnv) {
        output.writeln(output.dim(`Filtered by environment: ${filterEnv}`));
      }
      output.writeln();

      if (records.length === 0) {
        output.writeln(output.dim('No deployment history found'));
        return { success: true };
      }

      output.printTable({
        columns: [
          { key: 'id', header: 'ID' },
          { key: 'environment', header: 'Env' },
          { key: 'version', header: 'Version' },
          { key: 'status', header: 'Status' },
          { key: 'timestamp', header: 'Time' },
          { key: 'description', header: 'Description' },
        ],
        data: records.map(r => ({
          ...r,
          description: r.description || '-',
        })),
      });

      output.writeln();
      output.writeln(output.dim(`Showing ${records.length} of ${state.history.length} total records`));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Failed to load history', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Environments subcommand
// ============================================

export const environmentsCommand: Command = {
  name: 'environments',
  description: 'Manage deployment environments',
  aliases: ['envs'],
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: list, add, remove', default: 'list' },
    { name: 'name', short: 'n', type: 'string', description: 'Environment name' },
    { name: 'type', short: 't', type: 'string', description: 'Environment type: local, staging, production', default: 'local' },
    { name: 'url', short: 'u', type: 'string', description: 'Environment URL' },
  ],
  examples: [
    { command: 'claude-flow deployment environments', description: 'List environments' },
    { command: 'claude-flow deployment envs -a add -n preview -t staging', description: 'Add environment' },
    { command: 'claude-flow deployment envs -a remove -n preview', description: 'Remove environment' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const action = String(ctx.flags['action'] || 'list');
      const state = loadDeploymentState(ctx.cwd);

      if (action === 'list') {
        const envs = Object.values(state.environments);

        output.writeln();
        output.writeln(output.bold('Deployment Environments'));
        output.writeln();

        if (envs.length === 0) {
          output.writeln(output.dim('No environments configured. Use --action add to create one.'));
          return { success: true };
        }

        output.printTable({
          columns: [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
            { key: 'url', header: 'URL' },
            { key: 'createdAt', header: 'Created' },
          ],
          data: envs.map(e => ({ name: e.name, type: e.type, url: e.url || '-', createdAt: e.createdAt })),
        });

        return { success: true };
      }

      if (action === 'add') {
        const name = ctx.flags['name'] ? String(ctx.flags['name']) : null;
        if (!name) {
          output.printError('Environment name is required', 'Use --name or -n to specify');
          return { success: false, exitCode: 1 };
        }
        if (state.environments[name]) {
          output.printWarning(`Environment '${name}' already exists`);
          return { success: false, exitCode: 1 };
        }

        const envType = String(ctx.flags['type'] || 'local');
        const url = ctx.flags['url'] ? String(ctx.flags['url']) : undefined;

        state.environments[name] = {
          name,
          type: envType,
          url,
          createdAt: new Date().toISOString(),
        };
        saveDeploymentState(ctx.cwd, state);

        output.writeln();
        output.printSuccess(`Added environment '${name}' (${envType})`);
        if (url) {
          output.writeln(output.dim(`  URL: ${url}`));
        }
        return { success: true };
      }

      if (action === 'remove') {
        const name = ctx.flags['name'] ? String(ctx.flags['name']) : null;
        if (!name) {
          output.printError('Environment name is required', 'Use --name or -n to specify');
          return { success: false, exitCode: 1 };
        }
        if (!state.environments[name]) {
          output.printWarning(`Environment '${name}' not found`);
          return { success: false, exitCode: 1 };
        }

        delete state.environments[name];
        saveDeploymentState(ctx.cwd, state);

        output.writeln();
        output.printSuccess(`Removed environment '${name}'`);
        return { success: true };
      }

      output.printError(`Unknown action '${action}'`, 'Valid actions: list, add, remove');
      return { success: false, exitCode: 1 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Environments command failed', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Logs subcommand
// ============================================

export const logsCommand: Command = {
  name: 'logs',
  description: 'View deployment logs',
  options: [
    { name: 'deployment', short: 'd', type: 'string', description: 'Deployment ID' },
    { name: 'env', short: 'e', type: 'string', description: 'Environment' },
    { name: 'lines', short: 'n', type: 'number', description: 'Number of lines', default: '50' },
  ],
  examples: [
    { command: 'claude-flow deployment logs -e prod', description: 'View production logs' },
    { command: 'claude-flow deployment logs -d dep-123', description: 'View specific deployment' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const state = loadDeploymentState(ctx.cwd);
      const filterEnv = ctx.flags['env'] ? String(ctx.flags['env']) : null;
      const deploymentId = ctx.flags['deployment'] ? String(ctx.flags['deployment']) : null;
      const limit = Number(ctx.flags['lines']) || 50;

      output.writeln();
      output.writeln(output.bold('Deployment Logs'));
      output.writeln();

      let records = [...state.history].reverse();

      if (deploymentId) {
        records = records.filter(r => r.id === deploymentId);
        if (records.length === 0) {
          output.printWarning(`Deployment '${deploymentId}' not found`);
          return { success: false, exitCode: 1 };
        }
      }

      if (filterEnv) {
        records = records.filter(r => r.environment === filterEnv);
      }

      records = records.slice(0, limit);

      if (records.length === 0) {
        output.writeln(output.dim('No deployment logs found'));
        return { success: true };
      }

      output.printTable({
        columns: [
          { key: 'id', header: 'ID' },
          { key: 'environment', header: 'Env' },
          { key: 'version', header: 'Version' },
          { key: 'status', header: 'Status' },
          { key: 'timestamp', header: 'Time' },
          { key: 'description', header: 'Description' },
        ],
        data: records.map(r => ({
          ...r,
          description: r.description || '-',
        })),
      });

      output.writeln();
      output.writeln(output.dim(`${records.length} entries shown`));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Failed to load logs', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Release subcommand
// ============================================

export const releaseCommand: Command = {
  name: 'release',
  description: 'Create a new release deployment',
  options: [
    { name: 'version', short: 'v', type: 'string', description: 'Release version' },
    { name: 'env', short: 'e', type: 'string', description: 'Target environment', default: 'production' },
    { name: 'description', short: 'd', type: 'string', description: 'Release description' },
  ],
  examples: [
    { command: 'claude-flow deployment release -v 3.5.0', description: 'Release version 3.5.0' },
    { command: 'claude-flow deployment release -v 3.5.0 -d "Major update"', description: 'Release with description' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const envName = String(ctx.flags['env'] || 'production');
      const description = ctx.flags['description'] ? String(ctx.flags['description']) : undefined;

      let version = ctx.flags['version'] ? String(ctx.flags['version']) : null;
      if (!version) {
        const pkgVersion = readProjectVersion(ctx.cwd);
        if (!pkgVersion) {
          output.printError('Version is required', 'Use --version or -v, or ensure package.json has a version field');
          return { success: false, exitCode: 1 };
        }
        version = pkgVersion;
      }

      const state = loadDeploymentState(ctx.cwd);

      // Ensure environment exists
      if (!state.environments[envName]) {
        state.environments[envName] = {
          name: envName,
          type: envName === 'prod' || envName === 'production' ? 'production' : 'staging',
          createdAt: new Date().toISOString(),
        };
      }

      const record: DeploymentRecord = {
        id: generateId(),
        environment: envName,
        version,
        status: 'deployed',
        timestamp: new Date().toISOString(),
        description: description || `Release ${version}`,
      };

      state.history.push(record);
      state.activeDeployment = record.id;
      saveDeploymentState(ctx.cwd, state);

      output.writeln();
      output.printSuccess(`Released version ${version} to ${envName}`);
      output.writeln();
      output.printTable({
        columns: [
          { key: 'field', header: 'Field' },
          { key: 'value', header: 'Value' },
        ],
        data: [
          { field: 'Release ID', value: record.id },
          { field: 'Environment', value: envName },
          { field: 'Version', value: version },
          { field: 'Status', value: record.status },
          { field: 'Timestamp', value: record.timestamp },
          { field: 'Description', value: record.description || '-' },
        ],
      });

      return { success: true, data: record };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.printError('Release failed', msg);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================
// Main deployment command
// ============================================


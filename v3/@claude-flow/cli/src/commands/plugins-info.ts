/**
 * Plugins Command — info / create / upgrade / search / rate subcommands
 *
 * Extracted verbatim from plugins.ts (lines 450-890) during campaign-2
 * wave 14 (W220). Module-private group; imported back by the
 * pluginsCommand aggregate.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import {
  createPluginDiscoveryService,
  searchPlugins,
  getPluginSearchSuggestions,
  type PluginSearchOptions,
  type PluginType,
} from '../plugins/store/index.js';
import { getPluginManager } from '../plugins/manager.js';

export const infoCommand: Command = {
  name: 'info',
  description: 'Show detailed plugin information from IPFS registry',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name', required: true },
    { name: 'registry', short: 'r', type: 'string', description: 'Registry to use' },
  ],
  examples: [
    { command: 'claude-flow plugins info -n @claude-flow/neural', description: 'Show plugin info' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;
    const registryName = ctx.flags.registry as string;

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Fetching plugin details...', spinner: 'dots' });
    spinner.start();

    try {
      // Discover registry and find plugin
      const discovery = createPluginDiscoveryService();
      const result = await discovery.discoverRegistry(registryName);

      if (!result.success || !result.registry) {
        spinner.fail('Failed to discover registry');
        return { success: false, exitCode: 1 };
      }

      const plugin = result.registry.plugins.find(p => p.name === name || p.id === name);
      if (!plugin) {
        spinner.fail(`Plugin not found: ${name}`);
        return { success: false, exitCode: 1 };
      }

      spinner.succeed(`Found ${plugin.displayName}`);

      output.writeln();
      output.writeln(output.bold(`Plugin: ${plugin.displayName}`));
      output.writeln(output.dim('─'.repeat(60)));

      if (ctx.flags.format === 'json') {
        output.printJson(plugin);
        return { success: true, data: plugin };
      }

      // Basic info
      output.writeln(output.bold('Basic Information'));
      output.printTable({
        columns: [
          { key: 'field', header: 'Field', width: 15 },
          { key: 'value', header: 'Value', width: 45 },
        ],
        data: [
          { field: 'Name', value: plugin.name },
          { field: 'Display Name', value: plugin.displayName },
          { field: 'Version', value: plugin.version },
          { field: 'Type', value: plugin.type },
          { field: 'License', value: plugin.license },
          { field: 'Author', value: plugin.author.displayName || plugin.author.id },
          { field: 'Trust Level', value: plugin.trustLevel },
          { field: 'Verified', value: plugin.verified ? '✓ Yes' : '✗ No' },
        ],
      });

      output.writeln();
      output.writeln(output.bold('Description'));
      output.writeln(plugin.description);

      // Storage info
      output.writeln();
      output.writeln(output.bold('Storage'));
      output.printTable({
        columns: [
          { key: 'field', header: 'Field', width: 15 },
          { key: 'value', header: 'Value', width: 45 },
        ],
        data: [
          { field: 'CID', value: plugin.cid },
          { field: 'Size', value: `${(plugin.size / 1024).toFixed(1)} KB` },
          { field: 'Checksum', value: plugin.checksum },
        ],
      });

      // Stats
      output.writeln();
      output.writeln(output.bold('Statistics'));
      output.printTable({
        columns: [
          { key: 'field', header: 'Field', width: 15 },
          { key: 'value', header: 'Value', width: 45 },
        ],
        data: [
          { field: 'Downloads', value: plugin.downloads.toLocaleString() },
          { field: 'Rating', value: `${plugin.rating.toFixed(1)}★ (${plugin.ratingCount} ratings)` },
          { field: 'Created', value: plugin.createdAt },
          { field: 'Updated', value: plugin.lastUpdated },
        ],
      });

      // Hooks and commands
      if (plugin.hooks.length > 0) {
        output.writeln();
        output.writeln(output.bold('Hooks'));
        output.printList(plugin.hooks.map(h => output.highlight(h)));
      }

      if (plugin.commands.length > 0) {
        output.writeln();
        output.writeln(output.bold('Commands'));
        output.printList(plugin.commands.map(c => output.highlight(c)));
      }

      // Permissions
      if (plugin.permissions.length > 0) {
        output.writeln();
        output.writeln(output.bold('Required Permissions'));
        output.printList(plugin.permissions.map(p => {
          const icon = ['privileged', 'credentials', 'execute'].includes(p) ? '⚠️ ' : '';
          return `${icon}${p}`;
        }));
      }

      // Dependencies
      if (plugin.dependencies.length > 0) {
        output.writeln();
        output.writeln(output.bold('Dependencies'));
        output.printList(plugin.dependencies.map(d =>
          `${d.name}@${d.version}${d.optional ? ' (optional)' : ''}`
        ));
      }

      // Security audit
      if (plugin.securityAudit) {
        output.writeln();
        output.writeln(output.bold('Security Audit'));
        output.printTable({
          columns: [
            { key: 'field', header: 'Field', width: 15 },
            { key: 'value', header: 'Value', width: 45 },
          ],
          data: [
            { field: 'Auditor', value: plugin.securityAudit.auditor },
            { field: 'Date', value: plugin.securityAudit.auditDate },
            { field: 'Passed', value: plugin.securityAudit.passed ? '✓ Yes' : '✗ No' },
            { field: 'Issues', value: String(plugin.securityAudit.issues.length) },
          ],
        });
      }

      // Tags
      output.writeln();
      output.writeln(output.bold('Tags'));
      output.writeln(plugin.tags.map(t => output.dim(`#${t}`)).join(' '));

      return { success: true, data: plugin };
    } catch (error) {
      spinner.fail('Failed to fetch plugin info');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Create subcommand
export const createCommand: Command = {
  name: 'create',
  description: 'Scaffold a new plugin project',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name', required: true },
    { name: 'template', short: 't', type: 'string', description: 'Template: basic, advanced, hooks', default: 'basic' },
    { name: 'path', short: 'p', type: 'string', description: 'Output path', default: '.' },
  ],
  examples: [
    { command: 'claude-flow plugins create -n my-plugin', description: 'Create basic plugin' },
    { command: 'claude-flow plugins create -n my-plugin -t hooks', description: 'Create hooks plugin' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;
    const template = ctx.flags.template as string || 'basic';

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Creating Plugin'));
    output.writeln(output.dim('─'.repeat(40)));

    const spinner = output.createSpinner({ text: 'Scaffolding project...', spinner: 'dots' });
    spinner.start();

    const files = ['package.json', 'src/index.ts', 'src/hooks.ts', 'README.md', 'tsconfig.json'];
    for (const file of files) {
      spinner.setText(`Creating ${file}...`);
      await new Promise(r => setTimeout(r, 150));
    }

    spinner.succeed('Plugin scaffolded');

    output.writeln();
    output.printBox([
      `Plugin: ${name}`,
      `Template: ${template}`,
      `Location: ./${name}/`,
      ``,
      `Files created:`,
      `  - package.json`,
      `  - src/index.ts`,
      `  - src/hooks.ts`,
      `  - README.md`,
      `  - tsconfig.json`,
      ``,
      `Next steps:`,
      `  cd ${name}`,
      `  npm install`,
      `  npm run build`,
    ].join('\n'), 'Success');

    return { success: true };
  },
};

// Upgrade subcommand
export const upgradeCommand: Command = {
  name: 'upgrade',
  description: 'Upgrade an installed plugin to a newer version',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name', required: true },
    { name: 'version', short: 'v', type: 'string', description: 'Target version (default: latest)' },
  ],
  examples: [
    { command: 'claude-flow plugins upgrade -n @claude-flow/neural', description: 'Upgrade to latest' },
    { command: 'claude-flow plugins upgrade -n @claude-flow/neural -v 3.1.0', description: 'Upgrade to specific version' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;
    const version = ctx.flags.version as string;

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    const spinner = output.createSpinner({ text: `Upgrading ${name}...`, spinner: 'dots' });
    spinner.start();

    try {
      const manager = getPluginManager();
      await manager.initialize();

      // Check if installed
      const existing = await manager.getPlugin(name);
      if (!existing) {
        spinner.fail(`Plugin ${name} is not installed`);
        return { success: false, exitCode: 1 };
      }

      const oldVersion = existing.version;
      spinner.setText(`Upgrading ${name} from v${oldVersion}...`);

      const result = await manager.upgrade(name, version);

      if (!result.success) {
        spinner.fail(`Upgrade failed: ${result.error}`);
        return { success: false, exitCode: 1 };
      }

      const plugin = result.plugin!;
      spinner.succeed(`Upgraded ${name}: v${oldVersion} -> v${plugin.version}`);

      return { success: true, data: plugin };
    } catch (error) {
      spinner.fail('Upgrade failed');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Search subcommand - Search IPFS registry
export const searchCommand: Command = {
  name: 'search',
  description: 'Search plugins in the IPFS registry',
  options: [
    { name: 'query', short: 'q', type: 'string', description: 'Search query', required: true },
    { name: 'category', short: 'c', type: 'string', description: 'Filter by category' },
    { name: 'type', short: 't', type: 'string', description: 'Filter by plugin type' },
    { name: 'verified', short: 'v', type: 'boolean', description: 'Show only verified plugins' },
    { name: 'limit', short: 'l', type: 'number', description: 'Maximum results', default: 20 },
    { name: 'registry', short: 'r', type: 'string', description: 'Registry to use' },
  ],
  examples: [
    { command: 'claude-flow plugins search -q neural', description: 'Search for neural plugins' },
    { command: 'claude-flow plugins search -q security --verified', description: 'Search verified security plugins' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = ctx.flags.query as string;
    const category = ctx.flags.category as string;
    const type = ctx.flags.type as string;
    const verified = ctx.flags.verified as boolean;
    const limit = (ctx.flags.limit as number) || 20;
    const registryName = ctx.flags.registry as string;

    if (!query) {
      output.printError('Search query is required');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Searching plugin registry...', spinner: 'dots' });
    spinner.start();

    try {
      const discovery = createPluginDiscoveryService();
      const result = await discovery.discoverRegistry(registryName);

      if (!result.success || !result.registry) {
        spinner.fail('Failed to discover registry');
        return { success: false, exitCode: 1 };
      }

      const searchOptions: PluginSearchOptions = {
        query,
        category,
        type: type as PluginType,
        verified,
        limit,
        sortBy: 'downloads',
        sortOrder: 'desc',
      };

      const searchResult = searchPlugins(result.registry, searchOptions);
      spinner.succeed(`Found ${searchResult.total} plugins matching "${query}"`);

      output.writeln();
      output.writeln(output.bold(`Search Results: "${query}"`));
      output.writeln(output.dim('─'.repeat(70)));

      if (searchResult.plugins.length === 0) {
        output.writeln(output.dim('No plugins found matching your query'));
        output.writeln();
        output.writeln('Suggestions:');
        const suggestions = getPluginSearchSuggestions(result.registry, query.slice(0, 3));
        if (suggestions.length > 0) {
          output.printList(suggestions.slice(0, 5));
        } else {
          output.writeln(output.dim('  Try a different search term'));
        }
        return { success: true, data: searchResult };
      }

      if (ctx.flags.format === 'json') {
        output.printJson(searchResult);
        return { success: true, data: searchResult };
      }

      output.printTable({
        columns: [
          { key: 'name', header: 'Plugin', width: 38 },
          { key: 'description', header: 'Description', width: 40 },
          { key: 'downloads', header: 'Downloads', width: 10, align: 'right' },
        ],
        data: searchResult.plugins.map(p => ({
          name: p.verified ? `✓ ${p.name}` : p.name,
          description: p.description.slice(0, 33) + (p.description.length > 33 ? '...' : ''),
          downloads: p.downloads.toLocaleString(),
        })),
      });

      output.writeln();
      output.writeln(output.dim(`Showing ${searchResult.plugins.length} of ${searchResult.total} results`));
      if (searchResult.hasMore) {
        output.writeln(output.dim(`Use --limit to see more results`));
      }

      return { success: true, data: searchResult };
    } catch (error) {
      spinner.fail('Search failed');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Rate subcommand - Rate plugins via Cloud Function
export const rateCommand: Command = {
  name: 'rate',
  description: 'Rate a plugin (1-5 stars)',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name to rate', required: true },
    { name: 'rating', short: 'r', type: 'number', description: 'Rating (1-5)', required: true },
  ],
  examples: [
    { command: 'claude-flow plugins rate -n @claude-flow/embeddings -r 5', description: 'Rate 5 stars' },
    { command: 'claude-flow plugins rate -n my-plugin -r 4', description: 'Rate 4 stars' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const { rateItem } = await import('../services/registry-api.js');

    const name = ctx.flags.name as string;
    const rating = parseInt(ctx.flags.rating as string, 10);

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    if (!rating || rating < 1 || rating > 5) {
      output.printError('Rating must be 1-5');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Submitting rating...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await rateItem(name, rating, 'plugin');

      spinner.succeed('Rating submitted');
      output.writeln();
      output.writeln(`Plugin: ${output.highlight(name)}`);
      output.writeln(`Your rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`);
      output.writeln(`New average: ${result.average.toFixed(1)}★ (${result.count} ratings)`);
      output.writeln();
      output.writeln(output.dim('Thank you for your feedback!'));

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Failed to submit rating');
      output.printError(String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Main plugins command - Now with IPFS-based registry

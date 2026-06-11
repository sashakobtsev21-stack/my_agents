/**
 * Plugins Command — list / install / uninstall / toggle subcommands
 *
 * Extracted verbatim from plugins.ts (lines 25-449) during campaign-2
 * wave 14 (W220). Module-private group; imported back by the
 * pluginsCommand aggregate.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import {
  createPluginDiscoveryService,
  searchPlugins,
  getFeaturedPlugins,
  getOfficialPlugins,
  type PluginEntry,
  type PluginSearchOptions,
  type PluginType,
} from '../plugins/store/index.js';
import { getPluginManager, type InstalledPlugin } from '../plugins/manager.js';
import { getBulkRatings } from '../services/registry-api.js';

export const listCommand: Command = {
  name: 'list',
  description: 'List installed and available plugins from IPFS registry',
  options: [
    { name: 'installed', short: 'i', type: 'boolean', description: 'Show only installed plugins' },
    { name: 'available', short: 'a', type: 'boolean', description: 'Show available plugins from registry' },
    { name: 'category', short: 'c', type: 'string', description: 'Filter by category' },
    { name: 'type', short: 't', type: 'string', description: 'Filter by plugin type' },
    { name: 'official', short: 'o', type: 'boolean', description: 'Show only official plugins' },
    { name: 'featured', short: 'f', type: 'boolean', description: 'Show featured plugins' },
    { name: 'registry', short: 'r', type: 'string', description: 'Registry to use (default: claude-flow-official)' },
  ],
  examples: [
    { command: 'claude-flow plugins list', description: 'List all plugins from registry' },
    { command: 'claude-flow plugins list --installed', description: 'List installed only' },
    { command: 'claude-flow plugins list --official', description: 'List official plugins' },
    { command: 'claude-flow plugins list --category security', description: 'List security plugins' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const installedOnly = ctx.flags.installed as boolean;
    const category = ctx.flags.category as string;
    const type = ctx.flags.type as string;
    const official = ctx.flags.official as boolean;
    const featured = ctx.flags.featured as boolean;
    const registryName = ctx.flags.registry as string;

    // For installed-only, read from local manifest
    if (installedOnly) {
      output.writeln();
      output.writeln(output.bold('Installed Plugins'));
      output.writeln(output.dim('─'.repeat(60)));

      try {
        const manager = getPluginManager();
        await manager.initialize();
        const installed = await manager.getInstalled();

        if (installed.length === 0) {
          output.writeln(output.dim('No plugins installed.'));
          output.writeln();
          output.writeln(output.dim('Run "claude-flow plugins list" to see available plugins'));
          output.writeln(output.dim('Run "claude-flow plugins install -n <plugin>" to install'));
          return { success: true };
        }

        output.printTable({
          columns: [
            { key: 'name', header: 'Plugin', width: 38 },
            { key: 'version', header: 'Version', width: 14 },
            { key: 'source', header: 'Source', width: 10 },
            { key: 'status', header: 'Status', width: 10 },
          ],
          data: installed.map((p: InstalledPlugin) => ({
            name: p.name,
            version: p.version,
            source: p.source,
            status: p.enabled ? output.success('Enabled') : output.dim('Disabled'),
          })),
        });

        output.writeln();
        output.writeln(output.dim(`Plugins directory: ${manager.getPluginsDir()}`));

        return { success: true, data: installed };
      } catch (error) {
        output.printError(`Failed to load installed plugins: ${String(error)}`);
        return { success: false, exitCode: 1 };
      }
    }

    // Discover registry via IPFS
    const spinner = output.createSpinner({ text: 'Discovering plugin registry via IPNS...', spinner: 'dots' });
    spinner.start();

    try {
      const discovery = createPluginDiscoveryService();
      const result = await discovery.discoverRegistry(registryName);

      if (!result.success || !result.registry) {
        spinner.fail('Failed to discover registry');
        output.printError(result.error || 'Unknown error');
        return { success: false, exitCode: 1 };
      }

      spinner.succeed(`Registry discovered: ${result.registry.totalPlugins} plugins available`);

      output.writeln();

      // Build search options
      const searchOptions: PluginSearchOptions = {
        category,
        type: type as PluginType,
        sortBy: 'downloads',
        sortOrder: 'desc',
      };

      let plugins: PluginEntry[];
      let title: string;

      if (official) {
        plugins = getOfficialPlugins(result.registry);
        title = 'Official Plugins';
      } else if (featured) {
        plugins = getFeaturedPlugins(result.registry);
        title = 'Featured Plugins';
      } else {
        const searchResult = searchPlugins(result.registry, searchOptions);
        plugins = searchResult.plugins;
        title = category ? `${category} Plugins` : 'Available Plugins';
      }

      output.writeln(output.bold(title));
      output.writeln(output.dim('─'.repeat(70)));

      // Fetch real ratings from Cloud Function (non-blocking)
      let realRatings: Record<string, { average: number; count: number }> = {};
      let ratingsSource: 'live' | 'cached' | 'unavailable' = 'live';
      try {
        const pluginIds = plugins.map(p => p.name);
        realRatings = await getBulkRatings(pluginIds, 'plugin');
      } catch {
        // Fall back to static ratings if Cloud Function unavailable
        ratingsSource = 'unavailable';
      }

      if (ctx.flags.format === 'json') {
        // Merge real ratings into plugin data
        const pluginsWithRatings = plugins.map(p => ({
          ...p,
          rating: realRatings[p.name]?.average || p.rating,
          ratingCount: realRatings[p.name]?.count || 0,
          ...(ratingsSource === 'unavailable' ? { ratingsSource: 'cached' as const } : {}),
        }));
        output.printJson(pluginsWithRatings);
        return { success: true, data: pluginsWithRatings };
      }

      output.printTable({
        columns: [
          { key: 'name', header: 'Plugin', width: 38 },
          { key: 'version', header: 'Version', width: 14 },
          { key: 'type', header: 'Type', width: 12 },
          { key: 'downloads', header: 'Downloads', width: 10, align: 'right' },
          { key: 'rating', header: 'Rating', width: 10, align: 'right' },
          { key: 'trust', header: 'Trust', width: 10 },
        ],
        data: plugins.map(p => {
          const liveRating = realRatings[p.name];
          const ratingDisplay = liveRating && liveRating.count > 0
            ? `${liveRating.average.toFixed(1)}★(${liveRating.count})`
            : `${p.rating.toFixed(1)}★`;
          return {
            name: p.name,
            version: p.version,
            type: p.type,
            downloads: p.downloads.toLocaleString(),
            rating: ratingDisplay,
            trust: p.trustLevel === 'official' ? output.success('Official') :
                   p.trustLevel === 'verified' ? output.highlight('Verified') :
                   p.verified ? output.dim('Community') : output.dim('Unverified'),
          };
        }),
      });

      output.writeln();
      if (ratingsSource === 'unavailable') {
        output.writeln(output.dim('(ratings: cached — cloud unavailable)'));
      }
      output.writeln(output.dim(`Source: ${result.source}${result.fromCache ? ' (cached)' : ''}`));
      if (result.cid) {
        output.writeln(output.dim(`Registry CID: ${result.cid.slice(0, 30)}...`));
      }

      return { success: true, data: plugins };
    } catch (error) {
      spinner.fail('Failed to fetch registry');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Install subcommand - Now fetches from IPFS registry
export const installCommand: Command = {
  name: 'install',
  description: 'Install a plugin from IPFS registry or local path',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name or path', required: true },
    { name: 'version', short: 'v', type: 'string', description: 'Specific version to install' },
    { name: 'global', short: 'g', type: 'boolean', description: 'Install globally' },
    { name: 'dev', short: 'd', type: 'boolean', description: 'Install as dev dependency' },
    { name: 'verify', type: 'boolean', description: 'Verify checksum (default: true)', default: true },
    { name: 'registry', short: 'r', type: 'string', description: 'Registry to use' },
  ],
  examples: [
    { command: 'claude-flow plugins install -n community-analytics', description: 'Install plugin from IPFS' },
    { command: 'claude-flow plugins install -n ./my-plugin --dev', description: 'Install local plugin' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;
    const version = ctx.flags.version as string || 'latest';
    const registryName = ctx.flags.registry as string;
    // `--verify` is documented but the install path always verifies the
    // SHA-256 + signature. Kept the flag for forward-compat once we
    // wire a `--no-verify` escape hatch.

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    // Check if it's a local path
    const isLocalPath = name.startsWith('./') || name.startsWith('/') || name.startsWith('../');

    output.writeln();
    output.writeln(output.bold('Installing Plugin'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({
      text: isLocalPath ? `Installing from ${name}...` : `Discovering ${name} in registry...`,
      spinner: 'dots'
    });
    spinner.start();

    try {
      const manager = getPluginManager();
      await manager.initialize();

      // Check if already installed
      const existingPlugin = await manager.getPlugin(name);
      if (existingPlugin) {
        spinner.fail(`Plugin ${name} is already installed (v${existingPlugin.version})`);
        output.writeln();
        output.writeln(output.dim('Use "claude-flow plugins upgrade -n ' + name + '" to update'));
        return { success: false, exitCode: 1 };
      }

      let result;
      let plugin: PluginEntry | undefined;

      if (isLocalPath) {
        // Install from local path
        spinner.setText(`Installing from ${name}...`);
        result = await manager.installFromLocal(name);
      } else {
        // First, try to find in registry for metadata
        spinner.setText(`Discovering ${name} in registry...`);
        const discovery = createPluginDiscoveryService();
        const registryResult = await discovery.discoverRegistry(registryName);

        if (registryResult.success && registryResult.registry) {
          plugin = registryResult.registry.plugins.find(p => p.name === name || p.id === name);
        }

        if (plugin) {
          spinner.setText(`Found ${plugin.displayName} v${plugin.version}`);
        }

        // Install from npm (since IPFS is demo mode)
        spinner.setText(`Installing ${name} from npm...`);
        result = await manager.installFromNpm(name, version !== 'latest' ? version : undefined);
      }

      if (!result.success) {
        spinner.fail(`Installation failed: ${result.error}`);
        return { success: false, exitCode: 1 };
      }

      const installed = result.plugin!;
      spinner.succeed(`Installed ${installed.name}@${installed.version}`);

      output.writeln();

      const boxContent = [
        `Plugin: ${installed.name}`,
        `Version: ${installed.version}`,
        `Source: ${installed.source}`,
        `Path: ${installed.path || 'N/A'}`,
        ``,
        `Hooks registered: ${installed.hooks?.length || 0}`,
        `Commands added: ${installed.commands?.length || 0}`,
      ];

      if (plugin) {
        boxContent.push(`Trust: ${plugin.trustLevel}`);
        boxContent.push(`Permissions: ${plugin.permissions.join(', ') || 'none'}`);
      }

      output.printBox(boxContent.join('\n'), 'Installation Complete');

      return { success: true, data: installed };
    } catch (error) {
      spinner.fail('Installation failed');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Uninstall subcommand
export const uninstallCommand: Command = {
  name: 'uninstall',
  description: 'Uninstall a plugin',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name', required: true },
    { name: 'force', short: 'f', type: 'boolean', description: 'Force uninstall without confirmation' },
  ],
  examples: [
    { command: 'claude-flow plugins uninstall -n community-analytics', description: 'Uninstall plugin' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    const spinner = output.createSpinner({ text: `Uninstalling ${name}...`, spinner: 'dots' });
    spinner.start();

    try {
      const manager = getPluginManager();
      await manager.initialize();

      // Check if installed
      const plugin = await manager.getPlugin(name);
      if (!plugin) {
        spinner.fail(`Plugin ${name} is not installed`);
        return { success: false, exitCode: 1 };
      }

      // Uninstall
      const result = await manager.uninstall(name);

      if (!result.success) {
        spinner.fail(`Failed to uninstall: ${result.error}`);
        return { success: false, exitCode: 1 };
      }

      spinner.succeed(`Uninstalled ${name}`);
      output.writeln();
      output.writeln(output.dim(`Removed ${plugin.version} from ${manager.getPluginsDir()}`));

      return { success: true };
    } catch (error) {
      spinner.fail('Uninstall failed');
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Enable/Disable subcommand
export const toggleCommand: Command = {
  name: 'toggle',
  description: 'Enable or disable a plugin',
  options: [
    { name: 'name', short: 'n', type: 'string', description: 'Plugin name', required: true },
    { name: 'enable', short: 'e', type: 'boolean', description: 'Enable the plugin' },
    { name: 'disable', short: 'd', type: 'boolean', description: 'Disable the plugin' },
  ],
  examples: [
    { command: 'claude-flow plugins toggle -n analytics --enable', description: 'Enable plugin' },
    { command: 'claude-flow plugins toggle -n analytics --disable', description: 'Disable plugin' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const name = ctx.flags.name as string;
    const enable = ctx.flags.enable as boolean;
    const disable = ctx.flags.disable as boolean;

    if (!name) {
      output.printError('Plugin name is required');
      return { success: false, exitCode: 1 };
    }

    try {
      const manager = getPluginManager();
      await manager.initialize();

      // Check if installed
      const plugin = await manager.getPlugin(name);
      if (!plugin) {
        output.printError(`Plugin ${name} is not installed`);
        return { success: false, exitCode: 1 };
      }

      let result;
      let action: string;
      let newState: boolean;

      if (enable) {
        result = await manager.enable(name);
        action = 'Enabled';
        newState = true;
      } else if (disable) {
        result = await manager.disable(name);
        action = 'Disabled';
        newState = false;
      } else {
        // Toggle
        result = await manager.toggle(name);
        newState = result.enabled ?? !plugin.enabled;
        action = newState ? 'Enabled' : 'Disabled';
      }

      if (!result.success) {
        output.printError(`Failed to toggle: ${result.error}`);
        return { success: false, exitCode: 1 };
      }

      output.writeln();
      output.writeln(output.success(`${action} ${name}`));
      output.writeln(output.dim(`Plugin is now ${newState ? 'enabled' : 'disabled'}`));

      return { success: true, data: { enabled: newState } };
    } catch (error) {
      output.printError(`Error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Info subcommand - Now fetches from IPFS registry

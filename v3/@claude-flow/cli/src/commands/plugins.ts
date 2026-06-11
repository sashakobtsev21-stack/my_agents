/**
 * V3 CLI Plugins Command
 * Plugin management, installation, and lifecycle
 * Now uses IPFS-based decentralized registry for discovery
 *
 * Created with ❤️ by ruv.io
 */


import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
// The nine subcommands were extracted into ./plugins-manage.ts and
// ./plugins-info.ts during campaign-2 wave 14 (W220); all were
// module-private. The public surface (pluginsCommand) stays here.
import {
  installCommand,
  listCommand,
  toggleCommand,
  uninstallCommand,
} from './plugins-manage.js';
import {
  createCommand,
  infoCommand,
  rateCommand,
  searchCommand,
  upgradeCommand,
} from './plugins-info.js';

export const pluginsCommand: Command = {
  name: 'plugins',
  description: 'Plugin management with IPFS-based decentralized registry',
  subcommands: [listCommand, searchCommand, installCommand, uninstallCommand, upgradeCommand, toggleCommand, infoCommand, createCommand, rateCommand],
  examples: [
    { command: 'claude-flow plugins list', description: 'List plugins from IPFS registry' },
    { command: 'claude-flow plugins search -q neural', description: 'Search for plugins' },
    { command: 'claude-flow plugins install -n community-analytics', description: 'Install from IPFS' },
    { command: 'claude-flow plugins create -n my-plugin', description: 'Create new plugin' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Plugin System'));
    output.writeln(output.dim('Decentralized plugin marketplace via IPFS'));
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('list')}      - List plugins from IPFS registry`,
      `${output.highlight('search')}    - Search plugins by query`,
      `${output.highlight('install')}   - Install a plugin from npm or local path`,
      `${output.highlight('uninstall')} - Remove an installed plugin`,
      `${output.highlight('upgrade')}   - Upgrade an installed plugin`,
      `${output.highlight('toggle')}    - Enable or disable a plugin`,
      `${output.highlight('info')}      - Show detailed plugin information`,
      `${output.highlight('create')}    - Scaffold a new plugin project`,
    ]);
    output.writeln();
    output.writeln(output.bold('IPFS-Based Features:'));
    output.printList([
      'Decentralized registry via IPNS for discoverability',
      'Content-addressed storage for integrity verification',
      'Ed25519 signatures for plugin verification',
      'Trust levels: unverified, community, verified, official',
      'Security audit tracking and vulnerability reporting',
    ]);
    output.writeln();
    output.writeln(output.bold('Official Plugins:'));
    output.printList([
      '@claude-flow/neural              - Neural patterns and inference (WASM SIMD)',
      '@claude-flow/security            - Security scanning and CVE detection',
      '@claude-flow/embeddings          - Vector embeddings with hyperbolic support',
      '@claude-flow/claims              - Claims-based authorization',
      '@claude-flow/performance         - Performance profiling and benchmarks',
      '@claude-flow/plugin-gastown-bridge - Gas Town orchestrator integration (WASM-accelerated)',
    ]);
    output.writeln();
    output.writeln(output.dim('Run "claude-flow plugins list --official" to see all official plugins'));
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default pluginsCommand;

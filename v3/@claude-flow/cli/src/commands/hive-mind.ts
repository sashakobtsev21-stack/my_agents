/**
 * V3 CLI Hive Mind Command
 * Queen-led consensus-based multi-agent coordination
 *
 * Updated to support --claude flag for launching interactive Claude Code sessions
 * PR: Fix #955 - Implement --claude flag for hive-mind spawn command
 */

// This file is now a thin registrar: it assembles hiveMindCommand from the
// subcommands + infra extracted into the ./hive-mind/ directory during the
// P3.14 god-file decomposition (W116-W119). Sub-modules:
//   spawn · format · commands-lifecycle · commands-ops · commands-coord
import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
import { initCommand, spawnCommand } from './hive-mind/commands-lifecycle.js';
import { statusCommand, taskCommand, optimizeMemoryCommand } from './hive-mind/commands-ops.js';
import {
  joinCommand,
  leaveCommand,
  consensusCommand,
  broadcastCommand,
  memorySubCommand,
  shutdownCommand,
} from './hive-mind/commands-coord.js';

// Main hive-mind command
export const hiveMindCommand: Command = {
  name: 'hive-mind',
  aliases: ['hive'],
  description: 'Queen-led consensus-based multi-agent coordination',
  subcommands: [initCommand, spawnCommand, statusCommand, taskCommand, joinCommand, leaveCommand, consensusCommand, broadcastCommand, memorySubCommand, optimizeMemoryCommand, shutdownCommand],
  options: [],
  examples: [
    { command: 'claude-flow hive-mind init -t hierarchical-mesh', description: 'Initialize hive' },
    { command: 'claude-flow hive-mind spawn -n 5', description: 'Spawn workers' },
    { command: 'claude-flow hive-mind spawn --claude -o "Build a feature"', description: 'Launch Claude Code with hive mind' },
    { command: 'claude-flow hive-mind task -d "Build feature"', description: 'Submit task' }
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Hive Mind - Consensus-Based Multi-Agent Coordination'));
    output.writeln();
    output.writeln('Usage: claude-flow hive-mind <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('init')}            - Initialize hive mind`,
      `${output.highlight('spawn')}           - Spawn worker agents (use --claude to launch Claude Code)`,
      `${output.highlight('status')}          - Show hive status`,
      `${output.highlight('task')}            - Submit task to hive`,
      `${output.highlight('join')}            - Join an agent to the hive`,
      `${output.highlight('leave')}           - Remove an agent from the hive`,
      `${output.highlight('consensus')}       - Manage consensus proposals`,
      `${output.highlight('broadcast')}       - Broadcast message to workers`,
      `${output.highlight('memory')}          - Access shared memory`,
      `${output.highlight('optimize-memory')} - Optimize patterns and memory`,
      `${output.highlight('shutdown')}        - Shutdown the hive`
    ]);
    output.writeln();
    output.writeln('Features:');
    output.printList([
      'Queen-led hierarchical coordination',
      'Byzantine fault tolerant consensus',
      'HNSW-accelerated pattern matching',
      'Cross-session memory persistence',
      'Automatic load balancing',
      output.success('NEW: --claude flag to launch interactive Claude Code sessions')
    ]);
    output.writeln();
    output.writeln('Quick Start with Claude Code:');
    output.writeln(output.dim('  claude-flow hive-mind init'));
    output.writeln(output.dim('  claude-flow hive-mind spawn -n 5 --claude -o "Your objective here"'));

    return { success: true };
  }
};


export default hiveMindCommand;

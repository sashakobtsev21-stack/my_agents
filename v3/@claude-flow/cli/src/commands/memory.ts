/**
 * V3 CLI Memory Command
 * Memory operations for AgentDB integration
 */

// This file is now a thin registrar: it assembles memoryCommand from the
// subcommands extracted into the ./memory/ directory during the P3.10
// god-file decomposition (W99-W103). Sub-modules:
//   helpers · commands-crud · commands-manage · commands-config ·
//   commands-io · commands-init
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { storeCommand, retrieveCommand, searchCommand } from './memory/commands-crud.js';
import { listCommand, deleteCommand, statsCommand } from './memory/commands-manage.js';
import { configureCommand, cleanupCommand, compressCommand } from './memory/commands-config.js';
import { exportCommand, importCommand } from './memory/commands-io.js';
import { initMemoryCommand } from './memory/commands-init.js';

// Main memory command
export const memoryCommand: Command = {
  name: 'memory',
  description: 'Memory management commands',
  subcommands: [initMemoryCommand, storeCommand, retrieveCommand, searchCommand, listCommand, deleteCommand, statsCommand, configureCommand, cleanupCommand, compressCommand, exportCommand, importCommand],
  options: [],
  examples: [
    { command: 'claude-flow memory store -k "key" -v "value"', description: 'Store data' },
    { command: 'claude-flow memory search -q "auth patterns"', description: 'Search memory' },
    { command: 'claude-flow memory stats', description: 'Show statistics' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Memory Management Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow memory <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('init')}       - Initialize memory database (sql.js)`,
      `${output.highlight('store')}      - Store data in memory`,
      `${output.highlight('retrieve')}   - Retrieve data from memory`,
      `${output.highlight('search')}     - Semantic/vector search`,
      `${output.highlight('list')}       - List memory entries`,
      `${output.highlight('delete')}     - Delete memory entry`,
      `${output.highlight('stats')}      - Show statistics`,
      `${output.highlight('configure')}  - Configure backend`,
      `${output.highlight('cleanup')}    - Clean expired entries`,
      `${output.highlight('compress')}   - Compress database`,
      `${output.highlight('export')}     - Export memory to file`,
      `${output.highlight('import')}     - Import from file`
    ]);

    return { success: true };
  }
};

export default memoryCommand;

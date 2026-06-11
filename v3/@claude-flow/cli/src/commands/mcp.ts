/**
 * V3 CLI MCP Command
 * MCP server control and management with real server integration
 *
 * @module @claude-flow/cli/commands/mcp
 * @version 3.0.0
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands extracted into ./mcp-server-cmds.ts and ./mcp-tool-cmds.ts
// during campaign-2 wave 51 (W257).
import { startCommand, statusCommand, stopCommand } from './mcp-server-cmds.js';
import {
  execCommand,
  healthCommand,
  logsCommand,
  restartCommand,
  toggleCommand,
  toolsCommand,
} from './mcp-tool-cmds.js';

export const mcpCommand: Command = {
  name: 'mcp',
  description: 'MCP server management',
  subcommands: [
    startCommand,
    stopCommand,
    statusCommand,
    healthCommand,
    restartCommand,
    toolsCommand,
    toggleCommand,
    execCommand,
    logsCommand
  ],
  options: [],
  examples: [
    { command: 'claude-flow mcp start', description: 'Start MCP server' },
    { command: 'claude-flow mcp start -t http -p 8080', description: 'Start HTTP server on port 8080' },
    { command: 'claude-flow mcp status', description: 'Show server status' },
    { command: 'claude-flow mcp tools', description: 'List tools' },
    { command: 'claude-flow mcp stop', description: 'Stop the server' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('MCP Server Management'));
    output.writeln();
    output.writeln('Usage: claude-flow mcp <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('start')}    - Start MCP server`,
      `${output.highlight('stop')}     - Stop MCP server`,
      `${output.highlight('status')}   - Show server status`,
      `${output.highlight('health')}   - Check server health`,
      `${output.highlight('restart')}  - Restart MCP server`,
      `${output.highlight('tools')}    - List available tools`,
      `${output.highlight('toggle')}   - Enable/disable tools`,
      `${output.highlight('exec')}     - Execute a tool`,
      `${output.highlight('logs')}     - Show server logs`
    ]);

    return { success: true };
  }
};

export default mcpCommand;

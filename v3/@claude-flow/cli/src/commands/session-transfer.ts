/**
 * Session Command — export / import / current subcommands
 *
 * Extracted verbatim from session.ts (lines 504-805) during campaign-2
 * wave 27 (W233). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  formatDuration,
  formatSize,
  formatStatus,
  toSimpleYaml,
} from './session-format.js';

export const exportCommand: Command = {
  name: 'export',
  description: 'Export session to file',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string'
    },
    {
      name: 'format',
      short: 'f',
      description: 'Export format (json, yaml)',
      type: 'string',
      choices: ['json', 'yaml'],
      default: 'json'
    },
    {
      name: 'include-memory',
      description: 'Include memory data',
      type: 'boolean',
      default: true
    },
    {
      name: 'compress',
      description: 'Compress output',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let sessionId = ctx.args[0];
    let outputPath = ctx.flags.output as string;
    const exportFormat = ctx.flags.format as string;
    const compress = ctx.flags.compress as boolean;

    // Get current session if no ID provided
    if (!sessionId) {
      try {
        const current = await callMCPTool<{ sessionId: string }>('session_current', {});
        sessionId = current.sessionId;
      } catch {
        output.printError('No active session. Provide a session ID to export.');
        return { success: false, exitCode: 1 };
      }
    }

    // Generate output path if not provided
    if (!outputPath) {
      const ext = compress ? '.gz' : '';
      outputPath = `session-${sessionId}.${exportFormat}${ext}`;
    }

    const spinner = output.createSpinner({ text: 'Exporting session...' });
    spinner.start();

    try {
      const result = await callMCPTool<{
        sessionId: string;
        data: unknown;
        stats?: {
          agents?: number;
          agentCount?: number;
          tasks?: number;
          taskCount?: number;
          memoryEntries?: number;
        };
      }>('session_export', {
        sessionId,
        includeMemory: ctx.flags['include-memory'] !== false
      });

      // Format output
      let content: string;
      if (exportFormat === 'yaml') {
        content = toSimpleYaml(result.data);
      } else {
        content = JSON.stringify(result.data, null, 2);
      }

      // Write to file
      const absolutePath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(ctx.cwd, outputPath);

      fs.writeFileSync(absolutePath, content, 'utf-8');

      spinner.succeed('Session exported');
      output.writeln();

      const exportStats = result.stats || {};
      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 18 },
          { key: 'value', header: 'Value', width: 40 }
        ],
        data: [
          { property: 'Session ID', value: sessionId },
          { property: 'Output File', value: absolutePath },
          { property: 'Format', value: exportFormat.toUpperCase() },
          { property: 'Agents', value: exportStats.agentCount ?? exportStats.agents ?? 0 },
          { property: 'Tasks', value: exportStats.taskCount ?? exportStats.tasks ?? 0 },
          { property: 'Memory Entries', value: exportStats.memoryEntries ?? 0 },
          { property: 'File Size', value: formatSize(content.length) }
        ]
      });

      output.writeln();
      output.printSuccess(`Session exported to ${outputPath}`);

      return {
        success: true,
        data: { sessionId, outputPath, format: exportFormat, size: content.length }
      };
    } catch (error) {
      spinner.fail('Failed to export session');
      if (error instanceof MCPClientError) {
        output.printError(`Error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Import subcommand
export const importCommand: Command = {
  name: 'import',
  description: 'Import session from file',
  options: [
    {
      name: 'name',
      short: 'n',
      description: 'Session name for imported session',
      type: 'string'
    },
    {
      name: 'activate',
      description: 'Activate session after import',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const filePath = ctx.args[0];
    const sessionName = ctx.flags.name as string;
    const activate = ctx.flags.activate as boolean;

    if (!filePath) {
      output.printError('File path is required');
      return { success: false, exitCode: 1 };
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(ctx.cwd, filePath);

    if (!fs.existsSync(absolutePath)) {
      output.printError(`File not found: ${absolutePath}`);
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Importing session...' });
    spinner.start();

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      let data: unknown;

      // Parse based on extension
      if (absolutePath.endsWith('.yaml') || absolutePath.endsWith('.yml')) {
        // Simple YAML parsing (basic implementation)
        data = JSON.parse(content); // Would need proper YAML parser
      } else {
        data = JSON.parse(content);
      }

      const result = await callMCPTool<{
        sessionId: string;
        name: string;
        importedAt: string;
        stats: {
          agentsImported: number;
          tasksImported: number;
          memoryEntriesImported: number;
        };
        activated: boolean;
      }>('session_import', {
        data,
        name: sessionName,
        activate
      });

      spinner.succeed('Session imported');
      output.writeln();

      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 20 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Session ID', value: result.sessionId },
          { property: 'Name', value: result.name },
          { property: 'Source File', value: path.basename(absolutePath) },
          { property: 'Agents Imported', value: result.stats.agentsImported },
          { property: 'Tasks Imported', value: result.stats.tasksImported },
          { property: 'Memory Entries', value: result.stats.memoryEntriesImported },
          { property: 'Activated', value: result.activated ? 'Yes' : 'No' }
        ]
      });

      output.writeln();
      output.printSuccess(`Session imported: ${result.sessionId}`);

      if (!result.activated) {
        output.printInfo(`Restore with: claude-flow session restore ${result.sessionId}`);
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Failed to import session');
      if (error instanceof MCPClientError) {
        output.printError(`Error: ${error.message}`);
      } else if (error instanceof SyntaxError) {
        output.printError('Invalid file format. Expected JSON or YAML.');
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Current subcommand
export const currentCommand: Command = {
  name: 'current',
  description: 'Show current active session',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await callMCPTool<{
        sessionId: string;
        name?: string;
        status: string;
        startedAt: string;
        stats?: {
          agents?: number;
          agentCount?: number;
          tasks?: number;
          taskCount?: number;
          memoryEntries?: number;
          duration?: number;
        };
      }>('session_current', { includeStats: true });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Current Session'));
      output.writeln();

      const curStats = result.stats || {};
      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 18 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Session ID', value: result.sessionId },
          { property: 'Name', value: result.name || '-' },
          { property: 'Status', value: formatStatus(result.status) },
          { property: 'Started', value: new Date(result.startedAt).toLocaleString() },
          { property: 'Duration', value: formatDuration(curStats.duration ?? 0) },
          { property: 'Agents', value: curStats.agentCount ?? curStats.agents ?? 0 },
          { property: 'Tasks', value: curStats.taskCount ?? curStats.tasks ?? 0 },
          { property: 'Memory Entries', value: curStats.memoryEntries ?? 0 }
        ]
      });

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printWarning('No active session');
        output.printInfo('Start a session with "claude-flow start"');
        return { success: true, data: { active: false } };
      }
      output.printError(`Unexpected error: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Helper functions

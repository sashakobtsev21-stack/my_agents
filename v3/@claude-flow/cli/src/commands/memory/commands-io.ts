/**
 * Memory file I/O subcommands — export to / import from disk via the
 * memory_export / memory_import MCP tools.
 *
 *   - exportCommand  (json/csv/binary export, optional vectors)
 *   - importCommand  (merge-or-replace import)
 *
 * Extracted from memory.ts (W103, P3.10 cut #5).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';

// Export command
export const exportCommand: Command = {
  name: 'export',
  description: 'Export memory to file',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
      required: true
    },
    {
      name: 'format',
      short: 'f',
      description: 'Export format (json, csv, binary)',
      type: 'string',
      choices: ['json', 'csv', 'binary'],
      default: 'json'
    },
    {
      name: 'namespace',
      short: 'n',
      description: 'Export specific namespace',
      type: 'string'
    },
    {
      name: 'include-vectors',
      description: 'Include vector embeddings',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow memory export -o ./backup.json', description: 'Export all to JSON' },
    { command: 'claude-flow memory export -o ./data.csv -f csv', description: 'Export to CSV' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const outputPath = ctx.flags.output as string;
    const format = ctx.flags.format as string || 'json';

    if (!outputPath) {
      output.printError('Output path is required. Use --output or -o');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Exporting memory to ${outputPath}...`);

    try {
      const result = await callMCPTool<{
        outputPath: string;
        format: string;
        exported: {
          entries: number;
          vectors: number;
          patterns: number;
        };
        fileSize: string;
      }>('memory_export', {
        outputPath,
        format,
        namespace: ctx.flags.namespace,
        includeVectors: ctx.flags.includeVectors ?? true,
      });

      output.printSuccess(`Exported to ${result.outputPath}`);
      output.printList([
        `Entries: ${result.exported.entries}`,
        `Vectors: ${result.exported.vectors}`,
        `Patterns: ${result.exported.patterns}`,
        `File size: ${result.fileSize}`
      ]);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Export error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Import command
export const importCommand: Command = {
  name: 'import',
  description: 'Import memory from file',
  options: [
    {
      name: 'input',
      short: 'i',
      description: 'Input file path',
      type: 'string',
      required: true
    },
    {
      name: 'merge',
      short: 'm',
      description: 'Merge with existing (skip duplicates)',
      type: 'boolean',
      default: true
    },
    {
      name: 'namespace',
      short: 'n',
      description: 'Import into specific namespace',
      type: 'string'
    }
  ],
  examples: [
    { command: 'claude-flow memory import -i ./backup.json', description: 'Import from file' },
    { command: 'claude-flow memory import -i ./data.json -n archive', description: 'Import to namespace' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const inputPath = ctx.flags.input as string || ctx.args[0];

    if (!inputPath) {
      output.printError('Input path is required. Use --input or -i');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Importing memory from ${inputPath}...`);

    try {
      const result = await callMCPTool<{
        inputPath: string;
        imported: {
          entries: number;
          vectors: number;
          patterns: number;
        };
        skipped: number;
        duration: number;
      }>('memory_import', {
        inputPath,
        merge: ctx.flags.merge ?? true,
        namespace: ctx.flags.namespace,
      });

      output.printSuccess(`Imported from ${result.inputPath}`);
      output.printList([
        `Entries: ${result.imported.entries}`,
        `Vectors: ${result.imported.vectors}`,
        `Patterns: ${result.imported.patterns}`,
        `Skipped (duplicates): ${result.skipped}`,
        `Duration: ${result.duration}ms`
      ]);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Import error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

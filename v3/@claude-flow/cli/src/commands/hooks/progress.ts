/**
 * `claude-flow hooks progress` — check V3 implementation progress via the MCP
 * `progress_check` / `progress_sync` / `progress_summary` tools.
 *
 * Pilot extraction (issue #7) from hooks.ts. Self-contained: depends only on
 * the Command/output contract and the MCP client.
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';

export const progressHookCommand: Command = {
  name: 'progress',
  description: 'Check V3 implementation progress via hooks',
  options: [
    { name: 'detailed', short: 'd', description: 'Show detailed breakdown by category', type: 'boolean', default: false },
    { name: 'sync', short: 's', description: 'Sync and persist progress to file', type: 'boolean', default: false },
    { name: 'summary', description: 'Show human-readable summary', type: 'boolean', default: false },
  ],
  examples: [
    { command: 'claude-flow hooks progress', description: 'Check current progress' },
    { command: 'claude-flow hooks progress -d', description: 'Detailed breakdown' },
    { command: 'claude-flow hooks progress --sync', description: 'Sync progress to file' },
    { command: 'claude-flow hooks progress --summary', description: 'Human-readable summary' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const detailed = ctx.flags.detailed as boolean;
    const sync = ctx.flags.sync as boolean;
    const summary = ctx.flags.summary as boolean;

    try {
      if (summary) {
        const spinner = output.createSpinner({ text: 'Getting progress summary...' });
        spinner.start();
        const result = await callMCPTool<{ summary: string }>('progress_summary', {});
        spinner.stop();

        if (ctx.flags.format === 'json') {
          output.printJson(result);
          return { success: true, data: result };
        }

        output.writeln();
        output.writeln(result.summary);
        return { success: true, data: result };
      }

      if (sync) {
        const spinner = output.createSpinner({ text: 'Syncing progress...' });
        spinner.start();
        const result = await callMCPTool<{
          progress: number;
          message: string;
          persisted: boolean;
          lastUpdated: string;
        }>('progress_sync', {});
        spinner.stop();

        if (ctx.flags.format === 'json') {
          output.printJson(result);
          return { success: true, data: result };
        }

        output.writeln();
        output.printSuccess(`Progress synced: ${result.progress}%`);
        output.writeln(output.dim(`  Persisted to .claude-flow/metrics/v3-progress.json`));
        output.writeln(output.dim(`  Last updated: ${result.lastUpdated}`));
        return { success: true, data: result };
      }

      // Default: check progress.
      const spinner = output.createSpinner({ text: 'Checking V3 progress...' });
      spinner.start();
      const result = await callMCPTool<{
        progress?: number;
        overall?: number;
        summary?: string;
        breakdown?: Record<string, string>;
        cli?: { progress: number; commands: number; target: number };
        mcp?: { progress: number; tools: number; target: number };
        hooks?: { progress: number; subcommands: number; target: number };
        packages?: { progress: number; total: number; target: number; withDDD: number };
        ddd?: { progress: number };
        codebase?: { totalFiles: number; totalLines: number };
        lastUpdated?: string;
      }>('progress_check', { detailed });
      spinner.stop();

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      const progressValue = result.overall ?? result.progress ?? 0;

      // Create progress bar.
      const barWidth = 30;
      const filled = Math.round((progressValue / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = output.success('█'.repeat(filled)) + output.dim('░'.repeat(empty));

      output.writeln(output.bold('V3 Implementation Progress'));
      output.writeln();
      output.writeln(`[${bar}] ${progressValue}%`);
      output.writeln();

      if (detailed && result.cli) {
        output.writeln(output.highlight('CLI Commands:') + `     ${result.cli.progress}% (${result.cli.commands}/${result.cli.target})`);
        output.writeln(output.highlight('MCP Tools:') + `        ${result.mcp?.progress ?? 0}% (${result.mcp?.tools ?? 0}/${result.mcp?.target ?? 0})`);
        output.writeln(output.highlight('Hooks:') + `            ${result.hooks?.progress ?? 0}% (${result.hooks?.subcommands ?? 0}/${result.hooks?.target ?? 0})`);
        output.writeln(output.highlight('Packages:') + `         ${result.packages?.progress ?? 0}% (${result.packages?.total ?? 0}/${result.packages?.target ?? 0})`);
        output.writeln(output.highlight('DDD Structure:') + `    ${result.ddd?.progress ?? 0}% (${result.packages?.withDDD ?? 0}/${result.packages?.total ?? 0})`);
        output.writeln();
        if (result.codebase) {
          output.writeln(output.dim(`Codebase: ${result.codebase.totalFiles} files, ${result.codebase.totalLines.toLocaleString()} lines`));
        }
      } else if (result.breakdown) {
        output.writeln('Breakdown:');
        for (const [category, value] of Object.entries(result.breakdown)) {
          output.writeln(`  ${output.highlight(category)}: ${value}`);
        }
      }

      if (result.lastUpdated) {
        output.writeln(output.dim(`Last updated: ${result.lastUpdated}`));
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Progress check failed: ${error.message}`);
      } else {
        output.printError(`Progress check failed: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  },
};

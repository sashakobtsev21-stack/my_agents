/**
 * Coverage-aware routing subcommands for `claude-flow hooks`:
 *  - coverage-route   route a task to agents weighted by test coverage gaps
 *  - coverage-suggest suggest specific tests to write
 *  - coverage-gaps    list every gap with priority
 *
 * Pilot extraction (issue #7) — three top-level subcommands that share the
 * coverage-reader helpers. Same shape as the worker.ts slice.
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool } from '../../mcp-client.js';
import {
  readCoverageFromDisk,
  classifyCoverageGap,
  suggestAgentsForFile,
} from './coverage-reader.js';

export const coverageRouteCommand: Command = {
  name: 'coverage-route',
  description: 'Route task to agents based on test coverage gaps (ruvector integration)',
  options: [
    {
      name: 'task',
      short: 't',
      description: 'Task description to route',
      type: 'string',
      required: true
    },
    {
      name: 'threshold',
      description: 'Coverage threshold percentage (default: 80)',
      type: 'number',
      default: 80
    },
    {
      name: 'no-ruvector',
      description: 'Disable ruvector integration',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow hooks coverage-route -t "fix bug in auth"', description: 'Route with coverage awareness' },
    { command: 'claude-flow hooks coverage-route -t "add tests" --threshold 90', description: 'Route with custom threshold' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const task = (ctx.flags.task as string) || ctx.args[0];
    const threshold = ctx.flags.threshold as number || 80;
    const useRuvector = !ctx.flags['no-ruvector'];

    if (!task) {
      output.printError('Task description is required. Use --task or -t flag.');
      return { success: false, exitCode: 1 };
    }

    const spinner = output.createSpinner({ text: 'Analyzing coverage and routing task...' });
    spinner.start();

    // Try reading coverage from disk first
    const diskCoverage = readCoverageFromDisk();

    if (diskCoverage.found) {
      spinner.succeed(`Coverage data loaded from ${diskCoverage.source}`);

      // Find files with lowest coverage that may relate to the task
      const taskLower = task.toLowerCase();
      const taskWords = taskLower.split(/\s+/).filter(w => w.length > 2);

      // Score each file by relevance to the task and how low its coverage is
      const scoredFiles = diskCoverage.entries
        .filter(e => e.lines < threshold)
        .map(e => {
          const fileNameLower = e.filePath.toLowerCase();
          let relevance = 0;
          for (const word of taskWords) {
            if (fileNameLower.includes(word)) relevance += 2;
          }
          // Penalize high coverage (we care about low coverage)
          const coveragePenalty = e.lines / 100;
          return { ...e, relevance, score: relevance + (1 - coveragePenalty) };
        })
        .sort((a, b) => b.score - a.score);

      const gaps = scoredFiles.slice(0, 8).map(e => {
        const { gapType, priority } = classifyCoverageGap(e.lines, threshold);
        return {
          filePath: e.filePath,
          coveragePercent: e.lines,
          gapType,
          priority,
          suggestedAgents: suggestAgentsForFile(e.filePath),
          reason: `${e.lines.toFixed(1)}% coverage, below ${threshold}%`,
        };
      });

      const criticalGaps = gaps.filter(g => g.gapType === 'critical').length;
      const primaryAgent = taskLower.includes('test') ? 'tester' :
                           taskLower.includes('security') || taskLower.includes('auth') ? 'security-auditor' :
                           taskLower.includes('fix') || taskLower.includes('bug') ? 'coder' : 'tester';

      const suggestions: string[] = [];
      if (criticalGaps > 0) suggestions.push(`${criticalGaps} critical coverage gaps need immediate attention`);
      if (diskCoverage.summary.overallLineCoverage < threshold) {
        suggestions.push(`Overall line coverage (${diskCoverage.summary.overallLineCoverage.toFixed(1)}%) is below ${threshold}% threshold`);
      }
      if (scoredFiles.length > 8) suggestions.push(`${scoredFiles.length - 8} additional files with low coverage`);

      const result = {
        success: true,
        task,
        coverageAware: true,
        gaps,
        routing: {
          primaryAgent,
          confidence: gaps.length > 0 ? 0.85 : 0.6,
          reason: gaps.length > 0
            ? `Routing to ${primaryAgent} based on ${gaps.length} coverage gaps related to task`
            : `No coverage gaps found related to task, routing to ${primaryAgent}`,
          coverageImpact: gaps.length > 0 ? 'high' : 'low',
        },
        suggestions,
        metrics: {
          filesAnalyzed: diskCoverage.summary.totalFiles,
          totalGaps: scoredFiles.length,
          criticalGaps,
          avgCoverage: diskCoverage.summary.overallLineCoverage,
        },
        source: diskCoverage.source,
      };

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `Agent: ${output.highlight(result.routing.primaryAgent)}`,
          `Confidence: ${(result.routing.confidence * 100).toFixed(1)}%`,
          `Coverage-Aware: ${output.success('Yes')} (from ${diskCoverage.source})`,
          `Reason: ${result.routing.reason}`
        ].join('\n'),
        'Coverage-Aware Routing'
      );

      if (gaps.length > 0) {
        output.writeln();
        output.writeln(output.bold('Priority Coverage Gaps'));
        output.printTable({
          columns: [
            { key: 'filePath', header: 'File', width: 35, format: (v: unknown) => {
              const s = String(v);
              return s.length > 32 ? '...' + s.slice(-32) : s;
            }},
            { key: 'coveragePercent', header: 'Coverage', width: 10, align: 'right', format: (v: unknown) => `${Number(v).toFixed(1)}%` },
            { key: 'gapType', header: 'Type', width: 10 },
            { key: 'suggestedAgents', header: 'Agent', width: 15, format: (v: unknown) => Array.isArray(v) ? v[0] || '' : String(v) }
          ],
          data: gaps.slice(0, 8)
        });
      }

      if (result.metrics.filesAnalyzed > 0) {
        output.writeln();
        output.writeln(output.bold('Coverage Metrics'));
        output.printList([
          `Files Analyzed: ${result.metrics.filesAnalyzed}`,
          `Total Gaps: ${result.metrics.totalGaps}`,
          `Critical Gaps: ${result.metrics.criticalGaps}`,
          `Average Coverage: ${result.metrics.avgCoverage.toFixed(1)}%`
        ]);
      }

      if (suggestions.length > 0) {
        output.writeln();
        output.writeln(output.bold('Suggestions'));
        output.printList(suggestions.map(s => output.dim(s)));
      }

      return { success: true, data: result };
    }

    // No disk coverage - fall back to MCP tool
    try {
      const result = await callMCPTool<{
        success: boolean;
        task: string;
        coverageAware: boolean;
        gaps: Array<{
          filePath: string;
          coveragePercent: number;
          gapType: string;
          priority: number;
          suggestedAgents: string[];
          reason: string;
        }>;
        routing: {
          primaryAgent: string;
          confidence: number;
          reason: string;
          coverageImpact: string;
        };
        suggestions: string[];
        metrics: {
          filesAnalyzed: number;
          totalGaps: number;
          criticalGaps: number;
          avgCoverage: number;
        };
      }>('hooks_coverage-route', {
        task,
        threshold,
        useRuvector,
      });

      spinner.stop();

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `Agent: ${output.highlight(result.routing.primaryAgent)}`,
          `Confidence: ${(result.routing.confidence * 100).toFixed(1)}%`,
          `Coverage-Aware: ${result.coverageAware ? output.success('Yes') : output.dim('No coverage data')}`,
          `Reason: ${result.routing.reason}`
        ].join('\n'),
        'Coverage-Aware Routing'
      );

      if (result.gaps.length > 0) {
        output.writeln();
        output.writeln(output.bold('Priority Coverage Gaps'));
        output.printTable({
          columns: [
            { key: 'filePath', header: 'File', width: 35, format: (v: unknown) => {
              const s = String(v);
              return s.length > 32 ? '...' + s.slice(-32) : s;
            }},
            { key: 'coveragePercent', header: 'Coverage', width: 10, align: 'right', format: (v: unknown) => `${Number(v).toFixed(1)}%` },
            { key: 'gapType', header: 'Type', width: 10 },
            { key: 'suggestedAgents', header: 'Agent', width: 15, format: (v: unknown) => Array.isArray(v) ? v[0] || '' : String(v) }
          ],
          data: result.gaps.slice(0, 8)
        });
      }

      if (result.metrics.filesAnalyzed > 0) {
        output.writeln();
        output.writeln(output.bold('Coverage Metrics'));
        output.printList([
          `Files Analyzed: ${result.metrics.filesAnalyzed}`,
          `Total Gaps: ${result.metrics.totalGaps}`,
          `Critical Gaps: ${result.metrics.criticalGaps}`,
          `Average Coverage: ${result.metrics.avgCoverage.toFixed(1)}%`
        ]);
      }

      if (result.suggestions.length > 0) {
        output.writeln();
        output.writeln(output.bold('Suggestions'));
        output.printList(result.suggestions.map(s => output.dim(s)));
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('No coverage data found');
      output.writeln();
      output.printWarning('No coverage data found. Run your test suite with coverage first.');
      output.writeln();
      output.printList([
        'Jest:     npx jest --coverage',
        'Vitest:   npx vitest --coverage',
        'nyc:      npx nyc npm test',
        'c8:       npx c8 npm test',
      ]);
      output.writeln();
      output.writeln(output.dim('Expected files: coverage/coverage-summary.json, coverage/lcov.info, or .nyc_output/out.json'));
      return { success: false, exitCode: 1 };
    }
  }
};

// Coverage suggest subcommand

// The suggest/gaps subcommands were extracted into ./coverage-suggest.ts
// and ./coverage-gaps.ts during campaign-2 wave 63 (W269).
export { coverageSuggestCommand } from './coverage-suggest.js';
export { coverageGapsCommand } from './coverage-gaps.js';

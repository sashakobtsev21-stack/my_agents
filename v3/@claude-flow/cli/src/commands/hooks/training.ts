/**
 * `claude-flow hooks pretrain` + `build-agents` — bootstrap the
 * intelligence layer from the repo + generate agent configs from
 * the learned patterns.
 *
 * Pilot extraction (issue #7).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';
import { safeNum } from './helpers.js';

export const pretrainCommand: Command = {
  name: 'pretrain',
  description: 'Bootstrap intelligence from repository (4-step pipeline + embeddings)',
  options: [
    {
      name: 'path',
      short: 'p',
      description: 'Repository path',
      type: 'string',
      default: '.'
    },
    {
      name: 'depth',
      short: 'd',
      description: 'Analysis depth (shallow, medium, deep)',
      type: 'string',
      default: 'medium',
      choices: ['shallow', 'medium', 'deep']
    },
    {
      name: 'skip-cache',
      description: 'Skip cached analysis',
      type: 'boolean',
      default: false
    },
    {
      name: 'with-embeddings',
      description: 'Index documents for semantic search during pretraining',
      type: 'boolean',
      default: true
    },
    {
      name: 'embedding-model',
      description: 'ONNX embedding model',
      type: 'string',
      default: 'Xenova/all-MiniLM-L6-v2',
      choices: ['Xenova/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2']
    },
    {
      name: 'file-types',
      description: 'File extensions to index (comma-separated)',
      type: 'string',
      default: 'ts,js,py,md,json'
    }
  ],
  examples: [
    { command: 'claude-flow hooks pretrain', description: 'Pretrain with embeddings indexing' },
    { command: 'claude-flow hooks pretrain -p ../my-project --depth deep', description: 'Deep analysis of specific project' },
    { command: 'claude-flow hooks pretrain --no-with-embeddings', description: 'Skip embedding indexing' },
    { command: 'claude-flow hooks pretrain --file-types ts,tsx,js', description: 'Index only TypeScript/JS files' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const repoPath = ctx.flags.path as string || '.';
    const depth = ctx.flags.depth as string || 'medium';
    const withEmbeddings = ctx.flags['with-embeddings'] !== false && ctx.flags.withEmbeddings !== false;
    const embeddingModel = (ctx.flags['embedding-model'] || ctx.flags.embeddingModel || 'Xenova/all-MiniLM-L6-v2') as string;
    const fileTypes = (ctx.flags['file-types'] || ctx.flags.fileTypes || 'ts,js,py,md,json') as string;

    output.writeln();
    output.writeln(output.bold('Pretraining Intelligence (4-Step Pipeline + Embeddings)'));
    output.writeln();

    const steps = [
      { name: 'RETRIEVE', desc: 'Top-k memory injection with MMR diversity' },
      { name: 'JUDGE', desc: 'LLM-as-judge trajectory evaluation' },
      { name: 'DISTILL', desc: 'Extract strategy memories from trajectories' },
      { name: 'CONSOLIDATE', desc: 'Dedup, detect contradictions, prune old patterns' }
    ];

    // Add embedding steps if enabled
    if (withEmbeddings) {
      steps.push(
        { name: 'EMBED', desc: `Index documents with ${embeddingModel} (ONNX)` },
        { name: 'HYPERBOLIC', desc: 'Project to Poincaré ball for hierarchy preservation' }
      );
    }

    const spinner = output.createSpinner({ text: 'Starting pretraining...', spinner: 'dots' });

    try {
      spinner.start();

      // Display progress for each step
      for (const step of steps) {
        spinner.setText(`${step.name}: ${step.desc}`);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Call MCP tool for pretraining. The tool currently returns
      // `{ statistics: { ..., executionTime }, ... }` but earlier CLI
      // versions read `result.stats` and `result.duration` (#1686). Accept
      // either shape so the dashboard works whether you upgraded the tool
      // or the CLI first.
      const rawResult = await callMCPTool<{
        path?: string;
        depth?: string;
        stats?: {
          filesAnalyzed?: number;
          patternsExtracted?: number;
          strategiesLearned?: number;
          trajectoriesEvaluated?: number;
          contradictionsResolved?: number;
          documentsIndexed?: number;
          embeddingsGenerated?: number;
          hyperbolicProjections?: number;
        };
        statistics?: {
          filesAnalyzed?: number;
          patternsExtracted?: number;
          strategiesLearned?: number;
          trajectoriesEvaluated?: number;
          contradictionsResolved?: number;
          documentsIndexed?: number;
          embeddingsGenerated?: number;
          hyperbolicProjections?: number;
          executionTime?: number;
        };
        duration?: number;
      }>('hooks_pretrain', {
        path: repoPath,
        depth,
        skipCache: ctx.flags.skipCache || false,
        withEmbeddings,
        embeddingModel,
        fileTypes: fileTypes.split(',').map((t: string) => t.trim()),
      });

      spinner.succeed('Pretraining completed');

      // Normalize shape: prefer `statistics`, fall back to `stats` for older tools.
      // #1686 — coerce duration through safeNum so a NaN from the underlying
      // pretrain pipeline surfaces as `0.0s` rather than `NaNs`.
      const stats = (rawResult.statistics ?? rawResult.stats ?? {}) as Record<string, number | undefined>;
      const durationMs = safeNum(rawResult.duration ?? rawResult.statistics?.executionTime);
      const result = { ...rawResult, stats, duration: durationMs };

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();

      // Base stats — use ?? 0 fallbacks to keep the table readable even when
      // the tool omits a counter rather than crashing on undefined.
      const tableData: Array<{ metric: string; value: string | number }> = [
        { metric: 'Files Analyzed', value: stats.filesAnalyzed ?? 0 },
        { metric: 'Patterns Extracted', value: stats.patternsExtracted ?? 0 },
        { metric: 'Strategies Learned', value: stats.strategiesLearned ?? 0 },
        { metric: 'Trajectories Evaluated', value: stats.trajectoriesEvaluated ?? 0 },
        { metric: 'Contradictions Resolved', value: stats.contradictionsResolved ?? 0 },
      ];

      // Add embedding stats if available
      if (withEmbeddings && stats.documentsIndexed !== undefined) {
        tableData.push(
          { metric: 'Documents Indexed', value: stats.documentsIndexed },
          { metric: 'Embeddings Generated', value: stats.embeddingsGenerated ?? 0 },
          { metric: 'Hyperbolic Projections', value: stats.hyperbolicProjections ?? 0 }
        );
      }

      tableData.push({ metric: 'Duration', value: `${(durationMs / 1000).toFixed(1)}s` });

      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 30 },
          { key: 'value', header: 'Value', width: 15, align: 'right' }
        ],
        data: tableData
      });

      output.writeln();
      output.printSuccess('Repository intelligence bootstrapped successfully');
      if (withEmbeddings) {
        output.writeln(output.dim('  Semantic search enabled: Use "embeddings search -q <query>" to search'));
      }
      output.writeln(output.dim('  Next step: Run "claude-flow hooks build-agents" to generate optimized configs'));

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Pretraining failed');
      if (error instanceof MCPClientError) {
        output.printError(`Pretraining error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Build agents subcommand
export const buildAgentsCommand: Command = {
  name: 'build-agents',
  description: 'Generate optimized agent configs from pretrain data',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output directory for agent configs',
      type: 'string',
      default: './agents'
    },
    {
      name: 'focus',
      short: 'f',
      description: 'Focus area (v3-implementation, security, performance, all)',
      type: 'string',
      default: 'all'
    },
    {
      name: 'config-format',
      description: 'Config format (yaml, json)',
      type: 'string',
      default: 'yaml',
      choices: ['yaml', 'json']
    }
  ],
  examples: [
    { command: 'claude-flow hooks build-agents', description: 'Build all agent configs' },
    { command: 'claude-flow hooks build-agents --focus security -o ./config/agents', description: 'Build security-focused configs' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const output_dir = ctx.flags.output as string || './agents';
    const focus = ctx.flags.focus as string || 'all';
    const configFormat = ctx.flags.configFormat as string || 'yaml';

    output.printInfo(`Building agent configs (focus: ${output.highlight(focus)})`);

    const spinner = output.createSpinner({ text: 'Generating configs...', spinner: 'dots' });

    try {
      spinner.start();

      // Call MCP tool for building agents
      const result = await callMCPTool<{
        outputDir: string;
        focus: string;
        agents: Array<{
          type: string;
          configFile: string;
          capabilities: string[];
          optimizations: string[];
        }>;
        stats: {
          configsGenerated: number;
          patternsApplied: number;
          optimizationsIncluded: number;
        };
      }>('hooks_build-agents', {
        outputDir: output_dir,
        focus,
        format: configFormat,
        includePretrained: true,
      });

      spinner.succeed(`Generated ${result.agents.length} agent configs`);

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Generated Agent Configs'));
      output.printTable({
        columns: [
          { key: 'type', header: 'Agent Type', width: 20 },
          { key: 'configFile', header: 'Config File', width: 30 },
          { key: 'capabilities', header: 'Capabilities', width: 10, align: 'right', format: (v) => String(Array.isArray(v) ? v.length : 0) }
        ],
        data: result.agents
      });

      output.writeln();
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 30 },
          { key: 'value', header: 'Value', width: 15, align: 'right' }
        ],
        data: [
          { metric: 'Configs Generated', value: result.stats.configsGenerated },
          { metric: 'Patterns Applied', value: result.stats.patternsApplied },
          { metric: 'Optimizations Included', value: result.stats.optimizationsIncluded }
        ]
      });

      output.writeln();
      output.printSuccess(`Agent configs saved to ${output_dir}`);

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Agent config generation failed');
      if (error instanceof MCPClientError) {
        output.printError(`Build agents error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

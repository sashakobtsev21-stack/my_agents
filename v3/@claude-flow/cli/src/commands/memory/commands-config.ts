/**
 * Memory configuration / maintenance subcommands.
 *
 *   - configureCommand  (select + persist the memory backend + HNSW params)
 *   - cleanupCommand    (memory_cleanup: expired/stale/low-quality purge)
 *   - compressCommand   (compress + optimize memory storage)
 *
 * Extracted from memory.ts (W102, P3.10 cut #4).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { select, confirm } from '../../prompt.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';
import { BACKENDS } from './helpers.js';

// Configure command
export const configureCommand: Command = {
  name: 'configure',
  aliases: ['config'],
  description: 'Configure memory backend',
  options: [
    {
      name: 'backend',
      short: 'b',
      description: 'Memory backend',
      type: 'string',
      choices: BACKENDS.map(b => b.value)
    },
    {
      name: 'path',
      description: 'Storage path',
      type: 'string'
    },
    {
      name: 'cache-size',
      description: 'Cache size in MB',
      type: 'number'
    },
    {
      name: 'hnsw-m',
      description: 'HNSW M parameter',
      type: 'number',
      default: 16
    },
    {
      name: 'hnsw-ef',
      description: 'HNSW ef parameter',
      type: 'number',
      default: 200
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let backend = ctx.flags.backend as string;

    if (!backend && ctx.interactive) {
      backend = await select({
        message: 'Select memory backend:',
        options: BACKENDS,
        default: 'hybrid'
      });
    }

    const config = {
      backend: backend || 'hybrid',
      path: ctx.flags.path || './data/memory',
      cacheSize: ctx.flags.cacheSize || 256,
      hnsw: {
        m: ctx.flags.hnswM || 16,
        ef: ctx.flags.hnswEf || 200
      }
    };

    output.writeln();
    output.printInfo('Memory Configuration');
    output.writeln();

    output.printTable({
      columns: [
        { key: 'setting', header: 'Setting', width: 20 },
        { key: 'value', header: 'Value', width: 25 }
      ],
      data: [
        { setting: 'Backend', value: config.backend },
        { setting: 'Storage Path', value: config.path },
        { setting: 'Cache Size', value: `${config.cacheSize} MB` },
        { setting: 'HNSW M', value: config.hnsw.m },
        { setting: 'HNSW ef', value: config.hnsw.ef }
      ]
    });

    output.writeln();
    output.printSuccess('Memory configuration updated');

    return { success: true, data: config };
  }
};

// Cleanup command
export const cleanupCommand: Command = {
  name: 'cleanup',
  description: 'Clean up stale and expired memory entries',
  options: [
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show what would be deleted',
      type: 'boolean',
      default: false
    },
    {
      name: 'older-than',
      short: 'o',
      description: 'Delete entries older than (e.g., "7d", "30d")',
      type: 'string'
    },
    {
      name: 'expired-only',
      short: 'e',
      description: 'Only delete expired TTL entries',
      type: 'boolean',
      default: false
    },
    {
      name: 'low-quality',
      short: 'l',
      description: 'Delete low quality patterns (threshold)',
      type: 'number'
    },
    {
      name: 'namespace',
      short: 'n',
      description: 'Clean specific namespace only',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Skip confirmation',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow memory cleanup --dry-run', description: 'Preview cleanup' },
    { command: 'claude-flow memory cleanup --older-than 30d', description: 'Delete entries older than 30 days' },
    { command: 'claude-flow memory cleanup --expired-only', description: 'Clean expired entries' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const dryRun = ctx.flags.dryRun as boolean;
    const force = ctx.flags.force as boolean;

    if (dryRun) {
      output.writeln(output.warning('DRY RUN - No changes will be made'));
    }

    output.printInfo('Analyzing memory for cleanup...');

    try {
      const result = await callMCPTool<{
        dryRun: boolean;
        candidates: {
          expired: number;
          stale: number;
          lowQuality: number;
          total: number;
        };
        deleted: {
          entries: number;
          vectors: number;
          patterns: number;
        };
        freed: {
          bytes: number;
          formatted: string;
        };
        duration: number;
      }>('memory_cleanup', {
        dryRun,
        olderThan: ctx.flags.olderThan,
        expiredOnly: ctx.flags.expiredOnly,
        lowQualityThreshold: ctx.flags.lowQuality,
        namespace: ctx.flags.namespace,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Cleanup Analysis'));
      output.printTable({
        columns: [
          { key: 'category', header: 'Category', width: 20 },
          { key: 'count', header: 'Count', width: 15, align: 'right' }
        ],
        data: [
          { category: 'Expired (TTL)', count: result.candidates.expired },
          { category: 'Stale (unused)', count: result.candidates.stale },
          { category: 'Low Quality', count: result.candidates.lowQuality },
          { category: output.bold('Total'), count: output.bold(String(result.candidates.total)) }
        ]
      });

      if (!dryRun && result.candidates.total > 0 && !force) {
        const confirmed = await confirm({
          message: `Delete ${result.candidates.total} entries (${result.freed.formatted})?`,
          default: false
        });

        if (!confirmed) {
          output.printInfo('Cleanup cancelled');
          return { success: true, data: result };
        }
      }

      if (!dryRun) {
        output.writeln();
        output.printSuccess(`Cleaned ${result.deleted.entries} entries`);
        output.printList([
          `Vectors removed: ${result.deleted.vectors}`,
          `Patterns removed: ${result.deleted.patterns}`,
          `Space freed: ${result.freed.formatted}`,
          `Duration: ${result.duration}ms`
        ]);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Cleanup error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Compress command
export const compressCommand: Command = {
  name: 'compress',
  description: 'Compress and optimize memory storage',
  options: [
    {
      name: 'level',
      short: 'l',
      description: 'Compression level (fast, balanced, max)',
      type: 'string',
      choices: ['fast', 'balanced', 'max'],
      default: 'balanced'
    },
    {
      name: 'target',
      short: 't',
      description: 'Target (vectors, text, patterns, all)',
      type: 'string',
      choices: ['vectors', 'text', 'patterns', 'all'],
      default: 'all'
    },
    {
      name: 'quantize',
      short: 'z',
      description: 'Enable vector quantization (reduces memory 4-32x)',
      type: 'boolean',
      default: false
    },
    {
      name: 'bits',
      description: 'Quantization bits (4, 8, 16)',
      type: 'number',
      default: 8
    },
    {
      name: 'rebuild-index',
      short: 'r',
      description: 'Rebuild HNSW index after compression',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow memory compress', description: 'Balanced compression' },
    { command: 'claude-flow memory compress --quantize --bits 4', description: '4-bit quantization (32x reduction)' },
    { command: 'claude-flow memory compress -l max -t vectors', description: 'Max compression on vectors' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const level = ctx.flags.level as string || 'balanced';
    const target = ctx.flags.target as string || 'all';
    const quantize = ctx.flags.quantize as boolean;
    const bits = ctx.flags.bits as number || 8;
    const rebuildIndex = ctx.flags.rebuildIndex as boolean ?? true;

    output.writeln();
    output.writeln(output.bold('Memory Compression'));
    output.writeln(output.dim(`Level: ${level}, Target: ${target}, Quantize: ${quantize ? `${bits}-bit` : 'no'}`));
    output.writeln();

    const spinner = output.createSpinner({ text: 'Analyzing current storage...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await callMCPTool<{
        before: {
          totalSize: string;
          vectorsSize: string;
          textSize: string;
          patternsSize: string;
          indexSize: string;
        };
        after: {
          totalSize: string;
          vectorsSize: string;
          textSize: string;
          patternsSize: string;
          indexSize: string;
        };
        compression: {
          ratio: number;
          bytesSaved: number;
          formattedSaved: string;
          quantizationApplied: boolean;
          indexRebuilt: boolean;
        };
        performance: {
          searchLatencyBefore: number;
          searchLatencyAfter: number;
          searchSpeedup: string;
        };
        duration: number;
      }>('memory_compress', {
        level,
        target,
        quantize,
        bits,
        rebuildIndex,
      });

      spinner.succeed('Compression complete');

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Storage Comparison'));
      output.printTable({
        columns: [
          { key: 'category', header: 'Category', width: 15 },
          { key: 'before', header: 'Before', width: 12, align: 'right' },
          { key: 'after', header: 'After', width: 12, align: 'right' },
          { key: 'saved', header: 'Saved', width: 12, align: 'right' }
        ],
        data: [
          { category: 'Vectors', before: result.before.vectorsSize, after: result.after.vectorsSize, saved: '-' },
          { category: 'Text', before: result.before.textSize, after: result.after.textSize, saved: '-' },
          { category: 'Patterns', before: result.before.patternsSize, after: result.after.patternsSize, saved: '-' },
          { category: 'Index', before: result.before.indexSize, after: result.after.indexSize, saved: '-' },
          { category: output.bold('Total'), before: result.before.totalSize, after: result.after.totalSize, saved: output.success(result.compression.formattedSaved) }
        ]
      });

      output.writeln();
      output.printBox(
        [
          `Compression Ratio: ${result.compression.ratio.toFixed(2)}x`,
          `Space Saved: ${result.compression.formattedSaved}`,
          `Quantization: ${result.compression.quantizationApplied ? `Yes (${bits}-bit)` : 'No'}`,
          `Index Rebuilt: ${result.compression.indexRebuilt ? 'Yes' : 'No'}`,
          `Duration: ${(result.duration / 1000).toFixed(1)}s`
        ].join('\n'),
        'Results'
      );

      if (result.performance) {
        output.writeln();
        output.writeln(output.bold('Performance Impact'));
        output.printList([
          `Search latency: ${result.performance.searchLatencyBefore.toFixed(2)}ms → ${result.performance.searchLatencyAfter.toFixed(2)}ms`,
          `Speedup: ${output.success(result.performance.searchSpeedup)}`
        ]);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Compression failed');
      if (error instanceof MCPClientError) {
        output.printError(`Compression error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

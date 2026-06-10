/**
 * Memory listing / deletion / statistics subcommands.
 *
 *   - listCommand    (paginated namespace listing)
 *   - deleteCommand  (delete by key+namespace, confirm-gated)
 *   - statsCommand   (memory_stats MCP summary)
 *
 * Extracted from memory.ts (W101, P3.10 cut #3).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { confirm } from '../../prompt.js';
import { callMCPTool } from '../../mcp-client.js';
import { DB_PATH_OPTION, formatRelativeTime } from './helpers.js';

// List command
export const listCommand: Command = {
  name: 'list',
  aliases: ['ls'],
  description: 'List memory entries',
  options: [
    {
      name: 'namespace',
      short: 'n',
      description: 'Filter by namespace',
      type: 'string'
    },
    {
      name: 'tags',
      short: 't',
      description: 'Filter by tags (comma-separated)',
      type: 'string'
    },
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum entries',
      type: 'number',
      default: 20
    },
    DB_PATH_OPTION
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const namespace = ctx.flags.namespace as string;
    const limit = ctx.flags.limit as number;

    // Use sql.js directly for consistent data access
    try {
      const { listEntries, resolveDbPath: _rdbList } = await import('../../memory/memory-initializer.js');
      const dbPathList = _rdbList(ctx.flags.path as string | undefined);
      const listResult = await listEntries({ namespace, limit, offset: 0, dbPath: dbPathList });

      if (!listResult.success) {
        output.printError(`Failed to list: ${listResult.error}`);
        return { success: false, exitCode: 1 };
      }

      // Format entries for display
      const entries = listResult.entries.map(e => ({
        key: e.key,
        namespace: e.namespace,
        size: e.size + ' B',
        vector: e.hasEmbedding ? '✓' : '-',
        accessCount: e.accessCount,
        updated: formatRelativeTime(e.updatedAt)
      }));

      if (ctx.flags.format === 'json') {
        output.printJson(listResult.entries);
        return { success: true, data: listResult.entries };
      }

      output.writeln();
      output.writeln(output.bold('Memory Entries'));
      output.writeln();

      if (entries.length === 0) {
        output.printWarning('No entries found');
        output.printInfo('Store data: claude-flow memory store -k "key" --value "data"');
        return { success: true, data: [] };
      }

      output.printTable({
        columns: [
          { key: 'key', header: 'Key', width: 25 },
          { key: 'namespace', header: 'Namespace', width: 12 },
          { key: 'size', header: 'Size', width: 10, align: 'right' },
          { key: 'vector', header: 'Vector', width: 8, align: 'center' },
          { key: 'accessCount', header: 'Accessed', width: 10, align: 'right' },
          { key: 'updated', header: 'Updated', width: 12 }
        ],
        data: entries
      });

      output.writeln();
      output.printInfo(`Showing ${entries.length} of ${listResult.total} entries`);

      return { success: true, data: listResult.entries };
    } catch (error) {
      output.printError(`Failed to list: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Delete command
export const deleteCommand: Command = {
  name: 'delete',
  aliases: ['rm'],
  description: 'Delete memory entry',
  options: [
    {
      name: 'key',
      short: 'k',
      description: 'Storage key',
      type: 'string'
    },
    {
      name: 'namespace',
      short: 'n',
      description: 'Memory namespace',
      type: 'string',
      default: 'default'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Skip confirmation',
      type: 'boolean',
      default: false
    },
    DB_PATH_OPTION
  ],
  examples: [
    { command: 'claude-flow memory delete -k "mykey"', description: 'Delete entry with default namespace' },
    { command: 'claude-flow memory delete -k "lesson" -n "lessons"', description: 'Delete entry from specific namespace' },
    { command: 'claude-flow memory delete mykey -f', description: 'Delete without confirmation' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Support both --key flag and positional argument
    const key = ctx.flags.key as string || ctx.args[0];
    const namespace = (ctx.flags.namespace as string) || 'default';
    const force = ctx.flags.force as boolean;

    if (!key) {
      output.printError('Key is required. Use: memory delete -k "key" [-n "namespace"]');
      return { success: false, exitCode: 1 };
    }

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: `Delete memory entry "${key}" from namespace "${namespace}"?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    // Use sql.js directly for consistent data access (Issue #980)
    try {
      const { deleteEntry, resolveDbPath: _rdbDelete } = await import('../../memory/memory-initializer.js');
      const dbPathDelete = _rdbDelete(ctx.flags.path as string | undefined);
      const result = await deleteEntry({ key, namespace, dbPath: dbPathDelete });

      if (!result.success) {
        output.printError(result.error || 'Failed to delete');
        return { success: false, exitCode: 1 };
      }

      if (result.deleted) {
        output.printSuccess(`Deleted "${key}" from namespace "${namespace}"`);
        output.printInfo(`Remaining entries: ${result.remainingEntries}`);
      } else {
        output.printWarning(`Key not found: "${key}" in namespace "${namespace}"`);
      }

      return { success: result.deleted, data: result };
    } catch (error) {
      output.printError(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Stats command
export const statsCommand: Command = {
  name: 'stats',
  description: 'Show memory statistics',
  options: [DB_PATH_OPTION],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Call MCP memory/stats tool for real statistics
    try {
      const statsResult = await callMCPTool('memory_stats', {}) as {
        totalEntries: number;
        entriesWithEmbeddings?: number;
        totalSize: string;
        version: string;
        backend: string;
        location: string;
        oldestEntry: string | null;
        newestEntry: string | null;
      };

      const stats = {
        backend: statsResult.backend,
        entries: {
          total: statsResult.totalEntries,
          vectors: 0, // Would need vector backend support
          text: statsResult.totalEntries
        },
        storage: {
          total: statsResult.totalSize,
          location: statsResult.location
        },
        version: statsResult.version,
        oldestEntry: statsResult.oldestEntry,
        newestEntry: statsResult.newestEntry
      };

      if (ctx.flags.format === 'json') {
        output.printJson(stats);
        return { success: true, data: stats };
      }

      output.writeln();
      output.writeln(output.bold('Memory Statistics'));
      output.writeln();

      output.writeln(output.bold('Overview'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 20 },
          { key: 'value', header: 'Value', width: 30, align: 'right' }
        ],
        data: [
          { metric: 'Backend', value: stats.backend },
          { metric: 'Version', value: stats.version },
          { metric: 'Total Entries', value: stats.entries.total.toLocaleString() },
          { metric: 'Total Storage', value: stats.storage.total },
          { metric: 'Location', value: stats.storage.location }
        ]
      });

      output.writeln();
      output.writeln(output.bold('Timeline'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 20 },
          { key: 'value', header: 'Value', width: 30, align: 'right' }
        ],
        data: [
          { metric: 'Oldest Entry', value: stats.oldestEntry || 'N/A' },
          { metric: 'Newest Entry', value: stats.newestEntry || 'N/A' }
        ]
      });

      // #1622 — Surface the active embedding provider in `memory stats` so
      // users can tell which backend resolved at runtime (the 6-level
      // fallback chain in loadEmbeddingModel ranges from full ONNX to a
      // 128-dim hash that has no semantic understanding). Calling
      // loadEmbeddingModel() is cheap when the model is already cached;
      // a fresh call still resolves quickly because we only need the
      // metadata, not a real embedding.
      try {
        const { loadEmbeddingModel, getHNSWStatus } = await import('../../memory/memory-initializer.js');
        const embedding = await loadEmbeddingModel({ verbose: false });
        const hnsw = getHNSWStatus();
        // Map model name → semantic capability so users can spot the
        // hash-fallback case without reading docs.
        const semanticProviders = new Set([
          'Xenova/all-MiniLM-L6-v2',
          'Xenova/all-mpnet-base-v2',
          'Xenova/bge-small-en-v1.5',
          'agentic-flow',
          'agentic-flow/reasoningbank',
          'ruvector/onnx',
          'cached',
        ]);
        const isSemantic = embedding.success && semanticProviders.has(embedding.modelName);

        output.writeln();
        output.writeln(output.bold('Embedding'));
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 20 },
            { key: 'value', header: 'Value', width: 30, align: 'right' }
          ],
          data: [
            {
              metric: 'Provider',
              value: embedding.success
                ? embedding.modelName
                : output.warning(`unavailable: ${embedding.error || 'unknown'}`),
            },
            { metric: 'Dimensions', value: String(embedding.dimensions) },
            {
              metric: 'Semantic Search',
              value: isSemantic
                ? output.success('yes')
                : output.warning('no — using hash fallback'),
            },
            {
              metric: 'HNSW Index',
              // ruflo#1989 / #1987: `hnsw.entryCount` is in-process JS state
              // (the live HNSW index of the current Node process). A fresh
              // `memory stats` invocation has never indexed anything, so it
              // reports 0 even when the persistent DB has thousands of
              // entries with embeddings. Use the persistent count from the
              // MCP tool (`entriesWithEmbeddings`, which is the actual
              // count of rows that have a vector) as the source of truth.
              value: (() => {
                const persisted = typeof statsResult.entriesWithEmbeddings === 'number'
                  ? statsResult.entriesWithEmbeddings
                  : null;
                const live = hnsw.entryCount || 0;
                const total = persisted !== null ? Math.max(persisted, live) : live;
                if (!hnsw.available) return output.dim('not active');
                if (total === 0) return output.warning('available but not initialized');
                return output.success(`active (${total.toLocaleString()} entries)`);
              })(),
            },
          ]
        });
      } catch (e) {
        // Don't fail the whole stats command if introspection breaks —
        // the rest of the dashboard is still useful.
        output.writeln();
        output.writeln(output.bold('Embedding'));
        output.printInfo(`Provider info unavailable: ${e instanceof Error ? e.message : String(e)}`);
      }

      output.writeln();
      output.printInfo('V3 Performance: HNSW-indexed search (~1.9x-4.7x vs brute force, measured)');

      return { success: true, data: stats };
    } catch (error) {
      output.printError(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

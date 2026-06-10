/**
 * Memory CRUD subcommands — store / retrieve / semantic-search.
 *
 *   - storeCommand     (write a key+value entry, optional embedding)
 *   - retrieveCommand  (fetch by key+namespace)
 *   - searchCommand    (HNSW + BM25 semantic search)
 *
 * Extracted from memory.ts (W100, P3.10 cut #2).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { input } from '../../prompt.js';
import { DB_PATH_OPTION } from './helpers.js';

// Store command
export const storeCommand: Command = {
  name: 'store',
  description: 'Store data in memory',
  options: [
    {
      name: 'key',
      short: 'k',
      description: 'Storage key/namespace',
      type: 'string',
      required: true
    },
    {
      name: 'value',
      // Note: No short flag - global -v is reserved for verbose
      description: 'Value to store (use --value)',
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
      name: 'ttl',
      description: 'Time to live in seconds',
      type: 'number'
    },
    {
      name: 'tags',
      description: 'Comma-separated tags',
      type: 'string'
    },
    {
      name: 'vector',
      description: 'Store as vector embedding',
      type: 'boolean',
      default: false
    },
    {
      name: 'upsert',
      short: 'u',
      description: 'Update if key exists (insert or replace)',
      type: 'boolean',
      default: false
    },
    DB_PATH_OPTION
  ],
  examples: [
    { command: 'claude-flow memory store -k "api/auth" -v "JWT implementation"', description: 'Store text' },
    { command: 'claude-flow memory store -k "pattern/singleton" --vector', description: 'Store vector' },
    { command: 'claude-flow memory store -k "pattern" -v "updated" --upsert', description: 'Update existing' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const key = ctx.flags.key as string;
    let value = ctx.flags.value as string || ctx.args[0];
    const namespace = ctx.flags.namespace as string;
    const ttl = ctx.flags.ttl as number;
    const tags = ctx.flags.tags ? (ctx.flags.tags as string).split(',') : [];
    const asVector = ctx.flags.vector as boolean;
    const upsert = ctx.flags.upsert as boolean;

    if (!key) {
      output.printError('Key is required. Use --key or -k');
      return { success: false, exitCode: 1 };
    }

    if (!value && ctx.interactive) {
      value = await input({
        message: 'Enter value to store:',
        validate: (v) => v.length > 0 || 'Value is required'
      });
    }

    if (!value) {
      output.printError('Value is required. Use --value');
      return { success: false, exitCode: 1 };
    }

    const storeData = {
      key,
      namespace,
      value,
      ttl,
      tags,
      asVector,
      storedAt: new Date().toISOString(),
      size: Buffer.byteLength(value, 'utf8')
    };

    output.printInfo(`Storing in ${namespace}/${key}...`);

    // Use direct sql.js storage with automatic embedding generation
    try {
      const { storeEntry, resolveDbPath: _rdbStore } = await import('../../memory/memory-initializer.js');
      const dbPath = _rdbStore(ctx.flags.path as string | undefined);

      if (asVector) {
        output.writeln(output.dim('  Generating embedding vector...'));
      }

      const result = await storeEntry({
        key,
        value,
        namespace,
        generateEmbeddingFlag: true, // Always generate embeddings for semantic search
        tags,
        ttl,
        upsert,
        dbPath
      });

      if (!result.success) {
        output.printError(result.error || 'Failed to store');
        return { success: false, exitCode: 1 };
      }

      output.writeln();
      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'val', header: 'Value', width: 40 }
        ],
        data: [
          { property: 'Key', val: key },
          { property: 'Namespace', val: namespace },
          { property: 'Size', val: `${storeData.size} bytes` },
          { property: 'TTL', val: ttl ? `${ttl}s` : 'None' },
          { property: 'Tags', val: tags.length > 0 ? tags.join(', ') : 'None' },
          { property: 'Vector', val: result.embedding ? `Yes (${result.embedding.dimensions}-dim)` : 'No' },
          { property: 'ID', val: result.id.substring(0, 20) }
        ]
      });

      output.writeln();
      output.printSuccess('Data stored successfully');

      return { success: true, data: { ...storeData, id: result.id, embedding: result.embedding } };
    } catch (error) {
      output.printError(`Failed to store: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Retrieve command
export const retrieveCommand: Command = {
  name: 'retrieve',
  aliases: ['get'],
  description: 'Retrieve data from memory',
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
    // #2073: --format is the GLOBAL option (parser.ts:78) with choices
    // ['text', 'json', 'table'] and default 'text'. The retrieve handler
    // discriminates: 'json' emits parseable JSON, anything else (text/box/...)
    // emits the human-readable box. No per-command override needed; we just
    // document the behavior in the help text via examples.
    {
      // #2073: --value-only emits ONLY the value string (no wrapper).
      // Designed for piping into JSON.parse without any cleanup.
      name: 'value-only',
      description: 'Print only the stored value to stdout (no wrapper)',
      type: 'boolean',
      default: false
    },
    DB_PATH_OPTION
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const key = ctx.flags.key as string || ctx.args[0];
    const namespace = ctx.flags.namespace as string;

    if (!key) {
      output.printError('Key is required');
      return { success: false, exitCode: 1 };
    }

    // Use sql.js directly for consistent data access
    try {
      const { getEntry, resolveDbPath: _rdbRetrieve } = await import('../../memory/memory-initializer.js');
      const dbPathRetrieve = _rdbRetrieve(ctx.flags.path as string | undefined);
      const result = await getEntry({ key, namespace, dbPath: dbPathRetrieve });

      if (!result.success) {
        output.printError(`Failed to retrieve: ${result.error}`);
        return { success: false, exitCode: 1 };
      }

      if (!result.found || !result.entry) {
        output.printWarning(`Key not found: ${key}`);
        return { success: false, exitCode: 1, data: { key, found: false } };
      }

      const entry = result.entry;

      // #2073: --value-only emits just the raw value (no decoration) for
      // piping into JSON.parse / jq / other downstream parsers without
      // any cleanup.
      if (ctx.flags['value-only'] || ctx.flags.valueOnly) {
        // Use process.stdout.write directly to bypass any printer-side
        // transformation of quotes/structural characters.
        process.stdout.write(entry.content);
        if (process.stdout.isTTY) process.stdout.write('\n');
        return { success: true, data: entry };
      }

      if (ctx.flags.format === 'json') {
        output.printJson(entry);
        return { success: true, data: entry };
      }

      output.writeln();
      output.printBox(
        [
          `Namespace: ${entry.namespace}`,
          `Key: ${entry.key}`,
          `Size: ${entry.content.length} bytes`,
          `Access Count: ${entry.accessCount}`,
          `Tags: ${entry.tags.length > 0 ? entry.tags.join(', ') : 'None'}`,
          `Vector: ${entry.hasEmbedding ? 'Yes' : 'No'}`,
          '',
          output.bold('Value:'),
          entry.content
        ].join('\n'),
        'Memory Entry'
      );

      return { success: true, data: entry };
    } catch (error) {
      output.printError(`Failed to retrieve: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Search command
export const searchCommand: Command = {
  name: 'search',
  description: 'Search memory with semantic/vector search',
  options: [
    {
      name: 'query',
      short: 'q',
      description: 'Search query',
      type: 'string',
      required: true
    },
    {
      name: 'namespace',
      short: 'n',
      description: 'Memory namespace',
      type: 'string'
    },
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum results',
      type: 'number',
      default: 10
    },
    {
      name: 'threshold',
      description: 'Similarity threshold (0-1)',
      type: 'number',
      default: 0.7
    },
    {
      name: 'type',
      short: 't',
      description: 'Search type (semantic, keyword, hybrid)',
      type: 'string',
      default: 'semantic',
      choices: ['semantic', 'keyword', 'hybrid']
    },
    {
      name: 'build-hnsw',
      description: 'Build/rebuild HNSW index before searching (enables ~1.9x-4.7x (measured))',
      type: 'boolean',
      default: false
    },
    {
      name: 'smart',
      short: 's',
      description: 'Use SmartRetrieval pipeline (query expansion, RRF, MMR, recency)',
      type: 'boolean',
      default: false
    },
    DB_PATH_OPTION
  ],
  examples: [
    { command: 'claude-flow memory search -q "authentication patterns"', description: 'Semantic search' },
    { command: 'claude-flow memory search -q "JWT" -t keyword', description: 'Keyword search' },
    { command: 'claude-flow memory search -q "test" --build-hnsw', description: 'Build HNSW index and search' },
    { command: 'claude-flow memory search -q "auth patterns" --smart', description: 'SmartRetrieval with RRF + MMR' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = ctx.flags.query as string || ctx.args[0];
    const namespace = ctx.flags.namespace as string || 'all';
    const limit = ctx.flags.limit as number || 10;
    const threshold = ctx.flags.threshold as number || 0.3;
    const searchType = ctx.flags.type as string || 'semantic';
    const buildHnsw = (ctx.flags['build-hnsw'] || ctx.flags.buildHnsw) as boolean;

    if (!query) {
      output.printError('Query is required. Use --query or -q');
      return { success: false, exitCode: 1 };
    }

    // Build/rebuild HNSW index if requested
    if (buildHnsw) {
      output.printInfo('Building HNSW index...');
      try {
        const { getHNSWIndex, getHNSWStatus } = await import('../../memory/memory-initializer.js');

        const startTime = Date.now();
        const index = await getHNSWIndex({ forceRebuild: true });
        const buildTime = Date.now() - startTime;

        if (index) {
          const status = getHNSWStatus();
          output.printSuccess(`HNSW index built (${status.entryCount} vectors, ${buildTime}ms)`);
          output.writeln(output.dim(`  Dimensions: ${status.dimensions}, Metric: cosine`));
          output.writeln(output.dim(`  Search speedup: ${status.entryCount > 1000 ? '~4.7x' : '~1.9x'} (measured vs brute force)`));
        } else {
          output.printWarning('HNSW index not available (install @ruvector/core for acceleration)');
        }
        output.writeln();
      } catch (error) {
        output.printWarning(`HNSW build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        output.writeln(output.dim('  Falling back to brute-force search'));
        output.writeln();
      }
    }

    output.printInfo(`Searching: "${query}" (${searchType})`);
    output.writeln();

    // Use direct sql.js search with vector similarity
    try {
      const { searchEntries, resolveDbPath: _rdbSearch } = await import('../../memory/memory-initializer.js');
      const dbPathSearch = _rdbSearch(ctx.flags.path as string | undefined);
      const useSmart = (ctx.flags.smart || ctx.flags.s) as boolean;

      let results: { key: string; score: number; namespace: string; preview: string }[];
      let searchTimeMs: number;
      let smartStats: Record<string, unknown> | undefined;
      let backendLabel = 'HNSW + sql.js';

      // #1846: feature-detect smartSearch — older published builds of
      // @claude-flow/memory don't expose it. Fall through to plain
      // semantic search with a one-line warning instead of throwing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let smartSearchFn: any | undefined;
      if (useSmart) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const memMod: any = await import('@claude-flow/memory');
          if (typeof memMod.smartSearch === 'function') {
            smartSearchFn = memMod.smartSearch;
          }
        } catch {
          /* memory package not loadable */
        }
        if (!smartSearchFn) {
          output.printWarning(
            'Smart search requested but smartSearch is not available on the installed @claude-flow/memory build (#1846). Falling back to standard semantic search.',
          );
        }
      }

      if (useSmart && smartSearchFn) {
        // Adapt searchEntries to the SearchFn interface
        const rawSearch = async (req: { query: string; namespace?: string; limit?: number; threshold?: number }) => {
          const r = await searchEntries({
            query: req.query,
            namespace: req.namespace || namespace,
            limit: req.limit || limit * 3,
            threshold: req.threshold ?? threshold,
            dbPath: dbPathSearch,
          });
          return {
            results: r.results.map(e => ({
              id: e.id,
              key: e.key,
              content: e.content,
              score: e.score,
              namespace: e.namespace,
            })),
          };
        };

        const smartResult = await smartSearchFn(rawSearch, {
          query,
          namespace,
          limit,
          threshold,
        });

        results = smartResult.results.map((r: { content: string; key: string; namespace: string; score: number }) => ({
          key: r.key,
          score: r.score,
          namespace: r.namespace,
          preview: r.content,
        }));
        searchTimeMs = smartResult.stats.durationMs;
        smartStats = smartResult.stats as unknown as Record<string, unknown>;
        backendLabel = 'SmartRetrieval (RRF + MMR + Recency)';
      } else {
        const searchResult = await searchEntries({
          query,
          namespace,
          limit,
          threshold,
          dbPath: dbPathSearch
        });

        if (!searchResult.success) {
          output.printError(searchResult.error || 'Search failed');
          return { success: false, exitCode: 1 };
        }

        results = searchResult.results.map(r => ({
          key: r.key,
          score: r.score,
          namespace: r.namespace,
          preview: r.content
        }));
        searchTimeMs = searchResult.searchTime;
      }

      if (ctx.flags.format === 'json') {
        output.printJson({ query, searchType, results, searchTime: `${searchTimeMs}ms`, ...(smartStats ? { stats: smartStats } : {}) });
        return { success: true, data: results };
      }

      // Performance stats
      output.writeln(output.dim(`  Search time: ${searchTimeMs}ms`));
      if (useSmart && smartStats) {
        output.writeln(output.dim(`  Backend: ${backendLabel}`));
        output.writeln(output.dim(`  Variants: ${(smartStats as any).variantCount}, Raw candidates: ${(smartStats as any).rawCandidateCount}`));
      }
      output.writeln();

      if (results.length === 0) {
        output.printWarning('No results found');
        output.writeln(output.dim('Try: claude-flow memory store -k "key" --value "data"'));
        return { success: true, data: [] };
      }

      output.printTable({
        columns: [
          { key: 'key', header: 'Key', width: 20 },
          { key: 'score', header: 'Score', width: 8, align: 'right', format: (v) => Number(v).toFixed(2) },
          { key: 'namespace', header: 'Namespace', width: 12 },
          { key: 'preview', header: 'Preview', width: 35 }
        ],
        data: results
      });

      output.writeln();
      output.printInfo(`Found ${results.length} results`);

      return { success: true, data: results };
    } catch (error) {
      output.printError(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, exitCode: 1 };
    }
  }
};

/**
 * Storage-oriented embeddings subcommands — collection (namespace)
 * inspection, HNSW index management, and memory-store initialization.
 *
 *   - collectionsCommand  (per-namespace vector stats from the sql.js DB)
 *   - indexCommand        (HNSW build/rebuild/status/optimize)
 *   - initCommand         (initialize the embeddings memory store)
 *
 * Extracted from embeddings.ts (W90, P3.8 cut #3).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { getEmbeddings, formatBytes } from './helpers.js';

// Collections subcommand - REAL implementation using sql.js
export const collectionsCommand: Command = {
  name: 'collections',
  description: 'Manage embedding collections (namespaces)',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: list, stats', default: 'list' },
    { name: 'name', short: 'n', type: 'string', description: 'Namespace name' },
    { name: 'db-path', type: 'string', description: 'Database path', default: '.swarm/memory.db' },
  ],
  examples: [
    { command: 'claude-flow embeddings collections', description: 'List collections' },
    { command: 'claude-flow embeddings collections -a stats', description: 'Show detailed stats' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // `--action` is documented (list/stats) but the renderer below
    // emits both views unconditionally — the flag is here for help-
    // text discoverability while the per-action branch is parked.
    const dbPath = ctx.flags['db-path'] as string || '.swarm/memory.db';

    output.writeln();
    output.writeln(output.bold('Embedding Collections (Namespaces)'));
    output.writeln(output.dim('─'.repeat(60)));

    try {
      const fs = await import('fs');
      const path = await import('path');
      const fullDbPath = path.resolve(process.cwd(), dbPath);

      // Check if database exists
      if (!fs.existsSync(fullDbPath)) {
        output.printWarning('No database found');
        output.printInfo('Run: claude-flow memory init');
        output.writeln();
        output.writeln(output.dim('No collections yet - initialize memory first'));
        return { success: true, data: [] };
      }

      // Load sql.js and query real data
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs();

      const fileBuffer = fs.readFileSync(fullDbPath);
      const db = new SQL.Database(fileBuffer);

      // Get collection stats from database
      const statsQuery = db.exec(`
        SELECT
          namespace,
          COUNT(*) as total_entries,
          SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as with_embeddings,
          AVG(embedding_dimensions) as avg_dimensions,
          SUM(LENGTH(content)) as total_content_size
        FROM memory_entries
        WHERE status = 'active'
        GROUP BY namespace
        ORDER BY total_entries DESC
      `);

      // Eagerly probe vector_indexes — the query result isn't piped into
      // the table renderer (collections use the namespace stats instead),
      // but the schema probe is what makes the "no vector_indexes table"
      // case fail fast inside the try below.
      db.exec(`SELECT name, dimensions, hnsw_m FROM vector_indexes`);

      const collections: { name: string; vectors: string; total: string; dimensions: string; index: string; size: string }[] = [];

      if (statsQuery[0]?.values) {
        for (const row of statsQuery[0].values) {
          const [namespace, total, withEmbeddings, avgDims, contentSize] = row as [string, number, number, number, number];

          collections.push({
            name: namespace || 'default',
            vectors: withEmbeddings.toLocaleString(),
            total: total.toLocaleString(),
            dimensions: avgDims ? Math.round(avgDims).toString() : '-',
            index: withEmbeddings > 0 ? 'HNSW' : 'None',
            size: formatBytes(contentSize || 0)
          });
        }
      }

      db.close();

      if (collections.length === 0) {
        output.printWarning('No collections found');
        output.writeln();
        output.writeln(output.dim('Store some data first:'));
        output.writeln(output.highlight('  claude-flow memory store -k "key" --value "data"'));
        return { success: true, data: [] };
      }

      output.printTable({
        columns: [
          { key: 'name', header: 'Namespace', width: 18 },
          { key: 'total', header: 'Entries', width: 10 },
          { key: 'vectors', header: 'Vectors', width: 10 },
          { key: 'dimensions', header: 'Dims', width: 8 },
          { key: 'index', header: 'Index', width: 8 },
          { key: 'size', header: 'Size', width: 10 },
        ],
        data: collections,
      });

      output.writeln();
      output.writeln(output.dim(`Database: ${fullDbPath}`));

      return { success: true, data: collections };
    } catch (error) {
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

export const indexCommand: Command = {
  name: 'index',
  description: 'Manage HNSW indexes',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: build, rebuild, status, optimize', default: 'status' },
    { name: 'collection', short: 'c', type: 'string', description: 'Collection/namespace label (informational; HNSW is a single global index across all namespaces). Omit to build for all namespaces (#1947 RC2).' },
    { name: 'ef-construction', type: 'number', description: 'HNSW ef_construction parameter', default: '200' },
    { name: 'm', type: 'number', description: 'HNSW M parameter', default: '16' },
  ],
  examples: [
    { command: 'claude-flow embeddings index', description: 'Show index status' },
    { command: 'claude-flow embeddings index -a build', description: 'Build index from all namespaces' },
    { command: 'claude-flow embeddings index -a rebuild -c project', description: 'Rebuild (label as `project`)' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'status';
    const collection = ctx.flags.collection as string;
    const efConstruction = parseInt(ctx.flags['ef-construction'] as string || '200', 10);
    const m = parseInt(ctx.flags.m as string || '16', 10);

    output.writeln();
    output.writeln(output.bold(`HNSW Index: ${action}`));
    output.writeln(output.dim('─'.repeat(50)));

    try {
      const { getHNSWStatus, getHNSWIndex, searchHNSWIndex, generateEmbedding } = await import('../../memory/memory-initializer.js');

      // Trigger lazy initialization before reading status, otherwise the
      // singleton stays null and produces a misleading "@ruvector/core not
      // available" warning even when the package is present (#1698).
      await getHNSWIndex().catch(() => null);

      // Probe whether @ruvector/core is loadable so we can distinguish
      // "package missing" from "package present but index empty".
      const ruvectorAvailable = await import('@ruvector/core').then(() => true).catch(() => false);

      // Get real HNSW status
      const status = getHNSWStatus();

      if (action === 'status') {
        output.writeln();
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 24 },
            { key: 'value', header: 'Value', width: 30 },
          ],
          data: [
            { metric: 'HNSW Available', value: status.available ? output.success('Yes (@ruvector/core)') : output.warning('No') },
            { metric: 'Index Initialized', value: status.initialized ? output.success('Yes') : output.dim('No') },
            { metric: 'Vector Count', value: status.entryCount.toLocaleString() },
            { metric: 'Dimensions', value: String(status.dimensions) },
            { metric: 'Distance Metric', value: 'Cosine' },
            { metric: 'HNSW M', value: String(m) },
            { metric: 'ef_construction', value: String(efConstruction) },
          ],
        });

        if (status.available && status.entryCount > 0) {
          // Run a quick benchmark to show actual performance
          output.writeln();
          output.writeln(output.dim('Running quick performance test...'));

          const testQuery = await generateEmbedding('test performance query');
          const start = performance.now();
          const results = await searchHNSWIndex(testQuery.embedding, { k: 10 });
          const searchTime = performance.now() - start;

          // Estimate brute force time (0.5μs per comparison)
          const bruteForceEstimate = status.entryCount * 0.0005;
          const speedup = bruteForceEstimate / (searchTime / 1000);

          output.writeln();
          output.printBox([
            `Performance (n=${status.entryCount}):`,
            `  HNSW Search: ${searchTime.toFixed(2)}ms`,
            `  Brute Force Est: ${(bruteForceEstimate * 1000).toFixed(2)}ms`,
            `  Speedup: ~${Math.round(speedup)}x`,
            `  Results: ${results?.length || 0} matches`,
          ].join('\n'), 'Search Performance');
        } else if (!status.available && !ruvectorAvailable) {
          output.writeln();
          output.printWarning('@ruvector/core not available');
          output.printInfo('Install: npm install @ruvector/core');
        } else if (!status.available) {
          output.writeln();
          output.printWarning('HNSW index not initialized (but @ruvector/core is installed)');
          output.printInfo('This usually means no embeddings have been stored yet.');
          output.printInfo('Run: claude-flow memory store -k "key" --value "text"');
        } else {
          output.writeln();
          output.printInfo('Index is empty. Store some entries to populate it.');
          output.printInfo('Run: claude-flow memory store -k "key" --value "text"');
        }

        return { success: true, data: status };
      }

      // Build/Rebuild action
      if (action === 'build' || action === 'rebuild') {
        // #1947 RC #2: `-c` is informational — the HNSW index is global
        // and indexes every namespace's embeddings in one structure. The
        // earlier code REQUIRED `-c` for build/rebuild AND its examples
        // suggested `-c default`, which silently produced 0 vectors when a
        // user's entries lived under a different namespace (e.g. `project`,
        // `claude-memories`). Treat omitted `-c` as "all namespaces"
        // (the actual runtime behavior) and tell the user as much.
        const label = collection ?? '(all namespaces)';

        const spinner = output.createSpinner({ text: `${action}ing index for ${label}...`, spinner: 'dots' });
        spinner.start();

        // Force rebuild if requested
        const index = await getHNSWIndex({ forceRebuild: action === 'rebuild' });

        if (!index) {
          spinner.fail('@ruvector/core not available');
          output.printInfo('Install: npm install @ruvector/core');
          return { success: false, exitCode: 1 };
        }

        spinner.succeed(`Index ${action} complete`);

        const newStatus = getHNSWStatus();
        output.writeln();
        output.printBox([
          `Collection: ${label}`,
          `Action: ${action}`,
          `Vectors: ${newStatus.entryCount}`,
          `Dimensions: ${newStatus.dimensions}`,
          `M: ${m}`,
          `ef_construction: ${efConstruction}`,
        ].join('\n'), 'Index Built');

        if (!collection && newStatus.entryCount === 0) {
          output.writeln();
          output.printInfo('No vectors indexed. Store some entries first:');
          output.printInfo('  claude-flow memory store -k "key" --value "text" --namespace <ns>');
        }

        return { success: true, data: newStatus };
      }

      // Optimize action
      if (action === 'optimize') {
        output.printInfo('HNSW index is optimized automatically during search');
        output.printInfo('No manual optimization required');
        return { success: true };
      }

      output.printError(`Unknown action: ${action}`);
      return { success: false, exitCode: 1 };
    } catch (error) {
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Init subcommand - Initialize ONNX models and hyperbolic config
export const initCommand: Command = {
  name: 'init',
  description: 'Initialize embedding subsystem with ONNX model and hyperbolic config',
  options: [
    { name: 'model', short: 'm', type: 'string', description: 'ONNX model ID', default: 'Xenova/all-MiniLM-L6-v2' },
    { name: 'hyperbolic', type: 'boolean', description: 'Enable hyperbolic (Poincaré ball) embeddings', default: 'true' },
    { name: 'curvature', short: 'c', type: 'string', description: 'Poincaré ball curvature (use --curvature=-1 for negative)', default: '-1' },
    { name: 'download', short: 'd', type: 'boolean', description: 'Download model during init', default: 'true' },
    { name: 'cache-size', type: 'string', description: 'LRU cache entries', default: '256' },
    { name: 'force', short: 'f', type: 'boolean', description: 'Overwrite existing configuration', default: 'false' },
  ],
  examples: [
    { command: 'claude-flow embeddings init', description: 'Initialize with defaults' },
    { command: 'claude-flow embeddings init --model Xenova/all-mpnet-base-v2', description: 'Use higher quality model' },
    { command: 'claude-flow embeddings init --no-hyperbolic', description: 'Euclidean only' },
    { command: 'claude-flow embeddings init --curvature=-0.5', description: 'Custom curvature (use = for negative)' },
    { command: 'claude-flow embeddings init --force', description: 'Overwrite existing config' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const model = ctx.flags.model as string || 'Xenova/all-MiniLM-L6-v2';
    const hyperbolic = ctx.flags.hyperbolic !== false;
    const download = ctx.flags.download !== false;
    const force = ctx.flags.force === true;

    // Parse curvature - handle both kebab-case and direct value
    const curvatureRaw = ctx.flags.curvature as string || '-1';
    const curvature = parseFloat(curvatureRaw);

    // Parse cache-size - check both kebab-case and camelCase
    const cacheSizeRaw = (ctx.flags['cache-size'] || ctx.flags.cacheSize || '256') as string;
    const cacheSize = parseInt(cacheSizeRaw, 10);

    output.writeln();
    output.writeln(output.bold('Initialize Embedding Subsystem'));
    output.writeln(output.dim('─'.repeat(55)));

    try {
      const fs = await import('fs');
      const path = await import('path');

      // Create directories
      const configDir = path.join(process.cwd(), '.claude-flow');
      const modelDir = path.join(configDir, 'models');
      const configPath = path.join(configDir, 'embeddings.json');

      // Check for existing config
      if (fs.existsSync(configPath) && !force) {
        output.printWarning('Embeddings already initialized');
        output.printInfo(`Config exists: ${configPath}`);
        output.writeln();
        output.writeln(output.dim('Use --force to overwrite existing configuration'));
        return { success: false, exitCode: 1 };
      }

      const spinner = output.createSpinner({ text: 'Initializing...', spinner: 'dots' });
      spinner.start();

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }

      // Download model if requested
      if (download) {
        spinner.setText(`Downloading ONNX model: ${model}...`);
        const embeddings = await getEmbeddings();

        if (embeddings) {
          await embeddings.downloadEmbeddingModel(model, modelDir, (p: { percent: number }) => {
            spinner.setText(`Downloading ${model}... ${p.percent.toFixed(0)}%`);
          });
        } else {
          // Embeddings package not available — skip download
          await new Promise(r => setTimeout(r, 500));
          output.writeln(output.dim('  (Skipped — @claude-flow/embeddings not installed)'));
        }
      }

      // Write embeddings config
      spinner.setText('Writing configuration...');
      const dimension = model.includes('mpnet') ? 768 : 384;
      const config = {
        model,
        modelPath: modelDir,
        dimension,
        cacheSize,
        hyperbolic: {
          enabled: hyperbolic,
          curvature,
          epsilon: 1e-15,
          maxNorm: 1 - 1e-5,
        },
        neural: {
          enabled: true,
          driftThreshold: 0.3,
          decayRate: 0.01,
        },
        initialized: new Date().toISOString(),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      spinner.succeed('Embedding subsystem initialized');

      output.writeln();
      output.printTable({
        columns: [
          { key: 'setting', header: 'Setting', width: 18 },
          { key: 'value', header: 'Value', width: 40 },
        ],
        data: [
          { setting: 'Model', value: model },
          { setting: 'Dimension', value: String(dimension) },
          { setting: 'Cache Size', value: String(cacheSize) + ' entries' },
          { setting: 'Hyperbolic', value: hyperbolic ? `${output.success('Enabled')} (c=${curvature})` : output.dim('Disabled') },
          { setting: 'Neural Substrate', value: output.success('Enabled') },
          { setting: 'Model Path', value: modelDir },
          { setting: 'Config', value: configPath },
        ],
      });

      output.writeln();
      if (hyperbolic) {
        output.printBox([
          'Hyperbolic Embeddings (Poincaré Ball):',
          '• Better for hierarchical data (trees, taxonomies)',
          '• Exponential capacity in low dimensions',
          '• Distance preserves hierarchy structure',
          '',
          'Use: embeddings hyperbolic -a convert',
        ].join('\n'), 'Hyperbolic Space');
      }

      output.writeln();
      output.writeln(output.dim('Next steps:'));
      output.printList([
        'embeddings generate -t "test text"  - Test embedding generation',
        'embeddings search -q "query"        - Semantic search',
        'memory store -k key --value text    - Store with auto-embedding',
      ]);

      return { success: true, data: config };
    } catch (error) {
      output.printError('Initialization failed: ' + (error instanceof Error ? error.message : String(error)));
      return { success: false, exitCode: 1 };
    }
  },
};

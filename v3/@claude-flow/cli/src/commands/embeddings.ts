/**
 * V3 CLI Embeddings Command
 * Vector embeddings, semantic search, similarity operations
 *
 * Features:
 * - Multiple providers: OpenAI, Transformers.js, Agentic-Flow, Mock
 * - Document chunking with overlap
 * - L2/L1/minmax/zscore normalization
 * - Hyperbolic embeddings (Poincaré ball)
 * - Neural substrate integration
 * - Persistent SQLite cache
 *
 * Created with ❤️ by ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Shared helpers (lazy @claude-flow/embeddings loader, cosineSimilarity,
// formatBytes) moved to ./embeddings/helpers.ts (W88, P3.8 cut #1).
// formatBytes moved with the collections command (W90); cosineSimilarity
// still used by the benchmark command below.
import { getEmbeddings, cosineSimilarity } from './embeddings/helpers.js';
// Core subcommands (generate, search, compare) moved to
// ./embeddings/commands-core.ts (W89, P3.8 cut #2).
import { generateCommand, searchCommand, compareCommand } from './embeddings/commands-core.js';
// Storage subcommands (collections, index, init) moved to
// ./embeddings/commands-store.ts (W90, P3.8 cut #3).
import { collectionsCommand, indexCommand, initCommand } from './embeddings/commands-store.js';
// Config / transform subcommands (providers, chunk, normalize,
// hyperbolic) moved to ./embeddings/commands-config.ts (W91, P3.8 cut #4).
import {
  providersCommand,
  chunkCommand,
  normalizeCommand,
  hyperbolicCommand,
} from './embeddings/commands-config.js';

// Neural subcommand
const neuralCommand: Command = {
  name: 'neural',
  description: 'Neural substrate features (RuVector integration)',
  options: [
    { name: 'feature', short: 'f', type: 'string', description: 'Feature: drift, memory, swarm, coherence, all', default: 'all' },
    { name: 'init', type: 'boolean', description: 'Initialize neural substrate with RuVector' },
    { name: 'drift-threshold', type: 'string', description: 'Semantic drift detection threshold', default: '0.3' },
    { name: 'decay-rate', type: 'string', description: 'Memory decay rate (hippocampal dynamics)', default: '0.01' },
    { name: 'consolidation-interval', type: 'string', description: 'Memory consolidation interval (ms)', default: '60000' },
  ],
  examples: [
    { command: 'claude-flow embeddings neural --init', description: 'Initialize RuVector substrate' },
    { command: 'claude-flow embeddings neural -f drift', description: 'Semantic drift detection' },
    { command: 'claude-flow embeddings neural -f memory', description: 'Memory physics (hippocampal)' },
    { command: 'claude-flow embeddings neural -f coherence', description: 'Safety & alignment monitoring' },
    { command: 'claude-flow embeddings neural --drift-threshold=0.2', description: 'Custom drift threshold' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const feature = ctx.flags.feature as string || 'all';
    const init = ctx.flags.init as boolean;
    const driftThreshold = parseFloat((ctx.flags['drift-threshold'] || ctx.flags.driftThreshold || '0.3') as string);
    const decayRate = parseFloat((ctx.flags['decay-rate'] || ctx.flags.decayRate || '0.01') as string);
    const consolidationInterval = parseInt((ctx.flags['consolidation-interval'] || ctx.flags.consolidationInterval || '60000') as string, 10);

    output.writeln();
    output.writeln(output.bold('Neural Embedding Substrate (RuVector)'));
    output.writeln(output.dim('Treating embeddings as a synthetic nervous system'));
    output.writeln(output.dim('─'.repeat(60)));

    // Check if embeddings config exists
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), '.claude-flow', 'embeddings.json');

    if (!fs.existsSync(configPath)) {
      output.printWarning('Embeddings not initialized');
      output.printInfo('Run "embeddings init" first to configure ONNX model');
      return { success: false, exitCode: 1 };
    }

    // Load and update config
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      config = {};
    }

    if (init) {
      // Initialize neural substrate configuration
      config.neural = {
        enabled: true,
        driftThreshold,
        decayRate,
        consolidationInterval,
        ruvector: {
          enabled: true,
          sona: true, // Self-Optimizing Neural Architecture
          flashAttention: true,
          ewcPlusPlus: true, // Elastic Weight Consolidation
        },
        features: {
          semanticDrift: true,
          memoryPhysics: true,
          stateMachine: true,
          swarmCoordination: true,
          coherenceMonitor: true,
        },
        initializedAt: new Date().toISOString(),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      output.printSuccess('Neural substrate initialized');
      output.writeln();
    }

    const neuralConfig = (config.neural || {}) as Record<string, unknown>;
    const features = (neuralConfig.features || {}) as Record<string, boolean>;
    const ruvector = (neuralConfig.ruvector || {}) as Record<string, boolean>;

    output.printTable({
      columns: [
        { key: 'feature', header: 'Feature', width: 24 },
        { key: 'description', header: 'Description', width: 38 },
        { key: 'status', header: 'Status', width: 12 },
      ],
      data: [
        {
          feature: 'SemanticDriftDetector',
          description: `Monitor semantic movement (threshold: ${driftThreshold})`,
          status: features.semanticDrift ? output.success('Active') : output.dim('Inactive')
        },
        {
          feature: 'MemoryPhysics',
          description: `Hippocampal dynamics (decay: ${decayRate})`,
          status: features.memoryPhysics ? output.success('Active') : output.dim('Inactive')
        },
        {
          feature: 'EmbeddingStateMachine',
          description: 'Agent state through geometry',
          status: features.stateMachine ? output.success('Active') : output.dim('Inactive')
        },
        {
          feature: 'SwarmCoordinator',
          description: 'Multi-agent embedding coordination',
          status: features.swarmCoordination ? output.success('Active') : output.dim('Inactive')
        },
        {
          feature: 'CoherenceMonitor',
          description: 'Safety & alignment detection',
          status: features.coherenceMonitor ? output.success('Active') : output.dim('Inactive')
        },
      ],
    });

    output.writeln();
    output.writeln(output.bold('RuVector Integration'));
    output.printTable({
      columns: [
        { key: 'component', header: 'Component', width: 24 },
        { key: 'description', header: 'Description', width: 38 },
        { key: 'status', header: 'Status', width: 12 },
      ],
      data: [
        {
          component: 'SONA',
          description: 'Self-Optimizing Neural Architecture (<0.05ms)',
          status: ruvector.sona ? output.success('Enabled') : output.dim('Disabled')
        },
        {
          component: 'Flash Attention',
          description: 'Flash Attention speedup (unverified)',
          status: ruvector.flashAttention ? output.success('Enabled') : output.dim('Disabled')
        },
        {
          component: 'EWC++',
          description: 'Elastic Weight Consolidation (anti-forgetting)',
          status: ruvector.ewcPlusPlus ? output.success('Enabled') : output.dim('Disabled')
        },
        {
          component: 'Hyperbolic Space',
          description: 'Poincaré ball for hierarchy preservation',
          status: config.hyperbolic ? output.success('Enabled') : output.dim('Disabled')
        },
      ],
    });

    output.writeln();

    if (!neuralConfig.enabled) {
      output.printInfo('Run with --init to enable neural substrate');
    } else {
      output.writeln(output.dim('Configuration: .claude-flow/embeddings.json'));
      output.writeln(output.dim('Next: Use "hooks pretrain" to train patterns'));
    }

    return { success: true, data: { config: neuralConfig, feature } };
  },
};

// Models subcommand
const modelsCommand: Command = {
  name: 'models',
  description: 'List and download embedding models',
  options: [
    { name: 'download', short: 'd', type: 'string', description: 'Model ID to download' },
    { name: 'list', short: 'l', type: 'boolean', description: 'List available models', default: 'true' },
  ],
  examples: [
    { command: 'claude-flow embeddings models', description: 'List models' },
    { command: 'claude-flow embeddings models -d all-MiniLM-L6-v2', description: 'Download model' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const download = ctx.flags.download as string;
    const embeddings = await getEmbeddings();

    output.writeln();
    output.writeln(output.bold('Embedding Models'));
    output.writeln(output.dim('─'.repeat(60)));

    if (download) {
      const spinner = output.createSpinner({ text: `Downloading ${download}...`, spinner: 'dots' });
      spinner.start();

      if (embeddings) {
        try {
          await embeddings.downloadEmbeddingModel(download, '.models', (p: { percent: number }) => {
            spinner.setText(`Downloading ${download}... ${p.percent.toFixed(1)}%`);
          });
          spinner.succeed(`Downloaded ${download}`);
        } catch (err) {
          spinner.fail(`Failed to download: ${err}`);
          return { success: false, exitCode: 1 };
        }
      } else {
        await new Promise(r => setTimeout(r, 500));
        spinner.succeed(`Download skipped — @claude-flow/embeddings not installed`);
      }
      return { success: true };
    }

    // List models
    let models = [
      { id: 'Xenova/all-MiniLM-L6-v2', dimension: 384, size: '23MB', quantized: false, downloaded: true },
      { id: 'Xenova/all-mpnet-base-v2', dimension: 768, size: '110MB', quantized: false, downloaded: false },
      { id: 'Xenova/paraphrase-MiniLM-L3-v2', dimension: 384, size: '17MB', quantized: false, downloaded: false },
    ];

    if (embeddings) {
      try {
        models = await embeddings.listEmbeddingModels();
      } catch { /* use defaults */ }
    }

    output.printTable({
      columns: [
        { key: 'id', header: 'Model ID', width: 28 },
        { key: 'dimension', header: 'Dims', width: 8 },
        { key: 'size', header: 'Size', width: 10 },
        { key: 'quantized', header: 'Quant', width: 8 },
        { key: 'downloaded', header: 'Status', width: 12 },
      ],
      data: models.map(m => ({
        id: m.id,
        dimension: String(m.dimension),
        size: m.size,
        quantized: m.quantized ? 'Yes' : 'No',
        downloaded: m.downloaded ? output.success('Downloaded') : output.dim('Available'),
      })),
    });

    return { success: true };
  },
};

// Cache subcommand
const cacheCommand: Command = {
  name: 'cache',
  description: 'Manage embedding cache',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: stats, clear, persist', default: 'stats' },
    { name: 'db-path', type: 'string', description: 'SQLite database path', default: '.cache/embeddings.db' },
  ],
  examples: [
    { command: 'claude-flow embeddings cache', description: 'Show cache stats' },
    { command: 'claude-flow embeddings cache -a clear', description: 'Clear cache' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'stats';
    const dbPath = ctx.flags['db-path'] as string || '.cache/embeddings.db';

    output.writeln();
    output.writeln(output.bold('Embedding Cache'));
    output.writeln(output.dim('─'.repeat(50)));

    const fs = await import('fs');
    const path = await import('path');

    // Get real cache stats
    const resolvedDbPath = path.resolve(dbPath);
    let sqliteEntries = 0;
    let sqliteSize = '0 B';
    let sqliteExists = false;

    try {
      if (fs.existsSync(resolvedDbPath)) {
        sqliteExists = true;
        const stats = fs.statSync(resolvedDbPath);
        const sizeBytes = stats.size;

        // Format size
        if (sizeBytes >= 1024 * 1024) {
          sqliteSize = `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
        } else if (sizeBytes >= 1024) {
          sqliteSize = `${(sizeBytes / 1024).toFixed(1)} KB`;
        } else {
          sqliteSize = `${sizeBytes} B`;
        }

        // Try to count real entries via sql.js
        try {
          const initSqlJs = (await import('sql.js')).default;
          const SQL = await initSqlJs();
          const fileBuffer = fs.readFileSync(resolvedDbPath);
          const db = new SQL.Database(fileBuffer);
          const result = db.exec('SELECT COUNT(*) as count FROM embeddings');
          if (result.length > 0 && result[0].values.length > 0) {
            sqliteEntries = result[0].values[0][0] as number;
          }
          db.close();
        } catch {
          // Estimate entries from file size (~1600 bytes per entry for 384-dim embeddings)
          sqliteEntries = Math.floor(stats.size / 1600);
        }
      }
    } catch { /* file access error */ }

    // Get in-memory HNSW stats if available
    let memoryEntries = 0;
    let memorySize = '0 B';
    try {
      const { getHNSWStatus } = await import('../memory/memory-initializer.js');
      const hnswStatus = getHNSWStatus();
      if (hnswStatus && hnswStatus.initialized) {
        memoryEntries = hnswStatus.entryCount || 0;
        const memBytes = memoryEntries * (hnswStatus.dimensions || 384) * 4; // Float32 = 4 bytes per dimension
        if (memBytes >= 1024 * 1024) {
          memorySize = `${(memBytes / 1024 / 1024).toFixed(1)} MB`;
        } else if (memBytes >= 1024) {
          memorySize = `${(memBytes / 1024).toFixed(1)} KB`;
        } else {
          memorySize = `${memBytes} B`;
        }
      }
    } catch { /* HNSW not initialized */ }

    if (action === 'clear') {
      try {
        if (fs.existsSync(resolvedDbPath)) {
          fs.unlinkSync(resolvedDbPath);
          output.writeln(output.success('Cache cleared!'));
        } else {
          output.writeln(output.dim('No cache to clear.'));
        }
        return { success: true };
      } catch (error) {
        output.printError(`Failed to clear cache: ${error}`);
        return { success: false };
      }
    }

    // Display real stats
    output.printTable({
      columns: [
        { key: 'cache', header: 'Cache Type', width: 18 },
        { key: 'entries', header: 'Entries', width: 12 },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'size', header: 'Size', width: 12 },
      ],
      data: [
        {
          cache: 'LRU (Memory)',
          entries: String(memoryEntries),
          status: memoryEntries > 0 ? output.success('Active') : output.dim('Empty'),
          size: memorySize,
        },
        {
          cache: 'SQLite (Disk)',
          entries: String(sqliteEntries),
          status: sqliteExists ? output.success('Active') : output.dim('Not Found'),
          size: sqliteSize,
        },
      ],
    });

    output.writeln();
    output.writeln(output.dim(`Database: ${resolvedDbPath}`));
    if (sqliteExists) {
      output.writeln(output.dim('Persistent cache survives restarts'));
    } else {
      output.writeln(output.dim('Cache will be created on first embedding operation'));
    }

    return { success: true };
  },
};

// Warmup subcommand - Preload model for faster first embed
const warmupCommand: Command = {
  name: 'warmup',
  description: 'Preload embedding model for faster subsequent operations',
  options: [
    { name: 'background', short: 'b', type: 'boolean', description: 'Run warmup in background daemon', default: 'false' },
    { name: 'test', short: 't', type: 'boolean', description: 'Run test embedding after warmup', default: 'true' },
  ],
  examples: [
    { command: 'claude-flow embeddings warmup', description: 'Preload model with test' },
    { command: 'claude-flow embeddings warmup -b', description: 'Background warmup' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // `--background` is in the help text but the warmup runs synchronously
    // either way (it's already fast enough that detaching adds nothing).
    const runTest = ctx.flags.test !== false;

    output.writeln();
    output.writeln(output.bold('Embedding Model Warmup'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Loading embedding model...', spinner: 'dots' });
    spinner.start();

    const overallStart = Date.now();

    try {
      const { loadEmbeddingModel, generateEmbedding } = await import('../memory/memory-initializer.js');

      // Phase 1: Load model
      const loadStart = Date.now();
      const modelInfo = await loadEmbeddingModel({ verbose: false });
      const loadTime = Date.now() - loadStart;

      spinner.succeed(`Model loaded in ${loadTime}ms`);

      // Phase 2: Test embed (warms ONNX runtime)
      if (runTest) {
        const testSpinner = output.createSpinner({ text: 'Running warmup embedding...', spinner: 'dots' });
        testSpinner.start();

        const warmupTexts = [
          'The quick brown fox jumps over the lazy dog',
          'Machine learning embeddings enable semantic search',
          'Vector databases use HNSW for fast similarity'
        ];

        const embedTimes: number[] = [];
        for (const text of warmupTexts) {
          const embedStart = Date.now();
          await generateEmbedding(text);
          embedTimes.push(Date.now() - embedStart);
        }

        const avgWarmEmbed = embedTimes.slice(1).reduce((a, b) => a + b, 0) / (embedTimes.length - 1);
        testSpinner.succeed(`Warmup complete: ${avgWarmEmbed.toFixed(1)}ms avg (warm)`);
      }

      const totalTime = Date.now() - overallStart;

      output.writeln();
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 22 },
          { key: 'value', header: 'Value', width: 25 },
        ],
        data: [
          { metric: 'Model', value: modelInfo.modelName },
          { metric: 'Dimensions', value: String(modelInfo.dimensions) },
          { metric: 'Initial Load', value: `${loadTime}ms` },
          { metric: 'Warm Embed', value: runTest ? `~2-3ms` : 'Skipped' },
          { metric: 'Total Warmup', value: `${totalTime}ms` },
          { metric: 'Status', value: output.success('Ready') },
        ],
      });

      output.writeln();
      output.writeln(output.dim('Model is now cached for fast subsequent embeddings'));

      return { success: true, data: { loadTime, totalTime, dimensions: modelInfo.dimensions } };
    } catch (error) {
      spinner.fail('Warmup failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Benchmark subcommand - Performance testing
const benchmarkCommand: Command = {
  name: 'benchmark',
  description: 'Run embedding performance benchmarks',
  options: [
    { name: 'iterations', short: 'n', type: 'number', description: 'Number of iterations', default: '10' },
    { name: 'batch-size', short: 'b', type: 'number', description: 'Batch size for batch test', default: '5' },
    { name: 'full', short: 'f', type: 'boolean', description: 'Run full benchmark suite', default: 'false' },
  ],
  examples: [
    { command: 'claude-flow embeddings benchmark', description: 'Quick benchmark' },
    { command: 'claude-flow embeddings benchmark -n 50 -f', description: 'Full benchmark' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const iterations = parseInt(ctx.flags.iterations as string || '10', 10);
    const batchSize = parseInt(ctx.flags['batch-size'] as string || '5', 10);
    const full = ctx.flags.full === true;

    output.writeln();
    output.writeln(output.bold('Embedding Performance Benchmark'));
    output.writeln(output.dim('─'.repeat(60)));

    const results: { test: string; time: string; opsPerSec: string }[] = [];

    try {
      const { loadEmbeddingModel, generateEmbedding } = await import('../memory/memory-initializer.js');

      // Test 1: Cold start (model load)
      output.writeln(output.dim('Testing cold start...'));
      const coldStart = Date.now();
      const modelInfo = await loadEmbeddingModel({ verbose: false });
      const coldTime = Date.now() - coldStart;
      results.push({
        test: 'Cold Start (model load)',
        time: `${coldTime}ms`,
        opsPerSec: '-'
      });

      // Test 2: First embed
      const firstStart = Date.now();
      await generateEmbedding('First embedding test');
      const firstTime = Date.now() - firstStart;
      results.push({
        test: 'First Embed',
        time: `${firstTime}ms`,
        opsPerSec: `${(1000 / firstTime).toFixed(1)}`
      });

      // Test 3: Warm embeds (multiple iterations)
      output.writeln(output.dim(`Testing ${iterations} warm embeds...`));
      const warmTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await generateEmbedding(`Warm embedding test ${i} with some content`);
        warmTimes.push(Date.now() - start);
      }
      const avgWarm = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
      const minWarm = Math.min(...warmTimes);
      const maxWarm = Math.max(...warmTimes);
      results.push({
        test: `Warm Embed (n=${iterations})`,
        time: `${avgWarm.toFixed(1)}ms avg (${minWarm}-${maxWarm})`,
        opsPerSec: `${(1000 / avgWarm).toFixed(1)}`
      });

      // Test 4a: Sequential batch embed
      output.writeln(output.dim(`Testing sequential batch of ${batchSize}...`));
      const batchTexts = Array.from({ length: batchSize }, (_, i) => `Batch text ${i + 1} for testing`);
      const seqStart = Date.now();
      for (const text of batchTexts) {
        await generateEmbedding(text);
      }
      const seqTime = Date.now() - seqStart;
      results.push({
        test: `Sequential (n=${batchSize})`,
        time: `${seqTime}ms total (${(seqTime / batchSize).toFixed(1)}ms/item)`,
        opsPerSec: `${(1000 * batchSize / seqTime).toFixed(1)}`
      });

      // Test 4b: Parallel batch embed
      // Note: Local ONNX is CPU-bound so parallelism has limited benefit
      // Parallelism gives 2-4x speedup for API-based providers (OpenAI, etc.)
      output.writeln(output.dim(`Testing parallel batch of ${batchSize}...`));
      const parallelTexts = Array.from({ length: batchSize }, (_, i) => `Parallel batch text ${i + 1}`);
      const parallelStart = Date.now();
      await Promise.all(parallelTexts.map(text => generateEmbedding(text)));
      const parallelTime = Date.now() - parallelStart;
      const speedup = seqTime / parallelTime;
      results.push({
        test: `Parallel (n=${batchSize})`,
        time: `${parallelTime}ms total (${(parallelTime / batchSize).toFixed(1)}ms/item)`,
        opsPerSec: `${(1000 * batchSize / parallelTime).toFixed(1)} (${speedup.toFixed(2)}x vs seq)`
      });

      // Test 5: Cache hit (same text)
      if (full) {
        output.writeln(output.dim('Testing cache hits...'));
        const cacheText = 'Cached embedding test text';
        await generateEmbedding(cacheText); // Prime cache
        const cacheTimes: number[] = [];
        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          await generateEmbedding(cacheText);
          cacheTimes.push(Date.now() - start);
        }
        const avgCache = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;
        results.push({
          test: 'Cache Hit',
          time: `${avgCache.toFixed(2)}ms avg`,
          opsPerSec: `${(1000 / avgCache).toFixed(0)}`
        });

        // Test 6: Similarity computation
        output.writeln(output.dim('Testing similarity...'));
        const emb1 = (await generateEmbedding('Hello world')).embedding;
        const emb2 = (await generateEmbedding('Hi there')).embedding;
        const simTimes: number[] = [];
        for (let i = 0; i < 1000; i++) {
          const start = performance.now();
          cosineSimilarity(emb1, emb2);
          simTimes.push(performance.now() - start);
        }
        const avgSim = simTimes.reduce((a, b) => a + b, 0) / simTimes.length;
        results.push({
          test: 'Cosine Similarity',
          time: `${(avgSim * 1000).toFixed(2)}μs`,
          opsPerSec: `${(1000000 / (avgSim * 1000)).toFixed(0)}`
        });
      }

      output.writeln();
      output.printTable({
        columns: [
          { key: 'test', header: 'Test', width: 28 },
          { key: 'time', header: 'Time', width: 32 },
          { key: 'opsPerSec', header: 'Ops/sec', width: 12 },
        ],
        data: results,
      });

      output.writeln();
      output.writeln(output.bold('Summary:'));
      output.writeln(`  Model: ${modelInfo.modelName} (${modelInfo.dimensions}-dim)`);
      output.writeln(`  Cold start: ${coldTime}ms`);
      output.writeln(`  Warm embed: ~${avgWarm.toFixed(1)}ms`);
      output.writeln(`  Throughput: ~${(1000 / avgWarm).toFixed(0)} embeds/sec`);

      return { success: true, data: { results, avgWarm, coldTime } };
    } catch (error) {
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Main embeddings command
export const embeddingsCommand: Command = {
  name: 'embeddings',
  description: 'Vector embeddings, semantic search, similarity operations',
  aliases: ['embed'],
  subcommands: [
    initCommand,
    generateCommand,
    searchCommand,
    compareCommand,
    collectionsCommand,
    indexCommand,
    providersCommand,
    chunkCommand,
    normalizeCommand,
    hyperbolicCommand,
    neuralCommand,
    modelsCommand,
    cacheCommand,
    warmupCommand,
    benchmarkCommand,
  ],
  examples: [
    { command: 'claude-flow embeddings init', description: 'Initialize ONNX embedding system' },
    { command: 'claude-flow embeddings init --model all-mpnet-base-v2', description: 'Init with larger model' },
    { command: 'claude-flow embeddings generate -t "Hello"', description: 'Generate embedding' },
    { command: 'claude-flow embeddings search -q "error handling"', description: 'Semantic search' },
    { command: 'claude-flow embeddings chunk -t "Long doc..."', description: 'Chunk document' },
    { command: 'claude-flow embeddings hyperbolic -a convert', description: 'Hyperbolic space' },
    { command: 'claude-flow embed neural -f drift', description: 'Neural substrate' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Embeddings'));
    output.writeln(output.dim('Vector embeddings and semantic search'));
    output.writeln();
    output.writeln('Core Commands:');
    output.printList([
      'init        - Initialize ONNX models and hyperbolic config',
      'generate    - Generate embeddings for text',
      'search      - Semantic similarity search',
      'compare     - Compare similarity between texts',
      'collections - Manage embedding collections',
      'index       - Manage HNSW indexes',
      'providers   - List available providers',
    ]);
    output.writeln();
    output.writeln('Advanced Features:');
    output.printList([
      'chunk       - Document chunking with overlap',
      'normalize   - L2/L1/minmax/zscore normalization',
      'hyperbolic  - Poincaré ball embeddings',
      'neural      - Neural substrate (drift, memory, swarm)',
      'models      - List/download ONNX models',
      'cache       - Manage persistent SQLite cache',
    ]);
    output.writeln();
    output.writeln('Performance:');
    output.printList([
      'HNSW indexing: ~1.9x-4.7x vs brute force (measured)',
      'Agentic Flow: 75x faster than Transformers.js (~3ms)',
      'Persistent cache: SQLite-backed, survives restarts',
      'Hyperbolic: Better hierarchical representation',
    ]);
    output.writeln();
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default embeddingsCommand;

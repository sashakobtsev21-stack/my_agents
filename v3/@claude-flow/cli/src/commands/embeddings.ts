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
// Shared helpers moved to ./embeddings/helpers.ts (W88, P3.8 cut #1).
// Only cosineSimilarity is still consumed inline here (by the benchmark
// command); getEmbeddings / formatBytes moved with their commands.
import { cosineSimilarity } from './embeddings/helpers.js';
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
// Advanced subcommands (neural, models, cache, warmup) moved to
// ./embeddings/commands-advanced.ts (W92, P3.8 cut #5).
import {
  neuralCommand,
  modelsCommand,
  cacheCommand,
  warmupCommand,
} from './embeddings/commands-advanced.js';

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

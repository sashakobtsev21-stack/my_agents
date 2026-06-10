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

// This file is now a thin registrar: it assembles embeddingsCommand from
// the subcommands extracted into the ./embeddings/ directory during the
// P3.8 god-file decomposition (W88-W93). Sub-modules:
//   helpers · commands-core · commands-store · commands-config ·
//   commands-advanced · commands-benchmark
import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
import { generateCommand, searchCommand, compareCommand } from './embeddings/commands-core.js';
import { collectionsCommand, indexCommand, initCommand } from './embeddings/commands-store.js';
import {
  providersCommand,
  chunkCommand,
  normalizeCommand,
  hyperbolicCommand,
} from './embeddings/commands-config.js';
import {
  neuralCommand,
  modelsCommand,
  cacheCommand,
  warmupCommand,
} from './embeddings/commands-advanced.js';
import { benchmarkCommand } from './embeddings/commands-benchmark.js';


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

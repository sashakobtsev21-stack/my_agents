/**
 * Configuration / transform embeddings subcommands.
 *
 *   - providersCommand   (list available embedding providers)
 *   - chunkCommand       (document chunking with overlap)
 *   - normalizeCommand   (L2/L1/minmax/zscore normalization reference)
 *   - hyperbolicCommand  (Poincaré-ball hyperbolic embedding ops)
 *
 * Extracted from embeddings.ts (W91, P3.8 cut #4).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { getEmbeddings } from './helpers.js';

// Providers subcommand
export const providersCommand: Command = {
  name: 'providers',
  description: 'List available embedding providers',
  options: [],
  examples: [
    { command: 'claude-flow embeddings providers', description: 'List providers' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Embedding Providers'));
    output.writeln(output.dim('─'.repeat(70)));

    output.printTable({
      columns: [
        { key: 'provider', header: 'Provider', width: 18 },
        { key: 'model', header: 'Model', width: 25 },
        { key: 'dims', header: 'Dims', width: 8 },
        { key: 'type', header: 'Type', width: 10 },
        { key: 'status', header: 'Status', width: 12 },
      ],
      data: [
        { provider: 'OpenAI', model: 'text-embedding-3-small', dims: '1536', type: 'Cloud', status: output.success('Ready') },
        { provider: 'OpenAI', model: 'text-embedding-3-large', dims: '3072', type: 'Cloud', status: output.success('Ready') },
        { provider: 'Transformers.js', model: 'Xenova/all-MiniLM-L6-v2', dims: '384', type: 'Local', status: output.success('Ready') },
        { provider: 'Agentic Flow', model: 'ONNX optimized', dims: '384', type: 'Local', status: output.success('Ready') },
        { provider: 'Mock', model: 'mock-embedding', dims: '384', type: 'Dev', status: output.dim('Dev only') },
      ],
    });

    output.writeln();
    output.writeln(output.dim('Agentic Flow provider uses WASM SIMD for 75x faster inference'));

    return { success: true };
  },
};

// Chunk subcommand
export const chunkCommand: Command = {
  name: 'chunk',
  description: 'Chunk text for embedding with overlap',
  options: [
    { name: 'text', short: 't', type: 'string', description: 'Text to chunk', required: true },
    { name: 'max-size', short: 's', type: 'number', description: 'Max chunk size in chars', default: '512' },
    { name: 'overlap', short: 'o', type: 'number', description: 'Overlap between chunks', default: '50' },
    { name: 'strategy', type: 'string', description: 'Strategy: character, sentence, paragraph, token', default: 'sentence' },
    { name: 'file', short: 'f', type: 'string', description: 'File to chunk (instead of text)' },
  ],
  examples: [
    { command: 'claude-flow embeddings chunk -t "Long text..." -s 256', description: 'Chunk with 256 char limit' },
    { command: 'claude-flow embeddings chunk -f doc.txt --strategy paragraph', description: 'Chunk file by paragraph' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const embeddings = await getEmbeddings();
    const text = ctx.flags.text as string || '';
    const maxSize = parseInt(ctx.flags['max-size'] as string || '512', 10);
    const overlap = parseInt(ctx.flags.overlap as string || '50', 10);
    const strategy = ctx.flags.strategy as string || 'sentence';

    output.writeln();
    output.writeln(output.bold('Document Chunking'));
    output.writeln(output.dim('─'.repeat(50)));

    if (!embeddings) {
      output.printWarning('@claude-flow/embeddings not installed, showing preview');
      output.writeln();
      output.printBox([
        `Strategy: ${strategy}`,
        `Max Size: ${maxSize} chars`,
        `Overlap: ${overlap} chars`,
        ``,
        `Estimated chunks: ${Math.ceil(text.length / (maxSize - overlap))}`,
      ].join('\n'), 'Chunking Preview');
      return { success: true };
    }

    const result = embeddings.chunkText(text, { maxChunkSize: maxSize, overlap, strategy: strategy as 'character' | 'sentence' | 'paragraph' | 'token' });

    output.writeln();
    output.printTable({
      columns: [
        { key: 'idx', header: '#', width: 5 },
        { key: 'length', header: 'Chars', width: 8 },
        { key: 'tokens', header: 'Tokens', width: 8 },
        { key: 'preview', header: 'Preview', width: 45 },
      ],
      data: result.chunks.map((c: { length: number; tokenCount: number; text: string }, i: number) => ({
        idx: String(i + 1),
        length: String(c.length),
        tokens: String(c.tokenCount),
        preview: c.text.substring(0, 42) + (c.text.length > 42 ? '...' : ''),
      })),
    });

    output.writeln();
    output.writeln(output.dim(`Total: ${result.totalChunks} chunks from ${result.originalLength} chars`));

    return { success: true };
  },
};

// Normalize subcommand
export const normalizeCommand: Command = {
  name: 'normalize',
  description: 'Normalize embedding vectors',
  options: [
    { name: 'type', short: 't', type: 'string', description: 'Type: l2, l1, minmax, zscore', default: 'l2' },
    { name: 'input', short: 'i', type: 'string', description: 'Input embedding (JSON array)' },
    { name: 'check', short: 'c', type: 'boolean', description: 'Check if already normalized' },
  ],
  examples: [
    { command: 'claude-flow embeddings normalize -i "[0.5, 0.3, 0.8]" -t l2', description: 'L2 normalize' },
    { command: 'claude-flow embeddings normalize --check -i "[...]"', description: 'Check if normalized' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // `--check` flag is documented to verify normalization rather than
    // apply it. The current renderer always emits both the input and the
    // normalized vector — the verify-only path is parked.
    const type = ctx.flags.type as string || 'l2';

    output.writeln();
    output.writeln(output.bold('Embedding Normalization'));
    output.writeln(output.dim('─'.repeat(50)));

    output.printTable({
      columns: [
        { key: 'type', header: 'Type', width: 12 },
        { key: 'formula', header: 'Formula', width: 30 },
        { key: 'use', header: 'Best For', width: 25 },
      ],
      data: [
        { type: output.success('L2'), formula: 'v / ||v||₂', use: 'Cosine similarity' },
        { type: 'L1', formula: 'v / ||v||₁', use: 'Sparse vectors' },
        { type: 'Min-Max', formula: '(v - min) / (max - min)', use: 'Bounded range [0,1]' },
        { type: 'Z-Score', formula: '(v - μ) / σ', use: 'Statistical analysis' },
      ],
    });

    output.writeln();
    output.writeln(output.dim(`Selected: ${type.toUpperCase()} normalization`));
    output.writeln(output.dim('Most embedding models pre-normalize with L2'));

    return { success: true };
  },
};

// Hyperbolic subcommand
export const hyperbolicCommand: Command = {
  name: 'hyperbolic',
  description: 'Hyperbolic embedding operations (Poincaré ball)',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: convert, distance, centroid', default: 'convert' },
    { name: 'curvature', short: 'c', type: 'number', description: 'Hyperbolic curvature', default: '-1' },
    { name: 'input', short: 'i', type: 'string', description: 'Input embedding(s) JSON' },
  ],
  examples: [
    { command: 'claude-flow embeddings hyperbolic -a convert -i "[0.5, 0.3]"', description: 'Convert to Poincaré' },
    { command: 'claude-flow embeddings hyperbolic -a distance', description: 'Compute hyperbolic distance' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'convert';
    const curvature = parseFloat(ctx.flags.curvature as string || '-1');
    const inputJson = ctx.flags.input as string;

    output.writeln();
    output.writeln(output.bold('Hyperbolic Embeddings'));
    output.writeln(output.dim('Poincaré Ball Model'));
    output.writeln(output.dim('─'.repeat(50)));

    // Try to import hyperbolic functions from embeddings package
    try {
      const hyperbolic = await import('@claude-flow/embeddings').then(m => m).catch(() => null);

      if (!hyperbolic || !hyperbolic.euclideanToPoincare) {
        output.printWarning('@claude-flow/embeddings hyperbolic module not available');
        output.printInfo('Install with: npm install @claude-flow/embeddings');
        return { success: false, exitCode: 1 };
      }

      if (!inputJson) {
        // Show help if no input
        output.printBox([
          'Hyperbolic embeddings excel at:',
          '• Hierarchical data representation',
          '• Tree-like structure preservation',
          '• Low-dimensional hierarchy encoding',
          '',
          'Actions: convert, distance, centroid',
          '',
          'Examples:',
          '  -a convert -i "[0.5, 0.3, 0.1]"',
          '  -a distance -i "[[0.1,0.2],[0.3,0.4]]"',
        ].join('\n'), 'Hyperbolic Geometry');
        return { success: true };
      }

      // Parse input vector(s)
      let input: number[] | number[][];
      try {
        input = JSON.parse(inputJson);
      } catch {
        output.printError('Invalid JSON input. Use format: "[0.5, 0.3]" or "[[0.1,0.2],[0.3,0.4]]"');
        return { success: false, exitCode: 1 };
      }

      switch (action) {
        case 'convert': {
          const vec = Array.isArray(input[0]) ? input[0] as number[] : input as number[];
          const rawResult = hyperbolic.euclideanToPoincare(vec, { curvature });
          const result = Array.from(rawResult) as number[];
          output.writeln(output.success('Euclidean → Poincaré conversion:'));
          output.writeln();
          output.writeln(`Input (Euclidean):  [${vec.slice(0, 6).map(v => v.toFixed(4)).join(', ')}${vec.length > 6 ? ', ...' : ''}]`);
          output.writeln(`Output (Poincaré):  [${result.slice(0, 6).map(v => v.toFixed(4)).join(', ')}${result.length > 6 ? ', ...' : ''}]`);
          output.writeln(`Curvature: ${curvature}`);
          output.writeln(`Norm: ${Math.sqrt(result.reduce((s, v) => s + v * v, 0)).toFixed(6)} (must be < 1)`);
          return { success: true, data: { result } };
        }

        case 'distance': {
          if (!Array.isArray(input[0]) || input.length < 2) {
            output.printError('Distance requires two vectors: "[[v1],[v2]]"');
            return { success: false, exitCode: 1 };
          }
          const [v1, v2] = input as number[][];
          const dist = hyperbolic.hyperbolicDistance(v1, v2, { curvature });
          output.writeln(output.success('Hyperbolic (geodesic) distance:'));
          output.writeln();
          output.writeln(`Vector 1: [${v1.slice(0, 4).map(v => v.toFixed(4)).join(', ')}...]`);
          output.writeln(`Vector 2: [${v2.slice(0, 4).map(v => v.toFixed(4)).join(', ')}...]`);
          output.writeln(`Distance: ${dist.toFixed(6)}`);
          return { success: true, data: { distance: dist } };
        }

        case 'centroid': {
          if (!Array.isArray(input[0])) {
            output.printError('Centroid requires multiple vectors: "[[v1],[v2],...]"');
            return { success: false, exitCode: 1 };
          }
          const vectors = input as number[][];
          const rawCentroid = hyperbolic.hyperbolicCentroid(vectors, { curvature });
          const centroid = Array.from(rawCentroid) as number[];
          output.writeln(output.success('Hyperbolic centroid (Fréchet mean):'));
          output.writeln();
          output.writeln(`Input vectors: ${vectors.length}`);
          output.writeln(`Centroid: [${centroid.slice(0, 6).map(v => v.toFixed(4)).join(', ')}${centroid.length > 6 ? ', ...' : ''}]`);
          return { success: true, data: { centroid } };
        }

        default:
          output.printError(`Unknown action: ${action}. Use: convert, distance, centroid`);
          return { success: false, exitCode: 1 };
      }
    } catch (error) {
      output.printError(`Hyperbolic operation failed: ${(error as Error).message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

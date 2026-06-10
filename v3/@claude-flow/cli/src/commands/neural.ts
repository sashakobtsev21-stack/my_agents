/**
 * V3 CLI Neural Command
 * Neural pattern training, MoE, Flash Attention, pattern learning
 *
 * Created with ❤️ by ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Train subcommand moved to ./neural/commands-train.ts (W94, P3.9 cut #1).
import { trainCommand } from './neural/commands-train.js';
// Status / inspection subcommands (status, patterns, predict) moved to
// ./neural/commands-status.ts (W95, P3.9 cut #2).
import { statusCommand, patternsCommand, predictCommand } from './neural/commands-status.js';
// Optimize / export subcommands moved to ./neural/commands-optimize.ts
// (W96, P3.9 cut #3).
import { optimizeCommand, exportCommand } from './neural/commands-optimize.js';
// Model I/O subcommands (list, import) moved to ./neural/commands-io.ts
// (W97, P3.9 cut #4).
import { listCommand, importCommand } from './neural/commands-io.js';

// Benchmark subcommand - Real WASM benchmarks
const benchmarkCommand: Command = {
  name: 'benchmark',
  description: 'Benchmark RuVector WASM training performance',
  options: [
    { name: 'dim', short: 'd', type: 'number', description: 'Embedding dimension (max 256)', default: '256' },
    { name: 'iterations', short: 'i', type: 'number', description: 'Number of iterations', default: '1000' },
    { name: 'keys', short: 'k', type: 'number', description: 'Number of keys for attention', default: '100' },
  ],
  examples: [
    { command: 'claude-flow neural benchmark', description: 'Run default benchmark' },
    { command: 'claude-flow neural benchmark -d 128 -i 5000', description: 'Custom benchmark' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const dim = Math.min(parseInt(ctx.flags.dim as string || '256', 10), 256);
    const iterations = parseInt(ctx.flags.iterations as string || '1000', 10);
    const numKeys = parseInt(ctx.flags.keys as string || '100', 10);

    output.writeln();
    output.writeln(output.bold('RuVector WASM Benchmark'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Running benchmarks...', spinner: 'dots' });
    spinner.start();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import of optional native WASM module with no type declarations
      const attention = await import('@ruvector/attention') as unknown as Record<string, new (...args: number[]) => { computeRaw: (q: Float32Array, k: Float32Array[], v: Float32Array[]) => Float32Array }>;

      // Manual benchmark since benchmarkAttention has a binding bug
      const benchmarkMechanism = async (name: string, mechanism: { computeRaw: (q: Float32Array, k: Float32Array[], v: Float32Array[]) => Float32Array }) => {
        const query = new Float32Array(dim);
        const keys: Float32Array[] = [];
        const values: Float32Array[] = [];

        for (let i = 0; i < dim; i++) query[i] = Math.random();
        for (let k = 0; k < numKeys; k++) {
          const key = new Float32Array(dim);
          const val = new Float32Array(dim);
          for (let i = 0; i < dim; i++) {
            key[i] = Math.random();
            val[i] = Math.random();
          }
          keys.push(key);
          values.push(val);
        }

        // Warmup
        for (let i = 0; i < 10; i++) mechanism.computeRaw(query, keys, values);

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          mechanism.computeRaw(query, keys, values);
        }
        const elapsed = performance.now() - start;

        return {
          name,
          averageTimeMs: elapsed / iterations,
          opsPerSecond: Math.round((iterations / elapsed) * 1000),
        };
      };

      spinner.setText(`Benchmarking attention mechanisms (dim=${dim}, keys=${numKeys}, iter=${iterations})...`);

      const results: { name: string; averageTimeMs: number; opsPerSecond: number }[] = [];

      // Benchmark each mechanism
      const dotProduct = new attention.DotProductAttention(dim);
      results.push(await benchmarkMechanism('DotProduct', dotProduct));

      const flash = new attention.FlashAttention(dim, 64);
      results.push(await benchmarkMechanism('FlashAttention', flash));

      const multiHead = new attention.MultiHeadAttention(dim, 4);
      results.push(await benchmarkMechanism('MultiHead (4 heads)', multiHead));

      const hyperbolic = new attention.HyperbolicAttention(dim, 1.0);
      results.push(await benchmarkMechanism('Hyperbolic', hyperbolic));

      const linear = new attention.LinearAttention(dim, dim);
      results.push(await benchmarkMechanism('Linear', linear));

      spinner.succeed('Benchmark complete');

      output.writeln();
      output.printTable({
        columns: [
          { key: 'name', header: 'Mechanism', width: 25 },
          { key: 'avgTime', header: 'Avg Time (ms)', width: 15 },
          { key: 'opsPerSec', header: 'Ops/sec', width: 15 },
        ],
        data: results.map(r => ({
          name: r.name,
          avgTime: r.averageTimeMs.toFixed(4),
          opsPerSec: r.opsPerSecond.toLocaleString(),
        })),
      });

      // Show speedup comparisons
      const dotProductResult = results.find(r => r.name.includes('DotProduct'));
      const flashResult = results.find(r => r.name.includes('Flash'));
      const hyperbolicResult = results.find(r => r.name.includes('Hyperbolic'));

      if (dotProductResult && flashResult) {
        const speedup = dotProductResult.averageTimeMs / flashResult.averageTimeMs;
        output.writeln();
        output.writeln(output.highlight(`Flash Attention speedup: ${speedup.toFixed(2)}x faster than DotProduct`));
      }

      if (dotProductResult && hyperbolicResult) {
        output.writeln(output.dim(`Hyperbolic overhead: ${(hyperbolicResult.averageTimeMs / dotProductResult.averageTimeMs).toFixed(2)}x (expected for manifold ops)`));
      }

      // Also benchmark MicroLoRA
      spinner.start();
      spinner.setText('Benchmarking MicroLoRA adaptation...');

      // Load WASM file directly (Node.js compatible)
      const fs = await import('fs');
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const wasmPath = require.resolve('@ruvector/learning-wasm/ruvector_learning_wasm_bg.wasm');
      const wasmBuffer = fs.readFileSync(wasmPath);

      const learningWasm = await import('@ruvector/learning-wasm');
      learningWasm.initSync({ module: wasmBuffer });

      const lora = new learningWasm.WasmMicroLoRA(dim, 0.1, 0.01);
      const gradient = new Float32Array(dim);
      for (let i = 0; i < dim; i++) gradient[i] = Math.random() - 0.5;

      const loraStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        lora.adapt_array(gradient);
      }
      const loraTime = performance.now() - loraStart;
      const loraAvg = loraTime / iterations;

      spinner.succeed('MicroLoRA benchmark complete');

      output.writeln();
      output.printTable({
        columns: [
          { key: 'metric', header: 'MicroLoRA Metric', width: 25 },
          { key: 'value', header: 'Value', width: 25 },
        ],
        data: [
          { metric: 'Dimension', value: String(dim) },
          { metric: 'Iterations', value: iterations.toLocaleString() },
          { metric: 'Total Time', value: `${loraTime.toFixed(2)}ms` },
          { metric: 'Avg Adaptation', value: `${(loraAvg * 1000).toFixed(2)}μs` },
          { metric: 'Adaptations/sec', value: Math.round(1000 / loraAvg).toLocaleString() },
          { metric: 'Target (<100μs)', value: loraAvg * 1000 < 100 ? output.success('✓ PASS') : output.warning('✗ FAIL') },
        ],
      });

      lora.free();

      return { success: true, data: { results, loraAvg } };
    } catch (error) {
      spinner.fail('Benchmark failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Main neural command
export const neuralCommand: Command = {
  name: 'neural',
  description: 'Neural pattern training, MoE, Flash Attention, pattern learning',
  subcommands: [trainCommand, statusCommand, patternsCommand, predictCommand, optimizeCommand, benchmarkCommand, listCommand, exportCommand, importCommand],
  examples: [
    { command: 'claude-flow neural status', description: 'Check neural system status' },
    { command: 'claude-flow neural train -p coordination', description: 'Train coordination patterns' },
    { command: 'claude-flow neural patterns --action list', description: 'List learned patterns' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Neural System'));
    output.writeln(output.dim('Advanced AI pattern learning and inference'));
    output.writeln();
    output.writeln('Use --help with subcommands for more info');
    output.writeln();
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default neuralCommand;

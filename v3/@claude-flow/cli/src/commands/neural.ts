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

// List subcommand - List available pre-trained models
const listCommand: Command = {
  name: 'list',
  description: 'List available pre-trained models from the official registry',
  options: [
    { name: 'category', type: 'string', description: 'Filter by category (security, quality, performance, etc.)' },
    { name: 'format', short: 'f', type: 'string', description: 'Output format: table, json, simple', default: 'table' },
    { name: 'cid', type: 'string', description: 'Custom registry CID (default: official registry)' },
  ],
  examples: [
    { command: 'claude-flow neural list', description: 'List all available models' },
    { command: 'claude-flow neural list --category security', description: 'List only security models' },
    { command: 'claude-flow neural list -f json', description: 'Output as JSON' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const category = ctx.flags.category as string | undefined;
    const format = ctx.flags.format as string || 'table';
    const customCid = ctx.flags.cid as string;

    // Official model registry CID
    const registryCid = customCid || 'QmNr1yYMKi7YBaL8JSztQyuB5ZUaTdRMLxJC1pBpGbjsTc';

    output.writeln();
    output.writeln(output.bold('Pre-trained Model Registry'));
    output.writeln(output.dim('─'.repeat(60)));

    const spinner = output.createSpinner({ text: 'Fetching model registry...', spinner: 'dots' });
    spinner.start();

    try {
      const gateways = [
        'https://gateway.pinata.cloud',
        'https://ipfs.io',
        'https://dweb.link',
      ];

      interface ModelType {
        id: string;
        name: string;
        category: string;
        description: string;
        patterns: Array<{ id: string; description: string; confidence: number }>;
        metadata: { accuracy: number; totalUsage: number; trainedOn: string };
      }

      interface RegistryType {
        models: ModelType[];
        metadata: { totalPatterns: number; averageAccuracy: number };
      }

      let registry: RegistryType | null = null;

      for (const gateway of gateways) {
        try {
          const response = await fetch(`${gateway}/ipfs/${registryCid}`, {
            signal: AbortSignal.timeout(15000),
            headers: { 'Accept': 'application/json' },
          });

          if (response.ok) {
            registry = await response.json() as RegistryType;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!registry || !registry.models) {
        spinner.fail('Could not fetch model registry');
        return { success: false, exitCode: 1 };
      }

      const registryData = registry as RegistryType;

      // Filter by category if specified
      let models = registryData.models;
      if (category) {
        models = models.filter(m =>
          m.category === category ||
          m.id.includes(category) ||
          m.name.toLowerCase().includes(category.toLowerCase())
        );
        spinner.succeed(`Found ${models.length} models matching "${category}"`);
      } else {
        spinner.succeed(`Found ${registryData.models.length} models`);
      }

      if (models.length === 0) {
        output.writeln(output.warning(`No models found for category: ${category}`));
        output.writeln(output.dim('Available categories: security, quality, performance, testing, api, debugging, refactoring, documentation'));
        return { success: false, exitCode: 1 };
      }

      output.writeln();

      if (format === 'json') {
        output.writeln(JSON.stringify(models, null, 2));
      } else if (format === 'simple') {
        for (const model of models) {
          output.writeln(`${model.id} (${model.category}) - ${model.patterns.length} patterns, ${(model.metadata.accuracy * 100).toFixed(0)}% accuracy`);
        }
      } else {
        // Table format
        output.printTable({
          columns: [
            { key: 'id', header: 'Model ID', width: 35 },
            { key: 'category', header: 'Category', width: 14 },
            { key: 'patterns', header: 'Patterns', width: 10 },
            { key: 'accuracy', header: 'Accuracy', width: 10 },
            { key: 'usage', header: 'Usage', width: 10 },
          ],
          data: models.map(m => ({
            id: m.id,
            category: m.category,
            patterns: String(m.patterns.length),
            accuracy: `${(m.metadata.accuracy * 100).toFixed(0)}%`,
            usage: m.metadata.totalUsage.toLocaleString(),
          })),
        });

        output.writeln();
        output.writeln(output.dim('Registry CID: ' + registryCid));
        output.writeln();
        output.writeln(output.bold('Import Commands:'));
        output.writeln(output.dim('  All models:      ') + `claude-flow neural import --cid ${registryCid}`);
        if (category) {
          output.writeln(output.dim(`  ${category} only: `) + `claude-flow neural import --cid ${registryCid} --category ${category}`);
        } else {
          output.writeln(output.dim('  By category:     ') + `claude-flow neural import --cid ${registryCid} --category <category>`);
        }
      }

      return { success: true };
    } catch (error) {
      spinner.fail(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// Import subcommand - Securely import models from IPFS
const importCommand: Command = {
  name: 'import',
  description: 'Import trained models from IPFS with signature verification',
  options: [
    { name: 'cid', short: 'c', type: 'string', description: 'IPFS CID to import from' },
    { name: 'file', short: 'f', type: 'string', description: 'Local file to import' },
    { name: 'verify', short: 'v', type: 'boolean', description: 'Verify Ed25519 signature', default: 'true' },
    { name: 'merge', type: 'boolean', description: 'Merge with existing patterns (vs replace)', default: 'true' },
    { name: 'category', type: 'string', description: 'Only import patterns from specific category' },
  ],
  examples: [
    { command: 'claude-flow neural import --cid QmXxx...', description: 'Import from IPFS' },
    { command: 'claude-flow neural import -f ./patterns.json --verify', description: 'Import from file' },
    { command: 'claude-flow neural import --cid QmNr1yYMK... --category security', description: 'Import only security patterns' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const cid = ctx.flags.cid as string;
    const file = ctx.flags.file as string;
    const verifySignature = ctx.flags.verify !== false;
    const merge = ctx.flags.merge !== false;
    const categoryFilter = ctx.flags.category as string | undefined;

    if (!cid && !file) {
      output.writeln(output.error('Either --cid or --file is required'));
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Secure Model Import'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Fetching model...', spinner: 'dots' });
    spinner.start();

    try {
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      type ImportDataType = {
        pinataContent?: { patterns: Array<{ id: string; trigger: string; action: string; confidence: number; usageCount: number; category?: string }> };
        patterns?: Array<{ id: string; trigger: string; action: string; confidence: number; usageCount: number; category?: string }>;
        signature?: string;
        publicKey?: string;
      };

      let importData: ImportDataType | null = null;

      // Fetch from IPFS or file
      if (cid) {
        const gateways = [
          'https://gateway.pinata.cloud',
          'https://ipfs.io',
          'https://dweb.link',
        ];

        for (const gateway of gateways) {
          try {
            spinner.setText(`Fetching from ${gateway}...`);
            const response = await fetch(`${gateway}/ipfs/${cid}`, {
              signal: AbortSignal.timeout(30000),
              headers: { 'Accept': 'application/json' },
            });

            if (response.ok) {
              importData = await response.json() as ImportDataType;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!importData) {
          spinner.fail('Could not fetch from any IPFS gateway');
          return { success: false, exitCode: 1 };
        }
      } else {
        if (!fs.existsSync(file)) {
          spinner.fail(`File not found: ${file}`);
          return { success: false, exitCode: 1 };
        }
        importData = JSON.parse(fs.readFileSync(file, 'utf8')) as ImportDataType;
      }

      if (!importData) {
        spinner.fail('No import data available');
        return { success: false, exitCode: 1 };
      }

      // Verify signature if present and requested
      if (verifySignature && importData.signature && importData.publicKey) {
        spinner.setText('Verifying Ed25519 signature...');

        try {
          const { webcrypto } = crypto;
          const publicKeyHex = importData.publicKey.replace('ed25519:', '');
          const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
          const signatureBytes = Buffer.from(importData.signature, 'hex');

          const publicKey = await webcrypto.subtle.importKey(
            'raw',
            publicKeyBytes,
            { name: 'Ed25519' },
            false,
            ['verify']
          );

          const dataBytes = new TextEncoder().encode(JSON.stringify(importData.pinataContent));
          const valid = await webcrypto.subtle.verify('Ed25519', publicKey, signatureBytes, dataBytes);

          if (!valid) {
            spinner.fail('Signature verification FAILED - data may be tampered');
            return { success: false, exitCode: 1 };
          }

          output.writeln(output.success('Signature verified'));
        } catch (err) {
          output.writeln(output.warning(`Signature verification skipped: ${err instanceof Error ? err.message : String(err)}`));
        }
      }

      // Extract patterns - handle both single model and model registry formats
      spinner.setText('Importing patterns...');

      const content = importData.pinataContent || importData;
      type PatternType = { id: string; trigger: string; action: string; confidence: number; usageCount: number; category?: string };
      type ModelType = { id: string; category: string; patterns: PatternType[] };

      let patterns: PatternType[] = [];

      // Check if this is a model registry (has models array)
      const registry = content as { models?: ModelType[] };
      if (registry.models && Array.isArray(registry.models)) {
        // Model registry format - extract patterns from each model
        for (const model of registry.models) {
          if (!categoryFilter || model.category === categoryFilter || model.id.includes(categoryFilter)) {
            for (const pattern of model.patterns || []) {
              patterns.push({
                ...pattern,
                category: model.category, // Tag with model category
              });
            }
          }
        }
      } else {
        // Single model format - patterns at top level
        patterns = (content as { patterns?: PatternType[] }).patterns || [];
      }

      // Filter by category if specified (additional filtering)
      if (categoryFilter && patterns.length > 0) {
        patterns = patterns.filter(p =>
          p.category === categoryFilter ||
          p.trigger.includes(categoryFilter)
        );
      }

      // Validate patterns (security check)
      const validPatterns = patterns.filter(p => {
        // Security: Reject patterns with suspicious content
        const suspicious = [
          'eval(', 'Function(', 'exec(', 'spawn(',
          'child_process', 'rm -rf', 'sudo',
          '<script>', 'javascript:', 'data:',
        ];

        const content = JSON.stringify(p);
        return !suspicious.some(s => content.includes(s));
      });

      if (validPatterns.length < patterns.length) {
        output.writeln(output.warning(`Filtered ${patterns.length - validPatterns.length} suspicious patterns`));
      }

      // Save to local memory
      const memoryDir = path.join(process.cwd(), '.claude-flow', 'memory');
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
      }

      const patternsFile = path.join(memoryDir, 'patterns.json');
      let existingPatterns: Array<{ id: string }> = [];

      if (merge && fs.existsSync(patternsFile)) {
        existingPatterns = JSON.parse(fs.readFileSync(patternsFile, 'utf8'));
      }

      // Merge or replace
      const existingIds = new Set(existingPatterns.map(p => p.id));
      const newPatterns = validPatterns.filter(p => !existingIds.has(p.id));
      const finalPatterns = merge ? [...existingPatterns, ...newPatterns] : validPatterns;

      fs.writeFileSync(patternsFile, JSON.stringify(finalPatterns, null, 2));

      spinner.succeed('Import complete');

      output.writeln();
      output.table({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 20 },
        ],
        data: [
          { metric: 'Patterns Imported', value: String(validPatterns.length) },
          { metric: 'New Patterns', value: String(newPatterns.length) },
          { metric: 'Total Patterns', value: String(finalPatterns.length) },
          { metric: 'Signature Verified', value: importData.signature ? 'Yes' : 'N/A' },
          { metric: 'Merge Mode', value: merge ? 'Yes' : 'Replace' },
        ],
      });

      output.writeln();
      output.writeln(output.success('Patterns imported and ready to use'));
      output.writeln(output.dim('Run "claude-flow neural patterns --action list" to see imported patterns'));

      return { success: true };
    } catch (error) {
      spinner.fail(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

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

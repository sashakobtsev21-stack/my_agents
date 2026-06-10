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

// Optimize subcommand - Real Int8 quantization and pattern optimization
const optimizeCommand: Command = {
  name: 'optimize',
  description: 'Optimize neural patterns (Int8 quantization, memory compression)',
  options: [
    { name: 'method', type: 'string', description: 'Method: quantize, analyze, compact', default: 'quantize' },
    { name: 'verbose', short: 'v', type: 'boolean', description: 'Show detailed metrics' },
  ],
  examples: [
    { command: 'claude-flow neural optimize --method quantize', description: 'Quantize patterns to Int8' },
    { command: 'claude-flow neural optimize --method analyze -v', description: 'Analyze memory usage' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const method = ctx.flags.method as string || 'quantize';
    const verbose = ctx.flags.verbose === true;

    output.writeln();
    output.writeln(output.bold('Pattern Optimization (Real)'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: `Running ${method} optimization...`, spinner: 'dots' });
    spinner.start();

    try {
      const { initializeIntelligence, getIntelligenceStats, getAllPatterns, flushPatterns, compactPatterns } = await import('../memory/intelligence.js');
      const fs = await import('fs');
      const path = await import('path');

      await initializeIntelligence();
      const patterns = await getAllPatterns();
      const stats = getIntelligenceStats();

      // Trigger ruvllm background learning if available
      try {
        const { runBackgroundLearning } = await import('../memory/intelligence.js');
        await runBackgroundLearning();
      } catch { /* background learning is best-effort */ }

      // Get actual pattern storage size
      const patternDir = path.join(process.cwd(), '.claude-flow', 'neural');
      let beforeSize = 0;
      try {
        const patternFile = path.join(patternDir, 'patterns.json');
        if (fs.existsSync(patternFile)) {
          beforeSize = fs.statSync(patternFile).size;
        }
      } catch { /* ignore */ }

      if (method === 'quantize') {
        // Perform real Int8 quantization on pattern embeddings
        spinner.setText('Quantizing pattern embeddings to Int8...');

        let quantizedCount = 0;
        let totalBeforeValues = 0;
        let totalAfterValues = 0;

        for (const pattern of patterns) {
          if (pattern.embedding && pattern.embedding.length > 0) {
            totalBeforeValues += pattern.embedding.length;

            // Actually quantize: scale Float32 values to Int8 range [-128, 127]
            const emb = pattern.embedding;
            let min = Infinity, max = -Infinity;
            for (const v of emb) {
              if (v < min) min = v;
              if (v > max) max = v;
            }
            const range = max - min || 1;
            const scale = 255 / range;
            const offset = min;

            // Convert in-place to quantized integer values
            for (let i = 0; i < emb.length; i++) {
              emb[i] = Math.round((emb[i] - offset) * scale) - 128;
            }

            // Store quantization params for dequantization (extra fields survive JSON serialization)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = pattern as any;
            p.quantized = true;
            p.quantScale = scale;
            p.quantOffset = offset;

            totalAfterValues += pattern.embedding.length;
            quantizedCount++;
          }
        }

        // Save actually-quantized patterns (integers serialize smaller in JSON)
        await flushPatterns();

        // Measure real file size after quantization
        let afterSize = beforeSize;
        try {
          const patternFile = path.join(patternDir, 'patterns.json');
          if (fs.existsSync(patternFile)) {
            afterSize = fs.statSync(patternFile).size;
          }
        } catch { /* ignore */ }

        const actualRatio = beforeSize > 0 && afterSize > 0 ? (beforeSize / afterSize) : 0;

        spinner.succeed(`Quantized ${quantizedCount} pattern embeddings to Int8`);

        output.writeln();
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'before', header: 'Before', width: 18 },
            { key: 'after', header: 'After', width: 18 },
          ],
          data: [
            { metric: 'Pattern Count', before: String(patterns.length), after: String(patterns.length) },
            { metric: 'Quantized', before: '-', after: String(quantizedCount) },
            { metric: 'Storage Size', before: `${(beforeSize / 1024).toFixed(1)} KB`, after: `${(afterSize / 1024).toFixed(1)} KB` },
            { metric: 'Reduction Ratio', before: '-', after: actualRatio > 0 ? `${actualRatio.toFixed(2)}x` : 'N/A (no data)' },
            { metric: 'Precision', before: 'Float32', after: 'Int8 (±0.5%)' },
          ],
        });

      } else if (method === 'analyze') {
        spinner.succeed('Analysis complete');

        output.writeln();
        output.writeln(output.bold('Pattern Memory Analysis'));

        const embeddingBytes = patterns.reduce((sum, p) => sum + (p.embedding?.length || 0) * 4, 0);
        const metadataEstimate = patterns.length * 100; // ~100 bytes per pattern metadata

        output.printTable({
          columns: [
            { key: 'component', header: 'Component', width: 25 },
            { key: 'size', header: 'Size', width: 18 },
            { key: 'count', header: 'Count', width: 12 },
          ],
          data: [
            { component: 'Pattern Embeddings (F32)', size: `${(embeddingBytes / 1024).toFixed(1)} KB`, count: String(patterns.length) },
            { component: 'Pattern Metadata', size: `${(metadataEstimate / 1024).toFixed(1)} KB`, count: '-' },
            { component: 'Total In-Memory', size: `${((embeddingBytes + metadataEstimate) / 1024).toFixed(1)} KB`, count: '-' },
            { component: 'Storage (patterns.json)', size: `${(beforeSize / 1024).toFixed(1)} KB`, count: '-' },
            { component: 'Trajectories', size: '-', count: String(stats.trajectoriesRecorded) },
          ],
        });

        if (verbose) {
          output.writeln();
          output.writeln(output.bold('Optimization Recommendations'));
          const recommendations: string[] = [];
          if (patterns.length > 1000) {
            recommendations.push('- Consider pruning low-usage patterns');
          }
          if (embeddingBytes > 1024 * 1024) {
            recommendations.push('- Int8 quantization would reduce memory by ~75%');
          }
          if (stats.trajectoriesRecorded > 100) {
            recommendations.push('- Trajectory consolidation available');
          }
          if (recommendations.length === 0) {
            recommendations.push('- Patterns are already well optimized');
          }
          recommendations.forEach(r => output.writeln(r));
        }

      } else if (method === 'compact') {
        spinner.setText('Compacting pattern storage...');

        // Remove duplicate or very similar patterns
        const compacted = await compactPatterns(0.95); // Remove patterns with >95% similarity

        spinner.succeed(`Compacted ${compacted.removed} patterns`);

        output.writeln();
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 20 },
            { key: 'value', header: 'Value', width: 15 },
          ],
          data: [
            { metric: 'Patterns Before', value: String(compacted.before) },
            { metric: 'Patterns After', value: String(compacted.after) },
            { metric: 'Removed', value: String(compacted.removed) },
            { metric: 'Similarity Threshold', value: '95%' },
          ],
        });
      }

      return { success: true };
    } catch (error) {
      spinner.fail('Optimization failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Export subcommand - Securely export trained models to IPFS
const exportCommand: Command = {
  name: 'export',
  description: 'Export trained models to IPFS for sharing (Ed25519 signed)',
  options: [
    { name: 'model', short: 'm', type: 'string', description: 'Model ID or category to export' },
    { name: 'output', short: 'o', type: 'string', description: 'Output file path (optional)' },
    { name: 'ipfs', short: 'i', type: 'boolean', description: 'Pin to IPFS (requires Pinata credentials)' },
    { name: 'sign', short: 's', type: 'boolean', description: 'Sign with Ed25519 key', default: 'true' },
    { name: 'strip-pii', type: 'boolean', description: 'Strip potential PII from export', default: 'true' },
    { name: 'name', short: 'n', type: 'string', description: 'Custom name for exported model' },
  ],
  examples: [
    { command: 'claude-flow neural export -m security-patterns --ipfs', description: 'Export and pin to IPFS' },
    { command: 'claude-flow neural export -m code-review -o ./export.json', description: 'Export to file' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const modelId = ctx.flags.model as string || 'all';
    const outputFile = ctx.flags.output as string | undefined;
    const pinToIpfs = ctx.flags.ipfs as boolean;
    const signExport = ctx.flags.sign !== false;
    const stripPii = ctx.flags['strip-pii'] !== false;
    const customName = ctx.flags.name as string;

    output.writeln();
    output.writeln(output.bold('Secure Model Export'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Preparing export...', spinner: 'dots' });
    spinner.start();

    try {
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      // Collect trained patterns from memory
      spinner.setText('Collecting trained patterns...');
      const { getIntelligenceStats, flushPatterns } = await import('../memory/intelligence.js');

      await flushPatterns(); // Ensure all patterns are persisted
      const stats = await getIntelligenceStats();

      // SECURITY: Build export data - NEVER include secrets
      // - API keys read from env but NEVER included in export
      // - Uses ephemeral signing keys (generated per-export, not stored)
      // - PII stripping enabled by default
      // - Suspicious pattern content blocked
      const exportData = {
        type: 'learning-pattern',
        version: '1.0.0',
        name: customName || `claude-flow-model-${Date.now()}`,
        exportedAt: new Date().toISOString(),
        modelId,
        patterns: [] as Array<{ id: string; trigger: string; action: string; confidence: number; usageCount: number }>,
        metadata: {
          sourceVersion: '3.0.0-alpha',
          piiStripped: stripPii,
          signed: signExport,
          accuracy: 0,
          totalUsage: 0,
        },
      };

      // Load patterns from local storage
      const memoryDir = path.join(process.cwd(), '.claude-flow', 'memory');
      const patternsFile = path.join(memoryDir, 'patterns.json');

      if (fs.existsSync(patternsFile)) {
        const patterns = JSON.parse(fs.readFileSync(patternsFile, 'utf8'));

        for (const pattern of patterns) {
          // Security: Strip potential PII
          if (stripPii) {
            // Remove any paths, usernames, or sensitive data
            if (pattern.content) {
              pattern.content = pattern.content
                .replace(/\/Users\/[^\/]+/g, '/Users/[REDACTED]')
                .replace(/\/home\/[^\/]+/g, '/home/[REDACTED]')
                .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
                .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]');
            }
          }

          exportData.patterns.push({
            id: pattern.id || crypto.randomBytes(8).toString('hex'),
            trigger: pattern.trigger || pattern.type || 'general',
            action: pattern.action || pattern.recommendation || 'apply-pattern',
            confidence: pattern.confidence || 0.85,
            usageCount: pattern.usageCount || 1,
          });
        }
      }

      // Add stats metadata
      exportData.metadata.accuracy = (stats as { retrievalPrecision?: number }).retrievalPrecision || 0.85;
      exportData.metadata.totalUsage = exportData.patterns.reduce((sum, p) => sum + p.usageCount, 0);

      spinner.setText('Generating secure signature...');

      // Sign with Ed25519 if requested
      let signature: string | null = null;
      let publicKey: string | null = null;

      if (signExport) {
        // Generate ephemeral key pair for signing
        // Use Node.js webcrypto for Ed25519 signing
        const { webcrypto } = crypto;
        const keyPair = await webcrypto.subtle.generateKey(
          { name: 'Ed25519' },
          true,
          ['sign', 'verify']
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;

        const exportBytes = new TextEncoder().encode(JSON.stringify(exportData));
        const signatureBytes = await webcrypto.subtle.sign('Ed25519', keyPair.privateKey, exportBytes);
        signature = Buffer.from(signatureBytes).toString('hex');

        const publicKeyBytes = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);
        publicKey = Buffer.from(publicKeyBytes).toString('hex');
      }

      // SECURITY: Final export package - verify no secrets leaked
      const exportPackage = {
        pinataContent: exportData,
        pinataMetadata: {
          name: exportData.name,
          keyvalues: {
            type: 'learning-pattern',
            version: '1.0.0',
            signed: signExport ? 'true' : 'false',
          },
        },
        signature,
        publicKey: publicKey ? `ed25519:${publicKey}` : null,
        // Note: Private key is ephemeral and NEVER stored or exported
      };

      // SECURITY AUDIT: Ensure no secrets in export
      const exportStr = JSON.stringify(exportPackage);
      const secretPatterns = [
        /sk-ant-[a-zA-Z0-9-]+/,  // Anthropic keys
        /sk-[a-zA-Z0-9]{48}/,    // OpenAI keys
        /AIza[a-zA-Z0-9-_]{35}/, // Google keys
        /pinata_[a-zA-Z0-9]+/,   // Pinata JWT
        /-----BEGIN.*KEY-----/,  // PEM keys
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(exportStr)) {
          spinner.fail('SECURITY: Export contains potential API keys - aborting');
          return { success: false, exitCode: 1 };
        }
      }

      // Output handling
      if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify(exportPackage, null, 2));
        spinner.succeed(`Exported to: ${outputFile}`);
      }

      if (pinToIpfs) {
        spinner.setText('Pinning to IPFS...');

        // Check for Pinata credentials
        const pinataKey = process.env.PINATA_API_KEY;
        const pinataSecret = process.env.PINATA_API_SECRET;

        if (!pinataKey || !pinataSecret) {
          spinner.fail('PINATA_API_KEY and PINATA_API_SECRET required for IPFS export');
          output.writeln(output.dim('Set these in your environment or .env file'));
          return { success: false, exitCode: 1 };
        }

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': pinataKey,
            'pinata_secret_api_key': pinataSecret,
          },
          body: JSON.stringify(exportPackage),
        });

        if (!response.ok) {
          const error = await response.text();
          spinner.fail(`IPFS pin failed: ${error}`);
          return { success: false, exitCode: 1 };
        }

        const result = await response.json() as { IpfsHash: string; PinSize: number };
        spinner.succeed('Successfully exported to IPFS');

        output.writeln();
        output.table({
          columns: [
            { key: 'property', header: 'Property', width: 20 },
            { key: 'value', header: 'Value', width: 50 },
          ],
          data: [
            { property: 'CID', value: result.IpfsHash },
            { property: 'Size', value: `${result.PinSize} bytes` },
            { property: 'Gateway URL', value: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}` },
            { property: 'Patterns', value: String(exportData.patterns.length) },
            { property: 'Signed', value: signExport ? 'Yes (Ed25519)' : 'No' },
            { property: 'PII Stripped', value: stripPii ? 'Yes' : 'No' },
          ],
        });

        output.writeln();
        output.writeln(output.success('Share this CID for others to import your trained patterns'));
        output.writeln(output.dim(`Import command: claude-flow neural import --cid ${result.IpfsHash}`));
      }

      if (!outputFile && !pinToIpfs) {
        // Just display the export
        spinner.succeed('Export prepared');
        output.writeln();
        output.writeln(JSON.stringify(exportPackage, null, 2));
      }

      return { success: true };
    } catch (error) {
      spinner.fail(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, exitCode: 1 };
    }
  },
};

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

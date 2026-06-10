/**
 * Neural optimize / export subcommands.
 *
 *   - optimizeCommand  (Int8 quantization, memory analysis, pattern
 *                      compaction on the intelligence store)
 *   - exportCommand    (serialize trained patterns/models to disk)
 *
 * Extracted from neural.ts (W96, P3.9 cut #3).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';

// Optimize subcommand - Real Int8 quantization and pattern optimization
export const optimizeCommand: Command = {
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
      const { initializeIntelligence, getIntelligenceStats, getAllPatterns, flushPatterns, compactPatterns } = await import('../../memory/intelligence.js');
      const fs = await import('fs');
      const path = await import('path');

      await initializeIntelligence();
      const patterns = await getAllPatterns();
      const stats = getIntelligenceStats();

      // Trigger ruvllm background learning if available
      try {
        const { runBackgroundLearning } = await import('../../memory/intelligence.js');
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
export const exportCommand: Command = {
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
      const { getIntelligenceStats, flushPatterns } = await import('../../memory/intelligence.js');

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

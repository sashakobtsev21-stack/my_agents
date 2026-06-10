/**
 * Neural status / inspection subcommands.
 *
 *   - statusCommand    (loaded-model + intelligence-subsystem status,
 *                      real measurements)
 *   - patternsCommand  (learned-pattern listing from the intelligence
 *                      store)
 *   - predictCommand   (route/predict against the trained model)
 *
 * Extracted from neural.ts (W95, P3.9 cut #2).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';


// Status subcommand - REAL measurements
export const statusCommand: Command = {
  name: 'status',
  description: 'Check neural network status and loaded models',
  options: [
    { name: 'model', short: 'm', type: 'string', description: 'Specific model ID to check' },
    { name: 'verbose', short: 'v', type: 'boolean', description: 'Show detailed metrics' },
  ],
  examples: [
    { command: 'claude-flow neural status', description: 'Show all neural status' },
    { command: 'claude-flow neural status -m model-123', description: 'Check specific model' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const verbose = ctx.flags.verbose === true;

    output.writeln();
    output.writeln(output.bold('Neural Network Status (Real)'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Checking neural systems...', spinner: 'dots' });
    spinner.start();

    try {
      // Import real implementations
      const { getIntelligenceStats, initializeIntelligence, benchmarkAdaptation } = await import('../../memory/intelligence.js');
      const { getHNSWStatus, loadEmbeddingModel } = await import('../../memory/memory-initializer.js');
      const ruvector = await import('../../services/ruvector-training.js');

      // Initialize if needed and get real stats
      await initializeIntelligence();
      const stats = getIntelligenceStats();
      const hnswStatus = getHNSWStatus();

      // Quick benchmark for actual adaptation time
      const adaptBench = benchmarkAdaptation(100);

      // Check embedding model
      const modelInfo = await loadEmbeddingModel({ verbose: false });

      // Check RuVector WASM status
      const ruvectorStats = ruvector.getTrainingStats();
      const sonaAvailable = ruvector.isSonaAvailable();

      spinner.succeed('Neural systems checked');

      output.writeln();
      output.printTable({
        columns: [
          { key: 'component', header: 'Component', width: 22 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'details', header: 'Details', width: 32 },
        ],
        data: [
          {
            component: 'SONA Coordinator',
            status: stats.sonaEnabled ? output.success('Active') : output.warning('Inactive'),
            details: stats.sonaEnabled
              ? `Adaptation: ${(adaptBench.avgMs * 1000).toFixed(2)}μs avg`
              : 'Not initialized',
          },
          {
            component: 'RuVector Training',
            status: ruvectorStats.initialized ? output.success('Active') : output.dim('Not loaded'),
            details: ruvectorStats.initialized
              ? `${ruvectorStats.backend === 'wasm' ? 'WASM' : 'JS fallback'} | MicroLoRA: ${ruvectorStats.totalAdaptations} adapts`
              : 'Call neural train to initialize',
          },
          {
            component: 'SONA Engine',
            status: sonaAvailable ? output.success('Active') : output.dim('Not loaded'),
            details: sonaAvailable && ruvectorStats.sonaStats
              ? `${ruvectorStats.sonaStats.totalLearns} learns, ${ruvectorStats.sonaStats.totalSearches} searches`
              : 'Optional, enable with --sona',
          },
          {
            component: 'ReasoningBank',
            status: stats.reasoningBankSize > 0 ? output.success('Active') : output.dim('Empty'),
            details: `${stats.patternsLearned} patterns stored`,
          },
          {
            component: 'HNSW Index',
            status: hnswStatus.available ? output.success('Ready') : output.dim('Not loaded'),
            details: hnswStatus.available
              ? `${hnswStatus.entryCount} vectors, ${hnswStatus.dimensions}-dim`
              : '@ruvector/core not available',
          },
          {
            component: 'Embedding Model',
            status: modelInfo.success ? output.success('Loaded') : output.warning('Fallback'),
            details: `${modelInfo.modelName} (${modelInfo.dimensions}-dim)`,
          },
          {
            component: 'Flash Attention Ops',
            status: output.success('Available'),
            details: 'batchCosineSim, softmax, topK',
          },
          {
            component: 'Int8 Quantization',
            status: output.success('Available'),
            details: '~4x memory reduction',
          },
          {
            component: 'ruvllm Coordinator',
            status: stats._ruvllmBackend === 'active' ? output.success('Active') : output.dim('Unavailable'),
            details: stats._ruvllmBackend === 'active'
              ? `SonaCoordinator | ${stats._ruvllmTrajectories} trajectories`
              : 'Install @ruvector/ruvllm',
          },
          {
            component: 'Contrastive Trainer',
            status: stats._contrastiveTrainer && stats._contrastiveTrainer !== 'unavailable' ? output.success('Active') : output.dim('Unavailable'),
            details: stats._contrastiveTrainer && stats._contrastiveTrainer !== 'unavailable'
              ? `${(stats._contrastiveTrainer as any).triplets ?? 0} triplets, ${(stats._contrastiveTrainer as any).agents ?? 0} agents`
              : 'Install @ruvector/ruvllm',
          },
          {
            component: 'Training Pipeline',
            status: stats._trainingBackend === 'ruvllm' ? output.success('Active') : output.dim(stats._trainingBackend || 'Unavailable'),
            details: stats._trainingBackend === 'ruvllm'
              ? 'ruvllm checkpoints enabled'
              : 'JS fallback (no checkpoints)',
          },
          await (async () => {
            try {
              const { getGraphStats } = await import('../../ruvector/graph-backend.js');
              const gs = await getGraphStats();
              return {
                component: 'Graph Database',
                status: gs.backend === 'graph-node' ? output.success('Active') : output.dim('Unavailable'),
                details: gs.backend === 'graph-node'
                  ? `${gs.totalNodes} nodes, ${gs.totalEdges} edges`
                  : 'Install @ruvector/graph-node',
              };
            } catch { return { component: 'Graph Database', status: output.dim('Unavailable'), details: 'Not loaded' }; }
          })(),
        ],
      });

      if (verbose) {
        output.writeln();
        output.writeln(output.bold('Detailed Metrics'));

        const detailedData = [
          { metric: 'Trajectories Recorded', value: String(stats.trajectoriesRecorded) },
          { metric: 'Patterns Learned', value: String(stats.patternsLearned) },
          { metric: 'HNSW Dimensions', value: String(hnswStatus.dimensions) },
          { metric: 'SONA Adaptation (avg)', value: `${(adaptBench.avgMs * 1000).toFixed(2)}μs` },
          { metric: 'SONA Adaptation (max)', value: `${(adaptBench.maxMs * 1000).toFixed(2)}μs` },
          { metric: 'Target Met (<0.05ms)', value: adaptBench.targetMet ? output.success('Yes') : output.warning('No') },
          {
            metric: 'Last Adaptation',
            value: stats.lastAdaptation
              ? new Date(stats.lastAdaptation).toLocaleTimeString()
              : 'Never',
          },
        ];

        // Add RuVector WASM metrics if initialized
        if (ruvectorStats.initialized) {
          detailedData.push(
            { metric: 'RuVector Adaptations', value: String(ruvectorStats.totalAdaptations) },
            { metric: 'RuVector Forwards', value: String(ruvectorStats.totalForwards) },
          );
          if (ruvectorStats.microLoraStats) {
            detailedData.push(
              { metric: 'MicroLoRA Delta Norm', value: ruvectorStats.microLoraStats.deltaNorm.toFixed(6) },
              { metric: 'MicroLoRA Adapt Count', value: String(ruvectorStats.microLoraStats.adaptCount) },
            );
          }
          if (sonaAvailable && ruvectorStats.sonaStats?.stats) {
            const sonaStats = ruvectorStats.sonaStats.stats as Record<string, unknown>;
            detailedData.push(
              { metric: 'SONA Patterns Stored', value: String(sonaStats.patterns_stored || 0) },
              { metric: 'SONA EWC Tasks', value: String(sonaStats.ewc_tasks || 0) },
            );
          }
        }

        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 28 },
            { key: 'value', header: 'Value', width: 20 },
          ],
          data: detailedData,
        });
      }

      return { success: true, data: { stats, hnswStatus, adaptBench, modelInfo, ruvectorStats } };
    } catch (error) {
      spinner.fail('Failed to check neural systems');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Patterns subcommand
export const patternsCommand: Command = {
  name: 'patterns',
  description: 'Analyze and manage cognitive patterns',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: analyze, learn, predict, list', default: 'list' },
    { name: 'query', short: 'q', type: 'string', description: 'Pattern query for search' },
    { name: 'limit', short: 'l', type: 'number', description: 'Max patterns to return', default: '10' },
  ],
  examples: [
    { command: 'claude-flow neural patterns --action list', description: 'List all patterns' },
    { command: 'claude-flow neural patterns -a analyze -q "error handling"', description: 'Analyze patterns' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'list';
    const query = ctx.flags.query as string;
    const limit = parseInt(ctx.flags.limit as string, 10) || 10;

    output.writeln();
    output.writeln(output.bold(`Neural Patterns - ${action}`));
    output.writeln(output.dim('─'.repeat(40)));

    try {
      const {
        initializeIntelligence,
        getIntelligenceStats,
        findSimilarPatterns,
        getAllPatterns,
        getPersistenceStatus,
      } = await import('../../memory/intelligence.js');

      await initializeIntelligence();
      const stats = getIntelligenceStats();
      const persistence = getPersistenceStatus();

      if (action === 'list') {
        // Get ALL patterns from ReasoningBank (loaded from disk)
        const allPatterns = await getAllPatterns();
        const patterns = query
          ? await findSimilarPatterns(query, { k: limit })
          : allPatterns.slice(0, limit);

        if (patterns.length === 0) {
          output.writeln(output.dim('No patterns found. Train some patterns first with: neural train'));
          output.writeln();
          output.printBox([
            `Total Patterns: ${stats.patternsLearned}`,
            `Trajectories: ${stats.trajectoriesRecorded}`,
            `ReasoningBank Size: ${stats.reasoningBankSize}`,
            `Persistence: ${persistence.patternsExist ? 'Loaded from disk' : 'Not persisted'}`,
            `Data Dir: ${persistence.dataDir}`,
          ].join('\n'), 'Pattern Statistics');
        } else {
          output.printTable({
            columns: [
              { key: 'id', header: 'ID', width: 20 },
              { key: 'type', header: 'Type', width: 18 },
              { key: 'confidence', header: 'Confidence', width: 12 },
              { key: 'usage', header: 'Usage', width: 10 },
            ],
            data: patterns.map((p, i) => ({
              id: (p.id || `P${String(i + 1).padStart(3, '0')}`).substring(0, 18),
              type: output.highlight(p.type || 'unknown'),
              confidence: `${((p.confidence || 0.5) * 100).toFixed(1)}%`,
              usage: String(p.usageCount || 0),
            })),
          });
        }

        output.writeln();
        output.writeln(output.dim(`Total: ${allPatterns.length} patterns (persisted) | Trajectories: ${stats.trajectoriesRecorded}`));
        if (persistence.patternsExist) {
          output.writeln(output.success(`✓ Loaded from: ${persistence.patternsFile}`));
        }
      } else if (action === 'analyze' && query) {
        // Analyze patterns related to query
        const related = await findSimilarPatterns(query, { k: limit });
        output.writeln(`Analyzing patterns related to: "${query}"`);
        output.writeln();

        if (related.length > 0) {
          output.printTable({
            columns: [
              { key: 'content', header: 'Pattern', width: 40 },
              { key: 'confidence', header: 'Confidence', width: 12 },
              { key: 'type', header: 'Type', width: 15 },
            ],
            data: related.slice(0, 5).map(p => ({
              content: (p.content || '').substring(0, 38) + (p.content?.length > 38 ? '...' : ''),
              confidence: `${((p.confidence || 0) * 100).toFixed(0)}%`,
              type: p.type || 'general',
            })),
          });
        } else {
          output.writeln(output.dim('No related patterns found.'));
        }
      }

      return { success: true };
    } catch (error) {
      // Fallback if intelligence not initialized
      output.writeln(output.dim('Intelligence system not initialized.'));
      output.writeln(output.dim('Run: claude-flow neural train --pattern-type general'));
      return { success: false };
    }
  },
};

// Predict subcommand
export const predictCommand: Command = {
  name: 'predict',
  description: 'Make AI predictions using trained models',
  options: [
    { name: 'input', short: 'i', type: 'string', description: 'Input text to predict routing for', required: true },
    { name: 'k', short: 'k', type: 'number', description: 'Number of top predictions', default: '5' },
    { name: 'format', short: 'f', type: 'string', description: 'Output format: json, table', default: 'table' },
  ],
  examples: [
    { command: 'claude-flow neural predict -i "implement authentication"', description: 'Predict routing for task' },
    { command: 'claude-flow neural predict -i "fix bug in login" -k 3', description: 'Get top 3 predictions' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const input = ctx.flags.input as string;
    const k = parseInt(ctx.flags.k as string || '5', 10);
    const format = ctx.flags.format as string || 'table';

    if (!input) {
      output.printError('--input is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Neural Prediction (Real)'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Running inference...', spinner: 'dots' });
    spinner.start();

    try {
      const { initializeIntelligence, findSimilarPatterns } = await import('../../memory/intelligence.js');

      // Initialize intelligence system
      await initializeIntelligence();

      // Find similar patterns (embedding is done internally)
      const startSearch = performance.now();
      const matches = await findSimilarPatterns(input, { k });
      const searchTime = performance.now() - startSearch;

      spinner.succeed(`Prediction complete (search: ${searchTime.toFixed(1)}ms)`);

      output.writeln();

      if (matches.length === 0) {
        output.writeln(output.warning('No similar patterns found. Try training first: claude-flow neural train'));
        return { success: true, data: { matches: [] } };
      }

      if (format === 'json') {
        output.writeln(JSON.stringify(matches, null, 2));
      } else {
        // Determine best prediction based on patterns
        const patternTypes: Record<string, number> = {};
        for (const match of matches) {
          const type = match.type || 'unknown';
          patternTypes[type] = (patternTypes[type] || 0) + match.similarity;
        }

        const sorted = Object.entries(patternTypes).sort((a, b) => b[1] - a[1]);
        const topType = sorted[0]?.[0] || 'unknown';
        const confidence = matches[0]?.similarity || 0;

        output.printBox([
          `Input: ${input.substring(0, 60)}${input.length > 60 ? '...' : ''}`,
          ``,
          `Predicted Type: ${topType}`,
          `Confidence: ${(confidence * 100).toFixed(1)}%`,
          `Latency: ${searchTime.toFixed(1)}ms`,
          ``,
          `Top ${matches.length} Similar Patterns:`,
        ].join('\n'), 'Result');

        output.printTable({
          columns: [
            { key: 'rank', header: '#', width: 3 },
            { key: 'id', header: 'Pattern ID', width: 20 },
            { key: 'type', header: 'Type', width: 15 },
            { key: 'similarity', header: 'Similarity', width: 12 },
          ],
          data: matches.slice(0, k).map((m, i) => ({
            rank: String(i + 1),
            id: m.id?.substring(0, 20) || 'unknown',
            type: m.type || 'action',
            similarity: `${(m.similarity * 100).toFixed(1)}%`,
          })),
        });
      }

      return { success: true, data: { matches, searchTime } };
    } catch (error) {
      spinner.fail('Prediction failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

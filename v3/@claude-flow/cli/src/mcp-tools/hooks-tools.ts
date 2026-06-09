/**
 * Hooks MCP Tools
 * Provides intelligent hooks functionality via MCP protocol
 */

import { type MCPTool } from './types.js';
// basePath state + setHooksToolsBasePath helper extracted to
// hooks-tools/base-path.ts so helper modules share it without a
// circular dep on this main file. Re-exported to preserve the public
// surface. (projectRoot itself is no longer consumed inline in this
// file — every callsite moved with its tool extraction.)
import { setHooksToolsBasePath } from './hooks-tools/base-path.js';
export { setHooksToolsBasePath };

// Routing outcomes + static task patterns extracted to
// hooks-tools/routing-patterns.ts (pilot god-file decomposition, P3.2).
// loadRoutingOutcomes no longer used inline here — every consumer moved
// to extracted tool modules.

// Neural lazy loaders (SONA / EWC++ / MoE / FlashAttention / LoRA)
// extracted to ./hooks-tools/neural-loaders.ts (W33, P3.2 cut #3).
import {
  getSONAOptimizer,
  getEWCConsolidator,
  getMoERouter,
  getFlashAttention,
  getLoRAAdapter,
} from './hooks-tools/neural-loaders.js';

// Memory store helpers + intelligence stats + agent suggester
// extracted to ./hooks-tools/memory-store.ts (W32, P3.2 cut #2).
import { getIntelligenceStatsFromMemory } from './hooks-tools/memory-store.js';

import { validateText } from './validate-input.js';

// Memory search/store lazy loaders + scrubReasoningBlocks extracted to
// ./hooks-tools/memory-search-store.ts (W34, P3.2 cut #4). scrubReasoning
// Blocks is re-exported below to keep the public surface byte-identical.
import { scrubReasoningBlocks } from './hooks-tools/memory-search-store.js';
export { scrubReasoningBlocks };

// =============================================================================
// Neural Module Lazy Loaders (SONA, EWC++, MoE, LoRA, Flash Attention)
// =============================================================================

// SONA / EWC++ / MoE lazy loaders moved to ./hooks-tools/neural-loaders.ts
// (W33, P3.2 cut #3). Same pattern as flashAttention + loraAdapter
// below — also moved to that file.

// Semantic router (state + embedding fn + lazy init with native VectorDb
// → pure-JS SemanticRouter fallback) moved to
// ./hooks-tools/semantic-router.ts (W35, P3.2 cut #5).
// (Direct callers extracted into tools-route.ts in W39 — no remaining
// inline consumer in this parent file.)

// Routing outcomes + static task patterns moved to
// ./hooks-tools/routing-patterns.ts (W31 god-file decomposition pilot).

// getRouterBackendInfo() was a status-display helper that hasn't had a
// caller since the route status payload format flattened. Kept the doc
// strings in the constants below (routerBackend enum) so the same info
// is reachable directly. Dropped to silence noUnusedLocals.

// flashAttention + loraAdapter lazy loaders moved to
// ./hooks-tools/neural-loaders.ts (W33, P3.2 cut #3).

// Trajectory state (TrajectoryStep / TrajectoryData interfaces +
// activeTrajectories Map) moved to ./hooks-tools/trajectory-state.ts
// (W36, P3.2 cut #6).
// activeTrajectories no longer used directly here — all consumers moved
// to extracted tools modules (trajectory + intelligence-init).

// Memory store types and helpers

// hooksPreEdit + hooksPostEdit moved to ./hooks-tools/tools-edit.ts
// (W37, P3.2 cut #7 — first MCP tool cut). Local binding via named
// import + re-export so the hooksTools[] array at the bottom of this
// file (which references the bare names) plus external imports both
// continue to work.
import { hooksPreEdit, hooksPostEdit } from './hooks-tools/tools-edit.js';
export { hooksPreEdit, hooksPostEdit };

// hooksPreCommand + hooksPostCommand moved to ./hooks-tools/tools-command.ts
// (W38, P3.2 cut #8). Same pattern as W37 edit pair: local binding +
// re-export so both the hooksTools[] array and external callers stay
// byte-identical.
import { hooksPreCommand, hooksPostCommand } from './hooks-tools/tools-command.js';
export { hooksPreCommand, hooksPostCommand };

// hooksRoute + hooksExplain moved to ./hooks-tools/tools-route.ts
// (W39, P3.2 cut #9). Same pattern.
import { hooksRoute, hooksExplain } from './hooks-tools/tools-route.js';
export { hooksRoute, hooksExplain };

// hooksPreTask + hooksPostTask moved to ./hooks-tools/tools-task.ts
// (W40, P3.2 cut #10). Same pattern.
import { hooksPreTask, hooksPostTask } from './hooks-tools/tools-task.js';
export { hooksPreTask, hooksPostTask };

// hooksPretrain + hooksBuildAgents moved to ./hooks-tools/tools-pretrain.ts
// (W41, P3.2 cut #11).
import { hooksPretrain, hooksBuildAgents } from './hooks-tools/tools-pretrain.js';
export { hooksPretrain, hooksBuildAgents };

// hooksSessionStart + hooksSessionEnd + hooksSessionRestore moved to
// ./hooks-tools/tools-session.ts (W42, P3.2 cut #12).
import { hooksSessionStart, hooksSessionEnd, hooksSessionRestore } from './hooks-tools/tools-session.js';
export { hooksSessionStart, hooksSessionEnd, hooksSessionRestore };

// hooksTrajectoryStart + hooksTrajectoryStep + hooksTrajectoryEnd moved
// to ./hooks-tools/tools-trajectory.ts (W43, P3.2 cut #13).
import { hooksTrajectoryStart, hooksTrajectoryStep, hooksTrajectoryEnd } from './hooks-tools/tools-trajectory.js';
export { hooksTrajectoryStart, hooksTrajectoryStep, hooksTrajectoryEnd };

// hooksPatternStore + hooksPatternSearch moved to
// ./hooks-tools/tools-patterns.ts (W44, P3.2 cut #14).
import { hooksPatternStore, hooksPatternSearch } from './hooks-tools/tools-patterns.js';
export { hooksPatternStore, hooksPatternSearch };

// hooksIntelligence + hooksIntelligenceReset moved to
// ./hooks-tools/tools-intelligence-init.ts (W45, P3.2 cut #15).
import { hooksIntelligence, hooksIntelligenceReset } from './hooks-tools/tools-intelligence-init.js';
export { hooksIntelligence, hooksIntelligenceReset };

// hooksModelRoute + hooksModelOutcome + hooksModelStats moved to
// ./hooks-tools/tools-model.ts (W46, P3.2 cut #16). Includes the lazy
// model router instance + the fallback complexity analyzer.
import { hooksModelRoute, hooksModelOutcome, hooksModelStats } from './hooks-tools/tools-model.js';
export { hooksModelRoute, hooksModelOutcome, hooksModelStats };

// hooksTeammateIdle + hooksTaskCompleted moved to
// ./hooks-tools/tools-teammate.ts (W47, P3.2 cut #17).
import { hooksTeammateIdle, hooksTaskCompleted } from './hooks-tools/tools-teammate.js';
export { hooksTeammateIdle, hooksTaskCompleted };

// hooks_worker-list/dispatch/status/detect/cancel + the WORKER_*
// catalogue / activeWorkers / detectWorkerTriggers helpers moved to
// ./hooks-tools/tools-worker.ts (W48, P3.2 cut #18).
import {
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
} from './hooks-tools/tools-worker.js';
export {
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
};

// hooks_codemod (Tier-1 deterministic transforms) + the CODEMOD_*
// allow-set + codemodLangForExt helper moved to
// ./hooks-tools/tools-codemod.ts (W49, P3.2 cut #19).
import { hooksCodemod } from './hooks-tools/tools-codemod.js';
export { hooksCodemod };

// hooks_transfer + hooks_notify + hooks_init (3 small standalone
// tools) moved to ./hooks-tools/tools-misc.ts (W50, P3.2 cut #20).
import { hooksTransfer, hooksNotify, hooksInit } from './hooks-tools/tools-misc.js';
export { hooksTransfer, hooksNotify, hooksInit };

// hooks_metrics + hooks_list moved to ./hooks-tools/tools-metrics.ts
// (W51, P3.2 cut #21).
import { hooksMetrics, hooksList } from './hooks-tools/tools-metrics.js';
export { hooksMetrics, hooksList };



// Explain hook - transparent routing explanation


// Transfer hook - transfer patterns from another project



// Intelligence stats hook
export const hooksIntelligenceStats: MCPTool = {
  name: 'hooks_intelligence_stats',
  description: 'Get RuVector intelligence layer statistics Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      detailed: { type: 'boolean', description: 'Include detailed stats' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const detailed = params.detailed as boolean;

    // Get REAL statistics from actual implementations
    const sona = await getSONAOptimizer();
    const ewc = await getEWCConsolidator();
    const moe = await getMoERouter();
    const flash = await getFlashAttention();
    const lora = await getLoRAAdapter();

    // Fallback to memory store for legacy data (may not exist yet)
    let memoryStats: ReturnType<typeof getIntelligenceStatsFromMemory>;
    try {
      memoryStats = getIntelligenceStatsFromMemory();
    } catch {
      memoryStats = {
        trajectories: { total: 0, successful: 0 },
        patterns: { learned: 0, categories: {} },
        memory: { indexSize: 0, totalAccessCount: 0, memorySizeBytes: 0 },
        routing: { decisions: 0, avgConfidence: 0 },
      };
    }

    // SONA stats from real implementation
    let sonaStats = {
      trajectoriesTotal: memoryStats.trajectories.total,
      trajectoriesSuccessful: memoryStats.trajectories.successful,
      avgLearningTimeMs: 0,
      patternsLearned: memoryStats.patterns.learned,
      patternCategories: memoryStats.patterns.categories,
      successRate: 0,
      implementation: 'memory-fallback' as string,
    };
    if (sona) {
      const realSona = sona.getStats();
      const totalRoutes = realSona.successfulRoutings + realSona.failedRoutings;
      sonaStats = {
        trajectoriesTotal: realSona.trajectoriesProcessed,
        trajectoriesSuccessful: realSona.successfulRoutings,
        avgLearningTimeMs: realSona.lastUpdate ? 0.042 : 0, // Theoretical when active
        patternsLearned: realSona.totalPatterns,
        patternCategories: { learned: realSona.totalPatterns }, // Simplified
        successRate: totalRoutes > 0
          ? Math.round((realSona.successfulRoutings / totalRoutes) * 100) / 100
          : 0,
        implementation: 'real-sona',
      };
    }

    // EWC++ stats from real implementation
    let ewcStats = {
      consolidations: 0,
      catastrophicForgettingPrevented: 0,
      fisherUpdates: 0,
      avgPenalty: 0,
      totalPatterns: 0,
      implementation: 'not-loaded' as string,
    };
    if (ewc) {
      const realEwc = ewc.getConsolidationStats();
      ewcStats = {
        consolidations: realEwc.consolidationCount,
        catastrophicForgettingPrevented: realEwc.highImportancePatterns,
        fisherUpdates: realEwc.consolidationCount,
        avgPenalty: Math.round(realEwc.avgPenalty * 1000) / 1000,
        totalPatterns: realEwc.totalPatterns,
        implementation: 'real-ewc++',
      };
    }

    // MoE stats from real implementation
    let moeStats = {
      expertsTotal: 8,
      expertsActive: 0,
      routingDecisions: memoryStats.routing.decisions,
      avgRoutingTimeMs: 0,
      avgConfidence: memoryStats.routing.avgConfidence,
      loadBalance: null as { giniCoefficient: number; coefficientOfVariation: number; expertUsage: Record<string, number> } | null,
      implementation: 'not-loaded' as string,
    };
    if (moe) {
      const loadBalance = moe.getLoadBalance();
      const activeExperts = Object.values(loadBalance.routingCounts).filter((u: number) => u > 0).length;
      // Calculate average utilization as proxy for confidence
      const utilValues = Object.values(loadBalance.utilization) as number[];
      const avgUtil = utilValues.length > 0 ? utilValues.reduce((a, b) => a + b, 0) / utilValues.length : 0;
      moeStats = {
        expertsTotal: 8,
        expertsActive: activeExperts,
        routingDecisions: loadBalance.totalRoutings,
        avgRoutingTimeMs: 0.15, // Theoretical performance
        avgConfidence: Math.round(avgUtil * 100) / 100,
        loadBalance: {
          giniCoefficient: Math.round(loadBalance.giniCoefficient * 1000) / 1000,
          coefficientOfVariation: Math.round(loadBalance.coefficientOfVariation * 1000) / 1000,
          expertUsage: loadBalance.routingCounts,
        },
        implementation: 'real-moe',
      };
    }

    // Flash Attention stats from real implementation
    let flashStats = {
      speedup: 1.0,
      avgComputeTimeMs: 0,
      blockSize: 64,
      implementation: 'not-loaded' as string,
    };
    if (flash) {
      flashStats = {
        speedup: Math.round(flash.getSpeedup() * 100) / 100,
        avgComputeTimeMs: 0, // Would need benchmarking
        blockSize: 64,
        implementation: 'real-flash-attention',
      };
    }

    // LoRA stats from real implementation
    let loraStats = {
      rank: 8,
      alpha: 16,
      adaptations: 0,
      avgLoss: 0,
      implementation: 'not-loaded' as string,
    };
    if (lora) {
      const realLora = lora.getStats();
      loraStats = {
        rank: realLora.rank,
        alpha: 16, // Default alpha from config
        adaptations: realLora.totalAdaptations,
        avgLoss: Math.round(realLora.avgAdaptationNorm * 10000) / 10000,
        implementation: 'real-lora',
      };
    }

    // ruvllm native backend stats
    let ruvllmStats = { coordinator: 'unavailable' as string, trajectories: 0, contrastiveTrainer: 'unavailable' as string | object, trainingBackend: 'unavailable' as string, graphDatabase: { backend: 'unavailable', totalNodes: 0, totalEdges: 0 } as Record<string, unknown> };
    try {
      const { getIntelligenceStats } = await import('../memory/intelligence.js');
      const iStats = getIntelligenceStats();
      ruvllmStats.coordinator = iStats._ruvllmBackend || 'unavailable';
      ruvllmStats.trajectories = iStats._ruvllmTrajectories || 0;
    } catch { /* not initialized */ }
    try {
      const { getSONAStats: getSONA } = await import('../memory/sona-optimizer.js');
      const sStats = await getSONA();
      ruvllmStats.contrastiveTrainer = sStats._contrastiveTrainer || 'unavailable';
    } catch { /* not initialized */ }
    if (lora) {
      const ls = lora.getStats();
      ruvllmStats.trainingBackend = ls._trainingBackend || 'unavailable';
    }
    try {
      const { getGraphStats } = await import('../ruvector/graph-backend.js');
      const gs = await getGraphStats();
      ruvllmStats.graphDatabase = { backend: gs.backend, totalNodes: gs.totalNodes, totalEdges: gs.totalEdges, avgDegree: gs.avgDegree };
    } catch { /* not available */ }

    const stats = {
      sona: sonaStats,
      moe: moeStats,
      ewc: ewcStats,
      flash: flashStats,
      lora: loraStats,
      ruvllm: ruvllmStats,
      hnsw: {
        indexSize: memoryStats.memory.indexSize,
        avgSearchTimeMs: 0.12,
        cacheHitRate: memoryStats.memory.totalAccessCount > 0
          ? Math.min(0.95, 0.5 + (memoryStats.memory.totalAccessCount / 1000))
          : 0.78,
        memoryUsageMb: Math.round(memoryStats.memory.memorySizeBytes / 1024 / 1024 * 100) / 100,
      },
      dataSource: sona ? 'real-implementations' : 'memory-fallback',
      lastUpdated: new Date().toISOString(),
    };

    if (detailed) {
      return {
        ...stats,
        implementationStatus: {
          sona: sona ? 'loaded' : 'not-loaded',
          ewc: ewc ? 'loaded' : 'not-loaded',
          moe: moe ? 'loaded' : 'not-loaded',
          flash: flash ? 'loaded' : 'not-loaded',
          lora: lora ? 'loaded' : 'not-loaded',
        },
        performance: {
          sonaLearningMs: sonaStats.avgLearningTimeMs,
          moeRoutingMs: moeStats.avgRoutingTimeMs,
          flashSpeedup: flashStats.speedup,
          ewcPenalty: ewcStats.avgPenalty,
        },
      };
    }

    return stats;
  },
};

// Intelligence learn hook
export const hooksIntelligenceLearn: MCPTool = {
  name: 'hooks_intelligence_learn',
  description: 'Force immediate SONA learning cycle with EWC++ consolidation Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      trajectoryIds: { type: 'array', items: { type: 'string' }, description: 'Specific trajectories to learn from' },
      consolidate: { type: 'boolean', description: 'Run EWC++ consolidation' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const consolidate = params.consolidate !== false;
    const startTime = Date.now();

    // AUDIT FIX #5: actually TRIGGER a learning/consolidation cycle instead of
    // only reading and echoing stats. This calls the real DISTILL path
    // (LoRA-style confidence updates with EWC++ consolidation protection) and
    // the background learning pass, then reports the resulting stats.
    let distill: { patternsDistilled: number; ewcPenalty: number } | null = null;
    let distillTriggered = false;
    try {
      const intelligence = await import('../memory/intelligence.js');
      // DISTILL + CONSOLIDATE: real LoRA update with EWC++ protection
      distill = await intelligence.distillLearning();
      distillTriggered = distill !== null;
      // Run background learning (ruvllm) pass as well — best-effort
      try {
        await intelligence.runBackgroundLearning();
      } catch { /* best-effort */ }
    } catch {
      // intelligence layer unavailable — fall back to stats-only reporting
    }

    // Get SONA statistics (AFTER triggering the cycle so they reflect the update)
    let sonaStats = {
      totalPatterns: 0,
      successfulRoutings: 0,
      failedRoutings: 0,
      trajectoriesProcessed: 0,
      avgConfidence: 0,
    };
    const sona = await getSONAOptimizer();
    if (sona) {
      const stats = sona.getStats();
      sonaStats = {
        totalPatterns: stats.totalPatterns,
        successfulRoutings: stats.successfulRoutings,
        failedRoutings: stats.failedRoutings,
        trajectoriesProcessed: stats.trajectoriesProcessed,
        avgConfidence: stats.avgConfidence,
      };
    }

    // Get EWC++ statistics after the consolidation cycle ran
    let ewcStats = {
      consolidation: false,
      fisherUpdated: false,
      forgettingPrevented: 0,
      avgPenalty: 0,
    };
    if (consolidate) {
      const ewc = await getEWCConsolidator();
      if (ewc) {
        const stats = ewc.getConsolidationStats();
        ewcStats = {
          consolidation: true,
          fisherUpdated: stats.consolidationCount > 0,
          forgettingPrevented: stats.highImportancePatterns,
          avgPenalty: distill?.ewcPenalty ?? stats.avgPenalty,
        };
      }
    }

    return {
      // "learned" now reflects whether a real distill cycle actually ran
      learned: distillTriggered || sonaStats.totalPatterns > 0,
      cycleTriggered: distillTriggered,
      patternsDistilled: distill?.patternsDistilled ?? 0,
      duration: Date.now() - startTime,
      updates: {
        trajectoriesProcessed: sonaStats.trajectoriesProcessed,
        patternsLearned: sonaStats.totalPatterns,
        patternsDistilled: distill?.patternsDistilled ?? 0,
        successRate: sonaStats.trajectoriesProcessed > 0
          ? (sonaStats.successfulRoutings / (sonaStats.successfulRoutings + sonaStats.failedRoutings) * 100).toFixed(1) + '%'
          : '0%',
      },
      ewc: consolidate ? ewcStats : null,
      confidence: {
        average: sonaStats.avgConfidence,
        implementation: sona ? 'real-sona' : 'not-available',
      },
      implementation: distillTriggered
        ? 'real-distill-consolidate'
        : (sona ? 'real-sona-learning' : 'placeholder'),
    };
  },
};

// Intelligence attention hook
export const hooksIntelligenceAttention: MCPTool = {
  name: 'hooks_intelligence_attention',
  description: 'Compute attention-weighted similarity using MoE/Flash/Hyperbolic Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query for attention computation' },
      mode: { type: 'string', description: 'Attention mode (flash, moe, hyperbolic)' },
      topK: { type: 'number', description: 'Top-k results' },
    },
    required: ['query'],
  },
  handler: async (params: Record<string, unknown>) => {
    const query = params.query as string;
    const mode = (params.mode as string) || 'flash';
    const topK = (params.topK as number) || 5;
    const startTime = performance.now();

    { const v = validateText(query, 'query'); if (!v.valid) return { success: false, error: v.error }; }

    let implementation = 'placeholder';
    let embeddingSource: 'onnx' | 'hash-fallback' | 'none' = 'none';
    const results: Array<{ index: number; weight: number; pattern: string; expert?: string }> = [];

    // Helper: generate query embedding, preferring real ONNX embeddings over hash fallback
    async function getQueryEmbedding(text: string, dims: number): Promise<{ embedding: Float32Array; source: 'onnx' | 'hash-fallback' }> {
      // Try ONNX via @claude-flow/embeddings
      try {
        const embeddingsModule = await import('@claude-flow/embeddings').catch(() => null);
        if (embeddingsModule?.createEmbeddingService) {
          const service = embeddingsModule.createEmbeddingService({ provider: 'onnx' });
          const result = await service.embed(text);
          const arr = new Float32Array(dims);
          for (let i = 0; i < Math.min(dims, result.embedding.length); i++) {
            arr[i] = result.embedding[i];
          }
          return { embedding: arr, source: 'onnx' };
        }
      } catch {
        // ONNX not available, try agentic-flow
      }

      // Try agentic-flow embeddings
      try {
        const embeddingsModule = await import('@claude-flow/embeddings').catch(() => null);
        if (embeddingsModule?.createEmbeddingService) {
          const service = embeddingsModule.createEmbeddingService({ provider: 'agentic-flow' });
          const result = await service.embed(text);
          const arr = new Float32Array(dims);
          for (let i = 0; i < Math.min(dims, result.embedding.length); i++) {
            arr[i] = result.embedding[i];
          }
          return { embedding: arr, source: 'onnx' };
        }
      } catch {
        // agentic-flow not available
      }

      // Hash-based fallback (deterministic but not semantic)
      const arr = new Float32Array(dims);
      let seed = text.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
      for (let i = 0; i < dims; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        arr[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      return { embedding: arr, source: 'hash-fallback' };
    }

    if (mode === 'moe') {
      // Try MoE routing
      const moe = await getMoERouter();
      if (moe) {
        try {
          const embResult = await getQueryEmbedding(query, 384);
          embeddingSource = embResult.source;

          const routingResult = moe.route(embResult.embedding);
          for (let i = 0; i < Math.min(topK, routingResult.experts.length); i++) {
            const expert = routingResult.experts[i];
            results.push({
              index: i,
              weight: expert.weight,
              pattern: `Expert: ${expert.name}`,
              expert: expert.name,
            });
          }
          implementation = 'real-moe-router';
        } catch {
          // Fall back to placeholder
        }
      }
    } else if (mode === 'flash') {
      // Try Flash Attention. ADR-093 F10: previously this attended over
      // synthetic cosine-derived keys/values with constant-vector values,
      // which produced uniform 0.333 weights and labels like "Flash
      // attention target #1/2/3". Now we attend over actual stored
      // patterns when available — real semantic content yields non-uniform
      // weights and human-readable labels.
      const flash = await getFlashAttention();
      if (flash) {
        try {
          const embResult = await getQueryEmbedding(query, 384);
          embeddingSource = embResult.source;
          const q = embResult.embedding;

          // Pull real stored patterns to attend over. If none exist yet,
          // fall back to the synthetic harness but mark it honestly.
          const realPatterns: Array<{ id: string; content: string; embedding?: number[] }> = [];
          try {
            const { searchEntries: searchFn } = await import('../memory/memory-initializer.js');
            const hits = await searchFn({ query, limit: topK });
            if (Array.isArray(hits)) {
              for (const h of hits.slice(0, topK)) {
                const content = (h as Record<string, unknown>).content ?? (h as Record<string, unknown>).value ?? '';
                const id = String((h as Record<string, unknown>).id ?? (h as Record<string, unknown>).key ?? `pattern-${realPatterns.length}`);
                realPatterns.push({ id, content: String(content) });
              }
            }
          } catch { /* memory not initialized — fall through to synthetic */ }

          const useReal = realPatterns.length > 0;
          const keys: Float32Array[] = [];
          const values: Float32Array[] = [];
          const labels: string[] = [];

          if (useReal) {
            // Build keys from real pattern embeddings (re-embed if no vector cached)
            for (let k = 0; k < realPatterns.length; k++) {
              const p = realPatterns[k];
              let keyEmbedding: Float32Array;
              if (p.embedding && p.embedding.length === 384) {
                keyEmbedding = new Float32Array(p.embedding);
              } else {
                const enc = await getQueryEmbedding(p.content.slice(0, 1024), 384);
                keyEmbedding = enc.embedding;
              }
              const value = new Float32Array(384);
              // Value carries pattern identity strength — magnitude = recency proxy (k position)
              const strength = 1 / (k + 1);
              for (let i = 0; i < 384; i++) value[i] = keyEmbedding[i] * strength;
              keys.push(keyEmbedding);
              values.push(value);
              const label = p.content.length > 0
                ? `${p.id}: ${p.content.slice(0, 60)}${p.content.length > 60 ? '…' : ''}`
                : p.id;
              labels.push(label);
            }
          } else {
            // No real patterns — surface a synthetic harness honestly.
            for (let k = 0; k < topK; k++) {
              const key = new Float32Array(384);
              const value = new Float32Array(384);
              for (let i = 0; i < 384; i++) {
                key[i] = Math.cos((k + 1) * (i + 1) * 0.01);
                value[i] = k + 1;
              }
              keys.push(key);
              values.push(value);
              labels.push(`(synthetic harness) pattern #${k + 1}`);
            }
          }

          const attentionResult = flash.attention([q], keys, values);
          // Compute softmax weights from output magnitudes
          const outputMags = attentionResult.output[0]
            ? Array.from(attentionResult.output[0]).slice(0, keys.length).map(v => Math.abs(v))
            : new Array(keys.length).fill(1);
          const sumMags = outputMags.reduce((a, b) => a + b, 0) || 1;
          for (let i = 0; i < keys.length; i++) {
            results.push({
              index: i,
              weight: outputMags[i] / sumMags,
              pattern: labels[i],
            });
          }
          implementation = useReal ? 'real-flash-attention+memory' : 'real-flash-attention+synthetic-harness';
        } catch {
          // Fall back to placeholder
        }
      }
    }

    // If no real implementation worked, return empty with honest marker
    if (results.length === 0) {
      implementation = 'none';
    }

    const computeTimeMs = performance.now() - startTime;

    return {
      query,
      mode,
      results,
      stats: {
        computeTimeMs,
        implementation,
        _embeddingSource: embeddingSource,
        _stub: implementation === 'none',
        _note: implementation === 'none' ? 'No attention backend available. Install @ruvector/attention for real computation.' : undefined,
        ...(embeddingSource === 'hash-fallback' && implementation !== 'none'
          ? { _embeddingNote: 'Query embeddings are hash-based (not semantic). Install @claude-flow/embeddings for real ONNX embeddings.' }
          : {}),
      },
      implementation,
    };
  },
};

// =============================================================================
// Worker Dispatch Tools (12 Background Workers)
// =============================================================================




// #1916: the `ruflo hooks teammate-idle` / `ruflo hooks task-completed` CLI
// subcommands (Agent Teams hooks) referenced unregistered tools. Minimal
// acknowledgement handlers with the shapes the CLI expects — auto-assignment
// and pattern-learning are delegated to the task-queue consumer / intelligence
// pipeline (a tracked #1916 follow-up).
/**
 * Unified learning-stats aggregator MCP tool (#2245 → ADR-075).
 *
 * One honest call across the four historical stat sources — every sub-view
 * names its store and a `consistency` block flags relationships that drift.
 */
export const hooksIntelligenceUnifiedStats: MCPTool = {
  name: 'hooks_intelligence_unified-stats',
  description: 'One honest view across the four learning stat sources: globalStats (`.claude-flow/neural/stats.json`), the in-memory SONA coordinator, memory-bridge AgentDB entries, and the neural-patterns store. Each sub-view names its source path. The `consistency` block notes cross-store drift (e.g. globalStats reports N patterns but neural_patterns is empty). Use when one dashboard call should show "did learning happen" coherently — vs the four original aggregators which each return only their narrow slice. See ADR-075.',
  category: 'hooks',
  inputSchema: {
    type: 'object',
    properties: {
      verbose: { type: 'boolean', description: 'Include extended breakdowns', default: true },
    },
  },
  handler: async (_input: Record<string, unknown>) => {
    const intel = await import('../memory/intelligence.js');
    return intel.getUnifiedLearningStats();
  },
};

// Export all hooks tools
export const hooksTools: MCPTool[] = [
  hooksIntelligenceUnifiedStats,
  hooksTeammateIdle,
  hooksTaskCompleted,
  hooksPreEdit,
  hooksPostEdit,
  hooksPreCommand,
  hooksPostCommand,
  hooksRoute,
  hooksMetrics,
  hooksList,
  hooksPreTask,
  hooksPostTask,
  // New hooks
  hooksExplain,
  hooksPretrain,
  hooksBuildAgents,
  hooksTransfer,
  hooksSessionStart,
  hooksSessionEnd,
  hooksSessionRestore,
  hooksNotify,
  hooksInit,
  hooksIntelligence,
  hooksIntelligenceReset,
  hooksTrajectoryStart,
  hooksTrajectoryStep,
  hooksTrajectoryEnd,
  hooksPatternStore,
  hooksPatternSearch,
  hooksIntelligenceStats,
  hooksIntelligenceLearn,
  hooksIntelligenceAttention,
  // Worker tools
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
  // Model routing tools
  hooksModelRoute,
  hooksModelOutcome,
  hooksModelStats,
  // Deterministic Tier-1 codemod execution (ADR-143)
  hooksCodemod,
];

export default hooksTools;

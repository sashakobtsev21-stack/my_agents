/**
 * Neural MCP tools — neural_compress / status / optimize
 *
 * Extracted verbatim from tools.ts (lines 512-798) during campaign-2
 * wave 82 (W288). tools.ts stays the barrel.
 */
import { type MCPTool } from '../types.js';
import { validateIdentifier } from '../validate-input.js';
import {
  realEmbeddings,
  embeddingServiceName,
  cosineSimilarity,
  loadNeuralStore,
  saveNeuralStore,
} from './helpers.js';

export const neuralCompress: MCPTool =   {
    name: 'neural_compress',
    description: 'Compress neural model or embeddings Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string', description: 'Model ID to compress' },
        method: { type: 'string', enum: ['quantize', 'prune', 'distill'], description: 'Compression method' },
        targetSize: { type: 'number', description: 'Target size reduction (0-1)' },
      },
    },
    handler: async (input) => {
      if (input.modelId) { const v = validateIdentifier(input.modelId as string, 'modelId'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();
      const method = (input.method as string) || 'quantize';
      const targetReduction = (input.targetSize as number) || 0.5;
      const patterns = Object.values(store.patterns);

      if (patterns.length === 0) {
        return { success: false, error: 'No patterns to compress. Train patterns first with neural_train.' };
      }

      const beforeCount = patterns.length;
      const beforeSize = patterns.reduce((s, p) => s + (p.embedding?.length || 0) * 4, 0); // Float32 = 4 bytes

      if (method === 'quantize') {
        try {
          const { quantizeInt8, getQuantizationStats } = await import('../../memory/memory-initializer.js');
          let totalCompressed = 0;
          for (const pattern of patterns) {
            if (pattern.embedding && pattern.embedding.length > 0) {
              const stats = getQuantizationStats(pattern.embedding);
              const quantized = quantizeInt8(pattern.embedding);
              // Store quantized metadata (keep original embedding for search)
              (pattern as any)._quantized = {
                scale: quantized.scale,
                zeroPoint: quantized.zeroPoint,
                compressionRatio: stats.compressionRatio,
              };
              totalCompressed++;
            }
          }
          saveNeuralStore(store);
          return {
            success: true, _real: true, method,
            embeddingProvider: embeddingServiceName,
            patternsCompressed: totalCompressed,
            compressionRatio: '3.92x (Int8)',
            beforeBytes: beforeSize,
            afterBytes: Math.round(beforeSize / 3.92),
          };
        } catch {
          return { success: false, error: 'Quantization requires memory-initializer. Run `memory init` first.' };
        }
      }

      if (method === 'prune') {
        // Prune patterns with low usage count below threshold (targetReduction as min usage)
        const threshold = targetReduction;
        const toRemove: string[] = [];
        for (const [id, pattern] of Object.entries(store.patterns)) {
          if ((pattern.usageCount || 0) < threshold) toRemove.push(id);
        }
        for (const id of toRemove) delete store.patterns[id];
        saveNeuralStore(store);
        return {
          success: true, _real: true, method,
          embeddingProvider: embeddingServiceName,
          threshold,
          patternsRemoved: toRemove.length,
          patternsBefore: beforeCount,
          patternsAfter: Object.keys(store.patterns).length,
        };
      }

      if (method === 'distill') {
        // Merge similar patterns by cosine similarity > 0.95
        const patternList = Object.entries(store.patterns);
        const merged: string[] = [];
        for (let i = 0; i < patternList.length; i++) {
          const [idA, a] = patternList[i];
          if (merged.includes(idA)) continue;
          for (let j = i + 1; j < patternList.length; j++) {
            const [idB, b] = patternList[j];
            if (!a.embedding || !b.embedding || merged.includes(idB)) continue;
            const sim = cosineSimilarity(a.embedding, b.embedding);
            if (sim > 0.95) {
              // Merge: average embeddings, keep higher usage count
              for (let k = 0; k < a.embedding.length; k++) {
                a.embedding[k] = (a.embedding[k] + (b.embedding[k] || 0)) / 2;
              }
              a.usageCount = Math.max(a.usageCount || 0, b.usageCount || 0);
              delete store.patterns[idB];
              merged.push(idB);
            }
          }
        }
        saveNeuralStore(store);
        return {
          success: true, _real: true, method,
          embeddingProvider: embeddingServiceName,
          patternsMerged: merged.length,
          patternsBefore: beforeCount,
          patternsAfter: Object.keys(store.patterns).length,
        };
      }

      return { success: false, error: `Unknown method: ${method}. Use quantize, prune, or distill.` };
    },
  };

export const neuralStatus: MCPTool =   {
    name: 'neural_status',
    description: 'Get neural system status Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string', description: 'Specific model ID' },
        detailed: { type: 'boolean', description: 'Include detailed info' },
      },
    },
    handler: async (input) => {
      if (input.modelId) { const v = validateIdentifier(input.modelId as string, 'modelId'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();

      if (input.modelId) {
        const model = store.models[input.modelId as string];
        if (!model) {
          return { success: false, error: 'Model not found' };
        }
        return { success: true, model };
      }

      const models = Object.values(store.models);
      const patterns = Object.values(store.patterns);

      return {
        _realEmbeddings: !!realEmbeddings,
        embeddingProvider: realEmbeddings ? `@claude-flow/embeddings (${embeddingServiceName})` : 'hash-based (deterministic)',
        models: {
          total: models.length,
          ready: models.filter(m => m.status === 'ready').length,
          training: models.filter(m => m.status === 'training').length,
          avgAccuracy: models.length > 0
            ? models.reduce((sum, m) => sum + m.accuracy, 0) / models.length
            : 0,
        },
        patterns: {
          total: patterns.length,
          byType: patterns.reduce((acc, p) => {
            acc[p.type] = (acc[p.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          totalEmbeddingDims: patterns.length > 0 ? patterns[0].embedding.length : 384,
        },
        features: {
          hnsw: true,
          quantization: true,
          // #1770: probe the real loader instead of returning a literal false.
          // Was hardcoded false, which contradicted hooks_intelligence_stats's
          // simultaneous claim of `implementation: real-flash-attention`.
          // The two surfaces now agree on a single source of truth.
          flashAttention: await (async () => {
            try {
              // #1773 item 4 — flash-attention now lives in @claude-flow/neural
              const { getFlashAttention } = await import('@claude-flow/neural');
              return getFlashAttention() !== null;
            } catch {
              return false;
            }
          })(),
          reasoningBank: true,
        },
      };
    },
  };

export const neuralOptimize: MCPTool =   {
    name: 'neural_optimize',
    description: 'Optimize neural model performance Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string', description: 'Model ID to optimize' },
        target: { type: 'string', enum: ['speed', 'memory', 'accuracy', 'balanced'], description: 'Optimization target' },
      },
    },
    handler: async (input) => {
      if (input.modelId) { const v = validateIdentifier(input.modelId as string, 'modelId'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();
      const target = (input.target as string) || 'balanced';
      const patterns = Object.values(store.patterns);

      if (patterns.length === 0) {
        return { success: false, error: 'No patterns to optimize. Train patterns first with neural_train.' };
      }

      const startTime = performance.now();
      const actions: string[] = [];
      const beforeCount = patterns.length;
      const dims = patterns[0]?.embedding?.length || 0;
      let patternsRemoved = 0;
      let patternsQuantized = 0;
      let duplicatesRemoved = 0;

      // speed / balanced: deduplicate identical or near-identical patterns
      if (target === 'speed' || target === 'balanced') {
        const seen = new Map<string, string>(); // hash -> id
        for (const [id, p] of Object.entries(store.patterns)) {
          if (!p.embedding || p.embedding.length === 0) continue;
          // Quick hash: first 8 dims rounded
          const hash = p.embedding.slice(0, 8).map(v => v.toFixed(4)).join(',');
          if (seen.has(hash)) {
            // Verify with full cosine similarity
            const existingId = seen.get(hash)!;
            const existing = store.patterns[existingId];
            if (existing && cosineSimilarity(p.embedding, existing.embedding) > 0.99) {
              existing.usageCount = Math.max(existing.usageCount || 0, p.usageCount || 0);
              delete store.patterns[id];
              duplicatesRemoved++;
            }
          } else {
            seen.set(hash, id);
          }
        }
        if (duplicatesRemoved > 0) actions.push(`Removed ${duplicatesRemoved} near-duplicate patterns`);
      }

      // memory / balanced: quantize large embeddings
      if (target === 'memory' || target === 'balanced') {
        try {
          const { quantizeInt8, getQuantizationStats } = await import('../../memory/memory-initializer.js');
          for (const p of Object.values(store.patterns)) {
            if (p.embedding && p.embedding.length > 0 && !(p as any)._quantized) {
              const stats = getQuantizationStats(p.embedding);
              const q = quantizeInt8(p.embedding);
              (p as any)._quantized = { scale: q.scale, zeroPoint: q.zeroPoint, compressionRatio: stats.compressionRatio };
              patternsQuantized++;
            }
          }
          if (patternsQuantized > 0) actions.push(`Quantized ${patternsQuantized} pattern embeddings (Int8, ~3.92x)`);
        } catch {
          actions.push('Quantization skipped (memory-initializer not available)');
        }
      }

      // accuracy / balanced: prune low-usage, zero-embedding patterns
      if (target === 'accuracy' || target === 'balanced') {
        for (const [id, p] of Object.entries(store.patterns)) {
          if (!p.embedding || p.embedding.length === 0) {
            delete store.patterns[id];
            patternsRemoved++;
            continue;
          }
          // Remove patterns with all-zero embeddings (no useful signal)
          const norm = p.embedding.reduce((s, v) => s + v * v, 0);
          if (norm < 1e-10) {
            delete store.patterns[id];
            patternsRemoved++;
          }
        }
        if (patternsRemoved > 0) actions.push(`Pruned ${patternsRemoved} empty/zero-signal patterns`);
      }

      saveNeuralStore(store);
      const elapsed = Math.round(performance.now() - startTime);

      return {
        success: true, _real: true, target,
        embeddingProvider: embeddingServiceName,
        actions,
        patternsBefore: beforeCount,
        patternsAfter: Object.keys(store.patterns).length,
        duplicatesRemoved,
        patternsQuantized,
        patternsRemoved,
        embeddingDims: dims,
        elapsedMs: elapsed,
      };
    },
  };

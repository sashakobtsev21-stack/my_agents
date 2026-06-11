/**
 * Embeddings MCP Tools — status & RaBitQ tools
 *
 * embeddings_status / rabitq_build / rabitq_search / rabitq_status.
 * Extracted verbatim from embeddings-tools.ts (lines 836-983) during
 * campaign-2 wave 3 (W209); module-private group const, spread back by
 * the barrel.
 */

import type { MCPTool } from './types.js';
import { getConfigPath, loadConfig } from './embeddings-tools-helpers.js';

export const embeddingsRabitqTools: MCPTool[] = [
  {
    name: 'embeddings_status',
    description: 'Get embeddings system status and configuration Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          initialized: false,
          message: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      // ADR-093 F5: distinguish "@ruvector/core installed" from "wired into
      // the embedding pipeline". Previously this collapsed both into a
      // single `ruvector: boolean` field, which gave callers no way to
      // tell whether re-running embeddings_init would help (#1698 partial
      // regression on the MCP boundary).
      let ruvectorAvailable = false;
      let ruvectorVersion: string | undefined;
      try {
        const mod = await import('@ruvector/core');
        ruvectorAvailable = !!(mod as Record<string, unknown>);
        try {
          // Best-effort: many packages expose a `version` constant
          ruvectorVersion = (mod as { version?: string }).version;
        } catch { /* ignore */ }
      } catch { /* not installed */ }

      const ruvectorEnabled = config.neural.ruvector?.enabled ?? false;

      return {
        success: true,
        initialized: true,
        config: {
          model: config.model,
          dimension: config.dimension,
          cacheSize: config.cacheSize,
          hyperbolic: config.hyperbolic,
          neural: {
            enabled: config.neural.enabled,
            // Backwards-compatible: keep the boolean view (truthy when wired).
            ruvector: ruvectorEnabled,
            // New shape — additive, non-breaking. Callers that need to
            // distinguish "package is installed" from "feature wired in"
            // read these instead of guessing from a single bool.
            ruvectorStatus: {
              available: ruvectorAvailable,
              enabled: ruvectorEnabled,
              version: ruvectorVersion,
            },
          },
        },
        paths: {
          config: getConfigPath(),
          models: config.modelPath,
        },
        initializedAt: config.initialized,
        capabilities: {
          onnxModels: ['Xenova/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'],
          geometries: ['euclidean', 'poincare'],
          normalizations: ['L2', 'L1', 'minmax', 'zscore'],
          features: ['semantic search', 'hyperbolic projection', 'neural substrate'],
        },
      };
    },
  },

  // --- RaBitQ 1-bit quantized vector index ---

  {
    name: 'embeddings_rabitq_build',
    description: 'Build RaBitQ 1-bit quantized index from stored embeddings (32× compression). Pre-filters candidates via Hamming scan before exact rerank. Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Force rebuild even if index exists' },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { buildRabitqIndex } = await import('../memory/rabitq-index.js');
      return buildRabitqIndex({ force: params.force as boolean });
    },
  },

  {
    name: 'embeddings_rabitq_search',
    description: 'Search via RaBitQ quantized index (fast Hamming scan). Returns candidate IDs for reranking. Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        k: { type: 'number', description: 'Number of results (default: 10)' },
        namespace: { type: 'string', description: 'Filter by namespace' },
      },
      required: ['query'],
    },
    handler: async (params: Record<string, unknown>) => {
      const { validateText: vt } = await import('./validate-input.js');
      const v = vt(params.query as string, 'query');
      if (!v.valid) return { success: false, error: v.error };

      const { searchRabitq } = await import('../memory/rabitq-index.js');
      const { generateEmbedding } = await import('../memory/memory-initializer.js');

      const queryEmb = await generateEmbedding(params.query as string);
      const results = await searchRabitq(queryEmb.embedding, {
        k: (params.k as number) || 10,
        namespace: params.namespace as string,
      });

      if (!results) {
        return { success: false, error: 'RaBitQ index not built. Call embeddings_rabitq_build first.' };
      }

      return {
        success: true,
        results: results.map(r => ({
          id: r.id.substring(0, 12),
          key: r.key,
          namespace: r.namespace,
          distance: Math.round(r.distance * 10000) / 10000,
        })),
        count: results.length,
      };
    },
  },

  {
    name: 'embeddings_rabitq_status',
    description: 'Get RaBitQ quantized index status — availability, vector count, compression ratio Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const { getRabitqStatus } = await import('../memory/rabitq-index.js');
      return { success: true, ...getRabitqStatus() };
    },
  },
];

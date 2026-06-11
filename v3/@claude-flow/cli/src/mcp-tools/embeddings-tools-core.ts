/**
 * Embeddings MCP Tools — core tools
 *
 * embeddings_init / generate / compare / search. Extracted verbatim from
 * embeddings-tools.ts (lines 158-520) during campaign-2 wave 3 (W209);
 * module-private group const, spread back by the barrel.
 */

import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import type { MCPTool } from './types.js';
import { validateIdentifier, validateText } from './validate-input.js';
import {
  CONFIG_DIR,
  MODELS_DIR,
  getConfigPath,
  loadConfig,
  saveConfig,
  toPoincare,
  poincareDistance,
  cosineSimilarity,
  generateRealEmbedding,
} from './embeddings-tools-helpers.js';
import type { EmbeddingsConfig } from './embeddings-tools-helpers.js';

export const embeddingsCoreTools: MCPTool[] = [
  {
    name: 'embeddings_init',
    description: 'Initialize the ONNX embedding subsystem with hyperbolic support Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'ONNX model ID',
          enum: ['Xenova/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'],
          default: 'Xenova/all-MiniLM-L6-v2',
        },
        hyperbolic: {
          type: 'boolean',
          description: 'Enable hyperbolic (Poincaré ball) embeddings',
          default: true,
        },
        curvature: {
          type: 'number',
          description: 'Poincaré ball curvature (negative)',
          default: -1,
        },
        cacheSize: {
          type: 'number',
          description: 'LRU cache size',
          default: 256,
        },
        force: {
          type: 'boolean',
          description: 'Overwrite existing configuration',
          default: false,
        },
      },
    },
    handler: async (input) => {
      const model = (input.model as string) || 'Xenova/all-MiniLM-L6-v2';
      const hyperbolic = input.hyperbolic !== false;
      const curvature = (input.curvature as number) || -1;
      const cacheSize = (input.cacheSize as number) || 256;
      const force = input.force === true;

      const existingConfig = loadConfig();
      if (existingConfig && !force) {
        return {
          success: false,
          error: 'Embeddings already initialized. Use force=true to overwrite.',
          existingConfig: {
            model: existingConfig.model,
            initialized: existingConfig.initialized,
          },
        };
      }

      const dimension = model.includes('mpnet') ? 768 : 384;
      const modelPath = resolve(join(CONFIG_DIR, MODELS_DIR));

      // Create models directory
      if (!existsSync(modelPath)) {
        mkdirSync(modelPath, { recursive: true });
      }

      const config: EmbeddingsConfig = {
        model,
        modelPath,
        dimension,
        cacheSize,
        hyperbolic: {
          enabled: hyperbolic,
          curvature,
          epsilon: 1e-15,
          maxNorm: 1 - 1e-5,
        },
        neural: {
          enabled: true,
          driftThreshold: 0.3,
          decayRate: 0.01,
        },
        initialized: new Date().toISOString(),
      };

      saveConfig(config);

      return {
        success: true,
        config: {
          model,
          dimension,
          cacheSize,
          hyperbolic: hyperbolic ? { enabled: true, curvature } : { enabled: false },
          neural: { enabled: true },
        },
        paths: {
          config: getConfigPath(),
          models: modelPath,
        },
        message: 'Embedding subsystem initialized successfully',
      };
    },
  },

  {
    name: 'embeddings_generate',
    description: 'Generate embeddings for text (Euclidean or hyperbolic) Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to embed',
        },
        hyperbolic: {
          type: 'boolean',
          description: 'Return hyperbolic (Poincaré) embedding',
          default: false,
        },
        normalize: {
          type: 'boolean',
          description: 'L2 normalize the embedding',
          default: true,
        },
      },
      required: ['text'],
    },
    handler: async (input) => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          error: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      const text = input.text as string;

      { const v = validateText(text, 'text'); if (!v.valid) return { success: false, error: v.error }; }

      const useHyperbolic = input.hyperbolic === true && config.hyperbolic.enabled;

      // Generate real ONNX embedding
      const embedding = await generateRealEmbedding(text, config.dimension);

      let result: number[];
      let geometry: string;

      if (useHyperbolic) {
        result = toPoincare(embedding, config.hyperbolic.curvature);
        geometry = 'poincare';
      } else {
        result = embedding;
        geometry = 'euclidean';
      }

      return {
        success: true,
        embedding: result,
        metadata: {
          model: config.model,
          dimension: config.dimension,
          geometry,
          curvature: useHyperbolic ? config.hyperbolic.curvature : null,
          textLength: text.length,
          norm: Math.sqrt(result.reduce((sum, x) => sum + x * x, 0)),
        },
      };
    },
  },

  {
    name: 'embeddings_compare',
    description: 'Compare similarity between two texts Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        text1: {
          type: 'string',
          description: 'First text',
        },
        text2: {
          type: 'string',
          description: 'Second text',
        },
        metric: {
          type: 'string',
          description: 'Similarity metric',
          enum: ['cosine', 'euclidean', 'poincare'],
          default: 'cosine',
        },
      },
      required: ['text1', 'text2'],
    },
    handler: async (input) => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          error: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      const text1 = input.text1 as string;
      const text2 = input.text2 as string;
      const metric = (input.metric as string) || 'cosine';

      { const v = validateText(text1, 'text1'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(text2, 'text2'); if (!v.valid) return { success: false, error: v.error }; }

      // Generate real ONNX embeddings for both texts
      const [emb1, emb2] = await Promise.all([
        generateRealEmbedding(text1, config.dimension),
        generateRealEmbedding(text2, config.dimension)
      ]);

      let similarity: number;
      let distance: number;

      switch (metric) {
        case 'poincare':
          if (!config.hyperbolic.enabled) {
            return {
              success: false,
              error: 'Hyperbolic mode not enabled. Initialize with hyperbolic=true.',
            };
          }
          const poinc1 = toPoincare(emb1, config.hyperbolic.curvature);
          const poinc2 = toPoincare(emb2, config.hyperbolic.curvature);
          distance = poincareDistance(poinc1, poinc2, config.hyperbolic.curvature);
          similarity = 1 / (1 + distance);
          break;

        case 'euclidean':
          distance = Math.sqrt(emb1.reduce((sum, _, i) => sum + (emb1[i] - emb2[i]) ** 2, 0));
          similarity = 1 / (1 + distance);
          break;

        default: // cosine
          similarity = cosineSimilarity(emb1, emb2);
          distance = 1 - similarity;
      }

      return {
        success: true,
        similarity,
        distance,
        metric,
        texts: {
          text1: { length: text1.length, preview: text1.slice(0, 50) },
          text2: { length: text2.length, preview: text2.slice(0, 50) },
        },
        interpretation: similarity > 0.8 ? 'very similar' :
                        similarity > 0.6 ? 'similar' :
                        similarity > 0.4 ? 'somewhat similar' :
                        similarity > 0.2 ? 'different' : 'very different',
      };
    },
  },

  {
    name: 'embeddings_search',
    description: 'Semantic search across stored embeddings Use when text similarity matters beyond keyword match — native Grep finds exact strings, embeddings find meaning. Pair with memory_store / agentdb_pattern-search to land the vector against your knowledge base. For literal symbol search, native Grep is faster.',
    category: 'embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        topK: {
          type: 'number',
          description: 'Number of results to return',
          default: 5,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity threshold (0-1)',
          default: 0.5,
        },
        namespace: {
          type: 'string',
          description: 'Search in specific namespace',
        },
      },
      required: ['query'],
    },
    handler: async (input) => {
      const config = loadConfig();
      if (!config) {
        return {
          success: false,
          error: 'Embeddings not initialized. Run embeddings/init first.',
        };
      }

      const query = input.query as string;
      const topK = (input.topK as number) || 5;
      const threshold = (input.threshold as number) || 0.5;
      const namespace = input.namespace as string;

      { const v = validateText(query, 'query'); if (!v.valid) return { success: false, error: v.error }; }
      if (namespace) { const v = validateIdentifier(namespace, 'namespace'); if (!v.valid) return { success: false, error: v.error }; }

      const startTime = performance.now();

      // Generate real ONNX embedding for query — call kept so the ONNX
      // session warms before the searchEntries() path; the value isn't
      // piped into the search itself (search re-embeds internally).
      await generateRealEmbedding(query, config.dimension);

      // Try to search using real memory search
      try {
        const { searchEntries } = await import('../memory/memory-initializer.js');
        const searchResult = await searchEntries({
          query,
          limit: topK,
          threshold,
          namespace: namespace || 'all'
        });

        const searchTime = (performance.now() - startTime).toFixed(2);

        return {
          success: true,
          query,
          results: searchResult.results.map((r) => ({
            key: r.key,
            content: r.content?.substring(0, 100),
            similarity: r.score,
            namespace: r.namespace
          })),
          metadata: {
            model: config.model,
            topK,
            threshold,
            namespace: namespace || 'all',
            searchTime: `${searchTime}ms`,
            indexType: config.hyperbolic.enabled ? 'HNSW (hyperbolic)' : 'HNSW (euclidean)',
            resultCount: searchResult.results.length
          },
        };
      } catch {
        // Database not available - return empty but truthful
        const searchTime = (performance.now() - startTime).toFixed(2);
        return {
          success: true,
          query,
          results: [],
          metadata: {
            model: config.model,
            topK,
            threshold,
            namespace: namespace || 'all',
            searchTime: `${searchTime}ms`,
            indexType: config.hyperbolic.enabled ? 'HNSW (hyperbolic)' : 'HNSW (euclidean)',
          },
          message: 'No embeddings indexed yet. Use memory store to add documents.',
        };
      }
    },
  },

];

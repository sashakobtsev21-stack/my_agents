/**
 * Embedding Service — agentic-flow provider
 *
 * AgenticFlowEmbeddingService (ONNX backend). Extracted verbatim from
 * embedding-service.ts (lines 598-829) during the P3.47 god-file
 * decomposition (W168). embedding-service.ts stays the barrel.
 */

import { BaseEmbeddingService } from './embedding-service-base.js';
import type {
  AgenticFlowEmbeddingConfig,
  BatchEmbeddingResult,
  EmbeddingProvider,
  EmbeddingResult,
} from './types.js';

// ============================================================================
// Agentic-Flow Embedding Service
// ============================================================================

/**
 * Agentic-Flow embedding service using OptimizedEmbedder
 *
 * Features:
 * - ONNX-based embeddings with SIMD acceleration
 * - 256-entry LRU cache with FNV-1a hash
 * - 8x loop unrolling for cosine similarity
 * - Pre-allocated buffers (no GC pressure)
 * - 3-4x faster batch processing
 */
export class AgenticFlowEmbeddingService extends BaseEmbeddingService {
  readonly provider: EmbeddingProvider = 'agentic-flow';
  private embedder: any = null;
  private initialized = false;
  private readonly modelId: string;
  private readonly dimensions: number;
  private readonly embedderCacheSize: number;
  private readonly modelDir: string | undefined;
  private readonly autoDownload: boolean;

  constructor(config: AgenticFlowEmbeddingConfig) {
    super(config);
    this.modelId = config.modelId ?? 'all-MiniLM-L6-v2';
    this.dimensions = config.dimensions ?? 384;
    this.embedderCacheSize = config.embedderCacheSize ?? 256;
    this.modelDir = config.modelDir;
    this.autoDownload = config.autoDownload ?? false;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    let lastError: Error | undefined;

    const createEmbedder = async (modulePath: string): Promise<boolean> => {
      try {
        // Use file:// protocol for absolute paths
        const importPath = modulePath.startsWith('/') ? `file://${modulePath}` : modulePath;
        const module = await import(/* webpackIgnore: true */ importPath);
        const getOptimizedEmbedder = module.getOptimizedEmbedder || module.default?.getOptimizedEmbedder;
        if (!getOptimizedEmbedder) {
          lastError = new Error(`Module loaded but getOptimizedEmbedder not found`);
          return false;
        }

        // Only include defined values to not override defaults
        const embedderConfig: Record<string, unknown> = {
          modelId: this.modelId,
          dimension: this.dimensions,
          cacheSize: this.embedderCacheSize,
          autoDownload: this.autoDownload,
        };
        if (this.modelDir !== undefined) {
          embedderConfig.modelDir = this.modelDir;
        }
        this.embedder = getOptimizedEmbedder(embedderConfig);
        await this.embedder.init();
        this.initialized = true;
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        return false;
      }
    };

    // Build list of possible module paths to try
    const possiblePaths: string[] = [];

    // Try proper package exports first (preferred)
    possiblePaths.push('agentic-flow/embeddings');

    // Try node_modules resolution from different locations (for file:// imports)
    try {
      const path = await import('path');
      const { existsSync } = await import('fs');
      const cwd = process.cwd();

      // Prioritize absolute paths that exist (for file:// import fallback)
      const absolutePaths = [
        path.join(cwd, 'node_modules/agentic-flow/dist/embeddings/optimized-embedder.js'),
        path.join(cwd, '../node_modules/agentic-flow/dist/embeddings/optimized-embedder.js'),
        '/workspaces/claude-flow/node_modules/agentic-flow/dist/embeddings/optimized-embedder.js',
      ];

      for (const p of absolutePaths) {
        if (existsSync(p)) {
          possiblePaths.push(p);
        }
      }
    } catch {
      // fs/path module not available
    }

    // Try each path
    for (const modulePath of possiblePaths) {
      if (await createEmbedder(modulePath)) {
        return;
      }
    }

    const errorDetail = lastError?.message ? ` Last error: ${lastError.message}` : '';
    throw new Error(
      `Failed to initialize agentic-flow embeddings.${errorDetail} ` +
      `Ensure agentic-flow is installed and ONNX model is downloaded: ` +
      `npx agentic-flow@alpha embeddings init`
    );
  }

  async embed(text: string): Promise<EmbeddingResult> {
    await this.initialize();

    // Check our LRU cache first
    const cached = this.cache.get(text);
    if (cached) {
      this.emitEvent({ type: 'cache_hit', text });
      return {
        embedding: cached,
        latencyMs: 0,
        cached: true,
      };
    }

    this.emitEvent({ type: 'embed_start', text });
    const startTime = performance.now();

    try {
      // Use agentic-flow's optimized embedder (has its own internal cache)
      const embedding = await this.embedder.embed(text);

      // Store in our cache as well
      this.cache.set(text, embedding);

      const latencyMs = performance.now() - startTime;
      this.emitEvent({ type: 'embed_complete', text, latencyMs });

      return {
        embedding,
        latencyMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitEvent({ type: 'embed_error', text, error: message });
      throw new Error(`Agentic-flow embedding failed: ${message}`);
    }
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    await this.initialize();

    this.emitEvent({ type: 'batch_start', count: texts.length });
    const startTime = performance.now();

    // Check cache for each text
    const cached: Array<{ index: number; embedding: Float32Array }> = [];
    const uncached: Array<{ index: number; text: string }> = [];

    texts.forEach((text, index) => {
      const cachedEmbedding = this.cache.get(text);
      if (cachedEmbedding) {
        cached.push({ index, embedding: cachedEmbedding });
        this.emitEvent({ type: 'cache_hit', text });
      } else {
        uncached.push({ index, text });
      }
    });

    // Use optimized batch embedding for uncached texts
    let batchEmbeddings: Float32Array[] = [];
    if (uncached.length > 0) {
      const uncachedTexts = uncached.map(u => u.text);
      batchEmbeddings = await this.embedder.embedBatch(uncachedTexts);

      // Cache results
      uncached.forEach((item, i) => {
        this.cache.set(item.text, batchEmbeddings[i]);
      });
    }

    // Reconstruct result array in original order
    const embeddings: Float32Array[] = new Array(texts.length);
    cached.forEach(c => {
      embeddings[c.index] = c.embedding;
    });
    uncached.forEach((u, i) => {
      embeddings[u.index] = batchEmbeddings[i];
    });

    const totalLatencyMs = performance.now() - startTime;
    this.emitEvent({ type: 'batch_complete', count: texts.length, latencyMs: totalLatencyMs });

    return {
      embeddings,
      totalLatencyMs,
      avgLatencyMs: totalLatencyMs / texts.length,
      cacheStats: {
        hits: cached.length,
        misses: uncached.length,
      },
    };
  }

  /**
   * Get combined cache statistics from both our LRU cache and embedder's internal cache
   */
  override getCacheStats() {
    const baseStats = super.getCacheStats();

    if (this.embedder && this.embedder.getCacheStats) {
      const embedderStats = this.embedder.getCacheStats();
      return {
        size: baseStats.size + embedderStats.size,
        maxSize: baseStats.maxSize + embedderStats.maxSize,
        hitRate: baseStats.hitRate,
        embedderCache: embedderStats,
      };
    }

    return baseStats;
  }

  override async shutdown(): Promise<void> {
    if (this.embedder && this.embedder.clearCache) {
      this.embedder.clearCache();
    }
    await super.shutdown();
  }
}


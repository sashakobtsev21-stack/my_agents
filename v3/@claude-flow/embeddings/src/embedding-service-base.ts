/**
 * Embedding Service — base pieces
 *
 * LRUCache and the abstract BaseEmbeddingService (caching, batching,
 * events) shared by the provider implementations. These were
 * module-private in the original embedding-service.ts (P3.47, W168) and
 * are NOT re-exported by the embedding-service.ts barrel — public API
 * unchanged.
 */

import { EventEmitter } from 'events';
import { normalize } from './normalization.js';
import { PersistentEmbeddingCache } from './persistent-cache.js';
import type {
  BatchEmbeddingResult,
  EmbeddingConfig,
  EmbeddingEvent,
  EmbeddingEventListener,
  EmbeddingProvider,
  EmbeddingResult,
  IEmbeddingService,
  NormalizationType,
  PersistentCacheConfig,
} from './types.js';

// ============================================================================
// LRU Cache Implementation
// ============================================================================

export class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private hits = 0;
  private misses = 0;

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
    };
  }
}

// ============================================================================
// Base Embedding Service
// ============================================================================

export abstract class BaseEmbeddingService extends EventEmitter implements IEmbeddingService {
  abstract readonly provider: EmbeddingProvider;
  protected cache: LRUCache<string, Float32Array>;
  protected persistentCache: PersistentEmbeddingCache | null = null;
  protected embeddingListeners: Set<EmbeddingEventListener> = new Set();
  protected normalizationType: NormalizationType;

  constructor(protected readonly config: EmbeddingConfig) {
    super();
    this.cache = new LRUCache(config.cacheSize ?? 1000);
    this.normalizationType = config.normalization ?? 'none';

    // Initialize persistent cache if configured
    if (config.persistentCache?.enabled) {
      const pcConfig: PersistentCacheConfig = config.persistentCache;
      this.persistentCache = new PersistentEmbeddingCache({
        dbPath: pcConfig.dbPath ?? '.cache/embeddings.db',
        maxSize: pcConfig.maxSize ?? 10000,
        ttlMs: pcConfig.ttlMs,
      });
    }
  }

  abstract embed(text: string): Promise<EmbeddingResult>;
  abstract embedBatch(texts: string[]): Promise<BatchEmbeddingResult>;

  /**
   * Apply normalization to embedding if configured
   */
  protected applyNormalization(embedding: Float32Array): Float32Array {
    if (this.normalizationType === 'none') {
      return embedding;
    }
    return normalize(embedding, { type: this.normalizationType });
  }

  /**
   * Check persistent cache for embedding
   */
  protected async checkPersistentCache(text: string): Promise<Float32Array | null> {
    if (!this.persistentCache) return null;
    return this.persistentCache.get(text);
  }

  /**
   * Store embedding in persistent cache
   */
  protected async storePersistentCache(text: string, embedding: Float32Array): Promise<void> {
    if (!this.persistentCache) return;
    await this.persistentCache.set(text, embedding);
  }

  protected emitEvent(event: EmbeddingEvent): void {
    for (const listener of this.embeddingListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in embedding event listener:', error);
      }
    }
    this.emit(event.type, event);
  }

  addEventListener(listener: EmbeddingEventListener): void {
    this.embeddingListeners.add(listener);
  }

  removeEventListener(listener: EmbeddingEventListener): void {
    this.embeddingListeners.delete(listener);
  }

  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.emitEvent({ type: 'cache_eviction', size });
  }

  getCacheStats() {
    const stats = this.cache.getStats();
    return {
      size: stats.size,
      maxSize: stats.maxSize,
      hitRate: stats.hitRate,
    };
  }

  async shutdown(): Promise<void> {
    this.clearCache();
    this.embeddingListeners.clear();
  }
}


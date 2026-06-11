/**
 * GasTown Bridge — core caches
 *
 * LRUCache (O(1) get/set), FormulaASTCache (WeakMap, GC-friendly), and
 * ResultCache for WASM operations. Extracted verbatim from cache.ts
 * (lines 19-453) during the P3.75 god-file decomposition (W196).
 * cache.ts stays the barrel.
 */

// LRU Cache Implementation - O(1) get/set
// ============================================================================

/**
 * Doubly linked list node for LRU tracking
 */
interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
  size: number;
  createdAt: number;
  accessCount: number;
}

/**
 * LRU Cache with O(1) operations
 *
 * Uses Map for O(1) lookups and doubly linked list for O(1) eviction.
 * Supports TTL, size limits, and access tracking.
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, Formula>({ maxSize: 1000, ttlMs: 60000 });
 * cache.set('formula-1', parsedFormula);
 * const formula = cache.get('formula-1');
 * ```
 */
export class LRUCache<K, V> {
  private readonly cache: Map<K, LRUNode<K, V>> = new Map();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private currentSize = 0;

  private readonly maxSize: number;
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(options: {
    maxSize?: number;
    maxEntries?: number;
    ttlMs?: number;
    onEvict?: (key: K, value: V) => void;
  } = {}) {
    this.maxSize = options.maxSize ?? 50 * 1024 * 1024; // 50MB default
    this.maxEntries = options.maxEntries ?? 1000;
    this.ttlMs = options.ttlMs ?? 0; // 0 = no TTL
    this.onEvict = options.onEvict;
  }

  /**
   * Get value from cache - O(1)
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Check TTL
    if (this.ttlMs > 0 && Date.now() - node.createdAt > this.ttlMs) {
      this.delete(key);
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    node.accessCount++;
    return node.value;
  }

  /**
   * Set value in cache - O(1)
   */
  set(key: K, value: V, sizeBytes?: number): void {
    const size = sizeBytes ?? this.estimateSize(value);

    // Check if key exists - update in place
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
      existing.value = value;
      existing.size = size;
      existing.createdAt = Date.now();
      this.currentSize += size;
      this.moveToFront(existing);
      return;
    }

    // Evict if necessary
    while (
      (this.cache.size >= this.maxEntries || this.currentSize + size > this.maxSize) &&
      this.tail
    ) {
      this.evictLRU();
    }

    // Create new node
    const node: LRUNode<K, V> = {
      key,
      value,
      prev: null,
      next: this.head,
      size,
      createdAt: Date.now(),
      accessCount: 1,
    };

    // Insert at front
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }

    this.cache.set(key, node);
    this.currentSize += size;
  }

  /**
   * Check if key exists - O(1)
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Check TTL
    if (this.ttlMs > 0 && Date.now() - node.createdAt > this.ttlMs) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete from cache - O(1)
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    this.currentSize -= node.size;
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, node] of this.cache) {
        this.onEvict(key, node.value);
      }
    }
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
  }

  /**
   * Get cache stats
   */
  stats(): {
    entries: number;
    sizeBytes: number;
    maxEntries: number;
    maxSizeBytes: number;
    hitRate: number;
  } {
    let totalAccess = 0;
    for (const node of this.cache.values()) {
      totalAccess += node.accessCount;
    }

    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      maxEntries: this.maxEntries,
      maxSizeBytes: this.maxSize,
      hitRate: this.cache.size > 0 ? totalAccess / this.cache.size : 0,
    };
  }

  /**
   * Get all keys (for iteration)
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * Get size
   */
  get size(): number {
    return this.cache.size;
  }

  // Private methods

  private moveToFront(node: LRUNode<K, V>): void {
    if (node === this.head) return;

    // Remove from current position
    this.removeNode(node);

    // Insert at front
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const evicted = this.tail;
    this.removeNode(evicted);
    this.cache.delete(evicted.key);
    this.currentSize -= evicted.size;

    if (this.onEvict) {
      this.onEvict(evicted.key, evicted.value);
    }
  }

  private estimateSize(value: V): number {
    if (value === null || value === undefined) return 8;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (Array.isArray(value)) {
      return value.reduce((acc, v) => acc + this.estimateSize(v), 64);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    return 64;
  }
}

// ============================================================================
// Formula AST Cache with WeakMap (GC-friendly)
// ============================================================================

/**
 * Formula AST cache using WeakMap for automatic GC
 *
 * Stores parsed ASTs keyed by source string reference.
 * When the source string is no longer referenced, the AST is GC'd.
 */
export class FormulaASTCache {
  // Use a Map with string keys since TOML content is the key
  // WeakMap only works with object keys
  private readonly astCache: LRUCache<string, unknown>;
  private readonly hashCache: Map<string, string> = new Map();

  constructor(maxEntries = 500) {
    this.astCache = new LRUCache<string, unknown>({
      maxEntries,
      ttlMs: 5 * 60 * 1000, // 5 minute TTL
    });
  }

  /**
   * Get cached AST for formula content
   */
  get(content: string): unknown | undefined {
    const hash = this.hashContent(content);
    return this.astCache.get(hash);
  }

  /**
   * Cache AST for formula content
   */
  set(content: string, ast: unknown): void {
    const hash = this.hashContent(content);
    this.astCache.set(hash, ast);
  }

  /**
   * Check if content has cached AST
   */
  has(content: string): boolean {
    const hash = this.hashContent(content);
    return this.astCache.has(hash);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.astCache.clear();
    this.hashCache.clear();
  }

  /**
   * Get stats
   */
  stats(): { entries: number; sizeBytes: number } {
    const cacheStats = this.astCache.stats();
    return {
      entries: cacheStats.entries,
      sizeBytes: cacheStats.sizeBytes,
    };
  }

  // Simple hash for content deduplication
  private hashContent(content: string): string {
    const cached = this.hashCache.get(content);
    if (cached) return cached;

    // FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }

    const hashStr = hash.toString(36);
    this.hashCache.set(content, hashStr);

    // Limit hash cache size
    if (this.hashCache.size > 10000) {
      const first = this.hashCache.keys().next().value;
      if (first) this.hashCache.delete(first);
    }

    return hashStr;
  }
}

// ============================================================================
// Result Cache for WASM Operations
// ============================================================================

/**
 * Result cache for expensive WASM operations
 *
 * Caches:
 * - Formula parse results
 * - Cook results
 * - Graph analysis results (topo sort, cycle detection)
 */
export class ResultCache {
  readonly formulas: LRUCache<string, unknown>;
  readonly cooked: LRUCache<string, unknown>;
  readonly beads: LRUCache<string, unknown>;
  readonly convoys: LRUCache<string, unknown>;
  readonly graphs: LRUCache<string, unknown>;

  constructor(options: {
    maxFormulaEntries?: number;
    maxCookedEntries?: number;
    maxBeadEntries?: number;
    maxConvoyEntries?: number;
    maxGraphEntries?: number;
  } = {}) {
    this.formulas = new LRUCache({
      maxEntries: options.maxFormulaEntries ?? 200,
      ttlMs: 10 * 60 * 1000, // 10 min
    });

    this.cooked = new LRUCache({
      maxEntries: options.maxCookedEntries ?? 500,
      ttlMs: 5 * 60 * 1000, // 5 min
    });

    this.beads = new LRUCache({
      maxEntries: options.maxBeadEntries ?? 1000,
      ttlMs: 60 * 1000, // 1 min - beads change frequently
    });

    this.convoys = new LRUCache({
      maxEntries: options.maxConvoyEntries ?? 100,
      ttlMs: 30 * 1000, // 30 sec - convoys update often
    });

    this.graphs = new LRUCache({
      maxEntries: options.maxGraphEntries ?? 100,
      ttlMs: 2 * 60 * 1000, // 2 min
    });
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.formulas.clear();
    this.cooked.clear();
    this.beads.clear();
    this.convoys.clear();
    this.graphs.clear();
  }

  /**
   * Get combined stats
   */
  stats(): Record<string, { entries: number; sizeBytes: number }> {
    return {
      formulas: this.formulas.stats(),
      cooked: this.cooked.stats(),
      beads: this.beads.stats(),
      convoys: this.convoys.stats(),
      graphs: this.graphs.stats(),
    };
  }
}

// ============================================================================

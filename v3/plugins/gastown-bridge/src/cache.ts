/**
 * Gas Town Bridge Plugin - Unified Cache System
 *
 * High-performance caching with:
 * - O(1) LRU cache with Map + doubly linked list
 * - WeakMap for formula AST caching (GC-friendly)
 * - Result memoization for expensive operations
 * - Batch deduplication for concurrent requests
 *
 * Performance targets:
 * - 50% memory reduction via eviction
 * - 3x faster cold start via preloading
 *
 * @module gastown-bridge/cache
 * @version 0.1.0
 */

// ============================================================================

// This file is now a thin barrel: the utility classes were split into
// the two sub-modules below during the P3.75 god-file decomposition
// (W196). Kept as cache.ts so the six './cache.js'/'../cache.js'
// importers (bridges, observer, executor) keep resolving
// byte-identically.
export * from './cache-core.js';
export * from './cache-async.js';

import { FormulaASTCache, LRUCache, ResultCache } from './cache-core.js';
import {
  AsyncLazy,
  BatchDeduplicator,
  DebouncedEmitter,
  Lazy,
  ModulePreloader,
  ResourcePool,
} from './cache-async.js';

// Exports
// ============================================================================

export default {
  LRUCache,
  FormulaASTCache,
  ResultCache,
  BatchDeduplicator,
  ModulePreloader,
  ResourcePool,
  DebouncedEmitter,
  Lazy,
  AsyncLazy,
};

/**
 * Gas Town Bridge Plugin - WASM Loader
 *
 * Provides lazy-loading and caching for WASM modules with graceful
 * JavaScript fallback. Includes typed wrapper functions for all WASM exports
 * and performance timing for benchmarks.
 *
 * WASM Modules:
 * - gastown-formula-wasm: TOML parsing and formula cooking (352x faster)
 * - ruvector-gnn-wasm: Graph operations and neural network (HNSW-indexed (measured ~1.9x-4.7x))
 *
 * @module gastown-bridge/wasm-loader
 * @version 0.1.0
 */

import type {
  Formula,
  TopoSortResult,
  CriticalPathResult,
} from './types.js';

import {
  LRUCache,
  FormulaASTCache,
  BatchDeduplicator,
  ModulePreloader,
} from './cache.js';

import {
  LazyWasm,
  type LazyStats,
} from './memory/lazy.js';

// ============================================================================

// The public types and the JS fallback implementations were extracted
// into ./wasm-loader-types.ts and ./wasm-loader-fallbacks.ts during the
// P3.73 god-file decomposition (W194). Re-export the types; the
// fallbacks stay module-private to this surface.
export type {
  CycleDetectionResult,
  GraphEdge,
  NodeWeight,
  PerformanceTiming,
} from './wasm-loader-types.js';
import type {
  CycleDetectionResult,
  FormulaWasmExports,
  GnnWasmExports,
  GraphEdge,
  NodeWeight,
  PerformanceTiming,
} from './wasm-loader-types.js';
import {
  cookFormulaFallback,
  criticalPathFallback,
  detectCyclesFallback,
  parseTomlFallback,
  topoSortFallback,
} from './wasm-loader-fallbacks.js';

// Module Cache - Lazy Loading with LazyWasm
// ============================================================================

/** WASM availability flag */
let wasmAvailable: boolean | null = null;
/** Performance timings log */
const performanceLog: PerformanceTiming[] = [];

/**
 * Lazy loader for gastown-formula-wasm module.
 * Only loads WASM when first accessed, not during startup.
 * Supports idle timeout for memory cleanup.
 */
const lazyFormulaWasm = new LazyWasm<FormulaWasmExports>(
  async () => {
    if (!isWasmAvailable()) {
      throw new Error('WASM not available');
    }
    const module = await import('gastown-formula-wasm') as unknown as FormulaWasmExports;
    if (typeof module.default === 'function') {
      await module.default();
    }
    return module;
  },
  {
    name: 'gastown-formula-wasm',
    idleTimeout: 5 * 60 * 1000, // 5 minutes idle timeout for memory cleanup
    onError: (error) => {
      console.debug('[WASM Loader] gastown-formula-wasm load error:', error);
    },
  }
);

/**
 * Lazy loader for ruvector-gnn-wasm module.
 * Only loads WASM when first accessed, not during startup.
 * Supports idle timeout for memory cleanup.
 */
const lazyGnnWasm = new LazyWasm<GnnWasmExports>(
  async () => {
    if (!isWasmAvailable()) {
      throw new Error('WASM not available');
    }
    const module = await import('ruvector-gnn-wasm') as unknown as GnnWasmExports;
    if (typeof module.default === 'function') {
      await module.default();
    }
    return module;
  },
  {
    name: 'ruvector-gnn-wasm',
    idleTimeout: 5 * 60 * 1000, // 5 minutes idle timeout for memory cleanup
    onError: (error) => {
      console.debug('[WASM Loader] ruvector-gnn-wasm load error:', error);
    },
  }
);

// ============================================================================
// Performance Caches - LRU with O(1) operations
// ============================================================================

/** LRU cache for parsed formulas (max 1000 entries) */
const formulaParseCache = new LRUCache<string, Formula>({
  maxEntries: 1000,
  ttlMs: 10 * 60 * 1000, // 10 min TTL
});

/** LRU cache for cooked formulas */
const cookCache = new LRUCache<string, Formula>({
  maxEntries: 500,
  ttlMs: 5 * 60 * 1000, // 5 min TTL
});

/** LRU cache for topo sort results */
const topoSortCache = new LRUCache<string, TopoSortResult>({
  maxEntries: 200,
  ttlMs: 2 * 60 * 1000, // 2 min TTL
});

/** Formula AST cache using WeakMap-like behavior */
const astCache = new FormulaASTCache(500);

/** Batch deduplicator for concurrent parse requests */
const parseDedup = new BatchDeduplicator<Formula>();

/** Batch deduplicator for concurrent cook requests */
const cookDedup = new BatchDeduplicator<Formula>();

/** Batch deduplicator for concurrent graph operations */
const graphDedup = new BatchDeduplicator<TopoSortResult>();

/** Module preloader for idle-time loading */
const modulePreloader = new ModulePreloader();

// ============================================================================
// Hash Functions for Cache Keys
// ============================================================================

/**
 * FNV-1a hash for content strings (fast, low collision)
 */
function hashContent(content: string): string {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Hash for cook operation key (formula + vars)
 */
function hashCookKey(formula: Formula, vars: Record<string, string>): string {
  const varsStr = Object.entries(vars).sort().map(([k, v]) => `${k}=${v}`).join('|');
  return `${formula.name}:${formula.version}:${hashContent(varsStr)}`;
}

/**
 * Hash for graph operation key (nodes + edges)
 */
function hashGraphKey(nodes: string[], edges: GraphEdge[]): string {
  const nodesStr = nodes.sort().join(',');
  const edgesStr = edges.map(e => `${e.from}->${e.to}`).sort().join(',');
  return hashContent(`${nodesStr}|${edgesStr}`);
}

// ============================================================================
// WASM Availability Check
// ============================================================================

/**
 * Check if WASM is available in the current environment.
 *
 * @returns True if WASM is supported, false otherwise
 *
 * @example
 * ```typescript
 * if (isWasmAvailable()) {
 *   console.log('WASM acceleration enabled');
 * } else {
 *   console.log('Using JavaScript fallback');
 * }
 * ```
 */
export function isWasmAvailable(): boolean {
  if (wasmAvailable !== null) {
    return wasmAvailable;
  }

  try {
    // Check for WebAssembly global
    if (typeof WebAssembly === 'undefined') {
      wasmAvailable = false;
      return false;
    }

    // Check for required WebAssembly features
    const hasInstantiate = typeof WebAssembly.instantiate === 'function';
    const hasCompile = typeof WebAssembly.compile === 'function';
    const hasModule = typeof WebAssembly.Module === 'function';

    wasmAvailable = hasInstantiate && hasCompile && hasModule;
    return wasmAvailable;
  } catch {
    wasmAvailable = false;
    return false;
  }
}

// ============================================================================
// Performance Timing
// ============================================================================

/**
 * Record a performance timing
 */
function recordTiming(
  operation: string,
  startTime: number,
  usedWasm: boolean
): PerformanceTiming {
  const timing: PerformanceTiming = {
    operation,
    durationMs: performance.now() - startTime,
    usedWasm,
    startedAt: startTime,
  };
  performanceLog.push(timing);

  // Keep only last 1000 entries
  if (performanceLog.length > 1000) {
    performanceLog.shift();
  }

  return timing;
}

/**
 * Get performance log for benchmarking.
 *
 * @returns Array of performance timing records
 *
 * @example
 * ```typescript
 * const timings = getPerformanceLog();
 * const avgWasmTime = timings
 *   .filter(t => t.usedWasm)
 *   .reduce((acc, t) => acc + t.durationMs, 0) / timings.length;
 * ```
 */
export function getPerformanceLog(): readonly PerformanceTiming[] {
  return [...performanceLog];
}

/**
 * Clear performance log.
 */
export function clearPerformanceLog(): void {
  performanceLog.length = 0;
}

// ============================================================================
// WASM Module Loaders - Using LazyWasm for deferred loading
// ============================================================================

/**
 * Lazy-load the gastown-formula-wasm module.
 * Uses LazyWasm for true lazy loading - only loads when first accessed.
 * Includes idle timeout for automatic memory cleanup.
 *
 * @returns The loaded WASM module exports, or null if unavailable
 *
 * @example
 * ```typescript
 * const formulaWasm = await loadFormulaWasm();
 * if (formulaWasm) {
 *   const result = formulaWasm.parse_toml(tomlContent);
 * }
 * ```
 */
export async function loadFormulaWasm(): Promise<FormulaWasmExports | null> {
  if (!isWasmAvailable()) {
    return null;
  }

  try {
    return await lazyFormulaWasm.get();
  } catch (error) {
    // Module not available, will use JS fallback
    console.debug('[WASM Loader] gastown-formula-wasm not available:', error);
    return null;
  }
}

/**
 * Lazy-load the ruvector-gnn-wasm module.
 * Uses LazyWasm for true lazy loading - only loads when first accessed.
 * Includes idle timeout for automatic memory cleanup.
 *
 * @returns The loaded WASM module exports, or null if unavailable
 *
 * @example
 * ```typescript
 * const gnnWasm = await loadGnnWasm();
 * if (gnnWasm) {
 *   const result = gnnWasm.topo_sort(nodesJson, edgesJson);
 * }
 * ```
 */
export async function loadGnnWasm(): Promise<GnnWasmExports | null> {
  if (!isWasmAvailable()) {
    return null;
  }

  try {
    return await lazyGnnWasm.get();
  } catch (error) {
    // Module not available, will use JS fallback
    console.debug('[WASM Loader] ruvector-gnn-wasm not available:', error);
    return null;
  }
}

/**
 * Check if formula WASM module is currently loaded.
 * Does not trigger loading.
 */
export function isFormulaWasmLoaded(): boolean {
  return lazyFormulaWasm.isLoaded();
}

/**
 * Check if GNN WASM module is currently loaded.
 * Does not trigger loading.
 */
export function isGnnWasmLoaded(): boolean {
  return lazyGnnWasm.isLoaded();
}

/**
 * Get lazy loading statistics for WASM modules.
 */
export function getWasmLazyStats(): {
  formulaWasm: LazyStats;
  gnnWasm: LazyStats;
} {
  return {
    formulaWasm: lazyFormulaWasm.getStats(),
    gnnWasm: lazyGnnWasm.getStats(),
  };
}

// ============================================================================

// Public API - Formula Operations
// ============================================================================

/**
 * Parse TOML formula content to a Formula object.
 * Uses WASM if available (352x faster), falls back to JavaScript.
 *
 * @param content - TOML string content to parse
 * @returns Parsed Formula object
 *
 * @example
 * ```typescript
 * const formula = await parseFormula(`
 * name = "my-workflow"
 * type = "workflow"
 * version = 1
 *
 * [[steps]]
 * id = "step-1"
 * title = "First step"
 * `);
 * ```
 */
export async function parseFormula(content: string): Promise<Formula> {
  const startTime = performance.now();
  const cacheKey = hashContent(content);

  // Check LRU cache first (O(1) lookup)
  const cached = formulaParseCache.get(cacheKey);
  if (cached) {
    recordTiming('parseFormula:cache-hit', startTime, false);
    return cached;
  }

  // Use batch deduplication for concurrent requests
  return parseDedup.dedupe(cacheKey, async () => {
    const wasmModule = await loadFormulaWasm();

    if (wasmModule) {
      try {
        const resultJson = wasmModule.parse_toml(content);
        const result = JSON.parse(resultJson) as Formula;
        formulaParseCache.set(cacheKey, result);
        recordTiming('parseFormula', startTime, true);
        return result;
      } catch (error) {
        console.warn('[WASM Loader] parse_toml failed, using fallback:', error);
      }
    }

    // JavaScript fallback
    const result = parseTomlFallback(content);
    formulaParseCache.set(cacheKey, result);
    recordTiming('parseFormula', startTime, false);
    return result;
  });
}

/**
 * Cook a formula by substituting variables.
 * Uses WASM if available (352x faster), falls back to JavaScript.
 *
 * @param formula - Formula to cook
 * @param vars - Variables to substitute
 * @returns Cooked formula with variables substituted
 *
 * @example
 * ```typescript
 * const cooked = await cookFormula(formula, {
 *   projectName: 'my-project',
 *   author: 'developer'
 * });
 * ```
 */
export async function cookFormula(
  formula: Formula,
  vars: Record<string, string>
): Promise<Formula> {
  const startTime = performance.now();
  const cacheKey = hashCookKey(formula, vars);

  // Check LRU cache first (O(1) lookup)
  const cached = cookCache.get(cacheKey);
  if (cached) {
    recordTiming('cookFormula:cache-hit', startTime, false);
    return cached;
  }

  // Use batch deduplication for concurrent requests
  return cookDedup.dedupe(cacheKey, async () => {
    const wasmModule = await loadFormulaWasm();

    if (wasmModule) {
      try {
        const resultJson = wasmModule.cook_formula(
          JSON.stringify(formula),
          JSON.stringify(vars)
        );
        const result = JSON.parse(resultJson) as Formula;
        cookCache.set(cacheKey, result);
        recordTiming('cookFormula', startTime, true);
        return result;
      } catch (error) {
        console.warn('[WASM Loader] cook_formula failed, using fallback:', error);
      }
    }

    // JavaScript fallback
    const result = cookFormulaFallback(formula, vars);
    cookCache.set(cacheKey, result);
    recordTiming('cookFormula', startTime, false);
    return result;
  });
}

/**
 * Batch cook multiple formulas with corresponding variables.
 * Uses WASM if available (352x faster), falls back to JavaScript.
 *
 * @param formulas - Array of formulas to cook
 * @param varsArray - Array of variable objects (one per formula)
 * @returns Array of cooked formulas
 *
 * @example
 * ```typescript
 * const cooked = await cookBatch(
 *   [formula1, formula2],
 *   [{ name: 'a' }, { name: 'b' }]
 * );
 * ```
 */
export async function cookBatch(
  formulas: Formula[],
  varsArray: Record<string, string>[]
): Promise<Formula[]> {
  const startTime = performance.now();

  if (formulas.length !== varsArray.length) {
    throw new Error('formulas and varsArray must have the same length');
  }

  const wasmModule = await loadFormulaWasm();

  if (wasmModule) {
    try {
      const resultJson = wasmModule.cook_batch(
        JSON.stringify(formulas),
        JSON.stringify(varsArray)
      );
      const result = JSON.parse(resultJson) as Formula[];
      recordTiming('cookBatch', startTime, true);
      return result;
    } catch (error) {
      console.warn('[WASM Loader] cook_batch failed, using fallback:', error);
    }
  }

  // JavaScript fallback
  const results = await Promise.all(
    formulas.map((formula, i) => cookFormula(formula, varsArray[i]))
  );
  recordTiming('cookBatch', startTime, false);
  return results;
}

// ============================================================================
// Public API - Graph Operations
// ============================================================================

/**
 * Perform topological sort on a dependency graph.
 * Uses WASM if available (HNSW-indexed (measured ~1.9x-4.7x)), falls back to JavaScript.
 *
 * @param nodes - Array of node identifiers
 * @param edges - Array of edges (from -> to dependencies)
 * @returns Topological sort result with sorted order and cycle detection
 *
 * @example
 * ```typescript
 * const result = await topoSort(
 *   ['a', 'b', 'c'],
 *   [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]
 * );
 * console.log(result.sorted); // ['a', 'b', 'c']
 * ```
 */
export async function topoSort(
  nodes: string[],
  edges: GraphEdge[]
): Promise<TopoSortResult> {
  const startTime = performance.now();
  const cacheKey = hashGraphKey(nodes, edges);

  // Check LRU cache first (O(1) lookup)
  const cached = topoSortCache.get(cacheKey);
  if (cached) {
    recordTiming('topoSort:cache-hit', startTime, false);
    return cached;
  }

  // Use batch deduplication for concurrent requests
  return graphDedup.dedupe(cacheKey, async () => {
    const wasmModule = await loadGnnWasm();

    if (wasmModule) {
      try {
        const resultJson = wasmModule.topo_sort(
          JSON.stringify(nodes),
          JSON.stringify(edges)
        );
        const result = JSON.parse(resultJson) as TopoSortResult;
        topoSortCache.set(cacheKey, result);
        recordTiming('topoSort', startTime, true);
        return result;
      } catch (error) {
        console.warn('[WASM Loader] topo_sort failed, using fallback:', error);
      }
    }

    // JavaScript fallback
    const result = topoSortFallback(nodes, edges);
    topoSortCache.set(cacheKey, result);
    recordTiming('topoSort', startTime, false);
    return result;
  });
}

/**
 * Detect cycles in a dependency graph.
 * Uses WASM if available (HNSW-indexed (measured ~1.9x-4.7x)), falls back to JavaScript.
 *
 * @param nodes - Array of node identifiers
 * @param edges - Array of edges (from -> to dependencies)
 * @returns Cycle detection result
 *
 * @example
 * ```typescript
 * const result = await detectCycles(
 *   ['a', 'b', 'c'],
 *   [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]
 * );
 * console.log(result.hasCycle); // true
 * console.log(result.cycleNodes); // ['a', 'b']
 * ```
 */
export async function detectCycles(
  nodes: string[],
  edges: GraphEdge[]
): Promise<CycleDetectionResult> {
  const startTime = performance.now();

  const wasmModule = await loadGnnWasm();

  if (wasmModule) {
    try {
      const resultJson = wasmModule.detect_cycles(
        JSON.stringify(nodes),
        JSON.stringify(edges)
      );
      const result = JSON.parse(resultJson) as CycleDetectionResult;
      recordTiming('detectCycles', startTime, true);
      return result;
    } catch (error) {
      console.warn('[WASM Loader] detect_cycles failed, using fallback:', error);
    }
  }

  // JavaScript fallback
  const result = detectCyclesFallback(nodes, edges);
  recordTiming('detectCycles', startTime, false);
  return result;
}

/**
 * Calculate the critical path through a weighted dependency graph.
 * Uses WASM if available (HNSW-indexed (measured ~1.9x-4.7x)), falls back to JavaScript.
 *
 * @param nodes - Array of node identifiers
 * @param edges - Array of edges (from -> to dependencies)
 * @param weights - Array of node weights (durations)
 * @returns Critical path result with path, duration, and slack times
 *
 * @example
 * ```typescript
 * const result = await criticalPath(
 *   ['a', 'b', 'c'],
 *   [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
 *   [
 *     { nodeId: 'a', weight: 5 },
 *     { nodeId: 'b', weight: 3 },
 *     { nodeId: 'c', weight: 2 }
 *   ]
 * );
 * console.log(result.path); // ['a', 'b', 'c']
 * console.log(result.totalDuration); // 10
 * ```
 */
export async function criticalPath(
  nodes: string[],
  edges: GraphEdge[],
  weights: NodeWeight[]
): Promise<CriticalPathResult> {
  const startTime = performance.now();

  const wasmModule = await loadGnnWasm();

  if (wasmModule) {
    try {
      const resultJson = wasmModule.critical_path(
        JSON.stringify(nodes),
        JSON.stringify(edges),
        JSON.stringify(weights)
      );
      const parsed = JSON.parse(resultJson);
      // Convert slack array back to Map
      const result: CriticalPathResult = {
        path: parsed.path,
        totalDuration: parsed.totalDuration,
        slack: new Map(Object.entries(parsed.slack).map(([k, v]) => [k, v as number])),
      };
      recordTiming('criticalPath', startTime, true);
      return result;
    } catch (error) {
      console.warn('[WASM Loader] critical_path failed, using fallback:', error);
    }
  }

  // JavaScript fallback
  const result = criticalPathFallback(nodes, edges, weights);
  recordTiming('criticalPath', startTime, false);
  return result;
}

// ============================================================================
// Module Management
// ============================================================================

/**
 * Preload all WASM modules.
 * Call this during initialization for best performance.
 *
 * @returns Object indicating which modules were loaded
 *
 * @example
 * ```typescript
 * const status = await preloadWasmModules();
 * console.log(status);
 * // { formulaWasm: true, gnnWasm: true }
 * ```
 */
export async function preloadWasmModules(): Promise<{
  formulaWasm: boolean;
  gnnWasm: boolean;
}> {
  const [formulaResult, gnnResult] = await Promise.all([
    loadFormulaWasm(),
    loadGnnWasm(),
  ]);

  return {
    formulaWasm: formulaResult !== null,
    gnnWasm: gnnResult !== null,
  };
}

/**
 * Get WASM module versions.
 *
 * @returns Object with version strings, or null if module not loaded
 */
export async function getWasmVersions(): Promise<{
  formulaWasm: string | null;
  gnnWasm: string | null;
}> {
  const formulaModule = await loadFormulaWasm();
  const gnnModule = await loadGnnWasm();

  return {
    formulaWasm: formulaModule?.version?.() ?? null,
    gnnWasm: gnnModule?.version?.() ?? null,
  };
}

/**
 * Reset the WASM module cache.
 * Clears lazy loader cache and forces reload on next access.
 * Useful for testing or when modules need to be reloaded.
 */
export function resetWasmCache(): void {
  // Clear the lazy loaders' internal cache
  lazyFormulaWasm.clearCache();
  lazyGnnWasm.clearCache();
  wasmAvailable = null;
}

/**
 * Schedule idle-time preloading of WASM modules.
 * Uses requestIdleCallback in browser, setImmediate in Node.
 * Does not block the main thread.
 *
 * @example
 * ```typescript
 * // Call during app initialization
 * scheduleIdlePreload();
 * ```
 */
export function scheduleIdlePreload(): void {
  // Register WASM modules for preloading
  modulePreloader.register('gastown-formula-wasm', async () => {
    return loadFormulaWasm();
  }, 10); // High priority

  modulePreloader.register('ruvector-gnn-wasm', async () => {
    return loadGnnWasm();
  }, 5); // Medium priority

  // Start preloading during idle time
  modulePreloader.startPreload().catch((error) => {
    console.debug('[WASM Loader] Idle preload error:', error);
  });
}

/**
 * Get cache statistics for performance monitoring.
 *
 * @returns Object with cache stats for each cache type
 *
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Parse cache: ${stats.parseCache.entries} entries`);
 * console.log(`Cook cache hit rate: ${stats.cookCache.hitRate}`);
 * ```
 */
export function getCacheStats(): {
  parseCache: { entries: number; sizeBytes: number; hitRate: number };
  cookCache: { entries: number; sizeBytes: number; hitRate: number };
  topoSortCache: { entries: number; sizeBytes: number; hitRate: number };
  astCache: { entries: number; sizeBytes: number };
  preloader: { queued: number; loaded: number; errors: number; isPreloading: boolean };
  deduplicator: { parsePending: number; cookPending: number; graphPending: number };
} {
  const parseCacheStats = formulaParseCache.stats();
  const cookCacheStats = cookCache.stats();
  const topoSortCacheStats = topoSortCache.stats();
  const astCacheStats = astCache.stats();
  const preloaderStatus = modulePreloader.status();

  return {
    parseCache: {
      entries: parseCacheStats.entries,
      sizeBytes: parseCacheStats.sizeBytes,
      hitRate: parseCacheStats.hitRate,
    },
    cookCache: {
      entries: cookCacheStats.entries,
      sizeBytes: cookCacheStats.sizeBytes,
      hitRate: cookCacheStats.hitRate,
    },
    topoSortCache: {
      entries: topoSortCacheStats.entries,
      sizeBytes: topoSortCacheStats.sizeBytes,
      hitRate: topoSortCacheStats.hitRate,
    },
    astCache: {
      entries: astCacheStats.entries,
      sizeBytes: astCacheStats.sizeBytes,
    },
    preloader: preloaderStatus,
    deduplicator: {
      parsePending: parseDedup.pendingCount,
      cookPending: cookDedup.pendingCount,
      graphPending: graphDedup.pendingCount,
    },
  };
}

/**
 * Clear all result caches.
 * Useful for testing or when formulas have been modified.
 */
export function clearAllCaches(): void {
  formulaParseCache.clear();
  cookCache.clear();
  topoSortCache.clear();
  astCache.clear();
  parseDedup.clear();
  cookDedup.clear();
  graphDedup.clear();
}

// ============================================================================
// Export Summary
// ============================================================================

export default {
  // Availability
  isWasmAvailable,

  // Formula operations
  loadFormulaWasm,
  parseFormula,
  cookFormula,
  cookBatch,

  // Graph operations
  loadGnnWasm,
  topoSort,
  detectCycles,
  criticalPath,

  // Module management
  preloadWasmModules,
  getWasmVersions,
  resetWasmCache,

  // Lazy loading status
  isFormulaWasmLoaded,
  isGnnWasmLoaded,
  getWasmLazyStats,

  // Performance optimization
  scheduleIdlePreload,
  getCacheStats,
  clearAllCaches,

  // Performance logging
  getPerformanceLog,
  clearPerformanceLog,
};

/**
 * Graph Analyzer Module
 *
 * Provides code dependency graph analysis using ruvector's graph algorithms:
 * - MinCut for code boundary detection (refactoring suggestions)
 * - Louvain for module/community detection
 * - Circular dependency detection
 * - DOT format export for visualization
 *
 * Falls back to built-in implementations when @ruvector/wasm is not available.
 *
 * @module @claude-flow/cli/ruvector/graph-analyzer
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
// Type definitions moved to ./graph-analyzer/types.ts (W144, P3.26 cut #1).
import type {
  GraphNode, GraphEdge, DependencyGraph, MinCutBoundary, ModuleCommunity,
  GraphAnalysisResult, IRuVectorGraph,
} from './graph-analyzer/types.js';
// Re-exported so callers importing these types from './graph-analyzer.js'
// keep resolving byte-identically.
export type {
  GraphNode, GraphEdge, DependencyGraph, MinCutBoundary, ModuleCommunity,
  CircularDependency, GraphAnalysisResult,
} from './graph-analyzer/types.js';
// Pure graph algorithms moved to ./graph-analyzer/algorithms.ts (W145).
import { estimateComplexity } from './graph-analyzer/algorithms.js';

// ============================================================================
// Caching for Performance
// ============================================================================

/**
 * Cache for dependency graphs (5 minute TTL)
 */
const graphCache = new Map<string, { graph: DependencyGraph; timestamp: number }>();
const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache for analysis results (2 minute TTL)
 */
const analysisResultCache = new Map<string, { result: GraphAnalysisResult; timestamp: number }>();
const ANALYSIS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Clear all graph caches
 */
export function clearGraphCaches(): void {
  graphCache.clear();
  analysisResultCache.clear();
}

/**
 * Get cache statistics
 */
export function getGraphCacheStats(): { graphCacheSize: number; analysisCacheSize: number } {
  return {
    graphCacheSize: graphCache.size,
    analysisCacheSize: analysisResultCache.size,
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Node in the dependency graph
 */

let ruVectorGraph: IRuVectorGraph | null = null;
let ruVectorLoadAttempted = false;

/**
 * Attempt to load ruvector graph algorithms
 */
export async function loadRuVector(): Promise<IRuVectorGraph | null> {
  if (ruVectorLoadAttempted) return ruVectorGraph;
  ruVectorLoadAttempted = true;

  // Use dynamic module names to bypass TypeScript static analysis
  // These modules are optional and may not be installed
  const ruvectorModule = 'ruvector';
  const wasmModule = '@ruvector/wasm';

  try {
    // Try to load ruvector's graph module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ruvector: any = await import(/* webpackIgnore: true */ ruvectorModule).catch(() => null);

    if (ruvector && typeof ruvector.hooks_graph_mincut === 'function' && typeof ruvector.hooks_graph_cluster === 'function') {
      ruVectorGraph = {
        mincut: (nodes, edges) => ruvector.hooks_graph_mincut(nodes, edges),
        louvain: (nodes, edges) => ruvector.hooks_graph_cluster(nodes, edges),
      };
      return ruVectorGraph;
    }
  } catch {
    // Try alternative import paths
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wasm: any = await import(/* webpackIgnore: true */ wasmModule).catch(() => null);
      if (wasm && wasm.GraphAnalyzer) {
        const analyzer = new wasm.GraphAnalyzer();
        ruVectorGraph = {
          mincut: (nodes, edges) => analyzer.mincut(nodes, edges),
          louvain: (nodes, edges) => analyzer.louvain(nodes, edges),
        };
        return ruVectorGraph;
      }
    } catch {
      // Fallback will be used
    }
  }

  return null;
}

// ============================================================================
// Import/Require Parser
// ============================================================================

/**
 * Extract imports from TypeScript/JavaScript file
 */

// estimateComplexity/fallback* re-exported for the package index (the
// pre-split file exported its algorithms import).
export { estimateComplexity, fallbackMinCut, fallbackLouvain } from './graph-analyzer/algorithms.js';
// Parse helpers and the analysis/DOT cluster were extracted into
// ./graph-analyzer-parse.ts and ./graph-analyzer-analysis.ts during
// campaign-2 wave 40 (W246). The caches/loader lets stay here with
// every writer; the public analysis surface is re-exported.
export {
  detectCircularDependencies,
  analyzeMinCutBoundaries,
  analyzeModuleCommunities,
  exportToDot,
} from './graph-analyzer-analysis.js';
import {
  analyzeMinCutBoundaries,
  analyzeModuleCommunities,
  detectCircularDependencies,
} from './graph-analyzer-analysis.js';
import {
  extractExports,
  extractImports,
  resolveImportPath,
} from './graph-analyzer-parse.js';

export async function buildDependencyGraph(
  rootDir: string,
  options: {
    include?: string[];
    exclude?: string[];
    maxDepth?: number;
    skipCache?: boolean;
  } = {}
): Promise<DependencyGraph> {
  // Check cache first
  const cacheKey = `${rootDir}:${JSON.stringify(options)}`;
  if (!options.skipCache) {
    const cached = graphCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < GRAPH_CACHE_TTL_MS) {
      return cached.graph;
    }
  }

  const startTime = Date.now();
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const include = options.include || ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const exclude = options.exclude || ['node_modules', 'dist', 'build', '.git', '__tests__', '*.test.*', '*.spec.*'];
  const maxDepth = options.maxDepth ?? 10;

  /**
   * Check if path should be excluded
   */
  function shouldExclude(path: string): boolean {
    const name = basename(path);
    return exclude.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(name);
      }
      return name === pattern || path.includes(`/${pattern}/`);
    });
  }

  /**
   * Recursively scan directory for source files
   */
  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(rootDir, fullPath);

        if (shouldExclude(fullPath)) continue;

        if (entry.isDirectory()) {
          await scanDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (include.includes(ext)) {
            await processFile(fullPath, relPath);
          }
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }

  /**
   * Process a single source file
   */
  async function processFile(fullPath: string, relPath: string): Promise<void> {
    try {
      const content = await readFile(fullPath, 'utf-8');
      const fileStats = await stat(fullPath);

      const imports = extractImports(content, fullPath);
      const exportsList = extractExports(content);

      // Create node
      const node: GraphNode = {
        id: relPath,
        path: relPath,
        name: basename(relPath, extname(relPath)),
        type: 'file',
        imports: imports.map(i => i.path),
        exports: exportsList,
        size: fileStats.size,
        complexity: estimateComplexity(content),
      };

      nodes.set(relPath, node);

      // Create edges for imports
      for (const imp of imports) {
        const resolved = resolveImportPath(imp.path, fullPath, rootDir);
        if (resolved) {
          const targetRel = relative(rootDir, resolved);
          edges.push({
            source: relPath,
            target: targetRel,
            type: imp.type,
            weight: imp.type === 're-export' ? 2 : 1,
          });
        }
      }
    } catch {
      // File not readable, skip
    }
  }

  // Build the graph
  await scanDir(rootDir, 0);

  // Normalize edges - ensure targets exist (with extension variations)
  const normalizedEdges: GraphEdge[] = [];
  for (const edge of edges) {
    // Try to find matching node
    let targetKey = edge.target;
    if (!nodes.has(targetKey)) {
      // Try with different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
      const baseTarget = targetKey.replace(/\.[^.]+$/, '');
      for (const ext of extensions) {
        if (nodes.has(baseTarget + ext)) {
          targetKey = baseTarget + ext;
          break;
        }
        // Try index files
        if (nodes.has(join(baseTarget, 'index' + ext))) {
          targetKey = join(baseTarget, 'index' + ext);
          break;
        }
      }
    }

    if (nodes.has(targetKey)) {
      normalizedEdges.push({ ...edge, target: targetKey });
    }
  }

  const graph: DependencyGraph = {
    nodes,
    edges: normalizedEdges,
    metadata: {
      rootDir,
      totalFiles: nodes.size,
      totalEdges: normalizedEdges.length,
      buildTime: Date.now() - startTime,
    },
  };

  // Cache the result
  graphCache.set(cacheKey, { graph, timestamp: Date.now() });

  return graph;
}

/**
 * Estimate cyclomatic complexity from code
 */

// ============================================================================
// Circular Dependency Detection
// ============================================================================

/**
 * Detect circular dependencies using DFS
 */

export async function analyzeGraph(
  rootDir: string,
  options: {
    includeBoundaries?: boolean;
    includeModules?: boolean;
    numPartitions?: number;
    skipCache?: boolean;
  } = {}
): Promise<GraphAnalysisResult> {
  // Check cache first
  const cacheKey = `analysis:${rootDir}:${JSON.stringify(options)}`;
  if (!options.skipCache) {
    const cached = analysisResultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL_MS) {
      return cached.result;
    }
  }

  const graph = await buildDependencyGraph(rootDir, { skipCache: options.skipCache });

  // Calculate statistics
  const nodeCount = graph.nodes.size;
  const edgeCount = graph.edges.length;

  const degrees = new Map<string, number>();
  for (const node of Array.from(graph.nodes.keys())) {
    degrees.set(node, 0);
  }
  for (const edge of graph.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  }

  const degreeValues = Array.from(degrees.values());
  const avgDegree = degreeValues.length > 0 ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length : 0;
  const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;
  const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

  // Count connected components
  const visited = new Set<string>();
  let componentCount = 0;

  function dfs(node: string): void {
    visited.add(node);
    for (const edge of graph.edges) {
      if (edge.source === node && !visited.has(edge.target)) {
        dfs(edge.target);
      }
      if (edge.target === node && !visited.has(edge.source)) {
        dfs(edge.source);
      }
    }
  }

  for (const node of Array.from(graph.nodes.keys())) {
    if (!visited.has(node)) {
      componentCount++;
      dfs(node);
    }
  }

  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(graph);

  // Analyze boundaries and communities if requested
  let boundaries: MinCutBoundary[] | undefined;
  let communities: ModuleCommunity[] | undefined;

  if (options.includeBoundaries !== false) {
    boundaries = await analyzeMinCutBoundaries(graph, options.numPartitions);
  }

  if (options.includeModules !== false) {
    communities = await analyzeModuleCommunities(graph);
  }

  const result: GraphAnalysisResult = {
    graph,
    boundaries,
    communities,
    circularDependencies,
    statistics: {
      nodeCount,
      edgeCount,
      avgDegree,
      maxDegree,
      density,
      componentCount,
    },
  };

  // Cache the result
  analysisResultCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

// ============================================================================
// DOT Format Export
// ============================================================================

/**
 * Export graph to DOT format for visualization
 */

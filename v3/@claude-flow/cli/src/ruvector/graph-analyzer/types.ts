/**
 * Type definitions for the dependency-graph analyzer — GraphNode/Edge,
 * DependencyGraph, MinCutBoundary, ModuleCommunity, CircularDependency,
 * GraphAnalysisResult, and the IRuVectorGraph backend interface.
 *
 * Extracted from graph-analyzer.ts (W144, P3.26 cut #1).
 */

export interface GraphNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'module' | 'package';
  imports: string[];
  exports: string[];
  size: number;
  complexity?: number;
}

/**
 * Edge in the dependency graph
 */
export interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic' | 're-export';
  weight: number;
}

/**
 * Dependency graph representation
 */
export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  metadata: {
    rootDir: string;
    totalFiles: number;
    totalEdges: number;
    buildTime: number;
  };
}

/**
 * MinCut result representing a natural boundary in the codebase
 */
export interface MinCutBoundary {
  cutValue: number;
  partition1: string[];
  partition2: string[];
  cutEdges: GraphEdge[];
  suggestion: string;
}

/**
 * Community/module detection result
 */
export interface ModuleCommunity {
  id: number;
  members: string[];
  cohesion: number;
  centralNode?: string;
  suggestedName?: string;
}

/**
 * Circular dependency info
 */
export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * Analysis result
 */
export interface GraphAnalysisResult {
  graph: DependencyGraph;
  boundaries?: MinCutBoundary[];
  communities?: ModuleCommunity[];
  circularDependencies: CircularDependency[];
  statistics: {
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    maxDegree: number;
    density: number;
    componentCount: number;
  };
}

// ============================================================================
// RuVector Integration (with graceful fallback)
// ============================================================================

/**
 * Interface for ruvector graph operations
 */
export interface IRuVectorGraph {
  mincut(nodes: string[], edges: Array<[string, string, number]>): {
    cutValue: number;
    partition1: string[];
    partition2: string[];
    cutEdges: Array<[string, string]>;
  };
  louvain(nodes: string[], edges: Array<[string, string, number]>): {
    communities: Array<{ id: number; members: string[] }>;
    modularity: number;
  };
}

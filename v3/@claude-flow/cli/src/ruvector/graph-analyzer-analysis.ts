/**
 * Graph Analyzer — cycle/min-cut/community analysis & DOT export
 *
 * Extracted verbatim from graph-analyzer.ts (lines 405-646 + 751-856)
 * during campaign-2 wave 40 (W246). graph-analyzer.ts stays the barrel
 * (function-decl back-import of the stateful loadRuVector — W208
 * static-cycle shape).
 */

import { extname, dirname, basename } from 'path';
import type {
  CircularDependency,
  DependencyGraph,
  GraphAnalysisResult,
  MinCutBoundary,
  ModuleCommunity,
} from './graph-analyzer/types.js';
import { fallbackMinCut, fallbackLouvain } from './graph-analyzer/algorithms.js';
import { loadRuVector } from './graph-analyzer.js';

export function detectCircularDependencies(graph: DependencyGraph): CircularDependency[] {
  const cycles: CircularDependency[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  // Build adjacency list
  const adjList = new Map<string, string[]>();
  for (const node of Array.from(graph.nodes.keys())) {
    adjList.set(node, []);
  }
  for (const edge of graph.edges) {
    const list = adjList.get(edge.source);
    if (list) {
      list.push(edge.target);
    }
  }

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle

        const severity = getCycleSeverity(cycle, graph);
        cycles.push({
          cycle,
          severity,
          suggestion: getCycleSuggestion(cycle, graph),
        });
      }
    }

    recursionStack.delete(node);
    path.pop();
  }

  for (const node of Array.from(graph.nodes.keys())) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function getCycleSeverity(cycle: string[], _graph: DependencyGraph): 'low' | 'medium' | 'high' {
  // High severity if cycle involves many files or core modules
  if (cycle.length > 5) return 'high';
  if (cycle.some(n => n.includes('index') || n.includes('core'))) return 'high';
  if (cycle.length > 3) return 'medium';
  return 'low';
}

function getCycleSuggestion(cycle: string[], graph: DependencyGraph): string {
  if (cycle.length === 2) {
    return `Consider extracting shared code into a separate module to break the cycle between ${cycle[0]} and ${cycle[1]}`;
  }

  // Find the weakest link (least important edge)
  let weakestEdge = '';
  let minImports = Infinity;

  for (let i = 0; i < cycle.length - 1; i++) {
    const from = cycle[i];
    const to = cycle[i + 1];
    const fromNode = graph.nodes.get(from);
    if (fromNode && fromNode.imports.length < minImports) {
      minImports = fromNode.imports.length;
      weakestEdge = `${from} -> ${to}`;
    }
  }

  return `Break the cycle by refactoring the dependency: ${weakestEdge}. Consider dependency injection or extracting interfaces.`;
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze graph boundaries using MinCut algorithm
 */
export async function analyzeMinCutBoundaries(
  graph: DependencyGraph,
  numPartitions: number = 2
): Promise<MinCutBoundary[]> {
  const nodes = Array.from(graph.nodes.keys());
  const edges: Array<[string, string, number]> = graph.edges.map(e => [e.source, e.target, e.weight]);

  const boundaries: MinCutBoundary[] = [];

  // Try to use ruvector, fallback to built-in
  const ruVector = await loadRuVector();

  // Get initial partition
  let result: ReturnType<typeof fallbackMinCut>;
  if (ruVector) {
    result = ruVector.mincut(nodes, edges);
  } else {
    result = fallbackMinCut(nodes, edges);
  }

  boundaries.push({
    cutValue: result.cutValue,
    partition1: result.partition1,
    partition2: result.partition2,
    cutEdges: result.cutEdges.map(([s, t]) => {
      const edge = graph.edges.find(e => e.source === s && e.target === t);
      return edge || { source: s, target: t, type: 'import' as const, weight: 1 };
    }),
    suggestion: generateBoundarySuggestion(result.partition1, result.partition2, graph),
  });

  // Recursively partition if needed
  if (numPartitions > 2 && result.partition1.length > 2) {
    const subEdges: Array<[string, string, number]> = edges.filter(
      ([u, v]) => result.partition1.includes(u) && result.partition1.includes(v)
    );
    const subResult = ruVector
      ? ruVector.mincut(result.partition1, subEdges)
      : fallbackMinCut(result.partition1, subEdges);

    if (subResult.cutValue > 0) {
      boundaries.push({
        cutValue: subResult.cutValue,
        partition1: subResult.partition1,
        partition2: subResult.partition2,
        cutEdges: subResult.cutEdges.map(([s, t]) => {
          const edge = graph.edges.find(e => e.source === s && e.target === t);
          return edge || { source: s, target: t, type: 'import' as const, weight: 1 };
        }),
        suggestion: generateBoundarySuggestion(subResult.partition1, subResult.partition2, graph),
      });
    }
  }

  return boundaries;
}

function generateBoundarySuggestion(partition1: string[], partition2: string[], _graph: DependencyGraph): string {
  // Analyze the partitions to suggest organization
  const p1Dirs = partition1.map(p => dirname(p)).filter(d => d !== '.');
  const p2Dirs = partition2.map(p => dirname(p)).filter(d => d !== '.');
  const p1DirsSet = new Set(p1Dirs);
  const p2DirsSet = new Set(p2Dirs);

  if (p1DirsSet.size === 1 && p2DirsSet.size === 1) {
    const dir1 = p1Dirs[0];
    const dir2 = p2Dirs[0];
    return `Natural boundary detected between ${dir1}/ and ${dir2}/. These could be separate packages.`;
  }

  if (partition1.length > partition2.length * 3) {
    return `Consider extracting ${partition2.length} files into a separate module. They have minimal coupling to the rest.`;
  }

  return `Found ${partition1.length} and ${partition2.length} file groups with minimal coupling. Consider organizing into separate modules.`;
}

/**
 * Analyze module communities using Louvain algorithm
 */
export async function analyzeModuleCommunities(graph: DependencyGraph): Promise<ModuleCommunity[]> {
  const nodes = Array.from(graph.nodes.keys());
  const edges: Array<[string, string, number]> = graph.edges.map(e => [e.source, e.target, e.weight]);

  // Try to use ruvector, fallback to built-in
  const ruVector = await loadRuVector();
  const result = ruVector ? ruVector.louvain(nodes, edges) : fallbackLouvain(nodes, edges);

  return result.communities.map(comm => {
    // Find the most connected node as central
    let maxConnections = 0;
    let centralNode = comm.members[0];

    for (const member of comm.members) {
      const connections = graph.edges.filter(
        e =>
          (e.source === member && comm.members.includes(e.target)) ||
          (e.target === member && comm.members.includes(e.source))
      ).length;

      if (connections > maxConnections) {
        maxConnections = connections;
        centralNode = member;
      }
    }

    // Calculate cohesion (internal edges / total possible edges)
    const internalEdges = graph.edges.filter(
      e => comm.members.includes(e.source) && comm.members.includes(e.target)
    ).length;
    const possibleEdges = (comm.members.length * (comm.members.length - 1)) / 2;
    const cohesion = possibleEdges > 0 ? internalEdges / possibleEdges : 1;

    // Suggest name based on common directory
    const dirs = comm.members.map(m => dirname(m));
    const commonDir = findCommonPrefix(dirs);
    const suggestedName = commonDir || basename(centralNode, extname(centralNode));

    return {
      id: comm.id,
      members: comm.members,
      cohesion,
      centralNode,
      suggestedName,
    };
  });
}

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  const sorted = [...strings].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  let i = 0;
  while (i < first.length && first[i] === last[i]) {
    i++;
  }

  const prefix = first.slice(0, i);
  // Return the last complete directory segment
  const lastSlash = prefix.lastIndexOf('/');
  return lastSlash > 0 ? prefix.slice(0, lastSlash) : '';
}

/**
 * Full graph analysis (with caching)
 */

export function exportToDot(
  result: GraphAnalysisResult,
  options: {
    includeLabels?: boolean;
    colorByCommunity?: boolean;
    highlightCycles?: boolean;
  } = {}
): string {
  const { graph, communities, circularDependencies } = result;
  const lines: string[] = ['digraph DependencyGraph {'];
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');

  // Generate colors for communities
  const communityColors = new Map<string, string>();
  if (options.colorByCommunity && communities) {
    const colors = [
      '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
      '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
    ];
    for (const comm of communities) {
      const color = colors[comm.id % colors.length];
      for (const member of comm.members) {
        communityColors.set(member, color);
      }
    }
  }

  // Find nodes in cycles
  const nodesInCycles = new Set<string>();
  if (options.highlightCycles && circularDependencies) {
    for (const cycle of circularDependencies) {
      for (const node of cycle.cycle) {
        nodesInCycles.add(node);
      }
    }
  }

  // Output nodes
  lines.push('  // Nodes');
  for (const [id, node] of Array.from(graph.nodes.entries())) {
    const attrs: string[] = [];

    if (options.includeLabels !== false) {
      attrs.push(`label="${node.name}"`);
    }

    if (communityColors.has(id)) {
      attrs.push(`fillcolor="${communityColors.get(id)}"`, 'style="filled,rounded"');
    }

    if (nodesInCycles.has(id)) {
      attrs.push('color=red', 'penwidth=2');
    }

    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  "${id}"${attrStr};`);
  }

  lines.push('');

  // Output edges
  lines.push('  // Edges');
  for (const edge of graph.edges) {
    const attrs: string[] = [];

    if (edge.type === 'dynamic') {
      attrs.push('style=dashed');
    } else if (edge.type === 're-export') {
      attrs.push('style=bold');
    }

    // Check if edge is part of a cycle
    if (options.highlightCycles) {
      const isCycleEdge = circularDependencies.some(cd => {
        for (let i = 0; i < cd.cycle.length - 1; i++) {
          if (cd.cycle[i] === edge.source && cd.cycle[i + 1] === edge.target) {
            return true;
          }
        }
        return false;
      });

      if (isCycleEdge) {
        attrs.push('color=red', 'penwidth=2');
      }
    }

    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  "${edge.source}" -> "${edge.target}"${attrStr};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export {
  loadRuVector,
  fallbackMinCut,
  fallbackLouvain,
};

/**
 * WASM Loader — JavaScript fallback implementations
 *
 * Pure-JS parse/cook/topoSort/detectCycles/criticalPath fallbacks used
 * when the WASM modules are unavailable. Module-private in the original
 * wasm-loader.ts (P3.73, W194); NOT re-exported by the barrel.
 */

import type {
  CriticalPathResult,
  Formula,
  TopoSortResult,
} from './types.js';
import type {
  CycleDetectionResult,
  GraphEdge,
  NodeWeight,
} from './wasm-loader-types.js';

// JavaScript Fallback Implementations
// ============================================================================

/**
 * JavaScript fallback for TOML parsing.
 * Simple implementation for basic formula parsing.
 */
export function parseTomlFallback(content: string): Formula {
  // Basic TOML parsing fallback
  // In production, use a proper TOML parser like @iarna/toml
  const lines = content.split('\n');
  const result: Record<string, unknown> = {};
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^([^=]+)=(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value: unknown = kvMatch[2].trim();

      // Parse value type
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (/^\d+$/.test(value as string)) {
        value = parseInt(value as string, 10);
      } else if (/^\d+\.\d+$/.test(value as string)) {
        value = parseFloat(value as string);
      } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
        value = (value as string).slice(1, -1);
      }

      if (currentSection) {
        (result[currentSection] as Record<string, unknown>)[key] = value;
      } else {
        result[key] = value;
      }
    }
  }

  // Transform to Formula shape
  return {
    name: (result['name'] as string) || 'unknown',
    description: (result['description'] as string) || '',
    type: (result['type'] as Formula['type']) || 'workflow',
    version: (result['version'] as number) || 1,
    steps: result['steps'] as Formula['steps'],
    legs: result['legs'] as Formula['legs'],
    vars: result['vars'] as Formula['vars'],
    metadata: result['metadata'] as Formula['metadata'],
  };
}

/**
 * JavaScript fallback for variable substitution in formula.
 */
export function cookFormulaFallback(
  formula: Formula,
  vars: Record<string, string>
): Formula {
  const substituteVars = (text: string): string => {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      // Replace {{var}} and ${var} patterns
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
  };

  const substituteObject = <T>(obj: T): T => {
    if (typeof obj === 'string') {
      return substituteVars(obj) as T;
    }
    if (Array.isArray(obj)) {
      return obj.map(substituteObject) as T;
    }
    if (obj !== null && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = substituteObject(value);
      }
      return result as T;
    }
    return obj;
  };

  return {
    ...substituteObject(formula),
    cookedAt: new Date(),
    cookedVars: vars,
    originalName: formula.name,
  } as Formula;
}

/**
 * JavaScript fallback for topological sort.
 * Uses Kahn's algorithm.
 */
export function topoSortFallback(
  nodes: string[],
  edges: GraphEdge[]
): TopoSortResult {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node, 0);
    graph.set(node, []);
  }

  // Build graph
  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Find nodes with no incoming edges
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighbor of graph.get(node) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycle
  const hasCycle = sorted.length !== nodes.length;
  const cycleNodes = hasCycle
    ? nodes.filter((n) => !sorted.includes(n))
    : undefined;

  return {
    sorted,
    hasCycle,
    cycleNodes,
  };
}

/**
 * JavaScript fallback for cycle detection.
 * Uses DFS with coloring.
 */
export function detectCyclesFallback(
  nodes: string[],
  edges: GraphEdge[]
): CycleDetectionResult {
  const graph = new Map<string, string[]>();
  const WHITE = 0; // Unvisited
  const GRAY = 1; // In current path
  const BLACK = 2; // Visited

  // Initialize
  for (const node of nodes) {
    graph.set(node, []);
  }

  // Build graph
  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
  }

  const colors = new Map<string, number>();
  for (const node of nodes) {
    colors.set(node, WHITE);
  }

  const cycleNodes: string[] = [];

  const dfs = (node: string, path: string[]): boolean => {
    colors.set(node, GRAY);
    path.push(node);

    for (const neighbor of graph.get(node) || []) {
      if (colors.get(neighbor) === GRAY) {
        // Found cycle - extract cycle nodes
        const cycleStart = path.indexOf(neighbor);
        cycleNodes.push(...path.slice(cycleStart));
        return true;
      }
      if (colors.get(neighbor) === WHITE) {
        if (dfs(neighbor, path)) {
          return true;
        }
      }
    }

    colors.set(node, BLACK);
    path.pop();
    return false;
  };

  for (const node of nodes) {
    if (colors.get(node) === WHITE) {
      if (dfs(node, [])) {
        break;
      }
    }
  }

  return {
    hasCycle: cycleNodes.length > 0,
    cycleNodes: [...new Set(cycleNodes)],
  };
}

/**
 * JavaScript fallback for critical path calculation.
 * Uses longest path algorithm on DAG.
 */
export function criticalPathFallback(
  nodes: string[],
  edges: GraphEdge[],
  weights: NodeWeight[]
): CriticalPathResult {
  // First, do topological sort
  const topoResult = topoSortFallback(nodes, edges);

  if (topoResult.hasCycle) {
    return {
      path: [],
      totalDuration: 0,
      slack: new Map(),
    };
  }

  const weightMap = new Map<string, number>();
  for (const w of weights) {
    weightMap.set(w.nodeId, w.weight);
  }

  const graph = new Map<string, string[]>();
  const reverseGraph = new Map<string, string[]>();

  for (const node of nodes) {
    graph.set(node, []);
    reverseGraph.set(node, []);
  }

  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
    reverseGraph.get(edge.to)?.push(edge.from);
  }

  // Forward pass: calculate earliest start times
  const earliest = new Map<string, number>();
  for (const node of topoResult.sorted) {
    let maxPredecessor = 0;
    for (const pred of reverseGraph.get(node) || []) {
      const predEnd = (earliest.get(pred) || 0) + (weightMap.get(pred) || 0);
      maxPredecessor = Math.max(maxPredecessor, predEnd);
    }
    earliest.set(node, maxPredecessor);
  }

  // Backward pass: calculate latest start times
  const latest = new Map<string, number>();
  const reverseSorted = [...topoResult.sorted].reverse();
  const totalDuration = Math.max(
    ...nodes.map((n) => (earliest.get(n) || 0) + (weightMap.get(n) || 0))
  );

  for (const node of reverseSorted) {
    const successors = graph.get(node) || [];
    if (successors.length === 0) {
      latest.set(node, totalDuration - (weightMap.get(node) || 0));
    } else {
      let minSuccessor = Infinity;
      for (const succ of successors) {
        minSuccessor = Math.min(minSuccessor, latest.get(succ) || 0);
      }
      latest.set(node, minSuccessor - (weightMap.get(node) || 0));
    }
  }

  // Calculate slack and find critical path
  const slack = new Map<string, number>();
  const criticalNodes: string[] = [];

  for (const node of nodes) {
    const nodeSlack = (latest.get(node) || 0) - (earliest.get(node) || 0);
    slack.set(node, nodeSlack);
    if (nodeSlack === 0) {
      criticalNodes.push(node);
    }
  }

  // Order critical nodes by topological order
  const path = topoResult.sorted.filter((n) => criticalNodes.includes(n));

  return {
    path,
    totalDuration,
    slack,
  };
}

// ============================================================================

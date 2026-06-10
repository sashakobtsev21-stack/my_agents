/**
 * Pure graph algorithms for the dependency analyzer (JS fallbacks used
 * when the ruvector native backend is unavailable) — cyclomatic-complexity
 * estimation, a min-cut partitioner, and a Louvain community detector.
 * Operate on raw node/edge arrays; no graph-type or I/O deps.
 *
 * Extracted from graph-analyzer.ts (W145, P3.26 cut #2).
 */

export function estimateComplexity(content: string): number {
  let complexity = 1;

  // Count branching statements
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+:/g, // Ternary operator
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }

  return complexity;
}

// ============================================================================
// MinCut Algorithm (Fallback Implementation)
// ============================================================================

/**
 * Stoer-Wagner MinCut algorithm (fallback when ruvector not available)
 * Finds minimum cut with deterministic result
 */
export function fallbackMinCut(
  nodes: string[],
  edges: Array<[string, string, number]>
): {
  cutValue: number;
  partition1: string[];
  partition2: string[];
  cutEdges: Array<[string, string]>;
} {
  if (nodes.length < 2) {
    return {
      cutValue: 0,
      partition1: nodes,
      partition2: [],
      cutEdges: [],
    };
  }

  // Build adjacency map with weights
  const adj = new Map<string, Map<string, number>>();
  for (const node of nodes) {
    adj.set(node, new Map());
  }
  for (const [u, v, w] of edges) {
    if (adj.has(u) && adj.has(v)) {
      adj.get(u)!.set(v, (adj.get(u)!.get(v) || 0) + w);
      adj.get(v)!.set(u, (adj.get(v)!.get(u) || 0) + w);
    }
  }

  let bestCut = Infinity;
  let bestPartition1: string[] = [];
  let bestPartition2: string[] = [];
  let bestCutEdges: Array<[string, string]> = [];

  // Run multiple iterations for better results
  const iterations = Math.min(nodes.length * 2, 20);

  for (let iter = 0; iter < iterations; iter++) {
    // Start from different nodes
    const startNode = nodes[iter % nodes.length];
    const inSet = new Set<string>([startNode]);
    const remaining = new Set(nodes.filter(n => n !== startNode));

    while (remaining.size > 1) {
      // Find node with maximum connectivity to current set
      let maxNode = '';
      let maxConn = -1;

      for (const node of Array.from(remaining)) {
        let conn = 0;
        for (const inNode of Array.from(inSet)) {
          conn += adj.get(node)?.get(inNode) || 0;
        }
        if (conn > maxConn) {
          maxConn = conn;
          maxNode = node;
        }
      }

      if (!maxNode) break;

      remaining.delete(maxNode);
      inSet.add(maxNode);
    }

    if (remaining.size === 1) {
      const lastNode = Array.from(remaining)[0];
      let cutValue = 0;
      const cutEdges: Array<[string, string]> = [];

      for (const inNode of Array.from(inSet)) {
        const weight = adj.get(lastNode)?.get(inNode) || 0;
        if (weight > 0) {
          cutValue += weight;
          cutEdges.push([lastNode, inNode]);
        }
      }

      if (cutValue < bestCut) {
        bestCut = cutValue;
        bestPartition1 = Array.from(inSet);
        bestPartition2 = [lastNode];
        bestCutEdges = cutEdges;
      }
    }
  }

  // If we didn't find a good cut, split roughly in half
  if (bestCut === Infinity) {
    const mid = Math.floor(nodes.length / 2);
    bestPartition1 = nodes.slice(0, mid);
    bestPartition2 = nodes.slice(mid);
    bestCut = 0;
    bestCutEdges = [];

    for (const [u, v, w] of edges) {
      const uIn1 = bestPartition1.includes(u);
      const vIn1 = bestPartition1.includes(v);
      if (uIn1 !== vIn1) {
        bestCut += w;
        bestCutEdges.push([u, v]);
      }
    }
  }

  return {
    cutValue: bestCut,
    partition1: bestPartition1,
    partition2: bestPartition2,
    cutEdges: bestCutEdges,
  };
}

// ============================================================================
// Louvain Algorithm (Fallback Implementation)
// ============================================================================

/**
 * Louvain community detection algorithm (fallback when ruvector not available)
 * Greedy modularity optimization
 */
export function fallbackLouvain(
  nodes: string[],
  edges: Array<[string, string, number]>
): {
  communities: Array<{ id: number; members: string[] }>;
  modularity: number;
} {
  if (nodes.length === 0) {
    return { communities: [], modularity: 0 };
  }

  // Build adjacency map
  const adj = new Map<string, Map<string, number>>();
  for (const node of nodes) {
    adj.set(node, new Map());
  }
  let totalWeight = 0;
  for (const [u, v, w] of edges) {
    if (adj.has(u) && adj.has(v)) {
      adj.get(u)!.set(v, (adj.get(u)!.get(v) || 0) + w);
      adj.get(v)!.set(u, (adj.get(v)!.get(u) || 0) + w);
      totalWeight += w * 2;
    }
  }

  if (totalWeight === 0) {
    // No edges, each node is its own community
    return {
      communities: nodes.map((n, i) => ({ id: i, members: [n] })),
      modularity: 0,
    };
  }

  // Initialize: each node in its own community
  const community = new Map<string, number>();
  let nextCommunityId = 0;
  for (const node of nodes) {
    community.set(node, nextCommunityId++);
  }

  // Calculate node degree
  const degree = new Map<string, number>();
  for (const node of nodes) {
    let d = 0;
    for (const [, w] of Array.from(adj.get(node)!.entries())) {
      d += w;
    }
    degree.set(node, d);
  }

  // Louvain phase 1: local moving
  let improved = true;
  const maxIterations = 10;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const node of nodes) {
      const currentCommunity = community.get(node)!;
      const nodeAdj = adj.get(node)!;
      const nodeDegree = degree.get(node)!;

      // Calculate modularity gain for moving to each neighbor's community
      const communityWeights = new Map<number, number>();

      for (const [neighbor, weight] of Array.from(nodeAdj.entries())) {
        const neighborCommunity = community.get(neighbor)!;
        communityWeights.set(
          neighborCommunity,
          (communityWeights.get(neighborCommunity) || 0) + weight
        );
      }

      // Calculate community totals
      const communityTotal = new Map<number, number>();
      for (const [n, c] of Array.from(community.entries())) {
        communityTotal.set(c, (communityTotal.get(c) || 0) + (degree.get(n) || 0));
      }

      let bestCommunity = currentCommunity;
      let bestGain = 0;

      for (const [targetCommunity, edgeWeight] of Array.from(communityWeights.entries())) {
        if (targetCommunity === currentCommunity) continue;

        // Calculate modularity gain
        const currentTotal = communityTotal.get(currentCommunity) || 0;
        const targetTotal = communityTotal.get(targetCommunity) || 0;
        const currentEdges = communityWeights.get(currentCommunity) || 0;

        const gain =
          (edgeWeight - currentEdges) / totalWeight -
          (nodeDegree * (targetTotal - currentTotal + nodeDegree)) / (totalWeight * totalWeight);

        if (gain > bestGain) {
          bestGain = gain;
          bestCommunity = targetCommunity;
        }
      }

      if (bestCommunity !== currentCommunity) {
        community.set(node, bestCommunity);
        improved = true;
      }
    }
  }

  // Collect communities
  const communityMembers = new Map<number, string[]>();
  for (const [node, comm] of Array.from(community.entries())) {
    if (!communityMembers.has(comm)) {
      communityMembers.set(comm, []);
    }
    communityMembers.get(comm)!.push(node);
  }

  // Renumber communities
  const communities: Array<{ id: number; members: string[] }> = [];
  let id = 0;
  for (const members of Array.from(communityMembers.values())) {
    communities.push({ id: id++, members });
  }

  // Calculate modularity
  let modularity = 0;
  for (const [u, v, w] of edges) {
    const cu = community.get(u)!;
    const cv = community.get(v)!;
    if (cu === cv) {
      const du = degree.get(u)!;
      const dv = degree.get(v)!;
      modularity += w - (du * dv) / totalWeight;
    }
  }
  modularity /= totalWeight;

  return { communities, modularity };
}

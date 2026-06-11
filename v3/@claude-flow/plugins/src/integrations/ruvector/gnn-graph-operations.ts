/**
 * RuVector GNN — graph algorithms
 *
 * GraphOperations: PageRank, community detection, paths, and other
 * graph-level operations.
 * Extracted verbatim from gnn.ts (lines 2162-2750) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import type {
  Community,
  CommunityOptions,
  NodeId,
  PageRankOptions,
  Path,
  SQLGenerationOptions,
} from './gnn-types.js';
import type { GraphData } from './types.js';

// ============================================================================
// Graph Operations
// ============================================================================

/**
 * Graph operations for advanced graph analytics.
 *
 * @example
 * ```typescript
 * const ops = new GraphOperations();
 * const neighbors = await ops.kHopNeighbors('node1', 2);
 * const path = await ops.shortestPath('source', 'target');
 * const ranks = await ops.pageRank({ damping: 0.85 });
 * const communities = await ops.communityDetection({ algorithm: 'louvain' });
 * ```
 */
export class GraphOperations {
  private adjacencyList: Map<NodeId, Set<NodeId>> = new Map();
  private weights: Map<string, number> = new Map();
  private nodeFeatures: Map<NodeId, number[]> = new Map();

  /**
   * Load graph data.
   */
  loadGraph(graph: GraphData): void {
    this.adjacencyList.clear();
    this.weights.clear();
    this.nodeFeatures.clear();

    const { nodeFeatures, edgeIndex, edgeWeights } = graph;
    const [sources, targets] = edgeIndex;

    // Initialize nodes
    for (let i = 0; i < nodeFeatures.length; i++) {
      this.adjacencyList.set(i, new Set());
      this.nodeFeatures.set(i, nodeFeatures[i]);
    }

    // Add edges
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const tgt = targets[i];
      const weight = edgeWeights?.[i] ?? 1;

      this.adjacencyList.get(src)?.add(tgt);
      this.adjacencyList.get(tgt)?.add(src);
      this.weights.set(`${src}-${tgt}`, weight);
      this.weights.set(`${tgt}-${src}`, weight);
    }
  }

  /**
   * Find k-hop neighbors of a node.
   */
  async kHopNeighbors(nodeId: NodeId, k: number): Promise<NodeId[]> {
    const visited = new Set<NodeId>();
    const queue: { node: NodeId; depth: number }[] = [{ node: nodeId, depth: 0 }];
    const result: NodeId[] = [];

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (visited.has(node)) continue;
      visited.add(node);

      if (depth > 0) {
        result.push(node);
      }

      if (depth < k) {
        const neighbors = this.adjacencyList.get(node) ?? new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({ node: neighbor, depth: depth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find shortest path between two nodes using Dijkstra's algorithm.
   */
  async shortestPath(source: NodeId, target: NodeId): Promise<Path> {
    const distances = new Map<NodeId, number>();
    const previous = new Map<NodeId, NodeId | null>();
    const unvisited = new Set<NodeId>(this.adjacencyList.keys());

    for (const node of this.adjacencyList.keys()) {
      distances.set(node, Infinity);
      previous.set(node, null);
    }
    distances.set(source, 0);

    while (unvisited.size > 0) {
      // Find minimum distance node
      let current: NodeId | null = null;
      let minDist = Infinity;

      for (const node of unvisited) {
        const dist = distances.get(node) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          current = node;
        }
      }

      if (current === null || current === target) break;

      unvisited.delete(current);

      // Update neighbors
      const neighbors = this.adjacencyList.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!unvisited.has(neighbor)) continue;

        const edgeWeight = this.weights.get(`${current}-${neighbor}`) ?? 1;
        const alt = (distances.get(current) ?? Infinity) + edgeWeight;

        if (alt < (distances.get(neighbor) ?? Infinity)) {
          distances.set(neighbor, alt);
          previous.set(neighbor, current);
        }
      }
    }

    // Reconstruct path
    const nodes: NodeId[] = [];
    let current: NodeId | null = target;

    while (current !== null) {
      nodes.unshift(current);
      current = previous.get(current) ?? null;
    }

    if (nodes[0] !== source) {
      return { nodes: [], weight: Infinity };
    }

    return {
      nodes,
      weight: distances.get(target) ?? Infinity,
    };
  }

  /**
   * Compute PageRank scores for all nodes.
   */
  async pageRank(options: PageRankOptions = {}): Promise<Map<NodeId, number>> {
    const damping = options.damping ?? 0.85;
    const maxIterations = options.maxIterations ?? 100;
    const tolerance = options.tolerance ?? 1e-6;

    const nodes = Array.from(this.adjacencyList.keys());
    const n = nodes.length;

    if (n === 0) return new Map();

    // Initialize ranks
    let ranks = new Map<NodeId, number>();
    const initialRank = 1 / n;

    for (const node of nodes) {
      ranks.set(node, options.personalization?.get(node) ?? initialRank);
    }

    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      const newRanks = new Map<NodeId, number>();
      let diff = 0;

      for (const node of nodes) {
        let sum = 0;
        const neighbors = this.adjacencyList.get(node) ?? new Set();

        for (const neighbor of neighbors) {
          const neighborOutDegree = this.adjacencyList.get(neighbor)?.size ?? 1;
          const neighborRank = ranks.get(neighbor) ?? 0;

          if (options.weighted) {
            const weight = this.weights.get(`${neighbor}-${node}`) ?? 1;
            sum += (neighborRank * weight) / neighborOutDegree;
          } else {
            sum += neighborRank / neighborOutDegree;
          }
        }

        const teleport = options.personalization?.get(node) ?? 1 / n;
        const newRank = (1 - damping) * teleport + damping * sum;
        newRanks.set(node, newRank);

        diff += Math.abs(newRank - (ranks.get(node) ?? 0));
      }

      ranks = newRanks;

      if (diff < tolerance) break;
    }

    return ranks;
  }

  /**
   * Detect communities in the graph.
   */
  async communityDetection(options: CommunityOptions): Promise<Community[]> {
    switch (options.algorithm) {
      case 'louvain':
        return this.louvainCommunityDetection(options);
      case 'label_propagation':
        return this.labelPropagationCommunityDetection(options);
      case 'girvan_newman':
        return this.girvanNewmanCommunityDetection(options);
      case 'spectral':
        return this.spectralCommunityDetection(options);
      default:
        return this.louvainCommunityDetection(options);
    }
  }

  private async louvainCommunityDetection(options: CommunityOptions): Promise<Community[]> {
    const nodes = Array.from(this.adjacencyList.keys());
    const resolution = options.resolution ?? 1.0;
    const maxIterations = options.maxIterations ?? 100;

    // Initialize: each node is its own community
    const community = new Map<NodeId, number>();
    let nextCommunityId = 0;

    for (const node of nodes) {
      community.set(node, nextCommunityId++);
    }

    // Compute total edge weight
    let totalWeight = 0;
    for (const weight of this.weights.values()) {
      totalWeight += weight;
    }
    totalWeight /= 2; // Undirected edges counted twice

    // Phase 1: Local moving
    for (let iter = 0; iter < maxIterations; iter++) {
      let improved = false;

      for (const node of nodes) {
        const currentCommunity = community.get(node)!;
        const neighbors = this.adjacencyList.get(node) ?? new Set();

        // Find neighbor communities
        const neighborCommunities = new Set<number>();
        for (const neighbor of neighbors) {
          neighborCommunities.add(community.get(neighbor)!);
        }

        // Find best community
        let bestCommunity = currentCommunity;
        let bestModularityGain = 0;

        for (const targetCommunity of neighborCommunities) {
          if (targetCommunity === currentCommunity) continue;

          const gain = this.modularityGain(
            node,
            currentCommunity,
            targetCommunity,
            community,
            resolution,
            totalWeight
          );

          if (gain > bestModularityGain) {
            bestModularityGain = gain;
            bestCommunity = targetCommunity;
          }
        }

        if (bestCommunity !== currentCommunity) {
          community.set(node, bestCommunity);
          improved = true;
        }
      }

      if (!improved) break;
    }

    // Build communities
    const communityMembers = new Map<number, NodeId[]>();
    for (const [node, commId] of community.entries()) {
      if (!communityMembers.has(commId)) {
        communityMembers.set(commId, []);
      }
      communityMembers.get(commId)!.push(node);
    }

    // Filter by minimum size
    const minSize = options.minSize ?? 1;
    const communities: Community[] = [];

    for (const [id, members] of communityMembers.entries()) {
      if (members.length >= minSize) {
        communities.push({
          id,
          members,
          centroid: this.computeCentroid(members),
          modularity: this.computeModularity(members, community, totalWeight),
          density: this.computeDensity(members),
        });
      }
    }

    return communities;
  }

  private modularityGain(
    node: NodeId,
    fromCommunity: number,
    toCommunity: number,
    community: Map<NodeId, number>,
    resolution: number,
    totalWeight: number
  ): number {
    const neighbors = this.adjacencyList.get(node) ?? new Set();
    let linksToCommunity = 0;
    let linksFromCommunity = 0;

    for (const neighbor of neighbors) {
      const neighborCommunity = community.get(neighbor)!;
      const weight = this.weights.get(`${node}-${neighbor}`) ?? 1;

      if (neighborCommunity === toCommunity) {
        linksToCommunity += weight;
      }
      if (neighborCommunity === fromCommunity) {
        linksFromCommunity += weight;
      }
    }

    const nodeDegree = neighbors.size;

    return (
      (linksToCommunity - linksFromCommunity) / totalWeight -
      (resolution * nodeDegree * (linksToCommunity - linksFromCommunity)) /
        (2 * totalWeight * totalWeight)
    );
  }

  private computeCentroid(members: NodeId[]): number[] | undefined {
    if (members.length === 0) return undefined;

    const features = members.map((m) => this.nodeFeatures.get(m) ?? []);
    if (features[0]?.length === 0) return undefined;

    const dim = features[0].length;
    const centroid = new Array(dim).fill(0);

    for (const f of features) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += (f[i] ?? 0) / members.length;
      }
    }

    return centroid;
  }

  private computeModularity(
    members: NodeId[],
    _community: Map<NodeId, number>,
    totalWeight: number
  ): number {
    // Note: _community is passed for potential future use in computing inter-community edges
    let internalEdges = 0;
    let totalDegree = 0;

    for (const node of members) {
      const neighbors = this.adjacencyList.get(node) ?? new Set();
      totalDegree += neighbors.size;

      for (const neighbor of neighbors) {
        if (members.includes(neighbor)) {
          internalEdges += this.weights.get(`${node}-${neighbor}`) ?? 1;
        }
      }
    }

    internalEdges /= 2; // Counted twice
    const expected = (totalDegree * totalDegree) / (4 * totalWeight);

    return (internalEdges - expected) / totalWeight;
  }

  private computeDensity(members: NodeId[]): number {
    if (members.length <= 1) return 1;

    let edges = 0;
    for (const node of members) {
      const neighbors = this.adjacencyList.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (members.includes(neighbor)) {
          edges++;
        }
      }
    }

    edges /= 2;
    const maxEdges = (members.length * (members.length - 1)) / 2;

    return edges / maxEdges;
  }

  private async labelPropagationCommunityDetection(options: CommunityOptions): Promise<Community[]> {
    const nodes = Array.from(this.adjacencyList.keys());
    const maxIterations = options.maxIterations ?? 100;

    // Initialize labels
    const labels = new Map<NodeId, number>();
    let nextLabel = 0;
    for (const node of nodes) {
      labels.set(node, nextLabel++);
    }

    // Iterate
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      // Shuffle nodes
      const shuffled = [...nodes].sort(() => Math.random() - 0.5);

      for (const node of shuffled) {
        const neighbors = this.adjacencyList.get(node) ?? new Set();
        if (neighbors.size === 0) continue;

        // Count neighbor labels
        const labelCounts = new Map<number, number>();
        for (const neighbor of neighbors) {
          const label = labels.get(neighbor)!;
          labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
        }

        // Find most common label
        let maxCount = 0;
        let bestLabel = labels.get(node)!;
        for (const [label, count] of labelCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(node)) {
          labels.set(node, bestLabel);
          changed = true;
        }
      }

      if (!changed) break;
    }

    // Build communities
    const communityMembers = new Map<number, NodeId[]>();
    for (const [node, label] of labels.entries()) {
      if (!communityMembers.has(label)) {
        communityMembers.set(label, []);
      }
      communityMembers.get(label)!.push(node);
    }

    return Array.from(communityMembers.entries()).map(([id, members]) => ({
      id,
      members,
      centroid: this.computeCentroid(members),
      density: this.computeDensity(members),
    }));
  }

  private async girvanNewmanCommunityDetection(options: CommunityOptions): Promise<Community[]> {
    // Simplified Girvan-Newman (edge betweenness)
    // In practice, this would iteratively remove high-betweenness edges
    return this.labelPropagationCommunityDetection(options);
  }

  private async spectralCommunityDetection(options: CommunityOptions): Promise<Community[]> {
    // Simplified spectral clustering
    // In practice, would use eigendecomposition of Laplacian
    return this.labelPropagationCommunityDetection(options);
  }

  /**
   * Generate SQL for k-hop neighbors query.
   */
  kHopNeighborsSQL(nodeId: string, k: number, tableName: string, options: SQLGenerationOptions = {}): string {
    const schema = options.schema ?? 'public';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;

    return `
WITH RECURSIVE k_hop AS (
  SELECT source_id AS node_id, 1 AS depth
  FROM "${schema}"."${edgeTable}"
  WHERE target_id = '${nodeId}'
  UNION
  SELECT target_id AS node_id, 1 AS depth
  FROM "${schema}"."${edgeTable}"
  WHERE source_id = '${nodeId}'
  UNION ALL
  SELECT e.target_id AS node_id, kh.depth + 1
  FROM k_hop kh
  JOIN "${schema}"."${edgeTable}" e ON kh.node_id = e.source_id
  WHERE kh.depth < ${k}
  UNION ALL
  SELECT e.source_id AS node_id, kh.depth + 1
  FROM k_hop kh
  JOIN "${schema}"."${edgeTable}" e ON kh.node_id = e.target_id
  WHERE kh.depth < ${k}
)
SELECT DISTINCT node_id FROM k_hop WHERE node_id != '${nodeId}';`.trim();
  }

  /**
   * Generate SQL for shortest path query.
   */
  shortestPathSQL(source: string, target: string, tableName: string, options: SQLGenerationOptions = {}): string {
    const schema = options.schema ?? 'public';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;

    return `
WITH RECURSIVE path AS (
  SELECT
    source_id,
    target_id,
    ARRAY[source_id, target_id] AS path,
    weight AS total_weight,
    1 AS depth
  FROM "${schema}"."${edgeTable}"
  WHERE source_id = '${source}'
  UNION ALL
  SELECT
    p.source_id,
    e.target_id,
    p.path || e.target_id,
    p.total_weight + e.weight,
    p.depth + 1
  FROM path p
  JOIN "${schema}"."${edgeTable}" e ON p.target_id = e.source_id
  WHERE NOT e.target_id = ANY(p.path)
    AND p.depth < 10
)
SELECT path, total_weight
FROM path
WHERE target_id = '${target}'
ORDER BY total_weight
LIMIT 1;`.trim();
  }

  /**
   * Generate SQL for PageRank computation.
   */
  pageRankSQL(tableName: string, options: PageRankOptions & SQLGenerationOptions = {}): string {
    const schema = options.schema ?? 'public';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;
    const damping = options.damping ?? 0.85;
    const maxIterations = options.maxIterations ?? 100;

    return `
SELECT ruvector.page_rank(
  (SELECT array_agg(ARRAY[source_id::text, target_id::text]) FROM "${schema}"."${edgeTable}"),
  ${damping},
  ${maxIterations}
);`.trim();
  }

  /**
   * Generate SQL for community detection.
   */
  communityDetectionSQL(tableName: string, options: CommunityOptions & SQLGenerationOptions): string {
    const schema = options.schema ?? 'public';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;
    const algorithm = options.algorithm ?? 'louvain';
    const resolution = options.resolution ?? 1.0;

    return `
SELECT ruvector.community_detection(
  (SELECT array_agg(ARRAY[source_id::text, target_id::text]) FROM "${schema}"."${edgeTable}"),
  '${algorithm}',
  ${resolution}
);`.trim();
  }
}


/**
 * RuVector GNN — standard layer implementations
 *
 * GCN, GAT, GATv2, GraphSAGE, and GIN layers.
 * Extracted verbatim from gnn.ts (lines 828-1464) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import { BaseGNNLayer } from './gnn-layer-base.js';
import type { EdgeFeatures, NodeFeatures } from './gnn-types.js';
import type { GNNOutput, GraphData } from './types.js';

// ============================================================================
// GCN Layer Implementation
// ============================================================================

/**
 * Graph Convolutional Network (GCN) layer.
 *
 * Implements spectral graph convolution with first-order approximation.
 * Reference: Kipf & Welling, "Semi-Supervised Classification with Graph Convolutional Networks" (2017)
 */
export class GCNLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex, edgeWeights } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;

    // Build adjacency with self-loops
    const adj = this.buildAdjacency(numNodes, edgeIndex, edgeWeights);

    // Normalize adjacency (D^-0.5 * A * D^-0.5)
    const normAdj = this.config.normalize ? this.symmetricNormalize(adj, numNodes) : adj;

    // Message passing: H' = sigma(A_norm * H * W)
    const outputFeatures = this.convolve(nodeFeatures, normAdj);

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.poolGraph(outputFeatures),
      stats: this.createStats(startTime, numNodes, numEdges),
    };
  }

  async messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures> {
    const numNodes = nodes.ids.length;
    const edgeIndex: [number[], number[]] = [
      edges.sources.map((s) => nodes.ids.indexOf(s)),
      edges.targets.map((t) => nodes.ids.indexOf(t)),
    ];

    const adj = this.buildAdjacency(numNodes, edgeIndex, edges.weights);
    const normAdj = this.config.normalize ? this.symmetricNormalize(adj, numNodes) : adj;
    const outputFeatures = this.convolve(nodes.features, normAdj);

    return {
      ids: nodes.ids,
      features: outputFeatures,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private buildAdjacency(
    numNodes: number,
    edgeIndex: [number[], number[]],
    weights?: number[]
  ): Map<number, Map<number, number>> {
    const adj = new Map<number, Map<number, number>>();

    // Initialize with self-loops if configured
    for (let i = 0; i < numNodes; i++) {
      adj.set(i, new Map());
      if (this.config.addSelfLoops) {
        adj.get(i)!.set(i, 1);
      }
    }

    // Add edges
    const [sources, targets] = edgeIndex;
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const tgt = targets[i];
      const weight = weights?.[i] ?? 1;
      if (src >= 0 && src < numNodes && tgt >= 0 && tgt < numNodes) {
        adj.get(src)!.set(tgt, weight);
        // Undirected: add reverse edge
        adj.get(tgt)!.set(src, weight);
      }
    }

    return adj;
  }

  private symmetricNormalize(
    adj: Map<number, Map<number, number>>,
    numNodes: number
  ): Map<number, Map<number, number>> {
    // Compute degree
    const degree = new Array(numNodes).fill(0);
    for (let i = 0; i < numNodes; i++) {
      for (const weight of adj.get(i)!.values()) {
        degree[i] += weight;
      }
    }

    // D^-0.5 * A * D^-0.5
    const normAdj = new Map<number, Map<number, number>>();
    for (let i = 0; i < numNodes; i++) {
      normAdj.set(i, new Map());
      for (const [j, weight] of adj.get(i)!.entries()) {
        const normWeight = weight / Math.sqrt(degree[i] * degree[j] + 1e-10);
        normAdj.get(i)!.set(j, normWeight);
      }
    }

    return normAdj;
  }

  private convolve(features: number[][], adj: Map<number, Map<number, number>>): number[][] {
    const numNodes = features.length;
    const inputDim = this.config.inputDim;
    const outputDim = this.config.outputDim;
    const output: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const aggregated = new Array(inputDim).fill(0);

      // Aggregate neighbor features
      for (const [j, weight] of adj.get(i)!.entries()) {
        const neighborFeatures = features[j] ?? new Array(inputDim).fill(0);
        for (let k = 0; k < inputDim; k++) {
          aggregated[k] += weight * (neighborFeatures[k] ?? 0);
        }
      }

      // Project to output dimension
      const projected = this.projectFeatures(aggregated, inputDim, outputDim);

      // Apply activation
      const activated = projected.map((x) => this.applyActivation(x));

      // Apply dropout
      output.push(this.applyDropout(activated));
    }

    return output;
  }

  private projectFeatures(input: number[], inputDim: number, outputDim: number): number[] {
    // Simple linear projection (in practice, this would use learned weights)
    const output = new Array(outputDim).fill(0);
    for (let i = 0; i < outputDim; i++) {
      for (let j = 0; j < inputDim; j++) {
        // Use a deterministic pseudo-weight based on position
        const weight = Math.sin((i * inputDim + j) * 0.1) * 0.5;
        output[i] += input[j] * weight;
      }
      if (this.config.useBias) {
        output[i] += 0.01; // Small bias term
      }
    }
    return output;
  }

  private poolGraph(features: number[][]): number[] {
    if (features.length === 0) return [];
    return this.aggregateMean(features);
  }
}

// ============================================================================
// GAT Layer Implementation
// ============================================================================

/**
 * Graph Attention Network (GAT) layer.
 *
 * Implements attention-based message passing.
 * Reference: Veličković et al., "Graph Attention Networks" (2018)
 */
export class GATLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;
    const numHeads = this.config.numHeads ?? 1;
    const negativeSlope = this.config.params?.negativeSlope ?? 0.2;

    // Compute attention for each head
    const headOutputs: number[][][] = [];

    for (let h = 0; h < numHeads; h++) {
      const headDim = Math.floor(this.config.outputDim / numHeads);
      const headFeatures: number[][] = [];

      for (let i = 0; i < numNodes; i++) {
        const neighbors = this.getNeighbors(i, edgeIndex, numNodes);
        const messages: { feature: number[]; attention: number }[] = [];

        // Compute attention for each neighbor
        for (const j of neighbors) {
          const attention = this.computeAttention(
            nodeFeatures[i],
            nodeFeatures[j],
            h,
            negativeSlope
          );
          messages.push({
            feature: this.projectHead(nodeFeatures[j], h, headDim),
            attention,
          });
        }

        // Softmax attention weights
        const attentionSum = messages.reduce(
          (sum, m) => sum + Math.exp(m.attention),
          0
        );
        const normalizedMessages = messages.map((m) => ({
          feature: m.feature,
          weight: Math.exp(m.attention) / (attentionSum + 1e-10),
        }));

        // Aggregate with attention weights
        const aggregated = new Array(headDim).fill(0);
        for (const m of normalizedMessages) {
          for (let k = 0; k < headDim; k++) {
            aggregated[k] += m.weight * (m.feature[k] ?? 0);
          }
        }

        headFeatures.push(aggregated);
      }

      headOutputs.push(headFeatures);
    }

    // Combine heads (concat or average)
    const concat = this.config.params?.concat ?? true;
    const outputFeatures = this.combineHeads(headOutputs, concat);

    // Apply activation and dropout
    const finalFeatures = outputFeatures.map((f) =>
      this.applyDropout(f.map((x) => this.applyActivation(x)))
    );

    return {
      nodeEmbeddings: finalFeatures,
      graphEmbedding: this.aggregateMean(finalFeatures),
      attentionWeights: this.extractAttentionWeights(headOutputs),
      stats: this.createStats(startTime, numNodes, numEdges),
    };
  }

  async messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures> {
    const graph: GraphData = {
      nodeFeatures: nodes.features,
      edgeIndex: [
        edges.sources.map((s) => nodes.ids.indexOf(s)),
        edges.targets.map((t) => nodes.ids.indexOf(t)),
      ],
    };

    const output = await this.forward(graph);

    return {
      ids: nodes.ids,
      features: output.nodeEmbeddings,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private getNeighbors(
    nodeIdx: number,
    edgeIndex: [number[], number[]],
    numNodes: number
  ): number[] {
    const neighbors = new Set<number>();

    // Add self-loop
    if (this.config.addSelfLoops) {
      neighbors.add(nodeIdx);
    }

    // Find neighbors from edges
    const [sources, targets] = edgeIndex;
    for (let i = 0; i < sources.length; i++) {
      if (sources[i] === nodeIdx && targets[i] < numNodes) {
        neighbors.add(targets[i]);
      }
      if (targets[i] === nodeIdx && sources[i] < numNodes) {
        neighbors.add(sources[i]);
      }
    }

    return Array.from(neighbors);
  }

  protected computeAttention(
    nodeI: number[],
    nodeJ: number[],
    head: number,
    negativeSlope: number
  ): number {
    // Compute attention score using concatenation of features
    let score = 0;
    const dim = nodeI.length;

    for (let k = 0; k < dim; k++) {
      // Simple attention mechanism (in practice, uses learned attention weights)
      const combined = (nodeI[k] ?? 0) + (nodeJ[k] ?? 0);
      score += combined * Math.sin((head * dim + k) * 0.1);
    }

    // LeakyReLU
    return score >= 0 ? score : negativeSlope * score;
  }

  private projectHead(features: number[], head: number, headDim: number): number[] {
    const output = new Array(headDim).fill(0);
    const inputDim = features.length;

    for (let i = 0; i < headDim; i++) {
      for (let j = 0; j < inputDim; j++) {
        const weight = Math.cos((head * headDim * inputDim + i * inputDim + j) * 0.05);
        output[i] += (features[j] ?? 0) * weight;
      }
    }

    return output;
  }

  private combineHeads(heads: number[][][], concat: boolean): number[][] {
    const numNodes = heads[0]?.length ?? 0;
    const result: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      if (concat) {
        // Concatenate all head outputs
        result.push(heads.flatMap((h) => h[i] ?? []));
      } else {
        // Average head outputs
        const headDim = heads[0]?.[0]?.length ?? 0;
        const averaged = new Array(headDim).fill(0);
        for (const head of heads) {
          for (let j = 0; j < headDim; j++) {
            averaged[j] += (head[i]?.[j] ?? 0) / heads.length;
          }
        }
        result.push(averaged);
      }
    }

    return result;
  }

  private extractAttentionWeights(heads: number[][][]): number[][] {
    // Return simplified attention representation
    return heads.map((h) => h.map((node) => node.reduce((a, b) => a + b, 0) / node.length));
  }
}

// ============================================================================
// GAT v2 Layer Implementation
// ============================================================================

/**
 * Graph Attention Network v2 layer.
 *
 * Improved attention mechanism with dynamic attention.
 * Reference: Brody et al., "How Attentive are Graph Attention Networks?" (2022)
 */
export class GATv2Layer extends GATLayer {
  protected override computeAttention(
    nodeI: number[],
    nodeJ: number[],
    head: number,
    negativeSlope: number
  ): number {
    // GAT v2: Apply attention AFTER concatenation and transformation
    const dim = nodeI.length;
    const combined = new Array(dim).fill(0);

    // First, transform and combine
    for (let k = 0; k < dim; k++) {
      combined[k] = (nodeI[k] ?? 0) + (nodeJ[k] ?? 0);
    }

    // Apply LeakyReLU
    for (let k = 0; k < dim; k++) {
      combined[k] = combined[k] >= 0 ? combined[k] : negativeSlope * combined[k];
    }

    // Then compute attention
    let score = 0;
    for (let k = 0; k < dim; k++) {
      score += combined[k] * Math.sin((head * dim + k) * 0.1);
    }

    return score;
  }
}

// ============================================================================
// GraphSAGE Layer Implementation
// ============================================================================

/**
 * GraphSAGE (Sample and Aggregate) layer.
 *
 * Implements inductive representation learning with neighbor sampling.
 * Reference: Hamilton et al., "Inductive Representation Learning on Large Graphs" (2017)
 */
export class GraphSAGELayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;
    const sampleSize = this.config.params?.sampleSize ?? 10;

    const outputFeatures: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      // Sample neighbors
      const allNeighbors = this.getNeighbors(i, edgeIndex, numNodes);
      const sampledNeighbors = this.sampleNeighbors(allNeighbors, sampleSize);

      // Aggregate neighbor features
      const neighborFeatures = sampledNeighbors.map((j) => nodeFeatures[j] ?? []);
      const aggregated = await this.aggregate(
        neighborFeatures.map((f) => ({ source: i, target: i, vector: f })),
        this.config.aggregation ?? 'mean'
      );

      // Concatenate with self features and project
      const selfFeatures = nodeFeatures[i] ?? [];
      const combined = [...selfFeatures, ...aggregated];
      const projected = this.projectFeatures(combined, combined.length, this.config.outputDim);

      // Normalize, activate, and apply dropout
      const normalized = this.config.normalize ? this.normalizeVector(projected) : projected;
      const activated = normalized.map((x) => this.applyActivation(x));
      outputFeatures.push(this.applyDropout(activated));
    }

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.aggregateMean(outputFeatures),
      stats: this.createStats(startTime, numNodes, numEdges),
    };
  }

  async messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures> {
    const graph: GraphData = {
      nodeFeatures: nodes.features,
      edgeIndex: [
        edges.sources.map((s) => nodes.ids.indexOf(s)),
        edges.targets.map((t) => nodes.ids.indexOf(t)),
      ],
    };

    const output = await this.forward(graph);

    return {
      ids: nodes.ids,
      features: output.nodeEmbeddings,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private getNeighbors(
    nodeIdx: number,
    edgeIndex: [number[], number[]],
    numNodes: number
  ): number[] {
    const neighbors = new Set<number>();
    const [sources, targets] = edgeIndex;

    for (let i = 0; i < sources.length; i++) {
      if (sources[i] === nodeIdx && targets[i] < numNodes) {
        neighbors.add(targets[i]);
      }
      if (targets[i] === nodeIdx && sources[i] < numNodes) {
        neighbors.add(sources[i]);
      }
    }

    return Array.from(neighbors);
  }

  private sampleNeighbors(neighbors: number[], k: number): number[] {
    if (neighbors.length <= k) {
      return neighbors;
    }

    // Random sampling
    const sampled: number[] = [];
    const available = [...neighbors];

    for (let i = 0; i < k && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      sampled.push(available[idx]);
      available.splice(idx, 1);
    }

    return sampled;
  }

  private projectFeatures(input: number[], inputDim: number, outputDim: number): number[] {
    const output = new Array(outputDim).fill(0);
    for (let i = 0; i < outputDim; i++) {
      for (let j = 0; j < inputDim; j++) {
        const weight = Math.sin((i * inputDim + j) * 0.1) * Math.sqrt(2 / (inputDim + outputDim));
        output[i] += (input[j] ?? 0) * weight;
      }
      if (this.config.useBias) {
        output[i] += 0.01;
      }
    }
    return output;
  }
}

// ============================================================================
// GIN Layer Implementation
// ============================================================================

/**
 * Graph Isomorphism Network (GIN) layer.
 *
 * Maximally powerful GNN for graph classification.
 * Reference: Xu et al., "How Powerful are Graph Neural Networks?" (2019)
 */
export class GINLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;
    const eps = this.config.params?.eps ?? 0;

    const outputFeatures: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const neighbors = this.getNeighbors(i, edgeIndex, numNodes);

      // Sum neighbor features
      const neighborSum = new Array(this.config.inputDim).fill(0);
      for (const j of neighbors) {
        const neighborFeatures = nodeFeatures[j] ?? [];
        for (let k = 0; k < this.config.inputDim; k++) {
          neighborSum[k] += neighborFeatures[k] ?? 0;
        }
      }

      // GIN update: h_v = MLP((1 + eps) * h_v + sum(h_u))
      const selfFeatures = nodeFeatures[i] ?? [];
      const combined = new Array(this.config.inputDim).fill(0);
      for (let k = 0; k < this.config.inputDim; k++) {
        combined[k] = (1 + eps) * (selfFeatures[k] ?? 0) + neighborSum[k];
      }

      // MLP (2-layer)
      const hidden = this.mlpLayer1(combined);
      const output = this.mlpLayer2(hidden);
      outputFeatures.push(this.applyDropout(output));
    }

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.aggregateSum(outputFeatures), // Sum pooling for graph classification
      stats: this.createStats(startTime, numNodes, numEdges),
    };
  }

  async messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures> {
    const graph: GraphData = {
      nodeFeatures: nodes.features,
      edgeIndex: [
        edges.sources.map((s) => nodes.ids.indexOf(s)),
        edges.targets.map((t) => nodes.ids.indexOf(t)),
      ],
    };

    const output = await this.forward(graph);

    return {
      ids: nodes.ids,
      features: output.nodeEmbeddings,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private getNeighbors(
    nodeIdx: number,
    edgeIndex: [number[], number[]],
    numNodes: number
  ): number[] {
    const neighbors = new Set<number>();
    const [sources, targets] = edgeIndex;

    for (let i = 0; i < sources.length; i++) {
      if (sources[i] === nodeIdx && targets[i] < numNodes) {
        neighbors.add(targets[i]);
      }
      if (targets[i] === nodeIdx && sources[i] < numNodes) {
        neighbors.add(sources[i]);
      }
    }

    return Array.from(neighbors);
  }

  private mlpLayer1(input: number[]): number[] {
    const hiddenDim = this.config.hiddenDim ?? this.config.inputDim;
    const output = new Array(hiddenDim).fill(0);

    for (let i = 0; i < hiddenDim; i++) {
      for (let j = 0; j < input.length; j++) {
        const weight = Math.sin((i * input.length + j) * 0.1) * 0.5;
        output[i] += (input[j] ?? 0) * weight;
      }
      output[i] = this.applyActivation(output[i]);
    }

    return output;
  }

  private mlpLayer2(input: number[]): number[] {
    const output = new Array(this.config.outputDim).fill(0);

    for (let i = 0; i < this.config.outputDim; i++) {
      for (let j = 0; j < input.length; j++) {
        const weight = Math.cos((i * input.length + j) * 0.1) * 0.5;
        output[i] += (input[j] ?? 0) * weight;
      }
    }

    return output;
  }
}


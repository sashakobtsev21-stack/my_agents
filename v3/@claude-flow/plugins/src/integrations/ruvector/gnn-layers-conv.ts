/**
 * GNN Layers — message-passing & conv family
 *
 * MPNN/EdgeConv/PointConv/GraphTransformer/PNA/FiLM. Extracted verbatim
 * from gnn-layers-advanced.ts (lines 30-526) during campaign-2 wave 88
 * (W294). gnn-layers-advanced.ts stays the barrel.
 */

import { BaseGNNLayer } from './gnn-layer-base.js';
import { GATLayer, GCNLayer } from './gnn-layers-standard.js';
import type {
  AggregationMethod,
  EdgeFeatures,
  Message,
  NodeFeatures,
} from './gnn-types.js';
import type { GNNOutput, GraphData } from './types.js';

export class MPNNLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex, edgeFeatures } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;

    let currentFeatures = nodeFeatures.map((f) => [...f]);

    // Multiple rounds of message passing
    const numIterations = this.config.params?.numLayers ?? 1;

    for (let t = 0; t < numIterations; t++) {
      const newFeatures: number[][] = [];

      for (let i = 0; i < numNodes; i++) {
        // Collect messages from neighbors
        const messages: Message[] = [];
        const [sources, targets] = edgeIndex;

        for (let e = 0; e < sources.length; e++) {
          if (targets[e] === i) {
            const j = sources[e];
            const edgeFeat = edgeFeatures?.[e];
            const message = this.messageFunction(
              currentFeatures[j] ?? [],
              currentFeatures[i] ?? [],
              edgeFeat
            );
            messages.push({
              source: j,
              target: i,
              vector: message,
              edgeFeatures: edgeFeat,
            });
          }
          if (sources[e] === i) {
            const j = targets[e];
            const edgeFeat = edgeFeatures?.[e];
            const message = this.messageFunction(
              currentFeatures[j] ?? [],
              currentFeatures[i] ?? [],
              edgeFeat
            );
            messages.push({
              source: j,
              target: i,
              vector: message,
              edgeFeatures: edgeFeat,
            });
          }
        }

        // Aggregate messages
        const aggregated = await this.aggregate(messages, this.config.aggregation ?? 'sum');

        // Update node features
        const updated = this.updateFunction(currentFeatures[i] ?? [], aggregated);
        newFeatures.push(this.applyDropout(updated));
      }

      currentFeatures = newFeatures;
    }

    return {
      nodeEmbeddings: currentFeatures,
      graphEmbedding: this.aggregateMean(currentFeatures),
      stats: this.createStats(startTime, numNodes, numEdges, numIterations),
    };
  }

  async messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures> {
    const graph: GraphData = {
      nodeFeatures: nodes.features,
      edgeIndex: [
        edges.sources.map((s) => nodes.ids.indexOf(s)),
        edges.targets.map((t) => nodes.ids.indexOf(t)),
      ],
      edgeFeatures: edges.features,
    };

    const output = await this.forward(graph);

    return {
      ids: nodes.ids,
      features: output.nodeEmbeddings,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private messageFunction(
    sourceFeatures: number[],
    targetFeatures: number[],
    edgeFeatures?: number[]
  ): number[] {
    const dim = this.config.inputDim;
    const message = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      message[i] = (sourceFeatures[i] ?? 0) * 0.5 + (targetFeatures[i] ?? 0) * 0.3;
      if (edgeFeatures && edgeFeatures[i] !== undefined) {
        message[i] += edgeFeatures[i] * 0.2;
      }
    }

    return message;
  }

  private updateFunction(nodeFeatures: number[], aggregated: number[]): number[] {
    const output = new Array(this.config.outputDim).fill(0);

    // GRU-like update
    for (let i = 0; i < this.config.outputDim; i++) {
      const nodeVal = nodeFeatures[i % nodeFeatures.length] ?? 0;
      const aggVal = aggregated[i % aggregated.length] ?? 0;
      const gate = 1 / (1 + Math.exp(-(nodeVal + aggVal)));
      output[i] = this.applyActivation(gate * aggVal + (1 - gate) * nodeVal);
    }

    return output;
  }
}

// ============================================================================
// EdgeConv Layer Implementation
// ============================================================================

/**
 * EdgeConv layer for dynamic graph convolution.
 *
 * Uses k-NN graph construction and edge features.
 * Reference: Wang et al., "Dynamic Graph CNN for Learning on Point Clouds" (2019)
 */
export class EdgeConvLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures } = graph;
    const numNodes = nodeFeatures.length;
    const k = this.config.params?.k ?? 20;
    const dynamic = this.config.params?.dynamic ?? true;

    // Build k-NN graph
    const knnGraph = dynamic
      ? this.buildKNNGraph(nodeFeatures, k)
      : graph.edgeIndex;

    const outputFeatures: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const neighbors = this.getKNNNeighbors(i, knnGraph);
      const selfFeatures = nodeFeatures[i] ?? [];

      // Edge features: (x_j - x_i) || x_i
      const edgeFeatures: number[][] = [];
      for (const j of neighbors) {
        const neighborFeatures = nodeFeatures[j] ?? [];
        const diff = selfFeatures.map((v, idx) => (neighborFeatures[idx] ?? 0) - v);
        edgeFeatures.push([...diff, ...selfFeatures]);
      }

      // Max pooling over edge features
      const pooled = this.maxPoolEdges(edgeFeatures);

      // MLP on pooled features
      const output = this.edgeMLP(pooled);
      outputFeatures.push(this.applyDropout(output));
    }

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.aggregateMean(outputFeatures),
      stats: this.createStats(startTime, numNodes, numNodes * k),
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

  private buildKNNGraph(features: number[][], k: number): [number[], number[]] {
    const sources: number[] = [];
    const targets: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const distances: { idx: number; dist: number }[] = [];

      for (let j = 0; j < features.length; j++) {
        if (i !== j) {
          const dist = this.euclideanDistance(features[i], features[j]);
          distances.push({ idx: j, dist });
        }
      }

      distances.sort((a, b) => a.dist - b.dist);
      const neighbors = distances.slice(0, k);

      for (const neighbor of neighbors) {
        sources.push(i);
        targets.push(neighbor.idx);
      }
    }

    return [sources, targets];
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private getKNNNeighbors(nodeIdx: number, edgeIndex: [number[], number[]]): number[] {
    const neighbors: number[] = [];
    const [sources, targets] = edgeIndex;

    for (let i = 0; i < sources.length; i++) {
      if (sources[i] === nodeIdx) {
        neighbors.push(targets[i]);
      }
    }

    return neighbors;
  }

  private maxPoolEdges(edgeFeatures: number[][]): number[] {
    if (edgeFeatures.length === 0) {
      return new Array(this.config.inputDim * 2).fill(0);
    }
    return this.aggregateMax(edgeFeatures);
  }

  private edgeMLP(input: number[]): number[] {
    const output = new Array(this.config.outputDim).fill(0);

    for (let i = 0; i < this.config.outputDim; i++) {
      for (let j = 0; j < input.length; j++) {
        const weight = Math.sin((i * input.length + j) * 0.08) * 0.4;
        output[i] += (input[j] ?? 0) * weight;
      }
      output[i] = this.applyActivation(output[i]);
    }

    return output;
  }
}

// ============================================================================
// Additional GNN Layer Implementations (Stubs)
// ============================================================================

/**
 * Point Convolution layer for point cloud data.
 */
export class PointConvLayer extends EdgeConvLayer {
  // Extends EdgeConv with point-specific operations
}

/**
 * Graph Transformer layer.
 */
export class GraphTransformerLayer extends GATLayer {
  override async forward(graph: GraphData): Promise<GNNOutput> {
    // Add positional encoding and full attention
    const result = await super.forward(graph);

    // Apply transformer-specific operations (layer norm, residual)
    const normalizedEmbeddings = result.nodeEmbeddings.map((f) =>
      this.layerNorm(f)
    );

    return {
      ...result,
      nodeEmbeddings: normalizedEmbeddings,
    };
  }

  private layerNorm(features: number[]): number[] {
    const mean = features.reduce((a, b) => a + b, 0) / features.length;
    const variance =
      features.reduce((sum, x) => sum + (x - mean) ** 2, 0) / features.length;
    const std = Math.sqrt(variance + 1e-6);
    return features.map((x) => (x - mean) / std);
  }
}

/**
 * Principal Neighbourhood Aggregation (PNA) layer.
 */
export class PNALayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;

    const aggregators = this.config.params?.aggregators ?? ['mean', 'sum', 'max', 'min'];
    const scalers = this.config.params?.scalers ?? ['identity', 'amplification', 'attenuation'];

    const outputFeatures: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const neighbors = this.getNeighbors(i, edgeIndex, numNodes);
      const neighborFeatures = neighbors.map((j) => nodeFeatures[j] ?? []);
      const degree = neighbors.length || 1;

      // Apply multiple aggregators
      const aggregatedResults: number[][] = [];
      for (const agg of aggregators) {
        const messages = neighborFeatures.map((f) => ({
          source: 0,
          target: i,
          vector: f,
        }));
        const result = await this.aggregate(messages, agg as AggregationMethod);
        aggregatedResults.push(result);
      }

      // Apply scalers
      const scaledResults: number[][] = [];
      for (const aggregated of aggregatedResults) {
        for (const scaler of scalers) {
          scaledResults.push(this.applyScaler(aggregated, scaler, degree));
        }
      }

      // Concatenate and project
      const combined = scaledResults.flat();
      const projected = this.projectFeatures(combined);
      outputFeatures.push(this.applyDropout(projected.map((x) => this.applyActivation(x))));
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

  private applyScaler(
    features: number[],
    scaler: string,
    degree: number
  ): number[] {
    switch (scaler) {
      case 'amplification':
        return features.map((x) => x * Math.log(degree + 1));
      case 'attenuation':
        return features.map((x) => x / Math.log(degree + 1));
      case 'identity':
      default:
        return features;
    }
  }

  private projectFeatures(input: number[]): number[] {
    const output = new Array(this.config.outputDim).fill(0);
    for (let i = 0; i < this.config.outputDim; i++) {
      for (let j = 0; j < Math.min(input.length, 100); j++) {
        const weight = Math.sin((i * 100 + j) * 0.1) * 0.3;
        output[i] += (input[j] ?? 0) * weight;
      }
    }
    return output;
  }
}

/**
 * FiLM (Feature-wise Linear Modulation) layer.
 */
export class FiLMLayer extends BaseGNNLayer {
  async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex, edgeFeatures } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;

    const outputFeatures: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const selfFeatures = nodeFeatures[i] ?? [];

      // Compute modulation parameters from edge features
      const { gamma, beta } = this.computeModulation(edgeFeatures ?? []);

      // Apply FiLM: gamma * x + beta
      const modulated = selfFeatures.map((x, idx) =>
        (gamma[idx % gamma.length] ?? 1) * x + (beta[idx % beta.length] ?? 0)
      );

      outputFeatures.push(this.applyDropout(modulated.map((x) => this.applyActivation(x))));
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
      edgeFeatures: edges.features,
    };

    const output = await this.forward(graph);

    return {
      ids: nodes.ids,
      features: output.nodeEmbeddings,
      types: nodes.types,
      labels: nodes.labels,
    };
  }

  private computeModulation(edgeFeatures: number[][]): { gamma: number[]; beta: number[] } {
    const dim = this.config.outputDim;
    const gamma = new Array(dim).fill(1);
    const beta = new Array(dim).fill(0);

    if (edgeFeatures.length > 0) {
      const meanEdge = this.aggregateMean(edgeFeatures);
      for (let i = 0; i < dim; i++) {
        gamma[i] = 1 + 0.1 * (meanEdge[i % meanEdge.length] ?? 0);
        beta[i] = 0.1 * (meanEdge[(i + dim / 2) % meanEdge.length] ?? 0);
      }
    }

    return { gamma, beta };
  }
}

/**
 * Relational Graph Convolutional Network (RGCN) layer.
 */

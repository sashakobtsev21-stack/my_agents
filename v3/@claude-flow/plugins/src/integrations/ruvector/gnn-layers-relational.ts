/**
 * GNN Layers — relational & heterogeneous family
 *
 * RGCN/HGT/HAN/MetaPath. Extracted verbatim from gnn-layers-advanced.ts
 * (lines 527-716) during campaign-2 wave 88 (W294).
 * gnn-layers-advanced.ts stays the barrel.
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

export class RGCNLayer extends GCNLayer {
  override async forward(graph: GraphData): Promise<GNNOutput> {
    const startTime = Date.now();
    const { nodeFeatures, edgeIndex, edgeTypes } = graph;
    const numNodes = nodeFeatures.length;
    const numEdges = edgeIndex[0].length;
    const numRelations = this.config.params?.numRelations ?? 1;

    // Process each relation type separately
    const relationOutputs: number[][][] = [];

    for (let r = 0; r < numRelations; r++) {
      // Filter edges by relation type
      const relationEdges = this.filterEdgesByType(edgeIndex, edgeTypes ?? [], r);

      // Apply GCN for this relation
      const relationGraph: GraphData = {
        nodeFeatures,
        edgeIndex: relationEdges,
      };

      const result = await super.forward(relationGraph);
      relationOutputs.push(result.nodeEmbeddings);
    }

    // Combine relation outputs
    const outputFeatures = this.combineRelationOutputs(relationOutputs);

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.aggregateMean(outputFeatures),
      stats: this.createStats(startTime, numNodes, numEdges),
    };
  }

  private filterEdgesByType(
    edgeIndex: [number[], number[]],
    edgeTypes: number[],
    targetType: number
  ): [number[], number[]] {
    const sources: number[] = [];
    const targets: number[] = [];
    const [srcArr, tgtArr] = edgeIndex;

    for (let i = 0; i < srcArr.length; i++) {
      if (edgeTypes[i] === targetType || edgeTypes.length === 0) {
        sources.push(srcArr[i]);
        targets.push(tgtArr[i]);
      }
    }

    return [sources, targets];
  }

  private combineRelationOutputs(outputs: number[][][]): number[][] {
    if (outputs.length === 0) return [];
    if (outputs.length === 1) return outputs[0];

    const numNodes = outputs[0].length;
    const result: number[][] = [];

    for (let i = 0; i < numNodes; i++) {
      const nodeOutputs = outputs.map((o) => o[i] ?? []);
      result.push(this.aggregateMean(nodeOutputs));
    }

    return result;
  }
}

/**
 * Heterogeneous Graph Transformer (HGT) layer.
 */
export class HGTLayer extends GATLayer {
  override async forward(graph: GraphData): Promise<GNNOutput> {
    // HGT uses type-specific transformations
    const { nodeFeatures, nodeTypes } = graph;

    // Transform features based on node types
    const transformedFeatures = nodeFeatures.map((f, i) => {
      const nodeType = nodeTypes?.[i] ?? 0;
      return this.typeSpecificTransform(f, nodeType);
    });

    const transformedGraph: GraphData = {
      ...graph,
      nodeFeatures: transformedFeatures,
    };

    return super.forward(transformedGraph);
  }

  private typeSpecificTransform(features: number[], nodeType: number): number[] {
    // Apply type-specific transformation
    return features.map((x, i) => {
      const weight = Math.sin((nodeType * this.config.inputDim + i) * 0.1);
      return x * (1 + 0.1 * weight);
    });
  }
}

/**
 * Heterogeneous Attention Network (HAN) layer.
 */
export class HANLayer extends GATLayer {
  override async forward(graph: GraphData): Promise<GNNOutput> {
    const metapaths = this.config.params?.metapaths ?? [];

    if (metapaths.length === 0) {
      return super.forward(graph);
    }

    // Process each metapath
    const metapathOutputs: number[][][] = [];

    for (const metapath of metapaths) {
      const metapathGraph = this.extractMetapathSubgraph(graph, metapath);
      const result = await super.forward(metapathGraph);
      metapathOutputs.push(result.nodeEmbeddings);
    }

    // Attention over metapaths
    const outputFeatures = this.attentionOverMetapaths(metapathOutputs);

    return {
      nodeEmbeddings: outputFeatures,
      graphEmbedding: this.aggregateMean(outputFeatures),
      stats: {
        forwardTimeMs: 0,
        numNodes: graph.nodeFeatures.length,
        numEdges: graph.edgeIndex[0].length,
        memoryBytes: 0,
        numIterations: metapaths.length,
      },
    };
  }

  private extractMetapathSubgraph(graph: GraphData, _metapath: string[]): GraphData {
    // Simplified: return original graph
    // In practice, would filter edges based on metapath
    // The _metapath parameter would be used to filter edge types
    return graph;
  }

  private attentionOverMetapaths(outputs: number[][][]): number[][] {
    if (outputs.length === 0) return [];
    if (outputs.length === 1) return outputs[0];

    const numNodes = outputs[0].length;
    const result: number[][] = [];

    // Compute attention weights for metapaths
    const metapathWeights = outputs.map((o) => {
      const importance = o.reduce(
        (sum, node) => sum + node.reduce((s, v) => s + Math.abs(v), 0),
        0
      );
      return importance;
    });

    const maxWeight = Math.max(...metapathWeights);
    const expWeights = metapathWeights.map((w) => Math.exp((w - maxWeight) / 10));
    const sumExp = expWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = expWeights.map((w) => w / sumExp);

    for (let i = 0; i < numNodes; i++) {
      const dim = outputs[0][i]?.length ?? 0;
      const combined = new Array(dim).fill(0);

      for (let m = 0; m < outputs.length; m++) {
        const nodeFeatures = outputs[m][i] ?? [];
        for (let j = 0; j < dim; j++) {
          combined[j] += normalizedWeights[m] * (nodeFeatures[j] ?? 0);
        }
      }

      result.push(combined);
    }

    return result;
  }
}

/**
 * MetaPath-based aggregation layer.
 */
export class MetaPathLayer extends HANLayer {
  // Extends HAN with metapath-specific functionality
}


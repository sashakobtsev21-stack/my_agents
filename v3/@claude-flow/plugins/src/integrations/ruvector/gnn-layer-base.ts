/**
 * RuVector GNN — abstract base layer
 *
 * BaseGNNLayer: shared message-passing scaffolding for every
 * concrete GNN layer implementation.
 * Extracted verbatim from gnn.ts (lines 459-827) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import { GNN_SQL_FUNCTIONS } from './gnn-types.js';
import type {
  AggregationMethod,
  EdgeFeatures,
  GNNLayerConfig,
  IGNNLayer,
  Message,
  NodeFeatures,
  SQLGenerationOptions,
} from './gnn-types.js';
import type { GNNLayerType, GNNOutput, GNNStats, GraphData } from './types.js';

// ============================================================================
// Base GNN Layer Implementation
// ============================================================================

/**
 * Abstract base class for GNN layer implementations.
 */
export abstract class BaseGNNLayer implements IGNNLayer {
  readonly type: GNNLayerType;
  readonly config: GNNLayerConfig;

  constructor(config: GNNLayerConfig) {
    this.type = config.type;
    this.config = config;
    this.validateConfig();
  }

  /**
   * Validate layer configuration.
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    if (this.config.inputDim <= 0) {
      throw new Error(`Invalid inputDim: ${this.config.inputDim}. Must be positive.`);
    }
    if (this.config.outputDim <= 0) {
      throw new Error(`Invalid outputDim: ${this.config.outputDim}. Must be positive.`);
    }
    if (this.config.dropout !== undefined && (this.config.dropout < 0 || this.config.dropout > 1)) {
      throw new Error(`Invalid dropout: ${this.config.dropout}. Must be between 0 and 1.`);
    }
    if (this.config.numHeads !== undefined && this.config.numHeads <= 0) {
      throw new Error(`Invalid numHeads: ${this.config.numHeads}. Must be positive.`);
    }
  }

  abstract forward(graph: GraphData): Promise<GNNOutput>;
  abstract messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures>;

  /**
   * Aggregate messages using the specified method.
   */
  async aggregate(messages: Message[], method: AggregationMethod): Promise<number[]> {
    if (messages.length === 0) {
      return new Array(this.config.outputDim).fill(0);
    }

    const vectors = messages.map((m) => m.vector);
    const weights = messages.map((m) => m.weight ?? 1);

    switch (method) {
      case 'sum':
        return this.aggregateSum(vectors);
      case 'mean':
        return this.aggregateMean(vectors);
      case 'max':
        return this.aggregateMax(vectors);
      case 'min':
        return this.aggregateMin(vectors);
      case 'attention':
        return this.aggregateAttention(vectors, weights);
      case 'weighted_mean':
        return this.aggregateWeightedMean(vectors, weights);
      case 'softmax':
        return this.aggregateSoftmax(vectors);
      case 'power_mean':
        return this.aggregatePowerMean(vectors, 2);
      case 'std':
        return this.aggregateStd(vectors);
      case 'var':
        return this.aggregateVar(vectors);
      case 'concat':
        return this.aggregateConcat(vectors);
      case 'lstm':
        return this.aggregateLSTM(vectors);
      case 'multi_head':
        return this.aggregateMultiHead(vectors);
      default:
        return this.aggregateMean(vectors);
    }
  }

  /**
   * Reset layer state.
   */
  reset(): void {
    // Override in stateful layers
  }

  /**
   * Generate SQL for this layer.
   */
  toSQL(tableName: string, options: SQLGenerationOptions = {}): string {
    const schema = options.schema ?? 'public';
    const nodeColumn = options.nodeColumn ?? 'embedding';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;
    const sqlFunction = GNN_SQL_FUNCTIONS[this.type] ?? 'ruvector.gnn_layer';

    const configJson = JSON.stringify({
      type: this.type,
      input_dim: this.config.inputDim,
      output_dim: this.config.outputDim,
      num_heads: this.config.numHeads,
      dropout: this.config.dropout,
      aggregation: this.config.aggregation,
      add_self_loops: this.config.addSelfLoops,
      normalize: this.config.normalize,
      use_bias: this.config.useBias,
      activation: this.config.activation,
      params: this.config.params,
    });

    if (options.prepared) {
      const prefix = options.paramPrefix ?? '$';
      return `
SELECT ${sqlFunction}(
  (SELECT array_agg(${nodeColumn}) FROM "${schema}"."${tableName}"),
  (SELECT array_agg(ARRAY[source_id, target_id]) FROM "${schema}"."${edgeTable}"),
  ${prefix}1::jsonb
);`.trim();
    }

    return `
SELECT ${sqlFunction}(
  (SELECT array_agg(${nodeColumn}) FROM "${schema}"."${tableName}"),
  (SELECT array_agg(ARRAY[source_id, target_id]) FROM "${schema}"."${edgeTable}"),
  '${configJson}'::jsonb
);`.trim();
  }

  // Aggregation implementations
  protected aggregateSum(vectors: number[][]): number[] {
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        result[i] += vec[i] ?? 0;
      }
    }
    return result;
  }

  protected aggregateMean(vectors: number[][]): number[] {
    const sum = this.aggregateSum(vectors);
    return sum.map((v) => v / vectors.length);
  }

  protected aggregateMax(vectors: number[][]): number[] {
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(-Infinity);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        result[i] = Math.max(result[i], vec[i] ?? -Infinity);
      }
    }
    return result;
  }

  protected aggregateMin(vectors: number[][]): number[] {
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(Infinity);
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        result[i] = Math.min(result[i], vec[i] ?? Infinity);
      }
    }
    return result;
  }

  protected aggregateWeightedMean(vectors: number[][], weights: number[]): number[] {
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(0);
    let totalWeight = 0;

    for (let j = 0; j < vectors.length; j++) {
      const w = weights[j] ?? 1;
      totalWeight += w;
      for (let i = 0; i < dim; i++) {
        result[i] += (vectors[j]?.[i] ?? 0) * w;
      }
    }

    return result.map((v) => (totalWeight > 0 ? v / totalWeight : 0));
  }

  protected aggregateAttention(vectors: number[][], weights: number[]): number[] {
    // Softmax over weights then weighted mean
    const maxWeight = Math.max(...weights);
    const expWeights = weights.map((w) => Math.exp(w - maxWeight));
    const sumExp = expWeights.reduce((a, b) => a + b, 0);
    const attentionWeights = expWeights.map((w) => w / sumExp);
    return this.aggregateWeightedMean(vectors, attentionWeights);
  }

  protected aggregateSoftmax(vectors: number[][]): number[] {
    // Softmax aggregation across vectors
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      const values = vectors.map((v) => v[i] ?? 0);
      const maxVal = Math.max(...values);
      const expValues = values.map((v) => Math.exp(v - maxVal));
      const sumExp = expValues.reduce((a, b) => a + b, 0);
      result[i] = expValues.reduce((sum, exp, j) => sum + (exp / sumExp) * values[j], 0);
    }

    return result;
  }

  protected aggregatePowerMean(vectors: number[][], p: number): number[] {
    const dim = vectors[0]?.length ?? 0;
    const result = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (const vec of vectors) {
        sum += Math.pow(Math.abs(vec[i] ?? 0), p);
      }
      result[i] = Math.pow(sum / vectors.length, 1 / p);
    }

    return result;
  }

  protected aggregateStd(vectors: number[][]): number[] {
    const mean = this.aggregateMean(vectors);
    const dim = mean.length;
    const variance = new Array(dim).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        variance[i] += Math.pow((vec[i] ?? 0) - mean[i], 2);
      }
    }

    return variance.map((v) => Math.sqrt(v / vectors.length));
  }

  protected aggregateVar(vectors: number[][]): number[] {
    const mean = this.aggregateMean(vectors);
    const dim = mean.length;
    const variance = new Array(dim).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        variance[i] += Math.pow((vec[i] ?? 0) - mean[i], 2);
      }
    }

    return variance.map((v) => v / vectors.length);
  }

  protected aggregateConcat(vectors: number[][]): number[] {
    return vectors.flat();
  }

  protected aggregateLSTM(vectors: number[][]): number[] {
    // Simplified LSTM-style aggregation (sequential processing)
    let hidden = new Array(this.config.outputDim).fill(0);
    for (const vec of vectors) {
      hidden = this.lstmCell(vec, hidden);
    }
    return hidden;
  }

  protected aggregateMultiHead(vectors: number[][]): number[] {
    // Split into heads, aggregate each, then combine
    const numHeads = this.config.numHeads ?? 1;
    const headDim = Math.floor((vectors[0]?.length ?? 0) / numHeads);
    const results: number[][] = [];

    for (let h = 0; h < numHeads; h++) {
      const headVectors = vectors.map((v) =>
        v.slice(h * headDim, (h + 1) * headDim)
      );
      results.push(this.aggregateMean(headVectors));
    }

    return results.flat();
  }

  private lstmCell(input: number[], hidden: number[]): number[] {
    // Simplified LSTM update (no learned parameters)
    const dim = hidden.length;
    const inputDim = input.length;
    const result = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      const inputVal = input[i % inputDim] ?? 0;
      const hiddenVal = hidden[i] ?? 0;
      // Simple gated update
      const gate = 1 / (1 + Math.exp(-(inputVal + hiddenVal)));
      result[i] = gate * inputVal + (1 - gate) * hiddenVal;
    }

    return result;
  }

  /**
   * Apply activation function.
   */
  protected applyActivation(x: number): number {
    switch (this.config.activation) {
      case 'relu':
        return Math.max(0, x);
      case 'gelu':
        return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
      case 'silu':
      case 'swish':
        return x / (1 + Math.exp(-x));
      case 'leaky_relu':
        return x >= 0 ? x : 0.01 * x;
      case 'elu':
        return x >= 0 ? x : Math.exp(x) - 1;
      case 'selu':
        const alpha = 1.6732632423543772;
        const scale = 1.0507009873554805;
        return scale * (x >= 0 ? x : alpha * (Math.exp(x) - 1));
      case 'tanh':
        return Math.tanh(x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'softmax':
      case 'none':
      default:
        return x;
    }
  }

  /**
   * Apply dropout (during training).
   */
  protected applyDropout(vector: number[], training: boolean = false): number[] {
    if (!training || !this.config.dropout || this.config.dropout === 0) {
      return vector;
    }

    const scale = 1 / (1 - this.config.dropout);
    return vector.map((v) => (Math.random() > this.config.dropout! ? v * scale : 0));
  }

  /**
   * Normalize vector (L2 normalization).
   */
  protected normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? vector.map((v) => v / norm) : vector;
  }

  /**
   * Create statistics for GNN computation.
   */
  protected createStats(
    startTime: number,
    numNodes: number,
    numEdges: number,
    numIterations: number = 1
  ): GNNStats {
    return {
      forwardTimeMs: Date.now() - startTime,
      numNodes,
      numEdges,
      memoryBytes: numNodes * this.config.outputDim * 4 + numEdges * 8,
      numIterations,
    };
  }
}


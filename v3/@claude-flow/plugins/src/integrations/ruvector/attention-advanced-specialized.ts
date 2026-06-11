/**
 * RuVector Attention — multimodal, retrieval & specialized mechanisms
 *
 * CrossModal, Perceiver, Flamingo, Retrieval, KNN, MemoryAugmented,
 * Synthesizer, Routing, and MixtureOfExperts attention. Extracted
 * verbatim from attention-advanced.ts (lines 470-1040) during the P3.54
 * god-file decomposition (W175). attention-advanced.ts stays the barrel.
 */

import type {
  AttentionMechanism,
  AttentionInput,
} from './types.js';

import {
  BaseAttentionMechanism,
  type AttentionCategory,
} from './attention.js';

// ============================================================================
// Multimodal Attention Implementations
// ============================================================================

/**
 * Cross-Modal Attention.
 */
export class CrossModalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'cross_modal';
  readonly name = 'Cross-Modal Attention';
  readonly description = 'Attention across different modalities (text, image, audio)';
  readonly category: AttentionCategory = 'multimodal';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.cross_modal_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

/**
 * Perceiver IO Attention.
 */
export class PerceiverAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'perceiver';
  readonly name = 'Perceiver Attention';
  readonly description = 'Perceiver IO style attention with latent array';
  readonly category: AttentionCategory = 'multimodal';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.perceiver_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

/**
 * Flamingo-style Attention.
 */
export class FlamingoAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'flamingo';
  readonly name = 'Flamingo Attention';
  readonly description = 'Flamingo-style gated cross-attention for vision-language';
  readonly category: AttentionCategory = 'multimodal';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();

    // Gated cross-attention
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    const context = this.weightedSum(values, weights);

    // Tanh gating
    const gate = Math.tanh(this.dotProduct(query, context) / query.length);
    return context.map(c => gate * c);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.flamingo_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

// ============================================================================
// Retrieval-Augmented Attention Implementations
// ============================================================================

/**
 * Retrieval-Augmented Attention.
 */
export class RetrievalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'retrieval_attention';
  readonly name = 'Retrieval Attention';
  readonly description = 'Attention augmented with retrieved documents';
  readonly category: AttentionCategory = 'retrieval';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.retrieval_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

/**
 * k-NN Augmented Attention.
 */
export class KNNAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'knn_attention';
  readonly name = 'k-NN Attention';
  readonly description = 'k-nearest neighbor augmented attention';
  readonly category: AttentionCategory = 'retrieval';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const k = Math.min(10, keys.length);
    const scale = this.getScale();

    // Compute all scores
    const indexedScores = keys.map((key, i) => ({
      index: i,
      score: this.dotProduct(query, key) / scale,
    }));

    // Get top-k
    indexedScores.sort((a, b) => b.score - a.score);
    const topK = indexedScores.slice(0, k);

    // Compute weights only for top-k
    const topScores = topK.map(item => item.score);
    const weights = this.softmax(topScores);

    // Weighted sum of top-k values
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < topK.length; i++) {
      const valueIdx = topK[i].index;
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[valueIdx][j];
      }
    }
    return result;
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.knn_attention(${q}, ${k}, ${v}, 10, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }
}

/**
 * Memory-Augmented Attention.
 */
export class MemoryAugmentedAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'memory_augmented';
  readonly name = 'Memory-Augmented Attention';
  readonly description = 'Attention with external memory bank';
  readonly category: AttentionCategory = 'retrieval';

  private memoryBank: number[][] = [];

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();

    // Combine keys with memory bank
    const allKeys = [...keys, ...this.memoryBank];
    const allValues = [...values, ...this.memoryBank];

    const scores = allKeys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    return this.weightedSum(allValues, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.memory_augmented_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
  }

  /**
   * Add vectors to memory bank.
   */
  addToMemory(vectors: number[][]): void {
    this.memoryBank.push(...vectors);
  }

  /**
   * Clear memory bank.
   */
  clearMemory(): void {
    this.memoryBank = [];
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

// ============================================================================
// Specialized Attention Implementations
// ============================================================================

/**
 * Synthesizer Attention (learned patterns).
 */
export class SynthesizerAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'synthesizer';
  readonly name = 'Synthesizer Attention';
  readonly description = 'Attention with learned synthetic patterns';
  readonly category: AttentionCategory = 'linear';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const seqLen = keys.length;
    const dim = query.length;

    // Dense synthesizer: learn attention from query alone
    const synthetic = new Array(seqLen).fill(0).map((_, i) =>
      query.reduce((sum, q, j) => sum + q * Math.sin((i + 1) * (j + 1) * 0.1), 0)
    );

    const weights = this.softmax(synthetic);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.synthesizer_attention(${q}, ${v}, ${input.key.length})`;
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

/**
 * Routing Attention (MoE style).
 */
export class RoutingAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'routing';
  readonly name = 'Routing Attention';
  readonly description = 'Attention with routing to specialized experts';
  readonly category: AttentionCategory = 'linear';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const numExperts = this.config.params?.numExperts ?? 4;
    const topK = this.config.params?.topK ?? 2;
    const scale = this.getScale();

    // Compute expert routing scores
    const routingScores = Array(numExperts).fill(0).map((_, e) =>
      query.reduce((sum, q, i) => sum + q * Math.cos(e * i * 0.1), 0)
    );

    // Get top-k experts
    const indexedScores = routingScores.map((s, i) => ({ index: i, score: s }));
    indexedScores.sort((a, b) => b.score - a.score);
    const topExperts = indexedScores.slice(0, topK);
    const expertWeights = this.softmax(topExperts.map(e => e.score));

    // Each expert processes a subset of keys
    const keysPerExpert = Math.ceil(keys.length / numExperts);
    const dim = values[0].length;
    const result = new Array(dim).fill(0);

    for (let e = 0; e < topExperts.length; e++) {
      const expertIdx = topExperts[e].index;
      const start = expertIdx * keysPerExpert;
      const end = Math.min(start + keysPerExpert, keys.length);

      if (start < keys.length) {
        const expertKeys = keys.slice(start, end);
        const expertValues = values.slice(start, end);

        const scores = expertKeys.map(k => this.dotProduct(query, k) / scale);
        const weights = this.softmax(scores);
        const expertOutput = this.weightedSum(expertValues, weights);

        for (let d = 0; d < dim; d++) {
          result[d] += expertWeights[e] * expertOutput[d];
        }
      }
    }

    return result;
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const numExperts = this.config.params?.numExperts ?? 4;
    const topK = this.config.params?.topK ?? 2;
    return `SELECT ruvector.routing_attention(${q}, ${k}, ${v}, ${numExperts}, ${topK}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}

/**
 * Mixture of Experts Attention.
 */
export class MixtureOfExpertsAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'mixture_of_experts';
  readonly name = 'Mixture of Experts Attention';
  readonly description = 'MoE attention with specialized expert networks';
  readonly category: AttentionCategory = 'linear';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const numExperts = this.config.params?.numExperts ?? 8;
    const topK = this.config.params?.topK ?? 2;
    const scale = this.getScale();

    // Router: compute gating scores
    const gatingScores = Array(numExperts).fill(0).map((_, e) => {
      return query.reduce((sum, q, i) => sum + q * Math.sin(e * i * 0.05), 0);
    });

    // Top-k gating
    const indexed = gatingScores.map((s, i) => ({ idx: i, score: s }));
    indexed.sort((a, b) => b.score - a.score);
    const selected = indexed.slice(0, topK);
    const gateWeights = this.softmax(selected.map(s => s.score));

    // Expert computation
    const dim = values[0].length;
    const result = new Array(dim).fill(0);

    for (let k = 0; k < selected.length; k++) {
      const expertIdx = selected[k].idx;
      const expertScale = scale * (1 + expertIdx * 0.1);

      const scores = keys.map(key => this.dotProduct(query, key) / expertScale);
      const weights = this.softmax(scores);
      const output = this.weightedSum(values, weights);

      for (let d = 0; d < dim; d++) {
        result[d] += gateWeights[k] * output[d];
      }
    }

    return result;
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const numExperts = this.config.params?.numExperts ?? 8;
    const topK = this.config.params?.topK ?? 2;
    return `SELECT ruvector.moe_attention(${q}, ${k}, ${v}, ${numExperts}, ${topK}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / sum);
  }

  private weightedSum(values: number[][], weights: number[]): number[] {
    const dim = values[0].length;
    const result = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < dim; j++) {
        result[j] += weights[i] * values[i][j];
      }
    }
    return result;
  }
}


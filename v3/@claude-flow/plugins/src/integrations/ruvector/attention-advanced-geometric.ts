/**
 * RuVector Attention — geometric & temporal mechanisms
 *
 * Graph, Hyperbolic, Spherical, Toroidal, Temporal, Recurrent, and
 * StateSpace attention. Extracted verbatim from attention-advanced.ts
 * (lines 19-469) during the P3.54 god-file decomposition (W175).
 * attention-advanced.ts stays the barrel.
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
// Graph Attention Implementations
// ============================================================================

/**
 * Graph Attention (GAT-style).
 */
export class GraphAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'graph_attention';
  readonly name = 'Graph Attention';
  readonly description = 'Graph attention network for structured data';
  readonly category: AttentionCategory = 'graph';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const negativeSlope = 0.2; // LeakyReLU

    // Compute attention coefficients with LeakyReLU
    const scores = keys.map(k => {
      const combined = [...query, ...k];
      const attention = combined.reduce((sum, v) => sum + v, 0) / combined.length;
      return attention > 0 ? attention / scale : negativeSlope * attention / scale;
    });

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
    return `SELECT ruvector.graph_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, 0.2)`;
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
 * Hyperbolic Attention for hierarchical structures.
 */
export class HyperbolicAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'hyperbolic_attention';
  readonly name = 'Hyperbolic Attention';
  readonly description = 'Attention in hyperbolic space for hierarchical data';
  readonly category: AttentionCategory = 'graph';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const curvature = this.config.params?.curvature ?? -1.0;
    const scale = this.getScale();

    // Compute hyperbolic distances
    const scores = keys.map(k => {
      const dist = this.poincareDistance(query, k, curvature);
      return -dist / scale; // Negative distance as score
    });

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
    const curvature = this.config.params?.curvature ?? -1.0;
    return `SELECT ruvector.hyperbolic_attention(${q}, ${k}, ${v}, ${curvature}, ${this.getScale()})`;
  }

  private poincareDistance(u: number[], v: number[], c: number): number {
    const normU = Math.sqrt(u.reduce((s, x) => s + x * x, 0));
    const normV = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    const diff = u.map((x, i) => x - v[i]);
    const normDiff = Math.sqrt(diff.reduce((s, x) => s + x * x, 0));

    const sqrtC = Math.sqrt(Math.abs(c));
    const num = 2 * normDiff * normDiff;
    const denom = (1 - normU * normU) * (1 - normV * normV);

    return (1 / sqrtC) * Math.acosh(1 + num / Math.max(denom, 1e-6));
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
 * Spherical Attention.
 */
export class SphericalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'spherical_attention';
  readonly name = 'Spherical Attention';
  readonly description = 'Attention on the unit sphere using geodesic distances';
  readonly category: AttentionCategory = 'graph';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();

    // Normalize to unit sphere
    const normQuery = this.normalize(query);
    const normKeys = keys.map(k => this.normalize(k));

    // Geodesic distances on sphere
    const scores = normKeys.map(k => {
      const dot = this.dotProduct(normQuery, k);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      return -angle / scale;
    });

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
    return `SELECT ruvector.spherical_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
  }

  private normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return v.map(x => x / (norm + 1e-6));
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
 * Toroidal Attention for periodic data.
 */
export class ToroidalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'toroidal_attention';
  readonly name = 'Toroidal Attention';
  readonly description = 'Attention on torus manifold for periodic structures';
  readonly category: AttentionCategory = 'graph';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();

    // Toroidal distance (periodic in each dimension)
    const scores = keys.map(k => {
      const dist = this.toroidalDistance(query, k);
      return -dist / scale;
    });

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
    return `SELECT ruvector.toroidal_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
  }

  private toroidalDistance(a: number[], b: number[]): number {
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = Math.abs(a[i] - b[i]);
      const periodic = Math.min(diff, 2 * Math.PI - diff);
      dist += periodic * periodic;
    }
    return Math.sqrt(dist);
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
// Temporal Attention Implementations
// ============================================================================

/**
 * Temporal Attention for time-series data.
 */
export class TemporalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'temporal_attention';
  readonly name = 'Temporal Attention';
  readonly description = 'Time-aware attention with temporal decay';
  readonly category: AttentionCategory = 'temporal';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const decayRate = 0.1;
    const queryIdx = keys.length - 1;

    const scores = keys.map((k, i) => {
      const timeDiff = queryIdx - i;
      const decay = Math.exp(-decayRate * timeDiff);
      return this.dotProduct(query, k) / scale * decay;
    });

    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map((q, idx) => {
      const scale = this.getScale();
      const decayRate = 0.1;

      const scores = keys.map((k, i) => {
        const timeDiff = idx - i;
        const decay = Math.exp(-decayRate * Math.abs(timeDiff));
        return this.dotProduct(q, k) / scale * decay;
      });

      const weights = this.softmax(scores);
      return this.weightedSum(values, weights);
    }));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.temporal_attention(${q}, ${k}, ${v}, 0.1, ${this.getScale()})`;
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
 * Recurrent Attention (LSTM-style gating).
 */
export class RecurrentAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'recurrent_attention';
  readonly name = 'Recurrent Attention';
  readonly description = 'LSTM-style gated attention for sequential processing';
  readonly category: AttentionCategory = 'temporal';

  private hiddenState: number[] | null = null;

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const dim = values[0].length;

    // Initialize hidden state if needed
    if (!this.hiddenState || this.hiddenState.length !== dim) {
      this.hiddenState = new Array(dim).fill(0);
    }

    // Compute attention with gating
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    const context = this.weightedSum(values, weights);

    // LSTM-style gating
    const gate = this.sigmoid(context.map((c, i) => c + this.hiddenState![i]));
    const output = context.map((c, i) => gate[i] * c + (1 - gate[i]) * this.hiddenState![i]);

    // Update hidden state
    this.hiddenState = output;

    return output;
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    const results: number[][] = [];
    for (const q of queries) {
      results.push(await this.compute(q, keys, values));
    }
    return results;
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.recurrent_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
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

  private sigmoid(x: number[]): number[] {
    return x.map(v => 1 / (1 + Math.exp(-v)));
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
 * State Space Model Attention (S4/Mamba-style).
 */
export class StateSpaceAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'state_space';
  readonly name = 'State Space Attention';
  readonly description = 'State space model attention for efficient sequence modeling';
  readonly category: AttentionCategory = 'temporal';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const dim = values[0].length;

    // Simplified SSM: compute via convolution-like operation
    const state = new Array(dim).fill(0);
    const deltaT = 1.0 / keys.length;

    for (let i = 0; i < keys.length; i++) {
      const score = this.dotProduct(query, keys[i]) / scale;
      const weight = Math.exp(-deltaT * (keys.length - i - 1)) * score;

      for (let d = 0; d < dim; d++) {
        state[d] += weight * values[i][d];
      }
    }

    // Normalize
    const norm = Math.sqrt(state.reduce((s, v) => s + v * v, 0)) + 1e-6;
    return state.map(v => v / norm);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.state_space_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }
}


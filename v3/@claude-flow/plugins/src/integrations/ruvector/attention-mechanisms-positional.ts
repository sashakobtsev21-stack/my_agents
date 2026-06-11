/**
 * Attention Mechanisms — positional family
 *
 * RelativePosition/RotaryPosition/ALiBi/Axial. Extracted verbatim from
 * attention-mechanisms.ts (lines 466-757) during campaign-2 wave 86
 * (W292). attention-mechanisms.ts stays the barrel.
 */
import type {
  AttentionMechanism,
  AttentionConfig,
  AttentionInput,
} from './types.js';

import {
  BaseAttentionMechanism,
  type AttentionCategory,
  type AttentionOptions,
} from './attention.js';

export class RelativePositionAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'relative_position';
  readonly name = 'Relative Position Attention';
  readonly description = 'Attention with relative position biases';
  readonly category: AttentionCategory = 'positional';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const maxRelPos = this.config.params?.maxRelativePosition ?? 128;
    const numBuckets = this.config.params?.numBuckets ?? 32;
    const scale = this.getScale();
    const queryIdx = keys.length - 1;

    const scores = keys.map((k, i) => {
      const relPos = i - queryIdx;
      const bias = this.getRelativePositionBias(relPos, maxRelPos, numBuckets);
      return this.dotProduct(query, k) / scale + bias;
    });

    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map((q, idx) => {
      const maxRelPos = this.config.params?.maxRelativePosition ?? 128;
      const numBuckets = this.config.params?.numBuckets ?? 32;
      const scale = this.getScale();

      const scores = keys.map((k, i) => {
        const relPos = i - idx;
        const bias = this.getRelativePositionBias(relPos, maxRelPos, numBuckets);
        return this.dotProduct(q, k) / scale + bias;
      });

      const weights = this.softmax(scores);
      return this.weightedSum(values, weights);
    }));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const maxRelPos = this.config.params?.maxRelativePosition ?? 128;
    return `SELECT ruvector.relative_position_attention(${q}, ${k}, ${v}, ${maxRelPos}, ${this.getScale()})`;
  }

  private getRelativePositionBias(relPos: number, maxDist: number, numBuckets: number): number {
    // T5-style relative position bucketing
    const clampedPos = Math.max(-maxDist, Math.min(maxDist, relPos));
    const bucket = Math.floor((clampedPos + maxDist) / (2 * maxDist) * numBuckets);
    return Math.sin(bucket * 0.1) * 0.1; // Simplified bias
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
 * Rotary Position Embedding (RoPE) Attention.
 */
export class RotaryPositionAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'rotary_position';
  readonly name = 'Rotary Position Attention';
  readonly description = 'RoPE-based attention with rotary position embeddings';
  readonly category: AttentionCategory = 'positional';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const base = this.config.params?.ropeBase ?? 10000;
    const scale = this.getScale();
    const queryPos = keys.length - 1;

    // Apply RoPE to query
    const rotatedQuery = this.applyRoPE(query, queryPos, base);

    // Apply RoPE to keys and compute attention
    const scores = keys.map((k, i) => {
      const rotatedKey = this.applyRoPE(k, i, base);
      return this.dotProduct(rotatedQuery, rotatedKey) / scale;
    });

    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    const base = this.config.params?.ropeBase ?? 10000;
    const scale = this.getScale();

    return queries.map((q, qIdx) => {
      const rotatedQuery = this.applyRoPE(q, qIdx, base);
      const scores = keys.map((k, kIdx) => {
        const rotatedKey = this.applyRoPE(k, kIdx, base);
        return this.dotProduct(rotatedQuery, rotatedKey) / scale;
      });
      const weights = this.softmax(scores);
      return this.weightedSum(values, weights);
    });
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const base = this.config.params?.ropeBase ?? 10000;
    return `SELECT ruvector.rotary_position_attention(${q}, ${k}, ${v}, ${base}, ${this.getScale()})`;
  }

  private applyRoPE(vec: number[], pos: number, base: number): number[] {
    const result = [...vec];
    const dim = vec.length;
    for (let i = 0; i < dim; i += 2) {
      const freq = 1 / Math.pow(base, i / dim);
      const angle = pos * freq;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = vec[i];
      const y = i + 1 < dim ? vec[i + 1] : 0;
      result[i] = x * cos - y * sin;
      if (i + 1 < dim) result[i + 1] = x * sin + y * cos;
    }
    return result;
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
 * ALiBi (Attention with Linear Biases).
 */
export class ALiBiAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'alibi';
  readonly name = 'ALiBi Attention';
  readonly description = 'Attention with linear position biases for extrapolation';
  readonly category: AttentionCategory = 'positional';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const queryIdx = keys.length - 1;
    const slope = this.getALiBiSlope(0, this.config.numHeads); // Head 0

    const scores = keys.map((k, i) => {
      const distance = Math.abs(i - queryIdx);
      const bias = -slope * distance;
      return this.dotProduct(query, k) / scale + bias;
    });

    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map((q, qIdx) => {
      const scale = this.getScale();
      const slope = this.getALiBiSlope(0, this.config.numHeads);

      const scores = keys.map((k, kIdx) => {
        const distance = Math.abs(kIdx - qIdx);
        const bias = -slope * distance;
        return this.dotProduct(q, k) / scale + bias;
      });

      const weights = this.softmax(scores);
      return this.weightedSum(values, weights);
    }));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.alibi_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
  }

  private getALiBiSlope(headIdx: number, numHeads: number): number {
    const ratio = Math.pow(2, -8 / numHeads);
    return Math.pow(ratio, headIdx + 1);
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
 * Axial Attention (2D decomposition).
 */
export class AxialAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'axial';
  readonly name = 'Axial Attention';
  readonly description = '2D decomposed attention for images and structured data';
  readonly category: AttentionCategory = 'positional';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    // For 1D sequences, this is similar to standard attention
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
    return `SELECT ruvector.axial_attention(${q}, ${k}, ${v}, ${this.getScale()})`;
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


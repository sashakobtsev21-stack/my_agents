/**
 * RuVector Attention — standard mechanisms
 *
 * MultiHead, Self, Cross, Causal, Bidirectional, Local, and Global
 * attention.
 * Extracted verbatim from attention.ts (lines 280-667) during the P3.53
 * god-file decomposition (W174). attention.ts stays the barrel.
 */

import type {
  AttentionConfig,
  AttentionInput,
  AttentionMechanism,
} from './types.js';
import { BaseAttentionMechanism } from './attention-base.js';
import type { AttentionCategory } from './attention-base.js';

// ============================================================================
// Core Attention Implementations
// ============================================================================

/**
 * Multi-Head Attention (Transformer standard).
 */
export class MultiHeadAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'multi_head';
  readonly name = 'Multi-Head Attention';
  readonly description = 'Standard Transformer multi-head attention with parallel attention heads';
  readonly category: AttentionCategory = 'core';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    // Compute attention scores
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
    return `SELECT ruvector.multi_head_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()}, ${this.config.causal})`;
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
 * Self-Attention mechanism.
 */
export class SelfAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'self_attention';
  readonly name = 'Self-Attention';
  readonly description = 'Self-attention where queries, keys, and values come from the same sequence';
  readonly category: AttentionCategory = 'core';

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
    return `SELECT ruvector.self_attention(${q}, ${k}, ${v}, ${this.getScale()}, ${this.config.causal})`;
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
 * Cross-Attention mechanism.
 */
export class CrossAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'cross_attention';
  readonly name = 'Cross-Attention';
  readonly description = 'Cross-attention between two different sequences (encoder-decoder)';
  readonly category: AttentionCategory = 'core';

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
    return `SELECT ruvector.cross_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
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
 * Causal (Masked) Attention for autoregressive models.
 */
export class CausalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'causal';
  readonly name = 'Causal Attention';
  readonly description = 'Causal/masked attention for autoregressive generation (GPT-style)';
  readonly category: AttentionCategory = 'core';

  constructor(config?: Partial<AttentionConfig>) {
    super({ ...config, causal: true });
  }

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const queryIdx = keys.length - 1; // Assume query is for last position
    const scores = keys.map((k, i) => {
      if (i > queryIdx) return -Infinity; // Mask future tokens
      return this.dotProduct(query, k) / scale;
    });
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < queries.length; i++) {
      const maskedKeys = keys.slice(0, i + 1);
      const maskedValues = values.slice(0, i + 1);
      results.push(await this.compute(queries[i], maskedKeys, maskedValues));
    }
    return results;
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    return `SELECT ruvector.causal_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const filtered = x.filter(v => v !== -Infinity);
    if (filtered.length === 0) return x.map(() => 0);
    const max = Math.max(...filtered);
    const exp = x.map(v => v === -Infinity ? 0 : Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return sum > 0 ? exp.map(v => v / sum) : exp;
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
 * Bidirectional Attention (BERT-style).
 */
export class BidirectionalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'bidirectional';
  readonly name = 'Bidirectional Attention';
  readonly description = 'Bidirectional attention attending to all tokens (BERT-style)';
  readonly category: AttentionCategory = 'core';

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
    return `SELECT ruvector.bidirectional_attention(${q}, ${k}, ${v}, ${this.config.numHeads}, ${this.getScale()})`;
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
 * Local Attention with sliding window.
 */
export class LocalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'local_attention';
  readonly name = 'Local Attention';
  readonly description = 'Local attention with fixed window size around each position';
  readonly category: AttentionCategory = 'core';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const windowSize = this.config.params?.windowSize ?? 256;
    const scale = this.getScale();
    const queryIdx = keys.length - 1;
    const start = Math.max(0, queryIdx - Math.floor(windowSize / 2));
    const end = Math.min(keys.length, queryIdx + Math.floor(windowSize / 2) + 1);

    const scores = keys.map((k, i) => {
      if (i < start || i >= end) return -Infinity;
      return this.dotProduct(query, k) / scale;
    });
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map((q, i) => {
      const windowSize = this.config.params?.windowSize ?? 256;
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(keys.length, i + Math.floor(windowSize / 2) + 1);
      return this.compute(q, keys.slice(start, end), values.slice(start, end));
    }));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const windowSize = this.config.params?.windowSize ?? 256;
    return `SELECT ruvector.local_attention(${q}, ${k}, ${v}, ${windowSize}, ${this.getScale()})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(x: number[]): number[] {
    const filtered = x.filter(v => v !== -Infinity);
    if (filtered.length === 0) return x.map(() => 0);
    const max = Math.max(...filtered);
    const exp = x.map(v => v === -Infinity ? 0 : Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return sum > 0 ? exp.map(v => v / sum) : exp;
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
 * Global Attention with special global tokens.
 */
export class GlobalAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'global_attention';
  readonly name = 'Global Attention';
  readonly description = 'Global attention tokens that attend to and are attended by all positions';
  readonly category: AttentionCategory = 'core';

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
    const numGlobal = this.config.params?.numGlobalTokens ?? 1;
    return `SELECT ruvector.global_attention(${q}, ${k}, ${v}, ${numGlobal}, ${this.getScale()})`;
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


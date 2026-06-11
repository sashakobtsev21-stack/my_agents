/**
 * RuVector Attention — efficient mechanisms
 *
 * Flash, FlashV2, MemoryEfficient, Chunk, SlidingWindow, and Dilated
 * attention.
 * Extracted verbatim from attention.ts (lines 668-1063) during the P3.53
 * god-file decomposition (W174). attention.ts stays the barrel.
 */

import type { AttentionInput, AttentionMechanism } from './types.js';
import { BaseAttentionMechanism } from './attention-base.js';
import type { AttentionCategory } from './attention-base.js';

// ============================================================================
// Efficient Attention Implementations
// ============================================================================

/**
 * Flash Attention - memory efficient O(N) attention.
 */
export class FlashAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'flash_attention';
  readonly name = 'Flash Attention';
  readonly description = 'Memory-efficient attention using tiling and recomputation';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const blockSize = this.config.params?.flashBlockSize ?? 64;
    const scale = this.getScale();
    const seqLen = keys.length;
    const dim = values[0].length;

    let output = new Array(dim).fill(0);
    let maxScore = -Infinity;
    let sumExp = 0;

    // Process in blocks for memory efficiency
    for (let blockStart = 0; blockStart < seqLen; blockStart += blockSize) {
      const blockEnd = Math.min(blockStart + blockSize, seqLen);

      // Compute scores for this block
      const blockScores: number[] = [];
      for (let i = blockStart; i < blockEnd; i++) {
        blockScores.push(this.dotProduct(query, keys[i]) / scale);
      }

      // Update running max and sum
      const blockMax = Math.max(...blockScores);
      if (blockMax > maxScore) {
        const correction = Math.exp(maxScore - blockMax);
        output = output.map(v => v * correction);
        sumExp *= correction;
        maxScore = blockMax;
      }

      // Accumulate weighted values
      for (let i = 0; i < blockScores.length; i++) {
        const weight = Math.exp(blockScores[i] - maxScore);
        sumExp += weight;
        for (let j = 0; j < dim; j++) {
          output[j] += weight * values[blockStart + i][j];
        }
      }
    }

    // Normalize
    return output.map(v => v / sumExp);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const blockSize = this.config.params?.flashBlockSize ?? 64;
    return `SELECT ruvector.flash_attention(${q}, ${k}, ${v}, ${blockSize}, ${this.getScale()}, ${this.config.causal})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }
}

/**
 * Flash Attention V2 - improved memory efficiency.
 */
export class FlashAttentionV2 extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'flash_attention_v2';
  readonly name = 'Flash Attention V2';
  readonly description = 'Improved Flash Attention with better parallelism and reduced memory';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    // Similar to Flash Attention but with improved block scheduling
    const blockSize = this.config.params?.flashBlockSize ?? 128;
    const scale = this.getScale();
    const seqLen = keys.length;
    const dim = values[0].length;

    let output = new Array(dim).fill(0);
    let maxScore = -Infinity;
    let sumExp = 0;

    for (let blockStart = 0; blockStart < seqLen; blockStart += blockSize) {
      const blockEnd = Math.min(blockStart + blockSize, seqLen);

      const blockScores: number[] = [];
      for (let i = blockStart; i < blockEnd; i++) {
        blockScores.push(this.dotProduct(query, keys[i]) / scale);
      }

      const blockMax = Math.max(...blockScores);
      if (blockMax > maxScore) {
        const correction = Math.exp(maxScore - blockMax);
        output = output.map(v => v * correction);
        sumExp *= correction;
        maxScore = blockMax;
      }

      for (let i = 0; i < blockScores.length; i++) {
        const weight = Math.exp(blockScores[i] - maxScore);
        sumExp += weight;
        for (let j = 0; j < dim; j++) {
          output[j] += weight * values[blockStart + i][j];
        }
      }
    }

    return output.map(v => v / sumExp);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    return Promise.all(queries.map(q => this.compute(q, keys, values)));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const blockSize = this.config.params?.flashBlockSize ?? 128;
    return `SELECT ruvector.flash_attention_v2(${q}, ${k}, ${v}, ${blockSize}, ${this.getScale()}, ${this.config.causal})`;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }
}

/**
 * Memory Efficient Attention.
 */
export class MemoryEfficientAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'memory_efficient';
  readonly name = 'Memory Efficient Attention';
  readonly description = 'Attention optimized for reduced memory footprint';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const scale = this.getScale();
    const scores = keys.map(k => this.dotProduct(query, k) / scale);
    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    // Process one at a time to minimize memory
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
    return `SELECT ruvector.memory_efficient_attention(${q}, ${k}, ${v}, ${this.getScale()}, ${this.config.params?.checkpointing ?? false})`;
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
 * Chunk Attention - process in chunks.
 */
export class ChunkAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'chunk_attention';
  readonly name = 'Chunk Attention';
  readonly description = 'Chunked attention processing for very long sequences';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const chunkSize = this.config.params?.blockSize ?? 512;
    const scale = this.getScale();
    const dim = values[0].length;

    const outputs: number[][] = [];
    const chunkWeights: number[] = [];

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunkKeys = keys.slice(i, i + chunkSize);
      const chunkValues = values.slice(i, i + chunkSize);
      const scores = chunkKeys.map(k => this.dotProduct(query, k) / scale);
      const weights = this.softmax(scores);
      const chunkOutput = this.weightedSum(chunkValues, weights);
      outputs.push(chunkOutput);
      chunkWeights.push(weights.reduce((a, b) => a + b, 0));
    }

    // Combine chunk outputs
    const totalWeight = chunkWeights.reduce((a, b) => a + b, 0);
    const result = new Array(dim).fill(0);
    for (let c = 0; c < outputs.length; c++) {
      const w = chunkWeights[c] / totalWeight;
      for (let j = 0; j < dim; j++) {
        result[j] += w * outputs[c][j];
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
    const chunkSize = this.config.params?.blockSize ?? 512;
    return `SELECT ruvector.chunk_attention(${q}, ${k}, ${v}, ${chunkSize}, ${this.getScale()})`;
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
 * Sliding Window Attention.
 */
export class SlidingWindowAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'sliding_window';
  readonly name = 'Sliding Window Attention';
  readonly description = 'Attention with a sliding window for each position';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const windowSize = this.config.params?.windowSize ?? 256;
    const scale = this.getScale();
    const queryIdx = keys.length - 1;
    const halfWindow = Math.floor(windowSize / 2);

    const scores = keys.map((k, i) => {
      if (Math.abs(i - queryIdx) > halfWindow) return -Infinity;
      return this.dotProduct(query, k) / scale;
    });

    const weights = this.softmax(scores);
    return this.weightedSum(values, weights);
  }

  async computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]> {
    const windowSize = this.config.params?.windowSize ?? 256;
    const halfWindow = Math.floor(windowSize / 2);

    return Promise.all(queries.map((q, idx) => {
      const start = Math.max(0, idx - halfWindow);
      const end = Math.min(keys.length, idx + halfWindow + 1);
      const windowKeys = keys.slice(start, end);
      const windowValues = values.slice(start, end);
      return this.compute(q, windowKeys, windowValues);
    }));
  }

  toSQL(input: AttentionInput): string {
    const q = this.formatMatrix(input.query);
    const k = this.formatMatrix(input.key);
    const v = this.formatMatrix(input.value);
    const windowSize = this.config.params?.windowSize ?? 256;
    return `SELECT ruvector.sliding_window_attention(${q}, ${k}, ${v}, ${windowSize}, ${this.getScale()})`;
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
 * Dilated Attention with strided access.
 */
export class DilatedAttention extends BaseAttentionMechanism {
  readonly type: AttentionMechanism = 'dilated_attention';
  readonly name = 'Dilated Attention';
  readonly description = 'Dilated/strided attention for capturing long-range dependencies';
  readonly category: AttentionCategory = 'efficient';

  async compute(query: number[], keys: number[][], values: number[][]): Promise<number[]> {
    const dilationRate = this.config.params?.dilationRate ?? 2;
    const scale = this.getScale();

    const scores = keys.map((k, i) => {
      if (i % dilationRate !== 0) return -Infinity;
      return this.dotProduct(query, k) / scale;
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
    const dilationRate = this.config.params?.dilationRate ?? 2;
    return `SELECT ruvector.dilated_attention(${q}, ${k}, ${v}, ${dilationRate}, ${this.getScale()})`;
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


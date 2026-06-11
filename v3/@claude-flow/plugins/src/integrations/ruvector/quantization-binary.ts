/**
 * RuVector Quantization — binary
 *
 * BinaryQuantizer: 32x memory reduction via sign bits.
 * Extracted verbatim from quantization.ts (lines 459-651) during the
 * P3.43 god-file decomposition (W164). quantization.ts stays the barrel.
 */

import type {
  BinaryQuantizationOptions,
  IQuantizer,
  QuantizationType,
} from './quantization-types.js';
import { euclideanDistance } from './quantization-internal.js';

// ============================================================================
// Binary Quantization
// ============================================================================

/**
 * BinaryQuantizer implements binary quantization for extreme compression.
 *
 * Quantizes float32 vectors to binary (1 bit per dimension) for 32x memory reduction.
 * Uses Hamming distance for fast comparison.
 *
 * @example
 * ```typescript
 * const quantizer = new BinaryQuantizer({ dimensions: 128 });
 * const quantized = quantizer.quantize(vectors);
 * const distance = quantizer.hammingDistance(quantized[0], quantized[1]);
 * ```
 */
export class BinaryQuantizer implements IQuantizer {
  readonly type: QuantizationType = 'binary';
  readonly dimensions: number;

  private threshold: number;
  private learnedThresholds: number[] | null;
  private readonly bytesPerVector: number;

  constructor(options: BinaryQuantizationOptions) {
    this.dimensions = options.dimensions;
    this.threshold = options.threshold ?? 0;
    this.learnedThresholds = options.learnedThresholds ?? null;

    // Calculate bytes needed (ceil(dimensions / 8))
    this.bytesPerVector = Math.ceil(this.dimensions / 8);
  }

  /**
   * Learns optimal thresholds per dimension from training data.
   *
   * @param samples - Training vectors
   */
  learnThresholds(samples: number[][]): void {
    if (samples.length === 0) {
      throw new Error('Cannot learn thresholds from empty samples');
    }

    // Compute median per dimension as threshold
    this.learnedThresholds = new Array(this.dimensions);

    for (let d = 0; d < this.dimensions; d++) {
      const values = samples.map(s => s[d]).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      this.learnedThresholds[d] = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
    }
  }

  /**
   * Quantizes float32 vectors to binary.
   *
   * @param vectors - Input vectors
   * @returns Binary quantized arrays (packed bits)
   */
  quantize(vectors: number[][]): Uint8Array[] {
    return vectors.map((vec) => {
      const binary = new Uint8Array(this.bytesPerVector);

      for (let i = 0; i < this.dimensions; i++) {
        const threshold = this.learnedThresholds
          ? this.learnedThresholds[i]
          : this.threshold;

        if (vec[i] > threshold) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = i % 8;
          binary[byteIdx] |= (1 << bitIdx);
        }
      }

      return binary;
    });
  }

  /**
   * Dequantizes binary arrays back to float vectors.
   * Note: This is highly lossy and mainly for debugging.
   *
   * @param quantized - Binary quantized arrays
   * @returns Reconstructed vectors (-1 or +1 per dimension)
   */
  dequantize(quantized: Uint8Array[]): number[][] {
    return quantized.map((binary) => {
      const vec = new Array(this.dimensions);

      for (let i = 0; i < this.dimensions; i++) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = i % 8;
        const bit = (binary[byteIdx] >> bitIdx) & 1;
        vec[i] = bit === 1 ? 1 : -1;
      }

      return vec;
    });
  }

  /**
   * Computes Hamming distance between two binary vectors.
   *
   * @param a - First binary vector
   * @param b - Second binary vector
   * @returns Hamming distance (number of differing bits)
   */
  hammingDistance(a: Uint8Array, b: Uint8Array): number {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      const xor = a[i] ^ b[i];
      // Count bits using Brian Kernighan's algorithm
      let bits = xor;
      while (bits) {
        distance++;
        bits &= bits - 1;
      }
    }
    return distance;
  }

  /**
   * Two-stage search: binary filter + rerank with exact distances.
   *
   * @param query - Query vector (float)
   * @param candidates - Candidate vectors (float)
   * @param k - Number of results to return
   * @param filterRatio - Ratio of candidates to keep after binary filter (default: 10)
   * @returns Indices of top-k candidates after reranking
   */
  searchWithRerank(
    query: number[],
    candidates: number[][],
    k: number,
    filterRatio: number = 10
  ): number[] {
    // Step 1: Quantize query and all candidates
    const queryBinary = this.quantize([query])[0];
    const candidatesBinary = this.quantize(candidates);

    // Step 2: Compute Hamming distances
    const distances: Array<{ index: number; hamming: number }> = [];
    for (let i = 0; i < candidatesBinary.length; i++) {
      distances.push({
        index: i,
        hamming: this.hammingDistance(queryBinary, candidatesBinary[i]),
      });
    }

    // Step 3: Filter top candidates by Hamming distance
    distances.sort((a, b) => a.hamming - b.hamming);
    const numCandidates = Math.min(k * filterRatio, candidates.length);
    const filtered = distances.slice(0, numCandidates);

    // Step 4: Rerank filtered candidates with exact Euclidean distance
    const reranked: Array<{ index: number; distance: number }> = [];
    for (const { index } of filtered) {
      reranked.push({
        index,
        distance: euclideanDistance(query, candidates[index]),
      });
    }

    // Step 5: Sort by exact distance and return top-k
    reranked.sort((a, b) => a.distance - b.distance);
    return reranked.slice(0, k).map(r => r.index);
  }

  /**
   * Batch Hamming distance computation.
   *
   * @param query - Query binary vector
   * @param candidates - Candidate binary vectors
   * @returns Array of Hamming distances
   */
  batchHammingDistance(query: Uint8Array, candidates: Uint8Array[]): number[] {
    return candidates.map(c => this.hammingDistance(query, c));
  }

  getCompressionRatio(): number {
    // float32 (32 bits) -> binary (1 bit) = 32x
    return 32;
  }

  getMemoryReduction(): string {
    return '32x';
  }
}


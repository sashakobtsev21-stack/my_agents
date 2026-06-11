/**
 * V3 HNSW Vector Index — support pieces
 *
 * BinaryMinHeap/BinaryMaxHeap (O(log n) priority queues), the HNSWNode
 * shape, the Quantizer, and the length-prefixed deserialization helpers
 * used by HNSWIndex. These were module-private in the original
 * hnsw-index.ts (P3.48, W169) and are deliberately NOT re-exported by
 * hnsw-index.ts — the public surface (HNSWIndex + default) is unchanged
 * and the ADR-125 export contract (no HnswLite leak) is unaffected.
 */

import { QuantizationConfig } from './types.js';

export class BinaryMinHeap<T> {
  private heap: Array<{ item: T; priority: number }> = [];

  get size(): number {
    return this.heap.length;
  }

  insert(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0].item;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  peekPriority(): number | undefined {
    return this.heap[0]?.priority;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  toArray(): T[] {
    return this.heap
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((entry) => entry.item);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

/**
 * Binary Max Heap for bounded top-k tracking
 * Keeps track of k smallest elements by evicting largest when full
 */
export class BinaryMaxHeap<T> {
  private heap: Array<{ item: T; priority: number }> = [];
  private maxSize: number;

  constructor(maxSize: number = Infinity) {
    this.maxSize = maxSize;
  }

  get size(): number {
    return this.heap.length;
  }

  insert(item: T, priority: number): boolean {
    // If at capacity and new item is worse than worst, reject
    if (this.heap.length >= this.maxSize && priority >= this.heap[0]?.priority) {
      return false;
    }

    if (this.heap.length >= this.maxSize) {
      // Replace max element
      this.heap[0] = { item, priority };
      this.bubbleDown(0);
    } else {
      this.heap.push({ item, priority });
      this.bubbleUp(this.heap.length - 1);
    }
    return true;
  }

  peekMax(): T | undefined {
    return this.heap[0]?.item;
  }

  peekMaxPriority(): number {
    return this.heap[0]?.priority ?? Infinity;
  }

  extractMax(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const max = this.heap[0].item;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return max;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  toSortedArray(): Array<{ item: T; priority: number }> {
    return this.heap.slice().sort((a, b) => a.priority - b.priority);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority >= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let largest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < length && this.heap[left].priority > this.heap[largest].priority) {
        largest = left;
      }
      if (right < length && this.heap[right].priority > this.heap[largest].priority) {
        largest = right;
      }
      if (largest === index) break;
      [this.heap[largest], this.heap[index]] = [this.heap[index], this.heap[largest]];
      index = largest;
    }
  }
}

/**
 * Internal node structure for HNSW graph
 */
export interface HNSWNode {
  /** Node ID (memory entry ID) */
  id: string;

  /** Vector embedding (original) */
  vector: Float32Array;

  /** Pre-normalized vector for O(1) cosine similarity */
  normalizedVector: Float32Array | null;

  /** Connections at each layer */
  connections: Map<number, Set<string>>;

  /** Node level (top layer this node appears in) */
  level: number;
}

/**
 * HNSW Index implementation for ultra-fast vector similarity search
 *
 * Performance characteristics:
 * - Search: O(log n) approximate nearest neighbor
 * - Insert: O(log n) amortized
 * - Memory: O(n * M * L) where M is max connections, L is layers
 */

export class Quantizer {
  private config: QuantizationConfig;
  private dimensions: number;

  /** Trained PQ codebooks: codebooks[subquantizer][centroid][dimension] */
  private codebooks: number[][][] | null = null;

  /** Accumulated vectors for lazy codebook training */
  private trainingVectors: number[][] = [];

  /** Minimum number of vectors needed before training codebooks */
  private readonly pqTrainingThreshold: number = 256;

  /** Whether PQ codebooks have been trained */
  private pqTrained: boolean = false;

  constructor(config: QuantizationConfig, dimensions: number) {
    this.config = config;
    this.dimensions = dimensions;
  }

  /**
   * Encode a vector using quantization
   */
  encode(vector: Float32Array): Float32Array {
    switch (this.config.type) {
      case 'binary':
        return this.binaryQuantize(vector);
      case 'scalar':
        return this.scalarQuantize(vector);
      case 'product':
        return this.productQuantize(vector);
      default:
        return vector;
    }
  }

  /**
   * Get compression ratio
   */
  getCompressionRatio(): number {
    switch (this.config.type) {
      case 'binary':
        return 32; // 32x compression (32 bits -> 1 bit per dimension)
      case 'scalar':
        return 32 / (this.config.bits || 8);
      case 'product':
        return this.config.subquantizers || 8;
      default:
        return 1;
    }
  }

  private binaryQuantize(vector: Float32Array): Float32Array {
    // Simple binary quantization: > 0 becomes 1, <= 0 becomes 0
    // Stored in packed format in a smaller Float32Array
    const packedLength = Math.ceil(vector.length / 32);
    const packed = new Float32Array(packedLength);

    for (let i = 0; i < vector.length; i++) {
      const packedIndex = Math.floor(i / 32);
      const bitPosition = i % 32;
      if (vector[i] > 0) {
        packed[packedIndex] = (packed[packedIndex] || 0) | (1 << bitPosition);
      }
    }

    return packed;
  }

  private scalarQuantize(vector: Float32Array): Float32Array {
    // Find min/max for normalization
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] < min) min = vector[i];
      if (vector[i] > max) max = vector[i];
    }

    const range = max - min || 1;
    const bits = this.config.bits || 8;
    const levels = Math.pow(2, bits);

    // Quantize each value
    const quantized = new Float32Array(vector.length + 2); // +2 for min/range
    quantized[0] = min;
    quantized[1] = range;

    for (let i = 0; i < vector.length; i++) {
      const normalized = (vector[i] - min) / range;
      quantized[i + 2] = Math.round(normalized * (levels - 1));
    }

    return quantized;
  }

  private productQuantize(vector: Float32Array): Float32Array {
    const numSubquantizers = this.config.subquantizers || 8;
    const numCentroids = this.config.codebookSize || 256;

    // Accumulate training vectors until we have enough to train codebooks
    if (!this.pqTrained) {
      this.trainingVectors.push(Array.from(vector));

      if (this.trainingVectors.length >= this.pqTrainingThreshold) {
        this.codebooks = this.trainProductQuantizer(
          this.trainingVectors,
          numSubquantizers,
          numCentroids,
        );
        this.pqTrained = true;
        this.trainingVectors = []; // Free training data
      } else {
        // Not enough data to train yet; fall back to sub-vector means
        const subvectorSize = Math.ceil(vector.length / numSubquantizers);
        const quantized = new Float32Array(numSubquantizers);
        for (let i = 0; i < numSubquantizers; i++) {
          let sum = 0;
          const start = i * subvectorSize;
          const end = Math.min(start + subvectorSize, vector.length);
          for (let j = start; j < end; j++) {
            sum += vector[j];
          }
          quantized[i] = sum / (end - start);
        }
        return quantized;
      }
    }

    // Encode: assign each sub-vector to its nearest centroid
    const subvectorSize = Math.ceil(vector.length / numSubquantizers);
    const encoded = new Float32Array(numSubquantizers);

    for (let m = 0; m < numSubquantizers; m++) {
      const start = m * subvectorSize;
      const end = Math.min(start + subvectorSize, vector.length);
      const codebook = this.codebooks![m];

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < codebook.length; c++) {
        let dist = 0;
        for (let d = 0; d < end - start; d++) {
          const diff = vector[start + d] - codebook[c][d];
          dist += diff * diff;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      // Store centroid index (fits in Uint8 when numCentroids <= 256)
      encoded[m] = bestIdx;
    }

    return encoded;
  }

  /**
   * Train Product Quantizer codebooks using k-means on sub-vector slices.
   *
   * Splits each training vector into `numSubquantizers` sub-vectors, then
   * learns `numCentroids` centroids per sub-quantizer position.
   *
   * @returns codebooks[m][c] = centroid vector for sub-quantizer m, centroid c
   */
  trainProductQuantizer(
    trainingVectors: number[][],
    numSubquantizers: number,
    numCentroids: number,
  ): number[][][] {
    const dim = trainingVectors[0].length;
    const subvectorSize = Math.ceil(dim / numSubquantizers);
    const codebooks: number[][][] = [];

    for (let m = 0; m < numSubquantizers; m++) {
      const start = m * subvectorSize;
      const end = Math.min(start + subvectorSize, dim);
      const subLen = end - start;

      // Extract sub-vectors for this position from all training vectors
      const subVectors: number[][] = trainingVectors.map((vec) => {
        const sub = new Array(subLen);
        for (let d = 0; d < subLen; d++) {
          sub[d] = vec[start + d];
        }
        return sub;
      });

      // Clamp centroids to available data points
      const effectiveK = Math.min(numCentroids, subVectors.length);
      const centroids = this.kMeans(subVectors, effectiveK, 20);
      codebooks.push(centroids);
    }

    return codebooks;
  }

  /**
   * Compute approximate squared Euclidean distance between two PQ-encoded
   * vectors using their centroid indices and the shared codebooks.
   *
   * @param encoded1 - Centroid indices for vector 1 (length = numSubquantizers)
   * @param encoded2 - Centroid indices for vector 2 (length = numSubquantizers)
   * @param codebooks - Trained codebooks from trainProductQuantizer()
   * @returns Approximate squared Euclidean distance
   */
  productQuantizeDistance(
    encoded1: Uint8Array,
    encoded2: Uint8Array,
    codebooks?: number[][][],
  ): number {
    const cb = codebooks || this.codebooks;
    if (!cb) {
      throw new Error('Product quantizer codebooks not trained yet');
    }

    let totalDist = 0;
    for (let m = 0; m < encoded1.length; m++) {
      const c1 = cb[m][encoded1[m]];
      const c2 = cb[m][encoded2[m]];
      for (let d = 0; d < c1.length; d++) {
        const diff = c1[d] - c2[d];
        totalDist += diff * diff;
      }
    }
    return totalDist;
  }

  /**
   * K-means clustering.
   *
   * Partitions `data` into `k` clusters and returns the centroid vectors.
   * Initialisation picks the first k data points (deterministic, avoids
   * the overhead of k-means++ for the small sub-vector slices used in PQ).
   */
  private kMeans(data: number[][], k: number, maxIter: number = 20): number[][] {
    const dim = data[0].length;

    // Initialise centroids from the first k data points
    const centroids: number[][] = data.slice(0, k).map((v) => [...v]);

    for (let iter = 0; iter < maxIter; iter++) {
      // --- Assign each point to nearest centroid ---
      const assignments = new Int32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        let bestDist = Infinity;
        let bestIdx = 0;
        for (let j = 0; j < k; j++) {
          let dist = 0;
          for (let d = 0; d < dim; d++) {
            const diff = data[i][d] - centroids[j][d];
            dist += diff * diff;
          }
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = j;
          }
        }
        assignments[i] = bestIdx;
      }

      // --- Update centroids ---
      const sums = Array.from({ length: k }, () => new Float64Array(dim));
      const counts = new Int32Array(k);
      for (let i = 0; i < data.length; i++) {
        const c = assignments[i];
        counts[c]++;
        for (let d = 0; d < dim; d++) {
          sums[c][d] += data[i][d];
        }
      }

      let converged = true;
      for (let j = 0; j < k; j++) {
        if (counts[j] === 0) continue; // Dead centroid, leave unchanged
        for (let d = 0; d < dim; d++) {
          const newVal = sums[j][d] / counts[j];
          if (Math.abs(newVal - centroids[j][d]) > 1e-6) converged = false;
          centroids[j][d] = newVal;
        }
      }

      if (converged) break;
    }

    return centroids;
  }

  /**
   * Whether the product quantizer codebooks are trained and ready for encoding.
   */
  get isPQTrained(): boolean {
    return this.pqTrained;
  }

  /**
   * Access trained codebooks (null if not yet trained).
   */
  getCodebooks(): number[][][] | null {
    return this.codebooks;
  }
}

// ===== Persistence Helpers (ADR-125 Phase 3) =====

export function readLengthPrefixedString(
  buf: Buffer,
  offset: number
): { value: string; offset: number } {
  if (offset + 4 > buf.length) {
    throw new Error(`HNSWIndex.deserialize: truncated string length at offset ${offset}`);
  }
  const len = buf.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + len;
  if (end > buf.length) {
    throw new Error(
      `HNSWIndex.deserialize: truncated string payload at offset ${offset} (needed ${len} bytes, have ${buf.length - start})`
    );
  }
  const value = buf.toString('utf-8', start, end);
  return { value, offset: end };
}

export function readFloat32Array(
  buf: Buffer,
  offset: number
): { value: Float32Array; offset: number } {
  if (offset + 4 > buf.length) {
    throw new Error(`HNSWIndex.deserialize: truncated array length at offset ${offset}`);
  }
  const floatCount = buf.readUInt32BE(offset);
  const start = offset + 4;
  const byteLen = floatCount * 4;
  const end = start + byteLen;
  if (end > buf.length) {
    throw new Error(
      `HNSWIndex.deserialize: truncated array payload at offset ${offset} (needed ${byteLen} bytes, have ${buf.length - start})`
    );
  }
  // Copy into a fresh ArrayBuffer so Float32Array isn't a view onto the original
  // (de-aligned) Node Buffer pool.
  const copy = new ArrayBuffer(byteLen);
  new Uint8Array(copy).set(new Uint8Array(buf.buffer, buf.byteOffset + start, byteLen));
  return { value: new Float32Array(copy), offset: end };
}


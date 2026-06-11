/**
 * RuVector Quantization — product & OPQ
 *
 * ProductQuantizer and OptimizedProductQuantizer (learned
 * rotation), with k-means codebook training.
 * Extracted verbatim from quantization.ts (lines 652-1283) during the
 * P3.43 god-file decomposition (W164). quantization.ts stays the barrel.
 */

import type {
  IQuantizer,
  OptimizedProductQuantizationOptions,
  ProductQuantizationOptions,
  QuantizationType,
} from './quantization-types.js';
import {
  createRng,
  identityMatrix,
  matVec,
  squaredEuclideanDistance,
  transpose,
  zerosMatrix,
} from './quantization-internal.js';
import type { Codebook } from './quantization-internal.js';

// ============================================================================
// Product Quantization
// ============================================================================

/**
 * ProductQuantizer implements product quantization for high compression.
 *
 * Splits vectors into M subvectors and quantizes each to K centroids.
 * Memory: M * ceil(log2(K)) bits per vector (e.g., M=8, K=256 = 8 bytes)
 *
 * @example
 * ```typescript
 * const pq = new ProductQuantizer({
 *   dimensions: 128,
 *   numSubvectors: 8,
 *   numCentroids: 256
 * });
 * await pq.train(trainingVectors);
 * const codes = pq.encode(vectors);
 * const distances = pq.computeDistances(query, codes);
 * ```
 */
export class ProductQuantizer implements IQuantizer {
  readonly type: QuantizationType = 'pq';
  readonly dimensions: number;
  readonly numSubvectors: number;
  readonly numCentroids: number;
  readonly subvectorDim: number;

  protected codebooks: Codebook[] = [];
  protected isTrained: boolean = false;
  protected readonly maxIterations: number;
  protected readonly tolerance: number;
  protected readonly rng: () => number;

  constructor(options: ProductQuantizationOptions) {
    this.dimensions = options.dimensions;
    this.numSubvectors = options.numSubvectors;
    this.numCentroids = options.numCentroids;

    // Validate dimensions divisibility
    if (options.dimensions % options.numSubvectors !== 0) {
      throw new Error(
        `Dimensions (${options.dimensions}) must be divisible by numSubvectors (${options.numSubvectors})`
      );
    }

    this.subvectorDim = options.dimensions / options.numSubvectors;
    this.maxIterations = options.maxIterations ?? 100;
    this.tolerance = options.tolerance ?? 1e-6;
    this.rng = createRng(options.seed ?? 42);
  }

  /**
   * Trains codebooks from training data using k-means clustering.
   *
   * @param vectors - Training vectors
   */
  async train(vectors: number[][]): Promise<void> {
    if (vectors.length < this.numCentroids) {
      throw new Error(
        `Need at least ${this.numCentroids} training vectors, got ${vectors.length}`
      );
    }

    this.codebooks = [];

    // Train a codebook for each subvector
    for (let m = 0; m < this.numSubvectors; m++) {
      // Extract subvectors
      const subvectors = this.extractSubvectors(vectors, m);

      // Train codebook using k-means
      const codebook = await this.trainCodebook(subvectors);
      this.codebooks.push(codebook);
    }

    this.isTrained = true;
  }

  /**
   * Extracts the m-th subvector from all vectors.
   */
  protected extractSubvectors(vectors: number[][], m: number): number[][] {
    const start = m * this.subvectorDim;
    return vectors.map(v => v.slice(start, start + this.subvectorDim));
  }

  /**
   * Trains a single codebook using k-means clustering.
   */
  protected async trainCodebook(subvectors: number[][]): Promise<Codebook> {
    const k = this.numCentroids;
    const dim = this.subvectorDim;

    // Initialize centroids using k-means++ initialization
    const centroids = this.kmeansppInit(subvectors, k);
    const counts = new Array(k).fill(0);

    // K-means iterations
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Assignment step
      const assignments: number[][] = Array.from({ length: k }, () => []);

      for (let i = 0; i < subvectors.length; i++) {
        const nearestIdx = this.findNearestCentroid(subvectors[i], centroids);
        assignments[nearestIdx].push(i);
      }

      // Update step
      let maxShift = 0;
      for (let c = 0; c < k; c++) {
        if (assignments[c].length === 0) {
          // Reinitialize empty centroid
          const randomIdx = Math.floor(this.rng() * subvectors.length);
          centroids[c] = [...subvectors[randomIdx]];
          continue;
        }

        const newCentroid = new Array(dim).fill(0);
        for (const idx of assignments[c]) {
          for (let d = 0; d < dim; d++) {
            newCentroid[d] += subvectors[idx][d];
          }
        }
        for (let d = 0; d < dim; d++) {
          newCentroid[d] /= assignments[c].length;
        }

        const shift = squaredEuclideanDistance(centroids[c], newCentroid);
        maxShift = Math.max(maxShift, shift);
        centroids[c] = newCentroid;
        counts[c] = assignments[c].length;
      }

      // Check convergence
      if (maxShift < this.tolerance) {
        break;
      }

      // Yield to event loop periodically
      if (iter % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return { centroids, counts };
  }

  /**
   * K-means++ initialization for better centroid selection.
   */
  protected kmeansppInit(subvectors: number[][], k: number): number[][] {
    const centroids: number[][] = [];

    // First centroid: random
    const firstIdx = Math.floor(this.rng() * subvectors.length);
    centroids.push([...subvectors[firstIdx]]);

    // Remaining centroids: proportional to squared distance
    for (let c = 1; c < k; c++) {
      const distances = subvectors.map(v => {
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = squaredEuclideanDistance(v, centroid);
          minDist = Math.min(minDist, dist);
        }
        return minDist;
      });

      const totalDist = distances.reduce((a, b) => a + b, 0);
      let threshold = this.rng() * totalDist;

      for (let i = 0; i < subvectors.length; i++) {
        threshold -= distances[i];
        if (threshold <= 0) {
          centroids.push([...subvectors[i]]);
          break;
        }
      }

      // Fallback if we didn't select (numerical issues)
      if (centroids.length <= c) {
        const fallbackIdx = Math.floor(this.rng() * subvectors.length);
        centroids.push([...subvectors[fallbackIdx]]);
      }
    }

    return centroids;
  }

  /**
   * Finds the nearest centroid index for a subvector.
   */
  protected findNearestCentroid(subvector: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let minIdx = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = squaredEuclideanDistance(subvector, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }

    return minIdx;
  }

  /**
   * Encodes vectors to PQ codes.
   *
   * @param vectors - Input vectors
   * @returns PQ codes (one byte per subvector, assuming K=256)
   */
  encode(vectors: number[][]): Uint8Array[] {
    if (!this.isTrained) {
      throw new Error('ProductQuantizer must be trained before encoding');
    }

    return vectors.map((vec) => {
      const codes = new Uint8Array(this.numSubvectors);

      for (let m = 0; m < this.numSubvectors; m++) {
        const start = m * this.subvectorDim;
        const subvector = vec.slice(start, start + this.subvectorDim);
        codes[m] = this.findNearestCentroid(subvector, this.codebooks[m].centroids);
      }

      return codes;
    });
  }

  /**
   * Implements IQuantizer interface - encodes vectors.
   */
  quantize(vectors: number[][]): Uint8Array[] {
    return this.encode(vectors);
  }

  /**
   * Decodes PQ codes back to approximate vectors.
   *
   * @param codes - PQ codes
   * @returns Reconstructed vectors
   */
  decode(codes: Uint8Array[]): number[][] {
    if (!this.isTrained) {
      throw new Error('ProductQuantizer must be trained before decoding');
    }

    return codes.map((code) => {
      const vec = new Array(this.dimensions);

      for (let m = 0; m < this.numSubvectors; m++) {
        const centroid = this.codebooks[m].centroids[code[m]];
        const start = m * this.subvectorDim;
        for (let d = 0; d < this.subvectorDim; d++) {
          vec[start + d] = centroid[d];
        }
      }

      return vec;
    });
  }

  /**
   * Implements IQuantizer interface - decodes vectors.
   */
  dequantize(quantized: Uint8Array[]): number[][] {
    return this.decode(quantized);
  }

  /**
   * Computes asymmetric distances from a query to encoded vectors.
   *
   * Asymmetric distance computation (ADC):
   * - Query is NOT quantized (exact)
   * - Database vectors are quantized (codes)
   * - Distance is computed using lookup tables
   *
   * @param query - Query vector (float)
   * @param codes - Database PQ codes
   * @returns Array of distances
   */
  computeDistances(query: number[], codes: Uint8Array[]): number[] {
    if (!this.isTrained) {
      throw new Error('ProductQuantizer must be trained before computing distances');
    }

    // Build distance lookup tables
    const distanceTables = this.buildDistanceTables(query);

    // Compute distances using tables
    return codes.map((code) => {
      let distance = 0;
      for (let m = 0; m < this.numSubvectors; m++) {
        distance += distanceTables[m][code[m]];
      }
      return Math.sqrt(distance);
    });
  }

  /**
   * Builds distance lookup tables for asymmetric distance computation.
   */
  protected buildDistanceTables(query: number[]): number[][] {
    const tables: number[][] = [];

    for (let m = 0; m < this.numSubvectors; m++) {
      const start = m * this.subvectorDim;
      const querySubvector = query.slice(start, start + this.subvectorDim);

      const table = new Array(this.numCentroids);
      for (let c = 0; c < this.numCentroids; c++) {
        table[c] = squaredEuclideanDistance(
          querySubvector,
          this.codebooks[m].centroids[c]
        );
      }
      tables.push(table);
    }

    return tables;
  }

  /**
   * Computes symmetric distances between two sets of codes.
   *
   * @param codesA - First set of PQ codes
   * @param codesB - Second set of PQ codes
   * @returns Distance matrix
   */
  computeSymmetricDistances(codesA: Uint8Array[], codesB: Uint8Array[]): number[][] {
    if (!this.isTrained) {
      throw new Error('ProductQuantizer must be trained before computing distances');
    }

    // Precompute inter-centroid distances for each subvector
    const centroidDists: number[][][] = [];
    for (let m = 0; m < this.numSubvectors; m++) {
      const dists = zerosMatrix(this.numCentroids, this.numCentroids);
      for (let i = 0; i < this.numCentroids; i++) {
        for (let j = i; j < this.numCentroids; j++) {
          const d = squaredEuclideanDistance(
            this.codebooks[m].centroids[i],
            this.codebooks[m].centroids[j]
          );
          dists[i][j] = d;
          dists[j][i] = d;
        }
      }
      centroidDists.push(dists);
    }

    // Compute distance matrix
    const result = zerosMatrix(codesA.length, codesB.length);
    for (let i = 0; i < codesA.length; i++) {
      for (let j = 0; j < codesB.length; j++) {
        let dist = 0;
        for (let m = 0; m < this.numSubvectors; m++) {
          dist += centroidDists[m][codesA[i][m]][codesB[j][m]];
        }
        result[i][j] = Math.sqrt(dist);
      }
    }

    return result;
  }

  getCompressionRatio(): number {
    // float32 * dimensions -> numSubvectors bytes (for K=256)
    // = (4 * dimensions) / numSubvectors
    return (4 * this.dimensions) / this.numSubvectors;
  }

  getMemoryReduction(): string {
    const ratio = this.getCompressionRatio();
    return `${ratio.toFixed(1)}x`;
  }

  /**
   * Gets the trained codebooks.
   */
  getCodebooks(): Codebook[] {
    return this.codebooks.map(cb => ({
      centroids: cb.centroids.map(c => [...c]),
      counts: [...cb.counts],
    }));
  }

  /**
   * Sets codebooks directly (for loading pretrained).
   */
  setCodebooks(codebooks: Codebook[]): void {
    if (codebooks.length !== this.numSubvectors) {
      throw new Error(`Expected ${this.numSubvectors} codebooks, got ${codebooks.length}`);
    }
    this.codebooks = codebooks;
    this.isTrained = true;
  }

  /**
   * Checks if the quantizer is trained.
   */
  get trained(): boolean {
    return this.isTrained;
  }
}

// ============================================================================
// Optimized Product Quantization (OPQ)
// ============================================================================

/**
 * OptimizedProductQuantizer extends PQ with learned rotation.
 *
 * Learns an orthogonal rotation matrix to minimize quantization error.
 * The rotation decorrelates dimensions and distributes variance evenly.
 *
 * @example
 * ```typescript
 * const opq = new OptimizedProductQuantizer({
 *   dimensions: 128,
 *   numSubvectors: 8,
 *   numCentroids: 256,
 *   opqIterations: 10
 * });
 * await opq.trainWithRotation(trainingVectors);
 * const codes = opq.encode(vectors);
 * ```
 */
export class OptimizedProductQuantizer extends ProductQuantizer {
  override readonly type: QuantizationType = 'opq';

  private rotationMatrix: number[][] | null = null;
  private readonly opqIterations: number;
  private readonly learningRate: number;

  constructor(options: OptimizedProductQuantizationOptions) {
    super(options);
    this.opqIterations = options.opqIterations ?? 10;
    this.learningRate = options.learningRate ?? 0.01;
  }

  /**
   * Trains the quantizer with rotation matrix optimization.
   *
   * @param vectors - Training vectors
   */
  async trainWithRotation(vectors: number[][]): Promise<void> {
    // Initialize rotation matrix as identity
    this.rotationMatrix = identityMatrix(this.dimensions);

    for (let opqIter = 0; opqIter < this.opqIterations; opqIter++) {
      // Step 1: Rotate vectors
      const rotatedVectors = this.rotateVectors(vectors);

      // Step 2: Train PQ on rotated vectors
      await super.train(rotatedVectors);

      // Step 3: Update rotation matrix using Procrustes analysis
      this.updateRotation(vectors);

      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Final PQ training with final rotation
    const finalRotated = this.rotateVectors(vectors);
    await super.train(finalRotated);
  }

  /**
   * Rotates vectors using the learned rotation matrix.
   */
  private rotateVectors(vectors: number[][]): number[][] {
    if (!this.rotationMatrix) {
      return vectors;
    }
    return vectors.map(v => matVec(this.rotationMatrix!, v));
  }

  /**
   * Updates the rotation matrix using Procrustes analysis.
   * Minimizes ||X - R * decode(encode(R^T * X))||^2
   */
  private updateRotation(vectors: number[][]): void {
    if (!this.rotationMatrix) return;

    // Get reconstructed vectors
    const rotated = this.rotateVectors(vectors);
    const codes = this.encode(rotated);
    const reconstructed = this.decode(codes);

    // Compute X^T * Y for Procrustes
    const xty = zerosMatrix(this.dimensions, this.dimensions);
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < this.dimensions; j++) {
        for (let k = 0; k < this.dimensions; k++) {
          xty[j][k] += vectors[i][j] * reconstructed[i][k];
        }
      }
    }

    // SVD approximation using power iteration
    // For simplicity, we use gradient descent on the rotation
    const gradientUpdate = this.computeRotationGradient(vectors, reconstructed);

    // Update rotation matrix
    for (let i = 0; i < this.dimensions; i++) {
      for (let j = 0; j < this.dimensions; j++) {
        this.rotationMatrix![i][j] -= this.learningRate * gradientUpdate[i][j];
      }
    }

    // Orthogonalize using Gram-Schmidt
    this.orthogonalize();
  }

  /**
   * Computes gradient for rotation update.
   */
  private computeRotationGradient(
    original: number[][],
    reconstructed: number[][]
  ): number[][] {
    const gradient = zerosMatrix(this.dimensions, this.dimensions);

    for (let i = 0; i < original.length; i++) {
      const rotatedOrig = matVec(this.rotationMatrix!, original[i]);
      const error = rotatedOrig.map((v, j) => v - reconstructed[i][j]);

      for (let j = 0; j < this.dimensions; j++) {
        for (let k = 0; k < this.dimensions; k++) {
          gradient[j][k] += error[j] * original[i][k];
        }
      }
    }

    // Normalize
    const scale = 1 / original.length;
    for (let i = 0; i < this.dimensions; i++) {
      for (let j = 0; j < this.dimensions; j++) {
        gradient[i][j] *= scale;
      }
    }

    return gradient;
  }

  /**
   * Orthogonalizes the rotation matrix using modified Gram-Schmidt.
   */
  private orthogonalize(): void {
    if (!this.rotationMatrix) return;

    for (let i = 0; i < this.dimensions; i++) {
      // Normalize column i
      let n = 0;
      for (let j = 0; j < this.dimensions; j++) {
        n += this.rotationMatrix[j][i] * this.rotationMatrix[j][i];
      }
      n = Math.sqrt(n);
      if (n > 1e-10) {
        for (let j = 0; j < this.dimensions; j++) {
          this.rotationMatrix[j][i] /= n;
        }
      }

      // Remove component from remaining columns
      for (let k = i + 1; k < this.dimensions; k++) {
        let projection = 0;
        for (let j = 0; j < this.dimensions; j++) {
          projection += this.rotationMatrix[j][i] * this.rotationMatrix[j][k];
        }
        for (let j = 0; j < this.dimensions; j++) {
          this.rotationMatrix[j][k] -= projection * this.rotationMatrix[j][i];
        }
      }
    }
  }

  /**
   * Encodes vectors with rotation.
   */
  override encode(vectors: number[][]): Uint8Array[] {
    const rotated = this.rotateVectors(vectors);
    return super.encode(rotated);
  }

  /**
   * Decodes codes and applies inverse rotation.
   */
  override decode(codes: Uint8Array[]): number[][] {
    const decoded = super.decode(codes);
    if (!this.rotationMatrix) {
      return decoded;
    }
    // Apply inverse rotation (transpose for orthogonal matrix)
    const invRotation = transpose(this.rotationMatrix);
    return decoded.map(v => matVec(invRotation, v));
  }

  /**
   * Computes distances with rotation applied to query.
   */
  override computeDistances(query: number[], codes: Uint8Array[]): number[] {
    const rotatedQuery = this.rotationMatrix
      ? matVec(this.rotationMatrix, query)
      : query;
    return super.computeDistances(rotatedQuery, codes);
  }

  /**
   * Gets the rotation matrix.
   */
  getRotationMatrix(): number[][] | null {
    return this.rotationMatrix ? this.rotationMatrix.map(r => [...r]) : null;
  }

  /**
   * Sets the rotation matrix directly.
   */
  setRotationMatrix(matrix: number[][]): void {
    if (matrix.length !== this.dimensions || matrix[0].length !== this.dimensions) {
      throw new Error(`Expected ${this.dimensions}x${this.dimensions} matrix`);
    }
    this.rotationMatrix = matrix.map(r => [...r]);
  }
}


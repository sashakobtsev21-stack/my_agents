/**
 * RuVector PostgreSQL Bridge - Vector Quantization Module
 *
 * Comprehensive vector quantization for memory reduction:
 * - Scalar Quantization (Int8): 4x memory reduction
 * - Binary Quantization: 32x memory reduction
 * - Product Quantization (PQ): High compression with codebooks
 * - Optimized Product Quantization (OPQ): PQ with learned rotation
 *
 * @module @claude-flow/plugins/integrations/ruvector/quantization
 * @version 1.0.0
 */


// This file is now a thin barrel + factory surface: the quantization
// module was split into the sub-modules below during the P3.43 god-file
// decomposition (W164). Kept as quantization.ts so './quantization.js'
// importers keep resolving byte-identically. quantization-internal.ts
// (CalibrationData/Codebook + math helpers) is intentionally NOT
// re-exported — those names were module-private before the split.
export * from './quantization-types.js';
export * from './quantization-scalar.js';
export * from './quantization-binary.js';
export * from './quantization-product.js';
export * from './quantization-sql.js';

import type {
  BinaryQuantizationOptions,
  IQuantizer,
  OptimizedProductQuantizationOptions,
  ProductQuantizationOptions,
  QuantizationOptions,
  QuantizationStats,
  QuantizationType,
  ScalarQuantizationOptions,
} from './quantization-types.js';
import { ScalarQuantizer } from './quantization-scalar.js';
import { BinaryQuantizer } from './quantization-binary.js';
import {
  OptimizedProductQuantizer,
  ProductQuantizer,
} from './quantization-product.js';
import {
  euclideanDistance,
  squaredEuclideanDistance,
} from './quantization-internal.js';
import type { CalibrationData, Codebook } from './quantization-internal.js';

// ============================================================================
// Factory and Utilities
// ============================================================================

/**
 * Creates a quantizer based on the specified type.
 *
 * @param type - Quantization type
 * @param options - Type-specific options
 * @returns Configured quantizer instance
 *
 * @example
 * ```typescript
 * const scalar = createQuantizer('scalar', { dimensions: 128 });
 * const binary = createQuantizer('binary', { dimensions: 128 });
 * const pq = createQuantizer('pq', { dimensions: 128, numSubvectors: 8, numCentroids: 256 });
 * ```
 */
export function createQuantizer(
  type: 'scalar',
  options: ScalarQuantizationOptions
): ScalarQuantizer;
export function createQuantizer(
  type: 'binary',
  options: BinaryQuantizationOptions
): BinaryQuantizer;
export function createQuantizer(
  type: 'pq',
  options: ProductQuantizationOptions
): ProductQuantizer;
export function createQuantizer(
  type: 'opq',
  options: OptimizedProductQuantizationOptions
): OptimizedProductQuantizer;
export function createQuantizer(
  type: QuantizationType,
  options?: QuantizationOptions
): IQuantizer;
export function createQuantizer(
  type: QuantizationType,
  options?: QuantizationOptions
): IQuantizer {
  switch (type) {
    case 'scalar':
      return new ScalarQuantizer(options as ScalarQuantizationOptions);
    case 'binary':
      return new BinaryQuantizer(options as BinaryQuantizationOptions);
    case 'pq':
      return new ProductQuantizer(options as ProductQuantizationOptions);
    case 'opq':
      return new OptimizedProductQuantizer(options as OptimizedProductQuantizationOptions);
    default:
      throw new Error(`Unknown quantization type: ${type}`);
  }
}

/**
 * Computes quantization statistics by comparing original and reconstructed vectors.
 *
 * @param original - Original vectors
 * @param reconstructed - Reconstructed vectors after quantization
 * @param quantizer - The quantizer used
 * @returns Quantization statistics
 */
export function computeQuantizationStats(
  original: number[][],
  reconstructed: number[][],
  quantizer: IQuantizer
): QuantizationStats {
  if (original.length !== reconstructed.length) {
    throw new Error('Original and reconstructed arrays must have same length');
  }

  // Compute MSE
  let mse = 0;
  for (let i = 0; i < original.length; i++) {
    mse += squaredEuclideanDistance(original[i], reconstructed[i]);
  }
  mse /= original.length;

  // Estimate recall@10 by comparing rankings
  // (simplified - real evaluation would use a test set)
  const recallAt10 = estimateRecall(original, reconstructed, 10);

  return {
    compressionRatio: quantizer.getCompressionRatio(),
    memoryReduction: quantizer.getMemoryReduction(),
    recallAt10,
    searchSpeedup: quantizer.getCompressionRatio() * 0.8, // Approximate
    mse,
  };
}

/**
 * Estimates recall@k by comparing original and reconstructed rankings.
 */
function estimateRecall(
  original: number[][],
  reconstructed: number[][],
  k: number
): number {
  if (original.length < k + 1) {
    return 1.0; // Not enough data to evaluate
  }

  let totalRecall = 0;
  const numQueries = Math.min(100, original.length);

  for (let q = 0; q < numQueries; q++) {
    const query = original[q];

    // Get true top-k using original vectors
    const trueDistances: Array<{ idx: number; dist: number }> = [];
    for (let i = 0; i < original.length; i++) {
      if (i !== q) {
        trueDistances.push({
          idx: i,
          dist: euclideanDistance(query, original[i]),
        });
      }
    }
    trueDistances.sort((a, b) => a.dist - b.dist);
    const trueTopK = new Set(trueDistances.slice(0, k).map(d => d.idx));

    // Get approx top-k using reconstructed vectors
    const approxDistances: Array<{ idx: number; dist: number }> = [];
    for (let i = 0; i < reconstructed.length; i++) {
      if (i !== q) {
        approxDistances.push({
          idx: i,
          dist: euclideanDistance(query, reconstructed[i]),
        });
      }
    }
    approxDistances.sort((a, b) => a.dist - b.dist);
    const approxTopK = approxDistances.slice(0, k).map(d => d.idx);

    // Count intersection
    let hits = 0;
    for (const idx of approxTopK) {
      if (trueTopK.has(idx)) {
        hits++;
      }
    }

    totalRecall += hits / k;
  }

  return totalRecall / numQueries;
}

/**
 * Serializes a quantizer to JSON for persistence.
 *
 * @param quantizer - Quantizer to serialize
 * @returns JSON-serializable object
 */
export function serializeQuantizer(quantizer: IQuantizer): Record<string, unknown> {
  const base = {
    type: quantizer.type,
    dimensions: quantizer.dimensions,
  };

  if (quantizer instanceof ScalarQuantizer) {
    return {
      ...base,
      calibration: quantizer.getCalibration(),
    };
  }

  if (quantizer instanceof OptimizedProductQuantizer) {
    return {
      ...base,
      numSubvectors: quantizer.numSubvectors,
      numCentroids: quantizer.numCentroids,
      codebooks: quantizer.getCodebooks(),
      rotationMatrix: quantizer.getRotationMatrix(),
    };
  }

  if (quantizer instanceof ProductQuantizer) {
    return {
      ...base,
      numSubvectors: quantizer.numSubvectors,
      numCentroids: quantizer.numCentroids,
      codebooks: quantizer.getCodebooks(),
    };
  }

  if (quantizer instanceof BinaryQuantizer) {
    return base;
  }

  return base;
}

/**
 * Deserializes a quantizer from JSON.
 *
 * @param data - Serialized quantizer data
 * @returns Restored quantizer instance
 */
export function deserializeQuantizer(data: Record<string, unknown>): IQuantizer {
  const type = data.type as QuantizationType;
  const dimensions = data.dimensions as number;

  switch (type) {
    case 'scalar': {
      const quantizer = new ScalarQuantizer({ dimensions });
      if (data.calibration) {
        quantizer.setCalibration(data.calibration as CalibrationData);
      }
      return quantizer;
    }

    case 'binary': {
      return new BinaryQuantizer({ dimensions });
    }

    case 'pq': {
      const quantizer = new ProductQuantizer({
        dimensions,
        numSubvectors: data.numSubvectors as number,
        numCentroids: data.numCentroids as number,
      });
      if (data.codebooks) {
        quantizer.setCodebooks(data.codebooks as Codebook[]);
      }
      return quantizer;
    }

    case 'opq': {
      const quantizer = new OptimizedProductQuantizer({
        dimensions,
        numSubvectors: data.numSubvectors as number,
        numCentroids: data.numCentroids as number,
      });
      if (data.codebooks) {
        quantizer.setCodebooks(data.codebooks as Codebook[]);
      }
      if (data.rotationMatrix) {
        quantizer.setRotationMatrix(data.rotationMatrix as number[][]);
      }
      return quantizer;
    }

    default:
      throw new Error(`Unknown quantization type: ${type}`);
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configurations for different use cases.
 */
export const QUANTIZATION_PRESETS = {
  /** Fast search with good accuracy (scalar int8) */
  balanced: {
    type: 'scalar' as const,
    options: {
      dimensions: 128,
      symmetric: true,
    },
  },

  /** Maximum compression (binary) */
  maxCompression: {
    type: 'binary' as const,
    options: {
      dimensions: 128,
      threshold: 0,
    },
  },

  /** High accuracy with compression (PQ) */
  highAccuracy: {
    type: 'pq' as const,
    options: {
      dimensions: 128,
      numSubvectors: 16,
      numCentroids: 256,
    },
  },

  /** Best accuracy (OPQ) */
  bestAccuracy: {
    type: 'opq' as const,
    options: {
      dimensions: 128,
      numSubvectors: 16,
      numCentroids: 256,
      opqIterations: 10,
    },
  },
} as const;

/**
 * Memory reduction factors for each quantization type.
 */
export const MEMORY_REDUCTION = {
  scalar: 4,    // float32 -> int8
  binary: 32,   // float32 -> 1 bit
  pq: 16,       // Typical for M=8, K=256
  opq: 16,      // Same as PQ
} as const;

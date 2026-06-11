/**
 * RuVector Quantization — public types
 *
 * QuantizationType, IQuantizer, the per-scheme option interfaces,
 * and QuantizationStats.
 * Extracted verbatim from quantization.ts (lines 14-122) during the
 * P3.43 god-file decomposition (W164). quantization.ts stays the barrel.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Quantization type options.
 */
export type QuantizationType = 'scalar' | 'binary' | 'pq' | 'opq';

/**
 * Base interface for all quantizers.
 */
export interface IQuantizer {
  /** Quantization type */
  readonly type: QuantizationType;
  /** Original vector dimensions */
  readonly dimensions: number;
  /** Quantize a batch of vectors */
  quantize(vectors: number[][]): Uint8Array[] | Int8Array[];
  /** Dequantize back to float vectors (lossy) */
  dequantize(quantized: Uint8Array[] | Int8Array[]): number[][];
  /** Get compression ratio */
  getCompressionRatio(): number;
  /** Get memory reduction string (e.g., "4x") */
  getMemoryReduction(): string;
}

/**
 * Options for scalar quantization.
 */
export interface ScalarQuantizationOptions {
  /** Vector dimensions */
  dimensions: number;
  /** Minimum value for calibration (auto-computed if not provided) */
  minValue?: number;
  /** Maximum value for calibration (auto-computed if not provided) */
  maxValue?: number;
  /** Use symmetric quantization around zero */
  symmetric?: boolean;
  /** Number of bits for quantization (default: 8) */
  bits?: number;
}

/**
 * Options for binary quantization.
 */
export interface BinaryQuantizationOptions {
  /** Vector dimensions */
  dimensions: number;
  /** Threshold for binarization (default: 0, use sign) */
  threshold?: number;
  /** Use learned thresholds per dimension */
  learnedThresholds?: number[];
}

/**
 * Options for product quantization.
 */
export interface ProductQuantizationOptions {
  /** Vector dimensions */
  dimensions: number;
  /** Number of subvectors (M) - must divide dimensions evenly */
  numSubvectors: number;
  /** Number of centroids per subvector (K) - typically 256 */
  numCentroids: number;
  /** Maximum iterations for k-means training */
  maxIterations?: number;
  /** Convergence tolerance */
  tolerance?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Options for optimized product quantization.
 */
export interface OptimizedProductQuantizationOptions extends ProductQuantizationOptions {
  /** Number of OPQ iterations */
  opqIterations?: number;
  /** Learning rate for rotation optimization */
  learningRate?: number;
}

/**
 * General quantization options union type.
 */
export type QuantizationOptions =
  | ScalarQuantizationOptions
  | BinaryQuantizationOptions
  | ProductQuantizationOptions
  | OptimizedProductQuantizationOptions;

/**
 * Statistics from quantization operations.
 */
export interface QuantizationStats {
  /** Compression ratio (original size / compressed size) */
  compressionRatio: number;
  /** Memory reduction string (e.g., "4x", "32x") */
  memoryReduction: string;
  /** Recall@10 for approximate search (0-1) */
  recallAt10: number;
  /** Search speedup compared to exact search */
  searchSpeedup: number;
  /** Mean squared error from quantization */
  mse?: number;
  /** Training time in milliseconds */
  trainingTimeMs?: number;
}

/**
 * RuVector Quantization — internal shared pieces
 *
 * CalibrationData/Codebook and the 11 vector-math helpers shared by the
 * quantizer implementations. These were module-private in the original
 * quantization.ts (P3.43, W164) and are deliberately NOT re-exported by
 * the quantization.ts barrel — the public API surface is unchanged.
 */

/**
 * Calibration data for scalar quantization.
 */
export interface CalibrationData {
  minValue: number;
  maxValue: number;
  scale: number;
  zeroPoint: number;
}

/**
 * Codebook for product quantization.
 */
export interface Codebook {
  /** Centroids [numCentroids, subvectorDim] */
  centroids: number[][];
  /** Assignment counts for statistics */
  counts: number[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Computes the Euclidean distance between two vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Computes the squared Euclidean distance.
 */
export function squaredEuclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Computes the dot product of two vectors.
 */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Computes the norm of a vector.
 */
export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Normalizes a vector to unit length.
 */
export function normalize(v: number[]): number[] {
  const n = norm(v);
  if (n < 1e-10) return v.map(() => 0);
  return v.map(x => x / n);
}

/**
 * Creates a zero-filled matrix.
 */
export function zerosMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/**
 * Creates an identity matrix.
 */
export function identityMatrix(n: number): number[][] {
  const result = zerosMatrix(n, n);
  for (let i = 0; i < n; i++) {
    result[i][i] = 1;
  }
  return result;
}

/**
 * Matrix-vector multiplication.
 */
export function matVec(matrix: number[][], vec: number[]): number[] {
  return matrix.map(row => dot(row, vec));
}

/**
 * Matrix-matrix multiplication.
 */
export function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;

  const result = zerosMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Matrix transpose.
 */
export function transpose(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = zerosMatrix(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

/**
 * Simple seeded random number generator (Mulberry32).
 */
export function createRng(seed: number): () => number {
  return function() {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}


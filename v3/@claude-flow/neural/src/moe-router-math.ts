/**
 * MoE Router — types, expert tables & tensor math
 *
 * The expert/config/result shapes, dimension constants, and the
 * xavier/matmul/softmax math kernels. Extracted verbatim from
 * moe-router.ts (lines 22-279) during campaign-2 wave 52 (W258).
 * moe-router.ts re-exports the originally-public names; the kernels and
 * PersistedModel/DEFAULT_CONFIG stay unexported from it.
 */

// ============================================================================
// Types & Constants
// ============================================================================

/**
 * Expert type definitions (8 experts)
 */
export type ExpertType =
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'architect'
  | 'security'
  | 'performance'
  | 'researcher'
  | 'coordinator';

/**
 * Expert names in order (index corresponds to expert slot)
 */
export const EXPERT_NAMES: ExpertType[] = [
  'coder',
  'tester',
  'reviewer',
  'architect',
  'security',
  'performance',
  'researcher',
  'coordinator',
];

/**
 * Number of experts (fixed at 8)
 */
export const NUM_EXPERTS = 8;

/**
 * Input dimension (384 from ONNX MiniLM-L6-v2)
 */
export const INPUT_DIM = 384;

/**
 * Hidden layer dimension
 */
export const HIDDEN_DIM = 128;

/**
 * MoE Router configuration
 */
export interface MoERouterConfig {
  /** Top-k experts to route to (default: 2) */
  topK: number;
  /** Learning rate for online updates (default: 0.01) */
  learningRate: number;
  /** Temperature for softmax (default: 1.0) */
  temperature: number;
  /** Load balancing coefficient (default: 0.01) */
  loadBalanceCoef: number;
  /** Path for weight persistence (default: '.swarm/moe-weights.json') */
  weightsPath: string;
  /** Auto-save interval in updates (default: 50) */
  autoSaveInterval: number;
  /** Enable noise for exploration (default: true) */
  enableNoise: boolean;
  /** Noise standard deviation (default: 0.1) */
  noiseStd: number;
}

/**
 * Expert routing result
 */
export interface RoutingResult {
  /** Selected experts with weights */
  experts: Array<{
    name: ExpertType;
    index: number;
    weight: number;
    score: number;
  }>;
  /** Raw gating scores (all experts) */
  allScores: number[];
  /** Load balance loss */
  loadBalanceLoss: number;
  /** Entropy of routing distribution */
  entropy: number;
}

/**
 * Expert utilization statistics
 */
export interface LoadBalanceStats {
  /** Per-expert utilization (0-1) */
  utilization: Record<ExpertType, number>;
  /** Total routing count */
  totalRoutings: number;
  /** Per-expert routing count */
  routingCounts: Record<ExpertType, number>;
  /** Gini coefficient of load (0 = perfect balance, 1 = all to one) */
  giniCoefficient: number;
  /** Coefficient of variation */
  coefficientOfVariation: number;
}

/**
 * Persisted model structure
 */
export interface PersistedModel {
  version: string;
  config: Partial<MoERouterConfig>;
  weights: {
    W1: number[][];
    b1: number[];
    W2: number[][];
    b2: number[];
  };
  stats: {
    updateCount: number;
    routingCounts: number[];
    avgReward: number;
  };
  metadata: {
    savedAt: string;
    expertNames: string[];
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: MoERouterConfig = {
  topK: 2,
  learningRate: 0.01,
  temperature: 1.0,
  loadBalanceCoef: 0.01,
  weightsPath: '.swarm/moe-weights.json',
  autoSaveInterval: 50,
  enableNoise: true,
  noiseStd: 0.1,
};

// ============================================================================
// Matrix Operations
// ============================================================================

/**
 * Initialize weights using Xavier/Glorot initialization
 */
export function xavierInit(fanIn: number, fanOut: number): Float32Array {
  const std = Math.sqrt(2.0 / (fanIn + fanOut));
  const weights = new Float32Array(fanIn * fanOut);
  for (let i = 0; i < weights.length; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-8)) * Math.cos(2 * Math.PI * u2);
    weights[i] = z * std;
  }
  return weights;
}

/**
 * Matrix-vector multiplication: y = Wx
 * W is stored row-major: [rows * cols]
 */
export function matmul(
  W: Float32Array,
  x: Float32Array,
  rows: number,
  cols: number,
  out: Float32Array
): void {
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    const rowOffset = i * cols;
    // 4x loop unrolling for SIMD-friendly access
    let j = 0;
    for (; j + 3 < cols; j += 4) {
      sum +=
        W[rowOffset + j] * x[j] +
        W[rowOffset + j + 1] * x[j + 1] +
        W[rowOffset + j + 2] * x[j + 2] +
        W[rowOffset + j + 3] * x[j + 3];
    }
    // Handle remainder
    for (; j < cols; j++) {
      sum += W[rowOffset + j] * x[j];
    }
    out[i] = sum;
  }
}

/**
 * Vector addition: y = x + b
 */
export function addBias(x: Float32Array, b: Float32Array, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    out[i] = x[i] + b[i];
  }
}

/**
 * ReLU activation: y = max(0, x)
 */
export function relu(x: Float32Array, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    out[i] = x[i] > 0 ? x[i] : 0;
  }
}

/**
 * Softmax with temperature: y_i = exp(x_i/T) / sum(exp(x_j/T))
 */
export function softmax(x: Float32Array, temperature: number, out: Float32Array): void {
  // Find max for numerical stability
  let maxVal = x[0];
  for (let i = 1; i < x.length; i++) {
    if (x[i] > maxVal) maxVal = x[i];
  }

  // Compute exp and sum
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    out[i] = Math.exp((x[i] - maxVal) / temperature);
    sum += out[i];
  }

  // Normalize
  const invSum = 1.0 / (sum + 1e-8);
  for (let i = 0; i < x.length; i++) {
    out[i] *= invSum;
  }
}

/**
 * Compute entropy of distribution: H = -sum(p * log(p))
 */
export function entropy(p: Float32Array): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 1e-8) {
      h -= p[i] * Math.log(p[i]);
    }
  }
  return h;
}

/**
 * Add Gaussian noise for exploration
 */
export function addNoise(x: Float32Array, std: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-8)) * Math.cos(2 * Math.PI * u2);
    out[i] = x[i] + z * std;
  }
}


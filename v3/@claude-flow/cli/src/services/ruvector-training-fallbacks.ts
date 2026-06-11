/**
 * RuVector Training — config types & pure-JS fallbacks
 *
 * TrainingConfig/TrainingResult and the JsMicroLoRA/JsScopedLoRA/
 * JsTrajectoryBuffer fallback implementations (used when the WASM
 * backend is unavailable). Extracted verbatim from ruvector-training.ts
 * (lines 87-301) during campaign-2 wave 13 (W219). The classes were
 * module-private and stay unexported from the barrel; the two config
 * types are re-exported.
 */

type BenchmarkResult = any;

import type {
  WasmMicroLoRA,
  WasmScopedLoRA,
  WasmTrajectoryBuffer,
} from '@ruvector/learning-wasm';

export interface TrainingConfig {
  dim?: number;           // Embedding dimension (max 256)
  learningRate?: number;  // Learning rate
  alpha?: number;         // LoRA scaling factor
  trajectoryCapacity?: number;
  useFlashAttention?: boolean;
  useMoE?: boolean;
  useHyperbolic?: boolean;
  totalSteps?: number;    // For curriculum
  warmupSteps?: number;
  // SONA options (v2 enhancement)
  useSona?: boolean;      // Enable SONA self-optimizing neural architecture
  sonaRank?: number;      // SONA LoRA rank (default: 4)
}

export interface TrainingResult {
  success: boolean;
  adaptationCount: bigint;
  forwardCount: bigint;
  deltaNorm: number;
  trajectoryStats?: {
    successRate: number;
    meanImprovement: number;
    bestImprovement: number;
    totalCount: bigint;
  };
  benchmark?: BenchmarkResult[];
}

/**
 * Pure-JS fallback implementations for when WASM is unavailable.
 * These provide the same API surface with basic linear algebra.
 */
export class JsMicroLoRA implements Pick<WasmMicroLoRA, 'adapt_array' | 'adapt_count' | 'param_count' | 'forward_array' | 'forward_count' | 'adapt_with_reward' | 'delta_norm' | 'dim' | 'reset' | 'free'> {
  private _dim: number;
  private _alpha: number;
  private _lr: number;
  private _adaptCount = 0n;
  private _forwardCount = 0n;
  private _deltaNorm = 0;
  private _A: Float32Array; // Low-rank A (rank x dim)
  private _B: Float32Array; // Low-rank B (dim x rank)
  private readonly RANK = 2;

  constructor(dim: number, alpha: number, lr: number) {
    this._dim = dim;
    this._alpha = alpha;
    this._lr = lr;
    this._A = new Float32Array(this.RANK * dim);
    this._B = new Float32Array(dim * this.RANK);
    // Xavier initialization
    const scale = Math.sqrt(2 / (dim + this.RANK));
    for (let i = 0; i < this._A.length; i++) this._A[i] = (Math.random() - 0.5) * scale;
    for (let i = 0; i < this._B.length; i++) this._B[i] = (Math.random() - 0.5) * scale;
  }

  adapt_array(gradient: Float32Array): void {
    // Simple gradient update on low-rank matrices
    let norm = 0;
    for (let i = 0; i < Math.min(gradient.length, this._A.length); i++) {
      const delta = -this._lr * gradient[i % gradient.length] * this._alpha;
      this._A[i] += delta;
      norm += delta * delta;
    }
    this._deltaNorm = Math.sqrt(norm);
    this._adaptCount++;
  }

  adapt_count(): bigint { return this._adaptCount; }
  param_count(): number { return this._A.length + this._B.length; }

  forward_array(input: Float32Array): Float32Array {
    const output = new Float32Array(this._dim);
    // y = x + alpha * B @ A @ x  (simplified low-rank)
    for (let i = 0; i < this._dim; i++) {
      output[i] = input[i];
      let sum = 0;
      for (let r = 0; r < this.RANK; r++) {
        let dot = 0;
        for (let j = 0; j < this._dim; j++) {
          dot += this._A[r * this._dim + j] * input[j];
        }
        sum += this._B[i * this.RANK + r] * dot;
      }
      output[i] += this._alpha * sum;
    }
    this._forwardCount++;
    return output;
  }

  forward_count(): bigint { return this._forwardCount; }

  adapt_with_reward(improvement: number): void {
    const scale = improvement * this._lr * this._alpha;
    let norm = 0;
    for (let i = 0; i < this._A.length; i++) {
      const delta = scale * (Math.random() - 0.5);
      this._A[i] += delta;
      norm += delta * delta;
    }
    this._deltaNorm = Math.sqrt(norm);
    this._adaptCount++;
  }

  delta_norm(): number { return this._deltaNorm; }
  dim(): number { return this._dim; }
  reset(): void {
    this._A.fill(0);
    this._B.fill(0);
    this._adaptCount = 0n;
    this._forwardCount = 0n;
    this._deltaNorm = 0;
  }
  free(): void { /* no-op for JS */ }
}

export class JsScopedLoRA implements Pick<WasmScopedLoRA, 'adapt_array' | 'adapt_count' | 'forward_array' | 'forward_count' | 'adapt_with_reward' | 'delta_norm' | 'total_adapt_count' | 'total_forward_count' | 'set_category_fallback' | 'reset_all' | 'reset_scope' | 'free'> {
  private adapters: Map<number, JsMicroLoRA> = new Map();
  private _dim: number;
  private _alpha: number;
  private _lr: number;
  private _fallback = false;

  constructor(dim: number, alpha: number, lr: number) {
    this._dim = dim;
    this._alpha = alpha;
    this._lr = lr;
  }

  private getAdapter(opType: number): JsMicroLoRA {
    if (!this.adapters.has(opType)) {
      if (this._fallback && opType > 0 && this.adapters.has(0)) {
        return this.adapters.get(0)!;
      }
      this.adapters.set(opType, new JsMicroLoRA(this._dim, this._alpha, this._lr));
    }
    return this.adapters.get(opType)!;
  }

  adapt_array(opType: number, gradient: Float32Array): void { this.getAdapter(opType).adapt_array(gradient); }
  adapt_count(opType: number): bigint { return this.getAdapter(opType).adapt_count(); }
  forward_array(opType: number, input: Float32Array): Float32Array { return this.getAdapter(opType).forward_array(input); }
  forward_count(opType: number): bigint { return this.getAdapter(opType).forward_count(); }
  adapt_with_reward(opType: number, improvement: number): void { this.getAdapter(opType).adapt_with_reward(improvement); }
  delta_norm(opType: number): number { return this.getAdapter(opType).delta_norm(); }
  set_category_fallback(enabled: boolean): void { this._fallback = enabled; }

  total_adapt_count(): bigint {
    let total = 0n;
    for (const a of this.adapters.values()) total += a.adapt_count();
    return total;
  }

  total_forward_count(): bigint {
    let total = 0n;
    for (const a of this.adapters.values()) total += a.forward_count();
    return total;
  }

  reset_all(): void { this.adapters.clear(); }
  reset_scope(opType: number): void { this.adapters.delete(opType); }
  free(): void { this.adapters.clear(); }
}

export class JsTrajectoryBuffer implements Pick<WasmTrajectoryBuffer, 'record' | 'is_empty' | 'total_count' | 'success_rate' | 'mean_improvement' | 'best_improvement' | 'high_quality_count' | 'variance' | 'reset' | 'free'> {
  private entries: { improvement: number }[] = [];
  private capacity: number;

  constructor(capacity: number, _dim: number) {
    this.capacity = capacity;
  }

  record(_embedding: Float32Array, _opType: number, _attType: number, executionMs: number, baselineMs: number): void {
    const improvement = baselineMs > 0 ? (baselineMs - executionMs) / baselineMs : 0;
    if (this.entries.length >= this.capacity) this.entries.shift();
    this.entries.push({ improvement });
  }

  is_empty(): boolean { return this.entries.length === 0; }
  total_count(): bigint { return BigInt(this.entries.length); }

  success_rate(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.filter(e => e.improvement > 0).length / this.entries.length;
  }

  mean_improvement(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.reduce((s, e) => s + e.improvement, 0) / this.entries.length;
  }

  best_improvement(): number {
    if (this.entries.length === 0) return 0;
    return Math.max(...this.entries.map(e => e.improvement));
  }

  high_quality_count(threshold: number): number {
    return this.entries.filter(e => e.improvement > threshold).length;
  }

  variance(): number {
    if (this.entries.length < 2) return 0;
    const mean = this.mean_improvement();
    return this.entries.reduce((s, e) => s + (e.improvement - mean) ** 2, 0) / (this.entries.length - 1);
  }

  reset(): void { this.entries = []; }
  free(): void { this.entries = []; }
}

/**
 * Initialize the RuVector training system.
 * Attempts to load @ruvector/learning-wasm for WASM-accelerated training.
 * Falls back to a pure-JS implementation if WASM is unavailable.
 */

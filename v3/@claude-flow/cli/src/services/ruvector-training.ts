/**
 * RuVector Training Service
 * Real WASM-accelerated neural training using @ruvector packages
 *
 * Features:
 * - MicroLoRA: <1µs adaptation with rank-2 LoRA (2.3M ops/s)
 * - SONA: Self-Optimizing Neural Architecture (624k learn/s, 60k search/s)
 * - Flash Attention: Flash Attention speedup (unverified)
 * - Trajectory Buffer: Learning from success/failure
 * - Contrastive Learning: InfoNCE loss
 *
 * Backward Compatible: All v1 APIs preserved, SONA adds new capabilities
 *
 * Created with ❤️ by ruv.io
 */

import type {
  WasmMicroLoRA,
  WasmScopedLoRA,
  WasmTrajectoryBuffer,
} from '@ruvector/learning-wasm';

// @ruvector/attention types — use any since the NAPI exports vary across versions
type FlashAttention = any;
type MoEAttention = any;
type HyperbolicAttention = any;
type AdamWOptimizer = any;
type InfoNceLoss = any;
type CurriculumScheduler = any;
type HardNegativeMiner = any;
type BenchmarkResult = any;

// SONA Engine type (from @ruvector/sona)
interface SonaEngineInstance {
  forceLearn(embedding: Float32Array, reward: number): void;
  findPatterns(embedding: number[], k: number): unknown[];
  tick(): void;
  getStats(): string;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  flush(): void;
}


/**
 * ESM/CJS interop helper — handles `.default` for CJS modules.
 * Uses `'default' in mod` check which is safer than `mod.default || mod`.
 */
async function importWithInterop<T = any>(packageName: string): Promise<T> {
  const mod = await import(packageName);
  return ('default' in mod) ? (mod as any).default : mod;
}
// Lazy-loaded WASM modules
let microLoRA: WasmMicroLoRA | null = null;
let scopedLoRA: WasmScopedLoRA | null = null;
let trajectoryBuffer: WasmTrajectoryBuffer | null = null;
let flashAttention: FlashAttention | null = null;
let moeAttention: MoEAttention | null = null;
let hyperbolicAttention: HyperbolicAttention | null = null;
let optimizer: AdamWOptimizer | null = null;
let contrastiveLoss: InfoNceLoss | null = null;
let curriculum: CurriculumScheduler | null = null;
let hardMiner: HardNegativeMiner | null = null;

// SONA engine (optional enhancement)
let sonaEngine: SonaEngineInstance | null = null;
let sonaAvailable = false;

// Training state
let initialized = false;
let totalAdaptations = 0;
let totalForwards = 0;
let totalSonaLearns = 0;
let totalSonaSearches = 0;
let lastBenchmark: BenchmarkResult[] | null = null;

// Backend tracking
let activeBackend: 'wasm' | 'js-fallback' = 'js-fallback';

/**
 * Get which backend is active for training
 */
export function getActiveBackend(): 'wasm' | 'js-fallback' {
  return activeBackend;
}


// TrainingConfig/TrainingResult and the pure-JS fallback classes were
// extracted into ./ruvector-training-fallbacks.ts during campaign-2
// wave 13 (W219). The 18 mutable lazy-WASM let-bindings stay here with
// every reader/writer (TS2540 discipline).
export type { TrainingConfig, TrainingResult } from './ruvector-training-fallbacks.js';
import {
  JsMicroLoRA,
  JsScopedLoRA,
  JsTrajectoryBuffer,
} from './ruvector-training-fallbacks.js';
import type { TrainingConfig } from './ruvector-training-fallbacks.js';

export async function initializeTraining(config: TrainingConfig = {}): Promise<{
  success: boolean;
  features: string[];
  backend: 'wasm' | 'js-fallback';
  error?: string;
}> {
  const features: string[] = [];
  const dim = Math.min(config.dim || 256, 256); // Max 256 for WASM
  const lr = config.learningRate || 0.01;
  const alpha = config.alpha || 0.1;

  // --- Attempt WASM backend first ---
  // `activeBackend = 'wasm'` is the live success signal — the legacy
  // wasmLoaded flag was used by an earlier render path that branched on
  // it; activeBackend serves the same purpose now.
  try {
    const fs = await import('fs');
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    const wasmPath = require.resolve('@ruvector/learning-wasm/ruvector_learning_wasm_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);

    const learningWasm = await import('@ruvector/learning-wasm');
    learningWasm.initSync({ module: wasmBuffer });

    microLoRA = new learningWasm.WasmMicroLoRA(dim, alpha, lr);
    features.push(`MicroLoRA/WASM (${dim}-dim, <1μs adaptation)`);

    scopedLoRA = new learningWasm.WasmScopedLoRA(dim, alpha, lr);
    scopedLoRA.set_category_fallback(true);
    features.push('ScopedLoRA/WASM (17 operators)');

    trajectoryBuffer = new learningWasm.WasmTrajectoryBuffer(
      config.trajectoryCapacity || 10000,
      dim
    );
    features.push('TrajectoryBuffer/WASM');

    activeBackend = 'wasm';
  } catch (wasmError) {
    // WASM not available - fall back to JS implementation
    const reason = wasmError instanceof Error ? wasmError.message : String(wasmError);
    console.warn(`[ruvector] WASM backend unavailable (${reason}), using JS fallback`);

    microLoRA = new JsMicroLoRA(dim, alpha, lr) as unknown as WasmMicroLoRA;
    features.push(`MicroLoRA/JS (${dim}-dim, JS fallback)`);

    scopedLoRA = new JsScopedLoRA(dim, alpha, lr) as unknown as WasmScopedLoRA;
    (scopedLoRA as any).set_category_fallback(true);
    features.push('ScopedLoRA/JS (17 operators)');

    trajectoryBuffer = new JsTrajectoryBuffer(
      config.trajectoryCapacity || 10000,
      dim
    ) as unknown as WasmTrajectoryBuffer;
    features.push('TrajectoryBuffer/JS');

    activeBackend = 'js-fallback';
  }

  // --- Attention mechanisms (optional, independent of WASM) ---
  try {
    const attention: any = await importWithInterop('@ruvector/attention');

    if (config.useFlashAttention !== false) {
      flashAttention = new attention.FlashAttention(dim, 64);
      features.push('FlashAttention');
    }

    if (config.useMoE) {
      moeAttention = attention.MoEAttention.simple(dim, 8, 2);
      features.push('MoE (8 experts, top-2)');
    }

    if (config.useHyperbolic) {
      hyperbolicAttention = new attention.HyperbolicAttention(dim, 1.0);
      features.push('HyperbolicAttention');
    }

    optimizer = new attention.AdamWOptimizer(lr, 0.9, 0.999, 1e-8, 0.01);
    features.push('AdamW Optimizer');

    contrastiveLoss = new attention.InfoNceLoss(0.07);
    features.push('InfoNCE Loss');

    if (config.totalSteps) {
      curriculum = new attention.CurriculumScheduler(
        config.totalSteps,
        config.warmupSteps || Math.floor(config.totalSteps * 0.1)
      );
      features.push('Curriculum Learning');
    }

    try {
      hardMiner = new attention.HardNegativeMiner(5, 'semi_hard');
      features.push('Hard Negative Mining');
    } catch {
      // Mining not available, continue without it
    }
  } catch (attentionError) {
    // @ruvector/attention not available - attention features skipped
    const reason = attentionError instanceof Error ? attentionError.message : String(attentionError);
    console.warn(`[ruvector] @ruvector/attention unavailable (${reason}), attention features disabled`);
  }

  // --- SONA (optional, backward compatible) ---
  if (config.useSona !== false) {
    try {
      const sona = await importWithInterop('@ruvector/sona');
      const sonaRank = config.sonaRank || 4;
      sonaEngine = new sona.SonaEngine(dim, sonaRank, alpha, lr) as SonaEngineInstance;
      sonaAvailable = true;
      features.push(`SONA (${dim}-dim, rank-${sonaRank}, 624k learn/s)`);
    } catch (sonaError) {
      sonaAvailable = false;
      if (config.useSona === true) {
        console.warn('SONA requested but not available:', sonaError);
      }
    }
  }

  initialized = true;
  return { success: true, features, backend: activeBackend };
}

/**
 * Operator types for scoped LoRA (0-16)
 */
export const OperatorType = {
  GENERAL: 0,
  ATTENTION: 1,
  MLP: 2,
  EMBEDDING: 3,
  NORMALIZATION: 4,
  PROJECTION: 5,
  POOLING: 6,
  CONVOLUTION: 7,
  RECURRENT: 8,
  ROUTING: 9,
  MEMORY: 10,
  REASONING: 11,
  COORDINATION: 12,
  OPTIMIZATION: 13,
  SECURITY: 14,
  TESTING: 15,
  DEBUGGING: 16,
} as const;

/**
 * Train a pattern with MicroLoRA
 */
export async function trainPattern(
  embedding: Float32Array,
  gradient: Float32Array,
  operatorType?: number
): Promise<{ deltaNorm: number; adaptCount: bigint }> {
  if (!initialized || !microLoRA) {
    throw new Error('Training system not initialized');
  }

  // Use scoped LoRA if operator type specified
  if (operatorType !== undefined && scopedLoRA) {
    scopedLoRA.adapt_array(operatorType, gradient);
    return {
      deltaNorm: scopedLoRA.delta_norm(operatorType),
      adaptCount: scopedLoRA.adapt_count(operatorType),
    };
  }

  // Standard MicroLoRA adaptation
  microLoRA.adapt_array(gradient);
  totalAdaptations++;

  return {
    deltaNorm: microLoRA.delta_norm(),
    adaptCount: microLoRA.adapt_count(),
  };
}

/**
 * Forward pass through LoRA
 */
export function forward(
  input: Float32Array,
  operatorType?: number
): Float32Array {
  if (!initialized || !microLoRA) {
    throw new Error('Training system not initialized');
  }

  totalForwards++;

  if (operatorType !== undefined && scopedLoRA) {
    return scopedLoRA.forward_array(operatorType, input);
  }

  return microLoRA.forward_array(input);
}

/**
 * Reward-based adaptation (reinforcement learning)
 */
export function adaptWithReward(
  improvement: number,
  operatorType?: number
): void {
  if (!initialized) {
    throw new Error('Training system not initialized');
  }

  if (operatorType !== undefined && scopedLoRA) {
    scopedLoRA.adapt_with_reward(operatorType, improvement);
  } else if (microLoRA) {
    microLoRA.adapt_with_reward(improvement);
  }

  totalAdaptations++;
}

/**
 * Record a learning trajectory
 */
export function recordTrajectory(
  embedding: Float32Array,
  operatorType: number,
  attentionType: number,
  executionMs: number,
  baselineMs: number
): void {
  if (!trajectoryBuffer) {
    throw new Error('Trajectory buffer not initialized');
  }

  trajectoryBuffer.record(
    embedding,
    operatorType,
    attentionType,
    executionMs,
    baselineMs
  );
}

/**
 * Get trajectory statistics
 */
export function getTrajectoryStats(): {
  successRate: number;
  meanImprovement: number;
  bestImprovement: number;
  totalCount: bigint;
  highQualityCount: number;
  variance: number;
} | null {
  if (!trajectoryBuffer || trajectoryBuffer.is_empty()) {
    return null;
  }

  return {
    successRate: trajectoryBuffer.success_rate(),
    meanImprovement: trajectoryBuffer.mean_improvement(),
    bestImprovement: trajectoryBuffer.best_improvement(),
    totalCount: trajectoryBuffer.total_count(),
    highQualityCount: trajectoryBuffer.high_quality_count(0.1),
    variance: trajectoryBuffer.variance(),
  };
}

/**
 * Compute attention with Flash Attention (Flash Attention (unverified))
 */
export function computeFlashAttention(
  query: Float32Array,
  keys: Float32Array[],
  values: Float32Array[]
): Float32Array {
  if (!flashAttention) {
    throw new Error('Flash attention not initialized');
  }

  return flashAttention.computeRaw(query, keys, values);
}

/**
 * Compute MoE routing
 */
export function computeMoEAttention(
  query: Float32Array,
  keys: Float32Array[],
  values: Float32Array[]
): Float32Array {
  if (!moeAttention) {
    throw new Error('MoE attention not initialized');
  }

  return moeAttention.computeRaw(query, keys, values);
}

/**
 * Compute hyperbolic attention (for hierarchical patterns)
 */
export function computeHyperbolicAttention(
  query: Float32Array,
  keys: Float32Array[],
  values: Float32Array[]
): Float32Array {
  if (!hyperbolicAttention) {
    throw new Error('Hyperbolic attention not initialized');
  }

  return hyperbolicAttention.computeRaw(query, keys, values);
}

/**
 * Compute contrastive loss for training
 */
export function computeContrastiveLoss(
  anchor: Float32Array,
  positives: Float32Array[],
  negatives: Float32Array[]
): { loss: number; gradient: Float32Array } {
  if (!contrastiveLoss) {
    throw new Error('Contrastive loss not initialized');
  }

  const loss = contrastiveLoss.compute(anchor, positives, negatives);
  const gradient = contrastiveLoss.backward(anchor, positives, negatives);

  return { loss, gradient };
}

/**
 * Optimizer step
 */
export function optimizerStep(
  params: Float32Array,
  gradients: Float32Array
): Float32Array {
  if (!optimizer) {
    throw new Error('Optimizer not initialized');
  }

  return optimizer.step(params, gradients);
}

/**
 * Get curriculum difficulty for current step
 */
export function getCurriculumDifficulty(step: number): number {
  if (!curriculum) {
    return 1.0; // Full difficulty if no curriculum
  }

  return curriculum.getDifficulty(step);
}

/**
 * Mine hard negatives for better training
 */
export function mineHardNegatives(
  anchor: Float32Array,
  candidates: Float32Array[]
): number[] {
  if (!hardMiner) {
    throw new Error('Hard negative miner not initialized');
  }

  return hardMiner.mine(anchor, candidates);
}

/**
 * Benchmark the training system
 */
export async function benchmarkTraining(
  dim?: number,
  iterations?: number
): Promise<BenchmarkResult[]> {
  const attention: any = await importWithInterop('@ruvector/attention');
  lastBenchmark = attention.benchmarkAttention(dim || 256, 100, iterations || 1000);
  return lastBenchmark ?? [];
}

// ============================================
// SONA Functions (v2 enhancement, optional)
// ============================================

/**
 * Check if SONA is available
 */
export function isSonaAvailable(): boolean {
  return sonaAvailable && sonaEngine !== null;
}

/**
 * Force-learn a pattern with SONA (1.6μs, 624k ops/s)
 * This is a one-shot learning mechanism for immediate pattern storage
 */
export function sonaForceLearn(
  embedding: Float32Array,
  reward: number
): void {
  if (!sonaEngine) {
    throw new Error('SONA not initialized. Call initializeTraining with useSona: true');
  }

  sonaEngine.forceLearn(embedding, reward);
  totalSonaLearns++;
}

/**
 * Search for similar patterns with SONA (16.7μs, 60k searches/s)
 * Returns the k most similar patterns from the pattern bank
 */
export function sonaFindPatterns(
  embedding: Float32Array,
  k: number = 5
): unknown[] {
  if (!sonaEngine) {
    throw new Error('SONA not initialized. Call initializeTraining with useSona: true');
  }

  // SONA requires Array, not Float32Array
  const embeddingArray = Array.from(embedding);
  totalSonaSearches++;
  return sonaEngine.findPatterns(embeddingArray, k);
}

/**
 * Process SONA background tasks (0.13μs, 7.5M ticks/s)
 * Call periodically to process background learning and consolidation
 */
export function sonaTick(): void {
  if (!sonaEngine) {
    return; // Silent no-op if SONA not available
  }

  sonaEngine.tick();
}

/**
 * Get SONA statistics
 */
export function getSonaStats(): {
  available: boolean;
  enabled: boolean;
  stats: Record<string, unknown> | null;
  totalLearns: number;
  totalSearches: number;
} {
  if (!sonaEngine) {
    return {
      available: false,
      enabled: false,
      stats: null,
      totalLearns: totalSonaLearns,
      totalSearches: totalSonaSearches,
    };
  }

  try {
    const statsJson = sonaEngine.getStats();
    const stats = JSON.parse(statsJson);
    return {
      available: true,
      enabled: sonaEngine.isEnabled(),
      stats,
      totalLearns: totalSonaLearns,
      totalSearches: totalSonaSearches,
    };
  } catch {
    return {
      available: true,
      enabled: false,
      stats: null,
      totalLearns: totalSonaLearns,
      totalSearches: totalSonaSearches,
    };
  }
}

/**
 * Enable/disable SONA learning
 */
export function setSonaEnabled(enabled: boolean): void {
  if (!sonaEngine) {
    return;
  }

  sonaEngine.setEnabled(enabled);
}

/**
 * Flush SONA buffers (persist any pending patterns)
 */
export function sonaFlush(): void {
  if (!sonaEngine) {
    return;
  }

  sonaEngine.flush();
}

/**
 * Get training statistics
 */
export function getTrainingStats(): {
  initialized: boolean;
  backend: 'wasm' | 'js-fallback';
  totalAdaptations: number;
  totalForwards: number;
  microLoraStats?: {
    paramCount: number;
    adaptCount: bigint;
    forwardCount: bigint;
    deltaNorm: number;
  };
  scopedLoraStats?: {
    totalAdaptCount: bigint;
    totalForwardCount: bigint;
  };
  trajectoryStats?: ReturnType<typeof getTrajectoryStats>;
  sonaStats?: ReturnType<typeof getSonaStats>;
  lastBenchmark?: BenchmarkResult[];
} {
  const stats: ReturnType<typeof getTrainingStats> = {
    initialized,
    backend: activeBackend,
    totalAdaptations,
    totalForwards,
  };

  if (microLoRA) {
    stats.microLoraStats = {
      paramCount: microLoRA.param_count(),
      adaptCount: microLoRA.adapt_count(),
      forwardCount: microLoRA.forward_count(),
      deltaNorm: microLoRA.delta_norm(),
    };
  }

  if (scopedLoRA) {
    stats.scopedLoraStats = {
      totalAdaptCount: scopedLoRA.total_adapt_count(),
      totalForwardCount: scopedLoRA.total_forward_count(),
    };
  }

  if (trajectoryBuffer && !trajectoryBuffer.is_empty()) {
    stats.trajectoryStats = getTrajectoryStats();
  }

  // Include SONA stats if available
  if (sonaAvailable) {
    stats.sonaStats = getSonaStats();
  }

  if (lastBenchmark) {
    stats.lastBenchmark = lastBenchmark;
  }

  return stats;
}

/**
 * Reset the training system
 */
export function resetTraining(): void {
  if (microLoRA) microLoRA.reset();
  if (scopedLoRA) scopedLoRA.reset_all();
  if (trajectoryBuffer) trajectoryBuffer.reset();

  // Reset SONA stats (engine doesn't have reset, just flush)
  if (sonaEngine) {
    sonaEngine.flush();
  }

  totalAdaptations = 0;
  totalForwards = 0;
  totalSonaLearns = 0;
  totalSonaSearches = 0;
  activeBackend = 'js-fallback';
}

/**
 * Export trained weights
 */
export function exportWeights(): {
  dim: number;
  deltaNorm: number;
  adaptCount: bigint;
  trajectoryStats: ReturnType<typeof getTrajectoryStats>;
} | null {
  if (!initialized || !microLoRA) {
    return null;
  }

  return {
    dim: microLoRA.dim(),
    deltaNorm: microLoRA.delta_norm(),
    adaptCount: microLoRA.adapt_count(),
    trajectoryStats: getTrajectoryStats(),
  };
}

/**
 * Cleanup resources
 */
export function cleanup(): void {
  if (microLoRA) {
    microLoRA.free();
    microLoRA = null;
  }
  if (scopedLoRA) {
    scopedLoRA.free();
    scopedLoRA = null;
  }
  if (trajectoryBuffer) {
    trajectoryBuffer.free();
    trajectoryBuffer = null;
  }

  // Cleanup SONA
  if (sonaEngine) {
    sonaEngine.flush();
    sonaEngine = null;
    sonaAvailable = false;
  }

  flashAttention = null;
  moeAttention = null;
  hyperbolicAttention = null;
  optimizer = null;
  contrastiveLoss = null;
  curriculum = null;
  hardMiner = null;

  initialized = false;
  totalAdaptations = 0;
  totalForwards = 0;
  totalSonaLearns = 0;
  totalSonaSearches = 0;
  lastBenchmark = null;
}

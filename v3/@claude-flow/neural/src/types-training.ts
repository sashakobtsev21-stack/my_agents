/**
 * Neural types — extended
 *
 * Extracted verbatim during campaign-2 wave W302. Barrel stays.
 */
import type {
  Pattern,
  PatternMatch,
  SONAMode,
  SONAModeConfig,
} from './types-core.js';

// ============================================================================
// RL Algorithm Types
// ============================================================================

/**
 * Supported RL algorithms
 */
export type RLAlgorithm =
  | 'ppo'
  | 'dqn'
  | 'a2c'
  | 'decision-transformer'
  | 'q-learning'
  | 'sarsa'
  | 'curiosity';

/**
 * Base RL algorithm configuration
 */
export interface RLConfig {
  /** Algorithm identifier */
  algorithm: RLAlgorithm;

  /** Learning rate */
  learningRate: number;

  /** Discount factor (gamma) */
  gamma: number;

  /** Entropy coefficient */
  entropyCoef: number;

  /** Value loss coefficient */
  valueLossCoef: number;

  /** Maximum gradient norm */
  maxGradNorm: number;

  /** Number of epochs per update */
  epochs: number;

  /** Mini-batch size */
  miniBatchSize: number;
}

/**
 * PPO-specific configuration
 */
export interface PPOConfig extends RLConfig {
  algorithm: 'ppo';

  /** Clip range for policy */
  clipRange: number;

  /** Clip range for value function */
  clipRangeVf: number | null;

  /** Target KL divergence */
  targetKL: number;

  /** GAE lambda */
  gaeLambda: number;
}

/**
 * DQN-specific configuration
 */
export interface DQNConfig extends RLConfig {
  algorithm: 'dqn';

  /** Replay buffer size */
  bufferSize: number;

  /** Initial exploration rate */
  explorationInitial: number;

  /** Final exploration rate */
  explorationFinal: number;

  /** Exploration decay steps */
  explorationDecay: number;

  /** Target network update frequency */
  targetUpdateFreq: number;

  /** Use double DQN */
  doubleDQN: boolean;

  /** Use dueling network */
  duelingNetwork: boolean;
}

/**
 * Decision Transformer configuration
 */
export interface DecisionTransformerConfig extends RLConfig {
  algorithm: 'decision-transformer';

  /** Context length */
  contextLength: number;

  /** Number of attention heads */
  numHeads: number;

  /** Number of transformer layers */
  numLayers: number;

  /** Hidden dimension */
  hiddenDim: number;

  /** Embedding dimension */
  embeddingDim: number;

  /** Dropout rate */
  dropout: number;
}

/**
 * Curiosity-driven exploration configuration
 */
export interface CuriosityConfig extends RLConfig {
  algorithm: 'curiosity';

  /** Intrinsic reward coefficient */
  intrinsicCoef: number;

  /** Forward model learning rate */
  forwardLR: number;

  /** Inverse model learning rate */
  inverseLR: number;

  /** Feature dimension */
  featureDim: number;

  /** Use random network distillation */
  useRND: boolean;
}

// ============================================================================
// LoRA Types
// ============================================================================

/**
 * LoRA adapter configuration
 */
export interface LoRAConfig {
  /** Adapter rank (1, 2, 4, 8, 16) */
  rank: number;

  /** Alpha scaling factor */
  alpha: number;

  /** Dropout rate */
  dropout: number;

  /** Target modules to adapt */
  targetModules: string[];

  /** Use micro-LoRA (optimized for speed) */
  microLoRA: boolean;
}

/**
 * LoRA adapter weights
 */
export interface LoRAWeights {
  /** Adapter identifier */
  adapterId: string;

  /** A matrices (down projection) */
  A: Map<string, Float32Array>;

  /** B matrices (up projection) */
  B: Map<string, Float32Array>;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Training iterations */
  iterations: number;

  /** Associated domain */
  domain?: string;
}

// ============================================================================
// EWC Types (Elastic Weight Consolidation)
// ============================================================================

/**
 * EWC++ configuration for continual learning
 */
export interface EWCConfig {
  /** Lambda (importance weight) */
  lambda: number;

  /** Decay rate for old Fisher information */
  decay: number;

  /** Number of samples for Fisher estimation */
  fisherSamples: number;

  /** Minimum Fisher value (for stability) */
  minFisher: number;

  /** Use online EWC (EWC++) */
  online: boolean;
}

/**
 * EWC state for a parameter set
 */
export interface EWCState {
  /** Parameter means (optimal values) */
  means: Map<string, Float32Array>;

  /** Fisher information (importance weights) */
  fisher: Map<string, Float32Array>;

  /** Number of tasks learned */
  taskCount: number;

  /** Last consolidation timestamp */
  lastConsolidation: number;
}

// ============================================================================
// Neural System Statistics
// ============================================================================

/**
 * Statistics for the neural/learning system
 */
export interface NeuralStats {
  /** Trajectory statistics */
  trajectories: {
    total: number;
    active: number;
    completed: number;
    utilization: number;
  };

  /** Performance metrics */
  performance: {
    avgQualityScore: number;
    opsPerSecond: number;
    learningCycles: number;
    avgLatencyMs: number;
  };

  /** Pattern statistics */
  patterns: {
    totalPatterns: number;
    avgMatchTime: number;
    cacheHitRate: number;
    evolutionCount: number;
  };

  /** Memory usage */
  memory: {
    usedMb: number;
    budgetMb: number;
    trajectoryBytes: number;
    patternBytes: number;
  };

  /** Current configuration */
  config: {
    mode: SONAMode;
    loraRank: number;
    learningRate: number;
    algorithm: RLAlgorithm;
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Neural system events for monitoring and hooks
 */
export type NeuralEvent =
  | { type: 'trajectory_started'; trajectoryId: string; context: string }
  | { type: 'trajectory_completed'; trajectoryId: string; qualityScore: number }
  | { type: 'pattern_matched'; patternId: string; similarity: number }
  | { type: 'pattern_evolved'; patternId: string; evolutionType: string }
  | { type: 'learning_triggered'; reason: string; trajectoryCount: number }
  | { type: 'learning_completed'; improvementDelta: number }
  | { type: 'mode_changed'; fromMode: SONAMode; toMode: SONAMode }
  | { type: 'memory_consolidated'; memoriesCount: number };

/**
 * Event listener type
 */
export type NeuralEventListener = (event: NeuralEvent) => void | Promise<void>;

// ============================================================================
// Module Exports
// ============================================================================

export type {
  SONAMode as LearningMode,
  SONAModeConfig as ModeConfig,
  Pattern as LearnedPattern,
  PatternMatch as PatternSearchResult,
};

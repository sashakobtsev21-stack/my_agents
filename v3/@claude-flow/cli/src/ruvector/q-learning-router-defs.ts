/**
 * Q-Learning Router — types, tuning constants & feature tables
 *
 * The config/decision shapes, the private Q-table/experience/cache/
 * persistence records, and the encoder/route/keyword tables. Extracted
 * verbatim from q-learning-router.ts (lines 25-206) during campaign-2
 * wave 18 (W224). q-learning-router.ts re-exports ONLY the two
 * originally-public types.
 */

export interface QLearningRouterConfig {
  /** Learning rate (default: 0.1) */
  learningRate: number;
  /** Discount factor (default: 0.99) */
  gamma: number;
  /** Initial exploration rate (default: 1.0) */
  explorationInitial: number;
  /** Final exploration rate (default: 0.01) */
  explorationFinal: number;
  /** Exploration decay steps (default: 10000) */
  explorationDecay: number;
  /** Exploration decay type (default: 'exponential') */
  explorationDecayType: 'linear' | 'exponential' | 'cosine';
  /** Maximum states in Q-table (default: 10000) */
  maxStates: number;
  /** Number of actions/routes (default: 8) */
  numActions: number;
  /** Experience replay buffer size (default: 1000) */
  replayBufferSize: number;
  /** Mini-batch size for replay (default: 32) */
  replayBatchSize: number;
  /** Enable experience replay (default: true) */
  enableReplay: boolean;
  /** Route cache size (default: 256) */
  cacheSize: number;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTTL: number;
  /** Model persistence path (default: '.swarm/q-learning-model.json') */
  modelPath: string;
  /** Auto-save interval in updates (default: 100) */
  autoSaveInterval: number;
  /** State space dimensionality for feature hashing (default: 64) */
  stateSpaceDim: number;
}

/**
 * Route decision result
 */
export interface RouteDecision {
  /** Selected route/action */
  route: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Q-values for all routes */
  qValues: number[];
  /** Was exploration used */
  explored: boolean;
  /** Route alternatives */
  alternatives: Array<{ route: string; score: number }>;
}

/**
 * Q-table entry
 */
export interface QEntry {
  qValues: Float32Array;
  visits: number;
  lastUpdate: number;
  /** Eligibility trace for TD(lambda) */
  eligibility?: Float32Array;
}

/**
 * Experience tuple for replay buffer
 */
export interface Experience {
  stateKey: string;
  actionIdx: number;
  reward: number;
  nextStateKey: string | null;
  timestamp: number;
  priority: number;
}

/**
 * Cache entry for route decisions
 */
export interface CacheEntry {
  decision: RouteDecision;
  timestamp: number;
  hits: number;
}

/**
 * Persisted model structure
 */
export interface PersistedModel {
  version: string;
  /**
   * State-key encoder version. v1 was the 31-bit truncating fold that
   * silently discarded the keyword block (features 0–31). v2 is a lossless
   * 32-bit FNV-1a fold over the full quantized vector. See #2239.
   *
   * On version mismatch, the qTable is reset (keys are computed with the old
   * encoder and would never be matched by new lookups); stats/epsilon are kept.
   */
  encoderVersion?: number;
  config: Partial<QLearningRouterConfig>;
  qTable: Record<string, { qValues: number[]; visits: number }>;
  stats: {
    stepCount: number;
    updateCount: number;
    avgTDError: number;
    epsilon: number;
  };
  metadata: {
    savedAt: string;
    totalExperiences: number;
  };
}

/** Current state-key encoder version (see PersistedModel.encoderVersion). */
export const ENCODER_VERSION = 2;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: QLearningRouterConfig = {
  learningRate: 0.1,
  gamma: 0.99,
  explorationInitial: 1.0,
  explorationFinal: 0.01,
  explorationDecay: 10000,
  explorationDecayType: 'exponential',
  maxStates: 10000,
  numActions: 8,
  replayBufferSize: 1000,
  replayBatchSize: 32,
  enableReplay: true,
  cacheSize: 256,
  cacheTTL: 300000,
  modelPath: '.swarm/q-learning-model.json',
  autoSaveInterval: 100,
  stateSpaceDim: 64,
};

/**
 * Route names mapping
 */
export const ROUTE_NAMES = [
  'coder',
  'tester',
  'reviewer',
  'architect',
  'researcher',
  'optimizer',
  'debugger',
  'documenter',
];

/**
 * Task feature keywords for state representation
 */
export const FEATURE_KEYWORDS = [
  // Code-related
  'implement', 'code', 'write', 'create', 'build', 'develop',
  // Testing-related
  'test', 'spec', 'coverage', 'unit', 'integration', 'e2e',
  // Review-related
  'review', 'check', 'audit', 'analyze', 'inspect',
  // Architecture-related
  'architect', 'design', 'structure', 'pattern', 'system',
  // Research-related
  'research', 'investigate', 'explore', 'find', 'search',
  // Optimization-related
  'optimize', 'performance', 'speed', 'memory', 'improve',
  // Debug-related
  'debug', 'fix', 'bug', 'error', 'issue', 'problem',
  // Documentation-related
  'document', 'docs', 'readme', 'comment', 'explain',
];

/**
 * Q-Learning Router for intelligent task routing
 *
 * Optimized with:
 * - LRU cache for repeated task patterns
 * - Feature hashing for efficient state space
 * - Exponential epsilon decay
 * - Prioritized experience replay
 * - Model persistence
 */

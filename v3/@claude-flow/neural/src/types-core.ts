/**
 * Neural types — core
 *
 * Extracted verbatim during campaign-2 wave W302. Barrel stays.
 */

// ============================================================================
// SONA Learning Mode Types
// ============================================================================

/**
 * Available SONA learning modes with their characteristics
 */
export type SONAMode = 'real-time' | 'balanced' | 'research' | 'edge' | 'batch';

/**
 * Configuration for each SONA mode
 */
export interface SONAModeConfig {
  /** Mode identifier */
  mode: SONAMode;

  /** LoRA rank (1-16, higher = more expressive but slower) */
  loraRank: number;

  /** Learning rate (0.001-0.01, sweet spot is 0.002) */
  learningRate: number;

  /** Batch size for updates */
  batchSize: number;

  /** Maximum trajectory capacity */
  trajectoryCapacity: number;

  /** Number of pattern clusters */
  patternClusters: number;

  /** Quality threshold (0-1) for accepting patterns */
  qualityThreshold: number;

  /** Maximum latency allowed in milliseconds */
  maxLatencyMs: number;

  /** Memory budget in MB */
  memoryBudgetMb: number;

  /** EWC lambda for catastrophic forgetting prevention */
  ewcLambda: number;
}

/**
 * Mode-specific optimizations
 */
export interface ModeOptimizations {
  /** Enable SIMD vectorization */
  enableSIMD: boolean;

  /** Use micro-LoRA (reduced parameter count) */
  useMicroLoRA: boolean;

  /** Enable gradient checkpointing */
  gradientCheckpointing: boolean;

  /** Use half-precision (FP16) */
  useHalfPrecision: boolean;

  /** Enable pattern caching */
  patternCaching: boolean;

  /** Async learning updates */
  asyncUpdates: boolean;
}

// ============================================================================
// Trajectory Types (ReasoningBank)
// ============================================================================

/**
 * A single step in a reasoning trajectory
 */
export interface TrajectoryStep {
  /** Unique step identifier */
  stepId: string;

  /** Timestamp of the step */
  timestamp: number;

  /** Action taken */
  action: string;

  /** State before action (embedding) */
  stateBefore: Float32Array;

  /** State after action (embedding) */
  stateAfter: Float32Array;

  /** Reward/quality signal (0-1) */
  reward: number;

  /** Attention weights from model */
  attentionWeights?: Float32Array;

  /** Layer activations (optional) */
  layerActivations?: Float32Array[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete reasoning trajectory
 */
export interface Trajectory {
  /** Unique trajectory identifier */
  trajectoryId: string;

  /** Task context/description */
  context: string;

  /** Domain classification */
  domain: 'code' | 'creative' | 'reasoning' | 'chat' | 'math' | 'general';

  /** Sequence of steps */
  steps: TrajectoryStep[];

  /** Overall quality score (0-1) */
  qualityScore: number;

  /** Whether trajectory is complete */
  isComplete: boolean;

  /** Start timestamp */
  startTime: number;

  /** End timestamp (if complete) */
  endTime?: number;

  /** Verdict from judgment */
  verdict?: TrajectoryVerdict;

  /** Distilled memory (if processed) */
  distilledMemory?: DistilledMemory;
}

/**
 * Verdict from trajectory judgment
 */
export interface TrajectoryVerdict {
  /** Whether trajectory was successful */
  success: boolean;

  /** Confidence in the verdict (0-1) */
  confidence: number;

  /** Identified strengths */
  strengths: string[];

  /** Identified weaknesses */
  weaknesses: string[];

  /** Suggested improvements */
  improvements: string[];

  /** Relevance score for similar tasks */
  relevanceScore: number;
}

/**
 * Distilled memory from trajectory
 */
export interface DistilledMemory {
  /** Unique memory identifier */
  memoryId: string;

  /** Source trajectory ID */
  trajectoryId: string;

  /** Extracted strategy pattern */
  strategy: string;

  /** Key learnings */
  keyLearnings: string[];

  /** Embedding for similarity search */
  embedding: Float32Array;

  /** Quality score */
  quality: number;

  /** Usage count */
  usageCount: number;

  /** Last used timestamp */
  lastUsed: number;
}

// ============================================================================
// Pattern Learning Types
// ============================================================================

/**
 * A learned pattern from experience
 */
export interface Pattern {
  /** Unique pattern identifier */
  patternId: string;

  /** Pattern name/description */
  name: string;

  /** Domain this pattern applies to */
  domain: string;

  /** Pattern embedding for similarity */
  embedding: Float32Array;

  /** Strategy this pattern represents */
  strategy: string;

  /** Success rate when applying this pattern */
  successRate: number;

  /** Number of times pattern was used */
  usageCount: number;

  /** Quality scores from applications */
  qualityHistory: number[];

  /** Evolution history */
  evolutionHistory: PatternEvolution[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Pattern evolution record
 */
export interface PatternEvolution {
  /** When evolution occurred */
  timestamp: number;

  /** Type of evolution */
  type: 'improvement' | 'merge' | 'split' | 'prune';

  /** Previous quality */
  previousQuality: number;

  /** New quality */
  newQuality: number;

  /** Description of change */
  description: string;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Matched pattern */
  pattern: Pattern;

  /** Similarity score (0-1) */
  similarity: number;

  /** Confidence in match */
  confidence: number;

  /** Retrieval latency in ms */
  latencyMs: number;
}


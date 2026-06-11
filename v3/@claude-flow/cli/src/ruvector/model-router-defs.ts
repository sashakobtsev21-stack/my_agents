/**
 * Model Router — capabilities, bandit defs & sampling helpers
 *
 * The model/complexity tables, config/result/analysis shapes, the
 * Thompson-sampling Beta/Gamma math, and the prior factories. Extracted
 * verbatim from model-router.ts (lines 25-323) during campaign-2 wave 10
 * (W216). model-router.ts re-exports ONLY the eight originally-public
 * names; the bandit internals stay unexported from the barrel.
 */

// ============================================================================
// Types & Constants
// ============================================================================

/**
 * Available Claude models for routing
 */
export type ClaudeModel = 'haiku' | 'sonnet' | 'opus' | 'inherit';

/**
 * Model capabilities and characteristics
 */
export const MODEL_CAPABILITIES: Record<ClaudeModel, {
  maxComplexity: number;
  costMultiplier: number;
  speedMultiplier: number;
  description: string;
}> = {
  haiku: {
    maxComplexity: 0.4,
    costMultiplier: 0.04,  // ~25x cheaper than Opus
    speedMultiplier: 3.0,   // ~3x faster than Sonnet
    description: 'Fast, cost-effective for simple tasks',
  },
  sonnet: {
    maxComplexity: 0.7,
    costMultiplier: 0.2,    // ~5x cheaper than Opus
    speedMultiplier: 1.5,   // ~1.5x faster than Opus
    description: 'Balanced capability and cost',
  },
  opus: {
    maxComplexity: 1.0,
    costMultiplier: 1.0,    // Baseline
    speedMultiplier: 1.0,   // Baseline
    description: 'Most capable for complex reasoning',
  },
  inherit: {
    maxComplexity: 1.0,
    costMultiplier: 1.0,
    speedMultiplier: 1.0,
    description: 'Use parent model selection',
  },
};

/**
 * Complexity indicators for task classification
 */
export const COMPLEXITY_INDICATORS = {
  high: [
    'architect', 'design', 'refactor', 'optimize', 'security', 'audit',
    'complex', 'analyze', 'investigate', 'debug', 'performance', 'scale',
    'distributed', 'concurrent', 'algorithm', 'system', 'integration',
  ],
  medium: [
    'implement', 'feature', 'add', 'update', 'modify', 'fix', 'test',
    'review', 'validate', 'check', 'improve', 'enhance', 'extend',
  ],
  low: [
    'simple', 'typo', 'comment', 'format', 'rename', 'move', 'copy',
    'delete', 'documentation', 'readme', 'config', 'version', 'bump',
  ],
};

/**
 * Model router configuration
 */
export interface ModelRouterConfig {
  /** Confidence threshold for model selection (default: 0.85) */
  confidenceThreshold: number;
  /** Maximum uncertainty before escalating (default: 0.15) */
  maxUncertainty: number;
  /** Enable circuit breaker (default: true) */
  enableCircuitBreaker: boolean;
  /** Failures before circuit opens (default: 5) */
  circuitBreakerThreshold: number;
  /** Path for router state persistence */
  statePath: string;
  /** Auto-save interval in decisions (default: 20) */
  autoSaveInterval: number;
  /** Enable cost optimization (default: true) */
  enableCostOptimization: boolean;
  /** Prefer faster models when confidence is high (default: true) */
  preferSpeed: boolean;
}

/**
 * Routing decision result
 */
export interface ModelRoutingResult {
  /** Selected model */
  model: ClaudeModel;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Uncertainty estimate (0-1) */
  uncertainty: number;
  /** Computed complexity score (0-1) */
  complexity: number;
  /** Reasoning for the selection */
  reasoning: string;
  /** Alternative models considered */
  alternatives: Array<{ model: ClaudeModel; score: number }>;
  /** Inference time in microseconds */
  inferenceTimeUs: number;
  /** Estimated cost multiplier */
  costMultiplier: number;
}

/**
 * Complexity analysis result
 */
export interface ComplexityAnalysis {
  /** Overall complexity score (0-1) */
  score: number;
  /** Indicators found */
  indicators: {
    high: string[];
    medium: string[];
    low: string[];
  };
  /** Feature breakdown */
  features: {
    lexicalComplexity: number;
    semanticDepth: number;
    taskScope: number;
    uncertaintyLevel: number;
  };
}

/**
 * Beta(α, β) prior for Thompson sampling. Each model carries one of these;
 * outcomes update α (successes) and β (failures) so the router auto-balances
 * cost/quality without manual threshold tuning. See ADR-101.
 */
export interface BetaPrior {
  alpha: number;
  beta: number;
}

/**
 * Cost-adjusted Bernoulli rewards for Thompson sampling updates. Higher
 * reward when the right tier is chosen — Haiku-success > Sonnet-success >
 * Opus-success because Opus-success on a simple task is wasteful even when
 * the answer is correct. Escalations get partial credit at best (Sonnet) or
 * zero (Haiku/Opus) since they signal the initial choice was wrong.
 */
export const BANDIT_REWARDS: Record<ClaudeModel, Record<'success' | 'failure' | 'escalated', number>> = {
  haiku:   { success: 1.0, failure: 0.0, escalated: 0.0 },
  sonnet:  { success: 0.7, failure: 0.0, escalated: 0.1 },
  opus:    { success: 0.4, failure: 0.0, escalated: 0.0 },
  inherit: { success: 0.5, failure: 0.0, escalated: 0.0 },
};

/**
 * Router state for persistence
 */
/**
 * Complexity bucket for per-task bandit priors. Bands mirror
 * MODEL_CAPABILITIES.maxComplexity (haiku 0.4, sonnet 0.7) so the taxonomy
 * isn't arbitrary. Keying priors by bucket fixes the global-bandit defect where
 * failures on one task type suppressed a model for ALL task types (audit
 * docs/reviews/intelligence-system-audit-2026-05-29.md; see ADR-142).
 */
export type ComplexityBucket = 'low' | 'med' | 'high';

export function complexityBucket(score: number): ComplexityBucket {
  if (score < 0.4) return 'low';   // haiku territory
  if (score < 0.7) return 'med';   // sonnet territory
  return 'high';                    // opus territory
}

export type BucketedPriors = Record<ComplexityBucket, Record<ClaudeModel, BetaPrior>>;

export interface RouterState {
  totalDecisions: number;
  modelDistribution: Record<ClaudeModel, number>;
  avgComplexity: number;
  avgConfidence: number;
  circuitBreakerTrips: number;
  lastUpdated: string;
  learningHistory: Array<{
    task: string;
    model: ClaudeModel;
    complexity: number;
    outcome: 'success' | 'failure' | 'escalated';
    timestamp: string;
  }>;
  /** Persisted-schema version. v2 = per-bucket priors (ADR-142). */
  version?: number;
  /**
   * Beta(α, β) priors per complexity bucket per model — populated by
   * recordOutcome via Thompson sampling. Defaults to {alpha:1,beta:1}
   * (uniform). Keyed by bucket so e.g. haiku failures on hard tasks don't
   * suppress haiku for easy tasks. Old flat per-model files migrate forward
   * (see migratePriors).
   */
  priors?: BucketedPriors;
}

// ============================================================================
// Beta Sampling for Thompson Sampling Bandit
// ============================================================================

/**
 * Standard normal sample via Box-Muller. Used by Marsaglia-Tsang Gamma.
 * Module-local so the bandit doesn't pull in a heavy stats dep.
 */
export function sampleStandardNormal(): number {
  const u1 = Math.random() || 1e-12; // avoid log(0)
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Sample from Gamma(shape α, scale=1). Marsaglia & Tsang (2000), with the
 * standard "boost α<1 by α+1 then scale by U^(1/α)" trick for shape parameters
 * smaller than 1. O(1) expected, no rejection-loop pathology in practice.
 */
export function sampleGamma(alpha: number): number {
  if (alpha < 1) {
    const u = Math.random() || 1e-12;
    return sampleGamma(alpha + 1) * Math.pow(u, 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = sampleStandardNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    const xx = x * x;
    if (u < 1 - 0.0331 * xx * xx) return d * v;
    if (Math.log(u) < 0.5 * xx + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Sample θ ~ Beta(α, β) via the identity Beta(α,β) = X / (X+Y) where
 * X ~ Gamma(α), Y ~ Gamma(β). Returns the mean for degenerate α+β=0
 * (shouldn't happen in practice but defensive).
 */
export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  const denom = x + y;
  return denom > 0 ? x / denom : 0.5;
}

/**
 * Default uniform priors (no prior knowledge). Beta(1,1) is the standard
 * Bayesian-Bernoulli starting point — uniform over [0,1].
 */
export function defaultBanditPriors(): Record<ClaudeModel, BetaPrior> {
  return {
    haiku:   { alpha: 1, beta: 1 },
    sonnet:  { alpha: 1, beta: 1 },
    opus:    { alpha: 1, beta: 1 },
    inherit: { alpha: 1, beta: 1 },
  };
}

/** Uniform priors for every complexity bucket (cold start). */
export function defaultBucketedPriors(): BucketedPriors {
  return { low: defaultBanditPriors(), med: defaultBanditPriors(), high: defaultBanditPriors() };
}

export function clonePriors(p: Record<ClaudeModel, BetaPrior>): Record<ClaudeModel, BetaPrior> {
  return { haiku: { ...p.haiku }, sonnet: { ...p.sonnet }, opus: { ...p.opus }, inherit: { ...p.inherit } };
}

/**
 * Forward-migrate a persisted `priors` field of any layout to the bucketed
 * shape, never throwing (ADR-142):
 *  - missing/garbage → fresh uniform buckets
 *  - already bucketed (has `low.haiku`) → kept, backfilling any missing bucket
 *  - flat per-model (v1 bandit) → seed ALL buckets from it (lossless: prior
 *    learning becomes a shared starting point that then diverges per bucket)
 */
export function migratePriors(p: unknown): BucketedPriors {
  if (!p || typeof p !== 'object') return defaultBucketedPriors();
  const obj = p as Record<string, any>;
  if (obj.low && typeof obj.low === 'object' && obj.low.haiku) {
    return {
      low: obj.low,
      med: obj.med ?? clonePriors(obj.low),
      high: obj.high ?? clonePriors(obj.low),
    };
  }
  if (obj.haiku && typeof obj.haiku.alpha === 'number') {
    const flat = obj as Record<ClaudeModel, BetaPrior>;
    return { low: clonePriors(flat), med: clonePriors(flat), high: clonePriors(flat) };
  }
  return defaultBucketedPriors();
}


/**
 * EWC Consolidation — weight/Fisher/config/result shapes & defaults
 *
 * Extracted verbatim from ewc-consolidation.ts (lines 37-164) during
 * campaign-2 wave 47 (W253). The 5 public shapes are re-exported by the
 * barrel; GradientSample + DEFAULT_EWC_CONFIG stay unexported from it.
 */

import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Pattern weight vector for EWC consolidation
 */
export interface PatternWeights {
  /** Unique pattern identifier */
  id: string;
  /** Weight vector (embedding or learned parameters) */
  weights: number[];
  /** Fisher information values per weight */
  fisherDiagonal: number[];
  /** Importance score (0-1) */
  importance: number;
  /** Number of successful uses */
  successCount: number;
  /** Number of failed uses */
  failureCount: number;
  /** Timestamp of last update */
  lastUpdated: number;
  /** Pattern type for categorization */
  type: string;
  /** Pattern description */
  description?: string;
}

/**
 * Fisher Information Matrix entry (diagonal approximation)
 */
export interface FisherEntry {
  /** Parameter index */
  index: number;
  /** Fisher information value (importance) */
  value: number;
  /** Number of samples used to compute this value */
  sampleCount: number;
  /** Exponential moving average decay rate */
  decayRate: number;
}

/**
 * EWC consolidation configuration
 */
export interface EWCConfig {
  /** Regularization strength (lambda) */
  lambda: number;
  /** Number of patterns to keep for Fisher computation */
  maxPatterns: number;
  /** Decay rate for online Fisher updates */
  fisherDecayRate: number;
  /** Minimum importance threshold for consolidation */
  importanceThreshold: number;
  /** Path to persist Fisher matrix */
  storagePath: string;
  /** Enable online updates (EWC++) */
  onlineMode: boolean;
  /** Dimensions of weight vectors */
  dimensions: number;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  /** Whether consolidation was successful */
  success: boolean;
  /** Number of patterns consolidated */
  patternsConsolidated: number;
  /** Total penalty applied */
  totalPenalty: number;
  /** Patterns that were modified */
  modifiedPatterns: string[];
  /** Patterns that were protected (high Fisher) */
  protectedPatterns: string[];
  /** Time taken in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Statistics about EWC consolidation state
 */
export interface EWCStats {
  /** Total patterns tracked */
  totalPatterns: number;
  /** Patterns with high importance (above threshold) */
  highImportancePatterns: number;
  /** Average Fisher information across all parameters */
  avgFisherValue: number;
  /** Maximum Fisher information value */
  maxFisherValue: number;
  /** Total successful consolidations */
  consolidationCount: number;
  /** Last consolidation timestamp */
  lastConsolidation: number | null;
  /** Average penalty per consolidation */
  avgPenalty: number;
  /** Storage size in bytes */
  storageSizeBytes: number;
}

/**
 * Gradient sample for Fisher computation
 */
export interface GradientSample {
  patternId: string;
  gradients: number[];
  timestamp: number;
  success: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_EWC_CONFIG: EWCConfig = {
  lambda: 0.4,
  maxPatterns: 1000,
  fisherDecayRate: 0.01,
  importanceThreshold: 0.3,
  storagePath: path.join(process.cwd(), '.swarm', 'ewc-fisher.json'),
  onlineMode: true,
  dimensions: 384
};


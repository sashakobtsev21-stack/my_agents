/**
 * RuVector Hyperbolic — public option/result types
 *
 * HyperbolicSpaceConfig and the distance/search/batch result
 * interfaces.
 * Extracted verbatim from hyperbolic.ts (lines 122-204) during the
 * P3.44 god-file decomposition (W165). hyperbolic.ts stays the barrel.
 */

import type { HyperbolicModel, HyperbolicOperation } from './types.js';

// ============================================================================
// Hyperbolic Space Configuration
// ============================================================================

/**
 * Configuration for a hyperbolic space instance.
 */
export interface HyperbolicSpaceConfig {
  /** Hyperbolic model to use */
  readonly model: HyperbolicModel;
  /** Curvature parameter (negative for hyperbolic space) */
  readonly curvature: number;
  /** Embedding dimension */
  readonly dimension: number;
  /** Numerical stability epsilon */
  readonly eps?: number;
  /** Maximum norm for Poincare ball */
  readonly maxNorm?: number;
  /** Whether curvature is learnable */
  readonly learnCurvature?: boolean;
}

/**
 * Result from a hyperbolic distance computation.
 */
export interface HyperbolicDistanceResult {
  /** Geodesic distance */
  readonly distance: number;
  /** Model used for computation */
  readonly model: HyperbolicModel;
  /** Effective curvature */
  readonly curvature: number;
}

/**
 * Result from a hyperbolic search operation.
 */
export interface HyperbolicSearchResult {
  /** Point ID */
  readonly id: string | number;
  /** Geodesic distance from query */
  readonly distance: number;
  /** Point coordinates in hyperbolic space */
  readonly point: number[];
  /** Original metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Options for batch hyperbolic operations.
 */
export interface HyperbolicBatchOptions {
  /** Points to process */
  readonly points: number[][];
  /** Operation to perform */
  readonly operation: HyperbolicOperation;
  /** Additional operation parameters */
  readonly params?: {
    readonly tangent?: number[];
    readonly base?: number[];
    readonly target?: number[];
    readonly matrix?: number[][];
  };
  /** Process in parallel */
  readonly parallel?: boolean;
  /** Batch size for processing */
  readonly batchSize?: number;
}

/**
 * Result from batch hyperbolic operations.
 */
export interface HyperbolicBatchResult {
  /** Resulting points/values */
  readonly results: number[][];
  /** Operation performed */
  readonly operation: HyperbolicOperation;
  /** Processing time in milliseconds */
  readonly durationMs: number;
  /** Number of points processed */
  readonly count: number;
}


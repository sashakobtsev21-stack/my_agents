/**
 * RuVector PostgreSQL Bridge - Hyperbolic Embeddings Module
 *
 * Comprehensive hyperbolic geometry support for embedding hierarchical data
 * (taxonomies, org charts, ASTs, dependency graphs) in non-Euclidean spaces.
 *
 * Supports four hyperbolic models:
 * - Poincare Ball Model: Conformal, good for visualization
 * - Lorentz (Hyperboloid) Model: Numerically stable, good for optimization
 * - Klein Model: Straight geodesics, good for convex optimization
 * - Half-Space Model: Upper half-plane, good for theoretical analysis
 *
 * @module @claude-flow/plugins/integrations/ruvector/hyperbolic
 * @version 1.0.0
 */


// This file is now a thin barrel + factory surface: the hyperbolic
// module was split into the sub-modules below during the P3.44 god-file
// decomposition (W165). Kept as hyperbolic.ts so './hyperbolic.js'
// importers keep resolving byte-identically. hyperbolic-internal.ts
// (constants + vector helpers) is intentionally NOT re-exported — those
// names were module-private before the split.
export * from './hyperbolic-types.js';
export * from './hyperbolic-space.js';
export * from './hyperbolic-sql.js';
export * from './hyperbolic-batch.js';
export * from './hyperbolic-embedders.js';

import { DEFAULT_EPS, norm } from './hyperbolic-internal.js';
import { HyperbolicSpace } from './hyperbolic-space.js';
import type { HyperbolicSpaceConfig } from './hyperbolic-types.js';
import type { HyperbolicEmbedding, HyperbolicModel } from './types.js';

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a HyperbolicSpace instance from configuration.
 *
 * @param config - Hyperbolic space configuration
 * @returns Configured HyperbolicSpace instance
 */
export function createHyperbolicSpace(config: HyperbolicSpaceConfig): HyperbolicSpace {
  return new HyperbolicSpace(
    config.model,
    config.curvature,
    config.eps,
    config.maxNorm
  );
}

/**
 * Creates a HyperbolicSpace instance from HyperbolicEmbedding type.
 *
 * @param embedding - Hyperbolic embedding configuration
 * @returns Configured HyperbolicSpace instance
 */
export function fromEmbeddingConfig(embedding: HyperbolicEmbedding): HyperbolicSpace {
  return new HyperbolicSpace(
    embedding.model,
    embedding.curvature,
    embedding.params?.eps,
    embedding.params?.maxNorm
  );
}

/**
 * Validates that a point is valid for the given hyperbolic model.
 *
 * @param point - Point to validate
 * @param model - Hyperbolic model
 * @param curvature - Curvature parameter
 * @returns True if valid
 */
export function validatePoint(
  point: number[],
  model: HyperbolicModel,
  curvature: number
): boolean {
  const c = Math.abs(curvature);
  const eps = DEFAULT_EPS;

  switch (model) {
    case 'poincare': {
      const n = norm(point);
      return n < 1 - eps;
    }
    case 'lorentz': {
      // Check Lorentz constraint: -x0^2 + sum(xi^2) = -1/c
      let spatialSq = 0;
      for (let i = 1; i < point.length; i++) {
        spatialSq += point[i] * point[i];
      }
      const constraint = -point[0] * point[0] + spatialSq;
      return Math.abs(constraint + 1 / c) < eps * 1000;
    }
    case 'klein': {
      const n = norm(point);
      return n < 1 - eps;
    }
    case 'half_space': {
      return point[point.length - 1] > eps;
    }
    default:
      return false;
  }
}

// ============================================================================
// Re-exports from types
// ============================================================================

export type {
  HyperbolicModel,
  HyperbolicEmbedding,
  HyperbolicInput,
  HyperbolicOutput,
  HyperbolicOperation,
  HyperbolicParams,
  HyperbolicDistance,
} from './types.js';

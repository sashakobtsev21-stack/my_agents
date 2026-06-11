/**
 * RuVector Hyperbolic — batch operations
 *
 * HyperbolicBatchProcessor: batched embedding/distance/search.
 * Extracted verbatim from hyperbolic.ts (lines 1397-1561) during the
 * P3.44 god-file decomposition (W165). hyperbolic.ts stays the barrel.
 */

import { DEFAULT_CURVATURE } from './hyperbolic-internal.js';
import { HyperbolicSpace } from './hyperbolic-space.js';
import type { HyperbolicSearchResult } from './hyperbolic-types.js';
import type { HyperbolicModel } from './types.js';

// ============================================================================
// Batch Operations for Embeddings
// ============================================================================

/**
 * HyperbolicBatchProcessor handles batch operations on hyperbolic embeddings.
 */
export class HyperbolicBatchProcessor {
  private readonly space: HyperbolicSpace;

  constructor(model: HyperbolicModel, curvature: number = DEFAULT_CURVATURE) {
    this.space = new HyperbolicSpace(model, curvature);
  }

  /**
   * Computes distances from a query point to multiple target points.
   *
   * @param query - Query point
   * @param targets - Array of target points
   * @returns Array of distances
   */
  batchDistance(query: number[], targets: number[][]): number[] {
    return targets.map((target) => this.space.distance(query, target));
  }

  /**
   * Applies exponential map to multiple tangent vectors from a base point.
   *
   * @param base - Base point
   * @param tangents - Array of tangent vectors
   * @returns Array of resulting points
   */
  batchExpMap(base: number[], tangents: number[][]): number[][] {
    return tangents.map((tangent) => this.space.expMap(base, tangent));
  }

  /**
   * Applies logarithmic map from a base point to multiple target points.
   *
   * @param base - Base point
   * @param targets - Array of target points
   * @returns Array of tangent vectors
   */
  batchLogMap(base: number[], targets: number[][]): number[][] {
    return targets.map((target) => this.space.logMap(base, target));
  }

  /**
   * Projects multiple points onto the manifold.
   *
   * @param points - Array of points to project
   * @returns Array of projected points
   */
  batchProject(points: number[][]): number[][] {
    return points.map((point) => this.space.projectToManifold(point));
  }

  /**
   * Converts multiple points between models.
   *
   * @param points - Array of points
   * @param fromModel - Source model
   * @param toModel - Target model
   * @returns Array of converted points
   */
  batchConvert(
    points: number[][],
    fromModel: HyperbolicModel,
    toModel: HyperbolicModel
  ): number[][] {
    if (fromModel === toModel) {
      return points.map((p) => [...p]);
    }

    // Handle direct conversions
    if (fromModel === 'poincare' && toModel === 'lorentz') {
      return points.map((p) => this.space.toLorentz(p));
    }
    if (fromModel === 'lorentz' && toModel === 'poincare') {
      return points.map((p) => this.space.toPoincare(p));
    }

    // For other conversions, go through Poincare as intermediate
    let intermediate = points;

    // First convert to Poincare
    if (fromModel === 'lorentz') {
      intermediate = points.map((p) => this.space.toPoincare(p));
    } else if (fromModel === 'klein') {
      intermediate = points.map((p) => this.space.kleinToPoincare(p));
    } else if (fromModel === 'half_space') {
      intermediate = points.map((p) => this.space.halfSpaceToPoincare(p));
    }

    // Then convert from Poincare to target
    if (toModel === 'lorentz') {
      return intermediate.map((p) => this.space.toLorentz(p));
    } else if (toModel === 'klein') {
      return intermediate.map((p) => this.space.poincareToKlein(p));
    } else if (toModel === 'half_space') {
      return intermediate.map((p) => this.space.poincareToHalfSpace(p));
    }

    return intermediate;
  }

  /**
   * Performs k-nearest neighbor search in hyperbolic space.
   *
   * @param query - Query point
   * @param points - Array of candidate points with IDs
   * @param k - Number of neighbors
   * @returns K nearest neighbors sorted by distance
   */
  knnSearch(
    query: number[],
    points: Array<{ id: string | number; point: number[]; metadata?: Record<string, unknown> }>,
    k: number
  ): HyperbolicSearchResult[] {
    // Compute all distances
    const withDistances = points.map((p) => ({
      id: p.id,
      distance: this.space.distance(query, p.point),
      point: p.point,
      metadata: p.metadata,
    }));

    // Sort by distance and take top k
    withDistances.sort((a, b) => a.distance - b.distance);
    return withDistances.slice(0, k);
  }

  /**
   * Computes the centroid of a set of points.
   *
   * @param points - Array of points
   * @param maxIter - Maximum iterations for iterative refinement
   * @returns Centroid point
   */
  computeCentroid(points: number[][], maxIter: number = 100): number[] {
    return this.space.centroid(points, maxIter);
  }

  /**
   * Interpolates along geodesics between pairs of points.
   *
   * @param pairs - Array of [start, end] point pairs
   * @param t - Interpolation parameter (0 = start, 1 = end)
   * @returns Array of interpolated points
   */
  batchGeodesic(pairs: [number[], number[]][], t: number): number[][] {
    return pairs.map(([a, b]) => this.space.geodesic(a, b, t));
  }

  /**
   * Performs Mobius addition on pairs of points.
   *
   * @param pairs - Array of [a, b] point pairs
   * @returns Array of Mobius sums
   */
  batchMobiusAdd(pairs: [number[], number[]][]): number[][] {
    return pairs.map(([a, b]) => this.space.mobiusAdd(a, b));
  }
}


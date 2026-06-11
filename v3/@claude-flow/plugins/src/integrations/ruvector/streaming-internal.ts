/**
 * RuVector Streaming — internal constants
 *
 * Batch/concurrency defaults and the DISTANCE_OPERATORS map. These were
 * module-private in the original streaming.ts (P3.45, W166) and are NOT
 * re-exported by the streaming.ts barrel — public API unchanged.
 */

import type { DistanceMetric } from './types.js';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_BATCH_SIZE = 1000;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_HIGH_WATER_MARK = 16384;
export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_CURSOR_PREFIX = 'ruvector_cursor_';

// Distance operators mapping
export const DISTANCE_OPERATORS: Record<DistanceMetric, string> = {
  cosine: '<=>',
  euclidean: '<->',
  dot: '<#>',
  hamming: '<~>',
  manhattan: '<+>',
  chebyshev: '<+>',
  jaccard: '<~>',
  minkowski: '<->',
  bray_curtis: '<->',
  canberra: '<->',
  mahalanobis: '<->',
  correlation: '<=>',
};


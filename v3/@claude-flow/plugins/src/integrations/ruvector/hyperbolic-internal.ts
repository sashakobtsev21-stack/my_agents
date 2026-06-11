/**
 * RuVector Hyperbolic — internal shared pieces
 *
 * The default curvature/eps/max-norm constants and the 10 small vector
 * helpers shared by the hyperbolic modules. These were module-private in
 * the original hyperbolic.ts (P3.44, W165) and are deliberately NOT
 * re-exported by the hyperbolic.ts barrel — public API unchanged.
 */

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Default numerical stability epsilon
 */
export const DEFAULT_EPS = 1e-15;

/**
 * Maximum norm for Poincare ball to maintain stability (must be < 1)
 */
export const DEFAULT_MAX_NORM = 1 - 1e-5;

/**
 * Default curvature for hyperbolic space (negative value)
 */
export const DEFAULT_CURVATURE = -1.0;


// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Computes the dot product of two vectors.
 */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Computes the Euclidean (L2) norm of a vector.
 */
export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Computes the squared norm of a vector.
 */
export function normSquared(v: number[]): number {
  return dot(v, v);
}

/**
 * Scales a vector by a scalar.
 */
export function scale(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

/**
 * Adds two vectors.
 */
export function add(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i]);
}

/**
 * Subtracts vector b from vector a.
 */
export function sub(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - b[i]);
}

/**
 * Clamps a value to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safe arctanh implementation with clamping.
 */
export function safeAtanh(x: number, eps: number = DEFAULT_EPS): number {
  const clamped = clamp(x, -1 + eps, 1 - eps);
  return 0.5 * Math.log((1 + clamped) / (1 - clamped));
}

/**
 * Safe arccosh implementation.
 */
export function safeAcosh(x: number, eps: number = DEFAULT_EPS): number {
  return Math.acosh(Math.max(1 + eps, x));
}

/**
 * Creates a zero vector of specified dimension.
 */
export function zeros(dim: number): number[] {
  return new Array(dim).fill(0);
}


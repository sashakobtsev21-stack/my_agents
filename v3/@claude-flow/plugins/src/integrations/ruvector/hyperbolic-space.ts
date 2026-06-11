/**
 * RuVector Hyperbolic — Poincare/Lorentz space core
 *
 * HyperbolicSpace: mobius ops, exp/log maps, distances, and
 * projections across the supported models.
 * Extracted verbatim from hyperbolic.ts (lines 205-1131) during the
 * P3.44 god-file decomposition (W165). hyperbolic.ts stays the barrel.
 */

import {
  DEFAULT_CURVATURE,
  DEFAULT_EPS,
  DEFAULT_MAX_NORM,
  add,
  dot,
  norm,
  normSquared,
  safeAcosh,
  safeAtanh,
  scale,
  sub,
  zeros,
} from './hyperbolic-internal.js';
import type { HyperbolicModel } from './types.js';

// ============================================================================
// HyperbolicSpace Class
// ============================================================================

/**
 * HyperbolicSpace provides comprehensive operations for hyperbolic geometry.
 *
 * Supports Poincare ball, Lorentz (hyperboloid), Klein disk, and half-space models.
 * All operations are numerically stable and handle edge cases gracefully.
 *
 * @example
 * ```typescript
 * const space = new HyperbolicSpace('poincare', -1.0);
 * const dist = space.distance([0.1, 0.2], [0.3, 0.4]);
 * const mapped = space.expMap([0, 0], [0.1, 0.2]);
 * ```
 */
export class HyperbolicSpace {
  /** Current hyperbolic model */
  readonly model: HyperbolicModel;
  /** Curvature parameter (negative for hyperbolic) */
  private _curvature: number;
  /** Numerical stability epsilon */
  readonly eps: number;
  /** Maximum norm for Poincare ball */
  readonly maxNorm: number;
  /** Scaling factor derived from curvature: sqrt(|c|) */
  private _scale: number;

  /**
   * Creates a new HyperbolicSpace instance.
   *
   * @param model - Hyperbolic model to use
   * @param curvature - Curvature parameter (should be negative, will be negated if positive)
   * @param eps - Numerical stability epsilon
   * @param maxNorm - Maximum norm for Poincare ball
   */
  constructor(
    model: HyperbolicModel,
    curvature: number = DEFAULT_CURVATURE,
    eps: number = DEFAULT_EPS,
    maxNorm: number = DEFAULT_MAX_NORM
  ) {
    this.model = model;
    this._curvature = curvature > 0 ? -curvature : curvature;
    this.eps = eps;
    this.maxNorm = maxNorm;
    this._scale = Math.sqrt(Math.abs(this._curvature));
  }

  /**
   * Gets the current curvature.
   */
  get curvature(): number {
    return this._curvature;
  }

  /**
   * Gets the scaling factor sqrt(|c|).
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * Updates the curvature (for learnable curvature scenarios).
   */
  setCurvature(c: number): void {
    this._curvature = c > 0 ? -c : c;
    this._scale = Math.sqrt(Math.abs(this._curvature));
  }

  // ==========================================================================
  // Distance Calculations
  // ==========================================================================

  /**
   * Computes the geodesic distance between two points in hyperbolic space.
   *
   * The distance formula depends on the model:
   * - Poincare: d(u,v) = (2/sqrt|c|) * arctanh(sqrt|c| * ||(-u) + v||_M)
   * - Lorentz: d(u,v) = (1/sqrt|c|) * arcosh(-c * <u,v>_L)
   * - Klein: Converted to Poincare first
   * - Half-space: d(u,v) = arcosh(1 + ||u-v||^2 / (2*u_n*v_n))
   *
   * @param a - First point
   * @param b - Second point
   * @returns Geodesic distance
   */
  distance(a: number[], b: number[]): number {
    switch (this.model) {
      case 'poincare':
        return this.poincareDistance(a, b);
      case 'lorentz':
        return this.lorentzDistance(a, b);
      case 'klein':
        return this.kleinDistance(a, b);
      case 'half_space':
        return this.halfSpaceDistance(a, b);
      default:
        throw new Error(`Unknown hyperbolic model: ${this.model}`);
    }
  }

  /**
   * Computes distance in the Poincare ball model.
   *
   * Formula: d(u,v) = (2/sqrt|c|) * arctanh(sqrt|c| * ||(-u) +_M v||)
   *
   * Where +_M is Mobius addition.
   */
  private poincareDistance(u: number[], v: number[]): number {
    // Use Mobius addition: -u +_M v
    const negU = scale(u, -1);
    const diff = this.mobiusAdd(negU, v);
    const diffNorm = norm(diff);

    // d = (2/sqrt|c|) * arctanh(sqrt|c| * ||diff||)
    const scaledNorm = this._scale * diffNorm;
    return (2 / this._scale) * safeAtanh(scaledNorm, this.eps);
  }

  /**
   * Computes distance in the Lorentz (hyperboloid) model.
   *
   * Formula: d(u,v) = (1/sqrt|c|) * arcosh(-c * <u,v>_L)
   *
   * Where <u,v>_L is the Lorentz inner product: -u0*v0 + u1*v1 + ... + un*vn
   */
  private lorentzDistance(u: number[], v: number[]): number {
    const lorentzInner = this.lorentzInnerProduct(u, v);
    // -c * <u,v>_L for negative curvature
    const argument = -this._curvature * lorentzInner;
    return safeAcosh(argument, this.eps) / this._scale;
  }

  /**
   * Computes distance in the Klein model.
   * Converts to Poincare first for numerical stability.
   */
  private kleinDistance(u: number[], v: number[]): number {
    const uPoincare = this.kleinToPoincare(u);
    const vPoincare = this.kleinToPoincare(v);
    return this.poincareDistance(uPoincare, vPoincare);
  }

  /**
   * Computes distance in the half-space model.
   *
   * Formula: d(u,v) = arcosh(1 + ||u-v||^2 / (2*u_n*v_n))
   *
   * Where u_n, v_n are the last coordinates (must be positive).
   */
  private halfSpaceDistance(u: number[], v: number[]): number {
    const n = u.length - 1;
    const un = Math.max(u[n], this.eps);
    const vn = Math.max(v[n], this.eps);

    const diffSq = normSquared(sub(u, v));
    const argument = 1 + diffSq / (2 * un * vn);

    return safeAcosh(argument, this.eps) / this._scale;
  }

  /**
   * Computes the Lorentz inner product.
   * <u,v>_L = -u0*v0 + sum(u_i*v_i for i=1..n)
   */
  private lorentzInnerProduct(u: number[], v: number[]): number {
    let result = -u[0] * v[0]; // Time component (negative)
    for (let i = 1; i < u.length; i++) {
      result += u[i] * v[i]; // Spatial components (positive)
    }
    return result;
  }

  // ==========================================================================
  // Exponential and Logarithmic Maps
  // ==========================================================================

  /**
   * Exponential map: Maps a tangent vector at a base point to the manifold.
   *
   * exp_p(v) moves from point p in the direction of tangent vector v.
   *
   * @param base - Base point on the manifold
   * @param tangent - Tangent vector at the base point
   * @returns Point on the manifold
   */
  expMap(base: number[], tangent: number[]): number[] {
    switch (this.model) {
      case 'poincare':
        return this.poincareExpMap(base, tangent);
      case 'lorentz':
        return this.lorentzExpMap(base, tangent);
      case 'klein':
        return this.kleinExpMap(base, tangent);
      case 'half_space':
        return this.halfSpaceExpMap(base, tangent);
      default:
        throw new Error(`Unknown hyperbolic model: ${this.model}`);
    }
  }

  /**
   * Logarithmic map: Maps a point on the manifold to a tangent vector at base.
   *
   * log_p(q) gives the tangent vector at p pointing towards q.
   *
   * @param base - Base point on the manifold
   * @param point - Target point on the manifold
   * @returns Tangent vector at the base point
   */
  logMap(base: number[], point: number[]): number[] {
    switch (this.model) {
      case 'poincare':
        return this.poincareLogMap(base, point);
      case 'lorentz':
        return this.lorentzLogMap(base, point);
      case 'klein':
        return this.kleinLogMap(base, point);
      case 'half_space':
        return this.halfSpaceLogMap(base, point);
      default:
        throw new Error(`Unknown hyperbolic model: ${this.model}`);
    }
  }

  /**
   * Poincare exponential map.
   *
   * exp_p(v) = p +_M (tanh(sqrt|c| * ||v||_p / 2) * v / (sqrt|c| * ||v||_p))
   *
   * Where ||v||_p is the Poincare tangent norm: lambda_p * ||v||
   * And lambda_p = 2 / (1 - |c| * ||p||^2) is the conformal factor.
   */
  private poincareExpMap(base: number[], tangent: number[]): number[] {
    const tangentNorm = norm(tangent);
    if (tangentNorm < this.eps) {
      return [...base];
    }

    // Conformal factor at base
    const baseSq = normSquared(base);
    const lambda = 2 / (1 - Math.abs(this._curvature) * baseSq);

    // Scaled tangent norm
    const vNorm = lambda * tangentNorm;

    // Compute direction and scale
    const t = Math.tanh(this._scale * vNorm / 2);
    const direction = scale(tangent, t / (this._scale * vNorm));

    // Mobius add base + direction
    return this.projectToManifold(this.mobiusAdd(base, direction));
  }

  /**
   * Poincare logarithmic map.
   *
   * log_p(q) = (2 / (sqrt|c| * lambda_p)) * arctanh(sqrt|c| * ||(-p) +_M q||) * ((-p) +_M q) / ||(-p) +_M q||
   */
  private poincareLogMap(base: number[], point: number[]): number[] {
    const negBase = scale(base, -1);
    const diff = this.mobiusAdd(negBase, point);
    const diffNorm = norm(diff);

    if (diffNorm < this.eps) {
      return zeros(base.length);
    }

    // Conformal factor at base
    const baseSq = normSquared(base);
    const lambda = 2 / (1 - Math.abs(this._curvature) * baseSq);

    // Compute coefficient
    const atanh_arg = this._scale * diffNorm;
    const coeff = (2 / (this._scale * lambda)) * safeAtanh(atanh_arg, this.eps);

    // Direction
    return scale(diff, coeff / diffNorm);
  }

  /**
   * Lorentz exponential map.
   *
   * exp_p(v) = cosh(||v||_L) * p + sinh(||v||_L) * v / ||v||_L
   *
   * Where ||v||_L is the Lorentz norm: sqrt(<v,v>_L)
   */
  private lorentzExpMap(base: number[], tangent: number[]): number[] {
    const tangentNormSq = this.lorentzInnerProduct(tangent, tangent);

    if (tangentNormSq < this.eps * this.eps) {
      return [...base];
    }

    const tangentNorm = Math.sqrt(Math.max(0, tangentNormSq));
    const scaledNorm = this._scale * tangentNorm;

    const coshVal = Math.cosh(scaledNorm);
    const sinhVal = Math.sinh(scaledNorm);

    const result = add(
      scale(base, coshVal),
      scale(tangent, sinhVal / tangentNorm)
    );

    return this.projectToManifold(result);
  }

  /**
   * Lorentz logarithmic map.
   *
   * log_p(q) = (arcosh(-<p,q>_L) / sqrt(-<p,q>_L^2 - 1)) * (q + <p,q>_L * p)
   */
  private lorentzLogMap(base: number[], point: number[]): number[] {
    const inner = this.lorentzInnerProduct(base, point);
    const alpha = -inner;

    if (alpha <= 1 + this.eps) {
      return zeros(base.length);
    }

    const sqrtArg = Math.sqrt(alpha * alpha - 1);
    const coeff = safeAcosh(alpha, this.eps) / sqrtArg;

    // v = q + <p,q>_L * p, but we need q - alpha * p for tangent
    const tangent = sub(point, scale(base, alpha));

    return scale(tangent, coeff);
  }

  /**
   * Klein exponential map (via Poincare).
   */
  private kleinExpMap(base: number[], tangent: number[]): number[] {
    const basePoincare = this.kleinToPoincare(base);
    const tangentPoincare = this.kleinTangentToPoincare(base, tangent);
    const resultPoincare = this.poincareExpMap(basePoincare, tangentPoincare);
    return this.poincareToKlein(resultPoincare);
  }

  /**
   * Klein logarithmic map (via Poincare).
   */
  private kleinLogMap(base: number[], point: number[]): number[] {
    const basePoincare = this.kleinToPoincare(base);
    const pointPoincare = this.kleinToPoincare(point);
    const tangentPoincare = this.poincareLogMap(basePoincare, pointPoincare);
    return this.poincareTangentToKlein(base, tangentPoincare);
  }

  /**
   * Half-space exponential map.
   */
  private halfSpaceExpMap(base: number[], tangent: number[]): number[] {
    // For half-space, use the Riemannian metric g = (1/x_n^2) * I
    const n = base.length - 1;
    const xn = Math.max(base[n], this.eps);

    // Scale tangent by conformal factor
    const scaledTangent = scale(tangent, xn);
    const tangentNorm = norm(scaledTangent);

    if (tangentNorm < this.eps) {
      return [...base];
    }

    // Geodesic in half-space model
    const t = tangentNorm * this._scale;
    const direction = scale(scaledTangent, 1 / tangentNorm);

    const result = add(base, scale(direction, Math.sinh(t) * xn / this._scale));
    result[n] = xn * Math.cosh(t);

    return this.projectToManifold(result);
  }

  /**
   * Half-space logarithmic map.
   */
  private halfSpaceLogMap(base: number[], point: number[]): number[] {
    const n = base.length - 1;
    const xn = Math.max(base[n], this.eps);
    const yn = Math.max(point[n], this.eps);

    const diff = sub(point, base);
    const diffSq = normSquared(diff);

    const argument = 1 + diffSq / (2 * xn * yn);
    const dist = safeAcosh(argument, this.eps);

    if (dist < this.eps) {
      return zeros(base.length);
    }

    // Compute initial tangent direction
    const direction = scale(diff, 1 / Math.sqrt(diffSq + this.eps));
    return scale(direction, dist * xn / this._scale);
  }

  // ==========================================================================
  // Mobius Operations (Poincare Ball)
  // ==========================================================================

  /**
   * Mobius addition in the Poincare ball.
   *
   * a +_M b = ((1 + 2c<a,b> + c||b||^2)a + (1 - c||a||^2)b) / (1 + 2c<a,b> + c^2||a||^2||b||^2)
   *
   * @param a - First point
   * @param b - Second point
   * @returns Mobius sum
   */
  mobiusAdd(a: number[], b: number[]): number[] {
    const c = Math.abs(this._curvature);
    const aSq = normSquared(a);
    const bSq = normSquared(b);
    const ab = dot(a, b);

    const numerator1 = 1 + 2 * c * ab + c * bSq;
    const numerator2 = 1 - c * aSq;
    const denominator = 1 + 2 * c * ab + c * c * aSq * bSq;

    const safeD = Math.max(denominator, this.eps);
    const result = add(
      scale(a, numerator1 / safeD),
      scale(b, numerator2 / safeD)
    );

    return this.projectToManifold(result);
  }

  /**
   * Mobius matrix-vector multiplication.
   *
   * M otimes_M v = tanh(||Mv|| / ||v|| * arctanh(||v||)) * Mv / ||Mv||
   *
   * This applies a matrix transformation in hyperbolic space.
   *
   * @param matrix - Transformation matrix
   * @param vec - Vector in Poincare ball
   * @returns Transformed vector
   */
  mobiusMatVec(matrix: number[][], vec: number[]): number[] {
    // First, compute Mv in Euclidean space
    const mv: number[] = [];
    for (let i = 0; i < matrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < vec.length; j++) {
        sum += matrix[i][j] * vec[j];
      }
      mv.push(sum);
    }

    const mvNorm = norm(mv);
    const vNorm = norm(vec);

    if (vNorm < this.eps || mvNorm < this.eps) {
      return this.projectToManifold(mv);
    }

    // Apply hyperbolic scaling
    const scaledVNorm = this._scale * vNorm;
    const atanhV = safeAtanh(scaledVNorm, this.eps);
    const scaleFactor = Math.tanh(mvNorm / vNorm * atanhV) / (this._scale * mvNorm);

    return this.projectToManifold(scale(mv, scaleFactor));
  }

  /**
   * Mobius scalar multiplication.
   *
   * r *_M x = tanh(r * arctanh(sqrt|c| * ||x||)) * x / (sqrt|c| * ||x||)
   *
   * @param r - Scalar multiplier
   * @param x - Point in Poincare ball
   * @returns Scaled point
   */
  mobiusScalarMul(r: number, x: number[]): number[] {
    const xNorm = norm(x);
    if (xNorm < this.eps) {
      return zeros(x.length);
    }

    const scaledNorm = this._scale * xNorm;
    const atanhX = safeAtanh(scaledNorm, this.eps);
    const newNorm = Math.tanh(r * atanhX) / this._scale;

    return this.projectToManifold(scale(x, newNorm / xNorm));
  }

  // ==========================================================================
  // Projection Operations
  // ==========================================================================

  /**
   * Projects a point onto the hyperbolic manifold.
   *
   * For Poincare: Ensures ||x|| < maxNorm
   * For Lorentz: Ensures x is on the hyperboloid
   * For Klein: Ensures ||x|| < 1
   * For Half-space: Ensures last coordinate > eps
   *
   * @param point - Point to project
   * @returns Point on the manifold
   */
  projectToManifold(point: number[]): number[] {
    switch (this.model) {
      case 'poincare':
        return this.projectToPoincare(point);
      case 'lorentz':
        return this.projectToLorentz(point);
      case 'klein':
        return this.projectToKlein(point);
      case 'half_space':
        return this.projectToHalfSpace(point);
      default:
        throw new Error(`Unknown hyperbolic model: ${this.model}`);
    }
  }

  /**
   * Projects onto the Poincare ball (||x|| < maxNorm).
   */
  private projectToPoincare(point: number[]): number[] {
    const n = norm(point);
    if (n >= this.maxNorm) {
      return scale(point, (this.maxNorm - this.eps) / n);
    }
    return point;
  }

  /**
   * Projects onto the Lorentz hyperboloid.
   * Ensures <x,x>_L = -1/c
   */
  private projectToLorentz(point: number[]): number[] {
    // Compute spatial norm
    let spatialSq = 0;
    for (let i = 1; i < point.length; i++) {
      spatialSq += point[i] * point[i];
    }

    // Time component: x0 = sqrt(1/|c| + spatial^2)
    const x0 = Math.sqrt(1 / Math.abs(this._curvature) + spatialSq);

    const result = [...point];
    result[0] = x0;
    return result;
  }

  /**
   * Projects onto the Klein disk (||x|| < 1).
   */
  private projectToKlein(point: number[]): number[] {
    const n = norm(point);
    if (n >= 1 - this.eps) {
      return scale(point, (1 - 2 * this.eps) / n);
    }
    return point;
  }

  /**
   * Projects onto the half-space (last coordinate > eps).
   */
  private projectToHalfSpace(point: number[]): number[] {
    const result = [...point];
    const lastIdx = point.length - 1;
    result[lastIdx] = Math.max(result[lastIdx], this.eps);
    return result;
  }

  /**
   * Projects a vector onto the tangent space at a given base point.
   *
   * @param base - Base point on the manifold
   * @param vec - Vector to project
   * @returns Vector in the tangent space
   */
  projectToTangent(base: number[], vec: number[]): number[] {
    switch (this.model) {
      case 'poincare':
        // In Poincare ball, tangent space is R^n (no projection needed for vectors)
        return vec;
      case 'lorentz':
        return this.projectToLorentzTangent(base, vec);
      case 'klein':
        return vec;
      case 'half_space':
        return vec;
      default:
        throw new Error(`Unknown hyperbolic model: ${this.model}`);
    }
  }

  /**
   * Projects onto the Lorentz tangent space.
   * Tangent vectors must satisfy <p, v>_L = 0.
   */
  private projectToLorentzTangent(base: number[], vec: number[]): number[] {
    const inner = this.lorentzInnerProduct(base, vec);
    const baseInner = this.lorentzInnerProduct(base, base);
    const coeff = inner / Math.min(baseInner, -this.eps);

    return sub(vec, scale(base, coeff));
  }

  // ==========================================================================
  // Model Conversions
  // ==========================================================================

  /**
   * Converts a point from Poincare ball to Lorentz hyperboloid.
   *
   * Lorentz: (x0, x1, ..., xn) where x0 is the time component
   * x0 = (1 + |c| * ||p||^2) / (1 - |c| * ||p||^2)
   * xi = 2 * sqrt|c| * pi / (1 - |c| * ||p||^2)
   *
   * @param poincare - Point in Poincare ball
   * @returns Point on Lorentz hyperboloid
   */
  toLorentz(poincare: number[]): number[] {
    const c = Math.abs(this._curvature);
    const pSq = normSquared(poincare);
    const denom = Math.max(1 - c * pSq, this.eps);

    const x0 = (1 + c * pSq) / denom;
    const lorentz = [x0];

    for (let i = 0; i < poincare.length; i++) {
      lorentz.push((2 * this._scale * poincare[i]) / denom);
    }

    return lorentz;
  }

  /**
   * Converts a point from Lorentz hyperboloid to Poincare ball.
   *
   * pi = xi / (sqrt|c| * (x0 + 1))
   *
   * @param lorentz - Point on Lorentz hyperboloid
   * @returns Point in Poincare ball
   */
  toPoincare(lorentz: number[]): number[] {
    const denom = this._scale * (lorentz[0] + 1);
    const poincare: number[] = [];

    for (let i = 1; i < lorentz.length; i++) {
      poincare.push(lorentz[i] / Math.max(denom, this.eps));
    }

    return this.projectToPoincare(poincare);
  }

  /**
   * Converts a point from Klein disk to Poincare ball.
   *
   * pi = ki / (1 + sqrt(1 - |c| * ||k||^2))
   *
   * @param klein - Point in Klein disk
   * @returns Point in Poincare ball
   */
  kleinToPoincare(klein: number[]): number[] {
    const c = Math.abs(this._curvature);
    const kSq = normSquared(klein);
    const sqrtArg = Math.sqrt(Math.max(1 - c * kSq, this.eps));
    const denom = 1 + sqrtArg;

    return this.projectToPoincare(scale(klein, 1 / denom));
  }

  /**
   * Converts a point from Poincare ball to Klein disk.
   *
   * ki = 2 * pi / (1 + |c| * ||p||^2)
   *
   * @param poincare - Point in Poincare ball
   * @returns Point in Klein disk
   */
  poincareToKlein(poincare: number[]): number[] {
    const c = Math.abs(this._curvature);
    const pSq = normSquared(poincare);
    const factor = 2 / (1 + c * pSq);

    return this.projectToKlein(scale(poincare, factor));
  }

  /**
   * Converts a tangent vector from Klein to Poincare.
   */
  private kleinTangentToPoincare(kleinBase: number[], kleinTangent: number[]): number[] {
    const c = Math.abs(this._curvature);
    const kSq = normSquared(kleinBase);
    const sqrtArg = Math.sqrt(Math.max(1 - c * kSq, this.eps));
    const factor = sqrtArg / (1 + sqrtArg);

    return scale(kleinTangent, factor);
  }

  /**
   * Converts a tangent vector from Poincare to Klein.
   */
  private poincareTangentToKlein(kleinBase: number[], poincareTangent: number[]): number[] {
    const c = Math.abs(this._curvature);
    const kSq = normSquared(kleinBase);
    const sqrtArg = Math.sqrt(Math.max(1 - c * kSq, this.eps));
    const factor = (1 + sqrtArg) / sqrtArg;

    return scale(poincareTangent, factor);
  }

  /**
   * Converts a point from Poincare ball to half-space model.
   *
   * @param poincare - Point in Poincare ball
   * @returns Point in half-space model
   */
  poincareToHalfSpace(poincare: number[]): number[] {
    const c = Math.abs(this._curvature);
    const n = poincare.length;
    const pSq = normSquared(poincare);
    const pn = poincare[n - 1];

    const denom = pSq + 2 * pn / this._scale + 1 / c;
    const safeDenom = Math.max(Math.abs(denom), this.eps) * Math.sign(denom || 1);

    const result: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      result.push(poincare[i] / safeDenom);
    }
    result.push((1 - c * pSq) / (2 * this._scale * safeDenom));

    return this.projectToHalfSpace(result);
  }

  /**
   * Converts a point from half-space model to Poincare ball.
   *
   * @param halfSpace - Point in half-space model
   * @returns Point in Poincare ball
   */
  halfSpaceToPoincare(halfSpace: number[]): number[] {
    const n = halfSpace.length;
    const xn = Math.max(halfSpace[n - 1], this.eps);

    let xSq = 0;
    for (let i = 0; i < n - 1; i++) {
      xSq += halfSpace[i] * halfSpace[i];
    }

    const denom = xSq + (xn + 1 / this._scale) * (xn + 1 / this._scale);
    const safeDenom = Math.max(denom, this.eps);

    const result: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      result.push((2 * halfSpace[i]) / safeDenom);
    }
    result.push((xSq + xn * xn - 1 / Math.abs(this._curvature)) / safeDenom);

    return this.projectToPoincare(result);
  }

  // ==========================================================================
  // Additional Operations
  // ==========================================================================

  /**
   * Computes the geodesic midpoint of two points.
   *
   * @param a - First point
   * @param b - Second point
   * @returns Midpoint on the geodesic
   */
  midpoint(a: number[], b: number[]): number[] {
    // Use exponential map from a with half the tangent to b
    const tangent = this.logMap(a, b);
    const halfTangent = scale(tangent, 0.5);
    return this.expMap(a, halfTangent);
  }

  /**
   * Computes the Frechet mean (centroid) of multiple points.
   *
   * Uses iterative gradient descent on the sum of squared distances.
   *
   * @param points - Array of points
   * @param maxIter - Maximum iterations
   * @param tol - Convergence tolerance
   * @returns Frechet mean
   */
  centroid(points: number[][], maxIter: number = 100, tol: number = 1e-8): number[] {
    if (points.length === 0) {
      throw new Error('Cannot compute centroid of empty set');
    }
    if (points.length === 1) {
      return [...points[0]];
    }

    // Initialize with Euclidean mean, projected onto manifold
    let mean = zeros(points[0].length);
    for (const p of points) {
      mean = add(mean, p);
    }
    mean = this.projectToManifold(scale(mean, 1 / points.length));

    // Iterative refinement
    for (let iter = 0; iter < maxIter; iter++) {
      // Compute sum of log maps
      let gradSum = zeros(points[0].length);
      for (const p of points) {
        const logP = this.logMap(mean, p);
        gradSum = add(gradSum, logP);
      }

      // Average gradient
      const avgGrad = scale(gradSum, 1 / points.length);
      const gradNorm = norm(avgGrad);

      if (gradNorm < tol) {
        break;
      }

      // Move mean in the direction of gradient
      mean = this.expMap(mean, avgGrad);
    }

    return mean;
  }

  /**
   * Parallel transports a tangent vector along a geodesic.
   *
   * @param vector - Tangent vector to transport
   * @param start - Starting point
   * @param end - Ending point
   * @returns Transported vector at the end point
   */
  parallelTransport(vector: number[], start: number[], end: number[]): number[] {
    switch (this.model) {
      case 'poincare':
        return this.poincareParallelTransport(vector, start, end);
      case 'lorentz':
        return this.lorentzParallelTransport(vector, start, end);
      default:
        // For Klein and half-space, convert via Poincare
        return this.poincareParallelTransport(vector, start, end);
    }
  }

  /**
   * Parallel transport in Poincare ball.
   */
  private poincareParallelTransport(vector: number[], start: number[], end: number[]): number[] {
    const c = Math.abs(this._curvature);

    // Compute conformal factors
    const startSq = normSquared(start);
    const endSq = normSquared(end);
    const lambdaStart = 2 / (1 - c * startSq);
    const lambdaEnd = 2 / (1 - c * endSq);

    // Gyration-based transport
    const negStart = scale(start, -1);
    const transported = this.mobiusAdd(end, this.mobiusAdd(negStart, scale(vector, 1)));

    // Scale by ratio of conformal factors
    const scaleFactor = lambdaStart / lambdaEnd;
    return scale(sub(transported, end), scaleFactor);
  }

  /**
   * Parallel transport in Lorentz model.
   */
  private lorentzParallelTransport(vector: number[], start: number[], end: number[]): number[] {
    const logV = this.logMap(start, end);
    const logNorm = Math.sqrt(Math.max(0, this.lorentzInnerProduct(logV, logV)));

    if (logNorm < this.eps) {
      return [...vector];
    }

    const inner1 = this.lorentzInnerProduct(end, vector);
    const inner2 = this.lorentzInnerProduct(start, vector);
    // Note: inner3 = this.lorentzInnerProduct(start, end) is used implicitly in the formula
    // via the geodesic distance relationship

    const coeff = (inner1 - inner2 * Math.cosh(this._scale * logNorm)) /
                  Math.sinh(this._scale * logNorm) / logNorm;

    return add(vector, scale(add(start, scale(end, -1)), coeff));
  }

  /**
   * Computes a point along the geodesic from a to b at parameter t.
   *
   * @param a - Starting point
   * @param b - Ending point
   * @param t - Parameter in [0, 1]
   * @returns Point on geodesic
   */
  geodesic(a: number[], b: number[], t: number): number[] {
    const tangent = this.logMap(a, b);
    const scaledTangent = scale(tangent, t);
    return this.expMap(a, scaledTangent);
  }

  /**
   * Computes the conformal factor (lambda) at a point in Poincare ball.
   *
   * lambda_p = 2 / (1 - |c| * ||p||^2)
   *
   * @param point - Point in Poincare ball
   * @returns Conformal factor
   */
  conformalFactor(point: number[]): number {
    if (this.model !== 'poincare') {
      throw new Error('Conformal factor is only defined for Poincare ball model');
    }
    const c = Math.abs(this._curvature);
    const pSq = normSquared(point);
    return 2 / Math.max(1 - c * pSq, this.eps);
  }
}


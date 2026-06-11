/**
 * RuVector Hyperbolic — SQL generation
 *
 * HyperbolicSQL: RuVector PostgreSQL function call generation.
 * Extracted verbatim from hyperbolic.ts (lines 1132-1396) during the
 * P3.44 god-file decomposition (W165). hyperbolic.ts stays the barrel.
 */

import type { HyperbolicModel } from './types.js';

// ============================================================================
// SQL Generation for RuVector PostgreSQL Functions
// ============================================================================

/**
 * SQL function call builder for RuVector hyperbolic operations.
 */
export class HyperbolicSQL {
  /**
   * Generates SQL for Poincare distance computation.
   *
   * @param column - Vector column name
   * @param query - Query vector
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static poincareDistance(column: string, query: number[], curvature: number): string {
    const vectorStr = `'[${query.join(',')}]'::vector`;
    return `ruvector_poincare_distance(${column}, ${vectorStr}, ${curvature})`;
  }

  /**
   * Generates SQL for Lorentz distance computation.
   *
   * @param column - Vector column name
   * @param query - Query vector (with time component first)
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static lorentzDistance(column: string, query: number[], curvature: number): string {
    const vectorStr = `'[${query.join(',')}]'::vector`;
    return `ruvector_lorentz_distance(${column}, ${vectorStr}, ${curvature})`;
  }

  /**
   * Generates SQL for exponential map.
   *
   * @param baseColumn - Base point column
   * @param tangentColumn - Tangent vector column
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static expMap(
    baseColumn: string,
    tangentColumn: string,
    model: HyperbolicModel,
    curvature: number
  ): string {
    const funcName = model === 'lorentz' ? 'ruvector_lorentz_exp_map' : 'ruvector_poincare_exp_map';
    return `${funcName}(${baseColumn}, ${tangentColumn}, ${curvature})`;
  }

  /**
   * Generates SQL for logarithmic map.
   *
   * @param baseColumn - Base point column
   * @param targetColumn - Target point column
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static logMap(
    baseColumn: string,
    targetColumn: string,
    model: HyperbolicModel,
    curvature: number
  ): string {
    const funcName = model === 'lorentz' ? 'ruvector_lorentz_log_map' : 'ruvector_poincare_log_map';
    return `${funcName}(${baseColumn}, ${targetColumn}, ${curvature})`;
  }

  /**
   * Generates SQL for Mobius addition.
   *
   * @param aColumn - First point column
   * @param bColumn - Second point column
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static mobiusAdd(aColumn: string, bColumn: string, curvature: number): string {
    return `ruvector_poincare_mobius_add(${aColumn}, ${bColumn}, ${curvature})`;
  }

  /**
   * Generates SQL for Mobius matrix-vector multiplication.
   *
   * @param matrixColumn - Matrix column
   * @param vectorColumn - Vector column
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static mobiusMatVec(matrixColumn: string, vectorColumn: string, curvature: number): string {
    return `ruvector_poincare_mobius_matvec(${matrixColumn}, ${vectorColumn}, ${curvature})`;
  }

  /**
   * Generates SQL for parallel transport.
   *
   * @param vectorColumn - Vector to transport
   * @param startColumn - Starting point
   * @param endColumn - Ending point
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static parallelTransport(
    vectorColumn: string,
    startColumn: string,
    endColumn: string,
    model: HyperbolicModel,
    curvature: number
  ): string {
    const funcName = model === 'lorentz'
      ? 'ruvector_lorentz_parallel_transport'
      : 'ruvector_poincare_parallel_transport';
    return `${funcName}(${vectorColumn}, ${startColumn}, ${endColumn}, ${curvature})`;
  }

  /**
   * Generates SQL for computing hyperbolic centroid.
   *
   * @param column - Vector column name
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @returns SQL expression (aggregate function)
   */
  static centroid(column: string, model: HyperbolicModel, curvature: number): string {
    const funcName = model === 'lorentz'
      ? 'ruvector_lorentz_centroid'
      : 'ruvector_poincare_centroid';
    return `${funcName}(${column}, ${curvature})`;
  }

  /**
   * Generates SQL for model conversion (Poincare to Lorentz).
   *
   * @param column - Vector column
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static poincareToLorentz(column: string, curvature: number): string {
    return `ruvector_poincare_to_lorentz(${column}, ${curvature})`;
  }

  /**
   * Generates SQL for model conversion (Lorentz to Poincare).
   *
   * @param column - Vector column
   * @param curvature - Curvature parameter
   * @returns SQL expression
   */
  static lorentzToPoincare(column: string, curvature: number): string {
    return `ruvector_lorentz_to_poincare(${column}, ${curvature})`;
  }

  /**
   * Generates SQL for hyperbolic nearest neighbor search.
   *
   * @param tableName - Table name
   * @param vectorColumn - Vector column name
   * @param query - Query vector
   * @param k - Number of neighbors
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @param whereClause - Optional WHERE clause
   * @returns Complete SQL query
   */
  static nearestNeighbors(
    tableName: string,
    vectorColumn: string,
    query: number[],
    k: number,
    model: HyperbolicModel,
    curvature: number,
    whereClause?: string
  ): string {
    const distFunc = model === 'lorentz'
      ? this.lorentzDistance(vectorColumn, query, curvature)
      : this.poincareDistance(vectorColumn, query, curvature);

    const where = whereClause ? `WHERE ${whereClause}` : '';

    return `
      SELECT *, ${distFunc} AS hyperbolic_distance
      FROM ${tableName}
      ${where}
      ORDER BY hyperbolic_distance ASC
      LIMIT ${k}
    `.trim();
  }

  /**
   * Generates SQL for creating a hyperbolic embedding column.
   *
   * @param tableName - Table name
   * @param columnName - New column name
   * @param dimension - Vector dimension
   * @param model - Hyperbolic model
   * @returns SQL statement
   */
  static createColumn(
    tableName: string,
    columnName: string,
    dimension: number,
    model: HyperbolicModel
  ): string {
    const comment = `Hyperbolic embedding (${model} model, dim=${dimension})`;
    return `
      ALTER TABLE ${tableName}
      ADD COLUMN IF NOT EXISTS ${columnName} vector(${dimension});

      COMMENT ON COLUMN ${tableName}.${columnName} IS '${comment}';
    `.trim();
  }

  /**
   * Generates SQL for batch hyperbolic distance computation.
   *
   * @param tableName - Table name
   * @param vectorColumn - Vector column name
   * @param queries - Array of query vectors
   * @param k - Number of neighbors per query
   * @param model - Hyperbolic model
   * @param curvature - Curvature parameter
   * @returns SQL query using LATERAL join
   */
  static batchNearestNeighbors(
    tableName: string,
    vectorColumn: string,
    queries: number[][],
    k: number,
    model: HyperbolicModel,
    curvature: number
  ): string {
    const queryValues = queries
      .map((q, i) => `(${i}, '[${q.join(',')}]'::vector)`)
      .join(',\n      ');

    const distFunc = model === 'lorentz'
      ? `ruvector_lorentz_distance(t.${vectorColumn}, q.query_vec, ${curvature})`
      : `ruvector_poincare_distance(t.${vectorColumn}, q.query_vec, ${curvature})`;

    return `
      WITH queries(query_id, query_vec) AS (
        VALUES
          ${queryValues}
      )
      SELECT
        q.query_id,
        results.*
      FROM queries q
      CROSS JOIN LATERAL (
        SELECT
          t.*,
          ${distFunc} AS hyperbolic_distance
        FROM ${tableName} t
        ORDER BY ${distFunc} ASC
        LIMIT ${k}
      ) results
      ORDER BY q.query_id, results.hyperbolic_distance ASC
    `.trim();
  }
}


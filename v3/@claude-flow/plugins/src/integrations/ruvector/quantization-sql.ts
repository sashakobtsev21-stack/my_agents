/**
 * RuVector Quantization — SQL integration
 *
 * QuantizationSQL: PostgreSQL DDL/DML generation for quantized
 * vector storage.
 * Extracted verbatim from quantization.ts (lines 1284-1728) during the
 * P3.43 god-file decomposition (W164). quantization.ts stays the barrel.
 */

import type { QuantizationType } from './quantization-types.js';

// ============================================================================
// SQL Integration
// ============================================================================

/**
 * QuantizationSQL generates SQL for quantized vector operations.
 *
 * Provides SQL statements for:
 * - Creating quantized storage tables
 * - Inserting quantized vectors
 * - Searching with quantized distances
 */
export class QuantizationSQL {
  /**
   * Generates SQL for creating a table with quantized vector storage.
   *
   * @param tableName - Table name
   * @param type - Quantization type
   * @param options - Quantization options
   * @returns CREATE TABLE SQL statement
   */
  static createQuantizedTable(
    tableName: string,
    type: QuantizationType,
    options?: {
      dimensions?: number;
      numSubvectors?: number;
      idType?: 'SERIAL' | 'BIGSERIAL' | 'UUID';
      additionalColumns?: string;
    }
  ): string {
    const {
      dimensions = 128,
      numSubvectors = 8,
      idType = 'BIGSERIAL',
      additionalColumns = '',
    } = options ?? {};

    let vectorColumn: string;
    let comment: string;

    switch (type) {
      case 'scalar':
        vectorColumn = `quantized_vector BYTEA NOT NULL`;
        comment = `Scalar quantized vectors (int8, ${dimensions} dims, 4x compression)`;
        break;

      case 'binary':
        const binaryBytes = Math.ceil(dimensions / 8);
        vectorColumn = `binary_vector BIT(${dimensions})`;
        comment = `Binary quantized vectors (${dimensions} dims, ${binaryBytes} bytes, 32x compression)`;
        break;

      case 'pq':
      case 'opq':
        vectorColumn = `pq_codes BYTEA NOT NULL`;
        comment = `${type === 'opq' ? 'Optimized ' : ''}Product quantized vectors (M=${numSubvectors}, K=256)`;
        break;

      default:
        throw new Error(`Unknown quantization type: ${type}`);
    }

    const extraCols = additionalColumns ? `\n  ${additionalColumns},` : '';

    return `
-- Table for ${comment}
CREATE TABLE IF NOT EXISTS ${tableName} (
  id ${idType} PRIMARY KEY,${extraCols}
  original_vector vector(${dimensions}),  -- Optional: keep original for reranking
  ${vectorColumn},
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for quantized search
CREATE INDEX IF NOT EXISTS idx_${tableName}_quantized ON ${tableName} (quantized_vector);

COMMENT ON TABLE ${tableName} IS '${comment}';
    `.trim();
  }

  /**
   * Generates SQL for inserting a quantized vector.
   *
   * @param tableName - Table name
   * @param type - Quantization type
   * @returns INSERT SQL template with placeholders
   */
  static insertQuantizedSQL(tableName: string, type: QuantizationType): string {
    const column = type === 'binary' ? 'binary_vector' :
                   (type === 'pq' || type === 'opq') ? 'pq_codes' : 'quantized_vector';

    return `
INSERT INTO ${tableName} (original_vector, ${column}, metadata)
VALUES ($1::vector, $2, $3::jsonb)
RETURNING id;
    `.trim();
  }

  /**
   * Generates SQL for batch insert of quantized vectors.
   *
   * @param tableName - Table name
   * @param type - Quantization type
   * @param count - Number of vectors
   * @returns Batch INSERT SQL
   */
  static batchInsertSQL(
    tableName: string,
    type: QuantizationType,
    count: number
  ): string {
    const column = type === 'binary' ? 'binary_vector' :
                   (type === 'pq' || type === 'opq') ? 'pq_codes' : 'quantized_vector';

    const values = Array.from({ length: count }, (_, i) => {
      const offset = i * 3;
      return `($${offset + 1}::vector, $${offset + 2}, $${offset + 3}::jsonb)`;
    }).join(',\n  ');

    return `
INSERT INTO ${tableName} (original_vector, ${column}, metadata)
VALUES
  ${values}
RETURNING id;
    `.trim();
  }

  /**
   * Generates SQL for scalar quantized search.
   *
   * @param tableName - Table name
   * @param k - Number of results
   * @param useReranking - Whether to rerank with original vectors
   * @returns Search SQL template
   */
  static scalarSearchSQL(
    tableName: string,
    k: number,
    useReranking: boolean = true
  ): string {
    if (useReranking) {
      // Two-stage search: filter with quantized, rerank with original
      const filterK = k * 10;
      return `
WITH candidates AS (
  SELECT id, original_vector, metadata,
         ruvector_scalar_distance(quantized_vector, $1::bytea) AS approx_dist
  FROM ${tableName}
  ORDER BY approx_dist ASC
  LIMIT ${filterK}
)
SELECT id, metadata,
       original_vector <-> $2::vector AS exact_dist
FROM candidates
ORDER BY exact_dist ASC
LIMIT ${k};
      `.trim();
    }

    return `
SELECT id, metadata,
       ruvector_scalar_distance(quantized_vector, $1::bytea) AS distance
FROM ${tableName}
ORDER BY distance ASC
LIMIT ${k};
    `.trim();
  }

  /**
   * Generates SQL for binary quantized search with Hamming distance.
   *
   * @param tableName - Table name
   * @param k - Number of results
   * @param useReranking - Whether to rerank with original vectors
   * @returns Search SQL template
   */
  static binarySearchSQL(
    tableName: string,
    k: number,
    useReranking: boolean = true
  ): string {
    if (useReranking) {
      const filterK = k * 10;
      return `
WITH candidates AS (
  SELECT id, original_vector, metadata,
         bit_count(binary_vector # $1::bit) AS hamming_dist
  FROM ${tableName}
  ORDER BY hamming_dist ASC
  LIMIT ${filterK}
)
SELECT id, metadata,
       original_vector <-> $2::vector AS exact_dist
FROM candidates
ORDER BY exact_dist ASC
LIMIT ${k};
      `.trim();
    }

    return `
SELECT id, metadata,
       bit_count(binary_vector # $1::bit) AS hamming_distance
FROM ${tableName}
ORDER BY hamming_distance ASC
LIMIT ${k};
    `.trim();
  }

  /**
   * Generates SQL for PQ search using distance lookup tables.
   *
   * @param tableName - Table name
   * @param k - Number of results
   * @param numSubvectors - Number of PQ subvectors
   * @param useReranking - Whether to rerank
   * @returns Search SQL template
   */
  static pqSearchSQL(
    tableName: string,
    k: number,
    numSubvectors: number = 8,
    useReranking: boolean = true
  ): string {
    // Generate SQL for lookup table based distance computation
    const distanceTerms = Array.from(
      { length: numSubvectors },
      (_, m) => `ruvector_pq_subvector_dist($1, ${m}, get_byte(pq_codes, ${m}))`
    ).join(' + ');

    if (useReranking) {
      const filterK = k * 10;
      return `
WITH candidates AS (
  SELECT id, original_vector, metadata,
         sqrt(${distanceTerms}) AS approx_dist
  FROM ${tableName}
  ORDER BY approx_dist ASC
  LIMIT ${filterK}
)
SELECT id, metadata,
       original_vector <-> $2::vector AS exact_dist
FROM candidates
ORDER BY exact_dist ASC
LIMIT ${k};
      `.trim();
    }

    return `
SELECT id, metadata,
       sqrt(${distanceTerms}) AS distance
FROM ${tableName}
ORDER BY distance ASC
LIMIT ${k};
    `.trim();
  }

  /**
   * Generates SQL for creating PQ lookup tables.
   *
   * @param tableName - Lookup table name
   * @param numSubvectors - Number of subvectors (M)
   * @param numCentroids - Number of centroids (K)
   * @returns CREATE TABLE SQL for lookup tables
   */
  static createPQLookupTables(
    tableName: string,
    numSubvectors: number = 8,
    numCentroids: number = 256
  ): string {
    return `
-- PQ codebooks storage
CREATE TABLE IF NOT EXISTS ${tableName}_codebooks (
  subvector_id INTEGER NOT NULL,
  centroid_id INTEGER NOT NULL,
  centroid vector NOT NULL,
  PRIMARY KEY (subvector_id, centroid_id)
);

-- Precomputed distance lookup (for specific queries)
CREATE TABLE IF NOT EXISTS ${tableName}_distance_lookup (
  query_id BIGINT NOT NULL,
  subvector_id INTEGER NOT NULL,
  centroid_id INTEGER NOT NULL,
  squared_distance REAL NOT NULL,
  PRIMARY KEY (query_id, subvector_id, centroid_id)
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_lookup_query
ON ${tableName}_distance_lookup (query_id, subvector_id);

COMMENT ON TABLE ${tableName}_codebooks IS 'PQ codebooks: M=${numSubvectors}, K=${numCentroids}';
    `.trim();
  }

  /**
   * Generates SQL for inserting PQ codebooks.
   *
   * @param tableName - Base table name
   * @param codebooks - Trained codebooks
   * @returns INSERT SQL for codebooks
   */
  static insertCodebooksSQL(
    tableName: string,
    codebooks: Array<{ centroids: number[][] }>
  ): string {
    const values: string[] = [];

    for (let m = 0; m < codebooks.length; m++) {
      for (let k = 0; k < codebooks[m].centroids.length; k++) {
        const centroidStr = `'[${codebooks[m].centroids[k].join(',')}]'`;
        values.push(`(${m}, ${k}, ${centroidStr}::vector)`);
      }
    }

    return `
INSERT INTO ${tableName}_codebooks (subvector_id, centroid_id, centroid)
VALUES
  ${values.join(',\n  ')}
ON CONFLICT (subvector_id, centroid_id) DO UPDATE
SET centroid = EXCLUDED.centroid;
    `.trim();
  }

  /**
   * Generates SQL function for computing PQ distance.
   *
   * @param functionName - Function name
   * @param numSubvectors - Number of subvectors
   * @returns CREATE FUNCTION SQL
   */
  static createPQDistanceFunction(
    functionName: string = 'pq_asymmetric_distance',
    numSubvectors: number = 8
  ): string {
    return `
CREATE OR REPLACE FUNCTION ${functionName}(
  query_vector vector,
  pq_codes bytea,
  codebook_table text
)
RETURNS real AS $$
DECLARE
  total_distance real := 0;
  m integer;
  code integer;
  subvector_dim integer;
  query_subvector vector;
  centroid vector;
BEGIN
  subvector_dim := vector_dims(query_vector) / ${numSubvectors};

  FOR m IN 0..${numSubvectors - 1} LOOP
    code := get_byte(pq_codes, m);

    -- Extract query subvector
    query_subvector := vector_slice(query_vector, m * subvector_dim, (m + 1) * subvector_dim);

    -- Get centroid from codebook
    EXECUTE format('SELECT centroid FROM %I WHERE subvector_id = $1 AND centroid_id = $2',
                   codebook_table || '_codebooks')
    INTO centroid
    USING m, code;

    -- Add squared distance
    total_distance := total_distance + (query_subvector <-> centroid)^2;
  END LOOP;

  RETURN sqrt(total_distance);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
    `.trim();
  }

  /**
   * Generates SQL for OPQ with rotation.
   *
   * @param tableName - Table name
   * @param dimensions - Vector dimensions
   * @returns SQL for rotation matrix storage
   */
  static createOPQRotationTable(tableName: string, dimensions: number): string {
    return `
-- OPQ rotation matrix storage
CREATE TABLE IF NOT EXISTS ${tableName}_rotation (
  row_id INTEGER NOT NULL,
  col_id INTEGER NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (row_id, col_id)
);

-- Function to apply rotation
CREATE OR REPLACE FUNCTION ${tableName}_rotate_vector(v vector)
RETURNS vector AS $$
DECLARE
  result float8[];
  i integer;
  sum float8;
  j integer;
BEGIN
  result := array_fill(0::float8, ARRAY[${dimensions}]);

  FOR i IN 0..${dimensions - 1} LOOP
    sum := 0;
    FOR j IN 0..${dimensions - 1} LOOP
      SELECT sum + r.value * v[j+1]
      INTO sum
      FROM ${tableName}_rotation r
      WHERE r.row_id = i AND r.col_id = j;
    END LOOP;
    result[i+1] := sum;
  END LOOP;

  RETURN result::vector;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE ${tableName}_rotation IS 'OPQ rotation matrix (${dimensions}x${dimensions})';
    `.trim();
  }

  /**
   * Generates SQL for quantization statistics view.
   *
   * @param tableName - Base table name
   * @returns CREATE VIEW SQL
   */
  static createStatsView(tableName: string): string {
    return `
CREATE OR REPLACE VIEW ${tableName}_quantization_stats AS
SELECT
  pg_total_relation_size('${tableName}'::regclass) AS total_size_bytes,
  pg_relation_size('${tableName}'::regclass) AS table_size_bytes,
  pg_indexes_size('${tableName}'::regclass) AS index_size_bytes,
  (SELECT count(*) FROM ${tableName}) AS row_count,
  CASE
    WHEN (SELECT count(*) FROM ${tableName}) > 0
    THEN pg_relation_size('${tableName}'::regclass)::float / (SELECT count(*) FROM ${tableName})
    ELSE 0
  END AS avg_bytes_per_row;
    `.trim();
  }
}


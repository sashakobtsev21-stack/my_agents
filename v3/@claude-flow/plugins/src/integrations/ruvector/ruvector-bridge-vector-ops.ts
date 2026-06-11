/**
 * RuVector Bridge — vector operations
 *
 * VectorOps: SQL generation + execution for vector CRUD/search/index.
 * Extracted verbatim from ruvector-bridge.ts (lines 485-1051) during the
 * P3.46 god-file decomposition (W167); was module-private and is NOT
 * re-exported by the barrel.
 */

import {
  DEFAULT_VECTOR_COLUMN,
  DISTANCE_OPERATORS,
  INDEX_TYPE_SQL,
} from './ruvector-bridge-internal.js';
import { ConnectionManager } from './ruvector-bridge-connection.js';
import type {
  BatchResult,
  BatchVectorOptions,
  BulkSearchResult,
  DistanceMetric,
  IndexStats,
  RuVectorConfig,
  VectorIndexOptions,
  VectorIndexType,
  VectorInsertOptions,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpdateOptions,
} from './types.js';

// ============================================================================
// Vector Operations
// ============================================================================

/**
 * Provides vector operation methods for search, insert, update, and delete.
 */
export class VectorOps {
  private readonly connectionManager: ConnectionManager;
  private readonly config: RuVectorConfig;

  constructor(connectionManager: ConnectionManager, config: RuVectorConfig) {
    this.connectionManager = connectionManager;
    this.config = config;
  }

  /**
   * Perform vector similarity search.
   */
  async search(options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const tableName = options.tableName ?? 'vectors';
    const vectorColumn = options.vectorColumn ?? DEFAULT_VECTOR_COLUMN;
    const metric = options.metric ?? 'cosine';
    const operator = DISTANCE_OPERATORS[metric] ?? '<=>';

    // Build query vector string
    const queryVector = this.formatVector(options.query);

    // Set HNSW parameters if specified
    if (options.efSearch) {
      await this.connectionManager.query(
        `SET LOCAL hnsw.ef_search = ${options.efSearch}`
      );
    }

    // Set IVF probes if specified
    if (options.probes) {
      await this.connectionManager.query(
        `SET LOCAL ivfflat.probes = ${options.probes}`
      );
    }

    // Build SELECT clause
    const selectColumns = options.selectColumns ?? ['id'];
    const columnList = [...selectColumns];

    if (options.includeVector) {
      columnList.push(vectorColumn);
    }
    if (options.includeMetadata) {
      columnList.push('metadata');
    }

    // Add distance/similarity calculation
    const distanceExpr = `${vectorColumn} ${operator} '${queryVector}'::vector`;
    columnList.push(`(${distanceExpr}) as distance`);

    // Build WHERE clause
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.threshold !== undefined) {
      if (metric === 'cosine' || metric === 'dot') {
        // For similarity metrics, higher is better
        whereClauses.push(`(1 - (${distanceExpr})) >= $${paramIndex++}`);
        params.push(options.threshold);
      } else {
        // For distance metrics, lower is better
        whereClauses.push(`(${distanceExpr}) <= $${paramIndex++}`);
        params.push(options.threshold);
      }
    }

    if (options.maxDistance !== undefined) {
      whereClauses.push(`(${distanceExpr}) <= $${paramIndex++}`);
      params.push(options.maxDistance);
    }

    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (key === 'metadata') {
          // JSONB containment
          whereClauses.push(`metadata @> $${paramIndex++}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          whereClauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    if (options.whereClause) {
      whereClauses.push(`(${options.whereClause})`);
      if (options.whereParams) {
        // Re-index parameters in the custom WHERE clause
        const reindexed = options.whereParams.map(() => `$${paramIndex++}`);
        params.push(...options.whereParams);
      }
    }

    // Build final query
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';
    let sql = `SELECT ${columnList.join(', ')} FROM ${schemaPrefix}${this.escapeIdentifier(tableName)}`;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY ${distanceExpr} ASC`;
    sql += ` LIMIT ${options.k}`;

    const result = await this.connectionManager.query<{
      id: string | number;
      distance: number;
      [key: string]: unknown;
    }>(sql, params, options.timeoutMs);

    // Transform results
    return result.rows.map((row, index) => {
      const score = metric === 'cosine' || metric === 'dot'
        ? 1 - (row.distance as number)
        : 1 / (1 + (row.distance as number));

      const searchResult: VectorSearchResult = {
        id: row.id,
        score,
        distance: row.distance as number,
        rank: index + 1,
        retrievedAt: new Date(),
      };

      if (options.includeVector && row[vectorColumn]) {
        (searchResult as { vector?: number[] }).vector = this.parseVector(row[vectorColumn] as string);
      }

      if (options.includeMetadata && row.metadata) {
        (searchResult as { metadata?: Record<string, unknown> }).metadata = row.metadata as Record<string, unknown>;
      }

      return searchResult;
    });
  }

  /**
   * Perform batch vector search.
   */
  async batchSearch(options: BatchVectorOptions): Promise<BulkSearchResult> {
    const startTime = Date.now();
    const results: VectorSearchResult[][] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    const concurrency = options.concurrency ?? 4;
    const queries = options.queries;

    // Process queries in parallel batches
    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(query =>
          this.search({
            query,
            k: options.k,
            metric: options.metric,
            filter: options.filter,
            tableName: options.tableName,
            vectorColumn: options.vectorColumn,
          })
        )
      );
      results.push(...batchResults);
      cacheMisses += batch.length; // No caching implemented yet
    }

    const totalDurationMs = Date.now() - startTime;

    return {
      results,
      totalDurationMs,
      avgDurationMs: totalDurationMs / queries.length,
      cacheStats: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: cacheHits / (cacheHits + cacheMisses) || 0,
      },
    };
  }

  /**
   * Insert vectors.
   */
  async insert(options: VectorInsertOptions): Promise<BatchResult<string>> {
    const startTime = Date.now();
    const tableName = options.tableName;
    const vectorColumn = options.vectorColumn ?? DEFAULT_VECTOR_COLUMN;
    const batchSize = options.batchSize ?? 100;

    const successful: string[] = [];
    const errors: Array<{ index: number; message: string; input?: unknown }> = [];
    let insertedCount = 0;

    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';

    // Process in batches
    for (let i = 0; i < options.vectors.length; i += batchSize) {
      const batch = options.vectors.slice(i, i + batchSize);

      try {
        // Build multi-row INSERT
        const values: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const item of batch) {
          const vector = this.formatVector(item.vector);
          const metadata = item.metadata ? JSON.stringify(item.metadata) : null;

          if (item.id !== undefined) {
            values.push(`($${paramIndex++}, '${vector}'::vector, $${paramIndex++}::jsonb)`);
            params.push(item.id, metadata);
          } else {
            values.push(`(gen_random_uuid(), '${vector}'::vector, $${paramIndex++}::jsonb)`);
            params.push(metadata);
          }
        }

        let sql = `INSERT INTO ${schemaPrefix}${this.escapeIdentifier(tableName)} `;
        sql += `(id, ${this.escapeIdentifier(vectorColumn)}, metadata) VALUES ${values.join(', ')}`;

        if (options.upsert) {
          const conflictCols = options.conflictColumns ?? ['id'];
          sql += ` ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET `;
          sql += `${this.escapeIdentifier(vectorColumn)} = EXCLUDED.${this.escapeIdentifier(vectorColumn)}, `;
          sql += `metadata = EXCLUDED.metadata`;
        }

        if (options.returning) {
          sql += ' RETURNING id';
        }

        const result = await this.connectionManager.query<{ id: string }>(sql, params);

        if (options.returning && result.rows) {
          successful.push(...result.rows.map(r => String(r.id)));
        }

        insertedCount += batch.length;
      } catch (error) {
        if (options.skipInvalid) {
          // Try inserting individually
          for (let j = 0; j < batch.length; j++) {
            try {
              const item = batch[j];
              const vector = this.formatVector(item.vector);
              const metadata = item.metadata ? JSON.stringify(item.metadata) : null;

              const sql = `INSERT INTO ${schemaPrefix}${this.escapeIdentifier(tableName)} ` +
                `(id, ${this.escapeIdentifier(vectorColumn)}, metadata) VALUES ` +
                `($1, '${vector}'::vector, $2::jsonb)` +
                (options.returning ? ' RETURNING id' : '');

              const result = await this.connectionManager.query<{ id: string }>(
                sql,
                [item.id ?? null, metadata]
              );

              if (options.returning && result.rows.length > 0) {
                successful.push(String(result.rows[0].id));
              }
              insertedCount++;
            } catch (itemError) {
              errors.push({
                index: i + j,
                message: (itemError as Error).message,
                input: batch[j],
              });
            }
          }
        } else {
          errors.push({
            index: i,
            message: (error as Error).message,
          });
          break;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      total: options.vectors.length,
      successful: insertedCount,
      failed: options.vectors.length - insertedCount,
      results: options.returning ? successful : undefined,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
      throughput: insertedCount / (durationMs / 1000),
    };
  }

  /**
   * Update a vector.
   */
  async update(options: VectorUpdateOptions): Promise<boolean> {
    const tableName = options.tableName;
    const vectorColumn = options.vectorColumn ?? DEFAULT_VECTOR_COLUMN;
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.vector) {
      const vector = this.formatVector(options.vector);
      setClauses.push(`${this.escapeIdentifier(vectorColumn)} = '${vector}'::vector`);
    }

    if (options.metadata) {
      if (options.mergeMetadata) {
        setClauses.push(`metadata = metadata || $${paramIndex++}::jsonb`);
      } else {
        setClauses.push(`metadata = $${paramIndex++}::jsonb`);
      }
      params.push(JSON.stringify(options.metadata));
    }

    if (setClauses.length === 0) {
      return false;
    }

    params.push(options.id);
    const sql = `UPDATE ${schemaPrefix}${this.escapeIdentifier(tableName)} ` +
      `SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;

    const result = await this.connectionManager.query(sql, params);
    return (result.affectedRows ?? 0) > 0;
  }

  /**
   * Delete a vector.
   */
  async delete(tableName: string, id: string | number): Promise<boolean> {
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';
    const sql = `DELETE FROM ${schemaPrefix}${this.escapeIdentifier(tableName)} WHERE id = $1`;
    const result = await this.connectionManager.query(sql, [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  /**
   * Bulk delete vectors.
   */
  async bulkDelete(tableName: string, ids: Array<string | number>): Promise<BatchResult> {
    const startTime = Date.now();
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `DELETE FROM ${schemaPrefix}${this.escapeIdentifier(tableName)} WHERE id IN (${placeholders})`;

    const result = await this.connectionManager.query(sql, ids);
    const durationMs = Date.now() - startTime;
    const deleted = result.affectedRows ?? 0;

    return {
      total: ids.length,
      successful: deleted,
      failed: ids.length - deleted,
      durationMs,
      throughput: deleted / (durationMs / 1000),
    };
  }

  /**
   * Create a vector index.
   */
  async createIndex(options: VectorIndexOptions): Promise<void> {
    const indexType = INDEX_TYPE_SQL[options.indexType];
    if (!indexType && options.indexType !== 'flat') {
      throw new Error(`Unsupported index type: ${options.indexType}`);
    }

    const indexName = options.indexName ??
      `idx_${options.tableName}_${options.columnName}_${options.indexType}`;
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';

    if (options.replace) {
      await this.connectionManager.query(
        `DROP INDEX IF EXISTS ${schemaPrefix}${this.escapeIdentifier(indexName)}`
      );
    }

    if (options.indexType === 'flat') {
      return; // No index needed for brute force
    }

    // Build operator class based on metric
    const opClass = this.getOperatorClass(options.metric ?? 'cosine', options.indexType);

    // Build WITH clause for index parameters
    const withParams: string[] = [];
    if (options.m !== undefined) {
      withParams.push(`m = ${options.m}`);
    }
    if (options.efConstruction !== undefined) {
      withParams.push(`ef_construction = ${options.efConstruction}`);
    }
    if (options.lists !== undefined) {
      withParams.push(`lists = ${options.lists}`);
    }

    const withClause = withParams.length > 0 ? ` WITH (${withParams.join(', ')})` : '';
    const concurrent = options.concurrent ? 'CONCURRENTLY ' : '';

    const sql = `CREATE INDEX ${concurrent}${this.escapeIdentifier(indexName)} ` +
      `ON ${schemaPrefix}${this.escapeIdentifier(options.tableName)} ` +
      `USING ${indexType} (${this.escapeIdentifier(options.columnName)} ${opClass})${withClause}`;

    await this.connectionManager.query(sql);
  }

  /**
   * Drop an index.
   */
  async dropIndex(indexName: string): Promise<void> {
    const schemaPrefix = this.config.schema ? `${this.escapeIdentifier(this.config.schema)}.` : '';
    await this.connectionManager.query(
      `DROP INDEX IF EXISTS ${schemaPrefix}${this.escapeIdentifier(indexName)}`
    );
  }

  /**
   * Rebuild an index.
   */
  async rebuildIndex(indexName: string): Promise<void> {
    await this.connectionManager.query(`REINDEX INDEX ${this.escapeIdentifier(indexName)}`);
  }

  /**
   * Get index statistics.
   */
  async getIndexStats(indexName: string): Promise<IndexStats> {
    const result = await this.connectionManager.query<{
      indexrelname: string;
      idx_scan: number;
      idx_tup_read: number;
      idx_tup_fetch: number;
      pg_relation_size: number;
    }>(
      `SELECT
        indexrelname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_relation_size(indexrelid) as pg_relation_size
      FROM pg_stat_user_indexes
      WHERE indexrelname = $1`,
      [indexName]
    );

    if (result.rows.length === 0) {
      throw new Error(`Index ${indexName} not found`);
    }

    const row = result.rows[0];
    return {
      indexName: row.indexrelname,
      indexType: 'hnsw', // Would need additional query to determine
      numVectors: row.idx_tup_read,
      sizeBytes: row.pg_relation_size,
      buildTimeMs: 0, // Not available from stats
      lastRebuild: new Date(),
      params: {
        scans: row.idx_scan,
        tuplesRead: row.idx_tup_read,
        tuplesFetched: row.idx_tup_fetch,
      },
    };
  }

  /**
   * List all indices for a table.
   */
  async listIndices(tableName?: string): Promise<IndexStats[]> {
    let sql = `SELECT
      indexrelname,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch,
      pg_relation_size(indexrelid) as pg_relation_size
    FROM pg_stat_user_indexes`;

    const params: unknown[] = [];
    if (tableName) {
      sql += ` WHERE relname = $1`;
      params.push(tableName);
    }

    const result = await this.connectionManager.query<{
      indexrelname: string;
      idx_scan: number;
      idx_tup_read: number;
      idx_tup_fetch: number;
      pg_relation_size: number;
    }>(sql, params);

    return result.rows.map(row => ({
      indexName: row.indexrelname,
      indexType: 'hnsw' as VectorIndexType,
      numVectors: row.idx_tup_read,
      sizeBytes: row.pg_relation_size,
      buildTimeMs: 0,
      lastRebuild: new Date(),
      params: {
        scans: row.idx_scan,
        tuplesRead: row.idx_tup_read,
        tuplesFetched: row.idx_tup_fetch,
      },
    }));
  }

  /**
   * Get operator class for index creation.
   */
  private getOperatorClass(metric: DistanceMetric, indexType: VectorIndexType): string {
    const opClasses: Record<string, Record<string, string>> = {
      hnsw: {
        cosine: 'vector_cosine_ops',
        euclidean: 'vector_l2_ops',
        dot: 'vector_ip_ops',
      },
      ivfflat: {
        cosine: 'vector_cosine_ops',
        euclidean: 'vector_l2_ops',
        dot: 'vector_ip_ops',
      },
    };

    return opClasses[indexType]?.[metric] ?? 'vector_cosine_ops';
  }

  /**
   * Format vector for SQL.
   */
  private formatVector(vector: number[] | Float32Array): string {
    const arr = Array.isArray(vector) ? vector : Array.from(vector);
    return `[${arr.join(',')}]`;
  }

  /**
   * Parse vector from SQL result.
   */
  private parseVector(vectorStr: string): number[] {
    // Handle pgvector format: [1,2,3] or {1,2,3}
    const cleaned = vectorStr.replace(/[\[\]{}]/g, '');
    return cleaned.split(',').map(Number);
  }

  /**
   * Escape SQL identifier.
   */
  private escapeIdentifier(identifier: string): string {
    // Basic SQL injection prevention
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}


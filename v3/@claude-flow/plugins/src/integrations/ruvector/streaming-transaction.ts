/**
 * RuVector Streaming — transactions
 *
 * RuVectorTransaction: transactional vector operations with
 * isolation-level control.
 * Extracted verbatim from streaming.ts (lines 792-1294) during the
 * P3.45 god-file decomposition (W166). streaming.ts stays the barrel.
 */

import { EventEmitter } from 'events';
import { DISTANCE_OPERATORS } from './streaming-internal.js';
import type { IsolationLevel, PoolClient } from './streaming-types.js';
import type {
  BatchResult,
  QueryResult,
  VectorInsertOptions,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpdateOptions,
} from './types.js';

// ============================================================================
// RuVectorTransaction Class
// ============================================================================

/**
 * Enhanced transaction support for RuVector operations.
 *
 * Provides transaction management with:
 * - Isolation levels (read_committed, repeatable_read, serializable)
 * - Savepoints for partial rollback
 * - Vector operations within transaction context
 *
 * @example
 * ```typescript
 * const tx = new RuVectorTransaction(client);
 * await tx.begin('serializable');
 *
 * try {
 *   await tx.savepoint('before_insert');
 *   await tx.insert({ tableName: 'vectors', vectors: [...] });
 *
 *   const results = await tx.search({ query: vector, k: 10 });
 *
 *   if (results.length === 0) {
 *     await tx.rollbackToSavepoint('before_insert');
 *   }
 *
 *   await tx.commit();
 * } catch (error) {
 *   await tx.rollback();
 *   throw error;
 * }
 * ```
 */
export class RuVectorTransaction extends EventEmitter {
  private readonly client: PoolClient;
  private readonly schema?: string;
  private readonly defaultTableName: string;
  private transactionId: string | null = null;
  private isActive = false;
  private savepoints: Set<string> = new Set();
  private queryCount = 0;
  private startTime: number | null = null;

  constructor(
    client: PoolClient,
    options: {
      schema?: string;
      defaultTableName?: string;
    } = {}
  ) {
    super();
    this.client = client;
    this.schema = options.schema;
    this.defaultTableName = options.defaultTableName ?? 'vectors';
  }

  // ===========================================================================
  // Transaction Control
  // ===========================================================================

  /**
   * Begin a transaction with optional isolation level.
   *
   * @param isolation - Transaction isolation level
   */
  async begin(isolation?: IsolationLevel): Promise<void> {
    if (this.isActive) {
      throw new Error('Transaction already active');
    }

    this.transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.startTime = Date.now();

    let sql = 'BEGIN';
    if (isolation) {
      sql += ` ISOLATION LEVEL ${isolation.replace('_', ' ').toUpperCase()}`;
    }

    await this.client.query(sql);
    this.isActive = true;
    this.queryCount = 1;

    this.emit('begin', { transactionId: this.transactionId, isolation });
  }

  /**
   * Create a savepoint within the transaction.
   *
   * @param name - Savepoint name
   */
  async savepoint(name: string): Promise<void> {
    this.ensureActive();

    const escapedName = this.escapeIdentifier(name);
    await this.client.query(`SAVEPOINT ${escapedName}`);
    this.savepoints.add(name);
    this.queryCount++;

    this.emit('savepoint', { transactionId: this.transactionId, name });
  }

  /**
   * Rollback to a savepoint.
   *
   * @param name - Savepoint name
   */
  async rollbackToSavepoint(name: string): Promise<void> {
    this.ensureActive();

    if (!this.savepoints.has(name)) {
      throw new Error(`Savepoint '${name}' does not exist`);
    }

    const escapedName = this.escapeIdentifier(name);
    await this.client.query(`ROLLBACK TO SAVEPOINT ${escapedName}`);
    this.queryCount++;

    this.emit('rollback_to_savepoint', { transactionId: this.transactionId, name });
  }

  /**
   * Release a savepoint.
   *
   * @param name - Savepoint name
   */
  async releaseSavepoint(name: string): Promise<void> {
    this.ensureActive();

    if (!this.savepoints.has(name)) {
      throw new Error(`Savepoint '${name}' does not exist`);
    }

    const escapedName = this.escapeIdentifier(name);
    await this.client.query(`RELEASE SAVEPOINT ${escapedName}`);
    this.savepoints.delete(name);
    this.queryCount++;

    this.emit('release_savepoint', { transactionId: this.transactionId, name });
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    this.ensureActive();

    await this.client.query('COMMIT');
    const durationMs = this.startTime ? Date.now() - this.startTime : 0;

    this.emit('commit', {
      transactionId: this.transactionId,
      queryCount: this.queryCount,
      durationMs,
    });

    this.cleanup();
  }

  /**
   * Rollback the transaction.
   */
  async rollback(): Promise<void> {
    if (!this.isActive) {
      return; // Already rolled back or not started
    }

    await this.client.query('ROLLBACK');
    const durationMs = this.startTime ? Date.now() - this.startTime : 0;

    this.emit('rollback', {
      transactionId: this.transactionId,
      queryCount: this.queryCount,
      durationMs,
    });

    this.cleanup();
  }

  // ===========================================================================
  // Vector Operations within Transaction
  // ===========================================================================

  /**
   * Perform vector search within the transaction.
   */
  async search(options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    this.ensureActive();

    const { sql, params } = this.buildSearchQuery(options);
    const result = await this.client.query<{
      id: string | number;
      distance: number;
      [key: string]: unknown;
    }>(sql, params);

    this.queryCount++;

    const metric = options.metric ?? 'cosine';
    return result.rows.map((row, index) => {
      const score = metric === 'cosine' || metric === 'dot'
        ? 1 - row.distance
        : 1 / (1 + row.distance);

      const searchResult: VectorSearchResult = {
        id: row.id,
        score,
        distance: row.distance,
        rank: index + 1,
        retrievedAt: new Date(),
      };

      if (options.includeVector && row[options.vectorColumn ?? 'embedding']) {
        (searchResult as { vector?: number[] }).vector = this.parseVector(
          row[options.vectorColumn ?? 'embedding'] as string
        );
      }

      if (options.includeMetadata && row.metadata) {
        (searchResult as { metadata?: Record<string, unknown> }).metadata =
          row.metadata as Record<string, unknown>;
      }

      return searchResult;
    });
  }

  /**
   * Insert vectors within the transaction.
   */
  async insert(options: VectorInsertOptions): Promise<BatchResult<string>> {
    this.ensureActive();

    const startTime = Date.now();
    const tableName = options.tableName ?? this.defaultTableName;
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

    const successful: string[] = [];
    const errors: Array<{ index: number; message: string; input?: unknown }> = [];

    // Build multi-row INSERT
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const item of options.vectors) {
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

    sql += ' RETURNING id';

    try {
      const result = await this.client.query<{ id: string }>(sql, params);
      this.queryCount++;

      if (result.rows) {
        successful.push(...result.rows.map(r => String(r.id)));
      }
    } catch (error) {
      errors.push({
        index: 0,
        message: (error as Error).message,
      });
    }

    const durationMs = Date.now() - startTime;
    const insertedCount = successful.length;

    return {
      total: options.vectors.length,
      successful: insertedCount,
      failed: options.vectors.length - insertedCount,
      results: successful,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
      throughput: insertedCount / (durationMs / 1000),
    };
  }

  /**
   * Update a vector within the transaction.
   */
  async update(options: VectorUpdateOptions): Promise<boolean> {
    this.ensureActive();

    const tableName = options.tableName ?? this.defaultTableName;
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

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

    const result = await this.client.query(sql, params);
    this.queryCount++;

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete vectors within the transaction.
   *
   * @param ids - IDs to delete
   * @param tableName - Table name (optional)
   * @returns Number of deleted rows
   */
  async delete(ids: (string | number)[], tableName?: string): Promise<number> {
    this.ensureActive();

    const table = tableName ?? this.defaultTableName;
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `DELETE FROM ${schemaPrefix}${this.escapeIdentifier(table)} WHERE id IN (${placeholders})`;

    const result = await this.client.query(sql, ids);
    this.queryCount++;

    return result.rowCount ?? 0;
  }

  /**
   * Execute a raw query within the transaction.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    this.ensureActive();

    const startTime = Date.now();
    const result = await this.client.query<T>(sql, params);
    this.queryCount++;

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      durationMs: Date.now() - startTime,
      command: result.command,
    };
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get transaction status.
   */
  getStatus(): {
    transactionId: string | null;
    isActive: boolean;
    savepoints: string[];
    queryCount: number;
    durationMs: number;
  } {
    return {
      transactionId: this.transactionId,
      isActive: this.isActive,
      savepoints: Array.from(this.savepoints),
      queryCount: this.queryCount,
      durationMs: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Ensure transaction is active.
   */
  private ensureActive(): void {
    if (!this.isActive) {
      throw new Error('Transaction is not active. Call begin() first.');
    }
  }

  /**
   * Build search query SQL.
   */
  private buildSearchQuery(options: VectorSearchOptions): { sql: string; params: unknown[] } {
    const tableName = options.tableName ?? this.defaultTableName;
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const metric = options.metric ?? 'cosine';
    const operator = DISTANCE_OPERATORS[metric] ?? '<=>';

    const queryVector = this.formatVector(options.query);
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

    const selectColumns = options.selectColumns ?? ['id'];
    const columnList = [...selectColumns];

    if (options.includeVector) {
      columnList.push(vectorColumn);
    }
    if (options.includeMetadata) {
      columnList.push('metadata');
    }

    const distanceExpr = `${this.escapeIdentifier(vectorColumn)} ${operator} '${queryVector}'::vector`;
    columnList.push(`(${distanceExpr}) as distance`);

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (key === 'metadata') {
          whereClauses.push(`metadata @> $${paramIndex++}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          whereClauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    let sql = `SELECT ${columnList.join(', ')} FROM ${schemaPrefix}${this.escapeIdentifier(tableName)}`;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY ${distanceExpr} ASC`;
    sql += ` LIMIT ${options.k}`;

    return { sql, params };
  }

  /**
   * Cleanup transaction state.
   */
  private cleanup(): void {
    this.isActive = false;
    this.savepoints.clear();
    this.transactionId = null;
    this.startTime = null;
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
    const cleaned = vectorStr.replace(/[\[\]{}]/g, '');
    return cleaned.split(',').map(Number);
  }

  /**
   * Escape SQL identifier.
   */
  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}


/**
 * RuVector Streaming — cursor stream
 *
 * RuVectorStream: cursor-based streaming reads/searches.
 * Extracted verbatim from streaming.ts (lines 172-791) during the
 * P3.45 god-file decomposition (W166). streaming.ts stays the barrel.
 */

import { EventEmitter } from 'events';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CURSOR_PREFIX,
  DEFAULT_HIGH_WATER_MARK,
  DEFAULT_TIMEOUT_MS,
  DISTANCE_OPERATORS,
} from './streaming-internal.js';
import type {
  InsertResult,
  Pool,
  PoolClient,
  StreamSearchOptions,
  StreamState,
  VectorEntry,
} from './streaming-types.js';
import type { VectorSearchResult } from './types.js';

// ============================================================================
// RuVectorStream Class
// ============================================================================

/**
 * Streaming support for RuVector operations.
 *
 * Provides async generators for streaming large result sets and batch inserts
 * with backpressure handling.
 *
 * @example
 * ```typescript
 * const stream = new RuVectorStream(pool, config);
 *
 * // Stream search results
 * for await (const result of stream.streamSearch({ query: vector, k: 10000 })) {
 *   console.log(result);
 * }
 *
 * // Stream inserts
 * async function* vectorGenerator() {
 *   for (let i = 0; i < 100000; i++) {
 *     yield { vector: generateVector(), metadata: { index: i } };
 *   }
 * }
 *
 * for await (const result of stream.streamInsert(vectorGenerator())) {
 *   console.log(`Inserted: ${result.id}`);
 * }
 * ```
 */
export class RuVectorStream extends EventEmitter {
  private readonly pool: Pool;
  private readonly schema?: string;
  private readonly defaultTableName: string;
  private readonly state: StreamState;
  private activeClient: PoolClient | null = null;
  private activeCursors: Set<string> = new Set();

  constructor(
    pool: Pool,
    options: {
      schema?: string;
      defaultTableName?: string;
      highWaterMark?: number;
    } = {}
  ) {
    super();
    this.pool = pool;
    this.schema = options.schema;
    this.defaultTableName = options.defaultTableName ?? 'vectors';
    this.state = {
      paused: false,
      buffer: [],
      bufferSize: 0,
      highWaterMark: options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK,
      drainPromise: null,
      drainResolve: null,
    };
  }

  // ===========================================================================
  // Stream Search
  // ===========================================================================

  /**
   * Stream large result sets using server-side cursors.
   *
   * @param options - Search options with streaming configuration
   * @yields {VectorSearchResult} Individual search results
   */
  async *streamSearch(options: StreamSearchOptions): AsyncGenerator<VectorSearchResult, void, undefined> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const cursorName = options.cursorName ?? `${DEFAULT_CURSOR_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const useServerCursor = options.useServerCursor ?? true;

    const client = await this.pool.connect();
    this.activeClient = client;
    this.activeCursors.add(cursorName);

    try {
      // Set statement timeout
      await client.query(`SET LOCAL statement_timeout = ${timeout}`);

      if (useServerCursor) {
        // Use server-side cursor for memory efficiency
        yield* this.streamWithCursor(client, options, cursorName, batchSize);
      } else {
        // Use OFFSET/LIMIT pagination (less efficient but simpler)
        yield* this.streamWithPagination(client, options, batchSize);
      }
    } finally {
      // Cleanup
      if (this.activeCursors.has(cursorName)) {
        try {
          await client.query(`CLOSE ${this.escapeIdentifier(cursorName)}`);
        } catch {
          // Cursor may already be closed
        }
        this.activeCursors.delete(cursorName);
      }
      client.release();
      this.activeClient = null;
    }
  }

  /**
   * Stream results using a server-side cursor.
   */
  private async *streamWithCursor(
    client: PoolClient,
    options: StreamSearchOptions,
    cursorName: string,
    batchSize: number
  ): AsyncGenerator<VectorSearchResult, void, undefined> {
    const { sql, params } = this.buildSearchQuery(options);
    const escapedCursor = this.escapeIdentifier(cursorName);

    // Begin transaction for cursor
    await client.query('BEGIN');

    try {
      // Declare cursor
      await client.query(
        `DECLARE ${escapedCursor} CURSOR WITH HOLD FOR ${sql}`,
        params
      );

      let rank = 0;
      let hasMore = true;

      while (hasMore) {
        // Wait if paused (backpressure)
        await this.waitIfPaused();

        // Fetch batch
        const fetchResult = await client.query<{
          id: string | number;
          distance: number;
          [key: string]: unknown;
        }>(
          `FETCH ${batchSize} FROM ${escapedCursor}`
        );

        if (fetchResult.rows.length === 0) {
          hasMore = false;
          break;
        }

        // Yield individual results
        for (const row of fetchResult.rows) {
          rank++;
          const result = this.transformSearchResult(row, options, rank);
          yield result;

          this.emit('result', result);
        }

        // Check if we've received less than batch size (end of results)
        if (fetchResult.rows.length < batchSize) {
          hasMore = false;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Stream results using OFFSET/LIMIT pagination.
   */
  private async *streamWithPagination(
    client: PoolClient,
    options: StreamSearchOptions,
    batchSize: number
  ): AsyncGenerator<VectorSearchResult, void, undefined> {
    const { sql: baseSql, params } = this.buildSearchQuery(options, true);

    let offset = 0;
    let rank = 0;
    let hasMore = true;

    while (hasMore) {
      // Wait if paused (backpressure)
      await this.waitIfPaused();

      const sql = `${baseSql} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await client.query<{
        id: string | number;
        distance: number;
        [key: string]: unknown;
      }>(sql, params);

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of result.rows) {
        rank++;
        const searchResult = this.transformSearchResult(row, options, rank);
        yield searchResult;

        this.emit('result', searchResult);
      }

      offset += batchSize;

      if (result.rows.length < batchSize) {
        hasMore = false;
      }
    }
  }

  /**
   * Build the search query SQL.
   */
  private buildSearchQuery(
    options: StreamSearchOptions,
    forPagination = false
  ): { sql: string; params: unknown[] } {
    const tableName = options.tableName ?? this.defaultTableName;
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const metric = options.metric ?? 'cosine';
    const operator = DISTANCE_OPERATORS[metric] ?? '<=>';

    const queryVector = this.formatVector(options.query);
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

    // Build SELECT columns
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

    // Build WHERE clause
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.threshold !== undefined) {
      if (metric === 'cosine' || metric === 'dot') {
        whereClauses.push(`(1 - (${distanceExpr})) >= $${paramIndex++}`);
        params.push(options.threshold);
      } else {
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
          whereClauses.push(`metadata @> $${paramIndex++}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          whereClauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    // Build query
    let sql = `SELECT ${columnList.join(', ')} FROM ${schemaPrefix}${this.escapeIdentifier(tableName)}`;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY ${distanceExpr} ASC`;

    // For cursor-based streaming, don't add LIMIT (cursor handles it)
    // For pagination, LIMIT/OFFSET will be added by the caller
    if (!forPagination && options.k) {
      sql += ` LIMIT ${options.k}`;
    }

    return { sql, params };
  }

  /**
   * Transform a database row into a VectorSearchResult.
   */
  private transformSearchResult(
    row: { id: string | number; distance: number; [key: string]: unknown },
    options: StreamSearchOptions,
    rank: number
  ): VectorSearchResult {
    const metric = options.metric ?? 'cosine';
    const score = metric === 'cosine' || metric === 'dot'
      ? 1 - row.distance
      : 1 / (1 + row.distance);

    const result: VectorSearchResult = {
      id: row.id,
      score,
      distance: row.distance,
      rank,
      retrievedAt: new Date(),
    };

    if (options.includeVector && row[options.vectorColumn ?? 'embedding']) {
      (result as { vector?: number[] }).vector = this.parseVector(
        row[options.vectorColumn ?? 'embedding'] as string
      );
    }

    if (options.includeMetadata && row.metadata) {
      (result as { metadata?: Record<string, unknown> }).metadata =
        row.metadata as Record<string, unknown>;
    }

    return result;
  }

  // ===========================================================================
  // Stream Insert
  // ===========================================================================

  /**
   * Stream batch inserts for large datasets.
   *
   * @param vectors - Async iterable of vector entries
   * @param options - Insert configuration options
   * @yields {InsertResult} Individual insert results
   */
  async *streamInsert(
    vectors: AsyncIterable<VectorEntry>,
    options: {
      tableName?: string;
      vectorColumn?: string;
      batchSize?: number;
      upsert?: boolean;
      conflictColumns?: string[];
    } = {}
  ): AsyncGenerator<InsertResult, void, undefined> {
    const tableName = options.tableName ?? this.defaultTableName;
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const schemaPrefix = this.schema ? `${this.escapeIdentifier(this.schema)}.` : '';

    let batch: VectorEntry[] = [];
    let batchIndex = 0;
    let totalProcessed = 0;

    const client = await this.pool.connect();
    this.activeClient = client;

    try {
      // Process vectors in batches
      for await (const entry of vectors) {
        // Wait if paused (backpressure)
        await this.waitIfPaused();

        batch.push(entry);

        if (batch.length >= batchSize) {
          // Process batch
          const results = await this.insertBatch(
            client,
            batch,
            tableName,
            vectorColumn,
            schemaPrefix,
            batchIndex,
            options.upsert,
            options.conflictColumns
          );

          for (const result of results) {
            yield result;
            totalProcessed++;
            this.emit('insert', result);
          }

          batch = [];
          batchIndex++;
        }
      }

      // Process remaining items
      if (batch.length > 0) {
        const results = await this.insertBatch(
          client,
          batch,
          tableName,
          vectorColumn,
          schemaPrefix,
          batchIndex,
          options.upsert,
          options.conflictColumns
        );

        for (const result of results) {
          yield result;
          totalProcessed++;
          this.emit('insert', result);
        }
      }

      this.emit('complete', { totalProcessed, batches: batchIndex + 1 });
    } finally {
      client.release();
      this.activeClient = null;
    }
  }

  /**
   * Insert a batch of vectors.
   */
  private async insertBatch(
    client: PoolClient,
    batch: VectorEntry[],
    tableName: string,
    vectorColumn: string,
    schemaPrefix: string,
    batchIndex: number,
    upsert?: boolean,
    conflictColumns?: string[]
  ): Promise<InsertResult[]> {
    const results: InsertResult[] = [];

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

    if (upsert) {
      const conflictCols = conflictColumns ?? ['id'];
      sql += ` ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET `;
      sql += `${this.escapeIdentifier(vectorColumn)} = EXCLUDED.${this.escapeIdentifier(vectorColumn)}, `;
      sql += `metadata = EXCLUDED.metadata`;
    }

    sql += ' RETURNING id';

    try {
      const result = await client.query<{ id: string | number }>(sql, params);

      for (let i = 0; i < result.rows.length; i++) {
        results.push({
          id: result.rows[i].id,
          success: true,
          batchIndex,
          itemIndex: i,
        });
      }
    } catch (error) {
      // On batch failure, try individual inserts
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        try {
          const vector = this.formatVector(item.vector);
          const metadata = item.metadata ? JSON.stringify(item.metadata) : null;

          const singleSql = `INSERT INTO ${schemaPrefix}${this.escapeIdentifier(tableName)} ` +
            `(id, ${this.escapeIdentifier(vectorColumn)}, metadata) VALUES ` +
            `($1, '${vector}'::vector, $2::jsonb) RETURNING id`;

          const singleResult = await client.query<{ id: string | number }>(
            singleSql,
            [item.id ?? null, metadata]
          );

          results.push({
            id: singleResult.rows[0]?.id ?? item.id ?? 'unknown',
            success: true,
            batchIndex,
            itemIndex: i,
          });
        } catch (itemError) {
          results.push({
            id: item.id ?? 'unknown',
            success: false,
            error: (itemError as Error).message,
            batchIndex,
            itemIndex: i,
          });
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // Backpressure Handling
  // ===========================================================================

  /**
   * Pause the stream (backpressure).
   */
  pause(): void {
    this.state.paused = true;
    this.emit('pause');
  }

  /**
   * Resume the stream.
   */
  resume(): void {
    this.state.paused = false;
    if (this.state.drainResolve) {
      this.state.drainResolve();
      this.state.drainResolve = null;
      this.state.drainPromise = null;
    }
    this.emit('resume');
  }

  /**
   * Check if stream is paused.
   */
  isPaused(): boolean {
    return this.state.paused;
  }

  /**
   * Wait if the stream is paused.
   */
  private async waitIfPaused(): Promise<void> {
    if (!this.state.paused) {
      return;
    }

    if (!this.state.drainPromise) {
      this.state.drainPromise = new Promise<void>(resolve => {
        this.state.drainResolve = resolve;
      });
    }

    await this.state.drainPromise;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Abort all active operations.
   */
  async abort(): Promise<void> {
    // Close all active cursors
    if (this.activeClient) {
      const cursors = Array.from(this.activeCursors);
      for (let i = 0; i < cursors.length; i++) {
        const cursorName = cursors[i];
        try {
          await this.activeClient.query(`CLOSE ${this.escapeIdentifier(cursorName)}`);
        } catch {
          // Ignore errors
        }
      }
      this.activeCursors.clear();
    }

    this.emit('abort');
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

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


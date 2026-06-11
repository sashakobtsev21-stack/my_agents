/**
 * RuVector Streaming — batch processor
 *
 * BatchProcessor: chunked concurrent batch operations.
 * Extracted verbatim from streaming.ts (lines 1295-1566) during the
 * P3.45 god-file decomposition (W166). streaming.ts stays the barrel.
 */

import { EventEmitter } from 'events';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  DISTANCE_OPERATORS,
} from './streaming-internal.js';
import type { BatchOptions, Pool } from './streaming-types.js';
import type { VectorSearchOptions, VectorSearchResult } from './types.js';

// ============================================================================
// BatchProcessor Class
// ============================================================================

/**
 * Batch processor for large dataset operations.
 *
 * Provides efficient processing of large datasets with configurable
 * batch sizes, concurrency, and error handling.
 *
 * @example
 * ```typescript
 * const processor = new BatchProcessor(bridge, { batchSize: 500, concurrency: 4 });
 *
 * async function* loadData() {
 *   for (const item of massiveDataset) {
 *     yield item;
 *   }
 * }
 *
 * for await (const result of processor.processBatch(loadData(), async (batch) => {
 *   return batch.map(item => processItem(item));
 * })) {
 *   console.log(result);
 * }
 * ```
 */
export class BatchProcessor extends EventEmitter {
  private readonly pool: Pool;
  private readonly options: Required<BatchOptions>;
  private readonly schema?: string;

  constructor(
    pool: Pool,
    options: BatchOptions & { schema?: string } = {}
  ) {
    super();
    this.pool = pool;
    this.schema = options.schema;
    this.options = {
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      retryOnFailure: options.retryOnFailure ?? true,
      maxRetries: options.maxRetries ?? 3,
      useTransaction: options.useTransaction ?? false,
    };
  }

  /**
   * Process items in batches with custom processor function.
   *
   * @param items - Async iterable of items to process
   * @param processor - Batch processing function
   * @param options - Processing options
   * @yields Processed results
   */
  async *processBatch<T, R>(
    items: AsyncIterable<T>,
    processor: (batch: T[]) => Promise<R[]>,
    options?: {
      batchSize?: number;
      concurrency?: number;
      onBatchComplete?: (batchIndex: number, results: R[]) => void;
    }
  ): AsyncGenerator<R, void, undefined> {
    const batchSize = options?.batchSize ?? this.options.batchSize;
    const concurrency = options?.concurrency ?? this.options.concurrency;

    let batch: T[] = [];
    let batchIndex = 0;
    const pendingBatches: Promise<{ index: number; results: R[] }>[] = [];

    // Process items and accumulate into batches
    for await (const item of items) {
      batch.push(item);

      if (batch.length >= batchSize) {
        const currentBatch = batch;
        const currentIndex = batchIndex;
        batch = [];
        batchIndex++;

        // Add batch to processing queue
        const batchPromise = this.processSingleBatch(
          currentBatch,
          processor,
          currentIndex
        ).then(results => {
          options?.onBatchComplete?.(currentIndex, results);
          return { index: currentIndex, results };
        });

        pendingBatches.push(batchPromise);

        // Yield results when we have enough pending batches
        if (pendingBatches.length >= concurrency) {
          const completed = await Promise.race(
            pendingBatches.map((p, i) => p.then(r => ({ ...r, promiseIndex: i })))
          );

          // Remove completed batch from pending
          pendingBatches.splice(completed.promiseIndex, 1);

          for (const result of completed.results) {
            yield result;
          }
        }
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      const results = await this.processSingleBatch(batch, processor, batchIndex);
      options?.onBatchComplete?.(batchIndex, results);
      for (const result of results) {
        yield result;
      }
    }

    // Wait for remaining pending batches
    const remainingResults = await Promise.all(pendingBatches);
    for (const { results } of remainingResults.sort((a, b) => a.index - b.index)) {
      for (const result of results) {
        yield result;
      }
    }
  }

  /**
   * Perform parallel search across multiple queries.
   *
   * @param queries - Array of query vectors
   * @param options - Search options
   * @returns Array of search results for each query
   */
  async parallelSearch(
    queries: number[][],
    options: Omit<VectorSearchOptions, 'query'>
  ): Promise<VectorSearchResult[][]> {
    const concurrency = this.options.concurrency;
    const results: VectorSearchResult[][] = new Array(queries.length);

    // Process queries in parallel batches
    for (let i = 0; i < queries.length; i += concurrency) {
      const batchQueries = queries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batchQueries.map((query, j) =>
          this.executeSingleSearch({ ...options, query } as VectorSearchOptions)
            .then(r => ({ index: i + j, results: r }))
        )
      );

      for (const { index, results: searchResults } of batchResults) {
        results[index] = searchResults;
      }

      this.emit('batch_search_complete', {
        batchStart: i,
        batchEnd: Math.min(i + concurrency, queries.length),
        total: queries.length,
      });
    }

    return results;
  }

  /**
   * Process a single batch with retry support.
   */
  private async processSingleBatch<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchIndex: number
  ): Promise<R[]> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.options.maxRetries) {
      attempt++;
      try {
        const results = await processor(batch);
        this.emit('batch_complete', { batchIndex, attempt, success: true });
        return results;
      } catch (error) {
        lastError = error as Error;
        this.emit('batch_error', { batchIndex, attempt, error: lastError });

        if (!this.options.retryOnFailure || attempt >= this.options.maxRetries) {
          break;
        }

        // Exponential backoff
        await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
      }
    }

    throw new Error(`Batch ${batchIndex} failed after ${attempt} attempts: ${lastError?.message}`);
  }

  /**
   * Execute a single search query.
   */
  private async executeSingleSearch(
    options: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const client = await this.pool.connect();
    try {
      const { sql, params } = this.buildSearchQuery(options);
      const result = await client.query<{
        id: string | number;
        distance: number;
        [key: string]: unknown;
      }>(sql, params);

      const metric = options.metric ?? 'cosine';
      return result.rows.map((row, index) => {
        const score = metric === 'cosine' || metric === 'dot'
          ? 1 - row.distance
          : 1 / (1 + row.distance);

        return {
          id: row.id,
          score,
          distance: row.distance,
          rank: index + 1,
          retrievedAt: new Date(),
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Build search query SQL.
   */
  private buildSearchQuery(options: VectorSearchOptions): { sql: string; params: unknown[] } {
    const tableName = options.tableName ?? 'vectors';
    const vectorColumn = options.vectorColumn ?? 'embedding';
    const metric = options.metric ?? 'cosine';
    const operator = DISTANCE_OPERATORS[metric] ?? '<=>';

    const queryVector = this.formatVector(options.query);
    const schemaPrefix = this.schema ? `"${this.schema}".` : '';

    const selectColumns = options.selectColumns ?? ['id'];
    const distanceExpr = `"${vectorColumn}" ${operator} '${queryVector}'::vector`;

    let sql = `SELECT ${selectColumns.join(', ')}, (${distanceExpr}) as distance ` +
      `FROM ${schemaPrefix}"${tableName}" ` +
      `ORDER BY ${distanceExpr} ASC ` +
      `LIMIT ${options.k}`;

    return { sql, params: [] };
  }

  /**
   * Format vector for SQL.
   */
  private formatVector(vector: number[] | Float32Array): string {
    const arr = Array.isArray(vector) ? vector : Array.from(vector);
    return `[${arr.join(',')}]`;
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


/**
 * RuVector Bridge — plugin core
 *
 * RuVectorBridge: the BasePlugin implementation wiring ConnectionManager
 * and VectorOps into MCP tools. Extracted verbatim from
 * ruvector-bridge.ts (lines 1052-1973) during the P3.46 god-file
 * decomposition (W167). ruvector-bridge.ts stays the barrel.
 */

import { BasePlugin } from '../../core/base-plugin.js';
import type { MCPToolDefinition, MCPToolResult } from '../../types/index.js';
import {
  PLUGIN_NAME,
  PLUGIN_VERSION,
  SLOW_QUERY_THRESHOLD_MS,
} from './ruvector-bridge-internal.js';
import type { Pool, RuVectorMetrics } from './ruvector-bridge-internal.js';
import { ConnectionManager } from './ruvector-bridge-connection.js';
import { VectorOps } from './ruvector-bridge-vector-ops.js';
import type {
  BatchResult,
  BatchVectorOptions,
  BulkSearchResult,
  IndexStats,
  RuVectorConfig,
  RuVectorEventType,
  RuVectorStats,
  VectorIndexOptions,
  VectorIndexType,
  VectorInsertOptions,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpdateOptions,
} from './types.js';

// ============================================================================
// RuVector Bridge Plugin
// ============================================================================

/**
 * RuVector PostgreSQL Bridge Plugin for Claude-Flow v3.
 *
 * Provides comprehensive vector database integration with:
 * - Connection pooling and management
 * - Vector similarity search (HNSW, IVF)
 * - Batch operations for high throughput
 * - Index creation and management
 * - MCP tool integration
 * - Event-driven architecture
 * - Production-ready error handling and metrics
 *
 * @example
 * ```typescript
 * const bridge = new RuVectorBridge({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'vectors',
 *   user: 'postgres',
 *   password: 'password',
 *   poolSize: 10,
 * });
 *
 * await bridge.initialize(context);
 *
 * const results = await bridge.vectorSearch({
 *   query: [0.1, 0.2, 0.3, ...],
 *   k: 10,
 *   metric: 'cosine',
 *   tableName: 'embeddings',
 * });
 * ```
 */
export class RuVectorBridge extends BasePlugin {
  private readonly ruVectorConfig: RuVectorConfig;
  private connectionManager: ConnectionManager | null = null;
  private vectorOps: VectorOps | null = null;
  private metrics: RuVectorMetrics;
  private initTime: Date | null = null;

  constructor(config: RuVectorConfig) {
    super({
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'RuVector PostgreSQL Bridge for Claude-Flow v3 - Advanced vector database integration',
      tags: ['database', 'vector', 'postgresql', 'search', 'embeddings'],
    });

    this.ruVectorConfig = config;
    this.metrics = this.createInitialMetrics();
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Initialize the plugin and establish database connection.
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing RuVector PostgreSQL Bridge...');
    this.initTime = new Date();

    // Create connection manager
    this.connectionManager = new ConnectionManager(this.ruVectorConfig);

    // Forward connection events
    this.forwardConnectionEvents();

    // Initialize connection pool
    try {
      const connectionResult = await this.connectionManager.initialize();
      this.logger.info(`Connected to PostgreSQL: ${connectionResult.serverVersion}`);
      this.logger.info(`RuVector extension version: ${connectionResult.ruVectorVersion}`);

      // Initialize vector operations
      this.vectorOps = new VectorOps(this.connectionManager, this.ruVectorConfig);

      // Ensure pgvector extension is available
      await this.ensureExtension();

      this.eventBus.emit('ruvector:initialized', {
        connectionResult,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize RuVector Bridge', error);
      throw error;
    }
  }

  /**
   * Shutdown the plugin and close database connections.
   */
  protected async onShutdown(): Promise<void> {
    this.logger.info('Shutting down RuVector PostgreSQL Bridge...');

    if (this.connectionManager) {
      await this.connectionManager.shutdown();
      this.connectionManager = null;
    }

    this.vectorOps = null;

    this.eventBus.emit('ruvector:shutdown', {
      uptime: this.getUptime(),
      metrics: this.metrics,
      timestamp: new Date(),
    });
  }

  /**
   * Perform health check.
   */
  protected async onHealthCheck(): Promise<Record<string, { healthy: boolean; message?: string; latencyMs?: number }>> {
    const checks: Record<string, { healthy: boolean; message?: string; latencyMs?: number }> = {};

    // Check connection pool
    if (this.connectionManager?.isHealthy()) {
      const poolStats = this.connectionManager.getPoolStats();
      checks['connection_pool'] = {
        healthy: true,
        message: `Pool size: ${poolStats.poolSize}, available: ${poolStats.availableConnections}`,
      };
    } else {
      checks['connection_pool'] = {
        healthy: false,
        message: 'Connection pool not initialized or unhealthy',
      };
    }

    // Check database connectivity with a simple query
    if (this.connectionManager) {
      const startTime = Date.now();
      try {
        await this.connectionManager.query('SELECT 1');
        checks['database'] = {
          healthy: true,
          message: 'Database responding',
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        checks['database'] = {
          healthy: false,
          message: `Database error: ${(error as Error).message}`,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // Check pgvector extension
    if (this.connectionManager) {
      try {
        const result = await this.connectionManager.query<{ extversion: string }>(
          "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
        );
        checks['pgvector'] = {
          healthy: result.rows.length > 0,
          message: result.rows.length > 0
            ? `pgvector version: ${result.rows[0].extversion}`
            : 'pgvector extension not found',
        };
      } catch (error) {
        checks['pgvector'] = {
          healthy: false,
          message: `Error checking pgvector: ${(error as Error).message}`,
        };
      }
    }

    return checks;
  }

  // ===========================================================================
  // MCP Tools Registration
  // ===========================================================================

  /**
   * Register MCP tools for vector operations.
   */
  override registerMCPTools(): MCPToolDefinition[] {
    return [
      // Vector Search Tool
      {
        name: 'ruvector_search',
        description: 'Search for similar vectors using HNSW or IVF indexing. Supports cosine, euclidean, and dot product distance metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'array',
              items: { type: 'number' },
              description: 'Query vector for similarity search',
            },
            k: {
              type: 'number',
              description: 'Number of nearest neighbors to return',
              default: 10,
            },
            metric: {
              type: 'string',
              enum: ['cosine', 'euclidean', 'dot'],
              description: 'Distance metric to use',
              default: 'cosine',
            },
            tableName: {
              type: 'string',
              description: 'Table to search in',
              default: 'vectors',
            },
            filter: {
              type: 'object',
              description: 'Metadata filters',
            },
            threshold: {
              type: 'number',
              description: 'Minimum similarity threshold',
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include metadata in results',
              default: true,
            },
          },
          required: ['query', 'k'],
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            const results = await this.vectorSearch(input as unknown as VectorSearchOptions);
            this.metrics.searchesPerformed++;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, results, count: results.length }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Vector Insert Tool
      {
        name: 'ruvector_insert',
        description: 'Insert vectors into a table. Supports batch insertion and upsert.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Target table name',
            },
            vectors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  vector: { type: 'array', items: { type: 'number' } },
                  metadata: { type: 'object' },
                },
                required: ['vector'],
              },
              description: 'Vectors to insert',
            },
            upsert: {
              type: 'boolean',
              description: 'Update on conflict',
              default: false,
            },
          },
          required: ['tableName', 'vectors'],
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            const result = await this.vectorInsert(input as unknown as VectorInsertOptions);
            this.metrics.vectorsInserted += result.successful;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, ...result }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Vector Update Tool
      {
        name: 'ruvector_update',
        description: 'Update an existing vector and/or its metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Table name',
            },
            id: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              description: 'Vector ID to update',
            },
            vector: {
              type: 'array',
              items: { type: 'number' },
              description: 'New vector value',
            },
            metadata: {
              type: 'object',
              description: 'New or updated metadata',
            },
            mergeMetadata: {
              type: 'boolean',
              description: 'Merge with existing metadata',
              default: false,
            },
          },
          required: ['tableName', 'id'],
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            const updated = await this.vectorUpdate(input as unknown as VectorUpdateOptions);
            if (updated) this.metrics.vectorsUpdated++;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, updated }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Vector Delete Tool
      {
        name: 'ruvector_delete',
        description: 'Delete vectors by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Table name',
            },
            id: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              description: 'Vector ID to delete',
            },
            ids: {
              type: 'array',
              items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
              description: 'Multiple vector IDs to delete',
            },
          },
          required: ['tableName'],
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            const { tableName, id, ids } = input as { tableName: string; id?: string | number; ids?: Array<string | number> };

            if (ids && ids.length > 0) {
              const result = await this.vectorBulkDelete(tableName, ids);
              this.metrics.vectorsDeleted += result.successful;
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, ...result }, null, 2),
                }],
              };
            } else if (id !== undefined) {
              const deleted = await this.vectorDelete(tableName, id);
              if (deleted) this.metrics.vectorsDeleted++;
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, deleted }, null, 2),
                }],
              };
            } else {
              return this.createErrorResult(new Error('Either id or ids must be provided'));
            }
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Index Create Tool
      {
        name: 'ruvector_create_index',
        description: 'Create a vector index (HNSW or IVF) for faster similarity search.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Table name',
            },
            columnName: {
              type: 'string',
              description: 'Vector column name',
              default: 'embedding',
            },
            indexType: {
              type: 'string',
              enum: ['hnsw', 'ivfflat'],
              description: 'Index type',
              default: 'hnsw',
            },
            metric: {
              type: 'string',
              enum: ['cosine', 'euclidean', 'dot'],
              description: 'Distance metric',
              default: 'cosine',
            },
            m: {
              type: 'number',
              description: 'HNSW M parameter (max connections per layer)',
              default: 16,
            },
            efConstruction: {
              type: 'number',
              description: 'HNSW ef_construction parameter',
              default: 200,
            },
            lists: {
              type: 'number',
              description: 'IVF lists parameter',
            },
            concurrent: {
              type: 'boolean',
              description: 'Create index concurrently (non-blocking)',
              default: true,
            },
          },
          required: ['tableName', 'columnName', 'indexType'],
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            await this.createIndex(input as unknown as VectorIndexOptions);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Index created successfully' }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Index Stats Tool
      {
        name: 'ruvector_index_stats',
        description: 'Get statistics for vector indices.',
        inputSchema: {
          type: 'object',
          properties: {
            indexName: {
              type: 'string',
              description: 'Specific index name (optional)',
            },
            tableName: {
              type: 'string',
              description: 'Filter by table name (optional)',
            },
          },
        },
        handler: async (input): Promise<MCPToolResult> => {
          try {
            const { indexName, tableName } = input as { indexName?: string; tableName?: string };

            if (indexName) {
              const stats = await this.getIndexStats(indexName);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, stats }, null, 2),
                }],
              };
            } else {
              const indices = await this.listIndices(tableName);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, indices, count: indices.length }, null, 2),
                }],
              };
            }
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Health Check Tool
      {
        name: 'ruvector_health',
        description: 'Check the health status of the RuVector connection and database.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler: async (): Promise<MCPToolResult> => {
          try {
            const health = await this.healthCheck();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, health }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },

      // Metrics Tool
      {
        name: 'ruvector_metrics',
        description: 'Get performance metrics and statistics.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler: async (): Promise<MCPToolResult> => {
          try {
            const stats = await this.getStats();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, metrics: this.metrics, stats }, null, 2),
              }],
            };
          } catch (error) {
            return this.createErrorResult(error as Error);
          }
        },
      },
    ];
  }

  // ===========================================================================
  // Public Vector Operation Methods
  // ===========================================================================

  /**
   * Perform vector similarity search.
   */
  async vectorSearch(options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const results = await this.vectorOps!.search(options);
      this.updateQueryMetrics(true, Date.now() - startTime);

      this.emit('search:complete', {
        searchId: `search-${Date.now()}`,
        durationMs: Date.now() - startTime,
        resultCount: results.length,
        scannedCount: results.length,
        cacheHit: false,
      });

      return results;
    } catch (error) {
      this.updateQueryMetrics(false, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Perform batch vector search.
   */
  async vectorBatchSearch(options: BatchVectorOptions): Promise<BulkSearchResult> {
    this.ensureInitialized();
    return this.vectorOps!.batchSearch(options);
  }

  /**
   * Insert vectors.
   */
  async vectorInsert(options: VectorInsertOptions): Promise<BatchResult<string>> {
    this.ensureInitialized();
    const result = await this.vectorOps!.insert(options);

    this.emit('vector:batch_complete', {
      tableName: options.tableName,
      count: result.total,
      durationMs: result.durationMs,
      successCount: result.successful,
      failedCount: result.failed,
    });

    return result;
  }

  /**
   * Update a vector.
   */
  async vectorUpdate(options: VectorUpdateOptions): Promise<boolean> {
    this.ensureInitialized();
    const updated = await this.vectorOps!.update(options);

    if (updated) {
      this.emit('vector:updated', {
        tableName: options.tableName,
        vectorId: options.id,
        dimensions: options.vector?.length ?? 0,
      });
    }

    return updated;
  }

  /**
   * Delete a vector.
   */
  async vectorDelete(tableName: string, id: string | number): Promise<boolean> {
    this.ensureInitialized();
    const deleted = await this.vectorOps!.delete(tableName, id);

    if (deleted) {
      this.emit('vector:deleted', {
        tableName,
        vectorId: id,
        dimensions: 0,
      });
    }

    return deleted;
  }

  /**
   * Bulk delete vectors.
   */
  async vectorBulkDelete(tableName: string, ids: Array<string | number>): Promise<BatchResult> {
    this.ensureInitialized();
    return this.vectorOps!.bulkDelete(tableName, ids);
  }

  /**
   * Create a vector index.
   */
  async createIndex(options: VectorIndexOptions): Promise<void> {
    this.ensureInitialized();
    await this.vectorOps!.createIndex(options);

    this.emit('index:created', {
      indexName: options.indexName ?? `idx_${options.tableName}_${options.columnName}`,
      tableName: options.tableName,
      columnName: options.columnName,
      indexType: options.indexType,
    });
  }

  /**
   * Drop an index.
   */
  async dropIndex(indexName: string): Promise<void> {
    this.ensureInitialized();
    await this.vectorOps!.dropIndex(indexName);

    this.emit('index:dropped', {
      indexName,
      tableName: '',
      columnName: '',
      indexType: 'hnsw' as VectorIndexType,
    });
  }

  /**
   * Rebuild an index.
   */
  async rebuildIndex(indexName: string): Promise<void> {
    this.ensureInitialized();
    await this.vectorOps!.rebuildIndex(indexName);

    this.emit('index:rebuilt', {
      indexName,
      tableName: '',
      columnName: '',
      indexType: 'hnsw' as VectorIndexType,
    });
  }

  /**
   * Get index statistics.
   */
  async getIndexStats(indexName: string): Promise<IndexStats> {
    this.ensureInitialized();
    return this.vectorOps!.getIndexStats(indexName);
  }

  /**
   * List all indices.
   */
  async listIndices(tableName?: string): Promise<IndexStats[]> {
    this.ensureInitialized();
    return this.vectorOps!.listIndices(tableName);
  }

  /**
   * Get RuVector statistics.
   */
  async getStats(): Promise<RuVectorStats> {
    this.ensureInitialized();

    const poolStats = this.connectionManager!.getPoolStats();

    // Query for vector statistics
    const result = await this.connectionManager!.query<{
      table_count: number;
      total_vectors: number;
      total_size: number;
      index_count: number;
    }>(`
      SELECT
        COUNT(DISTINCT c.relname) as table_count,
        COALESCE(SUM(c.reltuples), 0)::bigint as total_vectors,
        COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint as total_size,
        COUNT(DISTINCT i.indexrelid) as index_count
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_index i ON i.indrelid = c.oid
      WHERE a.atttypid = 'vector'::regtype
        AND c.relkind = 'r'
    `);

    const stats = result.rows[0] ?? {
      table_count: 0,
      total_vectors: 0,
      total_size: 0,
      index_count: 0,
    };

    return {
      version: PLUGIN_VERSION,
      totalVectors: Number(stats.total_vectors),
      totalSizeBytes: Number(stats.total_size),
      numIndices: Number(stats.index_count),
      numTables: Number(stats.table_count),
      queryStats: {
        totalQueries: this.metrics.queriesTotal,
        avgQueryTimeMs: this.metrics.avgQueryTimeMs,
        p95QueryTimeMs: this.metrics.avgQueryTimeMs * 1.5, // Approximation
        p99QueryTimeMs: this.metrics.avgQueryTimeMs * 2,   // Approximation
        cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      },
      memoryStats: {
        usedBytes: 0, // Would need OS-level access
        peakBytes: 0,
        indexBytes: Number(stats.total_size),
        cacheBytes: 0,
      },
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Ensure the plugin is initialized.
   */
  private ensureInitialized(): void {
    if (!this.vectorOps || !this.connectionManager) {
      throw new Error('RuVector Bridge not initialized. Call initialize() first.');
    }
  }

  /**
   * Ensure pgvector extension is installed.
   */
  private async ensureExtension(): Promise<void> {
    try {
      await this.connectionManager!.query("CREATE EXTENSION IF NOT EXISTS vector");
      this.logger.debug('pgvector extension ensured');
    } catch (error) {
      this.logger.warn('Could not create pgvector extension (may require superuser privileges)', error);
    }
  }

  /**
   * Forward connection manager events to plugin event bus.
   */
  private forwardConnectionEvents(): void {
    const events: RuVectorEventType[] = [
      'connection:open',
      'connection:close',
      'connection:error',
      'connection:pool_acquired',
      'connection:pool_released',
      'query:start',
      'query:complete',
      'query:error',
      'query:slow',
    ];

    for (const event of events) {
      this.connectionManager!.on(event, (data) => {
        this.eventBus.emit(`ruvector:${event}`, data);
        this.emit(event, data);
        this.updateMetricsFromEvent(event, data);
      });
    }
  }

  /**
   * Update metrics from events.
   */
  private updateMetricsFromEvent(event: string, _data: unknown): void {
    switch (event) {
      case 'connection:pool_acquired':
        this.metrics.connectionAcquires++;
        break;
      case 'connection:pool_released':
        this.metrics.connectionReleases++;
        break;
      case 'connection:error':
        this.metrics.connectionErrors++;
        break;
      case 'query:slow':
        this.metrics.slowQueries++;
        break;
    }
  }

  /**
   * Update query metrics.
   */
  private updateQueryMetrics(success: boolean, durationMs: number): void {
    this.metrics.queriesTotal++;
    if (success) {
      this.metrics.queriesSucceeded++;
    } else {
      this.metrics.queriesFailed++;
    }

    // Update running average
    const prevAvg = this.metrics.avgQueryTimeMs;
    const n = this.metrics.queriesTotal;
    this.metrics.avgQueryTimeMs = prevAvg + (durationMs - prevAvg) / n;
    this.metrics.lastQueryTime = durationMs;

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      this.metrics.slowQueries++;
    }
  }

  /**
   * Create initial metrics object.
   */
  private createInitialMetrics(): RuVectorMetrics {
    return {
      queriesTotal: 0,
      queriesSucceeded: 0,
      queriesFailed: 0,
      slowQueries: 0,
      avgQueryTimeMs: 0,
      vectorsInserted: 0,
      vectorsUpdated: 0,
      vectorsDeleted: 0,
      searchesPerformed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      connectionAcquires: 0,
      connectionReleases: 0,
      connectionErrors: 0,
      lastQueryTime: 0,
      uptime: 0,
    };
  }

  /**
   * Create error result for MCP tools.
   */
  private createErrorResult(error: Error): MCPToolResult {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          code: (error as { code?: string }).code,
        }, null, 2),
      }],
      isError: true,
    };
  }

  /**
   * Get plugin uptime.
   */
  override getUptime(): number {
    if (!this.initTime) return 0;
    return Date.now() - this.initTime.getTime();
  }

  /**
   * Get current metrics.
   */
  getMetrics(): RuVectorMetrics {
    return {
      ...this.metrics,
      uptime: this.getUptime(),
    };
  }
}


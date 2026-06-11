/**
 * RuVector GNN — SQL generator & embedding cache
 *
 * GNNSQLGenerator and GNNEmbeddingCache for PostgreSQL-side GNN
 * operations.
 * Extracted verbatim from gnn.ts (lines 2751-3023) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import type { IGNNLayer, NodeId, SQLGenerationOptions } from './gnn-types.js';
import type { GNNAggregation } from './types.js';

// ============================================================================
// SQL Generator for GNN Operations
// ============================================================================

/**
 * SQL generator for GNN operations in PostgreSQL with RuVector.
 */
export class GNNSQLGenerator {
  /**
   * Generate SQL for GNN layer forward pass.
   */
  static layerForwardSQL(
    layer: IGNNLayer,
    tableName: string,
    options: SQLGenerationOptions = {}
  ): string {
    return layer.toSQL(tableName, options);
  }

  /**
   * Generate SQL for batch GNN operations.
   */
  static batchGNNSQL(
    layers: IGNNLayer[],
    tableName: string,
    options: SQLGenerationOptions = {}
  ): string {
    const schema = options.schema ?? 'public';
    const nodeColumn = options.nodeColumn ?? 'embedding';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;

    const layerConfigs = layers.map((l) => ({
      type: l.type,
      input_dim: l.config.inputDim,
      output_dim: l.config.outputDim,
      num_heads: l.config.numHeads,
      dropout: l.config.dropout,
      aggregation: l.config.aggregation,
      params: l.config.params,
    }));

    return `
SELECT ruvector.batch_gnn_forward(
  (SELECT array_agg(${nodeColumn}) FROM "${schema}"."${tableName}"),
  (SELECT array_agg(ARRAY[source_id, target_id]) FROM "${schema}"."${edgeTable}"),
  '${JSON.stringify(layerConfigs)}'::jsonb
);`.trim();
  }

  /**
   * Generate SQL for caching computed embeddings.
   */
  static cacheEmbeddingsSQL(
    tableName: string,
    cacheTable: string,
    options: SQLGenerationOptions = {}
  ): string {
    const schema = options.schema ?? 'public';

    return `
INSERT INTO "${schema}"."${cacheTable}" (node_id, embedding, computed_at)
SELECT
  id,
  ${options.nodeColumn ?? 'embedding'},
  NOW()
FROM "${schema}"."${tableName}"
ON CONFLICT (node_id)
DO UPDATE SET
  embedding = EXCLUDED.embedding,
  computed_at = NOW();`.trim();
  }

  /**
   * Generate SQL for creating GNN cache table.
   */
  static createCacheTableSQL(
    cacheTable: string,
    dimension: number,
    options: SQLGenerationOptions = {}
  ): string {
    const schema = options.schema ?? 'public';

    return `
CREATE TABLE IF NOT EXISTS "${schema}"."${cacheTable}" (
  node_id TEXT PRIMARY KEY,
  embedding vector(${dimension}) NOT NULL,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  layer_config JSONB,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "${cacheTable}_computed_at_idx"
ON "${schema}"."${cacheTable}" (computed_at);`.trim();
  }

  /**
   * Generate SQL for message passing operation.
   */
  static messagePassingSQL(
    tableName: string,
    aggregation: GNNAggregation,
    options: SQLGenerationOptions = {}
  ): string {
    const schema = options.schema ?? 'public';
    const nodeColumn = options.nodeColumn ?? 'embedding';
    const edgeTable = options.edgeTable ?? `${tableName}_edges`;

    const aggFunctionMap: Record<GNNAggregation, string> = {
      mean: 'avg',
      sum: 'sum',
      max: 'max',
      min: 'min',
      attention: 'attention_avg',
      lstm: 'lstm_agg',
      softmax: 'softmax_avg',
      power_mean: 'power_mean',
      std: 'std',
      var: 'var',
    };
    const aggFunction = aggFunctionMap[aggregation] ?? 'avg';

    return `
SELECT
  n.id,
  ruvector.vector_${aggFunction}(array_agg(neighbor.${nodeColumn})) AS aggregated_embedding
FROM "${schema}"."${tableName}" n
LEFT JOIN "${schema}"."${edgeTable}" e ON n.id = e.target_id
LEFT JOIN "${schema}"."${tableName}" neighbor ON e.source_id = neighbor.id
GROUP BY n.id;`.trim();
  }

  /**
   * Generate SQL for graph pooling.
   */
  static graphPoolingSQL(
    tableName: string,
    poolingMethod: 'mean' | 'sum' | 'max' | 'attention',
    options: SQLGenerationOptions = {}
  ): string {
    const schema = options.schema ?? 'public';
    const nodeColumn = options.nodeColumn ?? 'embedding';

    const poolFunction = {
      mean: 'vector_avg',
      sum: 'vector_sum',
      max: 'vector_max',
      attention: 'vector_attention_pool',
    }[poolingMethod] ?? 'vector_avg';

    return `
SELECT ruvector.${poolFunction}(
  (SELECT array_agg(${nodeColumn}) FROM "${schema}"."${tableName}")
) AS graph_embedding;`.trim();
  }
}

// ============================================================================
// Embedding Cache Manager
// ============================================================================

/**
 * Manager for caching computed GNN embeddings.
 */
export class GNNEmbeddingCache {
  private cache: Map<string, { embedding: number[]; timestamp: number; version: number }> =
    new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 10000, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached embedding.
   */
  get(nodeId: NodeId, version?: number): number[] | undefined {
    const key = String(nodeId);
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Check version
    if (version !== undefined && entry.version !== version) {
      return undefined;
    }

    return entry.embedding;
  }

  /**
   * Set cached embedding.
   */
  set(nodeId: NodeId, embedding: number[], version: number = 1): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(String(nodeId), {
      embedding,
      timestamp: Date.now(),
      version,
    });
  }

  /**
   * Batch get embeddings.
   */
  getBatch(nodeIds: NodeId[], version?: number): Map<NodeId, number[]> {
    const result = new Map<NodeId, number[]>();

    for (const id of nodeIds) {
      const embedding = this.get(id, version);
      if (embedding) {
        result.set(id, embedding);
      }
    }

    return result;
  }

  /**
   * Batch set embeddings.
   */
  setBatch(embeddings: Map<NodeId, number[]>, version: number = 1): void {
    for (const [id, embedding] of embeddings.entries()) {
      this.set(id, embedding, version);
    }
  }

  /**
   * Clear cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}


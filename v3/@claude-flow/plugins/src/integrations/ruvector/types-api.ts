/**
 * RuVector types — API layer
 *
 * SQL function interfaces, stats, event types, and result types.
 * Extracted verbatim from types.ts (lines 860-1703) during the P3.40
 * god-file decomposition (W161). types.ts stays the barrel.
 */

import type {
  AttentionConfig,
  AttentionInput,
  AttentionMechanism,
  AttentionOutput,
  DistanceMetric,
  GNNAggregation,
  GNNLayer,
  GNNLayerType,
  GNNOutput,
  GraphData,
  HyperbolicModel,
  HyperbolicOperation,
  VectorIndexOptions,
  VectorIndexType,
  VectorSearchResult,
} from './types-domain.js';

// ============================================================================
// SQL Function Types (53+ Functions)
// ============================================================================

/**
 * RuVector SQL function categories.
 */
export type RuVectorFunctionCategory =
  | 'vector'           // Vector operations
  | 'index'            // Index management
  | 'attention'        // Attention mechanisms
  | 'gnn'              // Graph neural networks
  | 'hyperbolic'       // Hyperbolic geometry
  | 'embedding'        // Embedding operations
  | 'distance'         // Distance/similarity functions
  | 'aggregation'      // Vector aggregation
  | 'normalization'    // Normalization functions
  | 'quantization'     // Vector quantization
  | 'utility'          // Utility functions
  | 'admin';           // Administrative functions

/**
 * Vector operation SQL functions.
 */
export interface VectorFunctions {
  // Core Vector Operations
  'ruvector.vector_add': VectorBinaryOp;
  'ruvector.vector_sub': VectorBinaryOp;
  'ruvector.vector_mul': VectorScalarOp;
  'ruvector.vector_div': VectorScalarOp;
  'ruvector.vector_neg': VectorUnaryOp;
  'ruvector.vector_dot': VectorBinaryScalarOp;
  'ruvector.vector_cross': VectorBinaryOp;
  'ruvector.vector_norm': VectorNormOp;
  'ruvector.vector_normalize': VectorUnaryOp;
  'ruvector.vector_scale': VectorScalarOp;
  'ruvector.vector_lerp': VectorLerpOp;
  'ruvector.vector_slerp': VectorSlerpOp;

  // Distance Functions
  'ruvector.cosine_distance': DistanceFunction;
  'ruvector.cosine_similarity': DistanceFunction;
  'ruvector.euclidean_distance': DistanceFunction;
  'ruvector.l2_distance': DistanceFunction;
  'ruvector.manhattan_distance': DistanceFunction;
  'ruvector.l1_distance': DistanceFunction;
  'ruvector.hamming_distance': DistanceFunction;
  'ruvector.jaccard_distance': DistanceFunction;
  'ruvector.inner_product': DistanceFunction;
  'ruvector.dot_product': DistanceFunction;

  // Aggregation Functions
  'ruvector.vector_avg': VectorAggregateOp;
  'ruvector.vector_sum': VectorAggregateOp;
  'ruvector.vector_min': VectorAggregateOp;
  'ruvector.vector_max': VectorAggregateOp;
  'ruvector.vector_centroid': VectorAggregateOp;
  'ruvector.vector_median': VectorAggregateOp;
}

/**
 * Index management SQL functions.
 */
export interface IndexFunctions {
  'ruvector.create_hnsw_index': CreateIndexOp;
  'ruvector.create_ivfflat_index': CreateIndexOp;
  'ruvector.drop_index': DropIndexOp;
  'ruvector.reindex': ReindexOp;
  'ruvector.index_stats': IndexStatsOp;
  'ruvector.set_ef_search': SetParamOp;
  'ruvector.set_probes': SetParamOp;
}

/**
 * Attention SQL functions.
 */
export interface AttentionFunctions {
  'ruvector.multi_head_attention': AttentionOp;
  'ruvector.self_attention': AttentionOp;
  'ruvector.cross_attention': CrossAttentionOp;
  'ruvector.flash_attention': FlashAttentionOp;
  'ruvector.linear_attention': LinearAttentionOp;
  'ruvector.sparse_attention': SparseAttentionOp;
  'ruvector.compute_attention_weights': AttentionWeightsOp;
}

/**
 * GNN SQL functions.
 */
export interface GNNFunctions {
  'ruvector.gcn_layer': GNNLayerOp;
  'ruvector.gat_layer': GNNLayerOp;
  'ruvector.sage_layer': GNNLayerOp;
  'ruvector.message_passing': MessagePassingOp;
  'ruvector.aggregate_neighbors': AggregateOp;
  'ruvector.graph_pooling': PoolingOp;
}

/**
 * Hyperbolic SQL functions.
 */
export interface HyperbolicFunctions {
  'ruvector.poincare_distance': HyperbolicDistanceOp;
  'ruvector.lorentz_distance': HyperbolicDistanceOp;
  'ruvector.exp_map': ExpMapOp;
  'ruvector.log_map': LogMapOp;
  'ruvector.mobius_add': MobiusOp;
  'ruvector.parallel_transport': TransportOp;
  'ruvector.hyperbolic_centroid': HyperbolicCentroidOp;
}

/**
 * Embedding SQL functions.
 */
export interface EmbeddingFunctions {
  'ruvector.embed_text': EmbedTextOp;
  'ruvector.embed_batch': EmbedBatchOp;
  'ruvector.embed_image': EmbedImageOp;
  'ruvector.embed_chunk': EmbedChunkOp;
}

/**
 * Quantization SQL functions.
 */
export interface QuantizationFunctions {
  'ruvector.quantize_scalar': QuantizeOp;
  'ruvector.quantize_product': ProductQuantizeOp;
  'ruvector.dequantize': DequantizeOp;
  'ruvector.binary_quantize': BinaryQuantizeOp;
}

/**
 * Utility SQL functions.
 */
export interface UtilityFunctions {
  'ruvector.version': VersionOp;
  'ruvector.config': ConfigOp;
  'ruvector.stats': StatsOp;
  'ruvector.health_check': HealthCheckOp;
  'ruvector.vacuum_vectors': VacuumOp;
  'ruvector.analyze_vectors': AnalyzeOp;
}

// SQL Function Operation Types
type VectorBinaryOp = (a: number[], b: number[]) => number[];
type VectorUnaryOp = (v: number[]) => number[];
type VectorScalarOp = (v: number[], s: number) => number[];
type VectorBinaryScalarOp = (a: number[], b: number[]) => number;
type VectorNormOp = (v: number[], p?: number) => number;
type VectorLerpOp = (a: number[], b: number[], t: number) => number[];
type VectorSlerpOp = (a: number[], b: number[], t: number) => number[];
type VectorAggregateOp = (vectors: number[][]) => number[];
type DistanceFunction = (a: number[], b: number[]) => number;
type CreateIndexOp = (table: string, column: string, options?: VectorIndexOptions) => void;
type DropIndexOp = (indexName: string) => void;
type ReindexOp = (indexName: string) => void;
type IndexStatsOp = (indexName: string) => IndexStats;
type SetParamOp = (value: number) => void;
type AttentionOp = (input: AttentionInput, config: AttentionConfig) => AttentionOutput;
type CrossAttentionOp = (query: number[][], kv: number[][], config: AttentionConfig) => AttentionOutput;
type FlashAttentionOp = (input: AttentionInput, blockSize?: number) => AttentionOutput;
type LinearAttentionOp = (input: AttentionInput, featureMap: string) => AttentionOutput;
type SparseAttentionOp = (input: AttentionInput, pattern: string) => AttentionOutput;
type AttentionWeightsOp = (query: number[][], key: number[][]) => number[][];
type GNNLayerOp = (graph: GraphData, layer: GNNLayer) => GNNOutput;
type MessagePassingOp = (graph: GraphData, aggregation: GNNAggregation) => number[][];
type AggregateOp = (nodeFeatures: number[][], edgeIndex: [number[], number[]], agg: GNNAggregation) => number[][];
type PoolingOp = (nodeFeatures: number[][], batch: number[], method: string) => number[][];
type HyperbolicDistanceOp = (a: number[], b: number[], curvature: number) => number;
type ExpMapOp = (point: number[], tangent: number[], curvature: number) => number[];
type LogMapOp = (point: number[], target: number[], curvature: number) => number[];
type MobiusOp = (a: number[], b: number[], curvature: number) => number[];
type TransportOp = (vector: number[], start: number[], end: number[], curvature: number) => number[];
type HyperbolicCentroidOp = (points: number[][], curvature: number) => number[];
type EmbedTextOp = (text: string, model?: string) => number[];
type EmbedBatchOp = (texts: string[], model?: string) => number[][];
type EmbedImageOp = (imageData: Uint8Array, model?: string) => number[];
type EmbedChunkOp = (text: string, chunkSize: number, overlap: number) => number[][];
type QuantizeOp = (vector: number[], bits: number) => Uint8Array;
type ProductQuantizeOp = (vector: number[], numSubvectors: number, bits: number) => Uint8Array;
type DequantizeOp = (quantized: Uint8Array, originalDim: number) => number[];
type BinaryQuantizeOp = (vector: number[]) => Uint8Array;
type VersionOp = () => string;
type ConfigOp = () => Record<string, unknown>;
type StatsOp = () => RuVectorStats;
type HealthCheckOp = () => HealthStatus;
type VacuumOp = (tableName?: string) => void;
type AnalyzeOp = (tableName?: string) => AnalysisResult;

/**
 * Index statistics.
 */
export interface IndexStats {
  /** Index name */
  readonly indexName: string;
  /** Index type */
  readonly indexType: VectorIndexType;
  /** Number of vectors indexed */
  readonly numVectors: number;
  /** Index size in bytes */
  readonly sizeBytes: number;
  /** Build time in milliseconds */
  readonly buildTimeMs: number;
  /** Last rebuild timestamp */
  readonly lastRebuild: Date;
  /** Index-specific stats */
  readonly params: Record<string, unknown>;
}

/**
 * RuVector statistics.
 */
export interface RuVectorStats {
  /** Version string */
  readonly version: string;
  /** Total vectors stored */
  readonly totalVectors: number;
  /** Total storage size in bytes */
  readonly totalSizeBytes: number;
  /** Number of indices */
  readonly numIndices: number;
  /** Number of tables with vectors */
  readonly numTables: number;
  /** Query statistics */
  readonly queryStats: QueryStats;
  /** Memory statistics */
  readonly memoryStats: MemoryStats;
}

/**
 * Query statistics.
 */
export interface QueryStats {
  /** Total queries executed */
  readonly totalQueries: number;
  /** Average query time in milliseconds */
  readonly avgQueryTimeMs: number;
  /** 95th percentile query time */
  readonly p95QueryTimeMs: number;
  /** 99th percentile query time */
  readonly p99QueryTimeMs: number;
  /** Cache hit rate */
  readonly cacheHitRate: number;
}

/**
 * Memory statistics.
 */
export interface MemoryStats {
  /** Total memory used in bytes */
  readonly usedBytes: number;
  /** Peak memory usage in bytes */
  readonly peakBytes: number;
  /** Index memory in bytes */
  readonly indexBytes: number;
  /** Cache memory in bytes */
  readonly cacheBytes: number;
}

/**
 * Health status.
 */
export interface HealthStatus {
  /** Overall health status */
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  /** Component statuses */
  readonly components: Record<string, ComponentHealth>;
  /** Last check timestamp */
  readonly lastCheck: Date;
  /** Issues found */
  readonly issues: string[];
}

/**
 * Component health.
 */
export interface ComponentHealth {
  /** Component name */
  readonly name: string;
  /** Health status */
  readonly healthy: boolean;
  /** Latency in milliseconds */
  readonly latencyMs?: number;
  /** Error message if unhealthy */
  readonly error?: string;
}

/**
 * Analysis result from ANALYZE operation.
 */
export interface AnalysisResult {
  /** Table analyzed */
  readonly tableName: string;
  /** Number of rows */
  readonly numRows: number;
  /** Column statistics */
  readonly columnStats: ColumnStats[];
  /** Recommendations */
  readonly recommendations: string[];
}

/**
 * Column statistics.
 */
export interface ColumnStats {
  /** Column name */
  readonly columnName: string;
  /** Data type */
  readonly dataType: string;
  /** Null percentage */
  readonly nullPercent: number;
  /** Distinct values */
  readonly distinctCount: number;
  /** Average value size in bytes */
  readonly avgSizeBytes: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * RuVector event types.
 */
export type RuVectorEventType =
  // Connection Events
  | 'connection:open'
  | 'connection:close'
  | 'connection:error'
  | 'connection:reconnect'
  | 'connection:pool_acquired'
  | 'connection:pool_released'

  // Query Events
  | 'query:start'
  | 'query:complete'
  | 'query:error'
  | 'query:slow'

  // Index Events
  | 'index:created'
  | 'index:dropped'
  | 'index:rebuilt'
  | 'index:progress'

  // Vector Events
  | 'vector:inserted'
  | 'vector:updated'
  | 'vector:deleted'
  | 'vector:batch_complete'

  // Search Events
  | 'search:start'
  | 'search:complete'
  | 'search:cache_hit'
  | 'search:cache_miss'

  // Attention Events
  | 'attention:computed'
  | 'attention:cached'

  // GNN Events
  | 'gnn:forward'
  | 'gnn:message_passing'

  // Hyperbolic Events
  | 'hyperbolic:embed'
  | 'hyperbolic:distance'

  // Admin Events
  | 'admin:vacuum'
  | 'admin:analyze'
  | 'admin:checkpoint';

/**
 * Base event interface.
 */
export interface RuVectorEvent<T extends RuVectorEventType = RuVectorEventType> {
  /** Event type */
  readonly type: T;
  /** Timestamp */
  readonly timestamp: Date;
  /** Event data */
  readonly data: EventDataMap[T];
  /** Source of the event */
  readonly source?: string;
  /** Correlation ID for tracing */
  readonly correlationId?: string;
}

/**
 * Event data type mapping.
 */
export interface EventDataMap {
  'connection:open': ConnectionEventData;
  'connection:close': ConnectionEventData;
  'connection:error': ErrorEventData;
  'connection:reconnect': ConnectionEventData;
  'connection:pool_acquired': PoolEventData;
  'connection:pool_released': PoolEventData;

  'query:start': QueryStartEventData;
  'query:complete': QueryCompleteEventData;
  'query:error': QueryErrorEventData;
  'query:slow': QuerySlowEventData;

  'index:created': IndexEventData;
  'index:dropped': IndexEventData;
  'index:rebuilt': IndexEventData;
  'index:progress': IndexProgressEventData;

  'vector:inserted': VectorEventData;
  'vector:updated': VectorEventData;
  'vector:deleted': VectorEventData;
  'vector:batch_complete': BatchEventData;

  'search:start': SearchStartEventData;
  'search:complete': SearchCompleteEventData;
  'search:cache_hit': CacheEventData;
  'search:cache_miss': CacheEventData;

  'attention:computed': AttentionEventData;
  'attention:cached': CacheEventData;

  'gnn:forward': GNNEventData;
  'gnn:message_passing': GNNEventData;

  'hyperbolic:embed': HyperbolicEventData;
  'hyperbolic:distance': HyperbolicEventData;

  'admin:vacuum': AdminEventData;
  'admin:analyze': AdminEventData;
  'admin:checkpoint': AdminEventData;
}

/**
 * Connection event data.
 */
export interface ConnectionEventData {
  readonly connectionId: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly durationMs?: number;
}

/**
 * Error event data.
 */
export interface ErrorEventData {
  readonly error: Error;
  readonly code?: string;
  readonly detail?: string;
  readonly hint?: string;
}

/**
 * Pool event data.
 */
export interface PoolEventData {
  readonly connectionId: string;
  readonly poolSize: number;
  readonly availableConnections: number;
  readonly waitingClients: number;
}

/**
 * Query start event data.
 */
export interface QueryStartEventData {
  readonly queryId: string;
  readonly sql: string;
  readonly params?: unknown[];
}

/**
 * Query complete event data.
 */
export interface QueryCompleteEventData {
  readonly queryId: string;
  readonly durationMs: number;
  readonly rowCount: number;
  readonly affectedRows?: number;
}

/**
 * Query error event data.
 */
export interface QueryErrorEventData extends QueryStartEventData, ErrorEventData {
  readonly durationMs: number;
}

/**
 * Query slow event data.
 */
export interface QuerySlowEventData extends QueryCompleteEventData {
  readonly threshold: number;
  readonly explain?: string;
}

/**
 * Index event data.
 */
export interface IndexEventData {
  readonly indexName: string;
  readonly tableName: string;
  readonly columnName: string;
  readonly indexType: VectorIndexType;
  readonly durationMs?: number;
}

/**
 * Index progress event data.
 */
export interface IndexProgressEventData {
  readonly indexName: string;
  readonly progress: number;
  readonly phase: string;
  readonly vectorsProcessed: number;
  readonly totalVectors: number;
  readonly estimatedTimeRemainingMs: number;
}

/**
 * Vector event data.
 */
export interface VectorEventData {
  readonly tableName: string;
  readonly vectorId: string | number;
  readonly dimensions: number;
}

/**
 * Batch event data.
 */
export interface BatchEventData {
  readonly tableName: string;
  readonly count: number;
  readonly durationMs: number;
  readonly successCount: number;
  readonly failedCount: number;
}

/**
 * Search start event data.
 */
export interface SearchStartEventData {
  readonly searchId: string;
  readonly tableName: string;
  readonly k: number;
  readonly metric: DistanceMetric;
  readonly hasFilters: boolean;
}

/**
 * Search complete event data.
 */
export interface SearchCompleteEventData {
  readonly searchId: string;
  readonly durationMs: number;
  readonly resultCount: number;
  readonly scannedCount: number;
  readonly cacheHit: boolean;
}

/**
 * Cache event data.
 */
export interface CacheEventData {
  readonly cacheKey: string;
  readonly cacheSize: number;
  readonly ttl?: number;
}

/**
 * Attention event data.
 */
export interface AttentionEventData {
  readonly mechanism: AttentionMechanism;
  readonly seqLen: number;
  readonly numHeads: number;
  readonly durationMs: number;
  readonly memoryBytes: number;
}

/**
 * GNN event data.
 */
export interface GNNEventData {
  readonly layerType: GNNLayerType;
  readonly numNodes: number;
  readonly numEdges: number;
  readonly durationMs: number;
}

/**
 * Hyperbolic event data.
 */
export interface HyperbolicEventData {
  readonly model: HyperbolicModel;
  readonly operation: HyperbolicOperation;
  readonly numPoints: number;
  readonly durationMs: number;
}

/**
 * Admin event data.
 */
export interface AdminEventData {
  readonly operation: string;
  readonly tableName?: string;
  readonly durationMs: number;
  readonly details?: Record<string, unknown>;
}

/**
 * Event handler type.
 */
export type RuVectorEventHandler<T extends RuVectorEventType = RuVectorEventType> =
  (event: RuVectorEvent<T>) => void | Promise<void>;

/**
 * Event emitter interface.
 */
export interface RuVectorEventEmitter {
  on<T extends RuVectorEventType>(event: T, handler: RuVectorEventHandler<T>): () => void;
  off<T extends RuVectorEventType>(event: T, handler: RuVectorEventHandler<T>): void;
  once<T extends RuVectorEventType>(event: T, handler: RuVectorEventHandler<T>): () => void;
  emit<T extends RuVectorEventType>(event: T, data: EventDataMap[T]): void;
  removeAllListeners(event?: RuVectorEventType): void;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Generic result wrapper with success/error discrimination.
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Async result type alias.
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Connection result.
 */
export interface ConnectionResult {
  /** Connection ID */
  readonly connectionId: string;
  /** Whether connection is ready */
  readonly ready: boolean;
  /** Server version */
  readonly serverVersion: string;
  /** RuVector extension version */
  readonly ruVectorVersion: string;
  /** Connection parameters */
  readonly parameters: Record<string, string>;
}

/**
 * Query result wrapper.
 */
export interface QueryResult<T = Record<string, unknown>> {
  /** Query rows */
  readonly rows: T[];
  /** Row count */
  readonly rowCount: number;
  /** Affected rows (for INSERT/UPDATE/DELETE) */
  readonly affectedRows?: number;
  /** Query execution time in milliseconds */
  readonly durationMs: number;
  /** Query plan (if EXPLAIN was used) */
  readonly plan?: QueryPlan;
  /** Command type (SELECT, INSERT, etc.) */
  readonly command: string;
}

/**
 * Query execution plan.
 */
export interface QueryPlan {
  /** Plan nodes */
  readonly nodes: PlanNode[];
  /** Total cost estimate */
  readonly totalCost: number;
  /** Actual execution time (if ANALYZE was used) */
  readonly actualTimeMs?: number;
  /** Actual rows returned */
  readonly actualRows?: number;
  /** Peak memory usage */
  readonly peakMemory?: number;
}

/**
 * Query plan node.
 */
export interface PlanNode {
  /** Node type (Seq Scan, Index Scan, etc.) */
  readonly type: string;
  /** Relation name (if applicable) */
  readonly relation?: string;
  /** Index name (if applicable) */
  readonly indexName?: string;
  /** Startup cost */
  readonly startupCost: number;
  /** Total cost */
  readonly totalCost: number;
  /** Estimated rows */
  readonly planRows: number;
  /** Actual rows (if ANALYZE) */
  readonly actualRows?: number;
  /** Actual time (if ANALYZE) */
  readonly actualTimeMs?: number;
  /** Child nodes */
  readonly children?: PlanNode[];
  /** Additional output info */
  readonly output?: string[];
  /** Filter condition */
  readonly filter?: string;
  /** Index condition */
  readonly indexCond?: string;
}

/**
 * Batch operation result.
 */
export interface BatchResult<T = void> {
  /** Total items processed */
  readonly total: number;
  /** Successfully processed items */
  readonly successful: number;
  /** Failed items */
  readonly failed: number;
  /** Results per item (if applicable) */
  readonly results?: T[];
  /** Errors encountered */
  readonly errors?: BatchError[];
  /** Total duration in milliseconds */
  readonly durationMs: number;
  /** Throughput (items per second) */
  readonly throughput: number;
}

/**
 * Batch error.
 */
export interface BatchError {
  /** Index of the failed item */
  readonly index: number;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code?: string;
  /** Original input that caused the error */
  readonly input?: unknown;
}

/**
 * Transaction result.
 */
export interface TransactionResult<T = void> {
  /** Transaction ID */
  readonly transactionId: string;
  /** Whether transaction was committed */
  readonly committed: boolean;
  /** Result data (if any) */
  readonly data?: T;
  /** Transaction duration in milliseconds */
  readonly durationMs: number;
  /** Number of queries executed */
  readonly queryCount: number;
}

/**
 * Migration result.
 */
export interface MigrationResult {
  /** Migration name/version */
  readonly name: string;
  /** Whether migration succeeded */
  readonly success: boolean;
  /** Migration direction */
  readonly direction: 'up' | 'down';
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Affected tables */
  readonly affectedTables: string[];
  /** Error message (if failed) */
  readonly error?: string;
}

/**
 * Bulk search result.
 */
export interface BulkSearchResult {
  /** Results per query */
  readonly results: VectorSearchResult[][];
  /** Total search time in milliseconds */
  readonly totalDurationMs: number;
  /** Average search time per query */
  readonly avgDurationMs: number;
  /** Cache statistics */
  readonly cacheStats: {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
  };
}

/**
 * Embedding result.
 */
export interface EmbeddingResult {
  /** Embedding vector */
  readonly embedding: number[];
  /** Model used */
  readonly model: string;
  /** Token count */
  readonly tokenCount: number;
  /** Embedding duration in milliseconds */
  readonly durationMs: number;
  /** Dimension */
  readonly dimension: number;
}

/**
 * Batch embedding result.
 */
export interface BatchEmbeddingResult {
  /** Embedding results */
  readonly embeddings: EmbeddingResult[];
  /** Total tokens processed */
  readonly totalTokens: number;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Throughput (tokens per second) */
  readonly throughput: number;
}


/**
 * RuVector types — client layer
 *
 * Client interface, runtime type guards, plugin factory types, the
 * RuVectorSQLFunctions aggregate, and the RuVector namespace aliases.
 * Extracted verbatim from types.ts (lines 1704-1945) during the P3.40
 * god-file decomposition (W161). types.ts stays the barrel.
 */

import type {
  AttentionConfig,
  AttentionInput,
  AttentionMechanism,
  AttentionOutput,
  BatchVectorOptions,
  DistanceMetric,
  GNNLayer,
  GNNLayerType,
  GNNOutput,
  GraphData,
  HyperbolicEmbedding,
  HyperbolicInput,
  HyperbolicModel,
  HyperbolicOutput,
  RuVectorConfig,
  VectorIndexOptions,
  VectorIndexType,
  VectorInsertOptions,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpdateOptions,
} from './types-domain.js';
import type {
  AnalysisResult,
  AttentionFunctions,
  BatchEmbeddingResult,
  BatchResult,
  BulkSearchResult,
  ConnectionResult,
  EmbeddingFunctions,
  EmbeddingResult,
  EventDataMap,
  GNNFunctions,
  HealthStatus,
  HyperbolicFunctions,
  IndexFunctions,
  IndexStats,
  QuantizationFunctions,
  QueryResult,
  Result,
  RuVectorEventEmitter,
  RuVectorEventHandler,
  RuVectorEventType,
  RuVectorStats,
  TransactionResult,
  UtilityFunctions,
  VectorFunctions,
} from './types-api.js';

// ============================================================================
// Client Interface
// ============================================================================

/**
 * RuVector client configuration options.
 */
export interface RuVectorClientOptions extends RuVectorConfig {
  /** Enable automatic reconnection */
  readonly autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  readonly maxReconnectAttempts?: number;
  /** Event handlers */
  readonly eventHandlers?: Partial<{
    [K in RuVectorEventType]: RuVectorEventHandler<K>;
  }>;
  /** Custom logger */
  readonly logger?: RuVectorLogger;
}

/**
 * Logger interface.
 */
export interface RuVectorLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * RuVector client interface.
 */
export interface IRuVectorClient extends RuVectorEventEmitter {
  // Connection Management
  connect(): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionInfo(): ConnectionResult | null;

  // Vector Operations
  search(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  batchSearch(options: BatchVectorOptions): Promise<BulkSearchResult>;
  insert(options: VectorInsertOptions): Promise<BatchResult<string>>;
  update(options: VectorUpdateOptions): Promise<boolean>;
  delete(tableName: string, id: string | number): Promise<boolean>;
  bulkDelete(tableName: string, ids: Array<string | number>): Promise<BatchResult>;

  // Index Management
  createIndex(options: VectorIndexOptions): Promise<void>;
  dropIndex(indexName: string): Promise<void>;
  rebuildIndex(indexName: string): Promise<void>;
  getIndexStats(indexName: string): Promise<IndexStats>;
  listIndices(tableName?: string): Promise<IndexStats[]>;

  // Attention Operations
  computeAttention(input: AttentionInput, config: AttentionConfig): Promise<AttentionOutput>;

  // GNN Operations
  runGNNLayer(graph: GraphData, layer: GNNLayer): Promise<GNNOutput>;
  buildGraph(nodeFeatures: number[][], edges: [number, number][]): GraphData;

  // Hyperbolic Operations
  hyperbolicEmbed(input: HyperbolicInput, config: HyperbolicEmbedding): Promise<HyperbolicOutput>;
  hyperbolicDistance(a: number[], b: number[], config: HyperbolicEmbedding): Promise<number>;

  // Embedding Operations
  embed(text: string, model?: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[], model?: string): Promise<BatchEmbeddingResult>;

  // Transaction Support
  transaction<T>(fn: (tx: IRuVectorTransaction) => Promise<T>): Promise<TransactionResult<T>>;

  // Admin Operations
  vacuum(tableName?: string): Promise<void>;
  analyze(tableName?: string): Promise<AnalysisResult>;
  healthCheck(): Promise<HealthStatus>;
  getStats(): Promise<RuVectorStats>;
}

/**
 * Transaction interface.
 */
export interface IRuVectorTransaction {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  insert(options: VectorInsertOptions): Promise<BatchResult<string>>;
  update(options: VectorUpdateOptions): Promise<boolean>;
  delete(tableName: string, id: string | number): Promise<boolean>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid distance metric.
 */
export function isDistanceMetric(value: unknown): value is DistanceMetric {
  const metrics = [
    'cosine', 'euclidean', 'dot', 'hamming', 'manhattan',
    'chebyshev', 'jaccard', 'minkowski', 'bray_curtis',
    'canberra', 'mahalanobis', 'correlation'
  ];
  return typeof value === 'string' && metrics.indexOf(value) !== -1;
}

/**
 * Check if a value is a valid attention mechanism.
 */
export function isAttentionMechanism(value: unknown): value is AttentionMechanism {
  const mechanisms = [
    'multi_head', 'self_attention', 'cross_attention', 'sparse_attention',
    'linear_attention', 'local_attention', 'global_attention', 'flash_attention',
    'flash_attention_v2', 'memory_efficient', 'chunk_attention', 'sliding_window',
    'dilated_attention', 'block_sparse', 'relative_position', 'rotary_position',
    'alibi', 'causal', 'bidirectional', 'axial', 'performer', 'linformer',
    'reformer', 'synthesizer', 'routing', 'mixture_of_experts', 'graph_attention',
    'hyperbolic_attention', 'spherical_attention', 'toroidal_attention',
    'temporal_attention', 'recurrent_attention', 'state_space', 'cross_modal',
    'perceiver', 'flamingo', 'retrieval_attention', 'knn_attention', 'memory_augmented'
  ];
  return typeof value === 'string' && mechanisms.indexOf(value) !== -1;
}

/**
 * Check if a value is a valid GNN layer type.
 */
export function isGNNLayerType(value: unknown): value is GNNLayerType {
  const types = [
    'gcn', 'gat', 'gat_v2', 'sage', 'gin', 'mpnn', 'edge_conv',
    'point_conv', 'transformer', 'pna', 'film', 'rgcn', 'hgt', 'han', 'metapath'
  ];
  return typeof value === 'string' && types.indexOf(value) !== -1;
}

/**
 * Check if a value is a valid hyperbolic model.
 */
export function isHyperbolicModel(value: unknown): value is HyperbolicModel {
  const models = ['poincare', 'lorentz', 'klein', 'half_space'];
  return typeof value === 'string' && models.indexOf(value) !== -1;
}

/**
 * Check if a value is a valid vector index type.
 */
export function isVectorIndexType(value: unknown): value is VectorIndexType {
  const types = ['hnsw', 'ivfflat', 'ivfpq', 'flat', 'diskann'];
  return typeof value === 'string' && types.indexOf(value) !== -1;
}

/**
 * Check if a result is successful.
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Check if a result is an error.
 */
export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory function for creating RuVector clients.
 */
export type RuVectorClientFactory = (options: RuVectorClientOptions) => IRuVectorClient;

/**
 * Plugin registration type for the RuVector integration.
 */
export interface RuVectorPluginRegistration {
  /** Plugin name */
  readonly name: 'ruvector';
  /** Plugin version */
  readonly version: string;
  /** Client factory */
  readonly createClient: RuVectorClientFactory;
  /** Supported features */
  readonly features: RuVectorFeature[];
}

/**
 * RuVector feature flags.
 */
export type RuVectorFeature =
  | 'vector_search'
  | 'hnsw_index'
  | 'ivf_index'
  | 'attention'
  | 'gnn'
  | 'hyperbolic'
  | 'quantization'
  | 'batch_operations'
  | 'transactions'
  | 'streaming'
  | 'caching';

// ============================================================================
// Export Aggregation
// ============================================================================

/**
 * All SQL functions aggregated.
 */
export interface RuVectorSQLFunctions
  extends VectorFunctions,
    IndexFunctions,
    AttentionFunctions,
    GNNFunctions,
    HyperbolicFunctions,
    EmbeddingFunctions,
    QuantizationFunctions,
    UtilityFunctions {}

/**
 * Namespace export for module organization.
 */
export namespace RuVector {
  export type Config = RuVectorConfig;
  export type Client = IRuVectorClient;
  export type ClientOptions = RuVectorClientOptions;
  export type SearchOptions = VectorSearchOptions;
  export type SearchResult = VectorSearchResult;
  export type Attention = AttentionMechanism;
  export type AttentionCfg = AttentionConfig;
  export type GNN = GNNLayerType;
  export type GNNLayerCfg = GNNLayer;
  export type Hyperbolic = HyperbolicModel;
  export type HyperbolicCfg = HyperbolicEmbedding;
  export type Event = RuVectorEventType;
  export type EventData<T extends RuVectorEventType> = EventDataMap[T];
  export type Feature = RuVectorFeature;
}

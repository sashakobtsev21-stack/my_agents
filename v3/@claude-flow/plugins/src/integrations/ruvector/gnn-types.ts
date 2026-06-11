/**
 * RuVector GNN — constants & core interfaces
 *
 * GNN_DEFAULTS/GNN_SQL_FUNCTIONS plus the node/edge/message/path/
 * community/layer-config/IGNNLayer interfaces.
 * Extracted verbatim from gnn.ts (lines 21-265) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import type {
  GNNLayerType,
  GNNLayer,
  GraphData,
  GNNOutput,
  GNNAggregation,
  ActivationFunction,
} from './types.js';

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Default configuration values for GNN layers.
 */
export const GNN_DEFAULTS = {
  dropout: 0.0,
  addSelfLoops: true,
  normalize: true,
  useBias: true,
  activation: 'relu' as ActivationFunction,
  aggregation: 'mean' as GNNAggregation,
  numHeads: 1,
  negativeSlope: 0.2, // For LeakyReLU in GAT
  eps: 0.0, // For GIN
  sampleSize: 10, // For GraphSAGE
  k: 20, // For EdgeConv k-NN
} as const;

/**
 * SQL function mapping for GNN operations.
 */
export const GNN_SQL_FUNCTIONS = {
  gcn: 'ruvector.gcn_layer',
  gat: 'ruvector.gat_layer',
  gat_v2: 'ruvector.gat_v2_layer',
  sage: 'ruvector.sage_layer',
  gin: 'ruvector.gin_layer',
  mpnn: 'ruvector.mpnn_layer',
  edge_conv: 'ruvector.edge_conv_layer',
  point_conv: 'ruvector.point_conv_layer',
  transformer: 'ruvector.graph_transformer_layer',
  pna: 'ruvector.pna_layer',
  film: 'ruvector.film_layer',
  rgcn: 'ruvector.rgcn_layer',
  hgt: 'ruvector.hgt_layer',
  han: 'ruvector.han_layer',
  metapath: 'ruvector.metapath_layer',
} as const;

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Node identifier type.
 */
export type NodeId = string | number;

/**
 * Node features representation.
 */
export interface NodeFeatures {
  /** Node IDs */
  readonly ids: NodeId[];
  /** Feature vectors [num_nodes, feature_dim] */
  readonly features: number[][];
  /** Optional node types for heterogeneous graphs */
  readonly types?: string[];
  /** Optional node labels */
  readonly labels?: number[];
}

/**
 * Edge features representation.
 */
export interface EdgeFeatures {
  /** Source node IDs */
  readonly sources: NodeId[];
  /** Target node IDs */
  readonly targets: NodeId[];
  /** Edge feature vectors [num_edges, edge_dim] (optional) */
  readonly features?: number[][];
  /** Edge weights (optional) */
  readonly weights?: number[];
  /** Edge types for heterogeneous graphs (optional) */
  readonly types?: string[];
}

/**
 * Message representation for message passing.
 */
export interface Message {
  /** Source node ID */
  readonly source: NodeId;
  /** Target node ID */
  readonly target: NodeId;
  /** Message vector */
  readonly vector: number[];
  /** Edge features (if applicable) */
  readonly edgeFeatures?: number[];
  /** Message weight */
  readonly weight?: number;
}

/**
 * Aggregation method type with extended options.
 */
export type AggregationMethod =
  | GNNAggregation
  | 'concat'
  | 'weighted_mean'
  | 'multi_head';

/**
 * Path representation for graph traversal.
 */
export interface Path {
  /** Ordered list of node IDs */
  readonly nodes: NodeId[];
  /** Total path weight/distance */
  readonly weight: number;
  /** Edge types along the path (for heterogeneous graphs) */
  readonly edgeTypes?: string[];
}

/**
 * Community detection result.
 */
export interface Community {
  /** Community identifier */
  readonly id: number;
  /** Member node IDs */
  readonly members: NodeId[];
  /** Community centroid (average features) */
  readonly centroid?: number[];
  /** Modularity score */
  readonly modularity?: number;
  /** Internal edge density */
  readonly density?: number;
}

/**
 * PageRank computation options.
 */
export interface PageRankOptions {
  /** Damping factor (default: 0.85) */
  readonly damping?: number;
  /** Maximum iterations (default: 100) */
  readonly maxIterations?: number;
  /** Convergence tolerance (default: 1e-6) */
  readonly tolerance?: number;
  /** Personalization vector (teleport probabilities) */
  readonly personalization?: Map<NodeId, number>;
  /** Whether to use weighted edges */
  readonly weighted?: boolean;
}

/**
 * Community detection options.
 */
export interface CommunityOptions {
  /** Detection algorithm */
  readonly algorithm: 'louvain' | 'label_propagation' | 'girvan_newman' | 'spectral';
  /** Resolution parameter (for Louvain) */
  readonly resolution?: number;
  /** Maximum iterations */
  readonly maxIterations?: number;
  /** Minimum community size */
  readonly minSize?: number;
  /** Random seed for reproducibility */
  readonly seed?: number;
}

/**
 * GNN layer configuration with validation.
 */
export interface GNNLayerConfig extends GNNLayer {
  /** Layer name/identifier */
  readonly name?: string;
  /** Whether to cache intermediate results */
  readonly cache?: boolean;
  /** Quantization bits for memory efficiency */
  readonly quantizeBits?: 8 | 16 | 32;
}

/**
 * Factory function type for creating GNN layers.
 */
export type GNNLayerFactory = (config: GNNLayerConfig) => IGNNLayer;

/**
 * Interface for GNN layer implementations.
 */
export interface IGNNLayer {
  /** Layer type */
  readonly type: GNNLayerType;
  /** Layer configuration */
  readonly config: GNNLayerConfig;

  /**
   * Forward pass through the GNN layer.
   * @param graph - Input graph data
   * @returns Promise resolving to GNN output
   */
  forward(graph: GraphData): Promise<GNNOutput>;

  /**
   * Message passing step.
   * @param nodes - Node features
   * @param edges - Edge features
   * @returns Promise resolving to updated node features
   */
  messagePass(nodes: NodeFeatures, edges: EdgeFeatures): Promise<NodeFeatures>;

  /**
   * Aggregate messages using the specified method.
   * @param messages - Array of messages to aggregate
   * @param method - Aggregation method
   * @returns Promise resolving to aggregated vector
   */
  aggregate(messages: Message[], method: AggregationMethod): Promise<number[]>;

  /**
   * Reset layer state (if stateful).
   */
  reset(): void;

  /**
   * Generate SQL for this layer.
   * @param tableName - Target table name
   * @param options - SQL generation options
   * @returns SQL string
   */
  toSQL(tableName: string, options?: SQLGenerationOptions): string;
}

/**
 * SQL generation options.
 */
export interface SQLGenerationOptions {
  /** Schema name */
  readonly schema?: string;
  /** Node features column */
  readonly nodeColumn?: string;
  /** Edge table name */
  readonly edgeTable?: string;
  /** Whether to use prepared statements */
  readonly prepared?: boolean;
  /** Parameter prefix for prepared statements */
  readonly paramPrefix?: string;
}


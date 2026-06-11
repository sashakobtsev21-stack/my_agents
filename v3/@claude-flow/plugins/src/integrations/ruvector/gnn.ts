/**
 * RuVector PostgreSQL Bridge - Graph Neural Network (GNN) Layers Module
 *
 * Comprehensive GNN support for RuVector PostgreSQL vector database integration.
 * Implements GCN, GAT, GraphSAGE, GIN, MPNN, EdgeConv, and more.
 *
 * @module @claude-flow/plugins/integrations/ruvector/gnn
 * @version 1.0.0
 */

// This file is now a thin barrel + factory surface: the GNN module was
// split into the seven sub-modules below during the P3.41 god-file
// decomposition (W162). Kept as gnn.ts so the './gnn.js' importers
// (ruvector/index.ts) keep resolving byte-identically. Layering:
// gnn-types -> gnn-layer-base -> gnn-layers-standard ->
// gnn-layers-advanced -> gnn-registry; gnn-graph-operations and gnn-sql
// depend only on gnn-types.
export * from './gnn-types.js';
export * from './gnn-registry.js';
export * from './gnn-layer-base.js';
export * from './gnn-layers-standard.js';
export * from './gnn-layers-advanced.js';
export * from './gnn-graph-operations.js';
export * from './gnn-sql.js';

import { GNNLayerRegistry } from './gnn-registry.js';
import { GraphOperations } from './gnn-graph-operations.js';
import type { GNNLayerConfig, IGNNLayer } from './gnn-types.js';
import type { GNNLayerType } from './types.js';

// ============================================================================
// Factory and Default Instance
// ============================================================================

/**
 * Create a default GNN layer registry with all built-in layers.
 */
export function createGNNLayerRegistry(): GNNLayerRegistry {
  return new GNNLayerRegistry();
}

/**
 * Create a GNN layer with the default registry.
 */
export function createGNNLayer(type: GNNLayerType, config: Partial<GNNLayerConfig>): IGNNLayer {
  const registry = createGNNLayerRegistry();
  return registry.createLayer(type, config);
}

/**
 * Create graph operations instance.
 */
export function createGraphOperations(): GraphOperations {
  return new GraphOperations();
}


/**
 * RuVector GNN — layer registry
 *
 * GNNLayerRegistry: registers the 15 built-in layer factories and
 * creates layers by type.
 * Extracted verbatim from gnn.ts (lines 266-458) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */

import { GNN_DEFAULTS } from './gnn-types.js';
import type { GNNLayerConfig, GNNLayerFactory, IGNNLayer } from './gnn-types.js';
import {
  GATLayer,
  GATv2Layer,
  GCNLayer,
  GINLayer,
  GraphSAGELayer,
} from './gnn-layers-standard.js';
import {
  EdgeConvLayer,
  FiLMLayer,
  GraphTransformerLayer,
  HANLayer,
  HGTLayer,
  MPNNLayer,
  MetaPathLayer,
  PNALayer,
  PointConvLayer,
  RGCNLayer,
} from './gnn-layers-advanced.js';
import type { GNNLayerType } from './types.js';

// ============================================================================
// GNN Layer Registry
// ============================================================================

/**
 * Registry for managing GNN layer types and factories.
 *
 * @example
 * ```typescript
 * const registry = new GNNLayerRegistry();
 * registry.registerLayer('custom_gnn', CustomGNNFactory);
 * const layer = registry.createLayer('gcn', { inputDim: 64, outputDim: 32 });
 * ```
 */
export class GNNLayerRegistry {
  private readonly factories: Map<GNNLayerType | string, GNNLayerFactory> = new Map();
  private readonly defaultConfigs: Map<GNNLayerType | string, Partial<GNNLayerConfig>> = new Map();

  constructor() {
    // Register built-in layer factories
    this.registerBuiltinLayers();
  }

  /**
   * Register a GNN layer factory.
   * @param type - Layer type identifier
   * @param factory - Factory function
   * @param defaultConfig - Optional default configuration
   */
  registerLayer(
    type: GNNLayerType | string,
    factory: GNNLayerFactory,
    defaultConfig?: Partial<GNNLayerConfig>
  ): void {
    this.factories.set(type, factory);
    if (defaultConfig) {
      this.defaultConfigs.set(type, defaultConfig);
    }
  }

  /**
   * Unregister a GNN layer factory.
   * @param type - Layer type to remove
   * @returns Whether the layer was removed
   */
  unregisterLayer(type: GNNLayerType | string): boolean {
    this.defaultConfigs.delete(type);
    return this.factories.delete(type);
  }

  /**
   * Create a GNN layer instance.
   * @param type - Layer type
   * @param config - Layer configuration
   * @returns IGNNLayer instance
   * @throws Error if layer type is not registered
   */
  createLayer(type: GNNLayerType, config: Partial<GNNLayerConfig>): IGNNLayer {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown GNN layer type: ${type}. Available types: ${this.getLayerTypes().join(', ')}`);
    }

    const defaultConfig = this.defaultConfigs.get(type) ?? {};
    const fullConfig: GNNLayerConfig = {
      type,
      inputDim: config.inputDim ?? 64,
      outputDim: config.outputDim ?? 64,
      dropout: config.dropout ?? defaultConfig.dropout ?? GNN_DEFAULTS.dropout,
      aggregation: config.aggregation ?? defaultConfig.aggregation ?? GNN_DEFAULTS.aggregation,
      addSelfLoops: config.addSelfLoops ?? defaultConfig.addSelfLoops ?? GNN_DEFAULTS.addSelfLoops,
      normalize: config.normalize ?? defaultConfig.normalize ?? GNN_DEFAULTS.normalize,
      useBias: config.useBias ?? defaultConfig.useBias ?? GNN_DEFAULTS.useBias,
      activation: config.activation ?? defaultConfig.activation ?? GNN_DEFAULTS.activation,
      ...config,
    };

    return factory(fullConfig);
  }

  /**
   * Check if a layer type is registered.
   * @param type - Layer type to check
   * @returns Whether the layer is registered
   */
  hasLayer(type: GNNLayerType | string): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered layer types.
   * @returns Array of layer type identifiers
   */
  getLayerTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get default configuration for a layer type.
   * @param type - Layer type
   * @returns Default configuration or undefined
   */
  getDefaultConfig(type: GNNLayerType | string): Partial<GNNLayerConfig> | undefined {
    return this.defaultConfigs.get(type);
  }

  /**
   * Register all built-in GNN layer factories.
   */
  private registerBuiltinLayers(): void {
    // GCN - Graph Convolutional Network
    this.registerLayer('gcn', (config) => new GCNLayer(config), {
      normalize: true,
      addSelfLoops: true,
    });

    // GAT - Graph Attention Network
    this.registerLayer('gat', (config) => new GATLayer(config), {
      numHeads: 8,
      params: { negativeSlope: 0.2, concat: true },
    });

    // GAT v2 - Improved Graph Attention
    this.registerLayer('gat_v2', (config) => new GATv2Layer(config), {
      numHeads: 8,
      params: { negativeSlope: 0.2, concat: true },
    });

    // GraphSAGE - Sampling and Aggregation
    this.registerLayer('sage', (config) => new GraphSAGELayer(config), {
      aggregation: 'mean',
      params: { sampleSize: 10, samplingStrategy: 'uniform' },
    });

    // GIN - Graph Isomorphism Network
    this.registerLayer('gin', (config) => new GINLayer(config), {
      params: { eps: 0, trainEps: false },
    });

    // MPNN - Message Passing Neural Network
    this.registerLayer('mpnn', (config) => new MPNNLayer(config), {
      aggregation: 'sum',
    });

    // EdgeConv - Dynamic Edge Convolution
    this.registerLayer('edge_conv', (config) => new EdgeConvLayer(config), {
      params: { k: 20, dynamic: true },
    });

    // Point Convolution
    this.registerLayer('point_conv', (config) => new PointConvLayer(config), {
      params: { k: 16 },
    });

    // Graph Transformer
    this.registerLayer('transformer', (config) => new GraphTransformerLayer(config), {
      numHeads: 8,
      params: { numLayers: 1 },
    });

    // PNA - Principal Neighbourhood Aggregation
    this.registerLayer('pna', (config) => new PNALayer(config), {
      params: {
        aggregators: ['mean', 'sum', 'max', 'min'],
        scalers: ['identity', 'amplification', 'attenuation'],
      },
    });

    // FiLM - Feature-wise Linear Modulation
    this.registerLayer('film', (config) => new FiLMLayer(config), {});

    // RGCN - Relational Graph Convolutional Network
    this.registerLayer('rgcn', (config) => new RGCNLayer(config), {
      params: { numRelations: 1 },
    });

    // HGT - Heterogeneous Graph Transformer
    this.registerLayer('hgt', (config) => new HGTLayer(config), {
      numHeads: 8,
    });

    // HAN - Heterogeneous Attention Network
    this.registerLayer('han', (config) => new HANLayer(config), {
      numHeads: 8,
    });

    // MetaPath aggregation
    this.registerLayer('metapath', (config) => new MetaPathLayer(config), {
      params: { metapaths: [] },
    });
  }
}


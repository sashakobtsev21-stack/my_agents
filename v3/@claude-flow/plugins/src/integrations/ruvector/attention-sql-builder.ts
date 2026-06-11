/**
 * Attention — SQL builder
 *
 * AttentionSQLBuilder. Extracted verbatim from attention-executor.ts
 * (lines 572-782) during campaign-2 wave 87 (W293).
 * attention-executor.ts stays the barrel.
 */

import type {
  AttentionMechanism,
  AttentionConfig,
  AttentionInput,
  AttentionOutput,
  AttentionStats,
} from './types.js';
import {
  AttentionRegistry,
  type IAttentionMechanism,
  type AttentionOptions,
  type AttentionCategory,
  MultiHeadAttention,
  SelfAttention,
  CrossAttention,
  CausalAttention,
  BidirectionalAttention,
  LocalAttention,
  GlobalAttention,
  FlashAttention,
  FlashAttentionV2,
  MemoryEfficientAttention,
  ChunkAttention,
  SlidingWindowAttention,
  DilatedAttention,
} from './attention.js';
import {
  SparseAttention,
  BlockSparseAttention,
  LinearAttention,
  PerformerAttention,
  LinformerAttention,
  ReformerAttention,
  RelativePositionAttention,
  RotaryPositionAttention,
  ALiBiAttention,
  AxialAttention,
} from './attention-mechanisms.js';
import {
  GraphAttention,
  HyperbolicAttention,
  SphericalAttention,
  ToroidalAttention,
  TemporalAttention,
  RecurrentAttention,
  StateSpaceAttention,
  CrossModalAttention,
  PerceiverAttention,
  FlamingoAttention,
  RetrievalAttention,
  KNNAttention,
  MemoryAugmentedAttention,
  SynthesizerAttention,
  RoutingAttention,
  MixtureOfExpertsAttention,
} from './attention-advanced.js';

// ============================================================================
// SQL Query Builder
// ============================================================================

/**
 * Builds optimized SQL queries for attention operations.
 */
export class AttentionSQLBuilder {
  private schema: string;

  constructor(schema: string = 'ruvector') {
    this.schema = schema;
  }

  /**
   * Build a complete attention query with setup and execution.
   */
  buildComplete(
    mechanism: AttentionMechanism,
    tableName: string,
    queryColumn: string,
    keyColumn: string,
    valueColumn: string,
    options: {
      numHeads?: number;
      scale?: number;
      causal?: boolean;
      limit?: number;
    } = {}
  ): string {
    const { numHeads = 8, scale, causal = false, limit = 100 } = options;
    const computedScale = scale ?? Math.sqrt(64);

    return `
-- Set RuVector parameters
SET ${this.schema}.attention_num_heads = ${numHeads};
SET ${this.schema}.attention_scale = ${computedScale};
SET ${this.schema}.attention_causal = ${causal};

-- Execute attention
SELECT
  id,
  ${this.schema}.${this.mapMechanismToFunction(mechanism)}(
    ${queryColumn},
    ARRAY_AGG(${keyColumn}) OVER (ORDER BY id),
    ARRAY_AGG(${valueColumn}) OVER (ORDER BY id)
  ) AS attention_output
FROM ${tableName}
LIMIT ${limit};
`.trim();
  }

  /**
   * Build batch attention query.
   */
  buildBatch(
    mechanism: AttentionMechanism,
    queries: string,
    keys: string,
    values: string,
    options: {
      numHeads?: number;
      scale?: number;
    } = {}
  ): string {
    const { numHeads = 8, scale } = options;
    const computedScale = scale ?? Math.sqrt(64);

    return `
SELECT ${this.schema}.${this.mapMechanismToFunction(mechanism)}_batch(
  ${queries}::vector[],
  ${keys}::vector[],
  ${values}::vector[],
  ${numHeads},
  ${computedScale}
) AS attention_outputs;
`.trim();
  }

  /**
   * Build attention with retrieved context.
   */
  buildWithRetrieval(
    mechanism: AttentionMechanism,
    queryVector: string,
    tableName: string,
    vectorColumn: string,
    k: number = 10
  ): string {
    return `
WITH retrieved AS (
  SELECT
    ${vectorColumn} as key_vector,
    ${vectorColumn} as value_vector
  FROM ${tableName}
  ORDER BY ${vectorColumn} <-> ${queryVector}
  LIMIT ${k}
)
SELECT ${this.schema}.${this.mapMechanismToFunction(mechanism)}(
  ${queryVector},
  ARRAY(SELECT key_vector FROM retrieved),
  ARRAY(SELECT value_vector FROM retrieved)
) AS attention_output;
`.trim();
  }

  private mapMechanismToFunction(mechanism: AttentionMechanism): string {
    const mapping: Record<AttentionMechanism, string> = {
      'multi_head': 'multi_head_attention',
      'self_attention': 'self_attention',
      'cross_attention': 'cross_attention',
      'sparse_attention': 'sparse_attention',
      'linear_attention': 'linear_attention',
      'local_attention': 'local_attention',
      'global_attention': 'global_attention',
      'flash_attention': 'flash_attention',
      'flash_attention_v2': 'flash_attention_v2',
      'memory_efficient': 'memory_efficient_attention',
      'chunk_attention': 'chunk_attention',
      'sliding_window': 'sliding_window_attention',
      'dilated_attention': 'dilated_attention',
      'block_sparse': 'block_sparse_attention',
      'relative_position': 'relative_position_attention',
      'rotary_position': 'rotary_position_attention',
      'alibi': 'alibi_attention',
      'causal': 'causal_attention',
      'bidirectional': 'bidirectional_attention',
      'axial': 'axial_attention',
      'performer': 'performer_attention',
      'linformer': 'linformer_attention',
      'reformer': 'reformer_attention',
      'synthesizer': 'synthesizer_attention',
      'routing': 'routing_attention',
      'mixture_of_experts': 'moe_attention',
      'graph_attention': 'graph_attention',
      'hyperbolic_attention': 'hyperbolic_attention',
      'spherical_attention': 'spherical_attention',
      'toroidal_attention': 'toroidal_attention',
      'temporal_attention': 'temporal_attention',
      'recurrent_attention': 'recurrent_attention',
      'state_space': 'state_space_attention',
      'cross_modal': 'cross_modal_attention',
      'perceiver': 'perceiver_attention',
      'flamingo': 'flamingo_attention',
      'retrieval_attention': 'retrieval_attention',
      'knn_attention': 'knn_attention',
      'memory_augmented': 'memory_augmented_attention',
    };
    return mapping[mechanism] ?? 'multi_head_attention';
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  AttentionRegistry,
  type IAttentionMechanism,
  type AttentionOptions,
  type AttentionCategory,
} from './attention.js';

// Re-export all mechanism classes for direct instantiation
export {
  MultiHeadAttention,
  SelfAttention,
  CrossAttention,
  CausalAttention,
  BidirectionalAttention,
  LocalAttention,
  GlobalAttention,
  FlashAttention,
  FlashAttentionV2,
  MemoryEfficientAttention,
  ChunkAttention,
  SlidingWindowAttention,
  DilatedAttention,
} from './attention.js';

export {
  SparseAttention,
  BlockSparseAttention,
  LinearAttention,
  PerformerAttention,
  LinformerAttention,
  ReformerAttention,
  RelativePositionAttention,
  RotaryPositionAttention,
  ALiBiAttention,
  AxialAttention,
} from './attention-mechanisms.js';

export {
  GraphAttention,
  HyperbolicAttention,
  SphericalAttention,
  ToroidalAttention,
  TemporalAttention,
  RecurrentAttention,
  StateSpaceAttention,
  CrossModalAttention,
  PerceiverAttention,
  FlamingoAttention,
  RetrievalAttention,
  KNNAttention,
  MemoryAugmentedAttention,
  SynthesizerAttention,
  RoutingAttention,
  MixtureOfExpertsAttention,
} from './attention-advanced.js';

/**
 * RuVector Attention — options, contract & abstract base
 *
 * AttentionOptions/IAttentionMechanism/AttentionCategory plus the
 * abstract BaseAttentionMechanism.
 * Extracted verbatim from attention.ts (lines 21-105 + 204-279) during the P3.53
 * god-file decomposition (W174). attention.ts stays the barrel.
 */

import type {
  AttentionConfig,
  AttentionInput,
  AttentionMechanism,
  AttentionParams,
} from './types.js';

// ============================================================================
// Attention Mechanism Interface
// ============================================================================

/**
 * Options for configuring attention computation.
 */
export interface AttentionOptions {
  /** Number of attention heads */
  numHeads?: number;
  /** Dimension per head */
  headDim?: number;
  /** Dropout rate */
  dropout?: number;
  /** Whether to use causal masking */
  causal?: boolean;
  /** Scale factor for attention scores */
  scale?: number;
  /** Maximum sequence length */
  maxSeqLen?: number;
  /** Mechanism-specific parameters */
  params?: AttentionParams;
}

/**
 * Interface for attention mechanism implementations.
 */
export interface IAttentionMechanism {
  /** Attention mechanism type */
  readonly type: AttentionMechanism;
  /** Human-readable name */
  readonly name: string;
  /** Description of the mechanism */
  readonly description: string;
  /** Category of the mechanism */
  readonly category: AttentionCategory;

  /**
   * Compute attention output from query, keys, and values.
   */
  compute(
    query: number[],
    keys: number[][],
    values: number[][]
  ): Promise<number[]>;

  /**
   * Compute batched attention.
   */
  computeBatch(
    queries: number[][],
    keys: number[][],
    values: number[][]
  ): Promise<number[][]>;

  /**
   * Configure the attention mechanism with options.
   */
  configure(options: AttentionOptions): void;

  /**
   * Generate SQL query for PostgreSQL execution.
   */
  toSQL(input: AttentionInput): string;

  /**
   * Get current configuration.
   */
  getConfig(): AttentionConfig;
}

/**
 * Categories of attention mechanisms.
 */
export type AttentionCategory =
  | 'core'
  | 'efficient'
  | 'positional'
  | 'sparse'
  | 'linear'
  | 'graph'
  | 'temporal'
  | 'multimodal'
  | 'retrieval';


// ============================================================================
// Base Attention Implementation
// ============================================================================

/**
 * Base class for attention mechanism implementations.
 */
export abstract class BaseAttentionMechanism implements IAttentionMechanism {
  abstract readonly type: AttentionMechanism;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: AttentionCategory;

  protected config: AttentionConfig;

  constructor(config?: Partial<AttentionConfig>) {
    // Note: mechanism will be set correctly via getConfig() which uses this.type
    this.config = {
      mechanism: 'multi_head' as AttentionMechanism, // Placeholder, overridden by getConfig
      numHeads: config?.numHeads ?? 8,
      headDim: config?.headDim ?? 64,
      embedDim: config?.embedDim ?? 512,
      dropout: config?.dropout ?? 0.0,
      useBias: config?.useBias ?? true,
      scale: config?.scale,
      causal: config?.causal ?? false,
      maxSeqLen: config?.maxSeqLen ?? 2048,
      params: config?.params,
    };
  }

  configure(options: AttentionOptions): void {
    if (options.numHeads !== undefined) this.config = { ...this.config, numHeads: options.numHeads };
    if (options.headDim !== undefined) this.config = { ...this.config, headDim: options.headDim };
    if (options.dropout !== undefined) this.config = { ...this.config, dropout: options.dropout };
    if (options.causal !== undefined) this.config = { ...this.config, causal: options.causal };
    if (options.scale !== undefined) this.config = { ...this.config, scale: options.scale };
    if (options.maxSeqLen !== undefined) this.config = { ...this.config, maxSeqLen: options.maxSeqLen };
    if (options.params !== undefined) this.config = { ...this.config, params: { ...this.config.params, ...options.params } };
  }

  getConfig(): AttentionConfig {
    return { ...this.config, mechanism: this.type };
  }

  abstract compute(query: number[], keys: number[][], values: number[][]): Promise<number[]>;
  abstract computeBatch(queries: number[][], keys: number[][], values: number[][]): Promise<number[][]>;
  abstract toSQL(input: AttentionInput): string;

  /**
   * Compute attention scale factor.
   */
  protected getScale(): number {
    return this.config.scale ?? Math.sqrt(this.config.headDim);
  }

  /**
   * Format vector for SQL.
   */
  protected formatVector(v: number[] | Float32Array): string {
    const arr = Array.isArray(v) ? v : Array.from(v);
    return `'[${arr.join(',')}]'::vector`;
  }

  /**
   * Format matrix for SQL.
   */
  protected formatMatrix(m: number[][] | Float32Array[]): string {
    const rows = m.map(row => {
      const arr = Array.isArray(row) ? row : Array.from(row);
      return `'[${arr.join(',')}]'::vector`;
    });
    return `ARRAY[${rows.join(',')}]`;
  }
}


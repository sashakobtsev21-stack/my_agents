/**
 * RuVector PostgreSQL Bridge Plugin
 *
 * Production-ready plugin for RuVector PostgreSQL integration providing:
 * - Connection management with pooling
 * - Vector similarity search (HNSW, IVF)
 * - Batch operations
 * - Index management
 * - MCP tool integration
 * - Event emission and metrics
 *
 * @module @claude-flow/plugins/integrations/ruvector
 * @version 1.0.0
 */


// This file is now a thin barrel + factory surface: the bridge was split
// into the sub-modules below during the P3.46 god-file decomposition
// (W167). Kept as ruvector-bridge.ts so './ruvector-bridge.js' importers
// keep resolving byte-identically. ConnectionManager, VectorOps, and the
// internal pg-types/constants/metrics module are NOT re-exported — they
// were module-private before the split.
export { RuVectorBridge } from './ruvector-bridge-core.js';

import { RuVectorBridge } from './ruvector-bridge-core.js';
import type { RuVectorConfig } from './types.js';

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RuVector Bridge plugin instance.
 *
 * @example
 * ```typescript
 * const bridge = createRuVectorBridge({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'vectors',
 *   user: 'postgres',
 *   password: 'password',
 * });
 * ```
 */
export function createRuVectorBridge(config: RuVectorConfig): RuVectorBridge {
  return new RuVectorBridge(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default RuVectorBridge;

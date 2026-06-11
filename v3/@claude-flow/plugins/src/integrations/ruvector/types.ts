/**
 * RuVector PostgreSQL Bridge - Type Definitions
 *
 * Comprehensive TypeScript types for the RuVector PostgreSQL vector database
 * integration, supporting advanced neural search, attention mechanisms,
 * graph neural networks, and hyperbolic embeddings.
 *
 * @module @claude-flow/plugins/integrations/ruvector
 * @version 1.0.0
 */

// This file is now a thin barrel: the type definitions were split into
// the three layer modules below during the P3.40 god-file decomposition
// (W161). Kept as types.ts so the 10 in-directory importers and the test
// utilities that resolve './types.js' keep working byte-identically.
// Layers: domain (config/vector/attention/gnn/hyperbolic) -> api (sql
// functions/stats/events/results) -> client (client iface/guards/factory).
export * from './types-domain.js';
export * from './types-api.js';
export * from './types-client.js';

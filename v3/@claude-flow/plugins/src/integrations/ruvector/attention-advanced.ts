/**
 * RuVector PostgreSQL Bridge - Advanced Attention Mechanisms
 *
 * Part 3: Graph, Temporal, Multimodal, Retrieval, and Specialized attention.
 *
 * @module @claude-flow/plugins/integrations/ruvector/attention-advanced
 */

// This file is now a thin barrel: the 16 advanced mechanisms were split
// into the two sub-modules below during the P3.54 god-file decomposition
// (W175). Kept as attention-advanced.ts so './attention-advanced.js'
// importers (attention-executor / index) keep resolving byte-identically.
export * from './attention-advanced-geometric.js';
export * from './attention-advanced-specialized.js';

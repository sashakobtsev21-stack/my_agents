/**
 * RuVector PostgreSQL Bridge - Additional Attention Mechanisms
 *
 * Part 2: Sparse, Linear, Positional, Graph, Temporal, Multimodal, and Retrieval attention.
 *
 * @module @claude-flow/plugins/integrations/ruvector/attention-mechanisms
 */


// The mechanism classes were split into ./attention-mechanisms-sparse.ts
// and ./attention-mechanisms-positional.ts during campaign-2 wave 86
// (W292). 'export *' keeps the surface byte-identical.
export * from './attention-mechanisms-sparse.js';
export * from './attention-mechanisms-positional.js';

/**
 * RuVector GNN — advanced layer implementations
 *
 * MPNN, EdgeConv, PointConv, GraphTransformer, PNA, FiLM, RGCN,
 * HGT, HAN, and MetaPath layers.
 * Extracted verbatim from gnn.ts (lines 1465-2161) during the P3.41
 * god-file decomposition (W162). gnn.ts stays the barrel.
 */


// The layer classes were split into ./gnn-layers-conv.ts and
// ./gnn-layers-relational.ts during campaign-2 wave 88 (W294).
// 'export *' keeps the surface byte-identical.
export * from './gnn-layers-conv.js';
export * from './gnn-layers-relational.js';

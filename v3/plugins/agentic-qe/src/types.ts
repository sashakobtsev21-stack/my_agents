/**
 * Agentic-QE Plugin Types
 * TypeScript type definitions for all QE domain objects
 *
 * @module v3/plugins/agentic-qe/types
 * @version 3.2.3
 */


// This file is now a thin barrel: the type definitions were split into
// the three modules below during the P3.58 god-file decomposition
// (W179). Kept as types.ts so the './types.js' importers (index.ts,
// plugin.ts) keep resolving byte-identically.
export * from './types-core.js';
export * from './types-analysis.js';
export * from './types-runtime.js';

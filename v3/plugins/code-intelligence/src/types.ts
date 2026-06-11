/**
 * Code Intelligence Plugin - Type Definitions
 *
 * Core types for advanced code analysis including semantic search,
 * architecture analysis, refactoring impact prediction, module splitting,
 * and pattern learning.
 *
 * Based on ADR-035: Advanced Code Intelligence Plugin
 *
 * @module v3/plugins/code-intelligence/types
 */


// ============================================================================

// This file is now a thin barrel: the definitions were split into the
// two modules below during campaign-2 wave 7 (W213). Kept as types.ts so
// the six './types.js' importers (bridges, mcp-tools*, index) keep
// resolving byte-identically.
export * from './types-domain.js';
export * from './types-runtime.js';

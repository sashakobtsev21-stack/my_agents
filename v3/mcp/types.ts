/**
 * V3 MCP Types and Interfaces
 *
 * Optimized type definitions for the V3 MCP server with:
 * - Strict typing for performance
 * - Connection pooling types
 * - Transport layer abstractions
 * - Tool registry interfaces
 *
 * Performance Targets:
 * - Server startup: <400ms
 * - Tool registration: <10ms
 * - Tool execution: <50ms overhead
 */

// Split into ./types-core.ts + ./types-extended.ts during campaign-2 wave W308.
export * from './types-core.js';
export * from './types-extended.js';

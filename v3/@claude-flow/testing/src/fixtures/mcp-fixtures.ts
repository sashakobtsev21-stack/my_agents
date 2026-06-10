/**
 * @claude-flow/testing - MCP Fixtures
 *
 * Comprehensive mock MCP tools, contexts, and server configurations for testing.
 * Supports all MCP protocol operations and Claude-Flow tool integrations.
 *
 * Based on ADR-005 (MCP-first API design) and V3 specifications.
 *
 * This file is now a thin barrel: the fixtures were split into the
 * ./mcp-fixtures/ directory during the P3.33 god-file decomposition (W154).
 * Kept as a file (not a directory) so the deep imports './mcp-fixtures.js'
 * in helpers/mock-factory.ts + mocks/mock-mcp-client.ts resolve unchanged.
 * Sub-modules: types · data · mocks.
 */
export * from './mcp-fixtures/types.js';
export * from './mcp-fixtures/data.js';
export * from './mcp-fixtures/mocks.js';

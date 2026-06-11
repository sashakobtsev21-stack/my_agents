/**
 * MCP Tools for TeammateTool Integration
 *
 * Exposes 21 MCP tools for multi-agent orchestration via Claude Code:
 * - 16 core TeammateTool integration tools
 * - 5 BMSSP optimization tools (10-15x faster with WASM)
 *
 * @module @claude-flow/teammate-plugin/mcp
 * @version 1.0.0-alpha.1
 */


// Definitions and the dispatcher were extracted into ./mcp-tools-defs.ts
// and ./mcp-tools-handler.ts during campaign-2 wave 21 (W227).
export type { MCPTool } from './mcp-tools-defs.js';
export { TEAMMATE_MCP_TOOLS } from './mcp-tools-defs.js';
export type { ToolResult } from './mcp-tools-handler.js';
export { handleMCPTool } from './mcp-tools-handler.js';
import { handleMCPTool } from './mcp-tools-handler.js';
import { TEAMMATE_MCP_TOOLS } from './mcp-tools-defs.js';
import type { MCPTool } from './mcp-tools-defs.js';

// ============================================================================
// Tool Registration Helper
// ============================================================================

export function listTeammateTools(): MCPTool[] {
  return TEAMMATE_MCP_TOOLS;
}

export function hasTeammateTool(name: string): boolean {
  return TEAMMATE_MCP_TOOLS.some(t => t.name === name);
}

export default {
  tools: TEAMMATE_MCP_TOOLS,
  handleTool: handleMCPTool,
  listTools: listTeammateTools,
  hasTool: hasTeammateTool,
};

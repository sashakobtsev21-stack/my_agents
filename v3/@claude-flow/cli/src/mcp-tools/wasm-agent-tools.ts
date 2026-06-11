/**
 * WASM Agent MCP Tools
 *
 * Exposes @ruvector/rvagent-wasm operations via MCP protocol.
 * All tools gracefully degrade when the WASM package is not installed.
 *
 * ADR-129: Phase 2 adds wasm_agent_compose + addMcpTools bridge.
 * Phase 3 adds 10 gallery CRUD + 6 agent introspection tools.
 * Phase 4 adds includePlugins to wasm_agent_compose.
 */


import type { MCPTool } from './types.js';
// Helpers + the tool defs were extracted into the sub-modules below
// during campaign-2 wave 77 (W283).
import { wasmAgentToolDefs } from './wasm-agent-tools-defs.js';

export const wasmAgentTools: MCPTool[] = wasmAgentToolDefs;

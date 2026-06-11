/**
 * Gas Town Bridge Plugin - MCP Tools
 *
 * Implements 20 MCP tools for Gas Town orchestrator integration:
 *
 * Beads Integration (5 tools) - CLI Bridge:
 *   1. gt_beads_create - Create a bead/issue in Beads
 *   2. gt_beads_ready - List ready beads (no blockers)
 *   3. gt_beads_show - Show bead details
 *   4. gt_beads_dep - Manage bead dependencies
 *   5. gt_beads_sync - Sync beads with AgentDB
 *
 * Convoy Operations (3 tools) - CLI Bridge:
 *   6. gt_convoy_create - Create a convoy (work order)
 *   7. gt_convoy_status - Check convoy status
 *   8. gt_convoy_track - Add/remove issues from convoy
 *
 * Formula Engine (4 tools) - WASM Accelerated:
 *   9. gt_formula_list - List available formulas
 *   10. gt_formula_cook - Cook formula into protomolecule (352x faster)
 *   11. gt_formula_execute - Execute a formula
 *   12. gt_formula_create - Create custom formula
 *
 * Orchestration (3 tools) - CLI Bridge:
 *   13. gt_sling - Sling work to an agent
 *   14. gt_agents - List Gas Town agents
 *   15. gt_mail - Send/receive Gas Town mail
 *
 * WASM Computation (5 tools) - Pure WASM:
 *   16. gt_wasm_parse_formula - Parse TOML formula to AST
 *   17. gt_wasm_resolve_deps - Resolve dependency graph
 *   18. gt_wasm_cook_batch - Batch cook multiple formulas
 *   19. gt_wasm_match_pattern - Find similar formulas/beads
 *   20. gt_wasm_optimize_convoy - Optimize convoy execution order
 *
 * Based on ADR-043: Gas Town Bridge Plugin for Claude Flow V3
 *
 * @module v3/plugins/gastown-bridge/mcp-tools
 */


// The tool types/schemas/results and the five tool-domain groups were
// split into the sub-modules below during the P3.71 god-file
// decomposition (W192). Everything in them was public — 'export *'
// barreling keeps './mcp-tools.js' (package barrel + tests)
// byte-identical. The registry stays here.
export * from './mcp-tools-schemas.js';
export * from './mcp-tools-beads.js';
export * from './mcp-tools-convoy.js';
export * from './mcp-tools-formula.js';
export * from './mcp-tools-town.js';
export * from './mcp-tools-wasm.js';

import type { MCPTool } from './mcp-tools-schemas.js';
import { beadsCreateTool, beadsReadyTool, beadsShowTool, beadsDepTool, beadsSyncTool } from './mcp-tools-beads.js';
import { convoyCreateTool, convoyStatusTool, convoyTrackTool } from './mcp-tools-convoy.js';
import { formulaListTool, formulaCookTool, formulaExecuteTool, formulaCreateTool } from './mcp-tools-formula.js';
import { slingTool, agentsTool, mailTool } from './mcp-tools-town.js';
import {
  wasmParseFormulaTool,
  wasmResolveDepsTool,
  wasmCookBatchTool,
  wasmMatchPatternTool,
  wasmOptimizeConvoyTool,
} from './mcp-tools-wasm.js';

// Tool Registry
// ============================================================================

/**
 * All Gas Town Bridge MCP Tools (20 total)
 */
export const gasTownBridgeTools: MCPTool[] = [
  // Beads Integration (5 tools) - CLI Bridge
  beadsCreateTool as unknown as MCPTool,
  beadsReadyTool as unknown as MCPTool,
  beadsShowTool as unknown as MCPTool,
  beadsDepTool as unknown as MCPTool,
  beadsSyncTool as unknown as MCPTool,

  // Convoy Operations (3 tools) - CLI Bridge
  convoyCreateTool as unknown as MCPTool,
  convoyStatusTool as unknown as MCPTool,
  convoyTrackTool as unknown as MCPTool,

  // Formula Engine (4 tools) - WASM Accelerated
  formulaListTool as unknown as MCPTool,
  formulaCookTool as unknown as MCPTool,
  formulaExecuteTool as unknown as MCPTool,
  formulaCreateTool as unknown as MCPTool,

  // Orchestration (3 tools) - CLI Bridge
  slingTool as unknown as MCPTool,
  agentsTool as unknown as MCPTool,
  mailTool as unknown as MCPTool,

  // WASM Computation (5 tools) - Pure WASM
  wasmParseFormulaTool as unknown as MCPTool,
  wasmResolveDepsTool as unknown as MCPTool,
  wasmCookBatchTool as unknown as MCPTool,
  wasmMatchPatternTool as unknown as MCPTool,
  wasmOptimizeConvoyTool as unknown as MCPTool,
];

/**
 * Tool name to handler map
 */
export const toolHandlers = new Map<string, MCPTool['handler']>([
  // Beads tools
  ['gt_beads_create', beadsCreateTool.handler as MCPTool['handler']],
  ['gt_beads_ready', beadsReadyTool.handler as MCPTool['handler']],
  ['gt_beads_show', beadsShowTool.handler as MCPTool['handler']],
  ['gt_beads_dep', beadsDepTool.handler as MCPTool['handler']],
  ['gt_beads_sync', beadsSyncTool.handler as MCPTool['handler']],

  // Convoy tools
  ['gt_convoy_create', convoyCreateTool.handler as MCPTool['handler']],
  ['gt_convoy_status', convoyStatusTool.handler as MCPTool['handler']],
  ['gt_convoy_track', convoyTrackTool.handler as MCPTool['handler']],

  // Formula tools
  ['gt_formula_list', formulaListTool.handler as MCPTool['handler']],
  ['gt_formula_cook', formulaCookTool.handler as MCPTool['handler']],
  ['gt_formula_execute', formulaExecuteTool.handler as MCPTool['handler']],
  ['gt_formula_create', formulaCreateTool.handler as MCPTool['handler']],

  // Orchestration tools
  ['gt_sling', slingTool.handler as MCPTool['handler']],
  ['gt_agents', agentsTool.handler as MCPTool['handler']],
  ['gt_mail', mailTool.handler as MCPTool['handler']],

  // WASM tools
  ['gt_wasm_parse_formula', wasmParseFormulaTool.handler as MCPTool['handler']],
  ['gt_wasm_resolve_deps', wasmResolveDepsTool.handler as MCPTool['handler']],
  ['gt_wasm_cook_batch', wasmCookBatchTool.handler as MCPTool['handler']],
  ['gt_wasm_match_pattern', wasmMatchPatternTool.handler as MCPTool['handler']],
  ['gt_wasm_optimize_convoy', wasmOptimizeConvoyTool.handler as MCPTool['handler']],
]);

/**
 * Tool categories for documentation
 */
export const toolCategories = {
  beads: ['gt_beads_create', 'gt_beads_ready', 'gt_beads_show', 'gt_beads_dep', 'gt_beads_sync'],
  convoy: ['gt_convoy_create', 'gt_convoy_status', 'gt_convoy_track'],
  formula: ['gt_formula_list', 'gt_formula_cook', 'gt_formula_execute', 'gt_formula_create'],
  orchestration: ['gt_sling', 'gt_agents', 'gt_mail'],
  wasm: ['gt_wasm_parse_formula', 'gt_wasm_resolve_deps', 'gt_wasm_cook_batch', 'gt_wasm_match_pattern', 'gt_wasm_optimize_convoy'],
};

/**
 * Get tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  return gasTownBridgeTools.find(t => t.name === name);
}

/**
 * Get tools by layer
 */
export function getToolsByLayer(layer: 'cli' | 'wasm' | 'hybrid'): MCPTool[] {
  return gasTownBridgeTools.filter(t => t.layer === layer);
}

export default gasTownBridgeTools;

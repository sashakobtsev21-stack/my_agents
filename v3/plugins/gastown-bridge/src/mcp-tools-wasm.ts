/**
 * GasTown Bridge MCP Tools — wasm tools
 *
 * Extracted verbatim from mcp-tools.ts (lines 1487-1776) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import type {
  Convoy,
} from './types.js';
import {
  WasmCookBatchInputSchema,
  WasmMatchPatternInputSchema,
  WasmOptimizeConvoyInputSchema,
  WasmParseFormulaInputSchema,
  WasmResolveDepsInputSchema,
} from './mcp-tools-schemas.js';
import type {
  MCPTool,
  MCPToolResult,
  WasmCookBatchInput,
  WasmCookBatchResult,
  WasmMatchPatternInput,
  WasmMatchPatternResult,
  WasmOptimizeConvoyInput,
  WasmOptimizeConvoyResult,
  WasmParseFormulaInput,
  WasmParseFormulaResult,
  WasmResolveDepsInput,
  WasmResolveDepsResult,
} from './mcp-tools-schemas.js';

export const wasmParseFormulaTool: MCPTool<WasmParseFormulaInput, WasmParseFormulaResult> = {
  name: 'gt_wasm_parse_formula',
  description: 'Parse TOML formula content to AST using WASM (352x faster than JavaScript)',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: WasmParseFormulaInputSchema,
  handler: async (input, context): Promise<MCPToolResult<WasmParseFormulaResult>> => {
    const startTime = Date.now();

    try {
      const validated = WasmParseFormulaInputSchema.parse(input);
      const formulaWasm = context.bridges.formulaWasm;

      if (!formulaWasm.isInitialized()) {
        await formulaWasm.initialize();
      }

      const wasmStart = Date.now();
      const ast = await formulaWasm.parseFormula(validated.content, validated.validate);
      const wasmDuration = Date.now() - wasmStart;

      const result: WasmParseFormulaResult = {
        success: true,
        ast,
        wasmPerformanceMs: wasmDuration,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

/**
 * MCP Tool: gt_wasm_resolve_deps
 *
 * Resolve dependency graph using WASM (HNSW-indexed (measured ~1.9x-4.7x) than JS)
 */
export const wasmResolveDepsTool: MCPTool<WasmResolveDepsInput, WasmResolveDepsResult> = {
  name: 'gt_wasm_resolve_deps',
  description: 'Resolve bead dependencies using WASM (topological sort, cycle detection, critical path)',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: WasmResolveDepsInputSchema,
  handler: async (input, context): Promise<MCPToolResult<WasmResolveDepsResult>> => {
    const startTime = Date.now();

    try {
      const validated = WasmResolveDepsInputSchema.parse(input);
      const depWasm = context.bridges.dependencyWasm;

      if (!depWasm.isInitialized()) {
        await depWasm.initialize();
      }

      const wasmStart = Date.now();
      const resolution = await depWasm.resolveDependencies(validated.beads, validated.action);
      const wasmDuration = Date.now() - wasmStart;

      const result: WasmResolveDepsResult = {
        success: true,
        action: validated.action,
        result: resolution,
        wasmPerformanceMs: wasmDuration,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

/**
 * MCP Tool: gt_wasm_cook_batch
 *
 * Batch cook multiple formulas using WASM (352x faster than JS)
 */
export const wasmCookBatchTool: MCPTool<WasmCookBatchInput, WasmCookBatchResult> = {
  name: 'gt_wasm_cook_batch',
  description: 'Batch cook multiple formulas using WASM for maximum performance',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: WasmCookBatchInputSchema,
  handler: async (input, context): Promise<MCPToolResult<WasmCookBatchResult>> => {
    const startTime = Date.now();

    try {
      const validated = WasmCookBatchInputSchema.parse(input);
      const formulaWasm = context.bridges.formulaWasm;

      if (!formulaWasm.isInitialized()) {
        await formulaWasm.initialize();
      }

      const wasmStart = Date.now();
      const { cooked, errors } = await formulaWasm.cookBatch(
        validated.formulas,
        validated.vars,
        validated.continue_on_error
      );
      const wasmDuration = Date.now() - wasmStart;

      const result: WasmCookBatchResult = {
        success: errors.length === 0 || validated.continue_on_error,
        cooked,
        errors,
        wasmPerformanceMs: wasmDuration,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

/**
 * MCP Tool: gt_wasm_match_pattern
 *
 * Find similar formulas/beads using WASM (~1.9x-4.7x (measured) with HNSW)
 */
export const wasmMatchPatternTool: MCPTool<WasmMatchPatternInput, WasmMatchPatternResult> = {
  name: 'gt_wasm_match_pattern',
  description: 'Find similar formulas or beads using HNSW pattern matching (~1.9x-4.7x (measured))',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: WasmMatchPatternInputSchema,
  handler: async (input, context): Promise<MCPToolResult<WasmMatchPatternResult>> => {
    const startTime = Date.now();

    try {
      const validated = WasmMatchPatternInputSchema.parse(input);
      const depWasm = context.bridges.dependencyWasm;

      if (!depWasm.isInitialized()) {
        await depWasm.initialize();
      }

      const wasmStart = Date.now();
      const matches = await depWasm.matchPatterns(
        validated.query,
        validated.candidates,
        validated.k,
        validated.threshold
      );
      const wasmDuration = Date.now() - wasmStart;

      const result: WasmMatchPatternResult = {
        success: true,
        matches,
        wasmPerformanceMs: wasmDuration,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

/**
 * MCP Tool: gt_wasm_optimize_convoy
 *
 * Optimize convoy execution order using WASM (HNSW-indexed (measured ~1.9x-4.7x) than JS)
 */
export const wasmOptimizeConvoyTool: MCPTool<WasmOptimizeConvoyInput, WasmOptimizeConvoyResult> = {
  name: 'gt_wasm_optimize_convoy',
  description: 'Optimize convoy execution order using WASM graph algorithms',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: WasmOptimizeConvoyInputSchema,
  handler: async (input, context): Promise<MCPToolResult<WasmOptimizeConvoyResult>> => {
    const startTime = Date.now();

    try {
      const validated = WasmOptimizeConvoyInputSchema.parse(input);
      const depWasm = context.bridges.dependencyWasm;
      const bridge = context.bridges.gastown;

      if (!depWasm.isInitialized()) {
        await depWasm.initialize();
      }

      // Get convoy details
      const convoys = await bridge.getConvoyStatus(validated.convoy_id, true);
      if (convoys.length === 0) {
        throw new Error(`Convoy not found: ${validated.convoy_id}`);
      }

      const convoy = convoys[0];

      const wasmStart = Date.now();
      const optimization = await depWasm.optimizeConvoy(
        convoy,
        validated.strategy,
        validated.resource_constraints
      );
      const wasmDuration = Date.now() - wasmStart;

      const result: WasmOptimizeConvoyResult = {
        success: true,
        optimization,
        wasmPerformanceMs: wasmDuration,
        durationMs: Date.now() - startTime,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          }, null, 2),
        }],
      };
    }
  },
};

// ============================================================================

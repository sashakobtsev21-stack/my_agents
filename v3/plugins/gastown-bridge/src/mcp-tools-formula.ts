/**
 * GasTown Bridge MCP Tools — formula tools
 *
 * Extracted verbatim from mcp-tools.ts (lines 1090-1322) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import type {
  CookedFormula,
} from './types.js';
import {
  FormulaCookInputSchema,
  FormulaCreateInputSchema,
  FormulaExecuteInputSchema,
  FormulaListInputSchema,
} from './mcp-tools-schemas.js';
import type {
  FormulaCookInput,
  FormulaCookResult,
  FormulaCreateInput,
  FormulaCreateResult,
  FormulaExecuteInput,
  FormulaExecuteResult,
  FormulaListInput,
  FormulaListResult,
  MCPTool,
  MCPToolResult,
} from './mcp-tools-schemas.js';

export const formulaListTool: MCPTool<FormulaListInput, FormulaListResult> = {
  name: 'gt_formula_list',
  description: 'List available Gas Town formulas with optional type filter',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: FormulaListInputSchema,
  handler: async (input, context): Promise<MCPToolResult<FormulaListResult>> => {
    const startTime = Date.now();

    try {
      const validated = FormulaListInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const formulas = await bridge.listFormulas(validated.type, validated.include_builtin);

      const result: FormulaListResult = {
        success: true,
        formulas,
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
 * MCP Tool: gt_formula_cook
 *
 * Cook a formula with variable substitution (352x faster with WASM)
 */
export const formulaCookTool: MCPTool<FormulaCookInput, FormulaCookResult> = {
  name: 'gt_formula_cook',
  description: 'Cook a formula into a protomolecule with variable substitution (WASM accelerated)',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'wasm',
  inputSchema: FormulaCookInputSchema,
  handler: async (input, context): Promise<MCPToolResult<FormulaCookResult>> => {
    const startTime = Date.now();

    try {
      const validated = FormulaCookInputSchema.parse(input);
      let wasmUsed = false;
      let cooked: CookedFormula;

      // Try WASM first if enabled
      if (context.config.enableWasm) {
        try {
          const formulaWasm = context.bridges.formulaWasm;
          if (formulaWasm.isInitialized()) {
            cooked = await formulaWasm.cookFormula(validated.formula, validated.vars, validated.is_content);
            wasmUsed = true;
          } else {
            // Fallback to CLI
            const bridge = context.bridges.gastown;
            cooked = await bridge.cookFormula(validated.formula, validated.vars);
          }
        } catch {
          // Fallback to CLI on WASM error
          const bridge = context.bridges.gastown;
          cooked = await bridge.cookFormula(validated.formula, validated.vars);
        }
      } else {
        const bridge = context.bridges.gastown;
        cooked = await bridge.cookFormula(validated.formula, validated.vars);
      }

      const result: FormulaCookResult = {
        success: true,
        cooked,
        wasmUsed,
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
 * MCP Tool: gt_formula_execute
 *
 * Execute a formula (creates beads/molecules)
 */
export const formulaExecuteTool: MCPTool<FormulaExecuteInput, FormulaExecuteResult> = {
  name: 'gt_formula_execute',
  description: 'Execute a formula to create beads/molecules in Gas Town',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'hybrid',
  inputSchema: FormulaExecuteInputSchema,
  handler: async (input, context): Promise<MCPToolResult<FormulaExecuteResult>> => {
    const startTime = Date.now();

    try {
      const validated = FormulaExecuteInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const { beads_created } = await bridge.executeFormula(
        validated.formula,
        validated.vars,
        validated.target_agent,
        validated.dry_run
      );

      const result: FormulaExecuteResult = {
        success: true,
        formula: validated.formula,
        beads_created,
        target_agent: validated.target_agent,
        dry_run: validated.dry_run,
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
 * MCP Tool: gt_formula_create
 *
 * Create a custom formula
 */
export const formulaCreateTool: MCPTool<FormulaCreateInput, FormulaCreateResult> = {
  name: 'gt_formula_create',
  description: 'Create a custom formula definition',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: FormulaCreateInputSchema,
  handler: async (input, context): Promise<MCPToolResult<FormulaCreateResult>> => {
    const startTime = Date.now();

    try {
      const validated = FormulaCreateInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      // Map steps to ensure description is always a string (Step type requires it)
      const mappedSteps = validated.steps?.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description ?? '', // Provide default empty string
        needs: s.needs,
      }));

      const { path } = await bridge.createFormula({
        name: validated.name,
        type: validated.type,
        steps: mappedSteps,
        vars: validated.vars,
        description: validated.description,
      });

      const result: FormulaCreateResult = {
        success: true,
        name: validated.name,
        path,
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
 * MCP Tool: gt_sling
 *
 * Sling work to a Gas Town agent
 */

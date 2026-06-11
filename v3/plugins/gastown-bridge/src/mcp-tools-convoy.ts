/**
 * GasTown Bridge MCP Tools — convoy tools
 *
 * Extracted verbatim from mcp-tools.ts (lines 943-1089) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import {
  ConvoyCreateInputSchema,
  ConvoyStatusInputSchema,
  ConvoyTrackInputSchema,
} from './mcp-tools-schemas.js';
import type {
  ConvoyCreateInput,
  ConvoyCreateResult,
  ConvoyStatusInput,
  ConvoyStatusResult,
  ConvoyTrackInput,
  ConvoyTrackResult,
  MCPTool,
  MCPToolResult,
} from './mcp-tools-schemas.js';

export const convoyCreateTool: MCPTool<ConvoyCreateInput, ConvoyCreateResult> = {
  name: 'gt_convoy_create',
  description: 'Create a convoy (work order) for tracking and coordinating multiple beads',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: ConvoyCreateInputSchema,
  handler: async (input, context): Promise<MCPToolResult<ConvoyCreateResult>> => {
    const startTime = Date.now();

    try {
      const validated = ConvoyCreateInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const convoy = await bridge.createConvoy({
        name: validated.name,
        issues: validated.issues,
        description: validated.description,
      });

      const result: ConvoyCreateResult = {
        success: true,
        convoy,
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
 * MCP Tool: gt_convoy_status
 *
 * Check convoy status (single or all)
 */
export const convoyStatusTool: MCPTool<ConvoyStatusInput, ConvoyStatusResult> = {
  name: 'gt_convoy_status',
  description: 'Check the status of one or all convoys including progress metrics',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: ConvoyStatusInputSchema,
  handler: async (input, context): Promise<MCPToolResult<ConvoyStatusResult>> => {
    const startTime = Date.now();

    try {
      const validated = ConvoyStatusInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const convoys = await bridge.getConvoyStatus(validated.convoy_id, validated.detailed);

      const result: ConvoyStatusResult = {
        success: true,
        convoys,
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
 * MCP Tool: gt_convoy_track
 *
 * Add or remove issues from a convoy
 */
export const convoyTrackTool: MCPTool<ConvoyTrackInput, ConvoyTrackResult> = {
  name: 'gt_convoy_track',
  description: 'Add or remove issues from an existing convoy',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: ConvoyTrackInputSchema,
  handler: async (input, context): Promise<MCPToolResult<ConvoyTrackResult>> => {
    const startTime = Date.now();

    try {
      const validated = ConvoyTrackInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      await bridge.trackConvoy(validated.convoy_id, validated.action, validated.issues);

      const result: ConvoyTrackResult = {
        success: true,
        convoy_id: validated.convoy_id,
        action: validated.action,
        issues_modified: validated.issues,
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
 * MCP Tool: gt_formula_list
 *
 * List available formulas
 */

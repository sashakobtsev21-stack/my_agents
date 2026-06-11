/**
 * GasTown Bridge MCP Tools — beads tools
 *
 * Extracted verbatim from mcp-tools.ts (lines 670-942) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import {
  BeadsCreateInputSchema,
  BeadsDepInputSchema,
  BeadsReadyInputSchema,
  BeadsShowInputSchema,
  BeadsSyncInputSchema,
} from './mcp-tools-schemas.js';
import type {
  BeadCreateResult,
  BeadDepResult,
  BeadShowResult,
  BeadsCreateInput,
  BeadsDepInput,
  BeadsReadyInput,
  BeadsReadyResult,
  BeadsShowInput,
  BeadsSyncInput,
  BeadsSyncResult,
  MCPTool,
  MCPToolResult,
} from './mcp-tools-schemas.js';

// Tool Handlers
// ============================================================================

/**
 * MCP Tool: gt_beads_create
 *
 * Create a bead/issue in the Beads system
 */
export const beadsCreateTool: MCPTool<BeadsCreateInput, BeadCreateResult> = {
  name: 'gt_beads_create',
  description: 'Create a bead (issue/task) in the Gas Town Beads system with priority and labels',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: BeadsCreateInputSchema,
  handler: async (input, context): Promise<MCPToolResult<BeadCreateResult>> => {
    const startTime = Date.now();

    try {
      const validated = BeadsCreateInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const bead = await bridge.createBead({
        title: validated.title,
        description: validated.description,
        priority: validated.priority,
        labels: validated.labels,
        parent: validated.parent,
        rig: validated.rig,
      });

      const result: BeadCreateResult = {
        success: true,
        bead,
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
 * MCP Tool: gt_beads_ready
 *
 * List beads that are ready to work on (no blockers)
 */
export const beadsReadyTool: MCPTool<BeadsReadyInput, BeadsReadyResult> = {
  name: 'gt_beads_ready',
  description: 'List beads that are ready to work on (no unresolved dependencies)',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: BeadsReadyInputSchema,
  handler: async (input, context): Promise<MCPToolResult<BeadsReadyResult>> => {
    const startTime = Date.now();

    try {
      const validated = BeadsReadyInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const limit = Math.min(validated.limit, context.config.maxBeadsLimit);
      const beads = await bridge.getReady(limit, validated.rig, validated.labels);

      const result: BeadsReadyResult = {
        success: true,
        beads,
        total: beads.length,
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
 * MCP Tool: gt_beads_show
 *
 * Show detailed information about a specific bead
 */
export const beadsShowTool: MCPTool<BeadsShowInput, BeadShowResult> = {
  name: 'gt_beads_show',
  description: 'Show detailed information about a specific bead including dependencies',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: BeadsShowInputSchema,
  handler: async (input, context): Promise<MCPToolResult<BeadShowResult>> => {
    const startTime = Date.now();

    try {
      const validated = BeadsShowInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const { bead, dependencies, dependents } = await bridge.showBead(validated.bead_id);

      const result: BeadShowResult = {
        success: true,
        bead,
        dependencies,
        dependents,
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
 * MCP Tool: gt_beads_dep
 *
 * Manage bead dependencies (add/remove)
 */
export const beadsDepTool: MCPTool<BeadsDepInput, BeadDepResult> = {
  name: 'gt_beads_dep',
  description: 'Add or remove dependencies between beads',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: BeadsDepInputSchema,
  handler: async (input, context): Promise<MCPToolResult<BeadDepResult>> => {
    const startTime = Date.now();

    try {
      const validated = BeadsDepInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      await bridge.manageDependency(validated.action, validated.child, validated.parent);

      const result: BeadDepResult = {
        success: true,
        action: validated.action,
        child: validated.child,
        parent: validated.parent,
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
 * MCP Tool: gt_beads_sync
 *
 * Sync beads with AgentDB (bidirectional)
 */
export const beadsSyncTool: MCPTool<BeadsSyncInput, BeadsSyncResult> = {
  name: 'gt_beads_sync',
  description: 'Synchronize beads between Gas Town and Claude Flow AgentDB',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'hybrid',
  inputSchema: BeadsSyncInputSchema,
  handler: async (input, context): Promise<MCPToolResult<BeadsSyncResult>> => {
    const startTime = Date.now();

    try {
      const validated = BeadsSyncInputSchema.parse(input);
      const syncService = context.bridges.beadsSync;

      let pulled = 0;
      let pushed = 0;
      let conflicts = 0;

      if (validated.direction === 'pull' || validated.direction === 'both') {
        const pullResult = await syncService.pullBeads(validated.rig, validated.namespace);
        pulled = pullResult.synced;
        conflicts += pullResult.conflicts;
      }

      if (validated.direction === 'push' || validated.direction === 'both') {
        const pushResult = await syncService.pushTasks(validated.namespace);
        pushed = pushResult.pushed;
        conflicts += pushResult.conflicts;
      }

      const result: BeadsSyncResult = {
        success: true,
        direction: validated.direction,
        pulled,
        pushed,
        conflicts,
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
 * MCP Tool: gt_convoy_create
 *
 * Create a convoy (work order) for tracking multiple issues
 */

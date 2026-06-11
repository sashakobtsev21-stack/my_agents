/**
 * GasTown Bridge MCP Tools — sling / agents / mail tools
 *
 * Extracted verbatim from mcp-tools.ts (lines 1323-1486) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import type {
  GasTownMail,
} from './types.js';
import {
  AgentsInputSchema,
  MailInputSchema,
  SlingInputSchema,
} from './mcp-tools-schemas.js';
import type {
  AgentsInput,
  AgentsResult,
  MCPTool,
  MCPToolResult,
  MailInput,
  MailResult,
  SlingInput,
  SlingResult,
} from './mcp-tools-schemas.js';

export const slingTool: MCPTool<SlingInput, SlingResult> = {
  name: 'gt_sling',
  description: 'Sling (assign) a bead to a Gas Town agent for processing',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: SlingInputSchema,
  handler: async (input, context): Promise<MCPToolResult<SlingResult>> => {
    const startTime = Date.now();

    try {
      const validated = SlingInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      await bridge.sling(validated.bead_id, validated.target, validated.formula, validated.priority);

      const result: SlingResult = {
        success: true,
        bead_id: validated.bead_id,
        target: validated.target,
        formula_used: validated.formula,
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
 * MCP Tool: gt_agents
 *
 * List Gas Town agents
 */
export const agentsTool: MCPTool<AgentsInput, AgentsResult> = {
  name: 'gt_agents',
  description: 'List Gas Town agents with optional role and rig filters',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: AgentsInputSchema,
  handler: async (input, context): Promise<MCPToolResult<AgentsResult>> => {
    const startTime = Date.now();

    try {
      const validated = AgentsInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      const agents = await bridge.listAgents(validated.rig, validated.role, validated.include_inactive);

      const result: AgentsResult = {
        success: true,
        agents,
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
 * MCP Tool: gt_mail
 *
 * Send/receive Gas Town mail
 */
export const mailTool: MCPTool<MailInput, MailResult> = {
  name: 'gt_mail',
  description: 'Send, read, or list Gas Town internal mail messages',
  category: 'gastown-bridge',
  version: '0.1.0',
  layer: 'cli',
  inputSchema: MailInputSchema,
  handler: async (input, context): Promise<MCPToolResult<MailResult>> => {
    const startTime = Date.now();

    try {
      const validated = MailInputSchema.parse(input);
      const bridge = context.bridges.gastown;

      let messages: GasTownMail[] | undefined;
      let sent_id: string | undefined;

      switch (validated.action) {
        case 'send':
          if (!validated.to || !validated.subject || !validated.body) {
            throw new Error('send action requires to, subject, and body');
          }
          sent_id = await bridge.sendMail(validated.to, validated.subject, validated.body);
          break;
        case 'read':
          if (!validated.mail_id) {
            throw new Error('read action requires mail_id');
          }
          messages = [await bridge.readMail(validated.mail_id)];
          break;
        case 'list':
          messages = await bridge.listMail(validated.limit);
          break;
      }

      const result: MailResult = {
        success: true,
        action: validated.action,
        messages,
        sent_id,
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
 * MCP Tool: gt_wasm_parse_formula
 *
 * Parse TOML formula to AST (352x faster than JS)
 */

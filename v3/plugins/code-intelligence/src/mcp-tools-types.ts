/**
 * Code Intelligence MCP Tools — public tool types
 *
 * MCPTool / ToolContext / MCPToolResult. Extracted verbatim from
 * mcp-tools.ts (lines 48-89) during the P3.63 god-file decomposition
 * (W184). mcp-tools.ts re-exports all three (the package index.ts
 * re-exports them onward) so importers resolve byte-identically.
 */

import { z } from 'zod';
import type { IGNNBridge, IMinCutBridge } from './types.js';

// MCP Tool Types
// ============================================================================

/**
 * MCP Tool definition
 */
export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  category: string;
  version: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, any>;
  handler: (input: TInput, context: ToolContext) => Promise<MCPToolResult<TOutput>>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  bridges: {
    gnn: IGNNBridge;
    mincut: IMinCutBridge;
  };
  config: {
    allowedRoots: string[];
    blockedPatterns: RegExp[];
    maskSecrets: boolean;
  };
}

/**
 * MCP Tool result format
 */
export interface MCPToolResult<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  data?: T;
}

// ============================================================================

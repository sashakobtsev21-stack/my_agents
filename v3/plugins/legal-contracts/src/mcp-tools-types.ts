/**
 * Legal Contracts MCP Tools — public tool types
 *
 * MCPTool / ToolContext / MCPToolResult. Extracted verbatim from
 * mcp-tools.ts (lines 45-81) during the P3.64 god-file decomposition
 * (W185). mcp-tools.ts re-exports all three (the package index.ts
 * re-exports them onward) so importers resolve byte-identically.
 */

import { z } from 'zod';
import type { IAttentionBridge, IDAGBridge } from './types.js';

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
    attention: IAttentionBridge;
    dag: IDAGBridge;
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

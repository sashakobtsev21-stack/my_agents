/**
 * MCP tool framework types for the claims tools (compatible with
 * v3/mcp/types.ts) — JSONSchema, ToolContext, ToolHandler, MCPTool.
 *
 * Extracted from mcp-tools.ts (W129, P3.17 cut #3).
 */
import type { ClaimsService } from './store.js';

/**
 * JSON Schema type for tool input
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionId: string;
  requestId?: string | number | null;
  orchestrator?: unknown;
  swarmCoordinator?: unknown;
  agentManager?: unknown;
  claimsService?: ClaimsService;
  metadata?: Record<string, unknown>;
}

/**
 * Tool handler function type
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context?: ToolContext
) => Promise<TOutput>;

/**
 * MCP Tool definition
 */
export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: ToolHandler<TInput, TOutput>;
  category?: string;
  tags?: string[];
  version?: string;
  deprecated?: boolean;
  cacheable?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

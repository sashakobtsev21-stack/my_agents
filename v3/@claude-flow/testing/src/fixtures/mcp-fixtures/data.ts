/**
 * MCP data fixtures + factory builders — pre-defined tools / resources /
 * prompts / server-configs / tool-results / errors / session-contexts, the
 * create* fixture builders, and the invalid-config samples.
 *
 * Extracted from mcp-fixtures.ts (W154, P3.33 cut #2).
 */
import type {
  MCPTool, MCPToolResult, MCPResource, MCPPrompt, MCPServerConfig,
  MCPError, MCPSessionContext, MCPRequestBase, MCPResponseBase,
  MCPTransportType, MCPTransportConfig,
} from './types.js';

/**
 * Pre-defined MCP tools for Claude-Flow
 */

// The fixture data tables were extracted into ./data-tables.ts during
// campaign-2 wave 90 (W296). 'export *' keeps the surface
// byte-identical.
export * from './data-tables.js';
import { mcpServerConfigs, mcpSessionContexts, mcpTools } from './data-tables.js';

export function createMCPTool(
  base: keyof typeof mcpTools,
  overrides?: Partial<MCPTool>
): MCPTool {
  return {
    ...mcpTools[base],
    ...overrides,
  };
}

/**
 * Factory function to create MCP server config
 */
export function createMCPServerConfig(
  base: keyof typeof mcpServerConfigs = 'development',
  overrides?: Partial<MCPServerConfig>
): MCPServerConfig {
  return {
    ...mcpServerConfigs[base],
    ...overrides,
  };
}

/**
 * Factory function to create MCP request
 */
export function createMCPRequest(
  method: string,
  params?: Record<string, unknown>,
  overrides?: Partial<MCPRequestBase>
): MCPRequestBase {
  return {
    jsonrpc: '2.0',
    id: `req-${Date.now()}`,
    method,
    params,
    ...overrides,
  };
}

/**
 * Factory function to create MCP response
 */
export function createMCPResponse<T>(
  id: string | number,
  result?: T,
  error?: MCPError
): MCPResponseBase<T> {
  return {
    jsonrpc: '2.0',
    id,
    result,
    error,
  };
}

/**
 * Factory function to create MCP tool result
 */
export function createMCPToolResult(
  text: string,
  isError: boolean = false
): MCPToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Factory function to create session context
 */
export function createMCPSessionContext(
  base: keyof typeof mcpSessionContexts = 'active',
  overrides?: Partial<MCPSessionContext>
): MCPSessionContext {
  return {
    ...mcpSessionContexts[base],
    ...overrides,
    sessionId: overrides?.sessionId ?? `session-${Date.now()}`,
    startedAt: overrides?.startedAt ?? new Date(),
    lastActivity: overrides?.lastActivity ?? new Date(),
  };
}

/**
 * Invalid MCP configurations for error testing
 */
export const invalidMCPConfigs = {
  emptyName: {
    ...mcpServerConfigs.development,
    name: '',
  },

  invalidPort: {
    ...mcpServerConfigs.development,
    transport: {
      type: 'http' as MCPTransportType,
      port: -1,
      host: 'localhost',
    },
  },

  missingTransport: {
    name: 'invalid-server',
    version: '1.0.0',
    transport: undefined as unknown as MCPTransportConfig,
  },
};

/**
 * Mock MCP client interface
 */

/**
 * Vitest mock factories for MCP — MockMCPClient / MockMCPServer /
 * MockMCPTransport interfaces + their create* builders (vi.fn-backed).
 *
 * Extracted from mcp-fixtures.ts (W154, P3.33 cut #3 — final).
 */
import { vi, type Mock } from 'vitest';
import type { MCPTool, MCPToolResult, MCPResource, MCPPrompt, MCPResourceContent, MCPSessionContext, MCPRequestBase, MCPResponseBase, MCPServerStatus } from './types.js';
import { mcpTools, mcpToolResults, mcpResources, mcpPrompts, mcpSessionContexts } from './data.js';

export interface MockMCPClient {
  connect: Mock<() => Promise<void>>;
  disconnect: Mock<() => Promise<void>>;
  callTool: Mock<(name: string, params: Record<string, unknown>) => Promise<MCPToolResult>>;
  listTools: Mock<() => Promise<MCPTool[]>>;
  readResource: Mock<(uri: string) => Promise<MCPResourceContent>>;
  listResources: Mock<() => Promise<MCPResource[]>>;
  getPrompt: Mock<(name: string, args: Record<string, string>) => Promise<string>>;
  listPrompts: Mock<() => Promise<MCPPrompt[]>>;
  isConnected: Mock<() => boolean>;
  getSessionContext: Mock<() => MCPSessionContext | null>;
}

/**
 * Create a mock MCP client
 */
export function createMockMCPClient(): MockMCPClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue(mcpToolResults.success),
    listTools: vi.fn().mockResolvedValue(Object.values(mcpTools)),
    readResource: vi.fn().mockResolvedValue({
      type: 'resource',
      resource: { uri: 'test://resource', text: '{}' },
    }),
    listResources: vi.fn().mockResolvedValue(Object.values(mcpResources)),
    getPrompt: vi.fn().mockResolvedValue('Generated prompt text'),
    listPrompts: vi.fn().mockResolvedValue(Object.values(mcpPrompts)),
    isConnected: vi.fn().mockReturnValue(true),
    getSessionContext: vi.fn().mockReturnValue(mcpSessionContexts.active),
  };
}

/**
 * Mock MCP server interface
 */
export interface MockMCPServer {
  start: Mock<() => Promise<void>>;
  stop: Mock<() => Promise<void>>;
  registerTool: Mock<(tool: MCPTool) => void>;
  registerResource: Mock<(resource: MCPResource) => void>;
  registerPrompt: Mock<(prompt: MCPPrompt) => void>;
  handleRequest: Mock<(request: MCPRequestBase) => Promise<MCPResponseBase>>;
  getStatus: Mock<() => MCPServerStatus>;
}

/**
 * Create a mock MCP server
 */
export function createMockMCPServer(): MockMCPServer {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    handleRequest: vi.fn().mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { success: true },
    }),
    getStatus: vi.fn().mockReturnValue({
      running: true,
      transport: 'http',
      connectedClients: 1,
      toolsRegistered: Object.keys(mcpTools).length,
      resourcesRegistered: Object.keys(mcpResources).length,
      promptsRegistered: Object.keys(mcpPrompts).length,
      requestsHandled: 100,
      errorsCount: 0,
      uptime: 3600000,
    }),
  };
}

/**
 * Mock transport interface
 */
export interface MockMCPTransport {
  send: Mock<(message: string) => Promise<void>>;
  receive: Mock<() => Promise<string>>;
  close: Mock<() => Promise<void>>;
  isOpen: Mock<() => boolean>;
}

/**
 * Create a mock MCP transport
 */
export function createMockMCPTransport(): MockMCPTransport {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    receive: vi.fn().mockResolvedValue('{}'),
    close: vi.fn().mockResolvedValue(undefined),
    isOpen: vi.fn().mockReturnValue(true),
  };
}

/**
 * Mock MCP — server & connection
 *
 * MockMCPServer + MockMCPConnection. Extracted verbatim from
 * mock-mcp-client.ts (lines 346-565) during campaign-2 wave 94 (W300).
 * mock-mcp-client.ts stays the barrel.
 */

import { vi } from 'vitest';
import { MCPClientError } from './mock-mcp-client.js';
import type {
  MCPRequest,
  MCPResponse,
  MCPServerStatus,
} from './mock-mcp-client.js';
import type {
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPServerConfig,
} from '../fixtures/mcp-fixtures.js';

export class MockMCPServer {
  private _running = false;
  private _config: MCPServerConfig | null = null;
  private _tools = new Map<string, MCPTool>();
  private _resources = new Map<string, MCPResource>();
  private _prompts = new Map<string, MCPPrompt>();
  private _connections: MockMCPConnection[] = [];
  private _requestLog: MCPRequest[] = [];
  private _errorCount = 0;

  start = vi.fn(async (config: MCPServerConfig) => {
    this._config = config;
    this._running = true;

    // Register configured tools/resources/prompts
    if (config.tools) {
      for (const tool of config.tools) {
        this._tools.set(tool.name, tool);
      }
    }
    if (config.resources) {
      for (const resource of config.resources) {
        this._resources.set(resource.uri, resource);
      }
    }
    if (config.prompts) {
      for (const prompt of config.prompts) {
        this._prompts.set(prompt.name, prompt);
      }
    }
  });

  stop = vi.fn(async () => {
    for (const conn of this._connections) {
      await conn.close();
    }
    this._connections = [];
    this._running = false;
  });

  handleRequest = vi.fn(async (request: MCPRequest): Promise<MCPResponse> => {
    this._requestLog.push(request);

    try {
      switch (request.method) {
        case 'tools/call':
          return this.handleToolCall(request);
        case 'resources/read':
          return this.handleResourceRead(request);
        case 'prompts/get':
          return this.handlePromptGet(request);
        case 'tools/list':
          return { id: request.id, result: Array.from(this._tools.values()), timestamp: new Date() };
        case 'resources/list':
          return { id: request.id, result: Array.from(this._resources.values()), timestamp: new Date() };
        case 'prompts/list':
          return { id: request.id, result: Array.from(this._prompts.values()), timestamp: new Date() };
        default:
          throw new MCPClientError(`Unknown method: ${request.method}`, -32601);
      }
    } catch (error) {
      this._errorCount++;
      return {
        id: request.id,
        error: { code: -32000, message: (error as Error).message },
        timestamp: new Date(),
      };
    }
  });

  registerTool = vi.fn((tool: MCPTool) => {
    this._tools.set(tool.name, tool);
  });

  registerResource = vi.fn((resource: MCPResource) => {
    this._resources.set(resource.uri, resource);
  });

  registerPrompt = vi.fn((prompt: MCPPrompt) => {
    this._prompts.set(prompt.name, prompt);
  });

  getStatus = vi.fn((): MCPServerStatus => ({
    running: this._running,
    transport: this._config?.transport.type ?? 'stdio',
    connectedClients: this._connections.length,
    toolsRegistered: this._tools.size,
    resourcesRegistered: this._resources.size,
    promptsRegistered: this._prompts.size,
    requestsHandled: this._requestLog.length,
    errorsCount: this._errorCount,
    uptime: this._running ? Date.now() : 0,
  }));

  /**
   * Simulate a client connection
   */
  acceptConnection(): MockMCPConnection {
    const conn = new MockMCPConnection(this);
    this._connections.push(conn);
    return conn;
  }

  /**
   * Get request log
   */
  getRequestLog(): MCPRequest[] {
    return [...this._requestLog];
  }

  /**
   * Reset server
   */
  reset(): void {
    this._running = false;
    this._config = null;
    this._tools.clear();
    this._resources.clear();
    this._prompts.clear();
    this._connections = [];
    this._requestLog = [];
    this._errorCount = 0;
    vi.clearAllMocks();
  }

  private handleToolCall(request: MCPRequest): MCPResponse {
    const { name } = request.params as { name: string; arguments: Record<string, unknown> };
    const tool = this._tools.get(name);

    if (!tool) {
      return {
        id: request.id,
        error: { code: -32601, message: `Tool not found: ${name}` },
        timestamp: new Date(),
      };
    }

    return {
      id: request.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify({ success: true, tool: name }) }],
      },
      timestamp: new Date(),
    };
  }

  private handleResourceRead(request: MCPRequest): MCPResponse {
    const { uri } = request.params as { uri: string };
    const resource = this._resources.get(uri);

    if (!resource) {
      return {
        id: request.id,
        error: { code: -32002, message: `Resource not found: ${uri}` },
        timestamp: new Date(),
      };
    }

    return {
      id: request.id,
      result: {
        type: 'resource',
        resource: { uri, mimeType: resource.mimeType, text: '{}' },
      },
      timestamp: new Date(),
    };
  }

  private handlePromptGet(request: MCPRequest): MCPResponse {
    const { name } = request.params as { name: string };
    const prompt = this._prompts.get(name);

    if (!prompt) {
      return {
        id: request.id,
        error: { code: -32003, message: `Prompt not found: ${name}` },
        timestamp: new Date(),
      };
    }

    return {
      id: request.id,
      result: {
        messages: [{ role: 'user', content: { type: 'text', text: `Prompt: ${name}` } }],
      },
      timestamp: new Date(),
    };
  }
}

/**
 * Mock MCP Connection
 */
export class MockMCPConnection {
  private _open = true;
  private _server: MockMCPServer;

  constructor(server: MockMCPServer) {
    this._server = server;
  }

  send = vi.fn(async (request: MCPRequest): Promise<MCPResponse> => {
    if (!this._open) {
      throw new MCPClientError('Connection closed', -32000);
    }
    return this._server.handleRequest(request);
  });

  close = vi.fn(async () => {
    this._open = false;
  });

  isOpen(): boolean {
    return this._open;
  }
}

/**
 * MCP Client Error
 */

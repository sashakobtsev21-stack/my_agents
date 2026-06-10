/**
 * MCP fixture types — transport/content unions + the MCP tool / result /
 * content / server-config / resource / prompt / capabilities / request /
 * response / error / status / session-context shapes.
 *
 * Extracted from mcp-fixtures.ts (W154, P3.33 cut #1).
 */

export type MCPTransportType = 'stdio' | 'http' | 'websocket';

/**
 * MCP content types
 */
export type MCPContentType = 'text' | 'image' | 'resource';

/**
 * MCP input schema type (JSON Schema subset)
 */
export interface MCPInputSchema {
  type: 'object';
  properties: Record<string, MCPPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * MCP property schema
 */
export interface MCPPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPInputSchema;
  handler?: (params: Record<string, unknown>) => Promise<MCPToolResult>;
}

/**
 * MCP tool result
 */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * MCP content (text, image, or resource)
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

/**
 * MCP text content
 */
export interface MCPTextContent {
  type: 'text';
  text: string;
}

/**
 * MCP image content
 */
export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * MCP resource content
 */
export interface MCPResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  transport: MCPTransportConfig;
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
  capabilities?: MCPCapabilities;
}

/**
 * MCP transport configuration
 */
export interface MCPTransportConfig {
  type: MCPTransportType;
  port?: number;
  host?: string;
  path?: string;
  timeout?: number;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/**
 * MCP prompt argument
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP capabilities
 */
export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
  experimental?: Record<string, boolean>;
}

/**
 * MCP request base
 */
export interface MCPRequestBase {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP response base
 */
export interface MCPResponseBase<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: MCPError;
}

/**
 * MCP error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP server status
 */
export interface MCPServerStatus {
  running: boolean;
  transport: MCPTransportType;
  connectedClients: number;
  toolsRegistered: number;
  resourcesRegistered: number;
  promptsRegistered: number;
  requestsHandled: number;
  errorsCount: number;
  uptime: number;
}

/**
 * MCP session context
 */
export interface MCPSessionContext {
  sessionId: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: MCPCapabilities;
  startedAt: Date;
  lastActivity: Date;
  requestCount: number;
}

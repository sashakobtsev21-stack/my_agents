/**
 * Shared MCP types — core
 *
 * Extracted verbatim during campaign-2 wave W308. Barrel stays.
 */

// ============================================================================
// Core Protocol Types
// ============================================================================

/**
 * JSON-RPC 2.0 Protocol Version
 */
export type JsonRpcVersion = '2.0';

/**
 * MCP Protocol Version. Per the [MCP spec](https://spec.modelcontextprotocol.io/specification/basic/lifecycle/#initialization)
 * this must be a `YYYY-MM-DD` date string (e.g. `'2024-11-05'`, `'2025-06-18'`).
 * Claude Code's Zod validator rejects any other shape (#1874).
 */
export type MCPProtocolVersion = string;

/**
 * MCP Request ID (can be string, number, or null)
 */
export type RequestId = string | number | null;

/**
 * Base MCP Message
 */
export interface MCPMessage {
  jsonrpc: JsonRpcVersion;
}

/**
 * MCP Request
 */
export interface MCPRequest extends MCPMessage {
  id: RequestId;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP Notification (request without id)
 */
export interface MCPNotification extends MCPMessage {
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP Error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Response
 */
export interface MCPResponse extends MCPMessage {
  id: RequestId;
  result?: unknown;
  error?: MCPError;
}

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Transport type options
 */
export type TransportType = 'stdio' | 'http' | 'websocket' | 'in-process';

/**
 * Authentication method
 */
export type AuthMethod = 'token' | 'oauth' | 'api-key' | 'none';

/**
 * Authentication configuration
 */
export interface AuthConfig {
  enabled: boolean;
  method: AuthMethod;
  tokens?: string[];
  apiKeys?: string[];
  jwtSecret?: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
  };
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  enabled: boolean;
  maxConcurrentRequests: number;
  rateLimit?: {
    requestsPerSecond: number;
    burstSize: number;
  };
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
  };
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  acquireTimeout: number;
  maxWaitingClients: number;
  evictionRunInterval: number;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  transport: TransportType;
  host?: string;
  port?: number;
  tlsEnabled?: boolean;
  tlsCert?: string;
  tlsKey?: string;
  auth?: AuthConfig;
  loadBalancer?: LoadBalancerConfig;
  connectionPool?: ConnectionPoolConfig;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  maxRequestSize?: number;
  requestTimeout?: number;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  cacheTTL?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * MCP Session state
 */
export type SessionState = 'created' | 'initializing' | 'ready' | 'closing' | 'closed' | 'error';

/**
 * MCP Session
 */
export interface MCPSession {
  id: string;
  state: SessionState;
  transport: TransportType;
  createdAt: Date;
  lastActivityAt: Date;
  isInitialized: boolean;
  isAuthenticated: boolean;
  clientInfo?: MCPClientInfo;
  protocolVersion?: MCPProtocolVersion;
  capabilities?: MCPCapabilities;
  metadata?: Record<string, unknown>;
}

/**
 * Client information from initialization
 */
export interface MCPClientInfo {
  name: string;
  version: string;
}

// ============================================================================
// Capability Types
// ============================================================================

/**
 * MCP Capabilities
 */
export interface MCPCapabilities {
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  tools?: {
    listChanged: boolean;
  };
  resources?: {
    listChanged: boolean;
    subscribe: boolean;
  };
  prompts?: {
    listChanged: boolean;
  };
  experimental?: Record<string, unknown>;
}

/**
 * Initialize request parameters
 */
export interface MCPInitializeParams {
  protocolVersion: MCPProtocolVersion;
  capabilities: MCPCapabilities;
  clientInfo: MCPClientInfo;
}

/**
 * Initialize response result
 */
export interface MCPInitializeResult {
  protocolVersion: MCPProtocolVersion;
  capabilities: MCPCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

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
  requestId?: RequestId;
  orchestrator?: unknown;
  swarmCoordinator?: unknown;
  agentManager?: unknown;
  resourceManager?: unknown;
  messageBus?: unknown;
  monitor?: unknown;
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

/**
 * Shared MCP types — extended
 *
 * Extracted verbatim during campaign-2 wave W308. Barrel stays.
 */
import type { JSONSchema, MCPError, MCPNotification, MCPRequest, MCPResponse, ToolHandler, TransportType } from './types-core.js';

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

/**
 * Tool call result
 */
export interface ToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  override?: boolean;
  validate?: boolean;
  preload?: boolean;
}

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Request handler function type
 */
export type RequestHandler = (request: MCPRequest) => Promise<MCPResponse>;

/**
 * Notification handler function type
 */
export type NotificationHandler = (notification: MCPNotification) => Promise<void>;

/**
 * Transport health status
 */
export interface TransportHealthStatus {
  healthy: boolean;
  error?: string;
  metrics?: Record<string, number>;
}

/**
 * Transport interface
 */
export interface ITransport {
  readonly type: TransportType;

  start(): Promise<void>;
  stop(): Promise<void>;

  onRequest(handler: RequestHandler): void;
  onNotification(handler: NotificationHandler): void;

  sendNotification?(notification: MCPNotification): Promise<void>;

  getHealthStatus(): Promise<TransportHealthStatus>;
}

// ============================================================================
// Connection Pool Types
// ============================================================================

/**
 * Connection state
 */
export type ConnectionState = 'idle' | 'busy' | 'closing' | 'closed' | 'error';

/**
 * Pooled connection
 */
export interface PooledConnection {
  id: string;
  state: ConnectionState;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
  transport: TransportType;
  metadata?: Record<string, unknown>;
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  idleConnections: number;
  busyConnections: number;
  pendingRequests: number;
  totalAcquired: number;
  totalReleased: number;
  totalCreated: number;
  totalDestroyed: number;
  avgAcquireTime: number;
}

/**
 * Connection pool interface
 */
export interface IConnectionPool {
  acquire(): Promise<PooledConnection>;
  release(connection: PooledConnection): void;
  destroy(connection: PooledConnection): void;

  getStats(): ConnectionPoolStats;

  drain(): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Tool call metrics
 */
export interface ToolCallMetrics {
  toolName: string;
  duration: number;
  success: boolean;
  timestamp: number;
  transport: TransportType;
  cached?: boolean;
}

/**
 * MCP Server metrics
 */
export interface MCPServerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeSessions: number;
  toolInvocations: Record<string, number>;
  errors: Record<string, number>;
  lastReset: Date;
  startupTime?: number;
  uptime?: number;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  total: number;
  active: number;
  authenticated: number;
  expired: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * MCP Event types
 */
export type MCPEventType =
  | 'server:started'
  | 'server:stopped'
  | 'server:error'
  | 'session:created'
  | 'session:initialized'
  | 'session:closed'
  | 'session:error'
  | 'tool:registered'
  | 'tool:unregistered'
  | 'tool:called'
  | 'tool:completed'
  | 'tool:error'
  | 'transport:connected'
  | 'transport:disconnected'
  | 'transport:error'
  | 'pool:connection:acquired'
  | 'pool:connection:released'
  | 'pool:connection:created'
  | 'pool:connection:destroyed';

/**
 * MCP Event
 */
export interface MCPEvent {
  type: MCPEventType;
  timestamp: Date;
  data?: unknown;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: MCPEvent) => void;

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard JSON-RPC error codes
 */
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_NOT_INITIALIZED: -32002,
  UNKNOWN_ERROR: -32001,
  REQUEST_CANCELLED: -32800,
  RATE_LIMITED: -32000,
  AUTHENTICATION_REQUIRED: -32001,
  AUTHORIZATION_FAILED: -32002,
} as const;

/**
 * MCP Error class
 */
export class MCPServerError extends Error {
  constructor(
    message: string,
    public code: number = ErrorCodes.INTERNAL_ERROR,
    public data?: unknown
  ) {
    super(message);
    this.name = 'MCPServerError';
  }

  toMCPError(): MCPError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

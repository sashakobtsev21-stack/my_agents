/**
 * MCP types — extended
 *
 * Extracted verbatim during campaign-2 wave W308. Barrel stays.
 */
import type { AudioContent, EmbeddedResource, ImageContent, MCPError, MCPNotification, MCPPrompt, MCPRequest, MCPResponse, PromptRole, RequestId, TextContent, TransportType } from './types-core.js';

export type PromptContent = TextContent | ImageContent | AudioContent | EmbeddedResource;

export interface PromptMessage {
  role: PromptRole;
  content: PromptContent;
}

export interface PromptListResult {
  prompts: MCPPrompt[];
  nextCursor?: string;
}

export interface PromptGetResult {
  description?: string;
  messages: PromptMessage[];
}

// ============================================================================
// Task Types (MCP 2025-11-25 - Async Operations)
// ============================================================================

export type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface MCPTask {
  id: string;
  state: TaskState;
  progress?: TaskProgress;
  result?: unknown;
  error?: MCPError;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TaskProgress {
  progress: number;
  total?: number;
  message?: string;
}

export interface TaskResult {
  taskId: string;
  state: TaskState;
  progress?: TaskProgress;
  result?: unknown;
  error?: MCPError;
}

// ============================================================================
// Pagination Types (MCP 2025-11-25)
// ============================================================================

export interface PaginatedRequest {
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

// ============================================================================
// Progress & Cancellation Types (MCP 2025-11-25)
// ============================================================================

export interface ProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

export interface CancellationParams {
  requestId: RequestId;
  reason?: string;
}

// ============================================================================
// Sampling Types (MCP 2025-11-25 - Server-initiated LLM)
// ============================================================================

export interface SamplingMessage {
  role: PromptRole;
  content: PromptContent;
}

export interface ModelPreferences {
  hints?: Array<{ name?: string }>;
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface CreateMessageRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMessageResult {
  role: 'assistant';
  content: PromptContent;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

// ============================================================================
// Roots Types (MCP 2025-11-25)
// ============================================================================

export interface Root {
  uri: string;
  name?: string;
}

export interface RootsListResult {
  roots: Root[];
}

// ============================================================================
// Logging Types (MCP 2025-11-25)
// ============================================================================

export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export interface LoggingMessage {
  level: MCPLogLevel;
  logger?: string;
  data?: unknown;
}

// ============================================================================
// Completion Types (MCP 2025-11-25)
// ============================================================================

export interface CompletionReference {
  type: 'ref/prompt' | 'ref/resource';
  name?: string;
  uri?: string;
}

export interface CompletionArgument {
  name: string;
  value: string;
}

export interface CompletionResult {
  values: string[];
  total?: number;
  hasMore?: boolean;
}

// ============================================================================
// Transport Types
// ============================================================================

export type RequestHandler = (request: MCPRequest) => Promise<MCPResponse>;

export type NotificationHandler = (notification: MCPNotification) => Promise<void>;

export interface TransportHealthStatus {
  healthy: boolean;
  error?: string;
  metrics?: Record<string, number>;
}

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

export type ConnectionState = 'idle' | 'busy' | 'closing' | 'closed' | 'error';

export interface PooledConnection {
  id: string;
  state: ConnectionState;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
  transport: TransportType;
  metadata?: Record<string, unknown>;
}

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

export interface ToolCallMetrics {
  toolName: string;
  duration: number;
  success: boolean;
  timestamp: number;
  transport: TransportType;
  cached?: boolean;
}

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

export interface SessionMetrics {
  total: number;
  active: number;
  authenticated: number;
  expired: number;
}

// ============================================================================
// Event Types
// ============================================================================

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

export interface MCPEvent {
  type: MCPEventType;
  timestamp: Date;
  data?: unknown;
}

export type EventHandler = (event: MCPEvent) => void;

// ============================================================================
// Logger Interface
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

// ============================================================================
// Error Codes
// ============================================================================

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

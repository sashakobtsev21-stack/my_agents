/**
 * Mock Factory — service interface contracts
 *
 * The IEventBus/ITaskManager/IAgentLifecycle/IMemoryService/
 * ISecurityService/etc. interfaces the mock factories implement.
 * Extracted verbatim from mock-factory.ts (lines 17-280) during
 * campaign-2 wave 89 (W295). mock-factory.ts stays the barrel
 * ('export *').
 */

import type { V3AgentType, AgentInstance, AgentMetrics } from '../fixtures/agent-fixtures.js';
import type { SearchResult, VectorQuery } from '../fixtures/memory-fixtures.js';
import type { SwarmState, SwarmConfig, SwarmTask, CoordinationResult } from '../fixtures/swarm-fixtures.js';
import type { MCPTool, MCPToolResult, MCPSessionContext } from '../fixtures/mcp-fixtures.js';

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): () => void;
  unsubscribe(eventType: string, handler: EventHandler): void;
  getSubscriberCount(eventType: string): number;
}

/**
 * Domain event interface
 */
export interface DomainEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Task manager interface
 */
export interface ITaskManager {
  create(definition: TaskDefinition): Promise<Task>;
  execute(taskId: string): Promise<TaskResult>;
  cancel(taskId: string): Promise<void>;
  getStatus(taskId: string): Promise<TaskStatus>;
  getTask(taskId: string): Promise<Task | null>;
  listTasks(filters?: TaskFilters): Promise<Task[]>;
}

/**
 * Task definition interface
 */
export interface TaskDefinition {
  name: string;
  type: string;
  payload: unknown;
  priority?: number;
  dependencies?: string[];
  deadline?: Date;
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  name: string;
  type: string;
  status: TaskStatus;
  payload: unknown;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Task status type
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task result interface
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
}

/**
 * Task filters interface
 */
export interface TaskFilters {
  status?: TaskStatus;
  type?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Agent lifecycle interface
 */
export interface IAgentLifecycle {
  spawn(config: AgentConfig): Promise<AgentSpawnResult>;
  terminate(agentId: string, options?: TerminateOptions): Promise<void>;
  getAgent(agentId: string): Promise<AgentInstance | null>;
  listAgents(filters?: AgentFilters): Promise<AgentInstance[]>;
  getMetrics(agentId: string): Promise<AgentMetrics>;
  healthCheck(agentId: string): Promise<AgentHealthCheck>;
}

/**
 * Agent config interface
 */
export interface AgentConfig {
  type: V3AgentType;
  name: string;
  capabilities?: string[];
  priority?: number;
}

/**
 * Agent spawn result interface
 */
export interface AgentSpawnResult {
  agent: AgentInstance;
  sessionId: string;
  startupTime: number;
  success: boolean;
}

/**
 * Terminate options interface
 */
export interface TerminateOptions {
  graceful?: boolean;
  timeout?: number;
  cancelTasks?: boolean;
}

/**
 * Agent filters interface
 */
export interface AgentFilters {
  type?: V3AgentType;
  status?: string;
  capability?: string;
}

/**
 * Agent health check interface
 */
export interface AgentHealthCheck {
  healthy: boolean;
  issues?: string[];
  lastActivity: Date;
  metrics: AgentMetrics;
}

/**
 * Memory service interface
 */
export interface IMemoryService {
  store(key: string, value: unknown, metadata?: Record<string, unknown>): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  search(query: VectorQuery): Promise<SearchResult[]>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<MemoryStats>;
  createIndex(name: string, config: IndexConfig): Promise<void>;
}

/**
 * Memory stats interface
 */
export interface MemoryStats {
  totalEntries: number;
  totalSizeBytes: number;
  vectorCount: number;
  cacheHitRate: number;
}

/**
 * Index config interface
 */
export interface IndexConfig {
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot';
  M?: number;
  efConstruction?: number;
}

/**
 * Security service interface
 */
export interface ISecurityService {
  validatePath(path: string): boolean;
  validateInput(input: string, options?: InputValidationOptions): { valid: boolean; errors?: string[] };
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateToken(payload: Record<string, unknown>, expiresIn?: number): Promise<string>;
  verifyToken(token: string): Promise<Record<string, unknown>>;
  executeSecurely(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;
}

/**
 * Input validation options
 */
export interface InputValidationOptions {
  maxLength?: number;
  allowedChars?: RegExp;
  sanitize?: boolean;
}

/**
 * Execute options interface
 */
export interface ExecuteOptions {
  timeout?: number;
  cwd?: string;
  shell?: boolean;
  allowedCommands?: string[];
}

/**
 * Execute result interface
 */
export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

/**
 * Swarm coordinator interface
 */
export interface ISwarmCoordinator {
  initialize(config: SwarmConfig): Promise<SwarmState>;
  coordinate(agents: string[], task: SwarmTask): Promise<CoordinationResult>;
  shutdown(graceful?: boolean): Promise<void>;
  getState(): SwarmState;
  addAgent(agentId: string): Promise<void>;
  removeAgent(agentId: string): Promise<void>;
  broadcast(message: unknown): Promise<void>;
}

/**
 * MCP client interface
 */
export interface IMCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  callTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult>;
  listTools(): Promise<MCPTool[]>;
  isConnected(): boolean;
  getSession(): MCPSessionContext | null;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/**
 * Create mock event bus with behavior tracking
 */

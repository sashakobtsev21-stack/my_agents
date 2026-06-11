/**
 * Agentic-Flow Agent — status/type aliases, agent/task/message shapes
 *
 * Extracted verbatim from agentic-flow-agent.ts (lines 28-248) during
 * campaign-2 wave 54 (W260). The 10 public shapes are re-exported by
 * the barrel; AgenticFlowAgentReference stays unexported from it.
 */

export type AgentStatus = 'spawning' | 'active' | 'idle' | 'busy' | 'error' | 'terminated';

/**
 * Agent type classification
 */
export type AgentType =
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'researcher'
  | 'planner'
  | 'architect'
  | 'coordinator'
  | 'security'
  | 'performance'
  | 'custom';

/**
 * Core agent configuration interface
 */
export interface IAgentConfig {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType | string;
  capabilities: string[];
  maxConcurrentTasks: number;
  priority: number;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  resources?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Core agent entity interface
 */
export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType | string;
  readonly config: IAgentConfig;
  readonly createdAt: Date;
  status: AgentStatus;
  currentTaskCount: number;
  lastActivity: Date;
  sessionId?: string;
  terminalId?: string;
  memoryBankId?: string;
  metrics?: {
    tasksCompleted: number;
    tasksFailed: number;
    avgTaskDuration: number;
    errorCount: number;
    uptime: number;
  };
  health?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    issues?: string[];
  };
}

/**
 * Agent session interface (not used in this implementation)
 */
export interface IAgentSession {
  readonly id: string;
  readonly agentId: string;
  readonly startTime: Date;
  status: 'active' | 'idle' | 'terminated';
  terminalId: string;
  memoryBankId: string;
  lastActivity: Date;
  endTime?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Task interface for agent execution
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task type/category */
  type: string;
  /** Task description */
  description: string;
  /** Task input data */
  input?: Record<string, unknown>;
  /** Task priority (0-10) */
  priority?: number;
  /** Task timeout in milliseconds */
  timeout?: number;
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task result interface
 */
export interface TaskResult {
  /** Task identifier */
  taskId: string;
  /** Success status */
  success: boolean;
  /** Result data */
  output?: unknown;
  /** Error if failed */
  error?: Error;
  /** Execution duration in milliseconds */
  duration: number;
  /** Tokens used (if applicable) */
  tokensUsed?: number;
  /** Result metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message interface for agent communication
 */
export interface Message {
  /** Message identifier */
  id: string;
  /** Sender agent ID */
  from: string;
  /** Message type */
  type: string;
  /** Message payload */
  payload: unknown;
  /** Timestamp */
  timestamp: number;
  /** Correlation ID for request-response */
  correlationId?: string;
}

/**
 * Agent health information
 */
export interface AgentHealth {
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Last health check timestamp */
  lastCheck: number;
  /** Active issues */
  issues: string[];
  /** Metrics */
  metrics: {
    uptime: number;
    tasksCompleted: number;
    tasksFailed: number;
    avgLatency: number;
    memoryUsageMb: number;
    cpuPercent: number;
  };
}

/**
 * Interface for agentic-flow Agent reference (for delegation)
 * This represents the agentic-flow Agent class API
 */
export interface AgenticFlowAgentReference {
  id: string;
  type: string;
  status: string;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
  execute?(task: unknown): Promise<unknown>;
  sendMessage?(to: string, message: unknown): Promise<void>;
  getHealth?(): Promise<unknown>;
  getMetrics?(): Promise<unknown>;
}

/**
 * AgenticFlowAgent Configuration
 */
export interface AgentConfig extends IAgentConfig {
  /** Enable delegation to agentic-flow */
  enableDelegation?: boolean;
  /** agentic-flow specific configuration */
  agenticFlowConfig?: Record<string, unknown>;
}

/**
 * AgenticFlowAgent - Base class for all Claude Flow v3 agents
 *
 * This class serves as the foundation for all agent types in Claude Flow v3,
 * implementing ADR-001 by delegating to agentic-flow when available while
 * maintaining backward compatibility with local implementations.
 *
 * Usage:
 * ```typescript
 * const agent = new AgenticFlowAgent({
 *   id: 'agent-123',
 *   name: 'Coder Agent',
 *   type: 'coder',
 *   capabilities: ['code-generation', 'refactoring'],
 *   maxConcurrentTasks: 3,
 *   priority: 5,
 * });
 *
 * await agent.initialize();
 *
 * // Execute task with automatic delegation
 * const result = await agent.executeTask({
 *   id: 'task-1',
 *   type: 'code',
 *   description: 'Implement authentication',
 * });
 *
 * // Access health metrics
 * const health = agent.getHealth();
 * console.log('Agent health:', health.status);
 * ```
 */

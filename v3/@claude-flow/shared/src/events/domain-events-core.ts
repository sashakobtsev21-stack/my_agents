/**
 * Domain events — core
 *
 * Extracted verbatim during campaign-2 wave W303. Barrel stays.
 */
import { AgentId, TaskId, EventType, SwarmEvent } from '../types.js';

// =============================================================================
// Base Domain Event Interface
// =============================================================================

export interface DomainEvent {
  /** Unique event identifier */
  id: string;

  /** Event type discriminator */
  type: string;

  /** Aggregate ID (entity the event belongs to) */
  aggregateId: string;

  /** Aggregate type (agent, task, memory, swarm) */
  aggregateType: 'agent' | 'task' | 'memory' | 'swarm';

  /** Event version for ordering */
  version: number;

  /** Timestamp when event occurred */
  timestamp: number;

  /** Event source (agent or swarm system) */
  source: AgentId | 'swarm';

  /** Event payload data */
  payload: Record<string, unknown>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Optional causation ID (event that caused this event) */
  causationId?: string;

  /** Optional correlation ID (groups related events) */
  correlationId?: string;
}

// =============================================================================
// Agent Lifecycle Events
// =============================================================================

export interface AgentSpawnedEvent extends DomainEvent {
  type: 'agent:spawned';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    role: string;
    domain: string;
    capabilities: string[];
  };
}

export interface AgentStartedEvent extends DomainEvent {
  type: 'agent:started';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    startedAt: number;
  };
}

export interface AgentStoppedEvent extends DomainEvent {
  type: 'agent:stopped';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    reason: string;
    stoppedAt: number;
  };
}

export interface AgentFailedEvent extends DomainEvent {
  type: 'agent:failed';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    error: string;
    stack?: string;
    failedAt: number;
  };
}

export interface AgentStatusChangedEvent extends DomainEvent {
  type: 'agent:status-changed';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    previousStatus: string;
    newStatus: string;
  };
}

export interface AgentTaskAssignedEvent extends DomainEvent {
  type: 'agent:task-assigned';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    taskId: TaskId;
    assignedAt: number;
  };
}

export interface AgentTaskCompletedEvent extends DomainEvent {
  type: 'agent:task-completed';
  aggregateType: 'agent';
  payload: {
    agentId: AgentId;
    taskId: TaskId;
    result: unknown;
    completedAt: number;
    duration: number;
  };
}

// =============================================================================
// Task Execution Events
// =============================================================================

export interface TaskCreatedEvent extends DomainEvent {
  type: 'task:created';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    taskType: string;
    title: string;
    description: string;
    priority: string;
    dependencies: TaskId[];
    createdAt: number;
  };
}

export interface TaskStartedEvent extends DomainEvent {
  type: 'task:started';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    agentId: AgentId;
    startedAt: number;
  };
}

export interface TaskCompletedEvent extends DomainEvent {
  type: 'task:completed';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    result: unknown;
    completedAt: number;
    duration: number;
  };
}

export interface TaskFailedEvent extends DomainEvent {
  type: 'task:failed';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    error: string;
    stack?: string;
    failedAt: number;
    retryCount: number;
  };
}

export interface TaskBlockedEvent extends DomainEvent {
  type: 'task:blocked';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    blockedBy: TaskId[];
    blockedAt: number;
  };
}

export interface TaskQueuedEvent extends DomainEvent {
  type: 'task:queued';
  aggregateType: 'task';
  payload: {
    taskId: TaskId;
    priority: string;
    queuedAt: number;
  };
}


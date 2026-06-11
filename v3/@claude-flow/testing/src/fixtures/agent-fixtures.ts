/**
 * @claude-flow/testing - Agent Fixtures
 *
 * Comprehensive mock agents and agent configurations for testing V3 modules.
 * Supports all 15 V3 specialized swarm agents plus core development agents.
 *
 * Based on ADR-002 (Domain-Driven Design) and V3 agent specifications.
 */
import { vi, type Mock } from 'vitest';

/**
 * Agent types for V3 15-agent swarm
 */
export type V3AgentType =
  | 'queen-coordinator'
  | 'security-architect'
  | 'security-auditor'
  | 'memory-specialist'
  | 'swarm-specialist'
  | 'integration-architect'
  | 'performance-engineer'
  | 'core-architect'
  | 'test-architect'
  | 'project-coordinator'
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'planner'
  | 'researcher';

/**
 * Agent status type
 */
export type AgentStatus = 'idle' | 'busy' | 'terminated' | 'error' | 'starting';

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  type: V3AgentType;
  name: string;
  capabilities: string[];
  priority?: number;
  metadata?: Record<string, unknown>;
  systemPrompt?: string;
  tools?: string[];
  maxConcurrentTasks?: number;
  timeout?: number;
}

/**
 * Agent instance interface
 */
export interface AgentInstance {
  id: string;
  type: V3AgentType;
  name: string;
  status: AgentStatus;
  capabilities: string[];
  createdAt: Date;
  lastActiveAt?: Date;
  currentTaskId?: string;
  metrics?: AgentMetrics;
}

/**
 * Agent metrics interface
 */
export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgTaskDuration: number;
  totalDuration: number;
  errorRate: number;
  memoryUsageMb: number;
}

/**
 * Agent permissions interface
 */
export interface AgentPermissions {
  canSpawnAgents: boolean;
  canTerminateAgents: boolean;
  canAccessFiles: boolean;
  canExecuteCommands: boolean;
  canAccessNetwork: boolean;
  canAccessMemory: boolean;
  maxMemoryMb?: number;
  maxCpuPercent?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
}

/**
 * Agent spawn result interface
 */
export interface AgentSpawnResult {
  agent: AgentInstance;
  sessionId: string;
  startupTime: number;
  success: boolean;
  error?: Error;
}

/**
 * Agent termination result interface
 */
export interface AgentTerminationResult {
  agentId: string;
  success: boolean;
  duration: number;
  tasksTerminated: number;
  error?: Error;
}

/**
 * Agent health check result interface
 */
export interface AgentHealthCheckResult {
  agentId: string;
  status: AgentStatus;
  healthy: boolean;
  lastActivity: Date;
  metrics: AgentMetrics;
  issues?: string[];
}

/**
 * Capability definitions for each agent type
 */

// The fixture data tables were extracted into ./agent-fixture-data.ts
// during campaign-2 wave 58 (W264).
export * from './agent-fixture-data.js';
import {
  agentCapabilities,
  agentConfigs,
  agentInstances,
} from './agent-fixture-data.js';

export function createAgentConfig(
  base: keyof typeof agentConfigs | V3AgentType,
  overrides?: Partial<AgentConfig>
): AgentConfig {
  const baseConfig = typeof base === 'string' && base in agentConfigs
    ? agentConfigs[base]
    : {
        type: base as V3AgentType,
        name: `${base} Agent`,
        capabilities: agentCapabilities[base as V3AgentType] ?? [],
      };

  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Factory function to create agent instance with overrides
 */
export function createAgentInstance(
  base: keyof typeof agentInstances | V3AgentType,
  overrides?: Partial<AgentInstance>
): AgentInstance {
  const baseInstance = typeof base === 'string' && base in agentInstances
    ? agentInstances[base]
    : {
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: base as V3AgentType,
        name: `${base} Agent`,
        status: 'idle' as AgentStatus,
        capabilities: agentCapabilities[base as V3AgentType] ?? [],
        createdAt: new Date(),
      };

  return {
    ...baseInstance,
    ...overrides,
    id: overrides?.id ?? baseInstance.id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: overrides?.createdAt ?? baseInstance.createdAt ?? new Date(),
  };
}

/**
 * Factory function to create spawn result
 */
export function createAgentSpawnResult(
  agent: Partial<AgentInstance>,
  overrides?: Partial<AgentSpawnResult>
): AgentSpawnResult {
  const fullAgent = createAgentInstance(agent.type ?? 'coder', agent);

  return {
    agent: fullAgent,
    sessionId: `session-${Date.now()}`,
    startupTime: Math.random() * 100 + 50,
    success: true,
    ...overrides,
  };
}

/**
 * Factory function to create termination result
 */
export function createAgentTerminationResult(
  agentId: string,
  overrides?: Partial<AgentTerminationResult>
): AgentTerminationResult {
  return {
    agentId,
    success: true,
    duration: Math.random() * 50 + 10,
    tasksTerminated: 0,
    ...overrides,
  };
}

/**
 * Factory function to create health check result
 */
export function createAgentHealthCheckResult(
  agentId: string,
  overrides?: Partial<AgentHealthCheckResult>
): AgentHealthCheckResult {
  return {
    agentId,
    status: 'idle',
    healthy: true,
    lastActivity: new Date(),
    metrics: {
      tasksCompleted: 50,
      tasksFailed: 1,
      avgTaskDuration: 200,
      totalDuration: 10000,
      errorRate: 0.02,
      memoryUsageMb: 128,
    },
    ...overrides,
  };
}

/**
 * Create a full 15-agent V3 swarm configuration
 */
export function createV3SwarmAgentConfigs(): AgentConfig[] {
  return [
    agentConfigs.queenCoordinator,
    agentConfigs.securityArchitect,
    agentConfigs.securityAuditor,
    agentConfigs.memorySpecialist,
    agentConfigs.swarmSpecialist,
    agentConfigs.integrationArchitect,
    agentConfigs.performanceEngineer,
    agentConfigs.coreArchitect,
    agentConfigs.testArchitect,
    agentConfigs.projectCoordinator,
    agentConfigs.coder,
    agentConfigs.reviewer,
    agentConfigs.tester,
    agentConfigs.planner,
    agentConfigs.researcher,
  ];
}

/**
 * Create instances for all 15 V3 agents
 */
export function createV3SwarmAgentInstances(): AgentInstance[] {
  return createV3SwarmAgentConfigs().map((config, index) =>
    createAgentInstance(config.type, {
      id: `v3-agent-${config.type}-${index}`,
      name: config.name,
      status: 'idle',
      capabilities: config.capabilities,
    })
  );
}

/**
 * Create agents grouped by domain
 */
export function createAgentsByDomain(): Record<string, AgentConfig[]> {
  return {
    security: [agentConfigs.securityArchitect, agentConfigs.securityAuditor],
    core: [agentConfigs.coreArchitect, agentConfigs.coder, agentConfigs.reviewer],
    memory: [agentConfigs.memorySpecialist],
    coordination: [agentConfigs.queenCoordinator, agentConfigs.swarmSpecialist],
    integration: [agentConfigs.integrationArchitect],
    performance: [agentConfigs.performanceEngineer],
    testing: [agentConfigs.testArchitect, agentConfigs.tester],
    planning: [agentConfigs.projectCoordinator, agentConfigs.planner, agentConfigs.researcher],
  };
}

/**
 * Invalid agent configurations for error testing
 */
export const invalidAgentConfigs = {
  emptyName: {
    type: 'coder' as V3AgentType,
    name: '',
    capabilities: ['coding'],
  },

  noCapabilities: {
    type: 'coder' as V3AgentType,
    name: 'Invalid Agent',
    capabilities: [],
  },

  invalidType: {
    type: 'invalid-type' as V3AgentType,
    name: 'Invalid Agent',
    capabilities: ['something'],
  },

  negativePriority: {
    type: 'coder' as V3AgentType,
    name: 'Invalid Agent',
    capabilities: ['coding'],
    priority: -1,
  },

  zeroTimeout: {
    type: 'coder' as V3AgentType,
    name: 'Invalid Agent',
    capabilities: ['coding'],
    timeout: 0,
  },

  excessiveConcurrency: {
    type: 'coder' as V3AgentType,
    name: 'Invalid Agent',
    capabilities: ['coding'],
    maxConcurrentTasks: 1000,
  },
};

/**
 * Mock agent interface for behavior testing
 */
export interface MockAgent {
  id: string;
  type: V3AgentType;
  status: AgentStatus;
  capabilities: string[];
  execute: Mock<(task: unknown) => Promise<unknown>>;
  communicate: Mock<(message: unknown) => Promise<void>>;
  terminate: Mock<() => Promise<void>>;
  getMetrics: Mock<() => AgentMetrics>;
}

/**
 * Create a mock agent for testing
 */
export function createMockAgent(
  type: V3AgentType = 'coder',
  overrides?: Partial<AgentInstance>
): MockAgent {
  const instance = createAgentInstance(type, overrides);

  return {
    id: instance.id,
    type: instance.type,
    status: instance.status,
    capabilities: instance.capabilities,
    execute: vi.fn().mockResolvedValue({ success: true }),
    communicate: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue(instance.metrics ?? {
      tasksCompleted: 0,
      tasksFailed: 0,
      avgTaskDuration: 0,
      totalDuration: 0,
      errorRate: 0,
      memoryUsageMb: 64,
    }),
  };
}

/**
 * Create multiple mock agents
 */
export function createMockAgents(types: V3AgentType[]): MockAgent[] {
  return types.map(type => createMockAgent(type));
}

/**
 * Create a mock V3 15-agent swarm
 */
export function createMockV3Swarm(): MockAgent[] {
  const types: V3AgentType[] = [
    'queen-coordinator',
    'security-architect',
    'security-auditor',
    'memory-specialist',
    'swarm-specialist',
    'integration-architect',
    'performance-engineer',
    'core-architect',
    'test-architect',
    'project-coordinator',
    'coder',
    'reviewer',
    'tester',
    'planner',
    'researcher',
  ];

  return createMockAgents(types);
}

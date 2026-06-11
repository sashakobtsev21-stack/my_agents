/**
 * Mock Services — supporting shapes
 *
 * The swarm/memory/event/security interfaces the mocks share.
 * Module-private in the original mock-services.ts (campaign-2 W263);
 * NOT re-exported by the barrel.
 */

import type { V3AgentType } from '../fixtures/agent-fixtures.js';


// Supporting types
export interface SwarmState {
  id: string;
  topology: string;
  status: string;
  agentCount: number;
  activeAgentCount: number;
  leaderId?: string;
  createdAt: Date;
}

export interface SwarmInitConfig {
  topology?: string;
  maxAgents?: number;
}

export interface AgentConfig {
  type: V3AgentType;
  name?: string;
  capabilities?: string[];
  priority?: number;
}

export interface SwarmTask {
  id: string;
  type: string;
  payload: unknown;
  priority?: number;
  maxAgents?: number;
}

export interface SwarmMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
}

export interface ConsensusRequest<T> {
  topic: string;
  options: T[];
  voters?: string[];
  timeout?: number;
}

export interface ConsensusResponse<T> {
  topic: string;
  decision: T | null;
  votes: Map<string, T>;
  consensus: boolean;
  votingDuration: number;
  participatingAgents: string[];
}

export interface MemoryMetadata {
  type: 'short-term' | 'long-term' | 'semantic' | 'episodic';
  tags: string[];
  ttl?: number;
  [key: string]: unknown;
}

export interface VectorSearchQuery {
  embedding?: number[];
  topK: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResult {
  key: string;
  value: unknown;
  score: number;
  metadata: MemoryMetadata;
}

export interface DomainEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface InputValidationOptions {
  maxLength?: number;
  allowedChars?: RegExp;
  sanitize?: boolean;
}

export interface ExecuteOptions {
  timeout?: number;
  cwd?: string;
  shell?: boolean;
}

// Agent capabilities mapping
export const agentCapabilities: Record<V3AgentType, string[]> = {
  'queen-coordinator': ['orchestration', 'coordination', 'task-distribution'],
  'security-architect': ['security', 'design', 'threat-modeling'],
  'security-auditor': ['security', 'audit', 'vulnerability'],
  'memory-specialist': ['memory', 'optimization', 'caching'],
  'swarm-specialist': ['coordination', 'consensus', 'communication'],
  'integration-architect': ['integration', 'api', 'compatibility'],
  'performance-engineer': ['performance', 'optimization', 'benchmarking'],
  'core-architect': ['architecture', 'design', 'domain'],
  'test-architect': ['testing', 'tdd', 'quality'],
  'project-coordinator': ['project', 'planning', 'scheduling'],
  'coder': ['coding', 'implementation', 'debugging'],
  'reviewer': ['review', 'quality', 'suggestions'],
  'tester': ['testing', 'execution', 'coverage'],
  'planner': ['planning', 'estimation', 'roadmap'],
  'researcher': ['research', 'analysis', 'documentation'],
};

/**
 * Create all mock services as a bundle
 */

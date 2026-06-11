/**
 * Swarm types — core
 *
 * Extracted verbatim during campaign-2 wave W303. Barrel stays.
 */

// ===== CORE IDENTIFIERS =====

export interface SwarmId {
  id: string;
  namespace: string;
  version: string;
  createdAt: Date;
}

export interface AgentId {
  id: string;
  swarmId: string;
  type: AgentType;
  instance: number;
}

export interface TaskId {
  id: string;
  swarmId: string;
  sequence: number;
  priority: TaskPriority;
}

// ===== TOPOLOGY TYPES =====

export type TopologyType = 'mesh' | 'hierarchical' | 'centralized' | 'hybrid';

export interface TopologyConfig {
  type: TopologyType;
  maxAgents: number;
  replicationFactor?: number;
  partitionStrategy?: 'hash' | 'range' | 'round-robin';
  failoverEnabled?: boolean;
  autoRebalance?: boolean;
}

export interface TopologyState {
  type: TopologyType;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  leader?: string;
  partitions: TopologyPartition[];
}

export interface TopologyNode {
  id: string;
  agentId: string;
  role: 'queen' | 'worker' | 'coordinator' | 'peer';
  status: 'active' | 'inactive' | 'syncing' | 'failed';
  connections: string[];
  metadata: Record<string, unknown>;
}

export interface TopologyEdge {
  from: string;
  to: string;
  weight: number;
  bidirectional: boolean;
  latencyMs?: number;
}

export interface TopologyPartition {
  id: string;
  nodes: string[];
  leader: string;
  replicaCount: number;
}

// ===== AGENT TYPES =====

export type AgentType =
  | 'coordinator'
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'architect'
  | 'tester'
  | 'reviewer'
  | 'optimizer'
  | 'documenter'
  | 'monitor'
  | 'specialist'
  | 'queen'
  | 'worker';

export type AgentStatus =
  | 'initializing'
  | 'idle'
  | 'busy'
  | 'paused'
  | 'error'
  | 'offline'
  | 'terminating'
  | 'terminated';

export interface AgentCapabilities {
  codeGeneration: boolean;
  codeReview: boolean;
  testing: boolean;
  documentation: boolean;
  research: boolean;
  analysis: boolean;
  coordination: boolean;
  languages: string[];
  frameworks: string[];
  domains: string[];
  tools: string[];
  maxConcurrentTasks: number;
  maxMemoryUsage: number;
  maxExecutionTime: number;
  reliability: number;
  speed: number;
  quality: number;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageExecutionTime: number;
  successRate: number;
  cpuUsage: number;
  memoryUsage: number;
  messagesProcessed: number;
  lastActivity: Date;
  responseTime: number;
  health: number;
}

export interface AgentState {
  id: AgentId;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  metrics: AgentMetrics;
  currentTask?: TaskId;
  workload: number;
  health: number;
  lastHeartbeat: Date;
  topologyRole?: TopologyNode['role'];
  connections: string[];
}

// ===== TASK TYPES =====

export type TaskType =
  | 'research'
  | 'analysis'
  | 'coding'
  | 'testing'
  | 'review'
  | 'documentation'
  | 'coordination'
  | 'consensus'
  | 'custom';

export type TaskStatus =
  | 'created'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface TaskDefinition {
  id: TaskId;
  type: TaskType;
  name: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: AgentId;
  dependencies: TaskId[];
  input: unknown;
  output?: unknown;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutMs: number;
  retries: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
}

// ===== CONSENSUS TYPES =====

export type ConsensusAlgorithm = 'raft' | 'byzantine' | 'gossip' | 'paxos';

export interface ConsensusConfig {
  algorithm: ConsensusAlgorithm;
  threshold: number;
  timeoutMs: number;
  maxRounds: number;
  requireQuorum: boolean;
}

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  value: unknown;
  term: number;
  timestamp: Date;
  votes: Map<string, ConsensusVote>;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface ConsensusVote {
  voterId: string;
  approve: boolean;
  confidence: number;
  timestamp: Date;
  reason?: string;
}

export interface ConsensusResult {
  proposalId: string;
  approved: boolean;
  approvalRate: number;
  participationRate: number;
  finalValue: unknown;
  rounds: number;
  durationMs: number;
}


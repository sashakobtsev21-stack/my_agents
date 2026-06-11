/**
 * Queen Coordinator — types & default config
 *
 * Task-analysis, delegation, health, consensus, and learning shapes plus
 * the dependency interfaces (ISwarmCoordinator / INeuralLearningSystem /
 * IMemoryService) and DEFAULT_CONFIG. Extracted verbatim from
 * queen-coordinator.ts (lines 40-485) during the P3.50 god-file
 * decomposition (W171). queen-coordinator.ts re-exports every public
 * type so the package index.ts and the test importer resolve
 * byte-identically; DEFAULT_CONFIG stays unexported from the barrel
 * (module-private pre-split).
 */

import type {
  AgentState,
  ConsensusResult,
  CoordinatorMetrics,
  TaskPriority,
  TaskType,
} from './types.js';
import type {
  AgentDomain,
  DomainConfig,
  DomainStatus,
} from './unified-coordinator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Task analysis result from the Queen
 */
export interface TaskAnalysis {
  /** Unique analysis ID */
  analysisId: string;
  /** Original task ID */
  taskId: string;
  /** Task complexity score (0-1) */
  complexity: number;
  /** Estimated duration in milliseconds */
  estimatedDurationMs: number;
  /** Required capabilities for this task */
  requiredCapabilities: string[];
  /** Recommended domain for execution */
  recommendedDomain: AgentDomain;
  /** Sub-tasks if decomposition is needed */
  subtasks: SubTask[];
  /** Patterns found from ReasoningBank */
  matchedPatterns: MatchedPattern[];
  /** Resource requirements */
  resourceRequirements: ResourceRequirements;
  /** Confidence in this analysis (0-1) */
  confidence: number;
  /** Analysis timestamp */
  timestamp: Date;
}

/**
 * Sub-task from task decomposition
 */
export interface SubTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dependencies: string[];
  estimatedDurationMs: number;
  requiredCapabilities: string[];
  recommendedDomain: AgentDomain;
}

/**
 * Pattern matched from ReasoningBank
 */
export interface MatchedPattern {
  patternId: string;
  strategy: string;
  successRate: number;
  relevanceScore: number;
  keyLearnings: string[];
}

/**
 * Resource requirements for a task
 */
export interface ResourceRequirements {
  minAgents: number;
  maxAgents: number;
  memoryMb: number;
  cpuIntensive: boolean;
  ioIntensive: boolean;
  networkRequired: boolean;
}

/**
 * Delegation plan for task execution
 */
export interface DelegationPlan {
  /** Plan ID */
  planId: string;
  /** Task ID being delegated */
  taskId: string;
  /** Analysis that informed this plan */
  analysisId: string;
  /** Primary agent assignment */
  primaryAgent: AgentAssignment;
  /** Backup agents for failover */
  backupAgents: AgentAssignment[];
  /** Parallel sub-task assignments */
  parallelAssignments: ParallelAssignment[];
  /** Execution strategy */
  strategy: ExecutionStrategy;
  /** Estimated completion time */
  estimatedCompletionMs: number;
  /** Plan creation timestamp */
  timestamp: Date;
}

/**
 * Agent assignment in a delegation plan
 */
export interface AgentAssignment {
  agentId: string;
  domain: AgentDomain;
  taskId: string;
  score: number;
  assignedAt: Date;
}

/**
 * Parallel task assignment
 */
export interface ParallelAssignment {
  subtaskId: string;
  agentId: string;
  domain: AgentDomain;
  dependencies: string[];
}

/**
 * Execution strategy for delegation
 */
export type ExecutionStrategy =
  | 'sequential'
  | 'parallel'
  | 'pipeline'
  | 'fan-out-fan-in'
  | 'hybrid';

/**
 * Agent score for task assignment
 */
export interface AgentScore {
  agentId: string;
  domain: AgentDomain;
  totalScore: number;
  capabilityScore: number;
  loadScore: number;
  performanceScore: number;
  healthScore: number;
  availabilityScore: number;
}

/**
 * Health report for the swarm
 */
export interface HealthReport {
  /** Report ID */
  reportId: string;
  /** Report timestamp */
  timestamp: Date;
  /** Overall swarm health (0-1) */
  overallHealth: number;
  /** Status of each domain */
  domainHealth: Map<AgentDomain, DomainHealthStatus>;
  /** Individual agent health */
  agentHealth: AgentHealthEntry[];
  /** Detected bottlenecks */
  bottlenecks: Bottleneck[];
  /** Active alerts */
  alerts: HealthAlert[];
  /** Performance metrics */
  metrics: HealthMetrics;
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Domain health status
 */
export interface DomainHealthStatus {
  domain: AgentDomain;
  health: number;
  activeAgents: number;
  totalAgents: number;
  queuedTasks: number;
  avgResponseTimeMs: number;
  errorRate: number;
}

/**
 * Agent health entry
 */
export interface AgentHealthEntry {
  agentId: string;
  domain: AgentDomain;
  health: number;
  status: string;
  lastHeartbeat: Date;
  currentLoad: number;
  recentErrors: number;
}

/**
 * Bottleneck detection result
 */
export interface Bottleneck {
  type: 'agent' | 'domain' | 'task' | 'resource';
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggestedAction: string;
}

/**
 * Health alert
 */
export interface HealthAlert {
  alertId: string;
  type: 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Health metrics
 */
export interface HealthMetrics {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  errorAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgTaskDurationMs: number;
  taskThroughputPerMin: number;
  consensusSuccessRate: number;
}

/**
 * Decision requiring consensus
 */
export interface Decision {
  decisionId: string;
  type: DecisionType;
  proposal: unknown;
  requiredConsensus: ConsensusType;
  timeout: number;
  initiator: string;
  metadata: Record<string, unknown>;
}

/**
 * Decision types
 */
export type DecisionType =
  | 'task-assignment'
  | 'resource-allocation'
  | 'topology-change'
  | 'agent-termination'
  | 'priority-override'
  | 'emergency-action';

/**
 * Consensus types
 */
export type ConsensusType =
  | 'majority'
  | 'supermajority'
  | 'unanimous'
  | 'weighted'
  | 'queen-override';

/**
 * Task result for learning
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  agentId: string;
  domain: AgentDomain;
  metrics: TaskMetrics;
}

/**
 * Task execution metrics
 */
export interface TaskMetrics {
  startTime: Date;
  endTime: Date;
  retries: number;
  resourceUsage: {
    memoryMb: number;
    cpuPercent: number;
  };
  stepsCompleted: number;
  qualityScore: number;
}

/**
 * Queen Coordinator configuration
 */
export interface QueenCoordinatorConfig {
  /** Enable ReasoningBank integration */
  enableLearning: boolean;
  /** Number of patterns to retrieve for analysis */
  patternRetrievalK: number;
  /** Minimum pattern relevance threshold */
  patternThreshold: number;
  /** Task complexity thresholds */
  complexityThresholds: {
    simple: number;
    moderate: number;
    complex: number;
  };
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Bottleneck detection thresholds */
  bottleneckThresholds: {
    queueDepth: number;
    errorRate: number;
    responseTimeMs: number;
  };
  /** Consensus timeouts */
  consensusTimeouts: {
    majority: number;
    supermajority: number;
    unanimous: number;
  };
  /** Enable automatic failover */
  enableFailover: boolean;
  /** Maximum delegation attempts */
  maxDelegationAttempts: number;
}

/**
 * Default Queen Coordinator configuration
 */
export const DEFAULT_CONFIG: QueenCoordinatorConfig = {
  enableLearning: true,
  patternRetrievalK: 5,
  patternThreshold: 0.6,
  complexityThresholds: {
    simple: 0.3,
    moderate: 0.6,
    complex: 0.85,
  },
  healthCheckIntervalMs: 10000,
  bottleneckThresholds: {
    queueDepth: 10,
    errorRate: 0.1,
    responseTimeMs: 5000,
  },
  consensusTimeouts: {
    majority: 5000,
    supermajority: 10000,
    unanimous: 30000,
  },
  enableFailover: true,
  maxDelegationAttempts: 3,
};

// =============================================================================
// Interfaces for Dependencies
// =============================================================================

/**
 * Interface for swarm coordinator interactions
 */
export interface ISwarmCoordinator {
  getAgentsByDomain(domain: AgentDomain): AgentState[];
  getAllAgents(): AgentState[];
  getAvailableAgents(): AgentState[];
  getMetrics(): CoordinatorMetrics;
  getDomainConfigs(): Map<AgentDomain, DomainConfig>;
  getStatus(): {
    domains: DomainStatus[];
    metrics: CoordinatorMetrics;
  };
  assignTaskToDomain(taskId: string, domain: AgentDomain): Promise<string | undefined>;
  proposeConsensus(value: unknown): Promise<ConsensusResult>;
  broadcastMessage(payload: unknown, priority?: 'urgent' | 'high' | 'normal' | 'low'): Promise<void>;
}

/**
 * Interface for neural learning system interactions
 */
export interface INeuralLearningSystem {
  initialize(): Promise<void>;
  beginTask(context: string, domain?: string): string;
  recordStep(trajectoryId: string, action: string, reward: number, stateEmbedding: Float32Array): void;
  completeTask(trajectoryId: string, quality?: number): Promise<void>;
  findPatterns(queryEmbedding: Float32Array, k?: number): Promise<PatternMatchResult[]>;
  retrieveMemories(queryEmbedding: Float32Array, k?: number): Promise<MemoryRetrievalResult[]>;
  triggerLearning(): Promise<void>;
}

/**
 * Pattern match result from neural system
 */
export interface PatternMatchResult {
  patternId: string;
  strategy: string;
  successRate: number;
  relevanceScore: number;
  keyLearnings?: string[];
}

/**
 * Memory retrieval result from neural system
 */
export interface MemoryRetrievalResult {
  memory: {
    memoryId: string;
    strategy: string;
    quality: number;
    keyLearnings: string[];
  };
  relevanceScore: number;
  combinedScore: number;
}

/**
 * Interface for memory service interactions
 */
export interface IMemoryService {
  semanticSearch(query: string, k?: number): Promise<SearchResultEntry[]>;
  store(entry: MemoryStoreEntry): Promise<void>;
}

/**
 * Search result entry from memory service
 */
export interface SearchResultEntry {
  entry: {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  };
  score: number;
}

/**
 * Memory store entry
 */
export interface MemoryStoreEntry {
  key: string;
  content: string;
  namespace: string;
  tags: string[];
  metadata: Record<string, unknown>;
}


/**
 * Agentic-QE Plugin Interfaces — hive bridge
 *
 * Extracted verbatim from interfaces.ts (lines 782-931) during the P3.59
 * god-file decomposition (W180). interfaces.ts stays the barrel.
 */

// Hive Bridge Interfaces
// =============================================================================

/**
 * Hive Mind role
 */
export type HiveRole = 'queen' | 'worker' | 'specialist' | 'scout';

/**
 * QE swarm task
 */
export interface QESwarmTask {
  /** Task identifier */
  id: string;

  /** Required agent types */
  agents: string[];

  /** Task priority */
  priority: 'low' | 'normal' | 'high' | 'critical';

  /** Task payload */
  payload: Record<string, unknown>;

  /** Task type */
  type: string;

  /** Timeout in ms */
  timeout: number;
}

/**
 * QE swarm result
 */
export interface QESwarmResult {
  /** Task identifier */
  taskId: string;

  /** Results from each agent */
  agentResults: AgentTaskResult[];

  /** Number of completed agents */
  completedAgents: number;

  /** Total agents assigned */
  totalAgents: number;

  /** Overall success */
  success: boolean;

  /** Aggregated output */
  aggregatedOutput?: Record<string, unknown>;
}

/**
 * Individual agent task result
 */
export interface AgentTaskResult {
  /** Agent identifier */
  agentId: string;

  /** Whether agent succeeded */
  success: boolean;

  /** Agent output */
  output: Record<string, unknown>;

  /** Error if failed */
  error?: string;

  /** Duration */
  durationMs: number;
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  /** Whether consensus was reached */
  accepted: boolean;

  /** Reason if rejected */
  reason?: string;

  /** Votes for */
  votesFor: number;

  /** Votes against */
  votesAgainst: number;

  /** Total voters */
  totalVoters: number;
}

/**
 * Hive bridge interface for V3 Hive Mind coordination
 */
export interface IQEHiveBridge {
  /**
   * Register QE Queen with Hive Mind
   */
  registerQueen(): Promise<void>;

  /**
   * Spawn a QE worker and join to hive
   */
  spawnQEWorker(agentType: string, context: string): Promise<string>;

  /**
   * Coordinate a QE swarm task
   */
  coordinateQESwarm(task: QESwarmTask): Promise<QESwarmResult>;

  /**
   * Execute operation with Byzantine fault tolerance
   */
  executeWithBFT<T>(operation: () => Promise<T>, replicaCount?: number): Promise<T>;

  /**
   * Propose task allocation via consensus
   */
  proposeTaskAllocation(task: QESwarmTask, requiredAgents: string[]): Promise<ConsensusResult>;

  /**
   * Broadcast result to hive
   */
  broadcastResult(taskId: string, result: QESwarmResult): Promise<void>;

  /**
   * Store QE state in hive memory
   */
  storeQEState(key: string, value: unknown): Promise<void>;

  /**
   * Retrieve QE state from hive memory
   */
  getQEState<T>(key: string): Promise<T | null>;

  /**
   * Get queen identifier
   */
  getQueenId(): string;

  /**
   * Leave the hive (cleanup)
   */
  leave(): Promise<void>;
}

// =============================================================================

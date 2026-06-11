/**
 * SwarmAdapter — shared types & default config
 *
 * The agentic-flow pattern types (topology, attention, agent output, expert
 * routing, GraphRoPE), the simplified V3 swarm types, and the adapter config
 * + DEFAULT_CONFIG, extracted from swarm-adapter.ts during the P3.38
 * god-file decomposition (W159). Named swarm-adapter-types.ts because
 * src/types.ts already exists in this package; swarm-adapter.ts stays the
 * barrel and re-exports every public type so importers resolve unchanged.
 *
 * @module v3/integration/swarm-adapter-types
 */

// ============================================================================
// agentic-flow Pattern Types (Target Interface)
// ============================================================================

/**
 * agentic-flow SwarmTopology types
 * V3's 'centralized' maps to 'star', 'hybrid' is represented as 'mesh' with hierarchical overlay
 */
export type AgenticFlowTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';

/**
 * agentic-flow Attention mechanism types
 */
export type AgenticFlowAttentionMechanism =
  | 'flash'       // Flash Attention - fastest, 75% memory reduction
  | 'linear'      // Linear attention for long sequences
  | 'hyperbolic'  // Hyperbolic attention for hierarchical data
  | 'moe'         // Mixture of Experts attention
  | 'multi-head'; // Standard multi-head attention

/**
 * agentic-flow AgentOutput interface
 * This is the expected output format from agents in agentic-flow swarms
 */
export interface AgenticFlowAgentOutput {
  /** Agent identifier */
  agentId: string;
  /** Agent type/role */
  agentType: string;
  /** Embedding vector for the agent's output (semantic representation) */
  embedding: number[] | Float32Array;
  /** The actual value/result produced by the agent */
  value: unknown;
  /** Confidence score for this output (0.0 - 1.0) */
  confidence: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * agentic-flow SpecializedAgent interface
 * Represents an expert agent with specific capabilities
 */
export interface AgenticFlowSpecializedAgent {
  /** Agent identifier */
  id: string;
  /** Agent type */
  type: string;
  /** Specialization area */
  specialization: string;
  /** List of capabilities */
  capabilities: string[];
  /** Current load (0.0 - 1.0) */
  load: number;
  /** Embedding for expert matching */
  embedding?: number[];
  /** Performance score */
  performanceScore?: number;
}

/**
 * agentic-flow Expert routing result
 */
export interface AgenticFlowExpertRoute {
  /** Selected expert IDs */
  selectedExperts: AgenticFlowSpecializedAgent[];
  /** Routing scores for each expert */
  scores: Map<string, number>;
  /** Routing mechanism used */
  mechanism: 'moe' | 'similarity' | 'load-balanced';
  /** Routing latency in ms */
  latencyMs: number;
}

/**
 * agentic-flow Attention coordination result
 */
export interface AgenticFlowAttentionResult {
  /** Consensus output */
  consensus: unknown;
  /** Attention weights for each agent */
  attentionWeights: Map<string, number>;
  /** Top contributing agents */
  topAgents: Array<{ id: string; name: string; weight: number }>;
  /** Coordination mechanism used */
  mechanism: AgenticFlowAttentionMechanism;
  /** Execution time in ms */
  executionTimeMs: number;
}

/**
 * GraphRoPE coordination context
 * Topology-aware positional encoding for better coordination
 */
export interface GraphRoPEContext {
  /** Node positions in the topology graph */
  nodePositions: Map<string, number[]>;
  /** Edge weights between nodes */
  edgeWeights: Map<string, Map<string, number>>;
  /** Rotary position encoding dimension */
  ropeDimension: number;
  /** Whether to use relative positions */
  useRelativePositions: boolean;
}

// ============================================================================
// V3 Swarm Types (Source Interface from @claude-flow/swarm)
// ============================================================================

/**
 * V3 Topology types (from @claude-flow/swarm)
 */
export type V3TopologyType = 'mesh' | 'hierarchical' | 'centralized' | 'hybrid';

/**
 * V3 Agent Domain types (from @claude-flow/swarm)
 */
export type V3AgentDomain = 'queen' | 'security' | 'core' | 'integration' | 'support';

/**
 * V3 Agent State interface (simplified from @claude-flow/swarm)
 */
export interface V3AgentState {
  id: { id: string; swarmId: string; type: string; instance: number };
  name: string;
  type: string;
  status: string;
  capabilities: {
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
    reliability: number;
    speed: number;
    quality: number;
  };
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    averageExecutionTime: number;
    health: number;
  };
  workload: number;
  health: number;
  lastHeartbeat: Date;
  topologyRole?: 'queen' | 'worker' | 'coordinator' | 'peer';
}

/**
 * V3 Task Definition interface (simplified from @claude-flow/swarm)
 */
export interface V3TaskDefinition {
  id: { id: string; swarmId: string; sequence: number; priority: string };
  type: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  assignedTo?: { id: string };
  metadata: Record<string, unknown>;
}

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * SwarmAdapter configuration options
 */
export interface SwarmAdapterConfig {
  /** Enable attention-based coordination */
  enableAttentionCoordination: boolean;
  /** Enable MoE expert routing */
  enableMoERouting: boolean;
  /** Enable GraphRoPE topology awareness */
  enableGraphRoPE: boolean;
  /** Default attention mechanism */
  defaultAttentionMechanism: AgenticFlowAttentionMechanism;
  /** Number of experts for MoE routing */
  moeTopK: number;
  /** GraphRoPE dimension */
  ropeDimension: number;
  /** Enable delegation to agentic-flow when available */
  enableDelegation: boolean;
  /** Fallback on delegation failure */
  fallbackOnError: boolean;
  /** Debug mode */
  debug: boolean;
}

/**
 * Default adapter configuration
 */
export const DEFAULT_CONFIG: SwarmAdapterConfig = {
  enableAttentionCoordination: true,
  enableMoERouting: true,
  enableGraphRoPE: true,
  defaultAttentionMechanism: 'flash',
  moeTopK: 3,
  ropeDimension: 64,
  enableDelegation: true,
  fallbackOnError: true,
  debug: false,
};

/**
 * Attention Coordinator — types & default config
 *
 * The attention-type union, agent/task/topology/result shapes, the
 * coordinator config, and DEFAULT_CONFIG. Extracted verbatim from
 * attention-coordinator.ts (lines 22-169) during the P3.56 god-file
 * decomposition (W177). attention-coordinator.ts re-exports the nine
 * public types so the package index.ts block (incl. its
 * 'Task as AttentionTask' rename) resolves byte-identically;
 * DEFAULT_CONFIG stays unexported from the barrel (module-private
 * pre-split).
 */

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Attention mechanism types
 */
export type AttentionType =
  | 'multi-head'   // Standard multi-head attention
  | 'flash'        // approximate sparse attention; speedup unverified — see docs/reviews/intelligence-system-audit-2026-05-29.md
  | 'linear'       // For long sequences
  | 'hyperbolic'   // Hierarchical data
  | 'moe'          // Mixture of Experts
  | 'graph-rope';  // Graph-aware positional embeddings

/**
 * Agent output for coordination
 */
export interface AgentOutput {
  agentId: string;
  content: string | Record<string, unknown>;
  embedding?: Float32Array | number[];
  confidence?: number;
  tokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Task for routing
 */
export interface Task {
  id: string;
  type: string;
  content: string;
  embedding?: Float32Array | number[];
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Specialized agent for MoE routing
 */
export interface SpecializedAgent {
  id: string;
  name: string;
  expertise: string[];
  embedding: Float32Array | number[];
  capacity: number;
  currentLoad: number;
}

/**
 * Swarm topology for GraphRoPE
 */
export interface SwarmTopology {
  type: 'mesh' | 'hierarchical' | 'star' | 'ring';
  nodes: string[];
  edges: Array<{ from: string; to: string; weight?: number }>;
}

/**
 * Graph context for topology-aware coordination
 */
export interface GraphContext {
  adjacencyMatrix?: number[][];
  nodeFeatures?: number[][];
  edgeWeights?: number[];
}

/**
 * Coordination result
 */
export interface CoordinationResult {
  success: boolean;
  mechanism: AttentionType;
  consensusOutput: string | Record<string, unknown>;
  attentionWeights?: number[];
  confidence: number;
  latency: number;
  memoryUsed?: number;
  participatingAgents: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Expert routing result
 */
export interface ExpertRoutingResult {
  success: boolean;
  selectedExperts: Array<{
    agentId: string;
    name: string;
    score: number;
    assignedTokens?: number;
  }>;
  routingLatency: number;
  loadBalanced: boolean;
}

/**
 * Attention coordinator configuration
 */
export interface AttentionCoordinatorConfig {
  defaultMechanism: AttentionType;
  flashAttention: {
    blockSize: number;
    causal: boolean;
  };
  moe: {
    topK: number;
    capacityFactor: number;
    loadBalancingLoss: boolean;
  };
  hyperbolic: {
    curvature: number;
    dimension: number;
  };
  graphRope: {
    maxDistance: number;
    distanceScale: number;
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_CONFIG: AttentionCoordinatorConfig = {
  defaultMechanism: 'flash',
  flashAttention: {
    blockSize: 256,
    causal: false,
  },
  moe: {
    topK: 2,
    capacityFactor: 1.25,
    loadBalancingLoss: true,
  },
  hyperbolic: {
    curvature: -1.0,
    dimension: 64,
  },
  graphRope: {
    maxDistance: 10,
    distanceScale: 1.0,
  },
};


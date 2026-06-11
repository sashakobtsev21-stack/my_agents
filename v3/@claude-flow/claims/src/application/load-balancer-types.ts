/**
 * Load Balancer — types, ports & events
 *
 * The claimant/status aliases, load-info shapes, the ILoadBalancer
 * interface, repository/registry/handoff ports, and event shapes.
 * Extracted verbatim from load-balancer.ts (lines 32-344) during
 * campaign-2 wave 44 (W250). load-balancer.ts stays the barrel.
 */

import type { IssuePriority } from '../domain/types.js';

// =============================================================================
// Load Balancer Specific Types (aligned with ADR-016)
// =============================================================================

/**
 * Claimant type for load balancer operations (ADR-016 format)
 *
 * This is a simplified claimant representation used specifically for
 * load balancing operations. It can represent either a human or an agent.
 */
export type LoadBalancerClaimant =
  | { type: 'human'; userId: string; name: string }
  | { type: 'agent'; agentId: string; agentType: string };

/**
 * Claim status values relevant to load balancing
 */
export type LoadBalancerClaimStatus =
  | 'active'
  | 'paused'
  | 'handoff-pending'
  | 'review-requested'
  | 'blocked'
  | 'stealable'
  | 'completed';

// =============================================================================
// Load Balancer Types
// =============================================================================

/**
 * Summary of a claim for load calculations
 */
export interface ClaimSummary {
  issueId: string;
  status: LoadBalancerClaimStatus;
  priority: IssuePriority;
  progress: number; // 0-100
  claimedAt: Date;
  lastActivityAt: Date;
  estimatedRemainingMinutes?: number;
}

/**
 * Load information for a single agent
 */
export interface AgentLoadInfo {
  agentId: string;
  agentType: string;
  claimCount: number;
  maxClaims: number;
  utilization: number; // 0-1 (claimCount / maxClaims weighted by priority)
  claims: ClaimSummary[];
  avgCompletionTime: number; // Historical average in milliseconds
  currentBlockedCount: number;
}

/**
 * Load overview for an entire swarm
 */
export interface SwarmLoadInfo {
  swarmId: string;
  totalAgents: number;
  activeAgents: number;
  totalClaims: number;
  avgUtilization: number;
  agents: AgentLoadInfo[];
  overloadedAgents: string[];
  underloadedAgents: string[];
  balanceScore: number; // 0-1, higher is more balanced
}

/**
 * Options for rebalancing operation
 */
export interface RebalanceOptions {
  /** Only move claims with progress below this threshold (default: 25%) */
  maxProgressToMove: number;
  /** Prefer same agent type for transfers (default: true) */
  preferSameType: boolean;
  /** Threshold multiplier for overloaded detection (default: 1.5x average) */
  overloadThreshold: number;
  /** Threshold multiplier for underloaded detection (default: 0.5x average) */
  underloadThreshold: number;
  /** Maximum claims to move in single rebalance (default: 10) */
  maxMovesPerRebalance: number;
  /** Use handoff mechanism instead of direct reassignment (default: true) */
  useHandoff: boolean;
}

/**
 * Result of a rebalance operation
 */
export interface RebalanceResult {
  /** Claims that were moved (if useHandoff=false) or handoffs initiated */
  moved: Array<{
    issueId: string;
    from: LoadBalancerClaimant;
    to: LoadBalancerClaimant;
  }>;
  /** Suggested moves that weren't executed (for preview or when useHandoff=true) */
  suggested: Array<{
    issueId: string;
    currentOwner: LoadBalancerClaimant;
    suggestedOwner: LoadBalancerClaimant;
    reason: string;
  }>;
  /** Summary statistics */
  stats: {
    totalMoved: number;
    totalSuggested: number;
    previousBalanceScore: number;
    newBalanceScore: number;
    executionTimeMs: number;
  };
}

/**
 * Report on load imbalance in the swarm
 */
export interface ImbalanceReport {
  swarmId: string;
  timestamp: Date;
  isBalanced: boolean;
  balanceScore: number;
  avgLoad: number;
  overloaded: Array<{
    agentId: string;
    agentType: string;
    utilization: number;
    excessClaims: number;
    movableClaims: ClaimSummary[];
  }>;
  underloaded: Array<{
    agentId: string;
    agentType: string;
    utilization: number;
    availableCapacity: number;
  }>;
  recommendations: string[];
}

// =============================================================================
// Load Balancer Interface
// =============================================================================

/**
 * Interface for the Load Balancer service
 */
export interface ILoadBalancer {
  /**
   * Get load information for a specific agent
   */
  getAgentLoad(agentId: string): Promise<AgentLoadInfo>;

  /**
   * Get load overview for entire swarm
   */
  getSwarmLoad(swarmId: string): Promise<SwarmLoadInfo>;

  /**
   * Rebalance work across swarm
   * @param swarmId - The swarm to rebalance
   * @param options - Rebalancing options
   */
  rebalance(swarmId: string, options?: Partial<RebalanceOptions>): Promise<RebalanceResult>;

  /**
   * Preview rebalance without applying changes
   */
  previewRebalance(swarmId: string, options?: Partial<RebalanceOptions>): Promise<RebalanceResult>;

  /**
   * Detect overloaded/underloaded agents
   */
  detectImbalance(swarmId: string): Promise<ImbalanceReport>;
}

// =============================================================================
// Dependencies Interfaces
// =============================================================================

/**
 * Agent metadata for load balancing operations
 */
export interface AgentMetadata {
  agentId: string;
  agentType: string;
  maxClaims: number;
  swarmId?: string;
}

/**
 * Claim repository interface for load balancing data access
 *
 * This is a specialized interface for load balancing operations.
 * Implementations should adapt from the main IClaimRepository or IIssueClaimRepository.
 */
export interface ILoadBalancerClaimRepository {
  /**
   * Get all claims held by a specific agent
   */
  getClaimsByAgent(agentId: string): Promise<ClaimSummary[]>;

  /**
   * Get all claims in a swarm, grouped by agent ID
   */
  getClaimsBySwarm(swarmId: string): Promise<Map<string, ClaimSummary[]>>;

  /**
   * Get historical completion times for an agent (in milliseconds)
   * Used to calculate average completion time metrics
   */
  getAgentCompletionHistory(agentId: string, limit?: number): Promise<number[]>;
}

/**
 * Agent registry interface for agent metadata
 *
 * Provides access to agent configuration needed for load calculations.
 */
export interface IAgentRegistry {
  /**
   * Get metadata for a specific agent
   */
  getAgent(agentId: string): Promise<AgentMetadata | null>;

  /**
   * Get all agents in a swarm
   */
  getAgentsBySwarm(swarmId: string): Promise<AgentMetadata[]>;
}

/**
 * Handoff service interface for initiating claim transfers
 *
 * Load balancer uses handoffs (not direct reassignment) to maintain
 * proper claim lifecycle and audit trail.
 */
export interface IHandoffService {
  /**
   * Request a handoff from one claimant to another
   * @param issueId - The issue to transfer
   * @param from - Current owner
   * @param to - Proposed new owner
   * @param reason - Reason for the handoff request
   */
  requestHandoff(issueId: string, from: LoadBalancerClaimant, to: LoadBalancerClaimant, reason: string): Promise<void>;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Event types emitted by the Load Balancer
 */
export type LoadBalancerEventType =
  | 'swarm:rebalanced'
  | 'agent:overloaded'
  | 'agent:underloaded';

export interface SwarmRebalancedEvent {
  type: 'swarm:rebalanced';
  swarmId: string;
  timestamp: Date;
  result: RebalanceResult;
}

export interface AgentOverloadedEvent {
  type: 'agent:overloaded';
  agentId: string;
  agentType: string;
  utilization: number;
  claimCount: number;
  maxClaims: number;
  timestamp: Date;
}

export interface AgentUnderloadedEvent {
  type: 'agent:underloaded';
  agentId: string;
  agentType: string;
  utilization: number;
  claimCount: number;
  maxClaims: number;
  timestamp: Date;
}

// =============================================================================
// Load Balancer Implementation
// =============================================================================

export const DEFAULT_REBALANCE_OPTIONS: RebalanceOptions = {
  maxProgressToMove: 25,
  preferSameType: true,
  overloadThreshold: 1.5,
  underloadThreshold: 0.5,
  maxMovesPerRebalance: 10,
  useHandoff: true,
};

/**
 * Load Balancer Service
 *
 * Balances work across the swarm using the following algorithm:
 * 1. Calculate average load across swarm
 * 2. Identify overloaded agents (>1.5x average utilization)
 * 3. Identify underloaded agents (<0.5x average utilization)
 * 4. Move low-progress (<25%) work from overloaded to underloaded
 * 5. Prefer same agent type for transfers
 * 6. Use handoff mechanism (not direct reassignment)
 */

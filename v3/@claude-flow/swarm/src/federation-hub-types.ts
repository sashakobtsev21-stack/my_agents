/**
 * Federation Hub — types & default config
 *
 * Federation/swarm/agent id aliases, registration/spawn/message/
 * consensus/stats/event shapes, and DEFAULT_CONFIG. Extracted verbatim
 * from federation-hub.ts (lines 29-189) during campaign-2 wave 4
 * (W210). federation-hub.ts re-exports all 13 public types (the package
 * index.ts block incl. its 'SwarmId as FederationSwarmId' rename
 * resolves byte-identically); DEFAULT_CONFIG stays unexported from the
 * barrel (module-private pre-split).
 */

// ============================================================================
// Types
// ============================================================================

export type FederationId = string;
export type SwarmId = string;
export type EphemeralAgentId = string;

export interface FederationConfig {
  /** Federation identifier */
  federationId?: FederationId;
  /** Maximum ephemeral agents per swarm */
  maxEphemeralAgents?: number;
  /** Default TTL for ephemeral agents (ms) */
  defaultTTL?: number;
  /** Sync interval for federation state (ms) */
  syncIntervalMs?: number;
  /** Enable auto-cleanup of expired agents */
  autoCleanup?: boolean;
  /** Cleanup check interval (ms) */
  cleanupIntervalMs?: number;
  /** Cross-swarm communication timeout (ms) */
  communicationTimeoutMs?: number;
  /** Enable federation-wide consensus */
  enableConsensus?: boolean;
  /** Consensus quorum percentage */
  consensusQuorum?: number;
}

export interface SwarmRegistration {
  swarmId: SwarmId;
  name: string;
  endpoint?: string;
  capabilities: string[];
  maxAgents: number;
  currentAgents: number;
  status: 'active' | 'inactive' | 'degraded';
  registeredAt: Date;
  lastHeartbeat: Date;
  metadata?: Record<string, unknown>;
}

export interface EphemeralAgent {
  id: EphemeralAgentId;
  swarmId: SwarmId;
  type: string;
  task: string;
  status: 'spawning' | 'active' | 'completing' | 'terminated';
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface SpawnEphemeralOptions {
  /** Target swarm (auto-select if not specified) */
  swarmId?: SwarmId;
  /** Agent type */
  type: string;
  /** Task description */
  task: string;
  /** Time-to-live in ms (default from config) */
  ttl?: number;
  /** Required capabilities */
  capabilities?: string[];
  /** Priority for swarm selection */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  /** Wait for completion */
  waitForCompletion?: boolean;
  /** Completion timeout (ms) */
  completionTimeout?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SpawnResult {
  agentId: EphemeralAgentId;
  swarmId: SwarmId;
  status: 'spawned' | 'queued' | 'failed';
  estimatedTTL: number;
  result?: unknown;
  error?: string;
}

export interface FederationMessage {
  id: string;
  type: 'broadcast' | 'direct' | 'consensus' | 'heartbeat';
  sourceSwarmId: SwarmId;
  targetSwarmId?: SwarmId;
  payload: unknown;
  timestamp: Date;
  ttl?: number;
}

export interface ConsensusProposal {
  id: string;
  proposerId: SwarmId;
  type: string;
  value: unknown;
  votes: Map<SwarmId, boolean>;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  expiresAt: Date;
}

export interface FederationStats {
  federationId: FederationId;
  totalSwarms: number;
  activeSwarms: number;
  totalEphemeralAgents: number;
  activeEphemeralAgents: number;
  completedAgents: number;
  failedAgents: number;
  avgAgentLifespanMs: number;
  messagesExchanged: number;
  consensusProposals: number;
  uptime: number;
}

export interface FederationEvent {
  type: FederationEventType;
  federationId: FederationId;
  swarmId?: SwarmId;
  agentId?: EphemeralAgentId;
  data?: unknown;
  timestamp: Date;
}

export type FederationEventType =
  | 'swarm_joined'
  | 'swarm_left'
  | 'swarm_degraded'
  | 'agent_spawned'
  | 'agent_completed'
  | 'agent_failed'
  | 'agent_expired'
  | 'message_sent'
  | 'message_received'
  | 'consensus_started'
  | 'consensus_completed'
  | 'federation_synced';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: Required<FederationConfig> = {
  federationId: `federation_${Date.now()}`,
  maxEphemeralAgents: 100,
  defaultTTL: 300000, // 5 minutes
  syncIntervalMs: 30000, // 30 seconds
  autoCleanup: true,
  cleanupIntervalMs: 60000, // 1 minute
  communicationTimeoutMs: 5000,
  enableConsensus: true,
  consensusQuorum: 0.66,
};


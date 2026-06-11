/**
 * Swarm Communication — message/state/config types & default config
 *
 * Extracted verbatim from swarm/index.ts (lines 13-127) during
 * campaign-2 wave 29 (W235). index.ts re-exports the 6 public shapes;
 * DEFAULT_CONFIG stays unexported from the barrel.
 */

import type { GuidancePattern } from '../reasoningbank/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Message between agents
 */
export interface SwarmMessage {
  id: string;
  from: string;
  to: string | '*'; // '*' for broadcast
  type: 'context' | 'pattern' | 'handoff' | 'consensus' | 'result' | 'query';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  ttl?: number; // Time-to-live in ms
  priority: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Pattern broadcast entry
 */
export interface PatternBroadcast {
  id: string;
  sourceAgent: string;
  pattern: GuidancePattern;
  broadcastTime: number;
  recipients: string[];
  acknowledgments: string[];
}

/**
 * Consensus request
 */
export interface ConsensusRequest {
  id: string;
  initiator: string;
  question: string;
  options: string[];
  votes: Map<string, string>;
  deadline: number;
  status: 'pending' | 'resolved' | 'expired';
  result?: {
    winner: string;
    confidence: number;
    participation: number;
  };
}

/**
 * Task handoff
 */
export interface TaskHandoff {
  id: string;
  taskId: string;
  description: string;
  fromAgent: string;
  toAgent: string;
  context: {
    filesModified: string[];
    patternsUsed: string[];
    decisions: string[];
    blockers: string[];
    nextSteps: string[];
  };
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  timestamp: number;
  completedAt?: number;
}

/**
 * Agent state in swarm
 */
export interface SwarmAgentState {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'waiting' | 'offline';
  currentTask?: string;
  lastSeen: number;
  capabilities: string[];
  patternsShared: number;
  handoffsReceived: number;
  handoffsCompleted: number;
}

/**
 * Swarm communication configuration
 */
export interface SwarmConfig {
  /** Agent ID for this instance */
  agentId: string;
  /** Agent name/role */
  agentName: string;
  /** Message retention time (ms) */
  messageRetention: number;
  /** Consensus timeout (ms) */
  consensusTimeout: number;
  /** Auto-acknowledge messages */
  autoAcknowledge: boolean;
  /** Broadcast patterns automatically */
  autoBroadcastPatterns: boolean;
  /** Pattern broadcast threshold (quality) */
  patternBroadcastThreshold: number;
}

export const DEFAULT_CONFIG: SwarmConfig = {
  agentId: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  agentName: 'anonymous',
  messageRetention: 3600000, // 1 hour
  consensusTimeout: 30000, // 30 seconds
  autoAcknowledge: true,
  autoBroadcastPatterns: true,
  patternBroadcastThreshold: 0.7,
};


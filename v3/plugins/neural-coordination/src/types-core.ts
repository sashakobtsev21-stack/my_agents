/**
 * Neural Coordination types — core
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import { z } from 'zod';
import type {
  AttentionBridgeInterface,
  NervousSystemBridgeInterface,
  NeuralCoordinationConfig,
} from './types-extended.js';

// ============================================================================
// Common Types
// ============================================================================

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  category?: string;
  tags?: string[];
  version?: string;
  cacheable?: boolean;
  cacheTTL?: number;
  handler: (input: Record<string, unknown>, context?: ToolContext) => Promise<MCPToolResult>;
}

// ============================================================================
// Tool Context
// ============================================================================

export interface ToolContext {
  nervousSystemBridge?: NervousSystemBridgeInterface;
  attentionBridge?: AttentionBridgeInterface;
  config?: NeuralCoordinationConfig;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// Agent Types
// ============================================================================

export const AgentSchema = z.object({
  id: z.string().max(100).describe('Unique agent identifier'),
  preferences: z.record(z.string(), z.number().min(-1).max(1)).optional()
    .describe('Agent preferences as key-value pairs with normalized values'),
  constraints: z.record(z.string(), z.unknown()).optional()
    .describe('Agent-specific constraints'),
  capabilities: z.array(z.string()).optional()
    .describe('Agent capabilities'),
  location: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }).optional().describe('Agent location in 2D/3D space'),
  embedding: z.array(z.number()).optional()
    .describe('Agent state embedding vector'),
});

export type Agent = z.infer<typeof AgentSchema>;

export const AgentStateSchema = z.object({
  agentId: z.string().max(100),
  embedding: z.array(z.number()).describe('Agent state embedding'),
  vote: z.union([z.string(), z.boolean()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// ============================================================================
// Consensus Types
// ============================================================================

export const ConsensusProtocolSchema = z.enum([
  'neural_voting',
  'iterative_refinement',
  'auction',
  'contract_net',
]);

export type ConsensusProtocol = z.infer<typeof ConsensusProtocolSchema>;

export const ProposalSchema = z.object({
  topic: z.string().max(1000).describe('Topic of the proposal'),
  options: z.array(z.object({
    id: z.string().max(100),
    value: z.unknown(),
  })).min(2).max(100).describe('Options to choose from'),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const NeuralConsensusInputSchema = z.object({
  proposal: ProposalSchema.describe('Proposal to reach consensus on'),
  agents: z.array(AgentSchema).min(2).max(1000)
    .describe('Agents participating in consensus'),
  protocol: ConsensusProtocolSchema.default('iterative_refinement')
    .describe('Consensus protocol to use'),
  maxRounds: z.number().int().min(1).max(1000).default(10)
    .describe('Maximum negotiation rounds'),
});

export type NeuralConsensusInput = z.infer<typeof NeuralConsensusInputSchema>;

export interface ConsensusVote {
  agentId: string;
  optionId: string;
  weight: number;
  confidence: number;
}

export interface ConsensusResult {
  consensusReached: boolean;
  selectedOption: string | null;
  votes: ConsensusVote[];
  agreementRatio: number;
  roundsUsed: number;
  divergentAgents: string[];
}

export interface NeuralConsensusOutput {
  consensusReached: boolean;
  selectedOption: string | null;
  agreementRatio: number;
  details: {
    protocol: ConsensusProtocol;
    roundsUsed: number;
    agentCount: number;
    divergentAgents: string[];
    interpretation: string;
  };
}

// ============================================================================
// Topology Types
// ============================================================================

export const TopologyObjectiveSchema = z.enum([
  'minimize_latency',
  'maximize_throughput',
  'minimize_hops',
  'fault_tolerant',
]);

export type TopologyObjective = z.infer<typeof TopologyObjectiveSchema>;

export const PreferredTopologySchema = z.enum([
  'mesh',
  'tree',
  'ring',
  'star',
  'hybrid',
]);

export type PreferredTopology = z.infer<typeof PreferredTopologySchema>;

export const TopologyConstraintsSchema = z.object({
  maxConnections: z.number().int().min(1).max(100).optional(),
  minRedundancy: z.number().min(0).max(1).optional(),
  preferredTopology: PreferredTopologySchema.optional(),
});

export type TopologyConstraints = z.infer<typeof TopologyConstraintsSchema>;

export const TopologyOptimizeInputSchema = z.object({
  agents: z.array(AgentSchema).min(2).max(1000)
    .describe('Agents to optimize topology for'),
  objective: TopologyObjectiveSchema.default('minimize_latency')
    .describe('Optimization objective'),
  constraints: TopologyConstraintsSchema.optional()
    .describe('Topology constraints'),
});

export type TopologyOptimizeInput = z.infer<typeof TopologyOptimizeInputSchema>;

export interface TopologyEdge {
  source: string;
  target: string;
  weight: number;
  latency?: number;
}

export interface TopologyResult {
  edges: TopologyEdge[];
  topology: PreferredTopology;
  metrics: {
    avgLatency: number;
    redundancy: number;
    diameter: number;
    avgDegree: number;
  };
}

export interface TopologyOptimizeOutput {
  topology: PreferredTopology;
  edges: TopologyEdge[];
  metrics: {
    avgLatency: number;
    redundancy: number;
    diameter: number;
    avgDegree: number;
  };
  details: {
    objective: TopologyObjective;
    agentCount: number;
    edgeCount: number;
    interpretation: string;
  };
}

// ============================================================================
// Collective Memory Types
// ============================================================================

export const MemoryActionSchema = z.enum([
  'store',
  'retrieve',
  'consolidate',
  'forget',
  'synchronize',
]);

export type MemoryAction = z.infer<typeof MemoryActionSchema>;

export const MemoryScopeSchema = z.enum(['global', 'team', 'pair']);

export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const ConsolidationStrategySchema = z.enum(['ewc', 'replay', 'distillation']);

export type ConsolidationStrategy = z.infer<typeof ConsolidationStrategySchema>;

export const CollectiveMemoryInputSchema = z.object({
  action: MemoryActionSchema.describe('Memory action to perform'),
  memory: z.object({
    key: z.string().max(500).optional(),
    value: z.unknown().optional(),
    importance: z.number().min(0).max(1).default(0.5),
    expiry: z.string().datetime().optional(),
  }).optional().describe('Memory entry data'),
  scope: MemoryScopeSchema.default('team').describe('Memory scope'),
  consolidationStrategy: ConsolidationStrategySchema.default('ewc')
    .describe('Consolidation strategy for memory management'),
});

export type CollectiveMemoryInput = z.infer<typeof CollectiveMemoryInputSchema>;

export interface MemoryEntry {
  key: string;
  value: unknown;
  importance: number;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  scope: MemoryScope;
}


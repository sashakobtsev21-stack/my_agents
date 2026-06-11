/**
 * Neural Coordination types — extended
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import { z } from 'zod';
import type {
  Agent,
  ConsensusProtocol,
  MCPToolResult,
  MemoryAction,
  MemoryScope,
  TopologyObjective,
} from './types-core.js';

export interface CollectiveMemoryOutput {
  action: MemoryAction;
  success: boolean;
  data?: unknown;
  details: {
    scope: MemoryScope;
    entryCount?: number;
    consolidatedCount?: number;
    interpretation: string;
  };
}

// ============================================================================
// Emergent Protocol Types
// ============================================================================

export const TaskTypeSchema = z.object({
  type: z.string().max(100),
  objectives: z.array(z.string()).max(20),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export type TaskType = z.infer<typeof TaskTypeSchema>;

export const CommunicationBudgetSchema = z.object({
  symbolsPerMessage: z.number().int().min(1).max(100).default(10),
  messagesPerRound: z.number().int().min(1).max(10).default(3),
});

export type CommunicationBudget = z.infer<typeof CommunicationBudgetSchema>;

export const EmergentProtocolInputSchema = z.object({
  task: TaskTypeSchema.describe('Cooperative task requiring communication'),
  communicationBudget: CommunicationBudgetSchema.optional()
    .describe('Budget for communication'),
  trainingEpisodes: z.number().int().min(10).max(10000).default(1000)
    .describe('Number of training episodes'),
  interpretability: z.boolean().default(true)
    .describe('Enable interpretability analysis'),
});

export type EmergentProtocolInput = z.infer<typeof EmergentProtocolInputSchema>;

export interface ProtocolSymbol {
  id: number;
  meaning: string;
  frequency: number;
  contextualMeaning: Map<string, string>;
}

export interface EmergentProtocolResult {
  symbols: ProtocolSymbol[];
  vocabulary: Map<number, string>;
  compositionRules: string[];
  successRate: number;
}

export interface EmergentProtocolOutput {
  protocolLearned: boolean;
  vocabularySize: number;
  successRate: number;
  details: {
    trainingEpisodes: number;
    symbols: Array<{ id: number; meaning: string; frequency: number }>;
    compositionRules: string[];
    interpretation: string;
  };
}

// ============================================================================
// Swarm Behavior Types
// ============================================================================

export const SwarmBehaviorTypeSchema = z.enum([
  'flocking',
  'foraging',
  'formation',
  'task_allocation',
  'exploration',
  'aggregation',
  'dispersion',
]);

export type SwarmBehaviorType = z.infer<typeof SwarmBehaviorTypeSchema>;

export const ObservabilitySchema = z.object({
  recordTrajectories: z.boolean().optional(),
  measureEmergence: z.boolean().optional(),
});

export type Observability = z.infer<typeof ObservabilitySchema>;

export const SwarmBehaviorInputSchema = z.object({
  behavior: SwarmBehaviorTypeSchema.describe('Type of swarm behavior'),
  parameters: z.record(z.string(), z.unknown()).optional()
    .describe('Behavior-specific parameters'),
  adaptiveRules: z.boolean().default(true)
    .describe('Allow neural adaptation of behavior rules'),
  observability: ObservabilitySchema.optional()
    .describe('Observability options'),
});

export type SwarmBehaviorInput = z.infer<typeof SwarmBehaviorInputSchema>;

export interface SwarmMetrics {
  cohesion: number;
  alignment: number;
  separation: number;
  emergenceScore: number;
}

export interface SwarmBehaviorResult {
  behaviorActive: boolean;
  metrics: SwarmMetrics;
  agentPositions: Array<{ id: string; x: number; y: number; z?: number }>;
  trajectories?: Array<Array<{ t: number; x: number; y: number }>>;
}

export interface SwarmBehaviorOutput {
  behaviorActive: boolean;
  metrics: {
    cohesion: number;
    alignment: number;
    separation: number;
    emergenceScore: number;
  };
  details: {
    behavior: SwarmBehaviorType;
    agentCount: number;
    adaptiveRules: boolean;
    interpretation: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface NeuralCoordinationConfig {
  consensus: {
    defaultProtocol: ConsensusProtocol;
    maxRounds: number;
    convergenceThreshold: number;
  };
  topology: {
    defaultObjective: TopologyObjective;
    maxConnections: number;
  };
  memory: {
    defaultScope: MemoryScope;
    consolidationInterval: number;
    maxEntries: number;
  };
  swarm: {
    defaultBehavior: SwarmBehaviorType;
    adaptationRate: number;
  };
}

export const DEFAULT_CONFIG: NeuralCoordinationConfig = {
  consensus: {
    defaultProtocol: 'iterative_refinement',
    maxRounds: 10,
    convergenceThreshold: 0.8,
  },
  topology: {
    defaultObjective: 'minimize_latency',
    maxConnections: 10,
  },
  memory: {
    defaultScope: 'team',
    consolidationInterval: 60000,
    maxEntries: 10000,
  },
  swarm: {
    defaultBehavior: 'flocking',
    adaptationRate: 0.1,
  },
};

// ============================================================================
// Bridge Interfaces
// ============================================================================

export interface NervousSystemBridgeInterface {
  initialized: boolean;
  propagate(signals: Float32Array[]): Promise<Float32Array[]>;
  synchronize(states: Float32Array[]): Promise<Float32Array>;
  coordinate(agents: Agent[]): Promise<{ assignments: Map<string, string> }>;
}

export interface AttentionBridgeInterface {
  initialized: boolean;
  flashAttention(
    query: Float32Array,
    key: Float32Array,
    value: Float32Array
  ): Float32Array;
  multiHeadAttention(
    query: Float32Array,
    key: Float32Array,
    value: Float32Array
  ): Float32Array;
  computeWeights(
    query: Float32Array,
    keys: Float32Array[]
  ): number[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful MCP tool result
 */
export function successResult(data: unknown): MCPToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Create an error MCP tool result
 */
export function errorResult(error: Error | string): MCPToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: true,
        message,
        timestamp: new Date().toISOString(),
      }, null, 2),
    }],
    isError: true,
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) * (a[i] ?? 0);
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

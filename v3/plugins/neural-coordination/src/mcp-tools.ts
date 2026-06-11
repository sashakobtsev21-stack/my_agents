/**
 * Neural Coordination MCP Tools
 *
 * 5 MCP tools for multi-agent neural coordination:
 * - coordination/neural-consensus: Neural negotiation consensus
 * - coordination/topology-optimize: GNN-based topology optimization
 * - coordination/collective-memory: Shared memory management
 * - coordination/emergent-protocol: MARL communication protocols
 * - coordination/swarm-behavior: Emergent swarm behaviors
 */

import type {
  MCPTool,
  MCPToolResult,
  ToolContext,
  NeuralConsensusOutput,
  TopologyOptimizeOutput,
  CollectiveMemoryOutput,
  EmergentProtocolOutput,
  SwarmBehaviorOutput,
  ConsensusVote,
  TopologyEdge,
  Agent,
  MemoryEntry,
  MemoryScope,
} from './types.js';
import {
  NeuralConsensusInputSchema,
  TopologyOptimizeInputSchema,
  CollectiveMemoryInputSchema,
  EmergentProtocolInputSchema,
  SwarmBehaviorInputSchema,
  successResult,
  errorResult,
  cosineSimilarity,
} from './types.js';

// ============================================================================

// The logger/state/schemas/handlers were extracted into
// ./mcp-tools-handlers.ts during the P3.67 god-file decomposition
// (W188). Module-private pre-split; only the five handler functions are
// imported back. The public surface stays here.
import {
  collectiveMemoryHandler,
  emergentProtocolHandler,
  neuralConsensusHandler,
  swarmBehaviorHandler,
  topologyOptimizeHandler,
} from './mcp-tools-handlers.js';

export const neuralConsensusTool: MCPTool = {
  name: 'coordination/neural-consensus',
  description: 'Achieve agent consensus using neural negotiation protocol. Supports neural voting, iterative refinement, auction, and contract net protocols.',
  category: 'coordination',
  version: '0.1.0',
  tags: ['consensus', 'multi-agent', 'negotiation', 'neural'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      proposal: {
        type: 'object',
        description: 'Proposal to reach consensus on',
        properties: {
          topic: { type: 'string' },
          options: { type: 'array', items: { type: 'object' } },
          constraints: { type: 'object' },
        },
      },
      agents: {
        type: 'array',
        description: 'Agents participating in consensus',
        items: { type: 'object' },
      },
      protocol: {
        type: 'string',
        enum: ['neural_voting', 'iterative_refinement', 'auction', 'contract_net'],
        default: 'iterative_refinement',
      },
      maxRounds: { type: 'number', default: 10 },
    },
    required: ['proposal', 'agents'],
  },
  handler: neuralConsensusHandler,
};

// ============================================================================

export const topologyOptimizeTool: MCPTool = {
  name: 'coordination/topology-optimize',
  description: 'Optimize agent communication topology using graph neural networks for efficiency. Supports mesh, tree, ring, star, and hybrid topologies.',
  category: 'coordination',
  version: '0.1.0',
  tags: ['topology', 'gnn', 'optimization', 'graph'],
  cacheable: true,
  cacheTTL: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: 'Agents to optimize topology for',
        items: { type: 'object' },
      },
      objective: {
        type: 'string',
        enum: ['minimize_latency', 'maximize_throughput', 'minimize_hops', 'fault_tolerant'],
        default: 'minimize_latency',
      },
      constraints: {
        type: 'object',
        properties: {
          maxConnections: { type: 'number' },
          minRedundancy: { type: 'number' },
          preferredTopology: { type: 'string' },
        },
      },
    },
    required: ['agents'],
  },
  handler: topologyOptimizeHandler,
};

// ============================================================================

export const collectiveMemoryTool: MCPTool = {
  name: 'coordination/collective-memory',
  description: 'Manage neural collective memory for agent swarm. Supports store, retrieve, consolidate, forget, and synchronize operations with EWC, replay, and distillation strategies.',
  category: 'coordination',
  version: '0.1.0',
  tags: ['memory', 'collective', 'ewc', 'consolidation'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['store', 'retrieve', 'consolidate', 'forget', 'synchronize'],
      },
      memory: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: {},
          importance: { type: 'number' },
          expiry: { type: 'string' },
        },
      },
      scope: {
        type: 'string',
        enum: ['global', 'team', 'pair'],
        default: 'team',
      },
      consolidationStrategy: {
        type: 'string',
        enum: ['ewc', 'replay', 'distillation'],
        default: 'ewc',
      },
    },
    required: ['action'],
  },
  handler: collectiveMemoryHandler,
};

// ============================================================================

export const emergentProtocolTool: MCPTool = {
  name: 'coordination/emergent-protocol',
  description: 'Develop emergent communication protocol through multi-agent reinforcement learning. Enables agents to develop shared vocabulary and composition rules for cooperative tasks.',
  category: 'coordination',
  version: '0.1.0',
  tags: ['emergent', 'protocol', 'marl', 'communication'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: 'Cooperative task requiring communication',
        properties: {
          type: { type: 'string' },
          objectives: { type: 'array' },
          constraints: { type: 'object' },
        },
      },
      communicationBudget: {
        type: 'object',
        properties: {
          symbolsPerMessage: { type: 'number', default: 10 },
          messagesPerRound: { type: 'number', default: 3 },
        },
      },
      trainingEpisodes: { type: 'number', default: 1000 },
      interpretability: { type: 'boolean', default: true },
    },
    required: ['task'],
  },
  handler: emergentProtocolHandler,
};

// ============================================================================

export const swarmBehaviorTool: MCPTool = {
  name: 'coordination/swarm-behavior',
  description: 'Orchestrate emergent swarm behavior using neural coordination. Supports flocking, foraging, formation, task allocation, exploration, aggregation, and dispersion behaviors.',
  category: 'coordination',
  version: '0.1.0',
  tags: ['swarm', 'behavior', 'emergent', 'coordination'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      behavior: {
        type: 'string',
        enum: ['flocking', 'foraging', 'formation', 'task_allocation', 'exploration', 'aggregation', 'dispersion'],
      },
      parameters: {
        type: 'object',
        description: 'Behavior-specific parameters',
      },
      adaptiveRules: {
        type: 'boolean',
        default: true,
      },
      observability: {
        type: 'object',
        properties: {
          recordTrajectories: { type: 'boolean' },
          measureEmergence: { type: 'boolean' },
        },
      },
    },
    required: ['behavior'],
  },
  handler: swarmBehaviorHandler,
};

// ============================================================================

// Export All Tools
// ============================================================================

export const neuralCoordinationTools: MCPTool[] = [
  neuralConsensusTool,
  topologyOptimizeTool,
  collectiveMemoryTool,
  emergentProtocolTool,
  swarmBehaviorTool,
];

export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['coordination/neural-consensus', neuralConsensusTool.handler],
  ['coordination/topology-optimize', topologyOptimizeTool.handler],
  ['coordination/collective-memory', collectiveMemoryTool.handler],
  ['coordination/emergent-protocol', emergentProtocolTool.handler],
  ['coordination/swarm-behavior', swarmBehaviorTool.handler],
]);

export function getTool(name: string): MCPTool | undefined {
  return neuralCoordinationTools.find(t => t.name === name);
}

export function getToolNames(): string[] {
  return neuralCoordinationTools.map(t => t.name);
}

export default neuralCoordinationTools;

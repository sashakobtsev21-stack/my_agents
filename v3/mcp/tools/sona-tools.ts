/**
 * V3 MCP SONA Tools
 *
 * MCP tools for Self-Optimizing Neural Architecture (SONA) integration:
 * - sona/trajectory/begin - Start trajectory tracking
 * - sona/trajectory/step - Record step
 * - sona/trajectory/context - Add context
 * - sona/trajectory/end - Complete and trigger learning
 * - sona/trajectory/list - List trajectories
 * - sona/pattern/find - Find similar patterns via HNSW
 * - sona/lora/apply-micro - Apply micro-LoRA adaptation (~0.05ms)
 * - sona/lora/apply-base - Apply base-layer LoRA
 * - sona/force-learn - Force immediate learning cycle
 * - sona/stats - Get SONA statistics
 * - sona/profile/get - Get profile configuration
 * - sona/profile/list - List all profiles
 * - sona/enabled - Enable/disable SONA
 * - sona/benchmark - Performance benchmark
 *
 * Performance Targets:
 * - Micro-LoRA: <0.05ms latency
 * - Pattern Search: ~1.9x-4.7x (measured) via HNSW
 *
 * Implements ADR-005: MCP-First API Design
 * Implements ADR-001: agentic-flow@alpha compatibility
 */


import { MCPTool } from '../types.js';
// The types/schemas and the SONAState singleton + handlers were
// extracted into ./sona-tools-support.ts and ./sona-tools-handlers.ts
// during the P3.62 god-file decomposition (W183). Both were
// module-private and are NOT re-exported; the public surface (the
// sonaTools array) stays here.
import {
  trajectoryBeginSchema,
  trajectoryStepSchema,
  trajectoryContextSchema,
  trajectoryEndSchema,
  trajectoryListSchema,
  patternFindSchema,
  loraApplySchema,
  profileGetSchema,
  setEnabledSchema,
} from './sona-tools-support.js';
import {
  handleTrajectoryBegin,
  handleTrajectoryStep,
  handleTrajectoryContext,
  handleTrajectoryEnd,
  handleTrajectoryList,
  handlePatternFind,
  handleMicroLoraApply,
  handleBaseLoraApply,
  handleForceLearn,
  handleGetStats,
  handleProfileGet,
  handleProfileList,
  handleSetEnabled,
  handleBenchmark,
} from './sona-tools-handlers.js';

// Tool Definitions
// ============================================================================

export const sonaTools: MCPTool[] = [
  {
    name: 'sona/trajectory/begin',
    description: 'Start a new SONA trajectory for learning',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session identifier' },
        context: { type: 'object', description: 'Initial context' },
      },
    },
    handler: async (input, ctx) => handleTrajectoryBegin(trajectoryBeginSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'trajectory', 'learning'],
    version: '1.0.0',
  },
  {
    name: 'sona/trajectory/step',
    description: 'Record a step in the current trajectory',
    inputSchema: {
      type: 'object',
      properties: {
        trajectoryId: { type: 'string', description: 'Trajectory ID' },
        action: { type: 'string', description: 'Action taken' },
        observation: { type: 'string', description: 'Observation' },
        reward: { type: 'number', description: 'Reward signal' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['trajectoryId', 'action'],
    },
    handler: async (input, ctx) => handleTrajectoryStep(trajectoryStepSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'trajectory', 'step'],
    version: '1.0.0',
  },
  {
    name: 'sona/trajectory/context',
    description: 'Add context to a trajectory',
    inputSchema: {
      type: 'object',
      properties: {
        trajectoryId: { type: 'string', description: 'Trajectory ID' },
        context: { type: 'object', description: 'Context to add' },
      },
      required: ['trajectoryId', 'context'],
    },
    handler: async (input, ctx) => handleTrajectoryContext(trajectoryContextSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'trajectory', 'context'],
    version: '1.0.0',
  },
  {
    name: 'sona/trajectory/end',
    description: 'End a trajectory and trigger learning',
    inputSchema: {
      type: 'object',
      properties: {
        trajectoryId: { type: 'string', description: 'Trajectory ID' },
        verdict: { type: 'string', enum: ['success', 'failure', 'partial'], description: 'Final verdict' },
        triggerLearning: { type: 'boolean', description: 'Trigger learning', default: true },
      },
      required: ['trajectoryId', 'verdict'],
    },
    handler: async (input, ctx) => handleTrajectoryEnd(trajectoryEndSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'trajectory', 'learning'],
    version: '1.0.0',
  },
  {
    name: 'sona/trajectory/list',
    description: 'List trajectories with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Filter by session' },
        verdict: { type: 'string', enum: ['success', 'failure', 'partial'] },
        limit: { type: 'number', default: 20 },
      },
    },
    handler: async (input, ctx) => handleTrajectoryList(trajectoryListSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'trajectory', 'list'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 2000,
  },
  {
    name: 'sona/pattern/find',
    description: 'Find similar patterns using HNSW (~1.9x-4.7x (measured))',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query to find patterns' },
        category: { type: 'string', description: 'Filter by category' },
        topK: { type: 'number', default: 5 },
        threshold: { type: 'number', default: 0.7 },
      },
      required: ['query'],
    },
    handler: async (input, ctx) => handlePatternFind(patternFindSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'pattern', 'search', 'hnsw'],
    version: '1.0.0',
  },
  {
    name: 'sona/lora/apply-micro',
    description: 'Apply micro-LoRA adaptation (<0.05ms latency)',
    inputSchema: {
      type: 'object',
      properties: {
        adapterId: { type: 'string', description: 'LoRA adapter ID' },
        input: { type: 'string', description: 'Input to adapt' },
        strength: { type: 'number', default: 0.5 },
      },
      required: ['input'],
    },
    handler: async (input, ctx) => handleMicroLoraApply(loraApplySchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'lora', 'micro', 'adaptation'],
    version: '1.0.0',
  },
  {
    name: 'sona/lora/apply-base',
    description: 'Apply base-layer LoRA adaptation',
    inputSchema: {
      type: 'object',
      properties: {
        adapterId: { type: 'string', description: 'LoRA adapter ID' },
        input: { type: 'string', description: 'Input to adapt' },
        strength: { type: 'number', default: 0.5 },
      },
      required: ['input'],
    },
    handler: async (input, ctx) => handleBaseLoraApply(loraApplySchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'lora', 'base', 'adaptation'],
    version: '1.0.0',
  },
  {
    name: 'sona/force-learn',
    description: 'Force an immediate learning cycle',
    inputSchema: { type: 'object', properties: {} },
    handler: async (input, ctx) => handleForceLearn({}, ctx),
    category: 'sona',
    tags: ['sona', 'learning', 'force'],
    version: '1.0.0',
  },
  {
    name: 'sona/stats',
    description: 'Get SONA statistics and performance metrics',
    inputSchema: { type: 'object', properties: {} },
    handler: async (input, ctx) => handleGetStats({}, ctx),
    category: 'sona',
    tags: ['sona', 'stats', 'metrics'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 5000,
  },
  {
    name: 'sona/profile/get',
    description: 'Get a SONA profile configuration',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Profile ID (active if not specified)' },
      },
    },
    handler: async (input, ctx) => handleProfileGet(profileGetSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'profile', 'config'],
    version: '1.0.0',
  },
  {
    name: 'sona/profile/list',
    description: 'List all available SONA profiles',
    inputSchema: { type: 'object', properties: {} },
    handler: async (input, ctx) => handleProfileList({}, ctx),
    category: 'sona',
    tags: ['sona', 'profile', 'list'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 60000,
  },
  {
    name: 'sona/enabled',
    description: 'Enable or disable SONA',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable SONA' },
      },
      required: ['enabled'],
    },
    handler: async (input, ctx) => handleSetEnabled(setEnabledSchema.parse(input), ctx),
    category: 'sona',
    tags: ['sona', 'control', 'enabled'],
    version: '1.0.0',
  },
  {
    name: 'sona/benchmark',
    description: 'Run SONA performance benchmarks',
    inputSchema: { type: 'object', properties: {} },
    handler: async (input, ctx) => handleBenchmark({}, ctx),
    category: 'sona',
    tags: ['sona', 'benchmark', 'performance'],
    version: '1.0.0',
  },
];

export default sonaTools;

/**
 * quantum-optimizer types — extended
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';
import type {
  AmplificationConfig,
  AnnealingConfig,
  AnnealingResult,
  GroverResult,
  ProblemGraph,
  QAOACircuit,
  QAOAResult,
  QUBOProblem,
  SearchSpace,
} from './types-core.js';

export interface ScheduledTask {
  /** Task ID */
  readonly taskId: string;
  /** Start time */
  readonly start: number;
  /** End time */
  readonly end: number;
  /** Assigned resources */
  readonly resources: ReadonlyArray<string>;
}

/**
 * Schedule optimization result
 */
export interface ScheduleResult {
  /** Scheduled tasks */
  readonly schedule: ReadonlyArray<ScheduledTask>;
  /** Total makespan */
  readonly makespan: number;
  /** Total cost */
  readonly cost: number;
  /** Resource utilization per resource */
  readonly utilization: Record<string, number>;
  /** Critical path */
  readonly criticalPath: ReadonlyArray<string>;
  /** Optimization score */
  readonly score: number;
}

// ============================================================================
// Zod Schemas for MCP Tool Validation
// ============================================================================

export const TemperatureScheduleSchema = z.object({
  initial: z.number().min(0.001).max(1000).default(100),
  final: z.number().min(0.0001).max(100).default(0.01),
  type: z.enum(['linear', 'exponential', 'logarithmic', 'adaptive']).default('exponential'),
});

export const AnnealingSolveInputSchema = z.object({
  problem: z.object({
    type: z.enum(['qubo', 'ising', 'sat', 'max_cut', 'tsp', 'dependency']),
    variables: z.number().int().min(1).max(10000),
    constraints: z.array(z.unknown()).max(100000).optional(),
    objective: z.record(z.string(), z.number().finite()).optional(),
    linear: z.array(z.number()).optional(),
    quadratic: z.array(z.number()).optional(),
  }),
  parameters: z.object({
    numReads: z.number().int().min(1).max(10000).default(1000),
    annealingTime: z.number().min(1).max(1000).default(20),
    chainStrength: z.number().min(0.1).max(100).default(1.0),
    temperature: TemperatureScheduleSchema.optional(),
  }).optional(),
  embedding: z.enum(['auto', 'minor', 'pegasus', 'chimera']).default('auto'),
});

export type AnnealingSolveInput = z.infer<typeof AnnealingSolveInputSchema>;

export const QAOAOptimizeInputSchema = z.object({
  problem: z.object({
    type: z.enum(['max_cut', 'portfolio', 'scheduling', 'routing']),
    graph: z.object({
      nodes: z.number().int().min(1).max(1000),
      edges: z.array(z.tuple([z.number().int(), z.number().int()])).max(100000),
      weights: z.array(z.number()).optional(),
    }),
  }),
  circuit: z.object({
    depth: z.number().int().min(1).max(20).default(3),
    optimizer: z.enum(['cobyla', 'bfgs', 'adam', 'nelder-mead']).default('cobyla'),
    initialParams: z.enum(['random', 'heuristic', 'transfer', 'fourier']).default('heuristic'),
  }).optional(),
  shots: z.number().int().min(100).max(100000).default(1024),
});

export type QAOAOptimizeInput = z.infer<typeof QAOAOptimizeInputSchema>;

export const GroverSearchInputSchema = z.object({
  searchSpace: z.object({
    size: z.number().int().min(1).max(1_000_000_000),
    oracle: z.string().max(10000),
    structure: z.enum(['unstructured', 'database', 'tree', 'graph']),
  }),
  targets: z.number().int().min(1).max(1000).default(1),
  iterations: z.enum(['optimal', 'fixed', 'adaptive']).default('optimal'),
  amplification: z.object({
    method: z.enum(['standard', 'fixed_point', 'robust']).default('standard'),
    boostFactor: z.number().min(1).max(10).optional(),
  }).optional(),
});

export type GroverSearchInput = z.infer<typeof GroverSearchInputSchema>;

export const DependencyResolveInputSchema = z.object({
  packages: z.array(z.object({
    name: z.string().max(200),
    version: z.string().max(50),
    dependencies: z.record(z.string()).default({}),
    conflicts: z.array(z.string()).default([]),
    size: z.number().optional(),
    vulnerabilities: z.array(z.string()).optional(),
  })).min(1).max(10000),
  constraints: z.object({
    minimize: z.enum(['versions', 'size', 'vulnerabilities', 'depth']).default('versions'),
    lockfile: z.record(z.string()).optional(),
    includePeer: z.boolean().default(true),
    timeout: z.number().int().min(1000).max(300000).default(30000),
  }).optional(),
  solver: z.enum(['quantum_annealing', 'qaoa', 'hybrid']).default('hybrid'),
});

export type DependencyResolveInput = z.infer<typeof DependencyResolveInputSchema>;

export const ScheduleOptimizeInputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().max(100),
    duration: z.number().min(0).max(1000000),
    dependencies: z.array(z.string()).default([]),
    resources: z.array(z.string()).default([]),
    deadline: z.number().optional(),
    priority: z.number().optional(),
  })).min(1).max(10000),
  resources: z.array(z.object({
    id: z.string().max(100),
    capacity: z.number().int().min(1).max(1000),
    cost: z.number().min(0).max(1000000),
    availability: z.array(z.object({
      start: z.number().min(0),
      end: z.number().min(0),
    })).optional(),
  })).min(1).max(1000),
  objective: z.enum(['makespan', 'cost', 'utilization', 'weighted']).default('makespan'),
  weights: z.object({
    makespan: z.number().default(1),
    cost: z.number().default(1),
    utilization: z.number().default(1),
  }).optional(),
});

export type ScheduleOptimizeInput = z.infer<typeof ScheduleOptimizeInputSchema>;

// ============================================================================
// MCP Tool Types
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
// Tool Context Types
// ============================================================================

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface QuantumOptimizerConfig {
  annealing: {
    defaultReads: number;
    maxVariables: number;
    timeout: number;
  };
  qaoa: {
    maxDepth: number;
    maxNodes: number;
    defaultShots: number;
  };
  grover: {
    maxSearchSpace: number;
    allowedOracleOps: string[];
  };
  resourceLimits: {
    maxMemoryBytes: number;
    maxCpuTimeMs: number;
    maxIterations: number;
  };
}

export interface QuantumOptimizerBridge {
  initialized: boolean;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  solveQubo(problem: QUBOProblem, config: AnnealingConfig): Promise<AnnealingResult>;
  runQaoa(graph: ProblemGraph, circuit: QAOACircuit): Promise<QAOAResult>;
  groverSearch(space: SearchSpace, config: AmplificationConfig): Promise<GroverResult>;
}

export interface ToolContext {
  bridge?: QuantumOptimizerBridge;
  config?: QuantumOptimizerConfig;
  logger?: Logger;
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

// ============================================================================
// Security Constants
// ============================================================================

export const RESOURCE_LIMITS = {
  MAX_VARIABLES: 10000,
  MAX_ITERATIONS: 1000000,
  MAX_MEMORY_BYTES: 4294967296, // 4GB
  MAX_CPU_TIME_MS: 600000, // 10 minutes
  MAX_CIRCUIT_DEPTH: 20,
  MAX_QUBITS: 50,
  PROGRESS_CHECK_INTERVAL_MS: 10000,
  MIN_PROGRESS_THRESHOLD: 0.001,
} as const;

export const ALLOWED_ORACLE_OPS = [
  '==', '!=', '<', '>', '<=', '>=',
  '&&', '||', '!',
  '+', '-', '*', '/', '%',
  '.', // property access
] as const;

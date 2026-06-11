/**
 * perf-optimizer types — extended
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';
import type {
  Bottleneck,
  HeapObject,
  IndexSuggestion,
  MCPToolResult,
  MemoryLeak,
  QueryPattern,
  TraceSpan,
} from './types-core.js';

export interface BundleModule {
  name: string;
  size: number;
  chunks: string[];
  issuers: string[];
  reasons: string[];
  usedExports?: string[];
  providedExports?: string[];
}

/**
 * Bundle asset
 */
export interface BundleAsset {
  name: string;
  size: number;
  chunks: string[];
}

/**
 * Bundle optimization suggestion
 */
export interface BundleOptimization {
  id: string;
  type: BundleOptimizationType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  target: string;
  currentSize: number;
  potentialSavings: number;
  description: string;
  suggestedFix: string;
}

export type BundleOptimizationType =
  | 'tree_shaking'
  | 'code_splitting'
  | 'duplicate_deps'
  | 'large_modules'
  | 'dynamic_import'
  | 'polyfill_reduction';

// ============================================================================
// Configuration Optimization Types
// ============================================================================

/**
 * Workload profile
 */
export interface WorkloadProfile {
  type: 'web' | 'api' | 'batch' | 'stream' | 'hybrid';
  metrics: {
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
    concurrency: number;
  };
  constraints: {
    maxLatency?: number;
    maxMemory?: number;
    maxCpu?: number;
    maxCost?: number;
  };
}

/**
 * Configuration parameter
 */
export interface ConfigParameter {
  name: string;
  type: 'number' | 'boolean' | 'string' | 'enum';
  current: unknown;
  suggested: unknown;
  range?: [number, number];
  options?: string[];
  impact: number;
  confidence: number;
}

/**
 * Configuration optimization result
 */
export interface ConfigOptimization {
  parameters: ConfigParameter[];
  objective: 'latency' | 'throughput' | 'cost' | 'balanced';
  predictedImprovement: {
    latency: number;
    throughput: number;
    cost: number;
  };
  confidence: number;
  warnings: string[];
}

// ============================================================================
// Input Schemas
// ============================================================================

export const BottleneckDetectInputSchema = z.object({
  traceData: z.object({
    format: z.enum(['otlp', 'chrome_devtools', 'jaeger', 'zipkin']),
    spans: z.array(z.unknown()).max(1_000_000),
    metrics: z.record(z.string(), z.unknown()).optional(),
  }),
  analysisScope: z.array(z.enum(['cpu', 'memory', 'io', 'network', 'database', 'render', 'all'])).default(['all']),
  threshold: z.object({
    latencyP95: z.number().min(0).max(86400000).optional(),
    throughput: z.number().min(0).optional(),
    errorRate: z.number().min(0).max(1).optional(),
  }).optional(),
});

export type BottleneckDetectInput = z.infer<typeof BottleneckDetectInputSchema>;

export const MemoryAnalyzeInputSchema = z.object({
  heapSnapshot: z.string().max(500).optional(),
  timeline: z.array(z.unknown()).max(100000).optional(),
  analysis: z.array(z.enum([
    'leak_detection',
    'retention_analysis',
    'allocation_hotspots',
    'gc_pressure',
  ])).optional(),
  compareBaseline: z.string().max(500).optional(),
});

export type MemoryAnalyzeInput = z.infer<typeof MemoryAnalyzeInputSchema>;

export const QueryOptimizeInputSchema = z.object({
  queries: z.array(z.object({
    sql: z.string().max(10000),
    duration: z.number().min(0).max(86400000),
    stackTrace: z.string().max(50000).optional(),
    resultSize: z.number().int().min(0).optional(),
  })).min(1).max(10000),
  patterns: z.array(z.enum(['n_plus_1', 'missing_index', 'full_scan', 'large_result', 'slow_join'])).optional(),
  suggestIndexes: z.boolean().default(true),
});

export type QueryOptimizeInput = z.infer<typeof QueryOptimizeInputSchema>;

export const BundleOptimizeInputSchema = z.object({
  bundleStats: z.string().max(500),
  analysis: z.array(z.enum([
    'tree_shaking',
    'code_splitting',
    'duplicate_deps',
    'large_modules',
    'dynamic_import',
  ])).optional(),
  targets: z.object({
    maxSize: z.number().min(0).optional(),
    maxChunks: z.number().int().min(1).optional(),
  }).optional(),
});

export type BundleOptimizeInput = z.infer<typeof BundleOptimizeInputSchema>;

export const ConfigOptimizeInputSchema = z.object({
  workloadProfile: z.object({
    type: z.enum(['web', 'api', 'batch', 'stream', 'hybrid']),
    metrics: z.object({
      requestsPerSecond: z.number().min(0).optional(),
      avgResponseTime: z.number().min(0).optional(),
      errorRate: z.number().min(0).max(1).optional(),
      concurrency: z.number().int().min(1).optional(),
    }).optional(),
    constraints: z.object({
      maxLatency: z.number().min(0).optional(),
      maxMemory: z.number().min(0).optional(),
      maxCpu: z.number().min(0).max(100).optional(),
      maxCost: z.number().min(0).optional(),
    }).optional(),
  }),
  configSpace: z.record(z.string(), z.object({
    type: z.string(),
    range: z.array(z.unknown()).optional(),
    current: z.unknown(),
  })),
  objective: z.enum(['latency', 'throughput', 'cost', 'balanced']),
});

export type ConfigOptimizeInput = z.infer<typeof ConfigOptimizeInputSchema>;

// ============================================================================
// Output Types
// ============================================================================

export interface BottleneckDetectOutput {
  bottlenecks: Bottleneck[];
  criticalPath: string[];
  overallScore: number;
  details: {
    spanCount: number;
    analysisScope: string[];
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    interpretation: string;
  };
}

export interface MemoryAnalyzeOutput {
  leaks: MemoryLeak[];
  hotspots: HeapObject[];
  gcPressure: number;
  details: {
    heapUsed: number;
    heapTotal: number;
    objectCount: number;
    analysisType: string[];
    interpretation: string;
  };
}

export interface QueryOptimizeOutput {
  patterns: QueryPattern[];
  optimizations: IndexSuggestion[];
  totalQueries: number;
  details: {
    slowQueries: number;
    nPlusOneCount: number;
    missingIndexCount: number;
    estimatedImprovement: number;
    interpretation: string;
  };
}

export interface BundleOptimizeOutput {
  optimizations: BundleOptimization[];
  totalSize: number;
  potentialSavings: number;
  details: {
    chunkCount: number;
    moduleCount: number;
    duplicateDeps: string[];
    largestModules: string[];
    interpretation: string;
  };
}

export interface ConfigOptimizeOutput {
  recommendations: ConfigParameter[];
  objective: string;
  predictedImprovement: {
    latency: number;
    throughput: number;
    cost: number;
  };
  details: {
    parametersAnalyzed: number;
    optimizationsFound: number;
    confidence: number;
    warnings: string[];
    interpretation: string;
  };
}

// ============================================================================
// Bridge Interfaces
// ============================================================================

export interface SparseBridgeInterface {
  readonly name: string;
  readonly version: string;
  init(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): boolean;

  // Sparse inference for trace analysis
  encodeTraces(spans: TraceSpan[]): Promise<Float32Array>;
  detectAnomalies(encoded: Float32Array, threshold: number): Promise<number[]>;
  analyzeCriticalPath(encoded: Float32Array): Promise<string[]>;
}

export interface FpgaBridgeInterface {
  readonly name: string;
  readonly version: string;
  init(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): boolean;

  // FPGA transformer for optimization
  optimizeConfig(workload: WorkloadProfile, configSpace: Record<string, unknown>): Promise<ConfigOptimization>;
  predictPerformance(config: Record<string, unknown>, workload: WorkloadProfile): Promise<number>;
  searchOptimalConfig(objective: string, constraints: Record<string, number>): Promise<Record<string, unknown>>;
}

// ============================================================================
// Error Codes
// ============================================================================

export const PerfOptimizerErrorCodes = {
  BRIDGE_NOT_INITIALIZED: 'PO_BRIDGE_NOT_INITIALIZED',
  INVALID_INPUT: 'PO_INVALID_INPUT',
  TRACE_PARSE_ERROR: 'PO_TRACE_PARSE_ERROR',
  ANALYSIS_FAILED: 'PO_ANALYSIS_FAILED',
  TIMEOUT: 'PO_TIMEOUT',
  RATE_LIMITED: 'PO_RATE_LIMITED',
} as const;

export type PerfOptimizerErrorCode =
  (typeof PerfOptimizerErrorCodes)[keyof typeof PerfOptimizerErrorCodes];

// ============================================================================
// Helper Functions
// ============================================================================

export function successResult(data: unknown): MCPToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

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

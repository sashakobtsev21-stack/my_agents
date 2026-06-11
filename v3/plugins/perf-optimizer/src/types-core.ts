/**
 * perf-optimizer types — core
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import type {
  BundleAsset,
  BundleModule,
  FpgaBridgeInterface,
  SparseBridgeInterface,
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
  sparseBridge?: SparseBridgeInterface;
  fpgaBridge?: FpgaBridgeInterface;
  config?: PerfOptimizerConfig;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// Configuration
// ============================================================================

export interface PerfOptimizerConfig {
  bottleneck: {
    latencyThresholdMs: number;
    errorRateThreshold: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  memory: {
    leakThresholdMb: number;
    gcPressureThreshold: number;
    maxHeapSize: number;
  };
  query: {
    slowQueryThresholdMs: number;
    maxResultSize: number;
    indexSuggestionEnabled: boolean;
  };
  bundle: {
    maxSizeKb: number;
    treeshakingEnabled: boolean;
    codeSplittingEnabled: boolean;
  };
}

export const DEFAULT_CONFIG: PerfOptimizerConfig = {
  bottleneck: {
    latencyThresholdMs: 100,
    errorRateThreshold: 0.01,
    cpuThreshold: 80,
    memoryThreshold: 85,
  },
  memory: {
    leakThresholdMb: 50,
    gcPressureThreshold: 0.3,
    maxHeapSize: 2048,
  },
  query: {
    slowQueryThresholdMs: 100,
    maxResultSize: 10000,
    indexSuggestionEnabled: true,
  },
  bundle: {
    maxSizeKb: 500,
    treeshakingEnabled: true,
    codeSplittingEnabled: true,
  },
};

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Span from distributed trace
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  duration: number;
  status: 'ok' | 'error' | 'timeout';
  attributes: Record<string, unknown>;
  events?: SpanEvent[];
}

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

/**
 * Trace data container
 */
export interface TraceData {
  format: 'otlp' | 'chrome_devtools' | 'jaeger' | 'zipkin';
  spans: TraceSpan[];
  metrics?: Record<string, number>;
}

/**
 * Bottleneck detection result
 */
export interface Bottleneck {
  id: string;
  type: BottleneckType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  impact: {
    latencyMs: number;
    throughput: number;
    errorRate: number;
  };
  suggestedFix: string;
  relatedSpans: string[];
}

export type BottleneckType =
  | 'cpu'
  | 'memory'
  | 'io'
  | 'network'
  | 'database'
  | 'render'
  | 'lock_contention'
  | 'gc_pressure';

// ============================================================================
// Memory Types
// ============================================================================

/**
 * Heap snapshot summary
 */
export interface HeapSnapshot {
  totalSize: number;
  usedSize: number;
  objects: HeapObject[];
  retainers: RetainerPath[];
}

/**
 * Heap object
 */
export interface HeapObject {
  name: string;
  type: string;
  size: number;
  count: number;
  shallowSize: number;
  retainedSize: number;
}

/**
 * Retainer path for memory leak detection
 */
export interface RetainerPath {
  object: string;
  path: string[];
  retainedSize: number;
  distance: number;
}

/**
 * Memory timeline point
 */
export interface MemoryTimelinePoint {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeak {
  id: string;
  type: MemoryLeakType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  object: string;
  retainedSize: number;
  growthRate: number;
  retainerPath: string[];
  suggestedFix: string;
}

export type MemoryLeakType =
  | 'detached_dom'
  | 'closure_leak'
  | 'event_listener'
  | 'timer_leak'
  | 'global_variable'
  | 'cache_unbounded';

// ============================================================================
// Query Types
// ============================================================================

/**
 * Database query info
 */
export interface QueryInfo {
  sql: string;
  duration: number;
  stackTrace?: string;
  resultSize?: number;
  explain?: QueryExplainPlan;
}

/**
 * Query explain plan
 */
export interface QueryExplainPlan {
  type: string;
  table: string;
  rows: number;
  filtered: number;
  extra?: string;
  key?: string;
  possibleKeys?: string[];
}

/**
 * Query pattern detection
 */
export interface QueryPattern {
  id: string;
  type: QueryPatternType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  queries: string[];
  count: number;
  totalDuration: number;
  suggestedFix: string;
  suggestedIndex?: IndexSuggestion;
}

export type QueryPatternType =
  | 'n_plus_1'
  | 'missing_index'
  | 'full_scan'
  | 'large_result'
  | 'slow_join'
  | 'duplicate_query';

/**
 * Index suggestion
 */
export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  estimatedImprovement: number;
  createStatement: string;
}

// ============================================================================
// Bundle Types
// ============================================================================

/**
 * Bundle stats
 */
export interface BundleStats {
  totalSize: number;
  chunks: BundleChunk[];
  modules: BundleModule[];
  assets: BundleAsset[];
}

/**
 * Bundle chunk
 */
export interface BundleChunk {
  name: string;
  size: number;
  modules: string[];
  initial: boolean;
  entry: boolean;
}

/**
 * Bundle module
 */

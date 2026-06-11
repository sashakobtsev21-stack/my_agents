/**
 * RuVector Self-Learning — shared types
 *
 * Query analysis, workload analysis, pattern/anomaly, and learning
 * config/stats/EWC interfaces.
 * Extracted verbatim from self-learning.ts (lines 20-579) during the
 * P3.42 god-file decomposition (W163). self-learning.ts stays the barrel.
 */

import type { DistanceMetric, VectorIndexType } from './types.js';

// ============================================================================
// Query Analysis Types
// ============================================================================

/**
 * Analysis result for a SQL query.
 */
export interface QueryAnalysis {
  /** Original SQL query */
  readonly sql: string;
  /** Query type (SELECT, INSERT, UPDATE, DELETE) */
  readonly queryType: QueryType;
  /** Tables referenced in the query */
  readonly tables: string[];
  /** Columns referenced in the query */
  readonly columns: string[];
  /** Vector operations detected */
  readonly vectorOperations: VectorOperation[];
  /** Estimated complexity score (0-1) */
  readonly complexity: number;
  /** Index usage hints */
  readonly indexHints: IndexHint[];
  /** Potential bottlenecks */
  readonly bottlenecks: Bottleneck[];
  /** Parse time in milliseconds */
  readonly parseTimeMs: number;
  /** Query fingerprint for deduplication */
  readonly fingerprint: string;
}

/**
 * Query types supported.
 */
export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN';

/**
 * Vector operation in a query.
 */
export interface VectorOperation {
  /** Operation type */
  readonly type: 'search' | 'insert' | 'update' | 'aggregate' | 'distance';
  /** Table name */
  readonly table: string;
  /** Column name */
  readonly column: string;
  /** Distance metric used */
  readonly metric?: DistanceMetric;
  /** K value for KNN */
  readonly k?: number;
  /** Estimated cost */
  readonly estimatedCost: number;
}

/**
 * Index usage hint.
 */
export interface IndexHint {
  /** Recommended index type */
  readonly indexType: VectorIndexType;
  /** Table name */
  readonly table: string;
  /** Column name */
  readonly column: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Expected speedup factor */
  readonly expectedSpeedup: number;
}

/**
 * Query bottleneck.
 */
export interface Bottleneck {
  /** Bottleneck type */
  readonly type: 'full_scan' | 'missing_index' | 'cartesian_product' | 'large_sort' | 'expensive_function';
  /** Description */
  readonly description: string;
  /** Severity (1-10) */
  readonly severity: number;
  /** Suggested fix */
  readonly suggestion: string;
}

/**
 * Query optimization suggestion.
 */
export interface Optimization {
  /** Optimization type */
  readonly type: OptimizationType;
  /** Description of the optimization */
  readonly description: string;
  /** Original query fragment */
  readonly original: string;
  /** Optimized query fragment */
  readonly optimized: string;
  /** Expected improvement percentage */
  readonly expectedImprovement: number;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Risk level */
  readonly risk: 'low' | 'medium' | 'high';
  /** Apply automatically */
  readonly autoApply: boolean;
}

/**
 * Types of query optimizations.
 */
export type OptimizationType =
  | 'index_usage'
  | 'query_rewrite'
  | 'parameter_tuning'
  | 'caching'
  | 'batching'
  | 'projection_pushdown'
  | 'filter_pushdown'
  | 'limit_pushdown'
  | 'parallel_execution';

/**
 * Query execution statistics.
 */
export interface QueryExecutionStats {
  /** Query fingerprint */
  readonly fingerprint: string;
  /** SQL query */
  readonly sql: string;
  /** Execution count */
  readonly executionCount: number;
  /** Total execution time (ms) */
  readonly totalDurationMs: number;
  /** Average execution time (ms) */
  readonly avgDurationMs: number;
  /** Min execution time (ms) */
  readonly minDurationMs: number;
  /** Max execution time (ms) */
  readonly maxDurationMs: number;
  /** P95 execution time (ms) */
  readonly p95DurationMs: number;
  /** P99 execution time (ms) */
  readonly p99DurationMs: number;
  /** Total rows returned */
  readonly totalRows: number;
  /** Average rows per execution */
  readonly avgRows: number;
  /** Last executed timestamp */
  readonly lastExecuted: Date;
  /** First executed timestamp */
  readonly firstExecuted: Date;
  /** Error count */
  readonly errorCount: number;
}

// ============================================================================
// Index Tuning Types
// ============================================================================

/**
 * Workload analysis result.
 */
export interface WorkloadAnalysis {
  /** Analysis timestamp */
  readonly timestamp: Date;
  /** Analysis duration (ms) */
  readonly durationMs: number;
  /** Total queries analyzed */
  readonly totalQueries: number;
  /** Query type distribution */
  readonly queryDistribution: Map<QueryType, number>;
  /** Most frequent query patterns */
  readonly topPatterns: QueryPattern[];
  /** Hot tables (most accessed) */
  readonly hotTables: TableAccess[];
  /** Index usage summary */
  readonly indexUsage: IndexUsageSummary[];
  /** Workload characteristics */
  readonly characteristics: WorkloadCharacteristics;
  /** Recommendations */
  readonly recommendations: WorkloadRecommendation[];
}

/**
 * Query pattern from workload analysis.
 */
export interface QueryPattern {
  /** Pattern fingerprint */
  readonly fingerprint: string;
  /** Example query */
  readonly example: string;
  /** Execution frequency */
  readonly frequency: number;
  /** Average duration (ms) */
  readonly avgDurationMs: number;
  /** Tables involved */
  readonly tables: string[];
  /** Is vector search */
  readonly isVectorSearch: boolean;
}

/**
 * Table access statistics.
 */
export interface TableAccess {
  /** Table name */
  readonly tableName: string;
  /** Read count */
  readonly reads: number;
  /** Write count */
  readonly writes: number;
  /** Vector search count */
  readonly vectorSearches: number;
  /** Average scan size */
  readonly avgScanSize: number;
  /** Is frequently accessed */
  readonly isHot: boolean;
}

/**
 * Index usage summary.
 */
export interface IndexUsageSummary {
  /** Index name */
  readonly indexName: string;
  /** Table name */
  readonly tableName: string;
  /** Index type */
  readonly indexType: VectorIndexType;
  /** Scan count */
  readonly scanCount: number;
  /** Tuple reads */
  readonly tupleReads: number;
  /** Tuple fetches */
  readonly tupleFetches: number;
  /** Is underutilized */
  readonly isUnderutilized: boolean;
  /** Recommendation */
  readonly recommendation: 'keep' | 'drop' | 'rebuild' | 'tune';
}

/**
 * Workload characteristics.
 */
export interface WorkloadCharacteristics {
  /** Read/write ratio */
  readonly readWriteRatio: number;
  /** Vector search percentage */
  readonly vectorSearchPercentage: number;
  /** Average query complexity */
  readonly avgComplexity: number;
  /** Peak hours (0-23) */
  readonly peakHours: number[];
  /** Is OLTP-like */
  readonly isOLTP: boolean;
  /** Is OLAP-like */
  readonly isOLAP: boolean;
  /** Is hybrid */
  readonly isHybrid: boolean;
}

/**
 * Workload-based recommendation.
 */
export interface WorkloadRecommendation {
  /** Recommendation type */
  readonly type: 'create_index' | 'drop_index' | 'tune_parameter' | 'partition_table' | 'materialize_view';
  /** Priority (1-10) */
  readonly priority: number;
  /** Description */
  readonly description: string;
  /** Estimated impact */
  readonly estimatedImpact: string;
  /** SQL to execute */
  readonly sql?: string;
}

/**
 * Index suggestion.
 */
export interface IndexSuggestion {
  /** Table name */
  readonly tableName: string;
  /** Column name */
  readonly columnName: string;
  /** Suggested index type */
  readonly indexType: VectorIndexType;
  /** Suggested index name */
  readonly indexName: string;
  /** Distance metric */
  readonly metric?: DistanceMetric;
  /** HNSW M parameter */
  readonly m?: number;
  /** HNSW ef_construction */
  readonly efConstruction?: number;
  /** IVF lists */
  readonly lists?: number;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Expected improvement */
  readonly expectedImprovement: number;
  /** Rationale */
  readonly rationale: string;
  /** CREATE INDEX SQL */
  readonly createSql: string;
}

/**
 * HNSW parameters.
 */
export interface HNSWParams {
  /** M parameter (connections per layer) */
  readonly m: number;
  /** ef_construction parameter */
  readonly efConstruction: number;
  /** ef_search parameter */
  readonly efSearch: number;
  /** Optimal for workload */
  readonly optimizedFor: 'recall' | 'speed' | 'balanced';
  /** Tuning confidence (0-1) */
  readonly confidence: number;
  /** Estimated recall */
  readonly estimatedRecall: number;
  /** Estimated QPS */
  readonly estimatedQps: number;
}

// ============================================================================
// Pattern Recognition Types
// ============================================================================

/**
 * Query history entry.
 */
export interface QueryHistory {
  /** Query fingerprint */
  readonly fingerprint: string;
  /** SQL query */
  readonly sql: string;
  /** Execution timestamp */
  readonly timestamp: Date;
  /** Duration (ms) */
  readonly durationMs: number;
  /** Rows returned */
  readonly rowCount: number;
  /** Was successful */
  readonly success: boolean;
  /** User/session ID */
  readonly sessionId?: string;
  /** Context metadata */
  readonly context?: Record<string, unknown>;
}

/**
 * Detected query pattern.
 */
export interface Pattern {
  /** Pattern ID */
  readonly id: string;
  /** Pattern type */
  readonly type: PatternType;
  /** Pattern signature */
  readonly signature: string;
  /** Description */
  readonly description: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Occurrence count */
  readonly occurrences: number;
  /** Example queries matching this pattern */
  readonly examples: string[];
  /** Temporal characteristics */
  readonly temporal?: TemporalPattern;
  /** Performance characteristics */
  readonly performance: PerformancePattern;
  /** First detected */
  readonly firstDetected: Date;
  /** Last detected */
  readonly lastDetected: Date;
}

/**
 * Pattern types.
 */
export type PatternType =
  | 'sequential_access'
  | 'random_access'
  | 'bulk_insert'
  | 'bulk_update'
  | 'similarity_search'
  | 'range_query'
  | 'aggregation'
  | 'join_pattern'
  | 'periodic'
  | 'burst'
  | 'degrading_performance';

/**
 * Temporal pattern characteristics.
 */
export interface TemporalPattern {
  /** Is periodic */
  readonly isPeriodic: boolean;
  /** Period in seconds (if periodic) */
  readonly periodSeconds?: number;
  /** Peak times (hour of day) */
  readonly peakHours: number[];
  /** Trend direction */
  readonly trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  /** Seasonality detected */
  readonly hasSeasonality: boolean;
}

/**
 * Performance pattern.
 */
export interface PerformancePattern {
  /** Average response time trend */
  readonly responseTrend: 'improving' | 'degrading' | 'stable';
  /** Variance coefficient */
  readonly varianceCoefficient: number;
  /** Has outliers */
  readonly hasOutliers: boolean;
  /** Percentile distribution */
  readonly percentiles: {
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
    readonly p95: number;
    readonly p99: number;
  };
}

/**
 * Query prediction context.
 */
export interface Context {
  /** Current session ID */
  readonly sessionId?: string;
  /** Recent query fingerprints */
  readonly recentQueries: string[];
  /** Current time */
  readonly timestamp: Date;
  /** User context */
  readonly userContext?: Record<string, unknown>;
  /** Application context */
  readonly appContext?: Record<string, unknown>;
}

/**
 * Query anomaly.
 */
export interface Anomaly {
  /** Anomaly ID */
  readonly id: string;
  /** Anomaly type */
  readonly type: AnomalyType;
  /** Affected query */
  readonly query: string;
  /** Query fingerprint */
  readonly fingerprint: string;
  /** Detection timestamp */
  readonly timestamp: Date;
  /** Severity (1-10) */
  readonly severity: number;
  /** Description */
  readonly description: string;
  /** Expected value */
  readonly expected: number;
  /** Actual value */
  readonly actual: number;
  /** Deviation from normal */
  readonly deviation: number;
  /** Possible causes */
  readonly possibleCauses: string[];
  /** Recommended actions */
  readonly recommendations: string[];
}

/**
 * Anomaly types.
 */
export type AnomalyType =
  | 'slow_query'
  | 'high_resource_usage'
  | 'unusual_pattern'
  | 'error_spike'
  | 'traffic_anomaly'
  | 'data_drift'
  | 'index_degradation'
  | 'cardinality_change';

// ============================================================================
// Learning System Types
// ============================================================================

/**
 * Learning configuration.
 */
export interface LearningConfig {
  /** Enable micro-learning */
  readonly enableMicroLearning: boolean;
  /** Micro-learning threshold (ms) */
  readonly microLearningThresholdMs: number;
  /** Enable background learning */
  readonly enableBackgroundLearning: boolean;
  /** Background learning interval (ms) */
  readonly backgroundLearningIntervalMs: number;
  /** Enable EWC++ */
  readonly enableEWC: boolean;
  /** EWC lambda (regularization strength) */
  readonly ewcLambda: number;
  /** Maximum patterns to retain */
  readonly maxPatterns: number;
  /** Pattern expiry time (ms) */
  readonly patternExpiryMs: number;
  /** Learning rate */
  readonly learningRate: number;
  /** Momentum */
  readonly momentum: number;
}

/**
 * Learning statistics.
 */
export interface LearningStats {
  /** Total patterns learned */
  readonly totalPatterns: number;
  /** Active patterns */
  readonly activePatterns: number;
  /** Expired patterns */
  readonly expiredPatterns: number;
  /** Micro-learning events */
  readonly microLearningEvents: number;
  /** Background learning cycles */
  readonly backgroundLearningCycles: number;
  /** EWC consolidations */
  readonly ewcConsolidations: number;
  /** Average learning time (ms) */
  readonly avgLearningTimeMs: number;
  /** Memory usage (bytes) */
  readonly memoryUsageBytes: number;
  /** Last learning timestamp */
  readonly lastLearningTimestamp: Date;
}

/**
 * EWC++ state for preventing catastrophic forgetting.
 */
export interface EWCState {
  /** Fisher information matrix (diagonal approximation) */
  readonly fisherDiagonal: Map<string, number>;
  /** Previous parameter values */
  readonly previousParams: Map<string, number>;
  /** Consolidation count */
  readonly consolidationCount: number;
  /** Last consolidation timestamp */
  readonly lastConsolidation: Date;
  /** Protected patterns */
  readonly protectedPatterns: Set<string>;
}


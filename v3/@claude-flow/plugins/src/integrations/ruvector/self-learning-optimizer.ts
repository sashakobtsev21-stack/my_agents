/**
 * RuVector Self-Learning — query optimizer
 *
 * QueryOptimizer: adaptive query analysis and optimization.
 * Extracted verbatim from self-learning.ts (lines 580-1066) during the
 * P3.42 god-file decomposition (W163). self-learning.ts stays the barrel.
 */

import type {
  Bottleneck,
  IndexHint,
  LearningConfig,
  Optimization,
  QueryAnalysis,
  QueryExecutionStats,
  QueryType,
  VectorOperation,
} from './self-learning-types.js';
import type { DistanceMetric } from './types.js';

// ============================================================================
// Query Optimizer Implementation
// ============================================================================

/**
 * Query Optimizer for analyzing and optimizing SQL queries.
 * Implements SONA-inspired micro-learning for real-time adaptation.
 */
export class QueryOptimizer {
  private readonly queryStats: Map<string, QueryExecutionStats> = new Map();
  private readonly optimizationCache: Map<string, Optimization[]> = new Map();
  private readonly config: LearningConfig;

  constructor(config?: Partial<LearningConfig>) {
    this.config = {
      enableMicroLearning: true,
      microLearningThresholdMs: 0.1, // <0.1ms for micro-learning
      enableBackgroundLearning: true,
      backgroundLearningIntervalMs: 60000,
      enableEWC: true,
      ewcLambda: 0.5,
      maxPatterns: 10000,
      patternExpiryMs: 86400000, // 24 hours
      learningRate: 0.01,
      momentum: 0.9,
      ...config,
    };
  }

  /**
   * Analyze a SQL query and return detailed analysis.
   */
  analyzeQuery(sql: string): QueryAnalysis {
    const startTime = performance.now();

    // Parse query type
    const queryType = this.parseQueryType(sql);

    // Extract tables
    const tables = this.extractTables(sql);

    // Extract columns
    const columns = this.extractColumns(sql);

    // Detect vector operations
    const vectorOperations = this.detectVectorOperations(sql, tables);

    // Calculate complexity
    const complexity = this.calculateComplexity(sql, vectorOperations);

    // Generate index hints
    const indexHints = this.generateIndexHints(sql, tables, vectorOperations);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(sql, tables, vectorOperations);

    // Generate fingerprint
    const fingerprint = this.generateFingerprint(sql);

    const parseTimeMs = performance.now() - startTime;

    return {
      sql,
      queryType,
      tables,
      columns,
      vectorOperations,
      complexity,
      indexHints,
      bottlenecks,
      parseTimeMs,
      fingerprint,
    };
  }

  /**
   * Suggest optimizations for a query analysis.
   */
  suggestOptimizations(analysis: QueryAnalysis): Optimization[] {
    // Check cache first
    const cached = this.optimizationCache.get(analysis.fingerprint);
    if (cached) {
      return cached;
    }

    const optimizations: Optimization[] = [];

    // Index usage optimizations
    for (const hint of analysis.indexHints) {
      if (hint.confidence > 0.7) {
        optimizations.push({
          type: 'index_usage',
          description: `Create ${hint.indexType} index on ${hint.table}.${hint.column}`,
          original: '',
          optimized: `CREATE INDEX idx_${hint.table}_${hint.column} ON ${hint.table} USING ${hint.indexType} (${hint.column})`,
          expectedImprovement: hint.expectedSpeedup * 100,
          confidence: hint.confidence,
          risk: 'low',
          autoApply: false,
        });
      }
    }

    // Vector search optimizations
    for (const op of analysis.vectorOperations) {
      if (op.type === 'search' && op.estimatedCost > 100) {
        optimizations.push({
          type: 'parameter_tuning',
          description: `Tune ef_search for ${op.table}.${op.column} vector search`,
          original: '',
          optimized: `SET hnsw.ef_search = ${Math.min(op.k! * 4, 200)}`,
          expectedImprovement: 30,
          confidence: 0.8,
          risk: 'low',
          autoApply: true,
        });
      }
    }

    // Query rewrite optimizations
    if (analysis.bottlenecks.some(b => b.type === 'full_scan')) {
      optimizations.push({
        type: 'query_rewrite',
        description: 'Add LIMIT clause to prevent full table scan',
        original: analysis.sql,
        optimized: analysis.sql.includes('LIMIT') ? analysis.sql : `${analysis.sql} LIMIT 1000`,
        expectedImprovement: 50,
        confidence: 0.6,
        risk: 'medium',
        autoApply: false,
      });
    }

    // Batching optimizations for multiple inserts
    if (analysis.queryType === 'INSERT' && analysis.complexity > 0.5) {
      optimizations.push({
        type: 'batching',
        description: 'Use batch insert for better performance',
        original: analysis.sql,
        optimized: 'Use COPY or multi-row INSERT',
        expectedImprovement: 80,
        confidence: 0.9,
        risk: 'low',
        autoApply: false,
      });
    }

    // Projection pushdown
    if (analysis.sql.includes('SELECT *')) {
      const neededColumns = analysis.columns.slice(0, 5).join(', ');
      optimizations.push({
        type: 'projection_pushdown',
        description: 'Select only needed columns instead of SELECT *',
        original: 'SELECT *',
        optimized: `SELECT ${neededColumns || 'id, ...needed_columns'}`,
        expectedImprovement: 20,
        confidence: 0.85,
        risk: 'low',
        autoApply: false,
      });
    }

    // Cache the results
    this.optimizationCache.set(analysis.fingerprint, optimizations);

    return optimizations;
  }

  /**
   * Rewrite a query for better performance.
   */
  rewriteQuery(sql: string): string {
    let rewritten = sql.trim();

    // Normalize whitespace
    rewritten = rewritten.replace(/\s+/g, ' ');

    // Add missing semicolon
    if (!rewritten.endsWith(';')) {
      rewritten += ';';
    }

    // Optimize ORDER BY with LIMIT
    const orderLimitMatch = rewritten.match(/ORDER BY\s+([^\s]+)\s+(ASC|DESC)?\s*;$/i);
    if (orderLimitMatch && !rewritten.includes('LIMIT')) {
      rewritten = rewritten.replace(/;$/, ' LIMIT 100;');
    }

    // Optimize vector distance calculations
    rewritten = rewritten.replace(
      /(\w+)\s*<->\s*\$\d+/g,
      (match, column) => `${column} <=> $1` // Use cosine for better cache locality
    );

    // Add EXPLAIN ANALYZE for slow queries (for debugging)
    // This is disabled in production
    // rewritten = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${rewritten}`;

    return rewritten;
  }

  /**
   * Record query execution statistics for learning.
   */
  recordQueryStats(query: string, duration: number, rows: number): void {
    const fingerprint = this.generateFingerprint(query);
    const existing = this.queryStats.get(fingerprint);
    const now = new Date();

    if (existing) {
      // Update existing stats
      const newCount = existing.executionCount + 1;
      const newTotalDuration = existing.totalDurationMs + duration;
      const newTotalRows = existing.totalRows + rows;

      // Update percentiles (simplified - in production use a proper algorithm)
      const durations = [existing.avgDurationMs * existing.executionCount, duration];
      durations.sort((a, b) => a - b);

      this.queryStats.set(fingerprint, {
        fingerprint,
        sql: query,
        executionCount: newCount,
        totalDurationMs: newTotalDuration,
        avgDurationMs: newTotalDuration / newCount,
        minDurationMs: Math.min(existing.minDurationMs, duration),
        maxDurationMs: Math.max(existing.maxDurationMs, duration),
        p95DurationMs: this.calculatePercentile(durations, 0.95),
        p99DurationMs: this.calculatePercentile(durations, 0.99),
        totalRows: newTotalRows,
        avgRows: newTotalRows / newCount,
        lastExecuted: now,
        firstExecuted: existing.firstExecuted,
        errorCount: existing.errorCount,
      });
    } else {
      // Create new stats
      this.queryStats.set(fingerprint, {
        fingerprint,
        sql: query,
        executionCount: 1,
        totalDurationMs: duration,
        avgDurationMs: duration,
        minDurationMs: duration,
        maxDurationMs: duration,
        p95DurationMs: duration,
        p99DurationMs: duration,
        totalRows: rows,
        avgRows: rows,
        lastExecuted: now,
        firstExecuted: now,
        errorCount: 0,
      });
    }

    // Micro-learning: immediately adapt if enabled
    if (this.config.enableMicroLearning && duration < this.config.microLearningThresholdMs) {
      this.microLearn(fingerprint, duration);
    }
  }

  /**
   * Get query statistics.
   */
  getQueryStats(fingerprint?: string): QueryExecutionStats | QueryExecutionStats[] | undefined {
    if (fingerprint) {
      return this.queryStats.get(fingerprint);
    }
    return Array.from(this.queryStats.values());
  }

  /**
   * Clear optimization cache.
   */
  clearCache(): void {
    this.optimizationCache.clear();
  }

  // Private helper methods

  private parseQueryType(sql: string): QueryType {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }

  private extractTables(sql: string): string[] {
    const tables: string[] = [];
    const fromMatch = sql.match(/FROM\s+([^\s,;]+(?:\s*,\s*[^\s,;]+)*)/i);
    if (fromMatch) {
      tables.push(...fromMatch[1].split(',').map(t => t.trim().split(/\s+/)[0]));
    }
    const joinRegex = /JOIN\s+([^\s]+)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
      tables.push(joinMatch[1]);
    }
    const intoMatch = sql.match(/INTO\s+([^\s(]+)/i);
    if (intoMatch) {
      tables.push(intoMatch[1]);
    }
    return Array.from(new Set(tables));
  }

  private extractColumns(sql: string): string[] {
    const columns: string[] = [];
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch && selectMatch[1] !== '*') {
      columns.push(...selectMatch[1].split(',').map(c => c.trim().split(/\s+as\s+/i)[0]));
    }
    return columns;
  }

  private detectVectorOperations(sql: string, tables: string[]): VectorOperation[] {
    const operations: VectorOperation[] = [];

    // Detect distance operators
    const distanceRegex = /(\w+)\s*(<->|<=>|<#>)\s*['"]?\[/g;
    let distanceMatch;
    while ((distanceMatch = distanceRegex.exec(sql)) !== null) {
      const metricMap: Record<string, DistanceMetric> = {
        '<->': 'euclidean',
        '<=>': 'cosine',
        '<#>': 'dot',
      };
      operations.push({
        type: 'search',
        table: tables[0] || 'unknown',
        column: distanceMatch[1],
        metric: metricMap[distanceMatch[2]] || 'euclidean',
        k: this.extractK(sql),
        estimatedCost: 100,
      });
    }

    // Detect vector aggregations
    if (sql.match(/vector_avg|vector_sum|vector_centroid/i)) {
      operations.push({
        type: 'aggregate',
        table: tables[0] || 'unknown',
        column: 'embedding',
        estimatedCost: 50,
      });
    }

    return operations;
  }

  private extractK(sql: string): number {
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    return limitMatch ? parseInt(limitMatch[1], 10) : 10;
  }

  private calculateComplexity(sql: string, vectorOps: VectorOperation[]): number {
    let complexity = 0;

    // Base complexity from length
    complexity += Math.min(sql.length / 1000, 0.3);

    // Vector operations add complexity
    complexity += vectorOps.length * 0.2;

    // Joins add complexity
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    complexity += joinCount * 0.15;

    // Subqueries add complexity
    const subqueryCount = (sql.match(/\(SELECT/gi) || []).length;
    complexity += subqueryCount * 0.2;

    // Aggregations add complexity
    if (sql.match(/GROUP BY|HAVING|DISTINCT/gi)) {
      complexity += 0.1;
    }

    return Math.min(complexity, 1);
  }

  private generateIndexHints(sql: string, tables: string[], vectorOps: VectorOperation[]): IndexHint[] {
    const hints: IndexHint[] = [];

    for (const op of vectorOps) {
      if (op.type === 'search') {
        hints.push({
          indexType: 'hnsw',
          table: op.table,
          column: op.column,
          confidence: 0.9,
          expectedSpeedup: 10,
        });
      }
    }

    // Check WHERE clause for potential indexes
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*(=|>|<|>=|<=|LIKE)/i);
    if (whereMatch) {
      hints.push({
        indexType: 'hnsw', // Default, would be btree for non-vector
        table: tables[0] || 'unknown',
        column: whereMatch[1],
        confidence: 0.7,
        expectedSpeedup: 5,
      });
    }

    return hints;
  }

  private detectBottlenecks(sql: string, tables: string[], vectorOps: VectorOperation[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Full scan detection
    if (!sql.match(/WHERE|LIMIT/i) && sql.match(/SELECT.*FROM/i)) {
      bottlenecks.push({
        type: 'full_scan',
        description: 'Query may perform a full table scan',
        severity: 7,
        suggestion: 'Add WHERE clause or LIMIT to restrict result set',
      });
    }

    // Missing index for vector search
    for (const op of vectorOps) {
      if (op.estimatedCost > 100) {
        bottlenecks.push({
          type: 'missing_index',
          description: `Vector search on ${op.table}.${op.column} may benefit from an index`,
          severity: 8,
          suggestion: `CREATE INDEX ON ${op.table} USING hnsw (${op.column})`,
        });
      }
    }

    // Cartesian product detection
    if (tables.length > 1 && !sql.match(/JOIN|WHERE.*=.*\./i)) {
      bottlenecks.push({
        type: 'cartesian_product',
        description: 'Query may produce a Cartesian product',
        severity: 9,
        suggestion: 'Add JOIN conditions between tables',
      });
    }

    return bottlenecks;
  }

  private generateFingerprint(sql: string): string {
    // Normalize and hash the query
    let normalized = sql
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '$?')
      .replace(/'[^']*'/g, "'?'")
      .replace(/\d+/g, '?')
      .toLowerCase()
      .trim();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `qf_${Math.abs(hash).toString(16)}`;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private microLearn(fingerprint: string, duration: number): void {
    // Micro-learning: fast, lightweight adaptation
    // In production, this would update neural network weights
    const stats = this.queryStats.get(fingerprint);
    if (stats && stats.avgDurationMs > duration * 2) {
      // Query is performing better than average - learn from this
      // This is a placeholder for actual neural adaptation
    }
  }
}


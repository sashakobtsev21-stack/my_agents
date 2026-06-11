/**
 * RuVector Self-Learning — index tuner
 *
 * IndexTuner: workload-driven index suggestion and HNSW tuning.
 * Extracted verbatim from self-learning.ts (lines 1067-1536) during the
 * P3.42 god-file decomposition (W163). self-learning.ts stays the barrel.
 */

import type {
  HNSWParams,
  IndexSuggestion,
  IndexUsageSummary,
  QueryHistory,
  QueryPattern,
  QueryType,
  TableAccess,
  WorkloadAnalysis,
  WorkloadCharacteristics,
  WorkloadRecommendation,
} from './self-learning-types.js';
import type { DistanceMetric, IndexStats, VectorIndexType } from './types.js';

// ============================================================================
// Index Tuner Implementation
// ============================================================================

/**
 * Index Tuner for analyzing workloads and suggesting index changes.
 * Implements intelligent HNSW parameter tuning based on query patterns.
 */
export class IndexTuner {
  private readonly indexStats: Map<string, IndexStats> = new Map();
  private readonly workloadHistory: QueryHistory[] = [];
  private readonly maxHistorySize: number = 10000;

  /**
   * Analyze workload patterns.
   */
  analyzeWorkload(): WorkloadAnalysis {
    const startTime = performance.now();
    const now = new Date();

    // Query type distribution
    const queryDistribution = new Map<QueryType, number>();
    const tableAccess = new Map<string, TableAccess>();
    const patternCounts = new Map<string, number>();

    for (const history of this.workloadHistory) {
      // Count query types
      const type = this.getQueryType(history.sql);
      queryDistribution.set(type, (queryDistribution.get(type) || 0) + 1);

      // Track table access
      const tables = this.extractTables(history.sql);
      for (const table of tables) {
        const existing = tableAccess.get(table) || {
          tableName: table,
          reads: 0,
          writes: 0,
          vectorSearches: 0,
          avgScanSize: 0,
          isHot: false,
        };

        if (type === 'SELECT') {
          tableAccess.set(table, { ...existing, reads: existing.reads + 1 });
        } else if (type === 'INSERT' || type === 'UPDATE' || type === 'DELETE') {
          tableAccess.set(table, { ...existing, writes: existing.writes + 1 });
        }

        if (this.isVectorSearch(history.sql)) {
          tableAccess.set(table, { ...existing, vectorSearches: existing.vectorSearches + 1 });
        }
      }

      // Count patterns
      const fingerprint = this.generateFingerprint(history.sql);
      patternCounts.set(fingerprint, (patternCounts.get(fingerprint) || 0) + 1);
    }

    // Calculate characteristics
    const totalQueries = this.workloadHistory.length;
    const readCount = queryDistribution.get('SELECT') || 0;
    const writeCount = (queryDistribution.get('INSERT') || 0) +
                       (queryDistribution.get('UPDATE') || 0) +
                       (queryDistribution.get('DELETE') || 0);

    const vectorSearchCount = this.workloadHistory.filter(h => this.isVectorSearch(h.sql)).length;

    const characteristics: WorkloadCharacteristics = {
      readWriteRatio: writeCount > 0 ? readCount / writeCount : readCount,
      vectorSearchPercentage: totalQueries > 0 ? (vectorSearchCount / totalQueries) * 100 : 0,
      avgComplexity: this.calculateAvgComplexity(),
      peakHours: this.detectPeakHours(),
      isOLTP: readCount < writeCount * 3,
      isOLAP: readCount > writeCount * 10,
      isHybrid: readCount >= writeCount * 3 && readCount <= writeCount * 10,
    };

    // Generate top patterns
    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([fingerprint, frequency]) => {
        const example = this.workloadHistory.find(h =>
          this.generateFingerprint(h.sql) === fingerprint
        );
        const avgDuration = this.calculateAvgDurationForFingerprint(fingerprint);
        const tables = example ? this.extractTables(example.sql) : [];

        return {
          fingerprint,
          example: example?.sql || '',
          frequency,
          avgDurationMs: avgDuration,
          tables,
          isVectorSearch: example ? this.isVectorSearch(example.sql) : false,
        };
      });

    // Hot tables
    const hotTables = Array.from(tableAccess.values())
      .map(t => ({
        ...t,
        isHot: t.reads + t.writes > totalQueries * 0.1,
      }))
      .sort((a, b) => (b.reads + b.writes) - (a.reads + a.writes))
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateWorkloadRecommendations(
      characteristics,
      hotTables,
      topPatterns
    );

    const durationMs = performance.now() - startTime;

    return {
      timestamp: now,
      durationMs,
      totalQueries,
      queryDistribution,
      topPatterns,
      hotTables,
      indexUsage: this.getIndexUsageSummary(),
      characteristics,
      recommendations,
    };
  }

  /**
   * Suggest indexes based on workload analysis.
   */
  suggestIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    const workload = this.analyzeWorkload();

    // Suggest HNSW indexes for vector search patterns
    for (const pattern of workload.topPatterns) {
      if (pattern.isVectorSearch && pattern.frequency > 10) {
        for (const table of pattern.tables) {
          suggestions.push({
            tableName: table,
            columnName: 'embedding',
            indexType: 'hnsw',
            indexName: `idx_${table}_embedding_hnsw`,
            metric: 'cosine',
            m: this.recommendM(pattern.frequency),
            efConstruction: this.recommendEfConstruction(pattern.frequency),
            confidence: Math.min(0.5 + pattern.frequency / 100, 0.95),
            expectedImprovement: this.estimateImprovement(pattern),
            rationale: `High-frequency vector search pattern detected (${pattern.frequency} queries)`,
            createSql: this.generateCreateIndexSql(table, 'embedding', 'hnsw', 'cosine'),
          });
        }
      }
    }

    // Suggest IVF for very large tables
    for (const table of workload.hotTables) {
      if (table.vectorSearches > 100 && table.reads > 1000) {
        suggestions.push({
          tableName: table.tableName,
          columnName: 'embedding',
          indexType: 'ivfflat',
          indexName: `idx_${table.tableName}_embedding_ivf`,
          metric: 'euclidean',
          lists: this.recommendIvfLists(table.reads),
          confidence: 0.7,
          expectedImprovement: 30,
          rationale: 'Large table with frequent vector searches - IVF may provide good balance',
          createSql: this.generateCreateIndexSql(table.tableName, 'embedding', 'ivfflat', 'euclidean'),
        });
      }
    }

    return suggestions;
  }

  /**
   * Auto-tune HNSW parameters for a table.
   */
  tuneHNSW(tableName: string): HNSWParams {
    // Analyze query patterns for this table
    const tableQueries = this.workloadHistory.filter(h =>
      this.extractTables(h.sql).includes(tableName) && this.isVectorSearch(h.sql)
    );

    if (tableQueries.length === 0) {
      // Return default balanced parameters
      return {
        m: 16,
        efConstruction: 64,
        efSearch: 40,
        optimizedFor: 'balanced',
        confidence: 0.5,
        estimatedRecall: 0.95,
        estimatedQps: 1000,
      };
    }

    // Calculate average K value from queries
    const avgK = tableQueries.reduce((sum, q) => sum + this.extractK(q.sql), 0) / tableQueries.length;

    // Calculate query frequency
    const qps = tableQueries.length / Math.max(1, this.getWorkloadDurationHours());

    // Determine optimization target
    let optimizedFor: 'recall' | 'speed' | 'balanced';
    if (qps > 100) {
      optimizedFor = 'speed';
    } else if (avgK > 50) {
      optimizedFor = 'recall';
    } else {
      optimizedFor = 'balanced';
    }

    // Calculate parameters based on optimization target
    let m: number, efConstruction: number, efSearch: number;
    let estimatedRecall: number, estimatedQps: number;

    switch (optimizedFor) {
      case 'speed':
        m = 12;
        efConstruction = 40;
        efSearch = Math.max(20, avgK * 2);
        estimatedRecall = 0.90;
        estimatedQps = 2000;
        break;
      case 'recall':
        m = 24;
        efConstruction = 200;
        efSearch = Math.max(100, avgK * 4);
        estimatedRecall = 0.99;
        estimatedQps = 500;
        break;
      default: // balanced
        m = 16;
        efConstruction = 100;
        efSearch = Math.max(40, avgK * 3);
        estimatedRecall = 0.95;
        estimatedQps = 1000;
    }

    return {
      m,
      efConstruction,
      efSearch,
      optimizedFor,
      confidence: Math.min(0.6 + tableQueries.length / 500, 0.95),
      estimatedRecall,
      estimatedQps,
    };
  }

  /**
   * Get index statistics.
   */
  getIndexStats(): Map<string, IndexStats> {
    return new Map(this.indexStats);
  }

  /**
   * Update index statistics.
   */
  updateIndexStats(indexName: string, stats: IndexStats): void {
    this.indexStats.set(indexName, stats);
  }

  /**
   * Record query history for workload analysis.
   */
  recordQuery(history: QueryHistory): void {
    this.workloadHistory.push(history);

    // Trim history if too large
    if (this.workloadHistory.length > this.maxHistorySize) {
      this.workloadHistory.splice(0, this.workloadHistory.length - this.maxHistorySize);
    }
  }

  // Private helper methods

  private getQueryType(sql: string): QueryType {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }

  private extractTables(sql: string): string[] {
    const tables: string[] = [];
    const fromMatch = sql.match(/FROM\s+([^\s,;]+)/i);
    if (fromMatch) tables.push(fromMatch[1]);
    const joinRegex = /JOIN\s+([^\s]+)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
      tables.push(joinMatch[1]);
    }
    return Array.from(new Set(tables));
  }

  private isVectorSearch(sql: string): boolean {
    return /<->|<=>|<#>/.test(sql);
  }

  private generateFingerprint(sql: string): string {
    let normalized = sql
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '$?')
      .replace(/'[^']*'/g, "'?'")
      .replace(/\d+/g, '?')
      .toLowerCase()
      .trim();

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `qf_${Math.abs(hash).toString(16)}`;
  }

  private calculateAvgComplexity(): number {
    if (this.workloadHistory.length === 0) return 0;

    let totalComplexity = 0;
    for (const history of this.workloadHistory) {
      const joinCount = (history.sql.match(/JOIN/gi) || []).length;
      const subqueryCount = (history.sql.match(/\(SELECT/gi) || []).length;
      totalComplexity += (joinCount * 0.15 + subqueryCount * 0.2);
    }

    return Math.min(totalComplexity / this.workloadHistory.length, 1);
  }

  private detectPeakHours(): number[] {
    const hourCounts = new Array(24).fill(0);

    for (const history of this.workloadHistory) {
      hourCounts[history.timestamp.getHours()]++;
    }

    const maxCount = Math.max(...hourCounts);
    const threshold = maxCount * 0.7;

    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count >= threshold)
      .map(h => h.hour);
  }

  private calculateAvgDurationForFingerprint(fingerprint: string): number {
    const matching = this.workloadHistory.filter(h =>
      this.generateFingerprint(h.sql) === fingerprint
    );

    if (matching.length === 0) return 0;
    return matching.reduce((sum, h) => sum + h.durationMs, 0) / matching.length;
  }

  private getIndexUsageSummary(): IndexUsageSummary[] {
    return Array.from(this.indexStats.entries()).map(([indexName, stats]) => ({
      indexName,
      tableName: stats.indexName.split('_')[1] || 'unknown',
      indexType: stats.indexType,
      scanCount: Math.floor(Math.random() * 1000), // In production, get from pg_stat_user_indexes
      tupleReads: Math.floor(Math.random() * 10000),
      tupleFetches: Math.floor(Math.random() * 5000),
      isUnderutilized: false,
      recommendation: 'keep' as const,
    }));
  }

  private generateWorkloadRecommendations(
    characteristics: WorkloadCharacteristics,
    hotTables: TableAccess[],
    topPatterns: QueryPattern[]
  ): WorkloadRecommendation[] {
    const recommendations: WorkloadRecommendation[] = [];

    // High vector search percentage
    if (characteristics.vectorSearchPercentage > 50) {
      recommendations.push({
        type: 'create_index',
        priority: 9,
        description: 'High vector search workload - ensure HNSW indexes on all vector columns',
        estimatedImpact: 'Up to 100x improvement in search latency',
      });
    }

    // OLAP workload
    if (characteristics.isOLAP) {
      recommendations.push({
        type: 'materialize_view',
        priority: 7,
        description: 'OLAP workload detected - consider materialized views for common aggregations',
        estimatedImpact: 'Reduce query time by 80% for repeated analytics',
      });
    }

    // Hot tables without indexes
    for (const table of hotTables) {
      if (table.vectorSearches > 0 && table.isHot) {
        recommendations.push({
          type: 'tune_parameter',
          priority: 8,
          description: `Table ${table.tableName} is hot - tune ef_search for optimal performance`,
          estimatedImpact: '20-50% improvement in search latency',
        });
      }
    }

    return recommendations;
  }

  private recommendM(frequency: number): number {
    if (frequency > 100) return 24;
    if (frequency > 50) return 16;
    return 12;
  }

  private recommendEfConstruction(frequency: number): number {
    if (frequency > 100) return 200;
    if (frequency > 50) return 100;
    return 64;
  }

  private recommendIvfLists(rowCount: number): number {
    return Math.min(Math.max(Math.sqrt(rowCount), 10), 1000);
  }

  private estimateImprovement(pattern: QueryPattern): number {
    if (pattern.avgDurationMs > 100) return 90;
    if (pattern.avgDurationMs > 50) return 70;
    if (pattern.avgDurationMs > 20) return 50;
    return 30;
  }

  private generateCreateIndexSql(
    tableName: string,
    columnName: string,
    indexType: VectorIndexType,
    metric: DistanceMetric
  ): string {
    const opsClass = metric === 'cosine' ? 'vector_cosine_ops' :
                     metric === 'euclidean' ? 'vector_l2_ops' :
                     'vector_ip_ops';

    return `CREATE INDEX idx_${tableName}_${columnName}_${indexType} ON ${tableName} ` +
           `USING ${indexType} (${columnName} ${opsClass})`;
  }

  private extractK(sql: string): number {
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    return limitMatch ? parseInt(limitMatch[1], 10) : 10;
  }

  private getWorkloadDurationHours(): number {
    if (this.workloadHistory.length < 2) return 1;

    const first = this.workloadHistory[0].timestamp.getTime();
    const last = this.workloadHistory[this.workloadHistory.length - 1].timestamp.getTime();

    return Math.max(1, (last - first) / (1000 * 60 * 60));
  }
}


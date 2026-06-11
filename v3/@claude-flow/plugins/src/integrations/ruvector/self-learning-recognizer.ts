/**
 * RuVector Self-Learning — pattern recognizer
 *
 * PatternRecognizer: temporal/performance pattern detection and
 * anomaly identification.
 * Extracted verbatim from self-learning.ts (lines 1537-2007) during the
 * P3.42 god-file decomposition (W163). self-learning.ts stays the barrel.
 */

import type {
  Anomaly,
  Context,
  LearningConfig,
  Pattern,
  PatternType,
  QueryHistory,
} from './self-learning-types.js';

// ============================================================================
// Pattern Recognizer Implementation
// ============================================================================

/**
 * Pattern Recognizer for learning from query history and detecting patterns.
 * Implements anomaly detection and query prediction.
 */
export class PatternRecognizer {
  private readonly patterns: Map<string, Pattern> = new Map();
  private readonly anomalyHistory: Anomaly[] = [];
  private readonly querySequences: Map<string, string[]> = new Map();
  private readonly config: LearningConfig;

  constructor(config?: Partial<LearningConfig>) {
    this.config = {
      enableMicroLearning: true,
      microLearningThresholdMs: 0.1,
      enableBackgroundLearning: true,
      backgroundLearningIntervalMs: 60000,
      enableEWC: true,
      ewcLambda: 0.5,
      maxPatterns: 10000,
      patternExpiryMs: 86400000,
      learningRate: 0.01,
      momentum: 0.9,
      ...config,
    };
  }

  /**
   * Learn from query history.
   */
  learnFromHistory(queries: QueryHistory[]): void {
    const now = new Date();

    // Group queries by fingerprint
    const grouped = new Map<string, QueryHistory[]>();
    for (const query of queries) {
      const fingerprint = this.generateFingerprint(query.sql);
      const existing = grouped.get(fingerprint) || [];
      existing.push(query);
      grouped.set(fingerprint, existing);
    }

    // Analyze each group for patterns
    grouped.forEach((group, fingerprint) => {
      const pattern = this.analyzeGroup(fingerprint, group, now);
      if (pattern) {
        this.patterns.set(pattern.id, pattern);
      }
    });

    // Detect sequential patterns
    this.detectSequentialPatterns(queries);

    // Expire old patterns
    this.expirePatterns(now);
  }

  /**
   * Detect patterns in the current workload.
   */
  detectPatterns(): Pattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence > 0.5)
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Predict next likely queries based on context.
   */
  predictQueries(context: Context): string[] {
    const predictions: Array<{ query: string; score: number }> = [];

    // Use recent query sequence for prediction
    if (context.recentQueries.length > 0) {
      const lastQuery = context.recentQueries[context.recentQueries.length - 1];
      const sequences = this.querySequences.get(lastQuery) || [];

      for (const nextQuery of sequences) {
        predictions.push({
          query: nextQuery,
          score: 0.8,
        });
      }
    }

    // Use time-based patterns
    const hour = context.timestamp.getHours();
    Array.from(this.patterns.values()).forEach(pattern => {
      if (pattern.temporal?.peakHours.includes(hour) && pattern.examples.length > 0) {
        predictions.push({
          query: pattern.examples[0],
          score: pattern.confidence * 0.6,
        });
      }
    });

    // Sort by score and return top 10
    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => p.query);
  }

  /**
   * Detect anomalies in queries.
   */
  detectAnomalies(queries: string[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const now = new Date();

    for (const query of queries) {
      const fingerprint = this.generateFingerprint(query);
      const pattern = this.patterns.get(`pattern_${fingerprint}`);

      if (pattern) {
        // Check for performance degradation
        const currentPerf = pattern.performance;
        if (currentPerf.responseTrend === 'degrading') {
          anomalies.push({
            id: `anomaly_${Date.now()}_${fingerprint}`,
            type: 'slow_query',
            query,
            fingerprint,
            timestamp: now,
            severity: 6,
            description: 'Query performance is degrading over time',
            expected: currentPerf.percentiles.p50,
            actual: currentPerf.percentiles.p95,
            deviation: (currentPerf.percentiles.p95 - currentPerf.percentiles.p50) / currentPerf.percentiles.p50,
            possibleCauses: [
              'Table growth without index optimization',
              'Increased concurrent load',
              'Data distribution changes',
            ],
            recommendations: [
              'Analyze query execution plan',
              'Check index usage statistics',
              'Consider query optimization',
            ],
          });
        }

        // Check for unusual patterns
        if (currentPerf.hasOutliers && currentPerf.varianceCoefficient > 1) {
          anomalies.push({
            id: `anomaly_${Date.now()}_${fingerprint}_variance`,
            type: 'unusual_pattern',
            query,
            fingerprint,
            timestamp: now,
            severity: 5,
            description: 'High variance in query performance',
            expected: currentPerf.percentiles.p50,
            actual: currentPerf.percentiles.p99,
            deviation: currentPerf.varianceCoefficient,
            possibleCauses: [
              'Inconsistent data access patterns',
              'Resource contention',
              'Cache invalidation',
            ],
            recommendations: [
              'Monitor system resources',
              'Check for lock contention',
              'Review connection pool settings',
            ],
          });
        }
      }
    }

    // Store anomalies
    this.anomalyHistory.push(...anomalies);

    // Trim history
    if (this.anomalyHistory.length > 1000) {
      this.anomalyHistory.splice(0, this.anomalyHistory.length - 1000);
    }

    return anomalies;
  }

  /**
   * Get pattern by ID.
   */
  getPattern(id: string): Pattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns.
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get anomaly history.
   */
  getAnomalyHistory(): Anomaly[] {
    return [...this.anomalyHistory];
  }

  /**
   * Clear learned patterns.
   */
  clearPatterns(): void {
    this.patterns.clear();
    this.querySequences.clear();
  }

  // Private helper methods

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

  private analyzeGroup(fingerprint: string, queries: QueryHistory[], now: Date): Pattern | null {
    if (queries.length < 3) return null; // Need minimum samples

    const id = `pattern_${fingerprint}`;
    const existing = this.patterns.get(id);

    // Calculate temporal characteristics
    const timestamps = queries.map(q => q.timestamp.getTime());
    const isPeriodic = this.detectPeriodicity(timestamps);
    const peakHours = this.detectPeakHours(queries);

    // Calculate performance characteristics
    const durations = queries.map(q => q.durationMs);
    durations.sort((a, b) => a - b);

    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p75 = durations[Math.floor(durations.length * 0.75)];
    const p90 = durations[Math.floor(durations.length * 0.9)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const varianceCoefficient = stdDev / mean;

    // Determine response trend
    let responseTrend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (queries.length >= 10) {
      const recentAvg = queries.slice(-5).reduce((s, q) => s + q.durationMs, 0) / 5;
      const oldAvg = queries.slice(0, 5).reduce((s, q) => s + q.durationMs, 0) / 5;
      if (recentAvg > oldAvg * 1.2) responseTrend = 'degrading';
      else if (recentAvg < oldAvg * 0.8) responseTrend = 'improving';
    }

    // Determine pattern type
    const patternType = this.determinePatternType(queries, isPeriodic);

    return {
      id,
      type: patternType,
      signature: fingerprint,
      description: `Query pattern with ${queries.length} occurrences`,
      confidence: Math.min(0.5 + queries.length / 50, 0.99),
      occurrences: (existing?.occurrences || 0) + queries.length,
      examples: queries.slice(0, 3).map(q => q.sql),
      temporal: {
        isPeriodic,
        periodSeconds: isPeriodic ? this.calculatePeriod(timestamps) : undefined,
        peakHours,
        trend: this.detectTrend(timestamps),
        hasSeasonality: this.detectSeasonality(timestamps),
      },
      performance: {
        responseTrend,
        varianceCoefficient,
        hasOutliers: this.hasOutliers(durations),
        percentiles: { p50, p75, p90, p95, p99 },
      },
      firstDetected: existing?.firstDetected || now,
      lastDetected: now,
    };
  }

  private detectPeriodicity(timestamps: number[]): boolean {
    if (timestamps.length < 10) return false;

    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Check if intervals are consistent
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;

    return cv < 0.3; // Low coefficient of variation indicates periodicity
  }

  private calculatePeriod(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    return Math.floor(intervals.reduce((a, b) => a + b, 0) / intervals.length / 1000);
  }

  private detectPeakHours(queries: QueryHistory[]): number[] {
    const hourCounts = new Array(24).fill(0);
    for (const query of queries) {
      hourCounts[query.timestamp.getHours()]++;
    }

    const maxCount = Math.max(...hourCounts);
    const threshold = maxCount * 0.7;

    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count >= threshold)
      .map(h => h.hour);
  }

  private detectTrend(timestamps: number[]): 'increasing' | 'decreasing' | 'stable' | 'volatile' {
    if (timestamps.length < 5) return 'stable';

    // Simple linear regression
    const n = timestamps.length;
    const xMean = (n - 1) / 2;
    const yMean = timestamps.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (timestamps[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = numerator / denominator;
    const normalizedSlope = slope / (yMean / n);

    if (normalizedSlope > 0.1) return 'increasing';
    if (normalizedSlope < -0.1) return 'decreasing';
    return 'stable';
  }

  private detectSeasonality(timestamps: number[]): boolean {
    // Simplified seasonality detection using hourly patterns
    if (timestamps.length < 24) return false;

    const hourCounts = new Array(24).fill(0);
    for (const ts of timestamps) {
      hourCounts[new Date(ts).getHours()]++;
    }

    const maxHour = Math.max(...hourCounts);
    const minHour = Math.min(...hourCounts);

    return (maxHour - minHour) / maxHour > 0.5;
  }

  private determinePatternType(queries: QueryHistory[], isPeriodic: boolean): PatternType {
    const sql = queries[0].sql.toLowerCase();

    if (sql.includes('<->') || sql.includes('<=>') || sql.includes('<#>')) {
      return 'similarity_search';
    }
    if (sql.includes('insert')) {
      return queries.length > 10 ? 'bulk_insert' : 'sequential_access';
    }
    if (sql.includes('update')) {
      return queries.length > 10 ? 'bulk_update' : 'sequential_access';
    }
    if (sql.includes('group by') || sql.includes('count(') || sql.includes('sum(')) {
      return 'aggregation';
    }
    if (sql.includes('join')) {
      return 'join_pattern';
    }
    if (sql.includes('between') || sql.includes('>=') || sql.includes('<=')) {
      return 'range_query';
    }
    if (isPeriodic) {
      return 'periodic';
    }

    return 'sequential_access';
  }

  private hasOutliers(values: number[]): boolean {
    if (values.length < 10) return false;

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.some(v => v < lowerBound || v > upperBound);
  }

  private detectSequentialPatterns(queries: QueryHistory[]): void {
    // Group queries by session
    const sessions = new Map<string, QueryHistory[]>();
    for (const query of queries) {
      const sessionId = query.sessionId || 'default';
      const existing = sessions.get(sessionId) || [];
      existing.push(query);
      sessions.set(sessionId, existing);
    }

    // Detect query sequences within each session
    sessions.forEach((sessionQueries) => {
      sessionQueries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      for (let i = 0; i < sessionQueries.length - 1; i++) {
        const current = this.generateFingerprint(sessionQueries[i].sql);
        const next = this.generateFingerprint(sessionQueries[i + 1].sql);

        const sequences = this.querySequences.get(current) || [];
        if (!sequences.includes(next)) {
          sequences.push(next);
          this.querySequences.set(current, sequences);
        }
      }
    });
  }

  private expirePatterns(now: Date): void {
    const expiryThreshold = now.getTime() - this.config.patternExpiryMs;

    const expiredIds: string[] = [];
    this.patterns.forEach((pattern, id) => {
      if (pattern.lastDetected.getTime() < expiryThreshold) {
        expiredIds.push(id);
      }
    });
    expiredIds.forEach(id => this.patterns.delete(id));

    // Also limit total patterns
    if (this.patterns.size > this.config.maxPatterns) {
      const sorted = Array.from(this.patterns.entries())
        .sort((a, b) => b[1].occurrences - a[1].occurrences);

      const toKeep = sorted.slice(0, this.config.maxPatterns);
      this.patterns.clear();
      for (const [id, pattern] of toKeep) {
        this.patterns.set(id, pattern);
      }
    }
  }
}


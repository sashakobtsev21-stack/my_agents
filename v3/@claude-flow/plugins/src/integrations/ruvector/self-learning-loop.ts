/**
 * RuVector Self-Learning — learning loop
 *
 * LearningLoop: continuous learning with EWC++ protection,
 * orchestrating the optimizer, tuner, and recognizer.
 * Extracted verbatim from self-learning.ts (lines 2008-2306) during the
 * P3.42 god-file decomposition (W163). self-learning.ts stays the barrel.
 */

import { QueryOptimizer } from './self-learning-optimizer.js';
import { IndexTuner } from './self-learning-tuner.js';
import { PatternRecognizer } from './self-learning-recognizer.js';
import type {
  EWCState,
  LearningConfig,
  LearningStats,
  Pattern,
  QueryExecutionStats,
} from './self-learning-types.js';

// ============================================================================
// Learning Loop Implementation
// ============================================================================

/**
 * Self-Learning Loop for continuous optimization.
 * Implements SONA-inspired micro-learning and EWC++ for catastrophic forgetting prevention.
 */
export class LearningLoop {
  private readonly queryOptimizer: QueryOptimizer;
  private readonly indexTuner: IndexTuner;
  private readonly patternRecognizer: PatternRecognizer;
  private readonly config: LearningConfig;
  private readonly ewcState: EWCState;
  private learningStats: LearningStats;
  private isRunning: boolean = false;
  private backgroundInterval?: ReturnType<typeof setInterval>;

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

    this.queryOptimizer = new QueryOptimizer(this.config);
    this.indexTuner = new IndexTuner();
    this.patternRecognizer = new PatternRecognizer(this.config);

    this.ewcState = {
      fisherDiagonal: new Map(),
      previousParams: new Map(),
      consolidationCount: 0,
      lastConsolidation: new Date(),
      protectedPatterns: new Set(),
    };

    this.learningStats = this.initializeStats();
  }

  /**
   * Start the learning loop.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    if (this.config.enableBackgroundLearning) {
      this.backgroundInterval = setInterval(
        () => this.backgroundLearningCycle(),
        this.config.backgroundLearningIntervalMs
      );
    }
  }

  /**
   * Stop the learning loop.
   */
  stop(): void {
    this.isRunning = false;

    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = undefined;
    }
  }

  /**
   * Process a query for micro-learning (<0.1ms adaptation).
   */
  microLearn(query: string, duration: number, rows: number): void {
    if (!this.config.enableMicroLearning) return;

    const startTime = performance.now();

    // Record stats
    this.queryOptimizer.recordQueryStats(query, duration, rows);

    // Fast pattern update
    const fingerprint = this.generateFingerprint(query);
    this.indexTuner.recordQuery({
      fingerprint,
      sql: query,
      timestamp: new Date(),
      durationMs: duration,
      rowCount: rows,
      success: true,
    });

    // Update learning stats
    const learningTime = performance.now() - startTime;
    this.updateLearningStats('micro', learningTime);
  }

  /**
   * Run background learning cycle for pattern consolidation.
   */
  backgroundLearningCycle(): void {
    if (!this.isRunning) return;

    const startTime = performance.now();

    // Analyze workload patterns
    const workload = this.indexTuner.analyzeWorkload();

    // Detect patterns
    const patterns = this.patternRecognizer.detectPatterns();

    // Check for anomalies
    const recentQueries = Array.from(this.queryOptimizer.getQueryStats() as QueryExecutionStats[])
      .map(s => s.sql);
    this.patternRecognizer.detectAnomalies(recentQueries);

    // EWC++ consolidation
    if (this.config.enableEWC) {
      this.ewcConsolidate(patterns);
    }

    // Update learning stats
    const learningTime = performance.now() - startTime;
    this.updateLearningStats('background', learningTime);
  }

  /**
   * EWC++ consolidation to prevent catastrophic forgetting.
   */
  ewcConsolidate(patterns: Pattern[]): void {
    const now = new Date();

    // Calculate Fisher information for important patterns
    for (const pattern of patterns) {
      if (pattern.confidence > 0.8 && pattern.occurrences > 100) {
        // Protect high-confidence, frequent patterns
        this.ewcState.protectedPatterns.add(pattern.id);

        // Update Fisher diagonal (importance weight)
        const currentFisher = this.ewcState.fisherDiagonal.get(pattern.id) || 0;
        const newFisher = currentFisher + pattern.confidence * pattern.occurrences;
        (this.ewcState.fisherDiagonal as Map<string, number>).set(pattern.id, newFisher);

        // Store current parameters
        (this.ewcState.previousParams as Map<string, number>).set(
          pattern.id,
          pattern.performance.percentiles.p50
        );
      }
    }

    // Update consolidation state
    (this.ewcState as { consolidationCount: number }).consolidationCount++;
    (this.ewcState as { lastConsolidation: Date }).lastConsolidation = now;

    this.learningStats = {
      ...this.learningStats,
      ewcConsolidations: this.learningStats.ewcConsolidations + 1,
    };
  }

  /**
   * Get query optimizer instance.
   */
  getQueryOptimizer(): QueryOptimizer {
    return this.queryOptimizer;
  }

  /**
   * Get index tuner instance.
   */
  getIndexTuner(): IndexTuner {
    return this.indexTuner;
  }

  /**
   * Get pattern recognizer instance.
   */
  getPatternRecognizer(): PatternRecognizer {
    return this.patternRecognizer;
  }

  /**
   * Get learning statistics.
   */
  getStats(): LearningStats {
    return { ...this.learningStats };
  }

  /**
   * Get EWC state.
   */
  getEWCState(): EWCState {
    return {
      fisherDiagonal: new Map(this.ewcState.fisherDiagonal),
      previousParams: new Map(this.ewcState.previousParams),
      consolidationCount: this.ewcState.consolidationCount,
      lastConsolidation: this.ewcState.lastConsolidation,
      protectedPatterns: new Set(this.ewcState.protectedPatterns),
    };
  }

  /**
   * Check if learning loop is running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Reset learning state.
   */
  reset(): void {
    this.stop();
    this.patternRecognizer.clearPatterns();
    this.queryOptimizer.clearCache();
    (this.ewcState.fisherDiagonal as Map<string, number>).clear();
    (this.ewcState.previousParams as Map<string, number>).clear();
    (this.ewcState as { consolidationCount: number }).consolidationCount = 0;
    (this.ewcState.protectedPatterns as Set<string>).clear();
    this.learningStats = this.initializeStats();
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

  private initializeStats(): LearningStats {
    return {
      totalPatterns: 0,
      activePatterns: 0,
      expiredPatterns: 0,
      microLearningEvents: 0,
      backgroundLearningCycles: 0,
      ewcConsolidations: 0,
      avgLearningTimeMs: 0,
      memoryUsageBytes: 0,
      lastLearningTimestamp: new Date(),
    };
  }

  private updateLearningStats(type: 'micro' | 'background', duration: number): void {
    const patterns = this.patternRecognizer.getAllPatterns();

    this.learningStats = {
      totalPatterns: patterns.length,
      activePatterns: patterns.filter(p => p.confidence > 0.5).length,
      expiredPatterns: this.learningStats.expiredPatterns,
      microLearningEvents: this.learningStats.microLearningEvents + (type === 'micro' ? 1 : 0),
      backgroundLearningCycles: this.learningStats.backgroundLearningCycles + (type === 'background' ? 1 : 0),
      ewcConsolidations: this.learningStats.ewcConsolidations,
      avgLearningTimeMs: this.calculateRunningAverage(
        this.learningStats.avgLearningTimeMs,
        duration,
        this.learningStats.microLearningEvents + this.learningStats.backgroundLearningCycles
      ),
      memoryUsageBytes: this.estimateMemoryUsage(),
      lastLearningTimestamp: new Date(),
    };
  }

  private calculateRunningAverage(currentAvg: number, newValue: number, count: number): number {
    if (count === 0) return newValue;
    return (currentAvg * count + newValue) / (count + 1);
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    const patterns = this.patternRecognizer.getAllPatterns();
    const patternBytes = patterns.length * 500; // ~500 bytes per pattern
    const queryStatsBytes = (this.queryOptimizer.getQueryStats() as QueryExecutionStats[]).length * 200;
    const ewcBytes = this.ewcState.fisherDiagonal.size * 32;

    return patternBytes + queryStatsBytes + ewcBytes;
  }
}


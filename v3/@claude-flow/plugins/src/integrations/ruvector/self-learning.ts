/**
 * RuVector Self-Learning Optimization Module
 *
 * SONA-inspired self-learning features for the RuVector PostgreSQL Bridge.
 * Implements adaptive query optimization, intelligent index tuning,
 * pattern recognition, and continuous learning with EWC++ protection.
 *
 * @module @claude-flow/plugins/integrations/ruvector/self-learning
 * @version 1.0.0
 */


// This file is now a thin barrel + factory surface: the self-learning
// module was split into the five sub-modules below during the P3.42
// god-file decomposition (W163). Kept as self-learning.ts so './self-
// learning.js' importers keep resolving byte-identically. Layering:
// self-learning-types <- optimizer / tuner / recognizer <- loop.
export * from './self-learning-types.js';
export * from './self-learning-optimizer.js';
export * from './self-learning-tuner.js';
export * from './self-learning-recognizer.js';
export * from './self-learning-loop.js';

import { QueryOptimizer } from './self-learning-optimizer.js';
import { IndexTuner } from './self-learning-tuner.js';
import { PatternRecognizer } from './self-learning-recognizer.js';
import { LearningLoop } from './self-learning-loop.js';
import type { LearningConfig } from './self-learning-types.js';

// ============================================================================
// Factory and Exports
// ============================================================================

/**
 * Create a complete self-learning system.
 */
export function createSelfLearningSystem(config?: Partial<LearningConfig>): {
  learningLoop: LearningLoop;
  queryOptimizer: QueryOptimizer;
  indexTuner: IndexTuner;
  patternRecognizer: PatternRecognizer;
} {
  const learningLoop = new LearningLoop(config);

  return {
    learningLoop,
    queryOptimizer: learningLoop.getQueryOptimizer(),
    indexTuner: learningLoop.getIndexTuner(),
    patternRecognizer: learningLoop.getPatternRecognizer(),
  };
}

/**
 * Default configuration for production use.
 */
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
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
};

/**
 * High-performance configuration (less learning, more speed).
 */
export const HIGH_PERF_LEARNING_CONFIG: LearningConfig = {
  enableMicroLearning: false,
  microLearningThresholdMs: 0,
  enableBackgroundLearning: true,
  backgroundLearningIntervalMs: 300000, // 5 minutes
  enableEWC: false,
  ewcLambda: 0,
  maxPatterns: 1000,
  patternExpiryMs: 3600000, // 1 hour
  learningRate: 0.001,
  momentum: 0.5,
};

/**
 * High-accuracy configuration (more learning, potentially slower).
 */
export const HIGH_ACCURACY_LEARNING_CONFIG: LearningConfig = {
  enableMicroLearning: true,
  microLearningThresholdMs: 0.05,
  enableBackgroundLearning: true,
  backgroundLearningIntervalMs: 30000, // 30 seconds
  enableEWC: true,
  ewcLambda: 0.8,
  maxPatterns: 50000,
  patternExpiryMs: 604800000, // 7 days
  learningRate: 0.05,
  momentum: 0.95,
};

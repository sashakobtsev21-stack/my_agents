/**
 * Type definitions + default config for the RuVector intelligence
 * pipeline (SONA + ReasoningBank). Pure types and one config constant.
 *
 * Extracted from intelligence.ts (W104, P3.11 cut #1).
 */

export interface SonaConfig {
  instantLoopEnabled: boolean;
  backgroundLoopEnabled: boolean;
  loraLearningRate: number;
  loraRank: number;
  ewcLambda: number;
  maxTrajectorySize: number;
  patternThreshold: number;
  maxSignals: number;
  maxPatterns: number;
}

export interface TrajectoryStep {
  type: 'observation' | 'thought' | 'action' | 'result';
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface Pattern {
  id: string;
  type: string;
  embedding: number[];
  content: string;
  confidence: number;
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface IntelligenceStats {
  sonaEnabled: boolean;
  reasoningBankSize: number;
  patternsLearned: number;
  signalsProcessed: number;
  trajectoriesRecorded: number;
  lastAdaptation: number | null;
  avgAdaptationTime: number;
}

export interface Signal {
  type: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface StoredPattern {
  id: string;
  type: string;
  embedding: number[];
  content: string;
  confidence: number;
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_SONA_CONFIG: SonaConfig = {
  instantLoopEnabled: true,
  backgroundLoopEnabled: false,
  loraLearningRate: 0.001,
  loraRank: 8,
  ewcLambda: 0.4,
  maxTrajectorySize: 100,
  patternThreshold: 0.7,
  maxSignals: 10000,
  maxPatterns: 5000
};

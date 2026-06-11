/**
 * SONA Manager — mode configuration & optimization tables
 *
 * MODE_CONFIGS and MODE_OPTIMIZATIONS. Extracted verbatim from
 * sona-manager.ts (lines 47-158) during campaign-2 wave 26 (W232).
 * Module-private pre-split; consumed by the manager + the two public
 * lookup helpers, NOT re-exported.
 */

import type {
  ModeOptimizations,
  SONAMode,
  SONAModeConfig,
} from './types.js';

export const MODE_CONFIGS: Record<SONAMode, SONAModeConfig> = {
  'real-time': {
    mode: 'real-time',
    loraRank: 2,
    learningRate: 0.001,
    batchSize: 32,
    trajectoryCapacity: 1000,
    patternClusters: 25,
    qualityThreshold: 0.7,
    maxLatencyMs: 0.5,
    memoryBudgetMb: 25,
    ewcLambda: 2000,
  },
  'balanced': {
    mode: 'balanced',
    loraRank: 4,
    learningRate: 0.002,
    batchSize: 32,
    trajectoryCapacity: 3000,
    patternClusters: 50,
    qualityThreshold: 0.5,
    maxLatencyMs: 18,
    memoryBudgetMb: 50,
    ewcLambda: 2000,
  },
  'research': {
    mode: 'research',
    loraRank: 16,
    learningRate: 0.002,
    batchSize: 64,
    trajectoryCapacity: 10000,
    patternClusters: 100,
    qualityThreshold: 0.2,
    maxLatencyMs: 100,
    memoryBudgetMb: 100,
    ewcLambda: 2500,
  },
  'edge': {
    mode: 'edge',
    loraRank: 1,
    learningRate: 0.001,
    batchSize: 16,
    trajectoryCapacity: 200,
    patternClusters: 15,
    qualityThreshold: 0.8,
    maxLatencyMs: 1,
    memoryBudgetMb: 5,
    ewcLambda: 1500,
  },
  'batch': {
    mode: 'batch',
    loraRank: 8,
    learningRate: 0.002,
    batchSize: 128,
    trajectoryCapacity: 5000,
    patternClusters: 75,
    qualityThreshold: 0.4,
    maxLatencyMs: 50,
    memoryBudgetMb: 75,
    ewcLambda: 2000,
  },
};

/**
 * Mode-specific optimizations
 */
export const MODE_OPTIMIZATIONS: Record<SONAMode, ModeOptimizations> = {
  'real-time': {
    enableSIMD: true,
    useMicroLoRA: true,
    gradientCheckpointing: false,
    useHalfPrecision: true,
    patternCaching: true,
    asyncUpdates: true,
  },
  'balanced': {
    enableSIMD: true,
    useMicroLoRA: false,
    gradientCheckpointing: false,
    useHalfPrecision: false,
    patternCaching: true,
    asyncUpdates: false,
  },
  'research': {
    enableSIMD: true,
    useMicroLoRA: false,
    gradientCheckpointing: true,
    useHalfPrecision: false,
    patternCaching: true,
    asyncUpdates: false,
  },
  'edge': {
    enableSIMD: false,
    useMicroLoRA: true,
    gradientCheckpointing: false,
    useHalfPrecision: true,
    patternCaching: false,
    asyncUpdates: true,
  },
  'batch': {
    enableSIMD: true,
    useMicroLoRA: false,
    gradientCheckpointing: true,
    useHalfPrecision: true,
    patternCaching: true,
    asyncUpdates: true,
  },
};

/**
 * SONA Manager - Main orchestrator for neural learning
 */

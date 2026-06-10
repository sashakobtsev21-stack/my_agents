/**
 * Neural MCP Tools for CLI
 *
 * V2 Compatibility - Neural network and ML tools
 *
 * ✅ HYBRID Implementation:
 * - Uses @claude-flow/embeddings for REAL ML embeddings when available
 * - Falls back to deterministic hash-based embeddings when ML model not installed
 * - Pattern storage and search with cosine similarity (real math in all tiers)
 * - Training stores patterns as searchable embeddings (not simulated)
 *
 * Note: For production neural features, use @claude-flow/neural module
 */

// This file is now a thin registrar: it assembles neuralTools[] from the
// tool objects + helpers extracted into the ./neural-tools/ directory
// during the P3.21 god-file decomposition (W137-W138). Sub-modules:
//   helpers · tools
import { type MCPTool } from './types.js';
import {
  neuralTrain, neuralPredict, neuralPatterns,
  neuralCompress, neuralStatus, neuralOptimize,
} from './neural-tools/tools.js';
// Re-export the embedding-service name + store stats helper for callers
// that read them from this module.
export { getNeuralStoreStats, storeNeuralPatterns } from './neural-tools/helpers.js';

export const neuralTools: MCPTool[] = [
  neuralTrain,
  neuralPredict,
  neuralPatterns,
  neuralCompress,
  neuralStatus,
  neuralOptimize,
];

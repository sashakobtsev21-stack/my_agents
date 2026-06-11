/**
 * Prime Radiant Plugin - Engine Interfaces
 *
 * Interfaces for the 6 mathematical engines:
 * - ICohomologyEngine: Sheaf Laplacian for coherence detection
 * - ISpectralEngine: Stability and eigenvalue analysis
 * - ICausalEngine: Do-calculus causal inference
 * - IQuantumEngine: Quantum topology operations
 * - ICategoryEngine: Category theory functors/morphisms
 * - IHottEngine: Homotopy Type Theory proofs
 *
 * @module prime-radiant/interfaces
 * @version 0.1.3
 */

import type {
  CoherenceCheckResult,
  SpectralAnalysisResult,
  SpectralAnalysisType,
  CausalInferenceResult,
  CausalGraph,
  TopologyResult,
  MorphismResult,
  HottProofResult,
  ConsensusResult,
  AgentState,
  MemoryEntry,
  MemoryCoherenceValidation,
  PrimeRadiantConfig,
  CoherenceThresholds,
} from './types.js';

// Split into ./interfaces-core.ts + ./interfaces-extended.ts during campaign-2 wave W305.
export * from './interfaces-core.js';
export * from './interfaces-extended.js';

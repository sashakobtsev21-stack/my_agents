/**
 * Prime Radiant types — extended
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import type {
  CausalGraph,
  Path,
  TypedValue,
} from './types-core.js';

export interface IHottEngine {
  checkPathEquivalence(path1: Path, path2: Path): Promise<boolean>;
  transportAlong(path: Path, value: TypedValue): Promise<TypedValue>;
  verifyProof(proposition: string, proof: string): Promise<boolean>;
  inferType(term: string): Promise<string>;
  normalize(term: string): Promise<string>;
}

// ============================================================================
// WASM Bridge Types
// ============================================================================

/**
 * WASM Module interface matching prime-radiant-advanced-wasm
 */
export interface WasmModule {
  // Cohomology functions
  cohomology_compute_energy(vectors: Float32Array, dims: Uint32Array): number;
  cohomology_detect_contradictions(vectors: Float32Array, dims: Uint32Array): Uint8Array;

  // Spectral functions
  spectral_compute_eigenvalues(matrix: Float32Array, n: number): Float32Array;
  spectral_compute_gap(eigenvalues: Float32Array): number;
  spectral_stability_index(eigenvalues: Float32Array): number;

  // Causal functions
  causal_estimate_effect(treatment: number, outcome: number, adjMatrix: Float32Array, n: number): number;
  causal_find_confounders(treatment: number, outcome: number, adjMatrix: Float32Array, n: number): Uint32Array;
  causal_backdoor_paths(treatment: number, outcome: number, adjMatrix: Float32Array, n: number): Uint32Array;

  // Quantum topology functions
  quantum_betti_numbers(points: Float32Array, n: number, dim: number, maxDim: number): Uint32Array;
  quantum_persistence_diagram(points: Float32Array, n: number, dim: number): Float32Array;
  quantum_homology_classes(points: Float32Array, n: number, dim: number, targetDim: number): number;

  // Category theory functions
  category_apply_morphism(sourcePtr: number, morphismId: number): number;
  category_compose(morphismAId: number, morphismBId: number): number;
  category_is_natural(morphismId: number): boolean;

  // HoTT functions
  hott_verify_proof(propositionPtr: number, proofPtr: number): boolean;
  hott_infer_type(termPtr: number): number;
  hott_normalize(termPtr: number): number;
  hott_path_equivalent(path1Ptr: number, path2Ptr: number): boolean;
  hott_transport(pathPtr: number, valuePtr: number): number;

  // Memory management
  alloc(size: number): number;
  dealloc(ptr: number, size: number): void;
  memory: WebAssembly.Memory;
}

/**
 * Configuration for WASM bridge initialization
 */
export interface WasmBridgeConfig {
  wasmPath?: string;
  enableLogging?: boolean;
  cacheSize?: number;
}

/**
 * Status of WASM initialization
 */
export interface WasmStatus {
  initialized: boolean;
  loadTime?: number;
  bundleSize?: number;
  engines: {
    cohomology: boolean;
    spectral: boolean;
    causal: boolean;
    quantum: boolean;
    category: boolean;
    hott: boolean;
  };
}

// ============================================================================
// Additional Types for Plugin Integration
// ============================================================================

/**
 * Coherence check result (simplified alias for compatibility)
 */
export interface CoherenceCheckResult {
  coherent: boolean;
  energy: number;
  violations: string[];
  confidence: number;
}

/**
 * Coherence validation result with action
 */
export interface CoherenceValidationResult {
  action: CoherenceAction;
  coherenceResult: CoherenceCheckResult;
  interpretation: string;
}

/**
 * Coherence thresholds configuration
 */
export interface CoherenceThresholds {
  reject: number;
  warn: number;
  allow: number;
}

/**
 * Validation action based on coherence check
 */
export type CoherenceAction = 'allow' | 'warn' | 'reject';

/**
 * Spectral analysis result (simplified)
 */
export interface SpectralAnalysisResult {
  stable: boolean;
  eigenvalues: number[];
  spectralGap: number;
  stabilityIndex: number;
}

/**
 * Type of spectral analysis
 */
export type SpectralAnalysisType = 'stability' | 'clustering' | 'connectivity';

/**
 * Stability index type alias
 */
export type StabilityIndex = number;

/**
 * Causal inference result (simplified)
 */
export interface CausalInferenceResult {
  effect: number;
  confounders: string[];
  interventionValid: boolean;
  backdoorPaths: string[];
}

/**
 * Causal query parameters
 */
export interface CausalQuery {
  treatment: string;
  outcome: string;
  graph: CausalGraph;
}

/**
 * Betti interpretation strings
 */
export interface BettiInterpretation {
  b0: string;
  b1: string;
  b2: string;
}

/**
 * HoTT proof result (simplified)
 */
export interface HottProofResult {
  valid: boolean;
  type: string;
  normalForm: string;
}

/**
 * HoTT verification input
 */
export interface HottVerification {
  proposition: string;
  proof: string;
}

/**
 * Functor application context
 */
export interface FunctorContext {
  source: unknown;
  target: unknown;
  morphism: string;
}

// ============================================================================
// Consensus Types (Multi-Agent Verification)
// ============================================================================

/**
 * Agent state for consensus verification
 */
export interface AgentState {
  agentId: string;
  embedding: number[];
  vote?: string | boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Consensus result from mathematical verification
 */
export interface ConsensusResult {
  consensusAchieved: boolean;
  agreementRatio: number;
  coherenceEnergy: number;
  spectralStability: boolean;
  spectralGap: number;
  violations: string[];
  recommendation: string;
}

/**
 * Consensus verification parameters
 */
export interface ConsensusParams {
  agentStates: AgentState[];
  consensusThreshold?: number;
}

// ============================================================================
// Memory Types (Integration with @claude-flow/memory)
// ============================================================================

/**
 * Memory entry for coherence validation
 */
export interface MemoryEntry {
  key: string;
  content: string;
  embedding: Float32Array;
  metadata?: Record<string, unknown>;
}

/**
 * Memory coherence gate validation result
 */
export interface MemoryCoherenceValidation {
  entry: MemoryEntry;
  existingContext?: MemoryEntry[];
  coherenceResult: CoherenceCheckResult;
  action: CoherenceAction;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Plugin configuration options
 */
export interface PrimeRadiantConfig {
  coherence: {
    warnThreshold: number;
    rejectThreshold: number;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  spectral: {
    stabilityThreshold: number;
    maxMatrixSize: number;
  };
  causal: {
    maxBackdoorPaths: number;
    confidenceThreshold: number;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: PrimeRadiantConfig = {
  coherence: {
    warnThreshold: 0.3,
    rejectThreshold: 0.7,
    cacheEnabled: true,
    cacheTTL: 60000,
  },
  spectral: {
    stabilityThreshold: 0.1,
    maxMatrixSize: 1000,
  },
  causal: {
    maxBackdoorPaths: 10,
    confidenceThreshold: 0.8,
  },
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Prime Radiant specific error codes
 */
export const PrimeRadiantErrorCodes = {
  WASM_NOT_INITIALIZED: 'PR_WASM_NOT_INITIALIZED',
  COHERENCE_VIOLATION: 'PR_COHERENCE_VIOLATION',
  INVALID_VECTORS: 'PR_INVALID_VECTORS',
  INVALID_CAUSAL_GRAPH: 'PR_INVALID_CAUSAL_GRAPH',
  MATRIX_SIZE_EXCEEDED: 'PR_MATRIX_SIZE_EXCEEDED',
  ENGINE_NOT_AVAILABLE: 'PR_ENGINE_NOT_AVAILABLE',
} as const;

export type PrimeRadiantErrorCode =
  (typeof PrimeRadiantErrorCodes)[keyof typeof PrimeRadiantErrorCodes];

/**
 * Prime Radiant interfaces — core
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
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

// ============================================================================
// Core WASM Bridge Interface
// ============================================================================

/**
 * Interface for the Prime Radiant WASM bridge
 * Manages the 92KB WASM bundle and engine instances
 */
export interface IPrimeRadiantBridge {
  /**
   * Initialize the WASM module and create engine instances
   * @throws Error if WASM fails to load
   */
  initialize(): Promise<void>;

  /**
   * Check if the bridge is initialized
   */
  isInitialized(): boolean;

  /**
   * Dispose of WASM resources
   */
  dispose(): Promise<void>;

  /**
   * Check coherence using Sheaf Laplacian
   * @param vectors Array of embedding vectors to check
   * @returns Coherence check result with energy and violations
   */
  checkCoherence(vectors: Float32Array[]): Promise<CoherenceCheckResult>;

  /**
   * Analyze spectral stability of a system
   * @param adjacencyMatrix Flattened adjacency matrix
   * @returns Spectral analysis result with eigenvalues and stability metrics
   */
  analyzeSpectral(adjacencyMatrix: Float32Array): Promise<SpectralAnalysisResult>;

  /**
   * Perform causal inference using do-calculus
   * @param treatment Treatment/intervention variable
   * @param outcome Outcome variable
   * @param graph Causal graph structure
   * @returns Causal inference result with effect and confounders
   */
  inferCausal(
    treatment: string,
    outcome: string,
    graph: CausalGraph
  ): Promise<CausalInferenceResult>;

  /**
   * Compute quantum topology features
   * @param points Point cloud data
   * @param dimension Maximum homology dimension
   * @returns Topology result with Betti numbers and persistence diagram
   */
  computeTopology(points: Float32Array[], dimension: number): Promise<TopologyResult>;

  /**
   * Apply category theory morphism
   * @param source Source object
   * @param target Target object
   * @param morphism Morphism specification
   * @returns Morphism application result
   */
  applyMorphism(source: unknown, target: unknown, morphism: string): Promise<MorphismResult>;

  /**
   * Verify HoTT type proof
   * @param proposition The proposition to prove
   * @param proof The proof term
   * @returns Proof verification result
   */
  verifyTypeProof(proposition: string, proof: string): Promise<HottProofResult>;
}

// ============================================================================
// Individual Engine Interfaces
// ============================================================================

/**
 * Cohomology Engine Interface
 * Provides Sheaf Laplacian coherence detection
 */
export interface ICohomologyEngine {
  /**
   * Compute Sheaf Laplacian energy for a set of vectors
   * @param vectors Array of embedding vectors
   * @returns Energy value in [0, 1] where 0 = coherent, 1 = contradictory
   */
  computeSheafLaplacianEnergy(vectors: Float32Array[]): number;

  /**
   * Detect contradictions in a set of vectors
   * @param vectors Array of embedding vectors
   * @returns List of detected contradiction descriptions
   */
  detectContradictions(vectors: Float32Array[]): string[];

  /**
   * Compute pairwise coherence scores
   * @param vectors Array of embedding vectors
   * @returns Matrix of pairwise coherence scores
   */
  computePairwiseCoherence?(vectors: Float32Array[]): Float32Array;
}

/**
 * Spectral Engine Interface
 * Provides stability and spectral analysis
 */
export interface ISpectralEngine {
  /**
   * Compute eigenvalues of an adjacency matrix
   * @param adjacencyMatrix Flattened square adjacency matrix
   * @returns Array of eigenvalues (sorted descending)
   */
  computeEigenvalues(adjacencyMatrix: Float32Array): Float32Array;

  /**
   * Compute the spectral gap (difference between first and second eigenvalues)
   * @param eigenvalues Array of eigenvalues
   * @returns Spectral gap value
   */
  computeSpectralGap(eigenvalues: Float32Array): number;

  /**
   * Compute overall stability index
   * @param eigenvalues Array of eigenvalues
   * @returns Stability index in [0, 1]
   */
  computeStabilityIndex(eigenvalues: Float32Array): number;

  /**
   * Perform spectral clustering analysis
   * @param adjacencyMatrix Flattened adjacency matrix
   * @param k Number of clusters
   * @returns Cluster assignments
   */
  spectralClustering?(adjacencyMatrix: Float32Array, k: number): number[];
}

/**
 * Causal Engine Interface
 * Provides do-calculus causal inference
 */
export interface ICausalEngine {
  /**
   * Estimate causal effect of treatment on outcome
   * @param treatment Treatment variable name
   * @param outcome Outcome variable name
   * @param graph Causal graph structure
   * @returns Estimated causal effect
   */
  estimateEffect(treatment: string, outcome: string, graph: CausalGraph): number;

  /**
   * Identify confounding variables
   * @param treatment Treatment variable
   * @param outcome Outcome variable
   * @param graph Causal graph
   * @returns List of confounder variable names
   */
  identifyConfounders(treatment: string, outcome: string, graph: CausalGraph): string[];

  /**
   * Find backdoor paths between treatment and outcome
   * @param treatment Treatment variable
   * @param outcome Outcome variable
   * @param graph Causal graph
   * @returns List of backdoor path descriptions
   */
  findBackdoorPaths(treatment: string, outcome: string, graph: CausalGraph): string[];

  /**
   * Validate if intervention is valid for causal inference
   * @param treatment Treatment variable
   * @param graph Causal graph
   * @returns Whether intervention is valid
   */
  validateIntervention(treatment: string, graph: CausalGraph): boolean;

  /**
   * Apply do-operator to compute interventional distribution
   * @param treatment Treatment variable
   * @param value Intervention value
   * @param graph Causal graph
   * @returns Interventional distribution parameters
   */
  doOperator?(treatment: string, value: unknown, graph: CausalGraph): unknown;
}

/**
 * Quantum Engine Interface
 * Provides quantum topology operations
 */
export interface IQuantumEngine {
  /**
   * Compute Betti numbers for a point cloud
   * @param points Point cloud data
   * @param maxDimension Maximum homology dimension
   * @returns Array of Betti numbers [b0, b1, b2, ...]
   */
  computeBettiNumbers(points: Float32Array[], maxDimension: number): Uint32Array;

  /**
   * Compute persistence diagram
   * @param points Point cloud data
   * @returns Array of [birth, death] pairs
   */
  computePersistenceDiagram(points: Float32Array[]): Array<[number, number]>;

  /**
   * Count total homology classes
   * @param points Point cloud data
   * @param dimension Homology dimension
   * @returns Number of homology classes
   */
  countHomologyClasses(points: Float32Array[], dimension: number): number;

  /**
   * Compute Wasserstein distance between persistence diagrams
   * @param diagram1 First persistence diagram
   * @param diagram2 Second persistence diagram
   * @returns Wasserstein distance
   */
  wassersteinDistance?(
    diagram1: Array<[number, number]>,
    diagram2: Array<[number, number]>
  ): number;
}

/**
 * Category Engine Interface
 * Provides category theory operations
 */
export interface ICategoryEngine {
  /**
   * Validate if a morphism is well-defined
   * @param source Source object
   * @param target Target object
   * @param morphism Morphism specification
   * @returns Whether morphism is valid
   */
  validateMorphism(source: unknown, target: unknown, morphism: string): boolean;

  /**
   * Apply a morphism to transform source
   * @param source Source object
   * @param morphism Morphism specification
   * @returns Transformed object
   */
  applyMorphism(source: unknown, morphism: string): unknown;

  /**
   * Check if morphism is a natural transformation
   * @param morphism Morphism specification
   * @returns Whether it's a natural transformation
   */
  isNaturalTransformation(morphism: string): boolean;

  /**
   * Compose two morphisms
   * @param f First morphism
   * @param g Second morphism
   * @returns Composed morphism
   */
  compose?(f: string, g: string): string;

  /**
   * Check if morphism is an isomorphism
   * @param morphism Morphism specification
   * @returns Whether it's an isomorphism
   */
  isIsomorphism?(morphism: string): boolean;
}

/**
 * HoTT Engine Interface
 * Provides Homotopy Type Theory operations
 */
export interface IHottEngine {
  /**
   * Verify a proof term against a proposition
   * @param proposition Type/proposition to prove
   * @param proof Proof term
   * @returns Whether proof is valid
   */
  verifyProof(proposition: string, proof: string): boolean;

  /**
   * Infer the type of a term
   * @param term Term to type-check
   * @returns Inferred type string
   */
  inferType(term: string): string;

  /**
   * Normalize a term to its normal form
   * @param term Term to normalize
   * @returns Normal form string
   */
  normalize(term: string): string;

  /**
   * Check if two types are homotopy equivalent
   * @param type1 First type
   * @param type2 Second type
   * @returns Whether types are equivalent
   */
  areEquivalent?(type1: string, type2: string): boolean;

  /**
   * Compute the path space between two terms
   * @param term1 First term
   * @param term2 Second term
   * @returns Path space description
   */
  pathSpace?(term1: string, term2: string): string;
}

// ============================================================================
// Domain Integration Interfaces
// ============================================================================

/**
 * Coherence Gate Interface
 * Validates memory entries for contradictions before storage
 */

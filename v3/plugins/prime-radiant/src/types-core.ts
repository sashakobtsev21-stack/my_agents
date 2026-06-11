/**
 * Prime Radiant types — core
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */

// ============================================================================
// Value Objects
// ============================================================================

/**
 * Coherence Energy - measures contradiction level using Sheaf Laplacian
 * Range: [0, 1] where 0 = fully coherent, 1 = fully contradictory
 */
export interface CoherenceEnergy {
  readonly value: number;
  readonly coherent: boolean;
  readonly confidence: number;
  readonly level: 'coherent' | 'warning' | 'contradictory';
}

/**
 * Spectral Gap - difference between first and second eigenvalues
 * Positive gap indicates stability
 */
export interface SpectralGap {
  readonly value: number;
  readonly stable: boolean;
  readonly stabilityLevel: 'stable' | 'marginal' | 'unstable';
}

/**
 * Causal Effect - estimated effect of intervention on outcome
 */
export interface CausalEffect {
  readonly value: number;
  readonly confidence: number;
  readonly significant: boolean;
  readonly direction: 'positive' | 'negative' | 'neutral';
}

/**
 * Betti Numbers - topological invariants
 * b0 = connected components, b1 = loops, b2 = voids
 */
export interface BettiNumbers {
  readonly values: number[];
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly connected: boolean;
  readonly hasLoops: boolean;
  readonly hasVoids: boolean;
}

/**
 * Persistence Diagram point - birth and death times
 */
export interface PersistencePoint {
  readonly birth: number;
  readonly death: number;
  readonly persistence: number;
  readonly dimension: number;
}

/**
 * Persistence Diagram - collection of persistence points
 */
export interface PersistenceDiagram {
  readonly points: PersistencePoint[];
  readonly maxPersistence: number;
  readonly totalPersistence: number;
}

// ============================================================================
// Coherence Types
// ============================================================================

/**
 * Result from coherence check using Sheaf Laplacian
 */
export interface CoherenceResult {
  readonly coherent: boolean;
  readonly energy: number;
  readonly violations: string[];
  readonly confidence: number;
}

/**
 * Sheaf structure for coherence computation
 */
export interface Sheaf {
  readonly vertices: number[];
  readonly edges: Array<[number, number]>;
  readonly restrictions: Map<string, Float32Array>;
}

// ============================================================================
// Spectral Types
// ============================================================================

/**
 * Result from spectral stability analysis
 */
export interface SpectralResult {
  readonly stable: boolean;
  readonly eigenvalues: number[];
  readonly spectralGap: number;
  readonly stabilityIndex: number;
}

/**
 * Matrix representation for spectral analysis
 */
export interface Matrix {
  readonly data: number[][] | Float32Array;
  readonly rows: number;
  readonly cols: number;
}

// ============================================================================
// Causal Types
// ============================================================================

/**
 * Causal graph structure
 */
export interface CausalGraph {
  readonly nodes: string[];
  readonly edges: Array<[string, string]>;
}

/**
 * Intervention in causal inference
 */
export interface Intervention {
  readonly treatment: string;
  readonly outcome: string;
  readonly graph: CausalGraph;
  readonly observedData?: Map<string, number[]>;
}

/**
 * Result from causal inference
 */
export interface CausalResult {
  readonly effect: number;
  readonly confounders: string[];
  readonly interventionValid: boolean;
  readonly backdoorPaths: string[][];
}

// ============================================================================
// Quantum Topology Types
// ============================================================================

/**
 * Simplicial complex for topological computations
 */
export interface SimplicialComplex {
  readonly vertices: number[];
  readonly simplices: number[][];
  readonly maxDimension: number;
}

/**
 * Filtration for persistent homology
 */
export interface Filtration {
  readonly complex: SimplicialComplex;
  readonly values: number[];
}

/**
 * Result from quantum topology computation
 */
export interface TopologyResult {
  readonly bettiNumbers: number[];
  readonly persistenceDiagram: PersistenceDiagram;
  readonly homologyClasses: number;
}

// ============================================================================
// Category Theory Types
// ============================================================================

/**
 * Morphism in a category
 */
export interface Morphism {
  readonly source: string;
  readonly target: string;
  readonly name: string;
  readonly data?: unknown;
}

/**
 * Result from morphism application
 */
export interface MorphismResult {
  readonly valid: boolean;
  readonly result: unknown;
  readonly naturalTransformation: boolean;
}

/**
 * Functor between categories
 */
export interface Functor {
  readonly name: string;
  readonly sourceCategory: string;
  readonly targetCategory: string;
}

// ============================================================================
// Homotopy Type Theory Types
// ============================================================================

/**
 * Path in HoTT - represents equality/equivalence
 */
export interface Path {
  readonly source: unknown;
  readonly target: unknown;
  readonly type: string;
  readonly proof?: string;
}

/**
 * Value with its type
 */
export interface TypedValue {
  readonly value: unknown;
  readonly type: string;
}

/**
 * Result from HoTT verification
 */
export interface HottResult {
  readonly valid: boolean;
  readonly type: string;
  readonly normalForm: string;
}

// ============================================================================
// Engine Interfaces
// ============================================================================

/**
 * Cohomology Engine interface - Sheaf Laplacian coherence
 */
export interface ICohomologyEngine {
  checkCoherence(vectors: Float32Array[]): Promise<CoherenceResult>;
  computeLaplacianEnergy(sheaf: Sheaf): Promise<number>;
  detectContradictions(vectors: Float32Array[]): Promise<string[]>;
}

/**
 * Spectral Engine interface - stability analysis
 */
export interface ISpectralEngine {
  analyzeStability(matrix: number[][]): Promise<SpectralResult>;
  computeEigenvalues(matrix: number[][] | Float32Array): Promise<number[]>;
  computeSpectralGap(eigenvalues: number[]): number;
  computeStabilityIndex(eigenvalues: number[]): number;
}

/**
 * Causal Engine interface - do-calculus
 */
export interface ICausalEngine {
  infer(intervention: Intervention): Promise<CausalResult>;
  computeDoCalculus(graph: CausalGraph, treatment: string, outcome: string): Promise<CausalEffect>;
  identifyConfounders(graph: CausalGraph, treatment: string, outcome: string): string[];
  findBackdoorPaths(graph: CausalGraph, treatment: string, outcome: string): string[][];
}

/**
 * Quantum Engine interface - topology
 */
export interface IQuantumEngine {
  computeBettiNumbers(complex: SimplicialComplex): Promise<BettiNumbers>;
  persistenceDiagram(filtration: Filtration): Promise<PersistenceDiagram>;
  computeHomologyClasses(complex: SimplicialComplex): Promise<number>;
}

/**
 * Category Engine interface - functors and morphisms
 */
export interface ICategoryEngine {
  applyFunctor(morphism: Morphism): Promise<MorphismResult>;
  compose(f: Morphism, g: Morphism): Promise<Morphism>;
  validateMorphism(source: unknown, target: unknown, morphism: string): boolean;
  isNaturalTransformation(morphism: string): boolean;
}

/**
 * HoTT Engine interface - type theory
 */

/**
 * hyperbolic-reasoning types — core
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';

// ============================================================================
// Hyperbolic Geometry Types
// ============================================================================

/**
 * Point in hyperbolic space (Poincare ball model)
 */
export interface HyperbolicPoint {
  /** Coordinates in the Poincare ball (norm < 1) */
  readonly coordinates: Float32Array;
  /** Curvature parameter (negative) */
  readonly curvature: number;
  /** Dimension of the space */
  readonly dimension: number;
}

/**
 * Hyperbolic model type
 */
export type HyperbolicModel = 'poincare_ball' | 'lorentz' | 'klein' | 'half_plane';

/**
 * Mobius transformation parameters
 */
export interface MobiusTransform {
  /** Translation vector */
  readonly translation: Float32Array;
  /** Rotation matrix (flattened) */
  readonly rotation?: Float32Array;
  /** Scale factor */
  readonly scale: number;
}

// ============================================================================
// Hierarchy Types
// ============================================================================

/**
 * Node in a hierarchy
 */
export interface HierarchyNode {
  /** Unique node identifier */
  readonly id: string;
  /** Parent node ID (null for root) */
  readonly parent: string | null;
  /** Node features for embedding */
  readonly features?: Record<string, unknown>;
  /** Node label/name */
  readonly label?: string;
  /** Depth in tree (0 for root) */
  readonly depth?: number;
}

/**
 * Edge in a hierarchy (for DAGs)
 */
export interface HierarchyEdge {
  /** Source node ID */
  readonly source: string;
  /** Target node ID */
  readonly target: string;
  /** Edge weight */
  readonly weight?: number;
  /** Edge type */
  readonly type?: string;
}

/**
 * Complete hierarchy structure
 */
export interface Hierarchy {
  /** All nodes */
  readonly nodes: ReadonlyArray<HierarchyNode>;
  /** Optional edges (for DAGs) */
  readonly edges?: ReadonlyArray<HierarchyEdge>;
  /** Root node ID */
  readonly root?: string;
}

/**
 * Embedded hierarchy with hyperbolic coordinates
 */
export interface EmbeddedHierarchy {
  /** Node embeddings as id -> HyperbolicPoint */
  readonly embeddings: Map<string, HyperbolicPoint>;
  /** Model parameters */
  readonly model: HyperbolicModel;
  /** Learned or fixed curvature */
  readonly curvature: number;
  /** Embedding dimension */
  readonly dimension: number;
  /** Embedding quality metrics */
  readonly metrics: {
    readonly distortionMean: number;
    readonly distortionMax: number;
    readonly mapScore: number;
  };
}

// ============================================================================
// Taxonomic Reasoning Types
// ============================================================================

/**
 * Taxonomic query type
 */
export type TaxonomicQueryType =
  | 'is_a'
  | 'subsumption'
  | 'lowest_common_ancestor'
  | 'path'
  | 'similarity';

/**
 * Taxonomic query
 */
export interface TaxonomicQuery {
  /** Query type */
  readonly type: TaxonomicQueryType;
  /** Subject concept */
  readonly subject: string;
  /** Object concept (optional for some queries) */
  readonly object?: string;
}

/**
 * Inference configuration
 */
export interface InferenceConfig {
  /** Allow transitive reasoning */
  readonly transitive: boolean;
  /** Enable fuzzy matching */
  readonly fuzzy: boolean;
  /** Confidence threshold */
  readonly confidence: number;
}

/**
 * Taxonomic reasoning result
 */
export interface TaxonomicResult {
  /** Query result (boolean for is_a, etc.) */
  readonly result: boolean | string | string[] | number;
  /** Confidence in the result */
  readonly confidence: number;
  /** Explanation of reasoning path */
  readonly explanation: string;
  /** Intermediate steps if transitive */
  readonly steps?: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
    readonly relation: string;
    readonly confidence: number;
  }>;
}

// ============================================================================
// Semantic Search Types
// ============================================================================

/**
 * Search mode for hierarchical search
 */
export type SearchMode = 'nearest' | 'subtree' | 'ancestors' | 'siblings' | 'cone';

/**
 * Search constraints
 */
export interface SearchConstraints {
  /** Maximum depth from root */
  readonly maxDepth?: number;
  /** Minimum depth from root */
  readonly minDepth?: number;
  /** Restrict to subtree of this node */
  readonly subtreeRoot?: string;
  /** Filter by node type */
  readonly nodeTypes?: ReadonlyArray<string>;
}

/**
 * Search result item
 */
export interface SearchResultItem {
  /** Node ID */
  readonly id: string;
  /** Hyperbolic distance */
  readonly distance: number;
  /** Euclidean similarity (for comparison) */
  readonly similarity?: number;
  /** Node metadata */
  readonly metadata?: Record<string, unknown>;
  /** Path from root */
  readonly path?: ReadonlyArray<string>;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Matching items */
  readonly items: ReadonlyArray<SearchResultItem>;
  /** Total candidates considered */
  readonly totalCandidates: number;
  /** Search time in ms */
  readonly searchTimeMs: number;
}

// ============================================================================
// Hierarchy Comparison Types
// ============================================================================

/**
 * Alignment method for comparing hierarchies
 */
export type AlignmentMethod =
  | 'wasserstein'
  | 'gromov_wasserstein'
  | 'tree_edit'
  | 'subtree_isomorphism';

/**
 * Comparison metric
 */
export type ComparisonMetric =
  | 'structural_similarity'
  | 'semantic_similarity'
  | 'coverage'
  | 'precision';

/**
 * Node alignment pair
 */
export interface NodeAlignment {
  /** Source node ID */
  readonly source: string;
  /** Target node ID */
  readonly target: string;
  /** Alignment confidence */
  readonly confidence: number;
}

/**
 * Hierarchy comparison result
 */
export interface ComparisonResult {
  /** Overall similarity score (0-1) */
  readonly similarity: number;
  /** Node alignments */
  readonly alignments: ReadonlyArray<NodeAlignment>;
  /** Metrics */
  readonly metrics: Record<ComparisonMetric, number>;
  /** Unmatched source nodes */
  readonly unmatchedSource: ReadonlyArray<string>;
  /** Unmatched target nodes */
  readonly unmatchedTarget: ReadonlyArray<string>;
  /** Edit operations for tree edit distance */
  readonly editOperations?: ReadonlyArray<{
    readonly type: 'insert' | 'delete' | 'rename' | 'move';
    readonly node: string;
    readonly cost: number;
  }>;
}

// ============================================================================
// Entailment Graph Types
// ============================================================================

/**
 * Concept for entailment graph
 */
export interface Concept {
  /** Unique concept ID */
  readonly id: string;
  /** Concept text/description */
  readonly text: string;
  /** Concept type/category */
  readonly type?: string;
  /** Pre-computed embedding */
  readonly embedding?: Float32Array;
}

/**
 * Entailment relation
 */
export interface EntailmentRelation {
  /** Premise concept ID */
  readonly premise: string;
  /** Hypothesis concept ID */
  readonly hypothesis: string;
  /** Entailment confidence */
  readonly confidence: number;
  /** Relation type */
  readonly type: 'entails' | 'contradicts' | 'neutral';
}

/**
 * Entailment graph action
 */
export type EntailmentAction = 'build' | 'query' | 'expand' | 'prune';

/**
 * Prune strategy
 */
export type PruneStrategy = 'none' | 'transitive_reduction' | 'confidence_threshold';

/**
 * Entailment graph
 */
export interface EntailmentGraph {
  /** All concepts */
  readonly concepts: ReadonlyArray<Concept>;
  /** Entailment relations */
  readonly relations: ReadonlyArray<EntailmentRelation>;
  /** Whether transitive closure is computed */
  readonly transitiveClosure: boolean;
  /** Graph statistics */
  readonly stats: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly density: number;
    readonly maxDepth: number;
  };
}

/**
 * Entailment query result
 */

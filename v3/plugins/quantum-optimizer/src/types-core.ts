/**
 * quantum-optimizer types — core
 *
 * Extracted verbatim during campaign-2 wave W304. Barrel stays.
 */
import { z } from 'zod';

// ============================================================================
// QUBO Problem Types
// ============================================================================

/**
 * Quadratic Unconstrained Binary Optimization problem
 */
export interface QUBOProblem {
  /** Problem type identifier */
  readonly type: 'qubo' | 'ising' | 'sat' | 'max_cut' | 'tsp' | 'dependency';
  /** Number of binary variables */
  readonly variables: number;
  /** Linear coefficients (diagonal of Q matrix) */
  readonly linear: Float32Array;
  /** Quadratic coefficients (upper triangular of Q matrix, flattened) */
  readonly quadratic: Float32Array;
  /** Optional constraint violations penalty */
  readonly penalty?: number;
}

/**
 * QUBO solution
 */
export interface QUBOSolution {
  /** Binary assignment (0 or 1 for each variable) */
  readonly assignment: Uint8Array;
  /** Energy/cost of the solution */
  readonly energy: number;
  /** Whether this is optimal (or best found) */
  readonly optimal: boolean;
  /** Number of iterations/reads performed */
  readonly iterations: number;
  /** Confidence in optimality */
  readonly confidence: number;
}

// ============================================================================
// Annealing Types
// ============================================================================

/**
 * Temperature schedule for annealing
 */
export interface TemperatureSchedule {
  /** Initial temperature */
  readonly initial: number;
  /** Final temperature */
  readonly final: number;
  /** Schedule type */
  readonly type: 'linear' | 'exponential' | 'logarithmic' | 'adaptive';
}

/**
 * Annealing configuration
 */
export interface AnnealingConfig {
  /** Number of independent runs */
  readonly numReads: number;
  /** Total annealing time (abstract units) */
  readonly annealingTime: number;
  /** Chain strength for embedding */
  readonly chainStrength: number;
  /** Temperature schedule */
  readonly temperature: TemperatureSchedule;
  /** Embedding strategy */
  readonly embedding: 'auto' | 'minor' | 'pegasus' | 'chimera';
}

/**
 * Annealing result
 */
export interface AnnealingResult {
  /** Best solution found */
  readonly solution: QUBOSolution;
  /** All solutions found (sorted by energy) */
  readonly samples: QUBOSolution[];
  /** Energy histogram */
  readonly energyHistogram: Map<number, number>;
  /** Timing information */
  readonly timing: {
    readonly totalMs: number;
    readonly annealingMs: number;
    readonly embeddingMs: number;
  };
}

// ============================================================================
// QAOA Types
// ============================================================================

/**
 * Problem graph for QAOA
 */
export interface ProblemGraph {
  /** Number of nodes */
  readonly nodes: number;
  /** Edges as [source, target] pairs */
  readonly edges: ReadonlyArray<readonly [number, number]>;
  /** Edge weights (optional) */
  readonly weights?: Float32Array;
}

/**
 * QAOA circuit configuration
 */
export interface QAOACircuit {
  /** Circuit depth (p parameter) */
  readonly depth: number;
  /** Classical optimizer */
  readonly optimizer: 'cobyla' | 'bfgs' | 'adam' | 'nelder-mead';
  /** Initial parameter strategy */
  readonly initialParams: 'random' | 'heuristic' | 'transfer' | 'fourier';
  /** Number of measurement shots */
  readonly shots: number;
}

/**
 * QAOA result
 */
export interface QAOAResult {
  /** Best solution found */
  readonly solution: QUBOSolution;
  /** Optimal variational parameters (gamma, beta) */
  readonly parameters: {
    readonly gamma: Float32Array;
    readonly beta: Float32Array;
  };
  /** Approximation ratio (solution / optimal) */
  readonly approximationRatio: number;
  /** Convergence history */
  readonly convergence: Float32Array;
}

// ============================================================================
// Grover Search Types
// ============================================================================

/**
 * Search space configuration
 */
export interface SearchSpace {
  /** Size of search space (N) */
  readonly size: number;
  /** Oracle predicate definition (safe expression) */
  readonly oracle: string;
  /** Structure of search space */
  readonly structure: 'unstructured' | 'database' | 'tree' | 'graph';
}

/**
 * Amplification configuration
 */
export interface AmplificationConfig {
  /** Amplification method */
  readonly method: 'standard' | 'fixed_point' | 'robust';
  /** Boost factor for robust amplification */
  readonly boostFactor?: number;
}

/**
 * Grover search result
 */
export interface GroverResult {
  /** Found solution(s) */
  readonly solutions: Uint8Array[];
  /** Number of oracle queries */
  readonly queries: number;
  /** Theoretical optimal queries (pi/4 * sqrt(N/M)) */
  readonly optimalQueries: number;
  /** Success probability */
  readonly successProbability: number;
}

// ============================================================================
// Dependency Resolution Types
// ============================================================================

/**
 * Package descriptor for dependency resolution
 */
export interface PackageDescriptor {
  /** Package name */
  readonly name: string;
  /** Version string */
  readonly version: string;
  /** Dependencies as name -> version constraint */
  readonly dependencies: Record<string, string>;
  /** Conflicting packages */
  readonly conflicts: ReadonlyArray<string>;
  /** Package size in KB */
  readonly size?: number;
  /** Known vulnerabilities */
  readonly vulnerabilities?: ReadonlyArray<string>;
}

/**
 * Dependency resolution constraints
 */
export interface DependencyConstraints {
  /** Optimization objective */
  readonly minimize: 'versions' | 'size' | 'vulnerabilities' | 'depth';
  /** Existing lockfile constraints */
  readonly lockfile?: Record<string, string>;
  /** Include peer dependencies */
  readonly includePeer: boolean;
  /** Maximum resolution time in ms */
  readonly timeout: number;
}

/**
 * Dependency resolution result
 */
export interface DependencyResult {
  /** Resolved package versions */
  readonly resolved: Record<string, string>;
  /** Installation order */
  readonly order: ReadonlyArray<string>;
  /** Conflicts that were resolved */
  readonly resolvedConflicts: ReadonlyArray<{
    readonly packages: [string, string];
    readonly resolution: string;
  }>;
  /** Total size if calculated */
  readonly totalSize?: number;
  /** Remaining vulnerabilities */
  readonly vulnerabilities?: ReadonlyArray<string>;
}

// ============================================================================
// Schedule Optimization Types
// ============================================================================

/**
 * Task for scheduling
 */
export interface ScheduleTask {
  /** Unique task ID */
  readonly id: string;
  /** Task duration in time units */
  readonly duration: number;
  /** Prerequisite task IDs */
  readonly dependencies: ReadonlyArray<string>;
  /** Required resources */
  readonly resources: ReadonlyArray<string>;
  /** Optional deadline */
  readonly deadline?: number;
  /** Priority (higher = more important) */
  readonly priority?: number;
}

/**
 * Resource for scheduling
 */
export interface ScheduleResource {
  /** Unique resource ID */
  readonly id: string;
  /** Maximum concurrent usage */
  readonly capacity: number;
  /** Cost per time unit */
  readonly cost: number;
  /** Availability windows */
  readonly availability?: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
  }>;
}

/**
 * Schedule optimization objective
 */
export type ScheduleObjective = 'makespan' | 'cost' | 'utilization' | 'weighted';

/**
 * Scheduled task assignment
 */

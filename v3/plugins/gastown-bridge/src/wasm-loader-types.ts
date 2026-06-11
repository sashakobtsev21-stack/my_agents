/**
 * WASM Loader — public types
 *
 * PerformanceTiming, GraphEdge, NodeWeight, CycleDetectionResult.
 * Extracted verbatim from wasm-loader.ts (lines 35-108) during the
 * P3.73 god-file decomposition (W194). wasm-loader.ts re-exports ONLY the four
 * originally-public names; FormulaWasmExports/GnnWasmExports were
 * module-private and stay unexported from the barrel.
 */

// Types
// ============================================================================

/**
 * Performance timing result
 */
export interface PerformanceTiming {
  /** Operation name */
  readonly operation: string;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Whether WASM was used */
  readonly usedWasm: boolean;
  /** Timestamp when operation started */
  readonly startedAt: number;
}

/**
 * WASM module exports for gastown-formula-wasm
 */
export interface FormulaWasmExports {
  /** Initialize the WASM module */
  default?: () => Promise<void>;
  /** Parse TOML content to Formula AST */
  parse_toml: (content: string) => string;
  /** Cook a formula with variable substitution */
  cook_formula: (formulaJson: string, varsJson: string) => string;
  /** Batch cook multiple formulas */
  cook_batch: (formulasJson: string, varsArrayJson: string) => string;
  /** Get WASM version */
  version: () => string;
}

/**
 * WASM module exports for ruvector-gnn-wasm
 */
export interface GnnWasmExports {
  /** Initialize the WASM module */
  default?: () => Promise<void>;
  /** Topological sort of dependency graph */
  topo_sort: (nodesJson: string, edgesJson: string) => string;
  /** Detect cycles in dependency graph */
  detect_cycles: (nodesJson: string, edgesJson: string) => string;
  /** Calculate critical path */
  critical_path: (nodesJson: string, edgesJson: string, weightsJson: string) => string;
  /** Get WASM version */
  version: () => string;
}

/**
 * Graph edge representation
 */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

/**
 * Node weight for critical path calculation
 */
export interface NodeWeight {
  readonly nodeId: string;
  readonly weight: number;
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  readonly hasCycle: boolean;
  readonly cycleNodes: string[];
}

// ============================================================================

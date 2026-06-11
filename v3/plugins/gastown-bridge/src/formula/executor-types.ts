/**
 * Formula Executor — public types
 *
 * IWasmLoader, ExecuteOptions, StepContext, StepResult, Molecule,
 * ExecutionProgress, ExecutorEvents, ExecutorLogger. Extracted verbatim
 * from executor.ts (lines 159-364) during the P3.72 god-file
 * decomposition (W193). executor.ts re-exports everything here (the
 * package index.ts re-exports them onward).
 */

import type {
  CookedFormula,
  Formula,
  FormulaType,
  Step,
} from '../types.js';

// Types
// ============================================================================

/**
 * WASM loader interface for formula operations
 */
export interface IWasmLoader {
  /** Check if WASM is initialized */
  isInitialized(): boolean;

  /** Parse TOML formula content to AST */
  parseFormula(content: string): Formula;

  /** Cook formula with variable substitution */
  cookFormula(formula: Formula, vars: Record<string, string>): CookedFormula;

  /** Batch cook multiple formulas */
  batchCook(formulas: Formula[], varsArray: Record<string, string>[]): CookedFormula[];

  /** Resolve step dependencies (topological sort) */
  resolveStepDependencies(steps: Step[]): Step[];

  /** Detect cycles in step dependencies */
  detectCycle(steps: Step[]): { hasCycle: boolean; cycleSteps?: string[] };
}

/**
 * Execution options
 */
export interface ExecuteOptions {
  /** Target agent for execution */
  targetAgent?: string;

  /** Whether to run in dry-run mode (no actual execution) */
  dryRun?: boolean;

  /** Timeout per step in milliseconds */
  stepTimeout?: number;

  /** Maximum parallel steps */
  maxParallel?: number;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Custom step handler */
  stepHandler?: (step: Step, context: StepContext) => Promise<StepResult>;
}

/**
 * Step execution context
 */
export interface StepContext {
  /** Execution ID */
  executionId: string;

  /** Formula being executed */
  formula: CookedFormula;

  /** Current step index */
  stepIndex: number;

  /** Total steps */
  totalSteps: number;

  /** Variables available to the step */
  variables: Record<string, string>;

  /** Results from previous steps */
  previousResults: Map<string, StepResult>;

  /** Abort signal */
  signal?: AbortSignal;

  /** Execution start time */
  startTime: Date;
}

/**
 * Step execution result
 */
export interface StepResult {
  /** Step ID */
  stepId: string;

  /** Whether step succeeded */
  success: boolean;

  /** Step output data */
  output?: unknown;

  /** Error message if failed */
  error?: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Step metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Molecule - Generated work unit from cooked formula
 */
export interface Molecule {
  /** Unique molecule ID */
  id: string;

  /** Parent formula name */
  formulaName: string;

  /** Molecule title */
  title: string;

  /** Molecule description */
  description: string;

  /** Molecule type (from formula type) */
  type: FormulaType;

  /** Associated step or leg */
  sourceId: string;

  /** Assigned agent */
  agent?: string;

  /** Dependencies (other molecule IDs) */
  dependencies: string[];

  /** Execution order */
  order: number;

  /** Molecule metadata */
  metadata: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  /** Execution ID */
  executionId: string;

  /** Formula name */
  formulaName: string;

  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** Total steps/legs */
  totalSteps: number;

  /** Completed steps */
  completedSteps: number;

  /** Failed steps */
  failedSteps: number;

  /** Current step being executed */
  currentStep?: string;

  /** Start time */
  startTime: Date;

  /** End time (if completed) */
  endTime?: Date;

  /** Step results */
  stepResults: StepResult[];

  /** Error message (if failed) */
  error?: string;

  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * Executor events
 */
export interface ExecutorEvents {
  'execution:start': (executionId: string, formula: CookedFormula) => void;
  'execution:progress': (progress: ExecutionProgress) => void;
  'execution:complete': (executionId: string, results: StepResult[]) => void;
  'execution:error': (executionId: string, error: Error) => void;
  'execution:cancelled': (executionId: string) => void;
  'step:start': (executionId: string, step: Step) => void;
  'step:complete': (executionId: string, result: StepResult) => void;
  'step:error': (executionId: string, stepId: string, error: Error) => void;
  'molecule:created': (molecule: Molecule) => void;
}

/**
 * Logger interface
 */
export interface ExecutorLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

// ============================================================================

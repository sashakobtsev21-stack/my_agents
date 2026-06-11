/**
 * GasTown Bridge MCP Tools — tool types, zod schemas & result types
 *
 * Extracted verbatim from mcp-tools.ts (lines 72-669) during the P3.71
 * god-file decomposition (W192). mcp-tools.ts stays the barrel
 * ('export *'), so './mcp-tools.js' importers resolve byte-identically.
 */

import { z } from 'zod';
import type {
  Bead,
  Convoy,
  ConvoyOptimization,
  CookedFormula,
  DepAction,
  DependencyAction,
  DependencyResolution,
  Formula,
  FormulaAST,
  FormulaType,
  GasTownAgent,
  GasTownMail,
  IBeadsSyncService,
  IDependencyWasm,
  IFormulaWasm,
  IGasTownBridge,
  MailAction,
  PatternMatch,
  SyncDirection,
  TargetAgent,
} from './types.js';

// MCP Tool Types
// ============================================================================

/**
 * MCP Tool definition
 */
export interface MCPTool<TInput = unknown, TOutput = unknown> {
  /** Tool name (e.g., "gt_beads_create") */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: string;
  /** Tool version */
  version: string;
  /** Execution layer (cli, wasm, hybrid) */
  layer: 'cli' | 'wasm' | 'hybrid';
  /** Input schema */
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  /** Handler function */
  handler: (input: TInput, context: ToolContext) => Promise<MCPToolResult<TOutput>>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Key-value store for cross-tool state */
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  /** Bridge instances */
  bridges: {
    gastown: IGasTownBridge;
    beadsSync: IBeadsSyncService;
    formulaWasm: IFormulaWasm;
    dependencyWasm: IDependencyWasm;
  };
  /** Configuration */
  config: {
    townRoot: string;
    allowedRigs: string[];
    maxBeadsLimit: number;
    maskSecrets: boolean;
    enableWasm: boolean;
  };
}

/**
 * MCP Tool result format
 */
export interface MCPToolResult<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  data?: T;
}

// ============================================================================
// Zod Input Schemas
// ============================================================================

// --- Beads Schemas ---

/**
 * Schema for gt_beads_create
 */
export const BeadsCreateInputSchema = z.object({
  /** Bead title */
  title: z.string().min(1).max(500).describe('Bead title'),
  /** Bead description */
  description: z.string().max(10000).optional().describe('Bead description'),
  /** Priority (0 = highest) */
  priority: z.number().int().min(0).max(10).default(2).describe('Priority (0 = highest)'),
  /** Labels for categorization */
  labels: z.array(z.string().max(50)).max(20).optional().describe('Labels for categorization'),
  /** Parent bead ID for epics */
  parent: z.string().max(50).optional().describe('Parent bead ID for epics'),
  /** Rig (repository) to create in */
  rig: z.string().max(100).optional().describe('Rig (repository) to create in'),
});

export type BeadsCreateInput = z.infer<typeof BeadsCreateInputSchema>;

/**
 * Schema for gt_beads_ready
 */
export const BeadsReadyInputSchema = z.object({
  /** Filter by rig */
  rig: z.string().max(100).optional().describe('Filter by rig (repository)'),
  /** Maximum beads to return */
  limit: z.number().int().min(1).max(100).default(10).describe('Maximum beads to return'),
  /** Filter by labels */
  labels: z.array(z.string().max(50)).max(10).optional().describe('Filter by labels'),
});

export type BeadsReadyInput = z.infer<typeof BeadsReadyInputSchema>;

/**
 * Schema for gt_beads_show
 */
export const BeadsShowInputSchema = z.object({
  /** Bead ID to show */
  bead_id: z.string().min(1).max(50).describe('Bead ID to show (e.g., "gt-abc12")'),
});

export type BeadsShowInput = z.infer<typeof BeadsShowInputSchema>;

/**
 * Schema for gt_beads_dep
 */
export const BeadsDepInputSchema = z.object({
  /** Action to perform */
  action: z.enum(['add', 'remove']).describe('Action to perform on dependency'),
  /** Child bead ID (the one that depends) */
  child: z.string().min(1).max(50).describe('Child bead ID (the one that depends)'),
  /** Parent bead ID (the dependency) */
  parent: z.string().min(1).max(50).describe('Parent bead ID (the dependency)'),
});

export type BeadsDepInput = z.infer<typeof BeadsDepInputSchema>;

/**
 * Schema for gt_beads_sync
 */
export const BeadsSyncInputSchema = z.object({
  /** Sync direction */
  direction: z.enum(['pull', 'push', 'both']).default('both').describe('Sync direction'),
  /** Filter by rig */
  rig: z.string().max(100).optional().describe('Filter by rig (repository)'),
  /** AgentDB namespace for sync */
  namespace: z.string().max(100).default('gastown:beads').describe('AgentDB namespace'),
});

export type BeadsSyncInput = z.infer<typeof BeadsSyncInputSchema>;

// --- Convoy Schemas ---

/**
 * Schema for gt_convoy_create
 */
export const ConvoyCreateInputSchema = z.object({
  /** Convoy name */
  name: z.string().min(1).max(200).describe('Convoy name'),
  /** Issue IDs to track */
  issues: z.array(z.string().max(50)).min(1).max(100).describe('Issue IDs to track'),
  /** Convoy description */
  description: z.string().max(5000).optional().describe('Convoy description'),
});

export type ConvoyCreateInput = z.infer<typeof ConvoyCreateInputSchema>;

/**
 * Schema for gt_convoy_status
 */
export const ConvoyStatusInputSchema = z.object({
  /** Convoy ID (optional - shows all if omitted) */
  convoy_id: z.string().max(50).optional().describe('Convoy ID (shows all if omitted)'),
  /** Include detailed progress */
  detailed: z.boolean().default(false).describe('Include detailed progress'),
});

export type ConvoyStatusInput = z.infer<typeof ConvoyStatusInputSchema>;

/**
 * Schema for gt_convoy_track
 */
export const ConvoyTrackInputSchema = z.object({
  /** Convoy ID */
  convoy_id: z.string().min(1).max(50).describe('Convoy ID'),
  /** Action to perform */
  action: z.enum(['add', 'remove']).describe('Action to perform'),
  /** Issue IDs to add/remove */
  issues: z.array(z.string().max(50)).min(1).max(50).describe('Issue IDs to add/remove'),
});

export type ConvoyTrackInput = z.infer<typeof ConvoyTrackInputSchema>;

// --- Formula Schemas ---

/**
 * Schema for gt_formula_list
 */
export const FormulaListInputSchema = z.object({
  /** Filter by formula type */
  type: z.enum(['convoy', 'workflow', 'expansion', 'aspect']).optional()
    .describe('Filter by formula type'),
  /** Include built-in formulas */
  include_builtin: z.boolean().default(true).describe('Include built-in formulas'),
});

export type FormulaListInput = z.infer<typeof FormulaListInputSchema>;

/**
 * Schema for gt_formula_cook
 */
export const FormulaCookInputSchema = z.object({
  /** Formula name or TOML content */
  formula: z.string().min(1).max(50000).describe('Formula name or TOML content'),
  /** Variables for substitution */
  vars: z.record(z.string().max(50), z.string().max(5000)).describe('Variables for substitution'),
  /** Whether formula is TOML content (vs name) */
  is_content: z.boolean().default(false).describe('Whether formula is TOML content (vs name)'),
});

export type FormulaCookInput = z.infer<typeof FormulaCookInputSchema>;

/**
 * Schema for gt_formula_execute
 */
export const FormulaExecuteInputSchema = z.object({
  /** Formula name */
  formula: z.string().min(1).max(200).describe('Formula name'),
  /** Variables for substitution */
  vars: z.record(z.string().max(50), z.string().max(5000)).describe('Variables for substitution'),
  /** Target agent for execution */
  target_agent: z.enum(['polecat', 'crew', 'mayor', 'refinery']).optional()
    .describe('Target agent for execution'),
  /** Dry run (don\'t actually execute) */
  dry_run: z.boolean().default(false).describe('Dry run (don\'t actually execute)'),
});

export type FormulaExecuteInput = z.infer<typeof FormulaExecuteInputSchema>;

/**
 * Schema for gt_formula_create
 */
export const FormulaCreateInputSchema = z.object({
  /** Formula name */
  name: z.string().min(1).max(100).describe('Formula name'),
  /** Formula type */
  type: z.enum(['convoy', 'workflow', 'expansion', 'aspect']).describe('Formula type'),
  /** Workflow steps */
  steps: z.array(z.object({
    id: z.string().min(1).max(50),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    needs: z.array(z.string().max(50)).optional(),
  })).max(100).optional().describe('Workflow steps'),
  /** Variable definitions */
  vars: z.record(z.string().max(50), z.object({
    default: z.string().max(1000).optional(),
    description: z.string().max(500).optional(),
    required: z.boolean().optional(),
  })).optional().describe('Variable definitions'),
  /** Formula description */
  description: z.string().max(2000).optional().describe('Formula description'),
});

export type FormulaCreateInput = z.infer<typeof FormulaCreateInputSchema>;

// --- Orchestration Schemas ---

/**
 * Schema for gt_sling
 */
export const SlingInputSchema = z.object({
  /** Bead ID to sling */
  bead_id: z.string().min(1).max(50).describe('Bead ID to sling'),
  /** Target agent type */
  target: z.enum(['polecat', 'crew', 'mayor']).describe('Target agent type'),
  /** Optional formula to use */
  formula: z.string().max(200).optional().describe('Optional formula to use'),
  /** Priority override */
  priority: z.number().int().min(0).max(10).optional().describe('Priority override'),
});

export type SlingInput = z.infer<typeof SlingInputSchema>;

/**
 * Schema for gt_agents
 */
export const AgentsInputSchema = z.object({
  /** Filter by rig */
  rig: z.string().max(100).optional().describe('Filter by rig'),
  /** Filter by role */
  role: z.enum(['mayor', 'polecat', 'refinery', 'witness', 'deacon', 'dog', 'crew']).optional()
    .describe('Filter by agent role'),
  /** Include inactive agents */
  include_inactive: z.boolean().default(false).describe('Include inactive agents'),
});

export type AgentsInput = z.infer<typeof AgentsInputSchema>;

/**
 * Schema for gt_mail
 */
export const MailInputSchema = z.object({
  /** Mail action */
  action: z.enum(['send', 'read', 'list']).describe('Mail action'),
  /** Recipient (for send) */
  to: z.string().max(100).optional().describe('Recipient (for send)'),
  /** Subject (for send) */
  subject: z.string().max(500).optional().describe('Subject (for send)'),
  /** Body (for send) */
  body: z.string().max(10000).optional().describe('Body (for send)'),
  /** Mail ID (for read) */
  mail_id: z.string().max(50).optional().describe('Mail ID (for read)'),
  /** Maximum messages to list */
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum messages to list'),
});

export type MailInput = z.infer<typeof MailInputSchema>;

// --- WASM Schemas ---

/**
 * Schema for gt_wasm_parse_formula
 */
export const WasmParseFormulaInputSchema = z.object({
  /** TOML content to parse */
  content: z.string().min(1).max(100000).describe('TOML content to parse'),
  /** Validate against schema */
  validate: z.boolean().default(true).describe('Validate against formula schema'),
});

export type WasmParseFormulaInput = z.infer<typeof WasmParseFormulaInputSchema>;

/**
 * Schema for gt_wasm_resolve_deps
 */
export const WasmResolveDepsInputSchema = z.object({
  /** Beads to analyze */
  beads: z.array(z.object({
    id: z.string().min(1).max(50),
    dependencies: z.array(z.string().max(50)).optional(),
  })).min(1).max(1000).describe('Beads to analyze'),
  /** Analysis action */
  action: z.enum(['topo_sort', 'critical_path', 'cycle_detect']).default('topo_sort')
    .describe('Analysis action'),
});

export type WasmResolveDepsInput = z.infer<typeof WasmResolveDepsInputSchema>;

/**
 * Schema for gt_wasm_cook_batch
 */
export const WasmCookBatchInputSchema = z.object({
  /** Formulas to cook */
  formulas: z.array(z.object({
    name: z.string().min(1).max(100),
    content: z.string().min(1).max(50000),
  })).min(1).max(50).describe('Formulas to cook'),
  /** Variables for each formula */
  vars: z.array(z.record(z.string().max(50), z.string().max(5000))).describe('Variables for each formula'),
  /** Continue on error */
  continue_on_error: z.boolean().default(false).describe('Continue on error'),
});

export type WasmCookBatchInput = z.infer<typeof WasmCookBatchInputSchema>;

/**
 * Schema for gt_wasm_match_pattern
 */
export const WasmMatchPatternInputSchema = z.object({
  /** Search query */
  query: z.string().min(1).max(5000).describe('Search query'),
  /** Candidate patterns to match against */
  candidates: z.array(z.string().max(50000)).min(1).max(1000).describe('Candidate patterns'),
  /** Number of results to return */
  k: z.number().int().min(1).max(100).default(10).describe('Number of results to return'),
  /** Minimum similarity threshold (0-1) */
  threshold: z.number().min(0).max(1).default(0.5).describe('Minimum similarity threshold'),
});

export type WasmMatchPatternInput = z.infer<typeof WasmMatchPatternInputSchema>;

/**
 * Schema for gt_wasm_optimize_convoy
 */
export const WasmOptimizeConvoyInputSchema = z.object({
  /** Convoy ID to optimize */
  convoy_id: z.string().min(1).max(50).describe('Convoy ID to optimize'),
  /** Optimization strategy */
  strategy: z.enum(['parallel', 'serial', 'hybrid']).default('hybrid')
    .describe('Optimization strategy'),
  /** Consider resource constraints */
  resource_constraints: z.object({
    max_parallel: z.number().int().min(1).max(100).optional(),
    agent_capacity: z.record(z.string(), z.number().int().min(1)).optional(),
  }).optional().describe('Resource constraints'),
});

export type WasmOptimizeConvoyInput = z.infer<typeof WasmOptimizeConvoyInputSchema>;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result for bead creation
 */
export interface BeadCreateResult {
  success: boolean;
  bead: Bead;
  durationMs: number;
}

/**
 * Result for beads ready list
 */
export interface BeadsReadyResult {
  success: boolean;
  beads: Bead[];
  total: number;
  durationMs: number;
}

/**
 * Result for bead show
 */
export interface BeadShowResult {
  success: boolean;
  bead: Bead;
  dependencies: string[];
  dependents: string[];
  durationMs: number;
}

/**
 * Result for bead dependency operation
 */
export interface BeadDepResult {
  success: boolean;
  action: DepAction;
  child: string;
  parent: string;
  durationMs: number;
}

/**
 * Result for beads sync
 */
export interface BeadsSyncResult {
  success: boolean;
  direction: SyncDirection;
  pulled: number;
  pushed: number;
  conflicts: number;
  durationMs: number;
}

/**
 * Result for convoy creation
 */
export interface ConvoyCreateResult {
  success: boolean;
  convoy: Convoy;
  durationMs: number;
}

/**
 * Result for convoy status
 */
export interface ConvoyStatusResult {
  success: boolean;
  convoys: Convoy[];
  durationMs: number;
}

/**
 * Result for convoy track
 */
export interface ConvoyTrackResult {
  success: boolean;
  convoy_id: string;
  action: 'add' | 'remove';
  issues_modified: string[];
  durationMs: number;
}

/**
 * Result for formula list
 */
export interface FormulaListResult {
  success: boolean;
  formulas: Array<{
    name: string;
    type: FormulaType;
    description: string;
    builtin: boolean;
  }>;
  durationMs: number;
}

/**
 * Result for formula cook
 */
export interface FormulaCookResult {
  success: boolean;
  cooked: CookedFormula;
  wasmUsed: boolean;
  durationMs: number;
}

/**
 * Result for formula execute
 */
export interface FormulaExecuteResult {
  success: boolean;
  formula: string;
  beads_created: string[];
  target_agent?: string;
  dry_run: boolean;
  durationMs: number;
}

/**
 * Result for formula create
 */
export interface FormulaCreateResult {
  success: boolean;
  name: string;
  path: string;
  durationMs: number;
}

/**
 * Result for sling
 */
export interface SlingResult {
  success: boolean;
  bead_id: string;
  target: TargetAgent;
  formula_used?: string;
  durationMs: number;
}

/**
 * Result for agents list
 */
export interface AgentsResult {
  success: boolean;
  agents: GasTownAgent[];
  durationMs: number;
}

/**
 * Result for mail
 */
export interface MailResult {
  success: boolean;
  action: MailAction;
  messages?: GasTownMail[];
  sent_id?: string;
  durationMs: number;
}

/**
 * Result for WASM formula parse
 */
export interface WasmParseFormulaResult {
  success: boolean;
  ast: FormulaAST;
  wasmPerformanceMs: number;
  durationMs: number;
}

/**
 * Result for WASM dependency resolution
 */
export interface WasmResolveDepsResult {
  success: boolean;
  action: DependencyAction;
  result: DependencyResolution;
  wasmPerformanceMs: number;
  durationMs: number;
}

/**
 * Result for WASM batch cook
 */
export interface WasmCookBatchResult {
  success: boolean;
  cooked: CookedFormula[];
  errors: Array<{ index: number; error: string }>;
  wasmPerformanceMs: number;
  durationMs: number;
}

/**
 * Result for WASM pattern match
 */
export interface WasmMatchPatternResult {
  success: boolean;
  matches: PatternMatch[];
  wasmPerformanceMs: number;
  durationMs: number;
}

/**
 * Result for WASM convoy optimization
 */
export interface WasmOptimizeConvoyResult {
  success: boolean;
  optimization: ConvoyOptimization;
  wasmPerformanceMs: number;
  durationMs: number;
}

// ============================================================================

/**
 * Gas Town Bridge — domain types
 *
 * Bead/formula/convoy/agent/sling/mail/sync/graph/config/error shapes.
 * Extracted verbatim from types.ts (lines 18-479) during campaign-2
 * wave 33 (W239). types.ts stays the barrel.
 */

// Bead Types (matching Gas Town's beads.db schema)
// ============================================================================

/**
 * Bead status enumeration
 */
export type BeadStatus = 'open' | 'in_progress' | 'closed';

/**
 * Bead - Git-backed issue with graph semantics
 */
export interface Bead {
  /** Unique identifier (e.g., "gt-abc12") */
  readonly id: string;
  /** Issue title */
  readonly title: string;
  /** Issue description */
  readonly description: string;
  /** Current status */
  readonly status: BeadStatus;
  /** Priority (0 = highest) */
  readonly priority: number;
  /** Issue labels */
  readonly labels: string[];
  /** Parent bead ID (for epics) */
  readonly parentId?: string;
  /** Creation timestamp */
  readonly createdAt: Date;
  /** Last update timestamp */
  readonly updatedAt: Date;
  /** Assigned agent/user */
  readonly assignee?: string;
  /** Gas Town rig name */
  readonly rig?: string;
  /** Blocking beads (dependencies) */
  readonly blockedBy?: string[];
  /** Beads this blocks */
  readonly blocks?: string[];
}

/**
 * Options for creating a new bead
 */
export interface CreateBeadOptions {
  readonly title: string;
  readonly description?: string;
  readonly priority?: number;
  readonly labels?: string[];
  readonly parent?: string;
  readonly rig?: string;
  readonly assignee?: string;
}

/**
 * Bead dependency relationship
 */
export interface BeadDependency {
  readonly child: string;
  readonly parent: string;
  readonly type: 'blocks' | 'relates' | 'duplicates';
}

// ============================================================================
// Formula Types (matching Gas Town's formula/types.go)
// ============================================================================

/**
 * Formula type enumeration
 */
export type FormulaType = 'convoy' | 'workflow' | 'expansion' | 'aspect';

/**
 * Workflow step definition
 */
export interface Step {
  /** Step identifier */
  readonly id: string;
  /** Step title */
  readonly title: string;
  /** Step description */
  readonly description: string;
  /** Dependencies - step IDs that must complete first */
  readonly needs?: string[];
  /** Estimated duration in minutes */
  readonly duration?: number;
  /** Required capabilities */
  readonly requires?: string[];
  /** Step metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Convoy leg definition
 */
export interface Leg {
  /** Leg identifier */
  readonly id: string;
  /** Leg title */
  readonly title: string;
  /** Focus area */
  readonly focus: string;
  /** Leg description */
  readonly description: string;
  /** Assigned agent type */
  readonly agent?: string;
  /** Leg sequence order */
  readonly order?: number;
}

/**
 * Formula variable definition
 */
export interface Var {
  /** Variable name */
  readonly name: string;
  /** Variable description */
  readonly description?: string;
  /** Default value */
  readonly default?: string;
  /** Whether the variable is required */
  readonly required?: boolean;
  /** Validation pattern (regex) */
  readonly pattern?: string;
  /** Allowed values */
  readonly enum?: string[];
}

/**
 * Synthesis definition (convoy result combination)
 */
export interface Synthesis {
  /** Synthesis strategy */
  readonly strategy: 'merge' | 'sequential' | 'parallel';
  /** Output format */
  readonly format?: string;
  /** Synthesis description */
  readonly description?: string;
}

/**
 * Template for expansion formulas
 */
export interface Template {
  /** Template name */
  readonly name: string;
  /** Template content with variable placeholders */
  readonly content: string;
  /** Output path pattern */
  readonly outputPath?: string;
}

/**
 * Aspect definition for cross-cutting concerns
 */
export interface Aspect {
  /** Aspect name */
  readonly name: string;
  /** Pointcut expression */
  readonly pointcut: string;
  /** Advice to apply */
  readonly advice: string;
  /** Aspect type */
  readonly type: 'before' | 'after' | 'around';
}

/**
 * Formula - TOML-defined workflow specification
 */
export interface Formula {
  /** Formula name */
  readonly name: string;
  /** Formula description */
  readonly description: string;
  /** Formula type */
  readonly type: FormulaType;
  /** Formula version */
  readonly version: number;

  // Convoy-specific fields
  /** Convoy legs */
  readonly legs?: Leg[];
  /** Synthesis configuration */
  readonly synthesis?: Synthesis;

  // Workflow-specific fields
  /** Workflow steps */
  readonly steps?: Step[];
  /** Variable definitions */
  readonly vars?: Record<string, Var>;

  // Expansion-specific fields
  /** Expansion templates */
  readonly templates?: Template[];

  // Aspect-specific fields
  /** Cross-cutting aspects */
  readonly aspects?: Aspect[];

  /** Formula metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Cooked formula with variables substituted
 */
export interface CookedFormula extends Formula {
  /** When the formula was cooked */
  readonly cookedAt: Date;
  /** Variables used for cooking */
  readonly cookedVars: Record<string, string>;
  /** Original (uncooked) formula name */
  readonly originalName: string;
}

// ============================================================================
// Convoy Types
// ============================================================================

/**
 * Convoy status enumeration
 */
export type ConvoyStatus = 'active' | 'landed' | 'failed' | 'paused';

/**
 * Convoy progress tracking
 */
export interface ConvoyProgress {
  /** Total issues tracked */
  readonly total: number;
  /** Closed issues */
  readonly closed: number;
  /** In-progress issues */
  readonly inProgress: number;
  /** Blocked issues */
  readonly blocked: number;
}

/**
 * Convoy - Work order tracking for slung work
 */
export interface Convoy {
  /** Convoy identifier */
  readonly id: string;
  /** Convoy name */
  readonly name: string;
  /** Tracked issue IDs */
  readonly trackedIssues: string[];
  /** Convoy status */
  readonly status: ConvoyStatus;
  /** Start timestamp */
  readonly startedAt: Date;
  /** Completion timestamp */
  readonly completedAt?: Date;
  /** Progress tracking */
  readonly progress: ConvoyProgress;
  /** Formula used to create convoy */
  readonly formula?: string;
  /** Description */
  readonly description?: string;
}

/**
 * Options for creating a convoy
 */
export interface CreateConvoyOptions {
  readonly name: string;
  readonly issues: string[];
  readonly description?: string;
  readonly formula?: string;
}

// ============================================================================
// Agent Types (Gas Town specific)
// ============================================================================

/**
 * Gas Town agent role
 */
export type GasTownAgentRole =
  | 'mayor'
  | 'polecat'
  | 'refinery'
  | 'witness'
  | 'deacon'
  | 'dog'
  | 'crew';

/**
 * Gas Town agent
 */
export interface GasTownAgent {
  /** Agent name */
  readonly name: string;
  /** Agent role */
  readonly role: GasTownAgentRole;
  /** Rig assignment */
  readonly rig?: string;
  /** Current status */
  readonly status: 'active' | 'idle' | 'busy';
  /** Agent capabilities */
  readonly capabilities?: string[];
}

// ============================================================================
// Sling Types
// ============================================================================

/**
 * Sling target type
 */
export type SlingTarget = 'polecat' | 'crew' | 'mayor';

/**
 * Sling operation options
 */
export interface SlingOptions {
  readonly beadId: string;
  readonly target: SlingTarget;
  readonly formula?: string;
  readonly priority?: number;
}

// ============================================================================
// Mail Types
// ============================================================================

/**
 * Gas Town mail message
 */
export interface GasTownMail {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly sentAt: Date;
  readonly read: boolean;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Sync direction
 */
export type SyncDirection = 'pull' | 'push' | 'both';

/**
 * Sync result
 */
export interface SyncResult {
  readonly direction: SyncDirection;
  readonly pulled: number;
  readonly pushed: number;
  readonly errors: string[];
  readonly timestamp: Date;
}

// ============================================================================
// Graph Types (for dependency resolution)
// ============================================================================

/**
 * Dependency graph for beads
 */
export interface BeadGraph {
  readonly nodes: string[];
  readonly edges: Array<[string, string]>;
}

/**
 * Topological sort result
 */
export interface TopoSortResult {
  readonly sorted: string[];
  readonly hasCycle: boolean;
  readonly cycleNodes?: string[];
}

/**
 * Critical path result
 */
export interface CriticalPathResult {
  readonly path: string[];
  readonly totalDuration: number;
  readonly slack: Map<string, number>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Gas Town Bridge plugin configuration
 */
export interface GasTownConfig {
  /** Path to Gas Town installation */
  readonly townRoot: string;

  /** Enable Beads sync with AgentDB */
  readonly enableBeadsSync: boolean;
  /** Sync interval in milliseconds */
  readonly syncInterval: number;

  /** Enable native formula parsing (WASM) */
  readonly nativeFormulas: boolean;

  /** Enable convoy tracking */
  readonly enableConvoys: boolean;

  /** Auto-create beads from Claude Flow tasks */
  readonly autoCreateBeads: boolean;

  /** Enable GUPP integration */
  readonly enableGUPP: boolean;
  /** GUPP check interval in milliseconds */
  readonly guppCheckInterval: number;

  /** CLI timeout in milliseconds */
  readonly cliTimeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: GasTownConfig = {
  townRoot: '~/gt',
  enableBeadsSync: true,
  syncInterval: 60000,
  nativeFormulas: true,
  enableConvoys: true,
  autoCreateBeads: false,
  enableGUPP: false,
  guppCheckInterval: 5000,
  cliTimeout: 30000,
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Gas Town Bridge error codes
 */
export const GasTownErrorCodes = {
  CLI_NOT_FOUND: 'GT_CLI_NOT_FOUND',
  CLI_TIMEOUT: 'GT_CLI_TIMEOUT',
  CLI_ERROR: 'GT_CLI_ERROR',
  BEAD_NOT_FOUND: 'GT_BEAD_NOT_FOUND',
  CONVOY_NOT_FOUND: 'GT_CONVOY_NOT_FOUND',
  FORMULA_NOT_FOUND: 'GT_FORMULA_NOT_FOUND',
  FORMULA_PARSE_ERROR: 'GT_FORMULA_PARSE_ERROR',
  WASM_NOT_INITIALIZED: 'GT_WASM_NOT_INITIALIZED',
  SYNC_ERROR: 'GT_SYNC_ERROR',
  DEPENDENCY_CYCLE: 'GT_DEPENDENCY_CYCLE',
  INVALID_SLING_TARGET: 'GT_INVALID_SLING_TARGET',
} as const;

export type GasTownErrorCode = (typeof GasTownErrorCodes)[keyof typeof GasTownErrorCodes];

// ============================================================================

/**
 * Manifest Validator — shared constants & types
 *
 * The validation enums/limits and the AgentCellManifest / golden-trace
 * interfaces, extracted from manifest-validator.ts during the P3.37
 * god-file decomposition (W158). The ManifestValidator + ConformanceSuite
 * classes import from here; manifest-validator.ts re-exports every public
 * type so deep importers resolve byte-identically.
 *
 * @module @claude-flow/guidance/manifest-validator-types
 */

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_API_VERSION = 'agentic_cells.v0_1';
export const SHA256_DIGEST_RE = /^sha256:[a-f0-9]{64}$/;

/** Maximum budget limits (sanity caps) */
export const MAX_BUDGET_LIMITS = {
  maxWallClockSeconds: 86_400,       // 24 hours
  maxToolCalls: 100_000,
  maxBytesEgress: 10_737_418_240,    // 10 GiB
  maxTokensInMtok: 100,             // 100M tokens
  maxTokensOutMtok: 100,            // 100M tokens
  maxMemoryWrites: 1_000_000,
} as const;

/** Data sensitivity levels ordered by severity */
export const DATA_SENSITIVITY_LEVELS = ['public', 'internal', 'confidential', 'restricted'] as const;
export type DataSensitivity = typeof DATA_SENSITIVITY_LEVELS[number];

/** Write modes for memory policy */
export const WRITE_MODES = ['append', 'overwrite', 'merge'] as const;
export type WriteMode = typeof WRITE_MODES[number];

/** Authority scopes for memory policy */
export const AUTHORITY_SCOPES = ['self', 'team', 'tenant', 'global'] as const;
export type AuthorityScope = typeof AUTHORITY_SCOPES[number];

/** Known tool names the system recognizes */
export const KNOWN_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
  'Bash', 'Task', 'TodoWrite', 'NotebookEdit', 'WebFetch', 'WebSearch',
  'mcp_memory', 'mcp_swarm', 'mcp_hooks', 'mcp_agent',
]);

/** Trace levels for observability */
export const TRACE_LEVELS = ['none', 'errors', 'decisions', 'full'] as const;

/** Execution lanes ordered by privilege (lowest to highest) */
export const LANES = ['wasm', 'sandboxed', 'native'] as const;
export type Lane = typeof LANES[number];

// ============================================================================
// AgentCellManifest Interface
// ============================================================================

/**
 * The manifest describing an agent cell per the Agentic Container spec.
 */
export interface AgentCellManifest {
  /** API version string (must be 'agentic_cells.v0_1') */
  apiVersion: string;

  /** Cell identity */
  cell: {
    name: string;
    purpose: string;
    ownerTenant: string;
    codeRef: {
      kind: string;
      digest: string;
      entry: string;
    };
  };

  /** Lane execution policy */
  lanePolicy: {
    portabilityRequired: boolean;
    needsNativeThreads: boolean;
    preferredLane: Lane;
    maxRiskScore: number;
  };

  /** Resource budgets */
  budgets: {
    maxWallClockSeconds: number;
    maxToolCalls: number;
    maxBytesEgress: number;
    maxTokensInMtok: number;
    maxTokensOutMtok: number;
    maxMemoryWrites: number;
  };

  /** Data handling policy */
  dataPolicy: {
    dataSensitivity: DataSensitivity;
    piiAllowed: boolean;
    retentionDays: number;
    exportControls: {
      allowedRegions: string[];
      blockedRegions: string[];
    };
  };

  /** Tool usage policy */
  toolPolicy: {
    toolsAllowed: string[];
    networkAllowlist: string[];
    writeActionsRequireConfirmation: boolean;
  };

  /** Memory system policy */
  memoryPolicy: {
    namespace: string;
    authorityScope: AuthorityScope;
    writeMode: WriteMode;
    requiresCoherenceGate: boolean;
    requiresAntiHallucinationGate: boolean;
  };

  /** Observability configuration */
  observability: {
    traceLevel: typeof TRACE_LEVELS[number];
    emitArtifacts: boolean;
    artifactBucket: string;
  };
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * A single validation error or warning.
 */
export interface ValidationError {
  /** Error code (e.g., 'MISSING_FIELD', 'INVALID_DIGEST', 'BUDGET_EXCEED') */
  code: string;
  /** JSON path to the problematic field */
  field: string;
  /** Human-readable description */
  message: string;
  /** Severity level */
  severity: 'error';
}

/**
 * A single validation warning.
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** JSON path to the problematic field */
  field: string;
  /** Human-readable description */
  message: string;
  /** Severity level */
  severity: 'warning';
}

/**
 * Complete validation result for a manifest.
 */
export interface ValidationResult {
  /** Whether the manifest passed all validation checks */
  valid: boolean;
  /** Validation errors (each causes rejection) */
  errors: ValidationError[];
  /** Validation warnings (informational, do not block admission) */
  warnings: ValidationWarning[];
  /** Admission decision: admit, reject, or review */
  admissionDecision: 'admit' | 'reject' | 'review';
  /** Selected execution lane (null if rejected) */
  laneSelection: Lane | null;
  /** Computed risk score (0-100) */
  riskScore: number;
}

// ============================================================================
// Golden Trace Types
// ============================================================================

/**
 * A single event within a golden trace.
 */
export interface GoldenTraceEvent {
  /** Sequence number within the trace */
  seq: number;
  /** Type of event (e.g., 'command', 'tool-use', 'memory-write', 'budget-check') */
  eventType: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Expected outcome from the platform */
  expectedOutcome: 'allow' | 'deny' | 'warn';
}

/**
 * A complete golden trace including events and expected decisions.
 */
export interface GoldenTrace {
  /** Unique trace identifier */
  traceId: string;
  /** Human-readable name */
  name: string;
  /** Description of what the trace verifies */
  description: string;
  /** Ordered sequence of events */
  events: GoldenTraceEvent[];
  /** Map from event seq (as string) to expected decision string */
  expectedDecisions: Record<string, string>;
  /** Map from memory key to expected parent chain for lineage verification */
  expectedMemoryLineage: Record<string, string[]>;
}

// ============================================================================
// ConformanceResult
// ============================================================================

/**
 * Result of running the conformance suite.
 */
export interface ConformanceResult {
  /** Whether all events matched their expected outcomes */
  passed: boolean;
  /** Total number of events evaluated */
  totalEvents: number;
  /** Number of events that matched expectations */
  matchedEvents: number;
  /** Details of any mismatches */
  mismatches: Array<{
    traceId: string;
    seq: number;
    expected: string;
    actual: string;
    details: unknown;
  }>;
}

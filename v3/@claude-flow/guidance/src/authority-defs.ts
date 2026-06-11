/**
 * Authority — types, default scopes & pattern tables
 *
 * Extracted verbatim from authority.ts (lines 30-295) during campaign-2
 * wave 68 (W274). The 9 public shapes are re-exported by the barrel;
 * the DEFAULT_* tables and AUTHORITY_HIERARCHY stay unexported from it.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Authority levels in the decision hierarchy.
 *
 * - 'agent': Autonomous agent decisions
 * - 'human': Human operator approval required
 * - 'institutional': Organizational policy/compliance required
 * - 'regulatory': External regulatory approval required
 */
export type AuthorityLevel = 'agent' | 'human' | 'institutional' | 'regulatory';

/**
 * Classification of action reversibility.
 *
 * - 'reversible': Can be undone easily with no or minimal cost
 * - 'costly-reversible': Can be undone but with significant cost/effort
 * - 'irreversible': Cannot be undone once executed
 */
export type IrreversibilityClass =
  | 'reversible'
  | 'costly-reversible'
  | 'irreversible';

/**
 * Required proof level based on action irreversibility.
 *
 * - 'standard': Normal verification (reversible actions)
 * - 'elevated': Enhanced verification (costly-reversible actions)
 * - 'maximum': Maximum verification (irreversible actions)
 */
export type ProofLevel = 'standard' | 'elevated' | 'maximum';

/**
 * Defines the scope of authority for a given level.
 */
export interface AuthorityScope {
  /** The authority level this scope applies to */
  level: AuthorityLevel;
  /** Actions this authority level is permitted to perform */
  permissions: string[];
  /** Actions this level can override from lower levels */
  overrideScope: string[];
  /** Whether this level requires escalation to a higher level */
  escalationRequired: boolean;
}

/**
 * Record of a human intervention/override decision.
 */
export interface HumanIntervention {
  /** Unique identifier for this intervention */
  id: string;
  /** Unix timestamp (ms) when the intervention occurred */
  timestamp: number;
  /** Authority level that performed the intervention */
  authorityLevel: AuthorityLevel;
  /** The action that was authorized or denied */
  action: string;
  /** Human-readable reason for the intervention */
  reason: string;
  /** Identifier of the person/entity who signed off */
  signedBy: string;
  /** HMAC-SHA256 signature for integrity verification */
  signature: string;
  /** Additional context or metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an authority check.
 */
export interface AuthorityCheckResult {
  /** Whether the action is allowed at the current authority level */
  allowed: boolean;
  /** The minimum authority level required for this action */
  requiredLevel: AuthorityLevel;
  /** The authority level being checked */
  currentLevel: AuthorityLevel;
  /** Human-readable explanation of the decision */
  reason: string;
}

/**
 * Result of an irreversibility classification.
 */
export interface IrreversibilityResult {
  /** The classification of the action */
  classification: IrreversibilityClass;
  /** Patterns that matched this action */
  matchedPatterns: string[];
  /** Required proof level for this action */
  requiredProofLevel: ProofLevel;
  /** Whether pre-commit simulation is required */
  requiresSimulation: boolean;
}

/**
 * Configuration for the AuthorityGate.
 */
export interface AuthorityGateConfig {
  /** Authority scopes to register (defaults provided if not specified) */
  scopes?: AuthorityScope[];
  /** Secret key for HMAC signing (generated if not provided) */
  signatureSecret?: string;
}

/**
 * Configuration for the IrreversibilityClassifier.
 */
export interface IrreversibilityClassifierConfig {
  /** Patterns for irreversible actions (regex strings) */
  irreversiblePatterns?: string[];
  /** Patterns for costly-reversible actions (regex strings) */
  costlyReversiblePatterns?: string[];
  /** Patterns for reversible actions (regex strings) */
  reversiblePatterns?: string[];
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default authority scopes for each level.
 */
export const DEFAULT_AUTHORITY_SCOPES: AuthorityScope[] = [
  {
    level: 'agent',
    permissions: [
      'read_file',
      'analyze_code',
      'suggest_changes',
      'run_tests',
      'generate_documentation',
    ],
    overrideScope: [],
    escalationRequired: false,
  },
  {
    level: 'human',
    permissions: [
      'write_file',
      'modify_code',
      'deploy_staging',
      'create_branch',
      'merge_pr',
      'delete_resource',
    ],
    overrideScope: ['read_file', 'analyze_code', 'suggest_changes', 'run_tests'],
    escalationRequired: false,
  },
  {
    level: 'institutional',
    permissions: [
      'deploy_production',
      'modify_security_policy',
      'grant_access',
      'revoke_access',
      'approve_budget',
      'sign_contract',
    ],
    overrideScope: [
      'write_file',
      'modify_code',
      'deploy_staging',
      'create_branch',
    ],
    escalationRequired: false,
  },
  {
    level: 'regulatory',
    permissions: [
      'approve_compliance',
      'certify_audit',
      'approve_data_transfer',
      'approve_privacy_policy',
      'issue_license',
    ],
    overrideScope: [
      'deploy_production',
      'modify_security_policy',
      'grant_access',
      'approve_budget',
    ],
    escalationRequired: false,
  },
];

/**
 * Default patterns for irreversible actions.
 */
export const DEFAULT_IRREVERSIBLE_PATTERNS = [
  'send.*email',
  'publish.*package',
  'process.*payment',
  'execute.*payment',
  'delete.*permanent',
  'drop.*database',
  'revoke.*certificate',
  'propagate.*dns',
  'broadcast.*message',
  'sign.*transaction',
  'commit.*blockchain',
  'release.*funds',
];

/**
 * Default patterns for costly-reversible actions.
 */
export const DEFAULT_COSTLY_REVERSIBLE_PATTERNS = [
  'migrate.*database',
  'deploy.*production',
  'rollback.*deployment',
  'update.*config',
  'modify.*schema',
  'send.*notification',
  'create.*user',
  'delete.*user',
  'grant.*permission',
  'revoke.*permission',
  'scale.*infrastructure',
  'provision.*resource',
];

/**
 * Default patterns for reversible actions.
 */
export const DEFAULT_REVERSIBLE_PATTERNS = [
  'read.*file',
  'analyze.*code',
  'generate.*report',
  'run.*test',
  'preview.*change',
  'simulate.*deployment',
  'validate.*input',
  'check.*status',
];

// ============================================================================
// Authority Hierarchy
// ============================================================================

/**
 * Ordered authority hierarchy from lowest to highest.
 */
export const AUTHORITY_HIERARCHY: AuthorityLevel[] = [
  'agent',
  'human',
  'institutional',
  'regulatory',
];

// ============================================================================
// AuthorityGate
// ============================================================================

/**
 * Gate that enforces authority boundaries and records human interventions.
 *
 * Maintains a registry of authority scopes, checks permissions, determines
 * escalation requirements, and creates cryptographically signed intervention
 * records for audit trails.
 */

/**
 * Agentic-QE Plugin Interfaces — security bridge
 *
 * Extracted verbatim from interfaces.ts (lines 253-459) during the P3.59
 * god-file decomposition (W180). interfaces.ts stays the barrel.
 */

// Security Bridge Interfaces
// =============================================================================

/**
 * Validated path result
 */
export interface ValidatedPath {
  path: string;
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * DAST probe definition
 */
export interface DASTProbe {
  /** Probe identifier */
  id: string;

  /** Probe type */
  type: 'xss' | 'sqli' | 'ssrf' | 'csrf' | 'auth' | 'header' | 'custom';

  /** Target endpoint */
  endpoint: string;

  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** Request payload */
  payload?: Record<string, unknown>;

  /** Expected response indicators */
  indicators: string[];

  /** Maximum timeout */
  timeout: number;
}

/**
 * DAST scan result
 */
export interface DASTResult {
  /** Probe identifier */
  probeId: string;

  /** Whether vulnerability was detected */
  vulnerable: boolean;

  /** Severity if vulnerable */
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';

  /** Response status code */
  statusCode: number;

  /** Evidence of vulnerability */
  evidence?: string;

  /** Execution time */
  executionTimeMs: number;
}

/**
 * Audit event for compliance tracking
 */
export interface AuditEvent {
  /** Event type */
  type: 'scan_started' | 'scan_completed' | 'finding_detected' | 'remediation_applied';

  /** Actor who triggered the event */
  actor: string;

  /** Target of the action */
  target: string;

  /** Event details */
  details: Record<string, unknown>;

  /** Timestamp */
  timestamp: number;
}

/**
 * Signed audit entry
 */
export interface SignedAuditEntry {
  /** Unique identifier */
  id: string;

  /** The audit event */
  event: AuditEvent;

  /** Entry timestamp */
  timestamp: number;

  /** Actor who created the entry */
  actor: string;

  /** Cryptographic signature */
  signature: string;

  /** Whether signature is verifiable */
  verifiable: boolean;
}

/**
 * PII type classification
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'password'
  | 'address'
  | 'name'
  | 'dob'
  | 'ip_address';

/**
 * PII detection result
 */
export interface PIIDetection {
  /** Type of PII detected */
  type: PIIType;

  /** Location in the content */
  location: {
    start: number;
    end: number;
  };

  /** Confidence score (0-1) */
  confidence: number;

  /** The detected value (redacted) */
  redactedValue?: string;
}

/**
 * Security bridge interface for V3 security integration
 */
export interface IQESecurityBridge {
  /**
   * Validate a file path before security scan
   */
  validateScanTarget(path: string): Promise<ValidatedPath>;

  /**
   * Execute DAST probes with security constraints
   */
  executeDAST(target: string, probes: DASTProbe[]): Promise<DASTResult[]>;

  /**
   * Create a signed audit entry
   */
  createAuditEntry(event: AuditEvent): Promise<SignedAuditEntry>;

  /**
   * Detect PII in content
   */
  detectPII(content: string): Promise<PIIDetection[]>;

  /**
   * Validate input against security schemas
   */
  validateInput<T>(input: unknown, schema: string): Promise<{ valid: boolean; errors?: string[]; value?: T }>;

  /**
   * Sanitize error message for safe display
   */
  sanitizeError(error: Error): Error;

  /**
   * Get security policy for a context
   */
  getSecurityPolicy(context: string): SecurityPolicy;
}

/**
 * Security policy configuration
 */
export interface SecurityPolicy {
  /** Security level */
  level: 'low' | 'medium' | 'high' | 'critical';

  /** Network access policy */
  networkPolicy: 'unrestricted' | 'restricted' | 'blocked';

  /** File system policy */
  fileSystemPolicy: 'full' | 'workspace-only' | 'readonly' | 'none';

  /** Allowed commands */
  allowedCommands: string[];

  /** Blocked paths */
  blockedPaths: string[];

  /** Maximum execution time */
  maxExecutionTime: number;

  /** Maximum memory */
  maxMemory: number;
}

// =============================================================================

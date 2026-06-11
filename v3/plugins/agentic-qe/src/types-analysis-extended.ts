/**
 * agentic-qe analysis types — extended
 *
 * Extracted verbatim during campaign-2 wave W307. Barrel stays.
 */
import type {
  ChaosFailureType,
  ComplianceStandard,
  ContractType,
  CoverageAlgorithm,
  CoverageGapType,
  QualityGateOperator,
  SecurityScanType,
  Severity,
  TestType,
} from './types-core.js';

export interface RootCauseAnalysis {
  /** Primary cause */
  primaryCause: string;
  /** Contributing factors */
  contributingFactors: string[];
  /** Similar past defects */
  similarDefects: string[];
  /** Confidence (0-1) */
  confidence: number;
}

// =============================================================================
// Security Compliance Types
// =============================================================================

/**
 * Request for security scan
 */
export interface SecurityScanRequest {
  /** Target path to scan */
  targetPath: string;
  /** Scan type */
  scanType: SecurityScanType;
  /** Compliance standards to check */
  compliance: ComplianceStandard[];
  /** Severity filter */
  severityFilter: 'all' | Severity;
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  /** Scan identifier */
  scanId: string;
  /** Findings */
  findings: SecurityFinding[];
  /** Compliance status */
  complianceStatus: ComplianceStatus[];
  /** Summary statistics */
  summary: SecuritySummary;
  /** Scan timestamp */
  timestamp: number;
}

/**
 * A security finding
 */
export interface SecurityFinding {
  /** Finding identifier */
  id: string;
  /** Finding type */
  type: string;
  /** Severity */
  severity: Severity;
  /** CWE identifier */
  cweId?: string;
  /** CVE identifier */
  cveId?: string;
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber?: number;
  /** Description */
  description: string;
  /** Remediation guidance */
  remediation: string;
  /** Code snippet */
  codeSnippet?: string;
}

/**
 * Compliance status for a standard
 */
export interface ComplianceStatus {
  /** Compliance standard */
  standard: ComplianceStandard;
  /** Compliance percentage (0-100) */
  compliance: number;
  /** Passing checks */
  passingChecks: number;
  /** Total checks */
  totalChecks: number;
  /** Failed checks */
  failedChecks: ComplianceCheck[];
}

/**
 * A compliance check
 */
export interface ComplianceCheck {
  /** Check identifier */
  id: string;
  /** Check name */
  name: string;
  /** Description */
  description: string;
  /** Status */
  status: 'pass' | 'fail' | 'warning' | 'not-applicable';
  /** Related findings */
  relatedFindings: string[];
}

/**
 * Security scan summary
 */
export interface SecuritySummary {
  /** Total findings */
  totalFindings: number;
  /** Findings by severity */
  bySeverity: Record<Severity, number>;
  /** Critical issues count */
  criticalCount: number;
  /** High issues count */
  highCount: number;
  /** Medium issues count */
  mediumCount: number;
  /** Low issues count */
  lowCount: number;
}

// =============================================================================
// Contract Testing Types
// =============================================================================

/**
 * Request to validate a contract
 */
export interface ContractValidationRequest {
  /** Path to contract definition */
  contractPath: string;
  /** Type of contract */
  contractType: ContractType;
  /** Target URL for live validation */
  targetUrl?: string;
  /** Strict validation mode */
  strict: boolean;
}

/**
 * Contract validation result
 */
export interface ContractValidationResult {
  /** Validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ContractError[];
  /** Warnings */
  warnings: ContractWarning[];
  /** Breaking changes detected */
  breakingChanges?: BreakingChange[];
  /** Endpoints validated */
  endpointCount: number;
}

/**
 * Contract validation error
 */
export interface ContractError {
  /** Error path in contract */
  path: string;
  /** Error message */
  message: string;
  /** Severity */
  severity: 'error' | 'warning';
  /** Suggestion for fix */
  suggestion?: string;
}

/**
 * Contract warning
 */
export interface ContractWarning {
  /** Warning path */
  path: string;
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
}

/**
 * Breaking change detection
 */
export interface BreakingChange {
  /** Change type */
  type: string;
  /** Endpoint affected */
  endpoint: string;
  /** Description */
  description: string;
  /** Impact level */
  impact: 'breaking' | 'potentially-breaking' | 'non-breaking';
}

// =============================================================================
// Chaos Engineering Types
// =============================================================================

/**
 * Request to inject chaos
 */
export interface ChaosInjectionRequest {
  /** Target service/component */
  target: string;
  /** Failure type to inject */
  failureType: ChaosFailureType;
  /** Duration in seconds */
  duration: number;
  /** Intensity (0-1) */
  intensity: number;
  /** Dry run mode */
  dryRun: boolean;
}

/**
 * Chaos injection result
 */
export interface ChaosInjectionResult {
  /** Experiment identifier */
  experimentId: string;
  /** Experiment executed */
  executed: boolean;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Observations */
  observations: ChaosObservation[];
  /** Resilience assessment */
  resilience?: ResilienceAssessment;
}

/**
 * Observation during chaos experiment
 */
export interface ChaosObservation {
  /** Timestamp */
  timestamp: number;
  /** Observation type */
  type: 'metric' | 'event' | 'error';
  /** Service affected */
  service: string;
  /** Description */
  description: string;
  /** Value if metric */
  value?: number;
}

/**
 * Resilience assessment after chaos
 */
export interface ResilienceAssessment {
  /** Resilience score (0-1) */
  score: number;
  /** Recovery time in ms */
  recoveryTime: number;
  /** Failure modes observed */
  failureModes: string[];
  /** Recommendations */
  recommendations: string[];
  /** Weaknesses identified */
  weaknesses: string[];
}

// =============================================================================

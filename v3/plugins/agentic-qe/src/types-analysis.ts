/**
 * Agentic QE — analysis & security types
 *
 * Coverage, quality, defect-intelligence, security-compliance,
 * contract-testing, and chaos-engineering shapes. Extracted verbatim
 * from types.ts (lines 346-883) during the P3.58 god-file decomposition
 * (W179). types.ts stays the barrel.
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

// Coverage Analysis Types
// =============================================================================

/**
 * Request to analyze coverage
 */
export interface CoverageAnalysisRequest {
  /** Path to coverage report (lcov/json) */
  coverageReport?: string;
  /** Target path to analyze */
  targetPath: string;
  /** Algorithm to use */
  algorithm: CoverageAlgorithm;
  /** Prioritize gaps by risk */
  prioritize: boolean;
}

/**
 * Coverage report from analysis
 */
export interface CoverageReport {
  /** Overall coverage metrics */
  overall: CoverageMetrics;
  /** Per-file coverage */
  files: FileCoverage[];
  /** Detected coverage gaps */
  gaps: CoverageGap[];
  /** Trends over time */
  trends?: CoverageTrend[];
  /** Analysis timestamp */
  timestamp: number;
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  /** Line coverage percentage */
  lines: number;
  /** Branch coverage percentage */
  branches: number;
  /** Function coverage percentage */
  functions: number;
  /** Statement coverage percentage */
  statements: number;
  /** Total lines */
  totalLines: number;
  /** Covered lines */
  coveredLines: number;
}

/**
 * Coverage for a single file
 */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Coverage metrics */
  metrics: CoverageMetrics;
  /** Uncovered line numbers */
  uncoveredLines: number[];
  /** Uncovered branches */
  uncoveredBranches: BranchInfo[];
  /** Complexity score */
  complexity: number;
}

/**
 * Branch information for coverage
 */
export interface BranchInfo {
  /** Line number */
  line: number;
  /** Branch index */
  branchIndex: number;
  /** Branch type */
  type: 'if' | 'else' | 'switch' | 'ternary' | 'loop';
  /** Whether branch is covered */
  covered: boolean;
}

/**
 * A coverage gap with priority
 */
export interface CoverageGap {
  /** Gap identifier */
  id: string;
  /** Gap type */
  type: CoverageGapType;
  /** File path */
  filePath: string;
  /** Line range */
  lineRange: [number, number];
  /** Priority score (0-1) */
  priority: number;
  /** Risk score (0-1) */
  risk: number;
  /** Suggested test type */
  suggestedTestType: TestType;
  /** Description */
  description: string;
}

/**
 * Coverage trend over time
 */
export interface CoverageTrend {
  /** Timestamp */
  timestamp: number;
  /** Coverage at this point */
  coverage: number;
  /** Change from previous */
  change: number;
  /** Commit hash if available */
  commitHash?: string;
}

// =============================================================================
// Quality Assessment Types
// =============================================================================

/**
 * Quality gate definition
 */
export interface QualityGate {
  /** Gate identifier */
  id: string;
  /** Gate name */
  name: string;
  /** Metric to evaluate */
  metric: string;
  /** Operator for comparison */
  operator: QualityGateOperator;
  /** Threshold value */
  threshold: number;
  /** Is gate blocking */
  blocking: boolean;
  /** Description */
  description?: string;
}

/**
 * Request to evaluate quality gates
 */
export interface QualityGateRequest {
  /** Custom gate definitions */
  gates?: QualityGate[];
  /** Preset defaults to use */
  defaults?: 'strict' | 'standard' | 'minimal';
  /** Project path */
  projectPath?: string;
}

/**
 * Result of quality gate evaluation
 */
export interface QualityGateResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Individual gate results */
  gateResults: GateEvaluationResult[];
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Release readiness assessment */
  readiness: ReadinessAssessment;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Single gate evaluation result
 */
export interface GateEvaluationResult {
  /** Gate that was evaluated */
  gate: QualityGate;
  /** Actual value measured */
  actualValue: number;
  /** Pass/fail status */
  passed: boolean;
  /** Margin from threshold */
  margin: number;
}

/**
 * Release readiness assessment
 */
export interface ReadinessAssessment {
  /** Ready for release */
  ready: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Blocking issues */
  blockers: string[];
  /** Warnings */
  warnings: string[];
  /** Suggested actions */
  suggestedActions: string[];
}

// =============================================================================
// Defect Intelligence Types
// =============================================================================

/**
 * Request to predict defects
 */
export interface DefectPredictionRequest {
  /** Target path to analyze */
  targetPath: string;
  /** Analysis depth */
  depth: 'shallow' | 'medium' | 'deep';
  /** Include root cause analysis */
  includeRootCause: boolean;
}

/**
 * Defect prediction result
 */
export interface DefectPredictionResult {
  /** Predicted defects */
  predictions: DefectPrediction[];
  /** Risk hotspots */
  hotspots: DefectHotspot[];
  /** Overall risk score (0-1) */
  overallRisk: number;
  /** Analysis confidence */
  confidence: number;
}

/**
 * A predicted defect
 */
export interface DefectPrediction {
  /** Defect identifier */
  id: string;
  /** Defect type/category */
  type: string;
  /** Predicted severity */
  severity: Severity;
  /** File path */
  filePath: string;
  /** Line range */
  lineRange?: [number, number];
  /** Probability of occurrence (0-1) */
  probability: number;
  /** Description */
  description: string;
  /** Root cause if analyzed */
  rootCause?: RootCauseAnalysis;
  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Defect hotspot in the codebase
 */
export interface DefectHotspot {
  /** File path */
  filePath: string;
  /** Risk score (0-1) */
  riskScore: number;
  /** Change frequency */
  changeFrequency: number;
  /** Historical defect count */
  historicalDefects: number;
  /** Complexity score */
  complexity: number;
}

/**
 * Root cause analysis result
 */
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

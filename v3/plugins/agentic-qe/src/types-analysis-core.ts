/**
 * agentic-qe analysis types — core
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

// =============================================================================

/**
 * Request to analyze coverage
 */
import type {
  RootCauseAnalysis,
} from './types-analysis-extended.js';

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

/**
 * Agentic QE — core & generation types
 *
 * Core QE unions, bounded-context types, test-generation and TDD-cycle
 * shapes. Extracted verbatim from types.ts (lines 9-345) during the
 * P3.58 god-file decomposition (W179). types.ts stays the barrel.
 * (Pure type modules — the cross-module type-only imports are erased.)
 */

import type { CoverageReport } from './types-analysis.js';
import type { TestExecutionResult } from './types-runtime.js';

// =============================================================================
// Core QE Types
// =============================================================================

/**
 * Test types supported by the QE system
 */
export type TestType =
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'property'
  | 'mutation'
  | 'fuzz'
  | 'api'
  | 'performance'
  | 'security'
  | 'accessibility'
  | 'contract'
  | 'bdd';

/**
 * TDD style for test generation
 */
export type TDDStyle = 'london' | 'chicago';

/**
 * Test framework identifiers
 */
export type TestFramework =
  | 'vitest'
  | 'jest'
  | 'mocha'
  | 'pytest'
  | 'junit'
  | 'xunit'
  | 'nunit'
  | 'playwright'
  | 'cypress';

/**
 * Security level classification
 */
export type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Model tier for routing (TinyDancer alignment with ADR-026)
 */
export type ModelTier = 'agent-booster' | 'haiku' | 'sonnet' | 'opus';

/**
 * Contract types for API validation
 */
export type ContractType = 'openapi' | 'graphql' | 'grpc' | 'asyncapi';

/**
 * Chaos failure types for resilience testing
 */
export type ChaosFailureType =
  | 'network-latency'
  | 'network-partition'
  | 'cpu-stress'
  | 'memory-pressure'
  | 'disk-failure'
  | 'process-kill';

/**
 * Compliance standards for security audits
 */
export type ComplianceStandard =
  | 'owasp-top-10'
  | 'sans-25'
  | 'pci-dss'
  | 'hipaa'
  | 'gdpr'
  | 'soc2';

/**
 * Scan types for security analysis
 */
export type SecurityScanType = 'sast' | 'dast' | 'both';

/**
 * Severity levels for findings
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Quality gate operators
 */
export type QualityGateOperator = '>' | '<' | '>=' | '<=' | '==';

/**
 * Coverage gap types
 */
export type CoverageGapType =
  | 'uncovered-lines'
  | 'uncovered-branches'
  | 'uncovered-functions'
  | 'low-branch-coverage'
  | 'missing-edge-cases';

/**
 * Coverage analysis algorithms
 */
export type CoverageAlgorithm = 'johnson-lindenstrauss' | 'full-scan';

// =============================================================================
// Bounded Context Types
// =============================================================================

/**
 * The 12 DDD bounded contexts in agentic-qe
 */
export type BoundedContext =
  | 'test-generation'
  | 'test-execution'
  | 'coverage-analysis'
  | 'quality-assessment'
  | 'defect-intelligence'
  | 'requirements-validation'
  | 'code-intelligence'
  | 'security-compliance'
  | 'contract-testing'
  | 'visual-accessibility'
  | 'chaos-resilience'
  | 'learning-optimization';

/**
 * V3 Domain mapping for context integration
 */
export type V3Domain =
  | 'Security'
  | 'Core'
  | 'Memory'
  | 'Integration'
  | 'Coordination';

// =============================================================================
// Test Generation Types
// =============================================================================

/**
 * Request to generate tests for code
 */
export interface TestGenerationRequest {
  /** Path to file or directory to test */
  targetPath: string;
  /** Type of tests to generate */
  testType: TestType;
  /** Test framework to use */
  framework?: TestFramework;
  /** Coverage configuration */
  coverage?: CoverageConfig;
  /** TDD style preference */
  style?: TDDStyle;
  /** Additional context for test generation */
  context?: string;
  /** Language of the source code */
  language?: string;
  /** Maximum tests to generate */
  maxTests?: number;
}

/**
 * Coverage configuration for test generation
 */
export interface CoverageConfig {
  /** Target coverage percentage */
  target: number;
  /** Focus on coverage gaps */
  focusGaps: boolean;
  /** Include branch coverage */
  includeBranches?: boolean;
  /** Include function coverage */
  includeFunctions?: boolean;
}

/**
 * Result of test generation
 */
export interface TestGenerationResult {
  /** Generated test file paths */
  testFiles: GeneratedTestFile[];
  /** Test statistics */
  stats: TestGenerationStats;
  /** Patterns learned during generation */
  learnedPatterns?: TestPattern[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * A generated test file
 */
export interface GeneratedTestFile {
  /** Path to the generated test file */
  path: string;
  /** Content of the test file */
  content: string;
  /** Number of test cases */
  testCount: number;
  /** Target file being tested */
  targetFile: string;
  /** Test type */
  testType: TestType;
  /** Framework used */
  framework: TestFramework;
}

/**
 * Statistics for test generation
 */
export interface TestGenerationStats {
  /** Total tests generated */
  totalTests: number;
  /** Files processed */
  filesProcessed: number;
  /** Estimated coverage increase */
  estimatedCoverageIncrease: number;
  /** Generation duration in ms */
  duration: number;
  /** Model tier used */
  modelTier: ModelTier;
}

/**
 * A learned test pattern for ReasoningBank
 */
export interface TestPattern {
  /** Unique pattern identifier */
  id: string;
  /** Pattern type/category */
  type: string;
  /** Pattern description */
  description: string;
  /** Programming language */
  language: string;
  /** Test framework */
  framework: TestFramework;
  /** Pattern effectiveness score (0-1) */
  effectiveness: number;
  /** Number of times pattern was used */
  usageCount: number;
  /** Pattern template */
  template?: string;
  /** Tags for categorization */
  tags: string[];
}

// =============================================================================
// TDD Cycle Types
// =============================================================================

/**
 * Request to execute a TDD cycle
 */
export interface TDDCycleRequest {
  /** Requirement or user story to implement */
  requirement: string;
  /** Path to implement in */
  targetPath: string;
  /** TDD style (London or Chicago) */
  style: TDDStyle;
  /** Maximum cycles to execute */
  maxCycles: number;
  /** Test framework to use */
  framework?: TestFramework;
}

/**
 * Result of a TDD cycle execution
 */
export interface TDDCycleResult {
  /** Number of cycles completed */
  cyclesCompleted: number;
  /** Final test results */
  testResults: TestExecutionResult;
  /** Implementation generated */
  implementation: ImplementationArtifact;
  /** Coverage achieved */
  coverage: CoverageReport;
  /** Refactoring suggestions */
  refactoringSuggestions?: RefactoringSuggestion[];
}

/**
 * A single TDD cycle step
 */
export interface TDDCycleStep {
  /** Cycle number */
  cycle: number;
  /** Phase: red, green, or refactor */
  phase: 'red' | 'green' | 'refactor';
  /** Step description */
  description: string;
  /** Duration in ms */
  duration: number;
  /** Success status */
  success: boolean;
  /** Agent that executed the step */
  agent: string;
  /** Artifacts produced */
  artifacts: string[];
}

/**
 * Implementation artifact from TDD cycle
 */
export interface ImplementationArtifact {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Lines of code */
  linesOfCode: number;
  /** Complexity score */
  complexity: number;
}

/**
 * Refactoring suggestion from TDD cycle
 */
export interface RefactoringSuggestion {
  /** Type of refactoring */
  type: string;
  /** Description */
  description: string;
  /** File path */
  filePath: string;
  /** Line range */
  lineRange: [number, number];
  /** Priority */
  priority: 'high' | 'medium' | 'low';
}

// =============================================================================

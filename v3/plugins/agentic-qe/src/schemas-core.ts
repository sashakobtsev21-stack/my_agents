/**
 * agentic-qe schemas — core
 *
 * Extracted verbatim during campaign-2 wave W307. Barrel stays.
 */
import { z } from 'zod';

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Test type enum schema
 */
export const TestTypeSchema = z.enum([
  'unit',
  'integration',
  'e2e',
  'property',
  'mutation',
  'fuzz',
  'api',
  'performance',
  'security',
  'accessibility',
  'contract',
  'bdd',
]);

/**
 * TDD style enum schema
 */
export const TDDStyleSchema = z.enum(['london', 'chicago']);

/**
 * Test framework enum schema
 */
export const TestFrameworkSchema = z.enum([
  'vitest',
  'jest',
  'mocha',
  'pytest',
  'junit',
  'xunit',
  'nunit',
  'playwright',
  'cypress',
]);

/**
 * Security level enum schema
 */
export const SecurityLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Model tier enum schema
 */
export const ModelTierSchema = z.enum(['agent-booster', 'haiku', 'sonnet', 'opus']);

/**
 * Contract type enum schema
 */
export const ContractTypeSchema = z.enum(['openapi', 'graphql', 'grpc', 'asyncapi']);

/**
 * Chaos failure type enum schema
 */
export const ChaosFailureTypeSchema = z.enum([
  'network-latency',
  'network-partition',
  'cpu-stress',
  'memory-pressure',
  'disk-failure',
  'process-kill',
]);

/**
 * Compliance standard enum schema
 */
export const ComplianceStandardSchema = z.enum([
  'owasp-top-10',
  'sans-25',
  'pci-dss',
  'hipaa',
  'gdpr',
  'soc2',
]);

/**
 * Security scan type enum schema
 */
export const SecurityScanTypeSchema = z.enum(['sast', 'dast', 'both']);

/**
 * Severity enum schema
 */
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Quality gate operator enum schema
 */
export const QualityGateOperatorSchema = z.enum(['>', '<', '>=', '<=', '==']);

/**
 * Coverage algorithm enum schema
 */
export const CoverageAlgorithmSchema = z.enum(['johnson-lindenstrauss', 'full-scan']);

/**
 * Bounded context enum schema
 */
export const BoundedContextSchema = z.enum([
  'test-generation',
  'test-execution',
  'coverage-analysis',
  'quality-assessment',
  'defect-intelligence',
  'requirements-validation',
  'code-intelligence',
  'security-compliance',
  'contract-testing',
  'visual-accessibility',
  'chaos-resilience',
  'learning-optimization',
]);

// =============================================================================
// Test Generation Schemas
// =============================================================================

/**
 * Coverage configuration schema
 */
export const CoverageConfigSchema = z.object({
  target: z.number().min(0).max(100).default(80),
  focusGaps: z.boolean().default(true),
  includeBranches: z.boolean().optional(),
  includeFunctions: z.boolean().optional(),
});

/**
 * Test generation request schema
 */
export const TestGenerationRequestSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  testType: TestTypeSchema.default('unit'),
  framework: TestFrameworkSchema.optional(),
  coverage: CoverageConfigSchema.optional(),
  style: TDDStyleSchema.default('london'),
  context: z.string().optional(),
  language: z.string().optional(),
  maxTests: z.number().int().positive().optional(),
});

/**
 * TDD cycle request schema
 */
export const TDDCycleRequestSchema = z.object({
  requirement: z.string().min(1, 'Requirement is required'),
  targetPath: z.string().min(1, 'Target path is required'),
  style: TDDStyleSchema.default('london'),
  maxCycles: z.number().int().min(1).max(50).default(10),
  framework: TestFrameworkSchema.optional(),
});

// =============================================================================
// Coverage Analysis Schemas
// =============================================================================

/**
 * Coverage analysis request schema
 */
export const CoverageAnalysisRequestSchema = z.object({
  coverageReport: z.string().optional(),
  targetPath: z.string().min(1, 'Target path is required'),
  algorithm: CoverageAlgorithmSchema.default('johnson-lindenstrauss'),
  prioritize: z.boolean().default(true),
});

// =============================================================================
// Quality Assessment Schemas
// =============================================================================

/**
 * Quality gate schema
 */
export const QualityGateSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  metric: z.string().min(1, 'Metric is required'),
  operator: QualityGateOperatorSchema,
  threshold: z.number(),
  blocking: z.boolean().default(true),
  description: z.string().optional(),
});

/**
 * Quality gate request schema
 */
export const QualityGateRequestSchema = z.object({
  gates: z.array(QualityGateSchema).optional(),
  defaults: z.enum(['strict', 'standard', 'minimal']).default('standard'),
  projectPath: z.string().optional(),
});

// =============================================================================
// Defect Intelligence Schemas
// =============================================================================

/**
 * Defect prediction request schema
 */
export const DefectPredictionRequestSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
  includeRootCause: z.boolean().default(true),
});

// =============================================================================
// Security Compliance Schemas
// =============================================================================

/**
 * Security scan request schema
 */
export const SecurityScanRequestSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  scanType: SecurityScanTypeSchema.default('sast'),
  compliance: z.array(ComplianceStandardSchema).default(['owasp-top-10']),
  severityFilter: z.union([z.literal('all'), SeveritySchema]).default('all'),
});

// =============================================================================
// Contract Testing Schemas
// =============================================================================

/**
 * Contract validation request schema
 */
export const ContractValidationRequestSchema = z.object({
  contractPath: z.string().min(1, 'Contract path is required'),
  contractType: ContractTypeSchema,
  targetUrl: z.string().url().optional(),
  strict: z.boolean().default(true),
});

/**
 * Contract comparison request schema
 */
export const ContractComparisonRequestSchema = z.object({
  oldContractPath: z.string().min(1, 'Old contract path is required'),
  newContractPath: z.string().min(1, 'New contract path is required'),
  contractType: ContractTypeSchema,
  strict: z.boolean().default(true),
});

// =============================================================================
// Chaos Engineering Schemas
// =============================================================================

/**
 * Chaos injection request schema
 */
export const ChaosInjectionRequestSchema = z.object({
  target: z.string().min(1, 'Target is required'),
  failureType: ChaosFailureTypeSchema,
  duration: z.number().int().min(1).max(3600).default(30),
  intensity: z.number().min(0).max(1).default(0.5),
  dryRun: z.boolean().default(true),
});

/**
 * Resilience assessment request schema
 */
export const ResilienceAssessmentRequestSchema = z.object({
  experimentId: z.string().min(1, 'Experiment ID is required'),
  includeRecommendations: z.boolean().default(true),
});

// =============================================================================
// Visual/Accessibility Schemas
// =============================================================================

/**
 * Visual regression request schema
 */
export const VisualRegressionRequestSchema = z.object({
  targetUrl: z.string().url('Valid URL is required'),
  componentSelector: z.string().optional(),
  viewport: z.object({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(240).max(2160),
  }).optional(),
  threshold: z.number().min(0).max(1).default(0.1),
  updateBaseline: z.boolean().default(false),
});

/**
 * Accessibility check request schema
 */
export const AccessibilityCheckRequestSchema = z.object({
  targetUrl: z.string().url('Valid URL is required'),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
  includeWarnings: z.boolean().default(true),
  selector: z.string().optional(),
});

// =============================================================================
// Plugin Configuration Schemas
// =============================================================================

/**
 * HNSW configuration schema
 */

/**
 * agentic-qe schemas — extended
 *
 * Extracted verbatim during campaign-2 wave W307. Barrel stays.
 */
import { z } from 'zod';
import {
  AccessibilityCheckRequestSchema,
  BoundedContextSchema,
  ChaosFailureTypeSchema,
  ChaosInjectionRequestSchema,
  ComplianceStandardSchema,
  ContractTypeSchema,
  ContractValidationRequestSchema,
  CoverageAlgorithmSchema,
  CoverageAnalysisRequestSchema,
  DefectPredictionRequestSchema,
  ModelTierSchema,
  QualityGateOperatorSchema,
  QualityGateRequestSchema,
  SecurityScanRequestSchema,
  SecurityScanTypeSchema,
  TDDCycleRequestSchema,
  TestFrameworkSchema,
  TestGenerationRequestSchema,
  TestTypeSchema,
  VisualRegressionRequestSchema,
} from './schemas-core.js';

export const HNSWConfigSchema = z.object({
  m: z.number().int().min(4).max(64).default(16),
  efConstruction: z.number().int().min(50).max(500).default(200),
  efSearch: z.number().int().min(10).max(300).default(100),
});

/**
 * Sandbox configuration schema
 */
export const SandboxConfigSchema = z.object({
  maxExecutionTime: z.number().int().min(1000).max(300000).default(30000),
  memoryLimit: z.number().int().min(67108864).max(2147483648).default(536870912),
  networkPolicy: z.enum(['unrestricted', 'restricted', 'blocked']).default('restricted'),
  fileSystemPolicy: z.enum(['full', 'workspace-only', 'readonly', 'none']).default('workspace-only'),
  allowedCommands: z.array(z.string()).default(['node', 'npm', 'npx', 'vitest', 'jest', 'pytest']),
  blockedPaths: z.array(z.string()).default(['/etc', '/var', '~/.ssh', '~/.aws']),
});

/**
 * Model routing configuration schema
 */
export const ModelRoutingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  preferCost: z.boolean().default(false),
  thresholds: z.object({
    tier1MaxComplexity: z.number().min(0).max(1).default(0.2),
    tier2MaxComplexity: z.number().min(0).max(1).default(0.5),
  }).default({ tier1MaxComplexity: 0.2, tier2MaxComplexity: 0.5 }),
});

/**
 * Performance targets schema
 */
export const PerformanceTargetsSchema = z.object({
  testGenerationLatency: z.string().default('<2s'),
  coverageAnalysis: z.string().default('O(log n)'),
  qualityGateEvaluation: z.string().default('<500ms'),
  securityScanPerKLOC: z.string().default('<10s'),
  mcpToolResponse: z.string().default('<100ms'),
  memoryPerContext: z.string().default('<50MB'),
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  version: z.string().default('3.2.3'),
  namespacePrefix: z.string().default('aqe/v3'),
  enabledContexts: z.array(BoundedContextSchema).default([
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
  ]),
  sandbox: SandboxConfigSchema.default({}),
  modelRouting: ModelRoutingConfigSchema.default({}),
  performanceTargets: PerformanceTargetsSchema.default({}),
});

// =============================================================================
// Memory Namespace Schema
// =============================================================================

/**
 * Schema field schema
 */
export const SchemaFieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object']),
  index: z.boolean().optional(),
  required: z.boolean().optional(),
});

/**
 * Memory namespace schema
 */
export const MemoryNamespaceSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  vectorDimension: z.number().int().min(64).max(2048),
  hnswConfig: HNSWConfigSchema,
  schema: z.record(SchemaFieldSchema),
  ttl: z.number().int().positive().nullable(),
});

// =============================================================================
// Worker Schemas
// =============================================================================

/**
 * Worker type schema
 */
export const WorkerTypeSchema = z.enum([
  'test-executor',
  'coverage-analyzer',
  'security-scanner',
]);

/**
 * Worker definition schema
 */
export const WorkerDefinitionSchema = z.object({
  type: WorkerTypeSchema,
  capabilities: z.array(z.string()),
  maxConcurrent: z.number().int().min(1).max(100).default(10),
});

/**
 * Worker dispatch request schema
 */
export const WorkerDispatchRequestSchema = z.object({
  workerType: WorkerTypeSchema,
  payload: z.unknown(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
});

// =============================================================================
// Hook Schemas
// =============================================================================

/**
 * Hook event schema
 */
export const HookEventSchema = z.enum([
  'pre-test-execution',
  'pre-security-scan',
  'post-test-execution',
  'post-coverage-analysis',
  'post-security-scan',
]);

/**
 * Hook priority schema
 */
export const HookPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

/**
 * Hook definition schema
 */
export const HookDefinitionSchema = z.object({
  event: HookEventSchema,
  description: z.string(),
  priority: HookPrioritySchema.default('normal'),
  handler: z.string(),
});

// =============================================================================
// Agent Schemas
// =============================================================================

/**
 * Agent definition schema
 */
export const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  context: BoundedContextSchema,
  capabilities: z.array(z.string()),
  modelTier: ModelTierSchema.default('sonnet'),
  description: z.string(),
});

// =============================================================================
// MCP Tool Input Schemas
// =============================================================================

/**
 * Generate tests MCP tool input schema
 */
export const GenerateTestsInputSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  testType: TestTypeSchema.default('unit'),
  framework: TestFrameworkSchema.optional(),
  coverage: z.object({
    target: z.number().min(0).max(100).default(80),
    focusGaps: z.boolean().default(true),
  }).optional(),
  style: z.enum(['tdd-london', 'tdd-chicago', 'bdd', 'example-based']).default('tdd-london'),
});

/**
 * Analyze coverage MCP tool input schema
 */
export const AnalyzeCoverageInputSchema = z.object({
  coverageReport: z.string().optional(),
  targetPath: z.string().min(1, 'Target path is required'),
  algorithm: CoverageAlgorithmSchema.default('johnson-lindenstrauss'),
  prioritize: z.boolean().default(true),
});

/**
 * Security scan MCP tool input schema
 */
export const SecurityScanInputSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  scanType: SecurityScanTypeSchema.default('sast'),
  compliance: z.array(ComplianceStandardSchema).default(['owasp-top-10']),
  severity: z.enum(['all', 'critical', 'high', 'medium']).default('all'),
});

/**
 * Validate contract MCP tool input schema
 */
export const ValidateContractInputSchema = z.object({
  contractPath: z.string().min(1, 'Contract path is required'),
  contractType: ContractTypeSchema,
  targetUrl: z.string().url().optional(),
  strict: z.boolean().default(true),
});

/**
 * Chaos inject MCP tool input schema
 */
export const ChaosInjectInputSchema = z.object({
  target: z.string().min(1, 'Target is required'),
  failureType: ChaosFailureTypeSchema,
  duration: z.number().int().min(1).max(3600).default(30),
  intensity: z.number().min(0).max(1).default(0.5),
  dryRun: z.boolean().default(true),
});

/**
 * Evaluate quality gate MCP tool input schema
 */
export const EvaluateQualityGateInputSchema = z.object({
  gates: z.array(z.object({
    metric: z.string(),
    operator: QualityGateOperatorSchema,
    threshold: z.number(),
  })).optional(),
  defaults: z.enum(['strict', 'standard', 'minimal']).default('standard'),
});

/**
 * Predict defects MCP tool input schema
 */
export const PredictDefectsInputSchema = z.object({
  targetPath: z.string().min(1, 'Target path is required'),
  depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
  includeRootCause: z.boolean().default(true),
});

/**
 * TDD cycle MCP tool input schema
 */
export const TDDCycleInputSchema = z.object({
  requirement: z.string().min(1, 'Requirement is required'),
  targetPath: z.string().min(1, 'Target path is required'),
  style: z.enum(['london', 'chicago']).default('london'),
  maxCycles: z.number().int().min(1).max(50).default(10),
});

// =============================================================================
// Export Types (inferred from schemas)
// =============================================================================

export type TestGenerationInput = z.infer<typeof TestGenerationRequestSchema>;
export type TDDCycleInput = z.infer<typeof TDDCycleRequestSchema>;
export type CoverageAnalysisInput = z.infer<typeof CoverageAnalysisRequestSchema>;
export type QualityGateInput = z.infer<typeof QualityGateRequestSchema>;
export type DefectPredictionInput = z.infer<typeof DefectPredictionRequestSchema>;
export type SecurityScanInput = z.infer<typeof SecurityScanRequestSchema>;
export type ContractValidationInput = z.infer<typeof ContractValidationRequestSchema>;
export type ChaosInjectionInput = z.infer<typeof ChaosInjectionRequestSchema>;
export type VisualRegressionInput = z.infer<typeof VisualRegressionRequestSchema>;
export type AccessibilityCheckInput = z.infer<typeof AccessibilityCheckRequestSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type ModelRoutingConfig = z.infer<typeof ModelRoutingConfigSchema>;
export type MemoryNamespace = z.infer<typeof MemoryNamespaceSchema>;
export type WorkerDefinition = z.infer<typeof WorkerDefinitionSchema>;
export type HookDefinition = z.infer<typeof HookDefinitionSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// =============================================================================
// Validation Helper Functions
// =============================================================================

/**
 * Validate input against schema with detailed errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (e) => `${e.path.join('.')}: ${e.message}`
  );

  return { success: false, errors };
}

/**
 * Create a validated request or throw
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}

/**
 * Create a validated request with defaults
 */
export function parseWithDefaults<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input ?? {});
}

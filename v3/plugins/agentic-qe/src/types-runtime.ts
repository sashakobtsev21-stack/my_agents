/**
 * Agentic QE — runtime & plugin types
 *
 * Test-execution, plugin-configuration, memory-namespace, worker, hook,
 * agent, context-mapping, and result shapes. Extracted verbatim from
 * types.ts (lines 884-1205) during the P3.58 god-file decomposition
 * (W179). types.ts stays the barrel.
 */

import type {
  BoundedContext,
  ModelTier,
  SecurityLevel,
  V3Domain,
} from './types-core.js';
import type { CoverageMetrics } from './types-analysis.js';

// Test Execution Types
// =============================================================================

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Total tests run */
  total: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests skipped */
  skipped: number;
  /** Flaky tests detected */
  flaky: number;
  /** Execution duration in ms */
  duration: number;
  /** Individual test results */
  tests: TestResult[];
  /** Coverage if collected */
  coverage?: CoverageMetrics;
}

/**
 * Individual test result
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  /** Duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Retry count */
  retries?: number;
}

// =============================================================================
// Plugin Configuration Types
// =============================================================================

/**
 * Plugin configuration
 */
export interface AQEPluginConfig {
  /** Plugin version */
  version?: string;
  /** Memory namespace prefix */
  namespacePrefix?: string;
  /** Enabled bounded contexts */
  enabledContexts?: BoundedContext[];
  /** Security sandbox config */
  sandbox?: SandboxConfig;
  /** Model routing config */
  modelRouting?: ModelRoutingConfig;
  /** Performance targets */
  performanceTargets?: QEPerformanceTargets;
}

/**
 * Security sandbox configuration
 */
export interface SandboxConfig {
  /** Maximum execution time in ms */
  maxExecutionTime: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Network policy */
  networkPolicy: 'unrestricted' | 'restricted' | 'blocked';
  /** File system policy */
  fileSystemPolicy: 'full' | 'workspace-only' | 'readonly' | 'none';
  /** Allowed commands */
  allowedCommands: string[];
  /** Blocked paths */
  blockedPaths: string[];
}

/**
 * Model routing configuration
 */
export interface ModelRoutingConfig {
  /** Enable intelligent routing */
  enabled: boolean;
  /** Prefer cost over speed */
  preferCost: boolean;
  /** Tier thresholds */
  thresholds: {
    tier1MaxComplexity: number;
    tier2MaxComplexity: number;
  };
}

/**
 * QE-specific performance targets
 */
export interface QEPerformanceTargets {
  /** Test generation latency */
  testGenerationLatency: string;
  /** Coverage analysis complexity */
  coverageAnalysis: string;
  /** Quality gate evaluation time */
  qualityGateEvaluation: string;
  /** Security scan rate */
  securityScanPerKLOC: string;
  /** MCP tool response time */
  mcpToolResponse: string;
  /** Memory per context */
  memoryPerContext: string;
}

// =============================================================================
// Memory Namespace Types
// =============================================================================

/**
 * HNSW configuration for vector search
 */
export interface HNSWConfig {
  /** Number of connections per node */
  m: number;
  /** Size of dynamic candidate list for construction */
  efConstruction: number;
  /** Size of dynamic candidate list for search */
  efSearch: number;
}

/**
 * Memory namespace definition
 */
export interface QEMemoryNamespace {
  /** Namespace name */
  name: string;
  /** Description */
  description: string;
  /** Vector dimension */
  vectorDimension: number;
  /** HNSW configuration */
  hnswConfig: HNSWConfig;
  /** Schema definition */
  schema: Record<string, SchemaField>;
  /** TTL in milliseconds (null for permanent) */
  ttl: number | null;
}

/**
 * Schema field definition
 */
export interface SchemaField {
  /** Field type */
  type: 'string' | 'number' | 'boolean' | 'object';
  /** Whether field is indexed */
  index?: boolean;
  /** Whether field is required */
  required?: boolean;
}

// =============================================================================
// Worker Types
// =============================================================================

/**
 * Worker type identifiers
 */
export type QEWorkerType =
  | 'test-executor'
  | 'coverage-analyzer'
  | 'security-scanner';

/**
 * Worker definition
 */
export interface QEWorkerDefinition {
  /** Worker type */
  type: QEWorkerType;
  /** Worker capabilities */
  capabilities: string[];
  /** Maximum concurrent instances */
  maxConcurrent: number;
}

/**
 * Worker status
 */
export interface QEWorkerStatus {
  /** Worker identifier */
  id: string;
  /** Worker type */
  type: QEWorkerType;
  /** Current status */
  status: 'idle' | 'running' | 'completed' | 'error';
  /** Current task if running */
  currentTask?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Start time */
  startTime?: number;
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Hook event type
 */
export type QEHookEvent =
  | 'pre-test-execution'
  | 'pre-security-scan'
  | 'post-test-execution'
  | 'post-coverage-analysis'
  | 'post-security-scan';

/**
 * Hook priority
 */
export type HookPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Hook definition
 */
export interface QEHookDefinition {
  /** Hook event */
  event: QEHookEvent;
  /** Hook description */
  description: string;
  /** Hook priority */
  priority: HookPriority;
  /** Handler function name */
  handler: string;
}

// =============================================================================
// Agent Types
// =============================================================================

/**
 * QE agent identifier
 */
export type QEAgentId = string;

/**
 * QE agent status
 */
export type QEAgentStatus = 'idle' | 'active' | 'blocked' | 'error';

/**
 * QE agent definition
 */
export interface QEAgentDefinition {
  /** Agent identifier */
  id: QEAgentId;
  /** Agent name */
  name: string;
  /** Bounded context */
  context: BoundedContext;
  /** Agent capabilities */
  capabilities: string[];
  /** Model tier preference */
  modelTier: ModelTier;
  /** Description */
  description: string;
}

// =============================================================================
// Context Mapping Types
// =============================================================================

/**
 * Mapping between QE context and V3 domains
 */
export interface ContextMapping {
  /** QE bounded context */
  qeContext: BoundedContext;
  /** V3 domains this context integrates with */
  v3Domains: V3Domain[];
  /** Agents in this context */
  agents: string[];
  /** Memory namespace for this context */
  memoryNamespace: string;
  /** Security level required */
  securityLevel: SecurityLevel;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Generic result type for operations
 */
export interface QEResult<T> {
  /** Success status */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: QEError;
  /** Warnings */
  warnings?: string[];
  /** Duration in ms */
  duration?: number;
}

/**
 * QE error structure
 */
export interface QEError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Stack trace if available */
  stack?: string;
}

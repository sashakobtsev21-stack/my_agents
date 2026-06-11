/**
 * Agentic-QE Plugin — support pieces
 *
 * The local plugin-system interface definitions, the PLUGIN_* metadata
 * constants, the ContextMapper and SecuritySandbox implementations, and
 * the memory-namespace table. These were module-private in the original
 * plugin.ts (P3.68, W189) and are deliberately NOT re-exported — the
 * public surface (AQEPlugin via index.ts) is unchanged.
 */

import type {
  AQEPluginConfig,
  BoundedContext,
  ContextMapping,
  ModelTier,
  QEMemoryNamespace,
  SecurityLevel,
  V3Domain,
} from './types.js';

// Local Interface Definitions (for plugin system integration)
// =============================================================================

/**
 * Plugin interface for V3 plugin system
 */
export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly capabilities: readonly string[];
  register(registry: IPluginRegistry): Promise<void>;
  initialize(context: IPluginContext): Promise<void>;
  shutdown(): Promise<void>;
  getHealth(): Promise<PluginHealthStatus>;
}

/**
 * Plugin registry for tool/hook/worker registration
 */
export interface IPluginRegistry {
  registerTool?(tool: IMCPTool): void;
  registerHook?(hook: QEHookDefinition): void;
  registerWorker?(worker: QEWorkerDefinition): void;
  registerAgent?(agent: QEAgentDefinition): void;
  registerTools?(tools: IMCPTool[]): void;
  registerHooks?(hooks: QEHookDefinition[]): void;
  registerWorkers?(workers: QEWorkerDefinition[]): void;
  registerAgents?(agents: QEAgentDefinition[]): void;
}

/**
 * Plugin context with V3 services
 */
export interface IPluginContext {
  services: {
    memory?: unknown;
    security?: unknown;
    embeddings?: unknown;
    modelRouter?: unknown;
    hiveMind?: unknown;
    ui?: unknown;
  };
  config: Record<string, unknown>;
  logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };
  getConfig?(): Record<string, unknown>;
  set?(key: string, value: unknown): void;
  getMemoryService?(): {
    clearNamespace(ns: string): Promise<void>;
    createNamespace?(config: unknown): Promise<void>;
  } | null;
  getSecurityModule?(): { pathValidator: { validate(path: string): Promise<{ valid: boolean; error?: string }> } } | null;
  getUIService?(): { confirm(message: string): Promise<boolean> } | null;
}

/**
 * MCP tool interface
 */
export interface IMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category?: string;
  version?: string;
  handler?: (input: unknown, context: IPluginContext) => Promise<MCPToolResult>;
  execute?: (input: unknown, context: IPluginContext) => Promise<MCPToolResult>;
}

/**
 * MCP tool result
 */
export interface MCPToolResult {
  content?: Array<{ type: string; text: string }>;
  success?: boolean;
  data?: unknown;
  error?: string;
  isError?: boolean;
}

/**
 * Plugin health status
 */
export interface PluginHealthStatus {
  healthy: boolean;
  status?: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentHealth>;
  lastCheck: number;
  uptime: number;
}

/**
 * Component health
 */
export interface ComponentHealth {
  name: string;
  healthy: boolean;
  status?: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: number;
  lastSuccess?: number;
}

/**
 * Hook definition
 */
export interface QEHookDefinition {
  name: string;
  event: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  description?: string;
  handler: string | ((context: IPluginContext, data: unknown) => Promise<void>);
}

/**
 * Worker definition
 */
export interface QEWorkerDefinition {
  name: string;
  type: string;
  capabilities?: string[];
  maxConcurrent?: number;
  handler?: (context: IPluginContext, input: unknown) => Promise<unknown>;
}

/**
 * Agent definition
 */
export interface QEAgentDefinition {
  id: string;
  name?: string;
  type?: string;
  context: string | BoundedContext;
  capabilities: string[];
  modelTier?: ModelTier;
  description?: string;
}

/**
 * Context mapper interface
 */
export interface IContextMapper {
  mapToV3Domain(context: BoundedContext): V3Domain[];
  getAgentsForContext(context: BoundedContext): string[];
  getMemoryNamespace(context: BoundedContext): string;
  getSecurityLevel(context: BoundedContext): SecurityLevel;
}

/**
 * Security sandbox interface
 */
export interface ISecuritySandbox {
  execute<T>(fn: () => Promise<T>, options?: SandboxExecutionOptions): Promise<T>;
  validatePath(path: string): boolean;
  getResourceUsage(): ResourceUsage;
}

export interface SandboxExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  allowNetwork?: boolean;
  allowFileSystem?: boolean;
  allowFileWrite?: boolean;
  workingDirectory?: string;
  securityLevel?: SecurityLevel;
}

export interface ResourceUsage {
  memoryBytes?: number;
  memoryUsed?: number;
  cpuMs?: number;
  cpuTime?: number;
  networkRequests?: number;
  fileOperations?: number;
  activeOperations?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const PLUGIN_NAME = 'agentic-qe';
export const PLUGIN_VERSION = '3.2.3';
export const PLUGIN_DESCRIPTION = 'Quality Engineering plugin with 51 specialized agents across 12 DDD bounded contexts';
export const PLUGIN_AUTHOR = 'rUv';

export const PLUGIN_CAPABILITIES = [
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
] as const;

// =============================================================================
// Context Mapper Implementation
// =============================================================================

/**
 * Maps QE bounded contexts to V3 domains
 */
export class ContextMapper implements IContextMapper {
  private mappings: Map<BoundedContext, ContextMapping> = new Map();

  constructor() {
    this.initializeMappings();
  }

  private initializeMappings(): void {
    const mappingData: ContextMapping[] = [
      {
        qeContext: 'test-generation',
        v3Domains: ['Core', 'Integration'],
        agents: [
          'unit-test-generator', 'integration-test-generator',
          'e2e-test-generator', 'property-test-generator',
          'mutation-test-generator', 'fuzz-test-generator',
          'api-test-generator', 'performance-test-generator',
          'security-test-generator', 'accessibility-test-generator',
          'contract-test-generator', 'bdd-test-generator',
        ],
        memoryNamespace: 'aqe/v3/test-patterns',
        securityLevel: 'medium',
      },
      {
        qeContext: 'test-execution',
        v3Domains: ['Core', 'Coordination'],
        agents: [
          'test-runner', 'parallel-executor', 'retry-manager',
          'result-aggregator', 'flaky-test-detector',
          'timeout-manager', 'resource-allocator', 'test-reporter',
        ],
        memoryNamespace: 'aqe/v3/test-execution',
        securityLevel: 'high',
      },
      {
        qeContext: 'coverage-analysis',
        v3Domains: ['Core', 'Memory'],
        agents: [
          'coverage-collector', 'gap-detector', 'priority-ranker',
          'hotspot-analyzer', 'trend-tracker', 'impact-assessor',
        ],
        memoryNamespace: 'aqe/v3/coverage-data',
        securityLevel: 'low',
      },
      {
        qeContext: 'quality-assessment',
        v3Domains: ['Core'],
        agents: [
          'quality-gate-evaluator', 'readiness-assessor',
          'risk-calculator', 'metric-aggregator', 'decision-maker',
        ],
        memoryNamespace: 'aqe/v3/quality',
        securityLevel: 'low',
      },
      {
        qeContext: 'defect-intelligence',
        v3Domains: ['Core', 'Memory'],
        agents: [
          'defect-predictor', 'root-cause-analyzer',
          'pattern-detector', 'regression-tracker',
        ],
        memoryNamespace: 'aqe/v3/defect-patterns',
        securityLevel: 'low',
      },
      {
        qeContext: 'requirements-validation',
        v3Domains: ['Core'],
        agents: [
          'bdd-validator', 'testability-analyzer', 'requirement-tracer',
        ],
        memoryNamespace: 'aqe/v3/requirements',
        securityLevel: 'low',
      },
      {
        qeContext: 'code-intelligence',
        v3Domains: ['Core', 'Memory', 'Integration'],
        agents: [
          'knowledge-graph-builder', 'semantic-searcher',
          'dependency-analyzer', 'complexity-assessor', 'pattern-miner',
        ],
        memoryNamespace: 'aqe/v3/code-knowledge',
        securityLevel: 'medium',
      },
      {
        qeContext: 'security-compliance',
        v3Domains: ['Security'],
        agents: [
          'sast-scanner', 'dast-scanner',
          'audit-trail-manager', 'compliance-checker',
        ],
        memoryNamespace: 'aqe/v3/security-findings',
        securityLevel: 'critical',
      },
      {
        qeContext: 'contract-testing',
        v3Domains: ['Integration'],
        agents: [
          'openapi-validator', 'graphql-validator', 'grpc-validator',
        ],
        memoryNamespace: 'aqe/v3/contracts',
        securityLevel: 'medium',
      },
      {
        qeContext: 'visual-accessibility',
        v3Domains: ['Integration'],
        agents: [
          'visual-regression-detector', 'wcag-checker', 'screenshot-differ',
        ],
        memoryNamespace: 'aqe/v3/visual-baselines',
        securityLevel: 'medium',
      },
      {
        qeContext: 'chaos-resilience',
        v3Domains: ['Core', 'Coordination'],
        agents: [
          'chaos-injector', 'load-generator',
          'resilience-assessor', 'recovery-validator',
        ],
        memoryNamespace: 'aqe/v3/chaos-experiments',
        securityLevel: 'critical',
      },
      {
        qeContext: 'learning-optimization',
        v3Domains: ['Memory', 'Integration'],
        agents: [
          'cross-domain-learner', 'pattern-optimizer',
        ],
        memoryNamespace: 'aqe/v3/learning-trajectories',
        securityLevel: 'low',
      },
    ];

    for (const mapping of mappingData) {
      this.mappings.set(mapping.qeContext, mapping);
    }
  }

  getMapping(context: BoundedContext): ContextMapping | undefined {
    return this.mappings.get(context);
  }

  mapToV3Domain(context: BoundedContext): V3Domain[] {
    return this.mappings.get(context)?.v3Domains ?? [];
  }

  getV3DomainsForContext(context: BoundedContext): V3Domain[] {
    return this.mappings.get(context)?.v3Domains ?? [];
  }

  getAgentsForContext(context: BoundedContext): string[] {
    return this.mappings.get(context)?.agents ?? [];
  }

  getAllAgents(): string[] {
    return Array.from(this.mappings.values()).flatMap((m) => m.agents);
  }

  getSecurityLevel(context: BoundedContext): SecurityLevel {
    return this.mappings.get(context)?.securityLevel ?? 'medium';
  }

  getMemoryNamespace(context: BoundedContext): string {
    return this.mappings.get(context)?.memoryNamespace ?? 'aqe/v3/default';
  }
}

// =============================================================================
// Security Sandbox Implementation
// =============================================================================

/**
 * Security sandbox for executing test code safely
 */
export class SecuritySandbox implements ISecuritySandbox {
  private config: AQEPluginConfig['sandbox'];
  private activeOperations = 0;

  constructor(config: AQEPluginConfig['sandbox']) {
    this.config = config;
  }

  async execute<T>(
    fn: () => Promise<T>,
    options: {
      securityLevel?: SecurityLevel;
      allowNetwork?: boolean;
      allowFileWrite?: boolean;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const timeout = options.timeout ?? this.config?.maxExecutionTime ?? 30000;
    const level = options.securityLevel ?? 'medium';

    // Validate execution is allowed
    if (!this.checkPolicy('execute', level)) {
      throw new Error(`Execution not allowed at security level: ${level}`);
    }

    this.activeOperations++;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Execution timeout after ${timeout}ms`)),
          timeout
        );
      });

      // Race execution against timeout
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      this.activeOperations--;
    }
  }

  checkPolicy(operation: string, level: SecurityLevel): boolean {
    const levelPriority: Record<SecurityLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    // Critical operations require explicit approval
    if (levelPriority[level] >= 4 && operation === 'execute') {
      return this.config?.networkPolicy !== 'blocked';
    }

    return true;
  }

  validatePath(path: string): boolean {
    // Check against blocked paths
    const blockedPaths = this.config?.blockedPaths ?? ['/etc', '/proc', '/sys'];
    for (const blocked of blockedPaths) {
      if (path.startsWith(blocked)) {
        return false;
      }
    }
    return true;
  }

  getResourceUsage(): ResourceUsage {
    return {
      memoryUsed: process.memoryUsage().heapUsed,
      memoryBytes: process.memoryUsage().heapUsed,
      cpuTime: process.cpuUsage().user,
      cpuMs: process.cpuUsage().user / 1000,
      activeOperations: this.activeOperations,
      networkRequests: 0,
      fileOperations: 0,
    };
  }
}

// =============================================================================
// Memory Namespace Definitions
// =============================================================================

/**
 * Get all QE memory namespace definitions
 */
export function getMemoryNamespaces(): QEMemoryNamespace[] {
  return [
    {
      name: 'aqe/v3/test-patterns',
      description: 'Learned test generation patterns',
      vectorDimension: 384,
      hnswConfig: { m: 16, efConstruction: 200, efSearch: 100 },
      schema: {
        patternType: { type: 'string', index: true },
        language: { type: 'string', index: true },
        framework: { type: 'string', index: true },
        effectiveness: { type: 'number' },
        usageCount: { type: 'number' },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/coverage-data',
      description: 'Coverage analysis results and gaps',
      vectorDimension: 384,
      hnswConfig: { m: 12, efConstruction: 150, efSearch: 50 },
      schema: {
        filePath: { type: 'string', index: true },
        linesCovered: { type: 'number' },
        linesTotal: { type: 'number' },
        branchCoverage: { type: 'number' },
        gapType: { type: 'string', index: true },
        priority: { type: 'number' },
      },
      ttl: 86400000, // 24h
    },
    {
      name: 'aqe/v3/defect-patterns',
      description: 'Defect intelligence and predictions',
      vectorDimension: 384,
      hnswConfig: { m: 16, efConstruction: 200, efSearch: 100 },
      schema: {
        defectType: { type: 'string', index: true },
        severity: { type: 'string', index: true },
        rootCause: { type: 'string' },
        resolution: { type: 'string' },
        recurrence: { type: 'number' },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/code-knowledge',
      description: 'Code intelligence knowledge graph',
      vectorDimension: 384,
      hnswConfig: { m: 24, efConstruction: 300, efSearch: 150 },
      schema: {
        nodeType: { type: 'string', index: true },
        nodeName: { type: 'string', index: true },
        filePath: { type: 'string', index: true },
        complexity: { type: 'number' },
        dependencies: { type: 'string' },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/security-findings',
      description: 'Security scan findings and compliance',
      vectorDimension: 384,
      hnswConfig: { m: 16, efConstruction: 200, efSearch: 100 },
      schema: {
        findingType: { type: 'string', index: true },
        severity: { type: 'string', index: true },
        cweId: { type: 'string', index: true },
        filePath: { type: 'string' },
        lineNumber: { type: 'number' },
        remediation: { type: 'string' },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/contracts',
      description: 'API contract definitions and validations',
      vectorDimension: 384,
      hnswConfig: { m: 12, efConstruction: 150, efSearch: 50 },
      schema: {
        contractType: { type: 'string', index: true },
        serviceName: { type: 'string', index: true },
        version: { type: 'string' },
        endpoint: { type: 'string' },
        validationStatus: { type: 'string', index: true },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/visual-baselines',
      description: 'Visual regression baselines and diffs',
      vectorDimension: 768, // Higher dim for image embeddings
      hnswConfig: { m: 32, efConstruction: 400, efSearch: 200 },
      schema: {
        componentId: { type: 'string', index: true },
        viewport: { type: 'string', index: true },
        baselineHash: { type: 'string' },
        lastUpdated: { type: 'number' },
      },
      ttl: null,
    },
    {
      name: 'aqe/v3/chaos-experiments',
      description: 'Chaos engineering experiments and results',
      vectorDimension: 384,
      hnswConfig: { m: 12, efConstruction: 150, efSearch: 50 },
      schema: {
        experimentType: { type: 'string', index: true },
        targetService: { type: 'string', index: true },
        failureMode: { type: 'string' },
        impactLevel: { type: 'string' },
        recoveryTime: { type: 'number' },
      },
      ttl: 604800000, // 7 days
    },
    {
      name: 'aqe/v3/learning-trajectories',
      description: 'ReasoningBank learning trajectories for QE',
      vectorDimension: 384,
      hnswConfig: { m: 16, efConstruction: 200, efSearch: 100 },
      schema: {
        taskType: { type: 'string', index: true },
        agentId: { type: 'string', index: true },
        success: { type: 'boolean', index: true },
        reward: { type: 'number' },
        trajectory: { type: 'string' },
      },
      ttl: null,
    },
  ];
}

// =============================================================================

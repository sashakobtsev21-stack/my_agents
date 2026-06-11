/**
 * Agentic-QE Plugin Interfaces — core bridge
 *
 * Extracted verbatim from interfaces.ts (lines 460-781) during the P3.59
 * god-file decomposition (W180). interfaces.ts stays the barrel.
 */

// Core Bridge Interfaces
// =============================================================================

/**
 * Test suite definition
 */
export interface TestSuite {
  /** Unique identifier */
  id: string;

  /** Suite name */
  name: string;

  /** Test framework */
  framework: string;

  /** Individual test cases */
  testCases: TestCase[];

  /** Estimated duration in ms */
  estimatedDuration: number;

  /** Configuration */
  config: TestSuiteConfig;
}

/**
 * Test case definition
 */
export interface TestCase {
  /** Test identifier */
  id: string;

  /** Test name */
  name: string;

  /** Test file path */
  filePath: string;

  /** Test function or describe block */
  testBlock: string;

  /** Tags */
  tags: string[];

  /** Estimated duration */
  estimatedDuration: number;
}

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Run tests in parallel */
  parallel: boolean;

  /** Maximum parallel workers */
  maxWorkers: number;

  /** Retry count for flaky tests */
  retryCount: number;

  /** Timeout per test */
  testTimeout: number;

  /** Coverage collection */
  collectCoverage: boolean;

  /** Watch mode */
  watch: boolean;
}

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /** Enable parallel execution */
  parallel: boolean;

  /** Maximum workers */
  maxWorkers: number;

  /** Retry count */
  retryCount: number;

  /** Timeout in ms */
  timeout: number;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Agent handle for managing spawned agents
 */
export interface AgentHandle {
  /** Agent identifier */
  id: string;

  /** Agent type */
  type: string;

  /** Agent name */
  name: string;

  /** Current status */
  status: 'spawning' | 'ready' | 'busy' | 'error' | 'terminated';

  /** Terminate the agent */
  terminate(): Promise<void>;

  /** Send a message to the agent */
  send(message: Record<string, unknown>): Promise<void>;
}

/**
 * Task handle for managing created tasks
 */
export interface TaskHandle {
  /** Task identifier */
  id: string;

  /** Task type */
  type: string;

  /** Current status */
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** Wait for task completion */
  wait(): Promise<TaskResult>;

  /** Cancel the task */
  cancel(): Promise<void>;

  /** Get task progress */
  getProgress(): Promise<TaskProgress>;
}

/**
 * Task result
 */
export interface TaskResult {
  /** Task identifier */
  taskId: string;

  /** Whether task succeeded */
  success: boolean;

  /** Result data */
  data?: Record<string, unknown>;

  /** Error if failed */
  error?: string;

  /** Duration in ms */
  durationMs: number;
}

/**
 * Task progress
 */
export interface TaskProgress {
  /** Completion percentage (0-100) */
  percentage: number;

  /** Current step */
  currentStep: string;

  /** Total steps */
  totalSteps: number;

  /** Completed steps */
  completedSteps: number;

  /** Estimated remaining time in ms */
  estimatedRemainingMs: number;
}

/**
 * Quality gate definition
 */
export interface QualityGate {
  /** Gate identifier */
  id: string;

  /** Gate name */
  name: string;

  /** Evaluation criteria */
  criteria: QualityGateCriteria;

  /** Required for release */
  required: boolean;

  /** Gate weight in overall score */
  weight: number;
}

/**
 * Quality gate criteria
 */
export interface QualityGateCriteria {
  /** Metric to evaluate */
  metric: string;

  /** Comparison operator */
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';

  /** Threshold value */
  threshold: number;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  /** Code coverage percentage */
  coveragePercent: number;

  /** Number of passing tests */
  testsPassed: number;

  /** Number of failing tests */
  testsFailed: number;

  /** Number of skipped tests */
  testsSkipped: number;

  /** Number of security issues */
  securityIssues: number;

  /** Code complexity score */
  complexityScore: number;

  /** Technical debt minutes */
  technicalDebtMinutes: number;

  /** Custom metrics */
  custom: Record<string, number>;
}

/**
 * Workflow result
 */
export interface WorkflowResult {
  /** Workflow identifier */
  workflowId: string;

  /** Whether workflow succeeded */
  success: boolean;

  /** Step results */
  stepResults: StepResult[];

  /** Overall duration */
  durationMs: number;

  /** Final output */
  output?: Record<string, unknown>;
}

/**
 * Step result
 */
export interface StepResult {
  /** Step name */
  name: string;

  /** Whether step passed */
  passed: boolean;

  /** Step output */
  output?: Record<string, unknown>;

  /** Error if failed */
  error?: string;

  /** Duration */
  durationMs: number;
}

/**
 * Task priority
 */
export type Priority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Core bridge interface for V3 core services
 */
export interface IQECoreBridge {
  /**
   * Spawn a test execution agent
   */
  spawnTestExecutor(testSuite: TestSuite, config: ExecutorConfig): Promise<AgentHandle>;

  /**
   * Create a test execution task
   */
  createTestTask(testSuite: TestSuite, priority: Priority): Promise<TaskHandle>;

  /**
   * Execute a quality gate workflow
   */
  executeQualityGateWorkflow(gates: QualityGate[], metrics: QualityMetrics): Promise<WorkflowResult>;

  /**
   * Get configuration value
   */
  getConfig<T>(key: string): Promise<T | undefined>;

  /**
   * List available agents by type
   */
  listAgents(filter?: { type?: string; status?: string }): Promise<AgentHandle[]>;

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Promise<AgentHandle | null>;
}

// =============================================================================

/**
 * Hooks types — extended
 *
 * Extracted verbatim during campaign-2 wave W301. Barrel stays.
 */

// ============================================================================
// Daemon Types
// ============================================================================

/**
 * Daemon status
 */
export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Daemon name */
  name: string;

  /** Update interval in milliseconds */
  interval: number;

  /** Whether the daemon is enabled */
  enabled: boolean;

  /** PID file path */
  pidFile?: string;

  /** Log file path */
  logFile?: string;

  /** Custom configuration */
  config?: Record<string, unknown>;
}

/**
 * Daemon state
 */
export interface DaemonState {
  /** Daemon name */
  name: string;

  /** Current status */
  status: DaemonStatus;

  /** Process ID if running */
  pid?: number;

  /** Started timestamp */
  startedAt?: Date;

  /** Last update timestamp */
  lastUpdateAt?: Date;

  /** Error message if status is 'error' */
  error?: string;

  /** Execution count */
  executionCount: number;

  /** Failure count */
  failureCount: number;
}

/**
 * Daemon manager configuration
 */
export interface DaemonManagerConfig {
  /** Base directory for PID files */
  pidDirectory: string;

  /** Base directory for log files */
  logDirectory: string;

  /** Daemons to manage */
  daemons: DaemonConfig[];

  /** Auto-restart on failure */
  autoRestart: boolean;

  /** Max restart attempts */
  maxRestartAttempts: number;
}

// ============================================================================
// Statusline Types
// ============================================================================

/**
 * Statusline data
 */
export interface StatuslineData {
  /** V3 implementation progress */
  v3Progress: {
    domainsCompleted: number;
    totalDomains: number;
    dddProgress: number;
    modulesCount: number;
    filesCount: number;
    linesCount: number;
  };

  /** Security status */
  security: {
    status: 'PENDING' | 'IN_PROGRESS' | 'CLEAN';
    cvesFixed: number;
    totalCves: number;
  };

  /** Swarm activity */
  swarm: {
    activeAgents: number;
    maxAgents: number;
    coordinationActive: boolean;
  };

  /** Hooks metrics */
  hooks: {
    status: 'ACTIVE' | 'INACTIVE';
    patternsLearned: number;
    routingAccuracy: number;
    totalOperations: number;
  };

  /** Performance targets */
  performance: {
    flashAttentionTarget: string;
    searchImprovement: string;
    memoryReduction: string;
  };

  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Statusline configuration
 */
export interface StatuslineConfig {
  /** Enable statusline */
  enabled: boolean;

  /** Refresh on hook execution */
  refreshOnHook: boolean;

  /** Show hooks metrics */
  showHooksMetrics: boolean;

  /** Show swarm activity */
  showSwarmActivity: boolean;

  /** Show performance targets */
  showPerformance: boolean;

  /** Custom format template */
  formatTemplate?: string;
}

// ============================================================================
// Metrics Database Types
// ============================================================================

/**
 * Hooks metrics record
 */
export interface HooksMetricsRecord {
  id: number;
  totalExecutions: number;
  totalFailures: number;
  avgExecutionTime: number;
  patternsLearned: number;
  routingConfidence: number;
  lastUpdated: string;
}

/**
 * Hook stats record
 */
export interface HookStatsRecord {
  hookName: string;
  category: string;
  executionCount: number;
  successRate: number;
  avgTimeMs: number;
  lastExecuted: string;
}

/**
 * Routing history record
 */
export interface RoutingHistoryRecord {
  id: number;
  taskHash: string;
  recommendedAgent: string;
  confidence: number;
  wasSuccessful: boolean;
  timestamp: string;
}

/**
 * Learning pattern record
 */
export interface LearningPatternRecord {
  patternId: string;
  category: string;
  qualityScore: number;
  usageCount: number;
  createdAt: string;
  lastUsed: string;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * Pre-edit hook input
 */
export interface PreEditInput {
  filePath: string;
  operation?: 'create' | 'modify' | 'delete';
  includeContext?: boolean;
  includeSuggestions?: boolean;
}

/**
 * Pre-edit hook result
 */
export interface PreEditResult {
  filePath: string;
  operation: string;
  context?: {
    fileExists: boolean;
    fileType?: string;
    relatedFiles?: string[];
    similarPatterns?: Array<{
      pattern: string;
      confidence: number;
      description: string;
    }>;
  };
  suggestions?: Array<{
    agent: string;
    suggestion: string;
    confidence: number;
    rationale: string;
  }>;
  warnings?: string[];
}

/**
 * Post-edit hook input
 */
export interface PostEditInput {
  filePath: string;
  operation?: 'create' | 'modify' | 'delete';
  success: boolean;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Post-edit hook result
 */
export interface PostEditResult {
  filePath: string;
  operation: string;
  success: boolean;
  recorded: boolean;
  recordedAt: string;
  patternId?: string;
}

/**
 * Route task input
 */
export interface RouteTaskInput {
  task: string;
  context?: string;
  preferredAgents?: string[];
  constraints?: Record<string, unknown>;
  includeExplanation?: boolean;
}

/**
 * Route task result
 */
export interface RouteTaskResult {
  task: string;
  recommendedAgent: string;
  confidence: number;
  alternativeAgents?: Array<{
    agent: string;
    confidence: number;
  }>;
  explanation?: string;
  reasoning?: {
    factors: Array<{
      factor: string;
      weight: number;
      value: number;
    }>;
    historicalPerformance?: Array<{
      agent: string;
      successRate: number;
      avgQuality: number;
      tasksSimilar: number;
    }>;
  };
}

/**
 * Metrics query input
 */
export interface MetricsQueryInput {
  category?: 'all' | 'routing' | 'edits' | 'commands' | 'patterns';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'all';
  includeDetailedStats?: boolean;
  format?: 'json' | 'summary';
}

/**
 * Metrics query result
 */
export interface MetricsQueryResult {
  category: string;
  timeRange: string;
  summary: {
    totalOperations: number;
    successRate: number;
    avgQuality: number;
    patternsLearned: number;
  };
  routing?: {
    totalRoutes: number;
    avgConfidence: number;
    topAgents: Array<{
      agent: string;
      count: number;
      successRate: number;
    }>;
  };
  edits?: {
    totalEdits: number;
    successRate: number;
    commonPatterns: string[];
  };
  commands?: {
    totalCommands: number;
    successRate: number;
    avgExecutionTime: number;
    commonCommands: string[];
  };
  detailedStats?: Record<string, unknown>;
}

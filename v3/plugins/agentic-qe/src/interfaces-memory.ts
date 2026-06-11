/**
 * Agentic-QE Plugin Interfaces — memory bridge
 *
 * Extracted verbatim from interfaces.ts (lines 12-252) during the P3.59
 * god-file decomposition (W180). interfaces.ts stays the barrel.
 */

// =============================================================================
// Memory Bridge Interfaces
// =============================================================================

/**
 * Test pattern learned from successful test generation
 */
export interface TestPattern {
  /** Unique identifier */
  id: string;

  /** Type of test (unit, integration, e2e, etc.) */
  type: TestPatternType;

  /** Programming language */
  language: string;

  /** Test framework (vitest, jest, pytest, etc.) */
  framework: string;

  /** Natural language description */
  description: string;

  /** The pattern's code template or structure */
  code: string;

  /** Tags for categorization */
  tags: string[];

  /** Effectiveness score from usage (0-1) */
  effectiveness: number;

  /** Number of times this pattern has been used */
  usageCount: number;

  /** Creation timestamp */
  createdAt: number;

  /** Last used timestamp */
  lastUsedAt: number;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export type TestPatternType =
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
 * Filters for pattern search
 */
export interface PatternFilters {
  type?: TestPatternType;
  language?: string;
  framework?: string;
  tags?: string[];
  minEffectiveness?: number;
}

/**
 * Coverage gap detected during analysis
 */
export interface CoverageGap {
  /** Unique identifier */
  id: string;

  /** File path with gap */
  file: string;

  /** Type of gap (line, branch, function) */
  type: 'line' | 'branch' | 'function' | 'statement';

  /** Location information */
  location: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };

  /** Risk score (0-1, higher = more risky) */
  riskScore: number;

  /** Priority ranking */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Reason for the gap */
  reason: string;

  /** Suggested test approach */
  suggestion: string;

  /** Detection timestamp */
  detectedAt: number;
}

/**
 * Learning trajectory for ReasoningBank integration
 */
export interface LearningTrajectory {
  /** Unique identifier */
  id: string;

  /** Type of task that generated this trajectory */
  taskType: string;

  /** Agent that performed the task */
  agentId: string;

  /** Whether the task succeeded */
  success: boolean;

  /** Reward signal for reinforcement learning */
  reward: number;

  /** Sequence of steps taken */
  steps: LearningStep[];

  /** Final verdict */
  verdict: 'success' | 'failure' | 'partial';

  /** Creation timestamp */
  createdAt: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Additional context */
  context: Record<string, unknown>;
}

/**
 * Single step in a learning trajectory
 */
export interface LearningStep {
  /** Step index */
  index: number;

  /** Action taken */
  action: string;

  /** Input to the action */
  input: Record<string, unknown>;

  /** Output from the action */
  output: Record<string, unknown>;

  /** Quality score for this step */
  quality: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Memory bridge interface for V3 memory integration
 */
export interface IQEMemoryBridge {
  /**
   * Initialize memory namespaces
   */
  initialize(): Promise<void>;

  /**
   * Store a test pattern with semantic embedding
   */
  storeTestPattern(pattern: TestPattern): Promise<string>;

  /**
   * Search for similar patterns using HNSW (HNSW-indexed (measured ~1.9x-4.7x))
   */
  searchSimilarPatterns(
    query: string,
    k?: number,
    filters?: PatternFilters
  ): Promise<TestPattern[]>;

  /**
   * Store a coverage gap
   */
  storeCoverageGap(gap: CoverageGap): Promise<string>;

  /**
   * Get coverage gaps for a file
   */
  getCoverageGaps(file: string): Promise<CoverageGap[]>;

  /**
   * Get prioritized coverage gaps
   */
  getPrioritizedGaps(limit?: number): Promise<CoverageGap[]>;

  /**
   * Store a learning trajectory for ReasoningBank
   */
  storeTrajectory(trajectory: LearningTrajectory): Promise<string>;

  /**
   * Search trajectories by similarity
   */
  searchTrajectories(
    query: string,
    k?: number,
    filters?: { taskType?: string; success?: boolean }
  ): Promise<LearningTrajectory[]>;

  /**
   * Clear temporary data (e.g., coverage data)
   */
  clearTemporaryData(): Promise<void>;

  /**
   * Get memory statistics
   */
  getStats(): Promise<QEMemoryStats>;
}

/**
 * Memory statistics for QE namespaces
 */
export interface QEMemoryStats {
  testPatterns: number;
  coverageGaps: number;
  learningTrajectories: number;
  codeKnowledge: number;
  securityFindings: number;
  totalMemoryBytes: number;
}

// =============================================================================

/**
 * SONA Optimizer — types, tuning constants & keyword table
 *
 * The 4 public pattern/suggestion/stats shapes, the private
 * PersistedState, the confidence/decay tuning constants, and
 * KEYWORD_CATEGORIES. Extracted verbatim from sona-optimizer.ts (lines
 * 20-132 + 161-203) during campaign-2 wave 5 (W211). sona-optimizer.ts
 * re-exports ONLY the four originally-public types; everything else
 * stays unexported from the barrel.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Trajectory outcome from hooks/intelligence/trajectory-end
 */
export interface TrajectoryOutcome {
  trajectoryId: string;
  task: string;
  agent: string;
  success: boolean;
  steps?: Array<{
    action: string;
    result: string;
    quality: number;
    timestamp: string;
  }>;
  feedback?: string;
  duration?: number;
}

/**
 * Learned routing pattern
 */
export interface LearnedPattern {
  /** Keywords extracted from task descriptions */
  keywords: string[];
  /** Agent that handled the task */
  agent: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Number of successful uses */
  successCount: number;
  /** Number of failed uses */
  failureCount: number;
  /** Last time pattern was used */
  lastUsed: number;
  /** Pattern creation time */
  createdAt: number;
}

/**
 * Routing suggestion result
 */
export interface RoutingSuggestion {
  /** Recommended agent */
  agent: string;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Whether Q-learning was used */
  usedQLearning: boolean;
  /** Source of recommendation */
  source: 'sona-native' | 'sona-pattern' | 'q-learning' | 'sona-keyword' | 'default';
  /** Alternative agents with scores */
  alternatives: Array<{ agent: string; score: number }>;
  /** Matched keywords */
  matchedKeywords?: string[];
}

/**
 * SONA optimizer statistics
 */
export interface SONAStats {
  /** Total patterns learned */
  totalPatterns: number;
  /** Successful routing decisions */
  successfulRoutings: number;
  /** Failed routing decisions */
  failedRoutings: number;
  /** Total trajectories processed */
  trajectoriesProcessed: number;
  /** Average confidence of patterns */
  avgConfidence: number;
  /** Q-learning integration status */
  qLearningEnabled: boolean;
  /** Time of last learning update */
  lastUpdate: number | null;
  /** Contrastive trainer status (from @ruvector/ruvllm) */
  _contrastiveTrainer?: { triplets: number; agents: number } | 'unavailable';
}

/**
 * Persisted state structure
 */
export interface PersistedState {
  version: string;
  patterns: Record<string, LearnedPattern>;
  stats: {
    trajectoriesProcessed: number;
    successfulRoutings: number;
    failedRoutings: number;
    lastUpdate: number | null;
  };
  metadata: {
    createdAt: string;
    savedAt: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PERSISTENCE_PATH = '.swarm/sona-patterns.json';
export const PATTERN_VERSION = '1.0.0';
export const MIN_CONFIDENCE = 0.1;
export const MAX_CONFIDENCE = 0.99;
export const CONFIDENCE_INCREMENT = 0.1;
export const CONFIDENCE_DECREMENT = 0.15;
export const DECAY_RATE = 0.01; // Per day
export const MAX_PATTERNS = 1000;


export const KEYWORD_CATEGORIES: Record<string, string[]> = {
  coder: [
    'implement', 'code', 'write', 'create', 'build', 'develop', 'add',
    'feature', 'function', 'class', 'module', 'api', 'endpoint',
  ],
  tester: [
    'test', 'spec', 'coverage', 'unit', 'integration', 'e2e', 'mock',
    'assert', 'expect', 'verify', 'validate', 'scenario',
  ],
  reviewer: [
    'review', 'check', 'audit', 'analyze', 'inspect', 'evaluate',
    'quality', 'standards', 'best-practices', 'lint',
  ],
  architect: [
    'architect', 'design', 'structure', 'pattern', 'system', 'schema',
    'database', 'infrastructure', 'scalability', 'architecture',
  ],
  researcher: [
    'research', 'investigate', 'explore', 'find', 'search', 'discover',
    'analyze', 'understand', 'learn', 'study',
  ],
  optimizer: [
    'optimize', 'performance', 'speed', 'memory', 'improve', 'enhance',
    'faster', 'efficient', 'reduce', 'benchmark',
  ],
  debugger: [
    'debug', 'fix', 'bug', 'error', 'issue', 'problem', 'crash',
    'exception', 'trace', 'diagnose', 'resolve',
  ],
  documenter: [
    'document', 'docs', 'readme', 'comment', 'explain', 'guide',
    'tutorial', 'api-docs', 'specification', 'jsdoc',
  ],
  'security-architect': [
    'security', 'auth', 'authentication', 'authorization', 'encrypt',
    'vulnerability', 'cve', 'secure', 'permission', 'role',
  ],
  'performance-engineer': [
    'profiling', 'bottleneck', 'latency', 'throughput', 'cache',
    'scale', 'load', 'stress', 'concurrent', 'parallel',
  ],
};


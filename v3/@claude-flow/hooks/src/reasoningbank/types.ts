/**
 * V3 ReasoningBank — types & guidance tables
 *
 * The pattern/result/config/metrics shapes plus DEFAULT_CONFIG,
 * AGENT_PATTERNS, and DOMAIN_GUIDANCE. Extracted verbatim from
 * reasoningbank/index.ts (lines 27-188) during the P3.51 god-file
 * decomposition (W172). index.ts re-exports the five public interfaces;
 * the three tables stay unexported from the barrel (module-private
 * pre-split). The mutable dynamic-import bindings (AgentDBAdapter /
 * HNSWIndex / EmbeddingServiceImpl) deliberately stay in index.ts —
 * moving them would break their in-module reassignment (TS2540).
 */

export interface GuidancePattern {
  id: string;
  strategy: string;
  domain: string;
  embedding: Float32Array;
  quality: number;
  usageCount: number;
  successCount: number;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Guidance result from pattern search
 */
export interface GuidanceResult {
  patterns: Array<{
    pattern: GuidancePattern;
    similarity: number;
  }>;
  context: string;
  recommendations: string[];
  agentSuggestion?: {
    agent: string;
    confidence: number;
    reasoning: string;
  };
  searchTimeMs: number;
}

/**
 * Agent routing result
 */
export interface RoutingResult {
  agent: string;
  confidence: number;
  alternatives: Array<{ agent: string; confidence: number }>;
  reasoning: string;
  historicalPerformance?: {
    successRate: number;
    avgQuality: number;
    taskCount: number;
  };
}

/**
 * ReasoningBank configuration
 */
export interface ReasoningBankConfig {
  /** Vector dimensions (384 for MiniLM, 1536 for OpenAI) */
  dimensions: number;
  /** HNSW M parameter */
  hnswM: number;
  /** HNSW ef construction */
  hnswEfConstruction: number;
  /** HNSW ef search */
  hnswEfSearch: number;
  /** Maximum patterns in short-term memory */
  maxShortTerm: number;
  /** Maximum patterns in long-term memory */
  maxLongTerm: number;
  /** Promotion threshold (usage count) */
  promotionThreshold: number;
  /** Quality threshold for promotion */
  qualityThreshold: number;
  /** Deduplication similarity threshold */
  dedupThreshold: number;
  /** Database path */
  dbPath: string;
  /** Use mock embeddings (for testing) */
  useMockEmbeddings?: boolean;
}

/**
 * ReasoningBank metrics
 */
export interface ReasoningBankMetrics {
  patternsStored: number;
  patternsRetrieved: number;
  searchCount: number;
  totalSearchTime: number;
  promotions: number;
  hnswSearchTime: number;
  bruteForceSearchTime: number;
}

export const DEFAULT_CONFIG: ReasoningBankConfig = {
  dimensions: 384, // MiniLM-L6
  hnswM: 16,
  hnswEfConstruction: 200,
  hnswEfSearch: 100,
  maxShortTerm: 1000,
  maxLongTerm: 5000,
  promotionThreshold: 3,
  qualityThreshold: 0.6,
  dedupThreshold: 0.95,
  dbPath: '.claude-flow/memory.db',
  useMockEmbeddings: false,
};

/**
 * Agent mapping for routing
 */
export const AGENT_PATTERNS: Record<string, RegExp> = {
  'security-architect': /security|auth|cve|vuln|encrypt|password|token/i,
  'test-architect': /test|spec|mock|coverage|tdd|assert/i,
  'performance-engineer': /perf|optim|fast|memory|cache|speed|slow/i,
  'core-architect': /architect|design|ddd|domain|refactor|struct/i,
  'swarm-specialist': /swarm|agent|coordinate|orchestrat|parallel/i,
  'memory-specialist': /memory|agentdb|hnsw|vector|embedding/i,
  'coder': /fix|bug|implement|create|add|build|error|code/i,
  'reviewer': /review|quality|lint|check|audit/i,
};

/**
 * Domain-specific guidance templates
 */
export const DOMAIN_GUIDANCE: Record<string, string[]> = {
  security: [
    'Validate all inputs at system boundaries',
    'Use parameterized queries (no string concatenation)',
    'Store secrets in environment variables only',
    'Apply principle of least privilege',
    'Check OWASP Top 10 patterns',
  ],
  testing: [
    'Write test first, then implementation (TDD)',
    'Mock external dependencies',
    'Test behavior, not implementation',
    'One assertion per test concept',
    'Use descriptive test names',
  ],
  performance: [
    'Use HNSW for vector search (not brute-force)',
    'Batch database operations',
    'Implement caching at appropriate layers',
    'Profile before optimizing',
    'Target: <1ms searches, <100ms operations',
  ],
  architecture: [
    'Respect bounded context boundaries',
    'Use domain events for cross-module communication',
    'Keep domain logic in domain layer',
    'Infrastructure adapters for external services',
    'Follow ADR decisions (ADR-001 through ADR-010)',
  ],
  debugging: [
    'Reproduce the issue first',
    'Check recent changes in git log',
    'Add logging before fixing',
    'Write regression test',
    "Verify fix doesn't break other tests",
  ],
};

/**
 * ReasoningBank - Vector-based pattern storage and retrieval
 *
 * Uses AgentDB adapter for HNSW-indexed pattern storage.
 * Provides guidance generation from learned patterns.
 */

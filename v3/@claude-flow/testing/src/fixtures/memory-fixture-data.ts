/**
 * Memory Fixtures — entry/result/pattern/config data tables
 *
 * Extracted verbatim from memory-fixtures.ts (lines 154-550) during
 * campaign-2 wave 83 (W289). memory-fixtures.ts stays the barrel
 * ('export *'; type-only back-imports).
 */

import type {
  HNSWConfig,
  LearnedPattern,
  MemoryBackendConfig,
  MemoryEntry,
  QuantizationConfig,
  SearchResult,
} from './memory-fixtures.js';
import { generateMockEmbedding } from './memory-fixtures.js';

export const memoryEntries: Record<string, MemoryEntry> = {
  agentPattern: {
    key: 'pattern:agent:queen-coordinator',
    value: {
      pattern: 'orchestration',
      successRate: 0.95,
      avgDuration: 150,
      commonTasks: ['task-distribution', 'conflict-resolution', 'priority-scheduling'],
    },
    metadata: {
      type: 'semantic',
      tags: ['agent', 'pattern', 'queen', 'coordination'],
      source: 'learning-module',
      confidence: 0.92,
      agentId: 'queen-coordinator-001',
    },
    embedding: generateMockEmbedding(384, 'orchestration'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    accessCount: 150,
  },

  securityRule: {
    key: 'rule:security:path-traversal',
    value: {
      rule: 'block-path-traversal',
      patterns: ['../', '~/', '/etc/', '/tmp/', '/var/'],
      severity: 'critical',
      action: 'reject',
    },
    metadata: {
      type: 'long-term',
      tags: ['security', 'rule', 'validation', 'path'],
      source: 'security-module',
      confidence: 1.0,
    },
    embedding: generateMockEmbedding(384, 'security-path-traversal'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },

  taskMemory: {
    key: 'task:memory:impl-001',
    value: {
      taskId: 'impl-001',
      context: 'implementing security module',
      decisions: ['use argon2 for hashing', 'implement path validation', 'add input sanitization'],
      progress: 0.75,
    },
    metadata: {
      type: 'episodic',
      tags: ['task', 'implementation', 'security'],
      ttl: 86400000, // 24 hours
      sessionId: 'session-001',
    },
    embedding: generateMockEmbedding(384, 'implementation-security'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    expiresAt: new Date('2024-01-16T10:00:00Z'),
  },

  sessionContext: {
    key: 'session:context:session-001',
    value: {
      sessionId: 'session-001',
      user: 'developer',
      activeAgents: ['queen-coordinator', 'coder', 'tester'],
      currentTask: 'security-implementation',
      startedAt: new Date('2024-01-15T14:00:00Z'),
    },
    metadata: {
      type: 'short-term',
      tags: ['session', 'context', 'active'],
      ttl: 3600000, // 1 hour
    },
    createdAt: new Date('2024-01-15T14:00:00Z'),
    updatedAt: new Date('2024-01-15T14:30:00Z'),
    expiresAt: new Date('2024-01-15T15:30:00Z'),
  },

  learningTrajectory: {
    key: 'learning:trajectory:traj-001',
    value: {
      trajectoryId: 'traj-001',
      steps: [
        { action: 'analyze', result: 'success', reward: 0.8, duration: 100 },
        { action: 'implement', result: 'success', reward: 0.9, duration: 500 },
        { action: 'test', result: 'success', reward: 1.0, duration: 200 },
      ],
      totalReward: 2.7,
      convergenceRate: 0.85,
    },
    metadata: {
      type: 'long-term',
      tags: ['learning', 'trajectory', 'reinforcement', 'reasoningbank'],
      source: 'reasoningbank',
      confidence: 0.88,
    },
    embedding: generateMockEmbedding(384, 'learning-trajectory'),
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
  },

  vectorIndex: {
    key: 'index:hnsw:agents',
    value: {
      indexId: 'hnsw-agents',
      dimensions: 384,
      vectorCount: 10000,
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    },
    metadata: {
      type: 'procedural',
      tags: ['index', 'hnsw', 'vector', 'search'],
      source: 'agentdb',
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
  },

  cacheEntry: {
    key: 'cache:search:security-patterns',
    value: {
      query: 'security input validation',
      results: ['pattern-001', 'pattern-002', 'pattern-003'],
      hitCount: 45,
    },
    metadata: {
      type: 'short-term',
      tags: ['cache', 'search', 'security'],
      ttl: 300000, // 5 minutes
    },
    createdAt: new Date('2024-01-15T14:00:00Z'),
    updatedAt: new Date('2024-01-15T14:00:00Z'),
    expiresAt: new Date('2024-01-15T14:05:00Z'),
    accessCount: 45,
  },
};

/**
 * Pre-defined search results for testing
 */
export const searchResults: Record<string, SearchResult[]> = {
  securityPatterns: [
    {
      key: 'pattern:security:input-validation',
      value: { pattern: 'validate all inputs', effectiveness: 0.99, applicability: 'universal' },
      score: 0.95,
      metadata: { type: 'semantic', tags: ['security', 'pattern', 'input'] },
      distance: 0.05,
    },
    {
      key: 'pattern:security:output-encoding',
      value: { pattern: 'encode all outputs', effectiveness: 0.97, applicability: 'web' },
      score: 0.88,
      metadata: { type: 'semantic', tags: ['security', 'pattern', 'output'] },
      distance: 0.12,
    },
    {
      key: 'pattern:security:least-privilege',
      value: { pattern: 'minimal permissions', effectiveness: 0.95, applicability: 'universal' },
      score: 0.82,
      metadata: { type: 'semantic', tags: ['security', 'pattern', 'permissions'] },
      distance: 0.18,
    },
  ],

  agentPatterns: [
    {
      key: 'pattern:agent:coordination',
      value: { pattern: 'hierarchical coordination', successRate: 0.92, topology: 'hierarchical-mesh' },
      score: 0.91,
      metadata: { type: 'semantic', tags: ['agent', 'pattern', 'coordination'] },
      distance: 0.09,
    },
    {
      key: 'pattern:agent:communication',
      value: { pattern: 'async messaging', successRate: 0.89, protocol: 'quic' },
      score: 0.85,
      metadata: { type: 'semantic', tags: ['agent', 'pattern', 'communication'] },
      distance: 0.15,
    },
  ],

  memoryOptimization: [
    {
      key: 'pattern:memory:hnsw-tuning',
      value: { M: 16, efConstruction: 200, speedup: '150x' },
      score: 0.94,
      metadata: { type: 'procedural', tags: ['memory', 'optimization', 'hnsw'] },
      distance: 0.06,
    },
    {
      key: 'pattern:memory:quantization',
      value: { bits: 8, compression: '4x', qualityLoss: 0.02 },
      score: 0.89,
      metadata: { type: 'procedural', tags: ['memory', 'optimization', 'quantization'] },
      distance: 0.11,
    },
  ],

  emptyResults: [],
};

/**
 * Pre-defined learned patterns for ReasoningBank testing
 */
export const learnedPatterns: Record<string, LearnedPattern> = {
  successfulImplementation: {
    id: 'pattern-impl-001',
    sessionId: 'session-001',
    task: 'Implement input validation',
    input: 'Create secure input validation for user data',
    output: 'Implemented regex-based validation with sanitization',
    reward: 0.95,
    success: true,
    critique: 'Good coverage of edge cases, could add more specific error messages',
    tokensUsed: 1500,
    latencyMs: 2500,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    embedding: generateMockEmbedding(384, 'input-validation'),
  },

  failedImplementation: {
    id: 'pattern-impl-002',
    sessionId: 'session-001',
    task: 'Implement path validation',
    input: 'Create path traversal protection',
    output: 'Initial implementation had security gaps',
    reward: 0.3,
    success: false,
    critique: 'Did not handle URL-encoded path traversal attempts',
    tokensUsed: 2000,
    latencyMs: 3500,
    createdAt: new Date('2024-01-15T11:00:00Z'),
    embedding: generateMockEmbedding(384, 'path-validation-failed'),
  },

  optimizationPattern: {
    id: 'pattern-opt-001',
    sessionId: 'session-002',
    task: 'Optimize vector search',
    input: 'Improve HNSW search performance',
    output: 'Tuned M=16, efConstruction=200 for 150x speedup',
    reward: 0.98,
    success: true,
    critique: 'Excellent parameter tuning, validated with benchmarks',
    tokensUsed: 800,
    latencyMs: 1200,
    createdAt: new Date('2024-01-14T08:00:00Z'),
    embedding: generateMockEmbedding(384, 'vector-optimization'),
  },
};

/**
 * Pre-defined HNSW configurations
 */
export const hnswConfigs: Record<string, HNSWConfig> = {
  default: {
    M: 16,
    efConstruction: 200,
    efSearch: 50,
    dimensions: 384,
    metric: 'cosine',
  },

  highPerformance: {
    M: 32,
    efConstruction: 400,
    efSearch: 100,
    dimensions: 384,
    metric: 'cosine',
  },

  lowMemory: {
    M: 8,
    efConstruction: 100,
    efSearch: 25,
    dimensions: 384,
    metric: 'dot',
  },

  highDimension: {
    M: 24,
    efConstruction: 300,
    efSearch: 75,
    dimensions: 1536,
    metric: 'euclidean',
  },
};

/**
 * Pre-defined quantization configurations
 */
export const quantizationConfigs: Record<string, QuantizationConfig> = {
  scalar4bit: {
    enabled: true,
    bits: 4,
    type: 'scalar',
    compressionRatio: 8,
  },

  scalar8bit: {
    enabled: true,
    bits: 8,
    type: 'scalar',
    compressionRatio: 4,
  },

  product: {
    enabled: true,
    bits: 8,
    type: 'product',
    compressionRatio: 32,
  },

  disabled: {
    enabled: false,
    bits: 16,
    type: 'scalar',
  },
};

/**
 * Pre-defined memory backend configurations
 */
export const memoryBackendConfigs: Record<string, MemoryBackendConfig> = {
  agentDB: {
    type: 'agentdb',
    vectorDimensions: 384,
    hnswConfig: hnswConfigs.default,
    quantization: quantizationConfigs.scalar8bit,
    caching: {
      enabled: true,
      maxSize: 1000,
      ttl: 3600000,
      strategy: 'lru',
    },
  },

  hybrid: {
    type: 'hybrid',
    path: './data',
    vectorDimensions: 384,
    hnswConfig: hnswConfigs.highPerformance,
    quantization: quantizationConfigs.scalar4bit,
    caching: {
      enabled: true,
      maxSize: 5000,
      ttl: 7200000,
      strategy: 'arc',
    },
  },

  inMemory: {
    type: 'memory',
    maxSize: 10000,
    vectorDimensions: 384,
    hnswConfig: hnswConfigs.lowMemory,
    caching: {
      enabled: false,
      maxSize: 0,
      ttl: 0,
      strategy: 'lru',
    },
  },

  sqlite: {
    type: 'sqlite',
    path: './test.db',
    maxSize: 100000,
    caching: {
      enabled: true,
      maxSize: 2000,
      ttl: 1800000,
      strategy: 'lfu',
    },
  },
};

/**
 * Performance targets from V3 specifications
 */
export const performanceTargets = {
  searchSpeedupMin: 150,
  searchSpeedupMax: 12500,
  memoryReduction: 0.50,
  insertionTime: 1, // ms
  searchTime: 0.1, // ms for 1M vectors
  flashAttentionSpeedup: [2.49, 7.47],
};

/**
 * Factory function to create memory entry with overrides
 */

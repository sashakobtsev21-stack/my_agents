/**
 * @claude-flow/testing - Memory Fixtures
 *
 * Comprehensive mock memory entries and backend configurations for testing.
 * Supports AgentDB, HNSW indexing, vector search, and ReasoningBank patterns.
 *
 * Based on ADR-006 (Unified Memory Service) and ADR-009 (Hybrid Memory Backend).
 */
import { vi, type Mock } from 'vitest';

/**
 * Memory entry types
 */
export type MemoryType = 'short-term' | 'long-term' | 'semantic' | 'episodic' | 'procedural';

/**
 * Memory backend types
 */
export type MemoryBackendType = 'sqlite' | 'agentdb' | 'hybrid' | 'redis' | 'memory';

/**
 * Memory entry interface
 */
export interface MemoryEntry {
  key: string;
  value: unknown;
  metadata: MemoryMetadata;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount?: number;
}

/**
 * Memory metadata interface
 */
export interface MemoryMetadata {
  type: MemoryType;
  tags: string[];
  source?: string;
  confidence?: number;
  ttl?: number;
  agentId?: string;
  sessionId?: string;
}

/**
 * Vector query interface
 */
export interface VectorQuery {
  embedding: number[];
  topK: number;
  threshold?: number;
  filters?: Record<string, unknown>;
  includeMetadata?: boolean;
  rerank?: boolean;
}

/**
 * Search result interface
 */
export interface SearchResult {
  key: string;
  value: unknown;
  score: number;
  metadata: MemoryMetadata;
  distance?: number;
}

/**
 * HNSW index configuration
 */
export interface HNSWConfig {
  M: number;
  efConstruction: number;
  efSearch: number;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot';
}

/**
 * Quantization configuration
 */
export interface QuantizationConfig {
  enabled: boolean;
  bits: 4 | 8 | 16;
  type: 'scalar' | 'product';
  compressionRatio?: number;
}

/**
 * Memory backend configuration
 */
export interface MemoryBackendConfig {
  type: MemoryBackendType;
  path?: string;
  maxSize?: number;
  ttlMs?: number;
  vectorDimensions?: number;
  hnswConfig?: HNSWConfig;
  quantization?: QuantizationConfig;
  caching?: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    strategy: 'lru' | 'lfu' | 'arc';
  };
}

/**
 * Learned pattern interface (for ReasoningBank)
 */
export interface LearnedPattern {
  id: string;
  sessionId: string;
  task: string;
  input: string;
  output: string;
  reward: number;
  success: boolean;
  critique?: string;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: Date;
  embedding?: number[];
}

/**
 * Generate deterministic mock embedding vector
 */
export function generateMockEmbedding(dimensions: number, seed: string): number[] {
  const seedHash = hashString(seed);
  return Array.from({ length: dimensions }, (_, i) => {
    const value = Math.sin(seedHash + i * 0.1) * 0.5 + 0.5;
    return Math.round(value * 10000) / 10000;
  });
}

/**
 * Simple string hash function for deterministic embeddings
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Pre-defined memory entries for testing
 */

// The fixture data tables were extracted into ./memory-fixture-data.ts
// during campaign-2 wave 83 (W289).
export * from './memory-fixture-data.js';
import {
  hnswConfigs,
  learnedPatterns,
  memoryBackendConfigs,
  memoryEntries,
} from './memory-fixture-data.js';

export function createMemoryEntry(
  base: keyof typeof memoryEntries,
  overrides?: Partial<MemoryEntry>
): MemoryEntry {
  return {
    ...memoryEntries[base],
    ...overrides,
    key: overrides?.key ?? memoryEntries[base].key,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

/**
 * Factory function to create vector query
 */
export function createVectorQuery(overrides?: Partial<VectorQuery>): VectorQuery {
  return {
    embedding: overrides?.embedding ?? generateMockEmbedding(384, 'query'),
    topK: overrides?.topK ?? 10,
    threshold: overrides?.threshold ?? 0.7,
    filters: overrides?.filters,
    includeMetadata: overrides?.includeMetadata ?? true,
    rerank: overrides?.rerank ?? false,
  };
}

/**
 * Factory function to create learned pattern
 */
export function createLearnedPattern(
  base: keyof typeof learnedPatterns,
  overrides?: Partial<LearnedPattern>
): LearnedPattern {
  return {
    ...learnedPatterns[base],
    ...overrides,
    id: overrides?.id ?? `pattern-${Date.now()}`,
    createdAt: overrides?.createdAt ?? new Date(),
  };
}

/**
 * Factory function to create HNSW config
 */
export function createHNSWConfig(
  base: keyof typeof hnswConfigs = 'default',
  overrides?: Partial<HNSWConfig>
): HNSWConfig {
  return {
    ...hnswConfigs[base],
    ...overrides,
  };
}

/**
 * Factory function to create memory backend config
 */
export function createMemoryBackendConfig(
  base: keyof typeof memoryBackendConfigs = 'agentDB',
  overrides?: Partial<MemoryBackendConfig>
): MemoryBackendConfig {
  return {
    ...memoryBackendConfigs[base],
    ...overrides,
  };
}

/**
 * Create batch of memory entries for performance testing
 */
export function createMemoryBatch(
  count: number,
  type: MemoryType = 'semantic',
  dimensions: number = 384
): MemoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `batch:entry:${i}`,
    value: { index: i, data: `test data ${i}` },
    metadata: {
      type,
      tags: ['batch', `entry-${i % 10}`],
    },
    embedding: generateMockEmbedding(dimensions, `batch-${i}`),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

/**
 * Create embeddings batch for vector index testing
 */
export function createEmbeddingsBatch(
  count: number,
  dimensions: number = 384
): { id: string; embedding: number[] }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `embedding-${i}`,
    embedding: generateMockEmbedding(dimensions, `embedding-${i}`),
  }));
}

/**
 * Invalid memory entries for error testing
 */
export const invalidMemoryEntries = {
  emptyKey: {
    key: '',
    value: { data: 'test' },
    metadata: { type: 'short-term' as const, tags: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  nullValue: {
    key: 'valid-key',
    value: null,
    metadata: { type: 'short-term' as const, tags: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  invalidEmbeddingDimension: {
    key: 'valid-key',
    value: { data: 'test' },
    metadata: { type: 'semantic' as const, tags: [] },
    embedding: [0.1, 0.2], // Wrong dimension
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  expiredEntry: {
    key: 'expired-key',
    value: { data: 'expired' },
    metadata: { type: 'short-term' as const, tags: [], ttl: -1000 },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: new Date('2024-01-01T00:01:00Z'),
  },

  invalidTags: {
    key: 'invalid-tags',
    value: { data: 'test' },
    metadata: { type: 'short-term' as const, tags: null as unknown as string[] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Mock memory service interface
 */
export interface MockMemoryService {
  store: Mock<(key: string, value: unknown, metadata?: MemoryMetadata) => Promise<void>>;
  retrieve: Mock<(key: string) => Promise<unknown>>;
  search: Mock<(query: VectorQuery) => Promise<SearchResult[]>>;
  delete: Mock<(key: string) => Promise<void>>;
  clear: Mock<() => Promise<void>>;
  getStats: Mock<() => Promise<{ totalEntries: number; sizeBytes: number }>>;
}

/**
 * Create a mock memory service
 */
export function createMockMemoryService(): MockMemoryService {
  return {
    store: vi.fn().mockResolvedValue(undefined),
    retrieve: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ totalEntries: 0, sizeBytes: 0 }),
  };
}

/**
 * Mock AgentDB interface
 */
export interface MockAgentDB {
  insert: Mock<(id: string, embedding: number[], metadata?: unknown) => Promise<void>>;
  search: Mock<(embedding: number[], k: number) => Promise<SearchResult[]>>;
  delete: Mock<(id: string) => Promise<void>>;
  update: Mock<(id: string, embedding: number[], metadata?: unknown) => Promise<void>>;
  getStats: Mock<() => Promise<{ vectorCount: number; indexSize: number }>>;
  rebuildIndex: Mock<() => Promise<void>>;
}

/**
 * Create a mock AgentDB instance
 */
export function createMockAgentDB(): MockAgentDB {
  return {
    insert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ vectorCount: 0, indexSize: 0 }),
    rebuildIndex: vi.fn().mockResolvedValue(undefined),
  };
}

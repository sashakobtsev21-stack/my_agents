/**
 * @claude-flow/testing - Mock Services
 *
 * Comprehensive mock implementations of V3 core services.
 * Provides realistic behavior for testing with full state tracking.
 */
import { vi } from 'vitest';

/**
 * Mock AgentDB - Vector database mock with HNSW simulation
 */

// The swarm/security mocks and the shared shapes were extracted into
// ./mock-swarm.ts, ./mock-security.ts and ./mock-service-types.ts
// during campaign-2 wave 57 (W263). 'export *' keeps the surface
// byte-identical (all classes were public; the shapes were private).
export * from './mock-swarm.js';
export * from './mock-security.js';
import { MockSwarmCoordinator } from './mock-swarm.js';
import { MockSecurityService } from './mock-security.js';
import type {
  DomainEvent,
  EventHandler,
  MemoryMetadata,
  SearchResult,
  VectorSearchQuery,
} from './mock-service-types.js';

export class MockAgentDB {
  private vectors = new Map<string, { embedding: number[]; metadata: Record<string, unknown> }>();
  private indexConfig = {
    M: 16,
    efConstruction: 200,
    efSearch: 50,
    dimensions: 384,
  };

  // Mock methods for verification
  insert = vi.fn(async (id: string, embedding: number[], metadata?: Record<string, unknown>) => {
    if (embedding.length !== this.indexConfig.dimensions) {
      throw new Error(`Invalid embedding dimensions: expected ${this.indexConfig.dimensions}, got ${embedding.length}`);
    }
    this.vectors.set(id, { embedding, metadata: metadata ?? {} });
  });

  search = vi.fn(async (embedding: number[], k: number, threshold?: number) => {
    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const [id, data] of this.vectors) {
      const score = this.cosineSimilarity(embedding, data.embedding);
      if (threshold === undefined || score >= threshold) {
        results.push({ id, score, metadata: data.metadata });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  });

  delete = vi.fn(async (id: string) => {
    this.vectors.delete(id);
  });

  update = vi.fn(async (id: string, embedding: number[], metadata?: Record<string, unknown>) => {
    const existing = this.vectors.get(id);
    if (!existing) {
      throw new Error(`Vector not found: ${id}`);
    }
    this.vectors.set(id, { embedding, metadata: metadata ?? existing.metadata });
  });

  getVector = vi.fn(async (id: string) => {
    return this.vectors.get(id) ?? null;
  });

  getStats = vi.fn(() => ({
    vectorCount: this.vectors.size,
    indexSize: this.vectors.size * this.indexConfig.dimensions * 4, // 4 bytes per float
    dimensions: this.indexConfig.dimensions,
    M: this.indexConfig.M,
    efConstruction: this.indexConfig.efConstruction,
  }));

  rebuildIndex = vi.fn(async () => {
    // Simulate index rebuild
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  clear = vi.fn(() => {
    this.vectors.clear();
  });

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Configure the mock index
   */
  configure(config: Partial<typeof this.indexConfig>): void {
    Object.assign(this.indexConfig, config);
  }

  /**
   * Get all stored vectors (for testing)
   */
  getAllVectors(): Map<string, { embedding: number[]; metadata: Record<string, unknown> }> {
    return new Map(this.vectors);
  }
}

/**
 * Mock Unified Swarm Coordinator
 */

export class MockMemoryService {
  private store = new Map<string, { value: unknown; metadata: MemoryMetadata; expiresAt?: Date }>();
  private cache = new Map<string, { value: unknown; accessCount: number }>();
  private cacheHits = 0;
  private cacheMisses = 0;

  set = vi.fn(async (key: string, value: unknown, metadata?: MemoryMetadata) => {
    const expiresAt = metadata?.ttl ? new Date(Date.now() + metadata.ttl) : undefined;
    this.store.set(key, { value, metadata: metadata ?? { type: 'short-term', tags: [] }, expiresAt });
    this.cache.delete(key); // Invalidate cache
  });

  get = vi.fn(async (key: string) => {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      this.cacheHits++;
      cached.accessCount++;
      return cached.value;
    }

    this.cacheMisses++;
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.store.delete(key);
      return null;
    }

    // Add to cache
    this.cache.set(key, { value: entry.value, accessCount: 1 });

    return entry.value;
  });

  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
    this.cache.delete(key);
  });

  search = vi.fn(async (query: VectorSearchQuery) => {
    // Simulate vector search with filtering
    const results: SearchResult[] = [];

    for (const [key, entry] of this.store) {
      if (query.filters) {
        const matches = Object.entries(query.filters).every(([k, v]) =>
          entry.metadata[k as keyof MemoryMetadata] === v
        );
        if (!matches) continue;
      }

      results.push({
        key,
        value: entry.value,
        score: Math.random() * 0.3 + 0.7, // Random score 0.7-1.0
        metadata: entry.metadata,
      });
    }

    return results
      .filter(r => !query.threshold || r.score >= query.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK);
  });

  clear = vi.fn(async () => {
    this.store.clear();
    this.cache.clear();
  });

  getStats = vi.fn(() => ({
    totalEntries: this.store.size,
    cacheSize: this.cache.size,
    cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
    cacheHits: this.cacheHits,
    cacheMisses: this.cacheMisses,
  }));

  prune = vi.fn(async () => {
    const now = new Date();
    let pruned = 0;

    for (const [key, entry] of this.store) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  });

  reset(): void {
    this.store.clear();
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    vi.clearAllMocks();
  }
}

/**
 * Mock Event Bus with history tracking
 */
export class MockEventBus {
  private subscribers = new Map<string, Set<EventHandler>>();
  private history: DomainEvent[] = [];
  private maxHistorySize = 1000;

  publish = vi.fn(async (event: DomainEvent) => {
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const handlers = this.subscribers.get(event.type) ?? new Set();
    const wildcardHandlers = this.subscribers.get('*') ?? new Set();

    const allHandlers = [...handlers, ...wildcardHandlers];

    await Promise.all(allHandlers.map(handler => handler(event)));
  });

  subscribe = vi.fn((eventType: string, handler: EventHandler) => {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);

    return () => this.unsubscribe(eventType, handler);
  });

  unsubscribe = vi.fn((eventType: string, handler: EventHandler) => {
    this.subscribers.get(eventType)?.delete(handler);
  });

  getHistory(eventType?: string): DomainEvent[] {
    if (eventType) {
      return this.history.filter(e => e.type === eventType);
    }
    return [...this.history];
  }

  getSubscriberCount(eventType: string): number {
    return this.subscribers.get(eventType)?.size ?? 0;
  }

  clear(): void {
    this.history = [];
    vi.clearAllMocks();
  }

  reset(): void {
    this.subscribers.clear();
    this.history = [];
    vi.clearAllMocks();
  }
}

/**
 * Mock Security Service
 */

export function createMockServices(): MockServiceBundle {
  return {
    agentDB: new MockAgentDB(),
    swarmCoordinator: new MockSwarmCoordinator(),
    memoryService: new MockMemoryService(),
    eventBus: new MockEventBus(),
    securityService: new MockSecurityService(),
  };
}

/**
 * Mock service bundle interface
 */
export interface MockServiceBundle {
  agentDB: MockAgentDB;
  swarmCoordinator: MockSwarmCoordinator;
  memoryService: MockMemoryService;
  eventBus: MockEventBus;
  securityService: MockSecurityService;
}

/**
 * Reset all mock services
 */
export function resetMockServices(services: MockServiceBundle): void {
  services.agentDB.clear();
  services.swarmCoordinator.reset();
  services.memoryService.reset();
  services.eventBus.reset();
  services.securityService.reset();
}

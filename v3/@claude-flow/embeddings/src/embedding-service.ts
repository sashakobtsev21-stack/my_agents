/**
 * V3 Embedding Service Implementation
 *
 * Production embedding service aligned with agentic-flow@alpha:
 * - OpenAI provider (text-embedding-3-small/large)
 * - Transformers.js provider (local ONNX models)
 * - Mock provider (development/testing)
 *
 * Performance Targets:
 * - Single embedding: <100ms (API), <50ms (local)
 * - Batch embedding: <500ms for 10 items
 * - Cache hit: <1ms
 */


// This file is now a thin barrel + factory/similarity surface: the
// provider classes were split into the sub-modules below during the
// P3.47 god-file decomposition (W168). Kept as embedding-service.ts so
// './embedding-service.js' importers (src/index.ts) keep resolving
// byte-identically. embedding-service-base.ts (LRUCache +
// BaseEmbeddingService) is NOT re-exported — module-private pre-split.
export * from './embedding-service-providers.js';
export * from './embedding-service-agentic.js';

import { RvfEmbeddingService } from './rvf-embedding-service.js';
import {
  MockEmbeddingService,
  OpenAIEmbeddingService,
  TransformersEmbeddingService,
} from './embedding-service-providers.js';
import { AgenticFlowEmbeddingService } from './embedding-service-agentic.js';
import type {
  AgenticFlowEmbeddingConfig,
  EmbeddingConfig,
  EmbeddingProvider,
  IEmbeddingService,
  MockEmbeddingConfig,
  OpenAIEmbeddingConfig,
  RvfEmbeddingConfig,
  SimilarityMetric,
  SimilarityResult,
  TransformersEmbeddingConfig,
} from './types.js';

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Check if agentic-flow is available
 */
async function isAgenticFlowAvailable(): Promise<boolean> {
  try {
    await import('agentic-flow/embeddings');
    return true;
  } catch {
    return false;
  }
}

/**
 * Auto-install agentic-flow and initialize model
 */
async function autoInstallAgenticFlow(): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // Check if already available
    if (await isAgenticFlowAvailable()) {
      return true;
    }

    console.log('[embeddings] Installing agentic-flow@alpha...');
    await execAsync('npm install agentic-flow@alpha --save', { timeout: 120000 });

    // Initialize the model
    console.log('[embeddings] Downloading embedding model...');
    await execAsync('npx agentic-flow@alpha embeddings init', { timeout: 300000 });

    // Verify installation
    return await isAgenticFlowAvailable();
  } catch (error) {
    console.warn('[embeddings] Auto-install failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Create embedding service based on configuration (sync version)
 * Note: For 'auto' provider or smart fallback, use createEmbeddingServiceAsync
 */
export function createEmbeddingService(config: EmbeddingConfig): IEmbeddingService {
  switch (config.provider) {
    case 'openai':
      return new OpenAIEmbeddingService(config as OpenAIEmbeddingConfig);
    case 'transformers':
      return new TransformersEmbeddingService(config as TransformersEmbeddingConfig);
    case 'mock':
      return new MockEmbeddingService(config as MockEmbeddingConfig);
    case 'agentic-flow':
      return new AgenticFlowEmbeddingService(config as AgenticFlowEmbeddingConfig);
    case 'rvf':
      return new RvfEmbeddingService(config as RvfEmbeddingConfig);
    default:
      throw new Error(
        `Unknown embedding provider: '${(config as EmbeddingConfig).provider}'. ` +
        `Use 'agentic-flow' (recommended), 'transformers', 'openai', 'rvf', or 'mock' (tests only).`
      );
  }
}

/**
 * Extended config with auto provider option
 */
export interface AutoEmbeddingConfig {
  /** Provider: 'auto' will pick best available (agentic-flow > transformers > mock) */
  provider: EmbeddingProvider | 'auto';
  /** Fallback provider if primary fails */
  fallback?: EmbeddingProvider;
  /** Auto-install agentic-flow if not available (default: true for 'auto' provider) */
  autoInstall?: boolean;
  /** Model ID for agentic-flow */
  modelId?: string;
  /** Model name for transformers */
  model?: string;
  /** Dimensions */
  dimensions?: number;
  /** Cache size */
  cacheSize?: number;
  /** OpenAI API key (required for openai provider) */
  apiKey?: string;
}

/**
 * Create embedding service with automatic provider detection and fallback
 *
 * Features:
 * - 'auto' provider picks best available: agentic-flow > transformers > mock
 * - Automatic fallback if primary provider fails to initialize
 * - Pre-validates provider availability before returning
 *
 * @example
 * // Auto-select best provider
 * const service = await createEmbeddingServiceAsync({ provider: 'auto' });
 *
 * // Try agentic-flow, fallback to transformers
 * const service = await createEmbeddingServiceAsync({
 *   provider: 'agentic-flow',
 *   fallback: 'transformers'
 * });
 */
export async function createEmbeddingServiceAsync(
  config: AutoEmbeddingConfig
): Promise<IEmbeddingService> {
  const { provider, fallback, autoInstall = true, ...rest } = config;

  // Auto provider selection
  if (provider === 'auto') {
    // Try RVF first (52KB, always available, fast hash embeddings)
    try {
      const service = new RvfEmbeddingService({
        provider: 'rvf',
        dimensions: rest.dimensions ?? 384,
        cacheSize: rest.cacheSize,
      });
      await service.embed('test');
      return service;
    } catch { /* fall through */ }

    // Try agentic-flow (fastest neural, ONNX-based)
    let agenticFlowAvailable = await isAgenticFlowAvailable();

    // Auto-install if not available and autoInstall is enabled
    if (!agenticFlowAvailable && autoInstall) {
      agenticFlowAvailable = await autoInstallAgenticFlow();
    }

    if (agenticFlowAvailable) {
      try {
        const service = new AgenticFlowEmbeddingService({
          provider: 'agentic-flow',
          modelId: rest.modelId ?? 'all-MiniLM-L6-v2',
          dimensions: rest.dimensions ?? 384,
          cacheSize: rest.cacheSize,
        });
        // Validate it can initialize
        await service.embed('test');
        return service;
      } catch {
        // Fall through to next option
      }
    }

    // Try transformers (good quality, built-in)
    try {
      const service = new TransformersEmbeddingService({
        provider: 'transformers',
        model: rest.model ?? 'Xenova/all-MiniLM-L6-v2',
        cacheSize: rest.cacheSize,
      });
      // Validate it can initialize
      await service.embed('test');
      return service;
    } catch {
      // Fall through to mock
    }

    // No real provider available — refuse to silently fall back to mock embeddings.
    throw new Error(
      "[embeddings] No real embedding provider available for 'auto'. " +
      'Install agentic-flow OR @xenova/transformers, OR pass provider:"openai" with apiKey, ' +
      'OR explicitly request provider:"mock" if mock embeddings are intentional (tests only).'
    );
  }

  // Specific provider with optional fallback
  const createPrimary = (): IEmbeddingService => {
    switch (provider) {
      case 'agentic-flow':
        return new AgenticFlowEmbeddingService({
          provider: 'agentic-flow',
          modelId: rest.modelId ?? 'all-MiniLM-L6-v2',
          dimensions: rest.dimensions ?? 384,
          cacheSize: rest.cacheSize,
        });
      case 'transformers':
        return new TransformersEmbeddingService({
          provider: 'transformers',
          model: rest.model ?? 'Xenova/all-MiniLM-L6-v2',
          cacheSize: rest.cacheSize,
        });
      case 'openai':
        if (!rest.apiKey) throw new Error('OpenAI provider requires apiKey');
        return new OpenAIEmbeddingService({
          provider: 'openai',
          apiKey: rest.apiKey,
          dimensions: rest.dimensions,
          cacheSize: rest.cacheSize,
        });
      case 'rvf':
        return new RvfEmbeddingService({
          provider: 'rvf',
          dimensions: rest.dimensions ?? 384,
          cacheSize: rest.cacheSize,
        });
      case 'mock':
        return new MockEmbeddingService({
          dimensions: rest.dimensions ?? 384,
          cacheSize: rest.cacheSize,
        });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  };

  const primary = createPrimary();

  // Try to validate primary provider
  try {
    await primary.embed('test');
    return primary;
  } catch (error) {
    if (!fallback) {
      throw error;
    }

    // Try fallback
    console.warn(`[embeddings] Primary provider '${provider}' failed, using fallback '${fallback}'`);
    const fallbackConfig: AutoEmbeddingConfig = { ...rest, provider: fallback };
    return createEmbeddingServiceAsync(fallbackConfig);
  }
}

/**
 * Convenience function for quick embeddings
 */
export async function getEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>
): Promise<Float32Array | number[]> {
  const service = createEmbeddingService({
    provider: 'mock',
    dimensions: 384,
    ...config,
  } as EmbeddingConfig);

  try {
    const result = await service.embed(text);
    return result.embedding;
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Compute Euclidean distance between two embeddings
 */
export function euclideanDistance(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compute dot product between two embeddings
 */
export function dotProduct(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match');
  }

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

/**
 * Compute similarity using specified metric
 */
export function computeSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[],
  metric: SimilarityMetric = 'cosine'
): SimilarityResult {
  switch (metric) {
    case 'cosine':
      return { score: cosineSimilarity(a, b), metric };
    case 'euclidean':
      // Convert distance to similarity (closer = higher score)
      return { score: 1 / (1 + euclideanDistance(a, b)), metric };
    case 'dot':
      return { score: dotProduct(a, b), metric };
    default:
      return { score: cosineSimilarity(a, b), metric: 'cosine' };
  }
}

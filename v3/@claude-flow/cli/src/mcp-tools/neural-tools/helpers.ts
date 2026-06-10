/**
 * Neural MCP tools — shared embedding subsystem + storage helpers.
 *
 * The embedding subsystem probes ruvector@0.2.27 → agentic-flow
 * ReasoningBank → @claude-flow/embeddings (Tiers 0-3) at load and exposes
 * the live `realEmbeddings` / `embeddingServiceName` bindings (ESM live
 * exports — the tools read the service name for status). Plus the
 * .claude-flow/neural store paths + types, load/save + stats, pattern
 * storage, and the embedding + cosine utilities.
 *
 * Extracted from neural-tools.ts (W137, P3.21 cut #1).
 */
import { getProjectCwd } from '../types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Try to import real embeddings.
// Tier 0 (NEW, ADR-089): ruvector@0.2.27 bundled ONNX (no sharp dep, fixes ADR-086's
//   silent-fallback bug at source; closes the chain described in ruvnet/ruvector#523).
// Tier 1: agentic-flow v3 ReasoningBank (was Tier 1 — broken on darwin-arm64 without sharp)
// Tier 2-3: @claude-flow/embeddings
export let realEmbeddings: { embed: (text: string) => Promise<number[]> } | null = null;
export let embeddingServiceName: string = 'none';
try {
  // Tier 0: ruvector@0.2.27 — bundled all-MiniLM-L6-v2 + parallel worker pool.
  // Probe with isOnnxAvailable() and verify an actual embed succeeds (avoids
  // the type-load-success-but-runtime-fails trap from ADR-086).
  // NOTE: ruvector's embed() returns `{embedding, dimension, timeMs}` — we
  // unwrap to plain number[] for the shared interface.
  const rv = await import('ruvector').catch(() => null) as any;
  if (rv?.embed && typeof rv.embed === 'function' && rv.isOnnxAvailable?.()) {
    try {
      if (typeof rv.initOnnxEmbedder === 'function') await rv.initOnnxEmbedder();
      const probe = await rv.embed('probe');
      // Handle both shapes: ruvector wraps as {embedding, dimension, timeMs};
      // some versions returned raw Float32Array.
      const probeVec = probe?.embedding ?? probe;
      if (probeVec && (Array.isArray(probeVec) || (probeVec as ArrayLike<number>).length > 0)) {
        realEmbeddings = {
          embed: async (text: string) => {
            const r = await rv.embed(text);
            const v = r?.embedding ?? r;
            return Array.isArray(v) ? v : Array.from(v as ArrayLike<number>);
          },
        };
        embeddingServiceName = 'ruvector@0.2.27 (bundled all-MiniLM-L6-v2)';
      }
    } catch {
      // ruvector embed failed at runtime; fall through to next tier
    }
  }

  // Tier 1: agentic-flow v3 ReasoningBank (kept for backward-compat; may
  // silently fall back on darwin-arm64 without sharp — that's the bug
  // Tier 0 was added to bypass).
  if (!realEmbeddings) {
    const rb = await import('agentic-flow/reasoningbank').catch(() => null);
    if (rb?.computeEmbedding) {
      realEmbeddings = { embed: (text: string) => rb.computeEmbedding(text) };
      embeddingServiceName = 'agentic-flow/reasoningbank';
    }
  }

  // Tier 2: @claude-flow/embeddings with agentic-flow provider
  if (!realEmbeddings) {
    const embeddingsModule = await import('@claude-flow/embeddings').catch(() => null);
    if (embeddingsModule?.createEmbeddingService) {
      try {
        const service = embeddingsModule.createEmbeddingService({ provider: 'agentic-flow' });
        realEmbeddings = {
          embed: async (text: string) => {
            const result = await service.embed(text);
            return Array.from(result.embedding);
          },
        };
        embeddingServiceName = 'agentic-flow';
      } catch {
        // agentic-flow provider not available, try ONNX
      }
    }
  }

  // Tier 3: @claude-flow/embeddings with ONNX provider
  if (!realEmbeddings) {
    const embeddingsModule = await import('@claude-flow/embeddings').catch(() => null);
    if (embeddingsModule?.createEmbeddingService) {
      try {
        const service = embeddingsModule.createEmbeddingService({ provider: 'onnx' });
        realEmbeddings = {
          embed: async (text: string) => {
            const result = await service.embed(text);
            return Array.from(result.embedding);
          },
        };
        embeddingServiceName = 'onnx';
      } catch {
        // ONNX provider not available, fall through to mock
      }
    }
  }

  // No Tier 4 mock fallback. If all real-embedder tiers fail to import or
  // probe, leave realEmbeddings null and let downstream code use the
  // explicit hash-fallback path with a clear _embeddingNote in stats.
  // Silently substituting mock embeddings would hide a missing production
  // dependency from callers — that's the bug ADR-086 was about.
} catch {
  // No embedding provider available, will use fallback
}

// Storage paths
export const STORAGE_DIR = '.claude-flow';
export const NEURAL_DIR = 'neural';
export const MODELS_FILE = 'models.json';
// PATTERNS_FILE used to live in this neural store; patterns now persist
// through agentdb-tools via the unified namespace.

export interface NeuralModel {
  id: string;
  name: string;
  type: 'moe' | 'transformer' | 'classifier' | 'embedding';
  status: 'untrained' | 'training' | 'ready' | 'error';
  accuracy: number;
  trainedAt?: string;
  epochs: number;
  config: Record<string, unknown>;
}

export interface Pattern {
  id: string;
  name: string;
  type: string;
  embedding: number[];
  /** Source text the embedding was built from. Cap 4096 chars. Used for
   *  BM25 in hybrid retrieval (ADR-078). Optional for backwards compat —
   *  pre-3.10.18 patterns fall back to `name` for BM25 tokenisation. */
  content?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  usageCount: number;
}

export interface NeuralStore {
  models: Record<string, NeuralModel>;
  patterns: Record<string, Pattern>;
  version: string;
}

export function getNeuralDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, NEURAL_DIR);
}

export function getNeuralPath(): string {
  return join(getNeuralDir(), MODELS_FILE);
}

export function ensureNeuralDir(): void {
  const dir = getNeuralDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadNeuralStore(): NeuralStore {
  try {
    const path = getNeuralPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // Return empty store
  }
  return { models: {}, patterns: {}, version: '3.0.0' };
}

export function saveNeuralStore(store: NeuralStore): void {
  ensureNeuralDir();
  writeFileSync(getNeuralPath(), JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Public helper: read-only stats about the neural store, for the unified
 * learning-stats aggregator. Returns total pattern count + per-type breakdown
 * without exposing the embeddings.
 */
export function getNeuralStoreStats(): {
  patternCount: number;
  byType: Record<string, number>;
  modelCount: number;
  source: string;
} {
  const store = loadNeuralStore();
  const patterns = Object.values(store.patterns ?? {});
  const byType: Record<string, number> = {};
  for (const p of patterns) {
    const t = (p as { type?: string }).type || 'unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }
  return {
    patternCount: patterns.length,
    byType,
    modelCount: Object.values(store.models ?? {}).length,
    source: '.claude-flow/neural/patterns.json (loadNeuralStore)',
  };
}

/**
 * Public helper: store an array of patterns into the neural store so they
 * surface via `neural_patterns list`. Used by hooks_pretrain so its extracted
 * patterns are actually queryable, not just bundled in the `pretrain` namespace.
 * #2245.
 *
 * Returns the number of patterns written.
 */
export async function storeNeuralPatterns(items: Array<{
  name: string;
  type: string;
  content?: string;
  metadata?: Record<string, unknown>;
}>): Promise<{ stored: number; total: number }> {
  if (!items || items.length === 0) return { stored: 0, total: 0 };
  // realEmbeddings is initialised by the top-level IIFE in this module;
  // generateEmbedding() falls back to a hash-based embedding if it isn't.
  const store = loadNeuralStore();
  let stored = 0;
  for (const item of items) {
    if (!item.name || !item.type) continue;
    const sourceText = item.content ?? item.name;
    const embedding = await generateEmbedding(sourceText);
    const id = `pattern-${Date.now()}-${stored.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    store.patterns[id] = {
      id,
      name: String(item.name).slice(0, 200),
      type: String(item.type).slice(0, 64),
      embedding,
      content: typeof sourceText === 'string' ? sourceText.slice(0, 4096) : undefined,
      metadata: item.metadata ?? {},
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    stored++;
  }
  saveNeuralStore(store);
  return { stored, total: items.length };
}

// Generate embedding - uses real ML embeddings if available, falls back to deterministic hash
export async function generateEmbedding(text?: string, dims: number = 384): Promise<number[]> {
  // If real embeddings available and text provided, use them
  if (realEmbeddings && text) {
    try {
      return await realEmbeddings.embed(text);
    } catch {
      // Fall back to hash-based
    }
  }

  // Hash-based deterministic embedding (better than pure random for consistency)
  // NOTE: No semantic meaning — only useful for consistent deduplication, not similarity search
  if (text) {
    if (embeddingServiceName === 'none') {
      embeddingServiceName = 'hash-fallback';
    }
    const hash = text.split('').reduce((acc, char, i) => {
      return acc + char.charCodeAt(0) * (i + 1);
    }, 0);

    // Use hash to seed a deterministic embedding
    const embedding: number[] = [];
    let seed = hash;
    for (let i = 0; i < dims; i++) {
      // Simple LCG random with seed
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((seed / 0x7fffffff) * 2 - 1);
    }
    return embedding;
  }

  // No text provided — return zero vector (callers should always provide text)
  return new Array(dims).fill(0);
}

// Cosine similarity for pattern search
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}


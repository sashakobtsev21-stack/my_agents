/**
 * Memory-bridge embedding + HNSW operations — the AgentDB v3 routing
 * layer for vector generation and approximate nearest-neighbour search.
 *
 *   - bridgeGenerateEmbedding   (text → vector via AgentDB's embedder;
 *                               null → caller falls back to ONNX/hash)
 *   - bridgeLoadEmbeddingModel  (warm the embedder)
 *   - bridgeGetHNSWStatus       (index availability + entry count)
 *   - bridgeSearchHNSW          (k-NN query with cosine scoring)
 *   - bridgeAddToHNSW           (insert a vector into the index)
 *
 * Extracted from memory-bridge.ts (W67, P3.4 cut #4).
 */
import { getRegistry, getDb } from './bridge-core.js';
import { cosineSim } from './scoring.js';

// ===== Phase 2: Embedding bridge =====

/**
 * Generate embedding via AgentDB v3's embedder.
 * Returns null if bridge unavailable — caller falls back to own ONNX/hash.
 */
export async function bridgeGenerateEmbedding(
  text: string,
  dbPath?: string,
): Promise<{ embedding: number[]; dimensions: number; model: string; backend?: 'onnx' | 'mock' } | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    const agentdb = registry.getAgentDB();
    const embedder = agentdb?.embedder;
    if (!embedder) return null;

    const emb = await embedder.embed(text);
    if (!emb) return null;

    // AUDIT #3: surface backend truthfully. AgentDB's embedder is a real ONNX
    // model when present; if it ever exposes a mock/stub signal, honor it.
    const isMock = (embedder as { isMock?: boolean; backend?: string }).isMock === true
      || (embedder as { backend?: string }).backend === 'mock';

    return {
      embedding: Array.from(emb),
      dimensions: emb.length,
      model: 'Xenova/all-MiniLM-L6-v2',
      backend: isMock ? 'mock' : 'onnx',
    };
  } catch {
    return null;
  }
}

/**
 * Load embedding model via AgentDB v3 (it loads on init).
 * Returns null if unavailable.
 */
export async function bridgeLoadEmbeddingModel(
  dbPath?: string,
): Promise<{
  success: boolean;
  dimensions: number;
  modelName: string;
  loadTime?: number;
} | null> {
  const startTime = Date.now();
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    const agentdb = registry.getAgentDB();
    const embedder = agentdb?.embedder;
    if (!embedder) return null;

    // Verify embedder works by generating a test embedding
    const test = await embedder.embed('test');
    if (!test) return null;

    return {
      success: true,
      dimensions: test.length,
      modelName: 'Xenova/all-MiniLM-L6-v2',
      loadTime: Date.now() - startTime,
    };
  } catch {
    return null;
  }
}

// ===== Phase 3: HNSW bridge =====

/**
 * Get HNSW status from AgentDB v3's vector backend or HNSW index.
 * Returns null if unavailable.
 */
export async function bridgeGetHNSWStatus(
  dbPath?: string,
): Promise<{
  available: boolean;
  initialized: boolean;
  entryCount: number;
  dimensions: number;
} | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    const ctx = getDb(registry);
    if (!ctx) return null;

    // Count entries with embeddings
    let entryCount = 0;
    try {
      const row = ctx.db.prepare(
        `SELECT COUNT(*) as cnt FROM memory_entries WHERE status = 'active' AND embedding IS NOT NULL`,
      ).get();
      entryCount = row?.cnt ?? 0;
    } catch {
      // Table might not exist
    }

    return {
      available: true,
      initialized: true,
      entryCount,
      dimensions: 384,
    };
  } catch {
    return null;
  }
}

/**
 * Search using AgentDB v3's embedder + SQLite entries.
 * This is the HNSW-equivalent search through the bridge.
 * Returns null if unavailable.
 */
export async function bridgeSearchHNSW(
  queryEmbedding: number[],
  options?: { k?: number; namespace?: string; threshold?: number },
  dbPath?: string,
): Promise<Array<{
  id: string;
  key: string;
  content: string;
  score: number;
  namespace: string;
}> | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const k = options?.k ?? 10;
    const threshold = options?.threshold ?? 0.3;
    const nsFilter = options?.namespace && options.namespace !== 'all'
      ? `AND namespace = ?`
      : '';

    let rows: any[];
    try {
      const stmt = ctx.db.prepare(`
        SELECT id, key, namespace, content, embedding
        FROM memory_entries
        WHERE status = 'active' AND embedding IS NOT NULL ${nsFilter}
        LIMIT 10000
      `);
      rows = nsFilter
        ? stmt.all(options!.namespace)
        : stmt.all();
    } catch {
      return null;
    }

    const results: Array<{
      id: string; key: string; content: string; score: number; namespace: string;
    }> = [];

    for (const row of rows) {
      if (!row.embedding) continue;
      try {
        const emb = JSON.parse(row.embedding) as number[];
        const score = cosineSim(queryEmbedding, emb);
        if (score >= threshold) {
          results.push({
            id: String(row.id).substring(0, 12),
            key: row.key || String(row.id).substring(0, 15),
            content: (row.content || '').substring(0, 60) +
              ((row.content || '').length > 60 ? '...' : ''),
            score,
            namespace: row.namespace || 'default',
          });
        }
      } catch {
        // Skip invalid embeddings
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  } catch {
    return null;
  }
}

/**
 * Add entry to the bridge's database with embedding.
 * Returns null if unavailable.
 */
export async function bridgeAddToHNSW(
  id: string,
  embedding: number[],
  entry: { id: string; key: string; namespace: string; content: string },
  dbPath?: string,
): Promise<boolean | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const now = Date.now();
    const embeddingJson = JSON.stringify(embedding);
    ctx.db.prepare(`
      INSERT OR REPLACE INTO memory_entries (
        id, key, namespace, content, type,
        embedding, embedding_dimensions, embedding_model,
        created_at, updated_at, status
      ) VALUES (?, ?, ?, ?, 'semantic', ?, ?, 'Xenova/all-MiniLM-L6-v2', ?, ?, 'active')
    `).run(
      id, entry.key, entry.namespace, entry.content,
      embeddingJson, embedding.length,
      now, now,
    );
    return true;
  } catch {
    return null;
  }
}

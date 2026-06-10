/**
 * Memory-bridge CRUD operations — the AgentDB v3 routing layer for
 * store / search / list / get / delete. Each returns null to signal the
 * caller should fall back to raw sql.js (memory-initializer).
 *
 *   - bridgeStoreEntry    (MutationGuard → TieredCache → DB → Attestation)
 *   - bridgeSearchEntries (BM25 hybrid + cosine semantic re-rank)
 *   - bridgeListEntries   (paginated namespace listing)
 *   - bridgeGetEntry      (single key+namespace fetch)
 *   - bridgeDeleteEntry   (delete + cache invalidation)
 *
 * Extracted from memory-bridge.ts (W66, P3.4 cut #3). Builds on the
 * bridge-core infrastructure + the pure scoring helpers.
 */
import {
  generateId,
  getRegistry,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  guardValidate,
  logAttestation,
  getDb,
} from './bridge-core.js';
import { bm25Score, computeTermDocFreqs, cosineSim } from './scoring.js';

/**
 * Store an entry via AgentDB v3.
 * Phase 2-5: Routes through MutationGuard → TieredCache → DB → AttestationLog.
 * Returns null to signal fallback to sql.js.
 */
export async function bridgeStoreEntry(options: {
  key: string;
  value: string;
  namespace?: string;
  generateEmbeddingFlag?: boolean;
  tags?: string[];
  ttl?: number;
  dbPath?: string;
  upsert?: boolean;
}): Promise<{
  success: boolean;
  id: string;
  embedding?: { dimensions: number; model: string };
  rawEmbedding?: number[];
  guarded?: boolean;
  cached?: boolean;
  attested?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const { key, value, namespace = 'default', tags = [], ttl } = options;
    const id = generateId('entry');
    const now = Date.now();

    // #2245 — record the activity so signalsProcessed stops being a dead
    // zero. Fire-and-forget; never blocks the write path.
    try {
      const intel = await import('../intelligence.js');
      intel.recordSignalProcessed();
    } catch { /* intelligence module not yet initialised */ }

    // Phase 5: MutationGuard validation before write
    const guardResult = await guardValidate(registry, 'store', { key, namespace, size: value.length });
    if (!guardResult.allowed) {
      return { success: false, id, error: `MutationGuard rejected: ${guardResult.reason}` };
    }

    // Generate embedding via AgentDB's embedder
    let embeddingJson: string | null = null;
    let dimensions = 0;
    let model = 'local';

    if (options.generateEmbeddingFlag !== false && value.length > 0) {
      try {
        const embedder = ctx.agentdb.embedder;
        if (embedder) {
          const emb = await embedder.embed(value);
          if (emb) {
            embeddingJson = JSON.stringify(Array.from(emb));
            dimensions = emb.length;
            model = 'Xenova/all-MiniLM-L6-v2';
          }
        }
      } catch {
        // Embedding failed — store without
      }
    }

    // better-sqlite3 uses synchronous .run() with positional params
    const insertSql = options.upsert
      ? `INSERT OR REPLACE INTO memory_entries (
          id, key, namespace, content, type,
          embedding, embedding_dimensions, embedding_model,
          tags, metadata, created_at, updated_at, expires_at, status
        ) VALUES (?, ?, ?, ?, 'semantic', ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      : `INSERT INTO memory_entries (
          id, key, namespace, content, type,
          embedding, embedding_dimensions, embedding_model,
          tags, metadata, created_at, updated_at, expires_at, status
        ) VALUES (?, ?, ?, ?, 'semantic', ?, ?, ?, ?, ?, ?, ?, ?, 'active')`;

    // #1941: provision a `vector_indexes` row for this namespace before the
    // entry insert. AgentDB's HNSW/router keys lookups by namespace via this
    // table — if it has no row for e.g. `claude-memories`, `memory_search`
    // returns 0 results even when memory_entries holds hundreds of rows for
    // that namespace. INSERT OR IGNORE so existing index rows are preserved.
    try {
      ctx.db
        .prepare(`INSERT OR IGNORE INTO vector_indexes (id, name, dimensions) VALUES (?, ?, ?)`)
        .run(namespace, namespace, dimensions || 384);
    } catch { /* vector_indexes may not exist on legacy DBs — fall through */ }

    const stmt = ctx.db.prepare(insertSql);
    stmt.run(
      id, key, namespace, value,
      embeddingJson, dimensions || null, model,
      tags.length > 0 ? JSON.stringify(tags) : null,
      '{}',
      now, now,
      ttl ? now + (ttl * 1000) : null
    );

    // Phase 2: Write-through to TieredCache
    const safeNs = String(namespace).replace(/:/g, '_');
    const safeKey = String(key).replace(/:/g, '_');
    const cacheKey = `entry:${safeNs}:${safeKey}`;
    await cacheSet(registry, cacheKey, { id, key, namespace, content: value, embedding: embeddingJson });

    // Phase 4: AttestationLog write audit
    await logAttestation(registry, 'store', id, { key, namespace, hasEmbedding: !!embeddingJson });

    return {
      success: true,
      id,
      embedding: embeddingJson ? { dimensions, model } : undefined,
      rawEmbedding: embeddingJson ? JSON.parse(embeddingJson) as number[] : undefined,
      guarded: true,
      cached: true,
      attested: true,
    };
  } catch {
    return null;
  }
}

/**
 * Search entries via AgentDB v3.
 * Phase 2: BM25 hybrid scoring replaces naive String.includes() keyword fallback.
 * Combines cosine similarity (semantic) with BM25 (lexical) via reciprocal rank fusion.
 */
export async function bridgeSearchEntries(options: {
  query: string;
  namespace?: string;
  limit?: number;
  threshold?: number;
  dbPath?: string;
}): Promise<{
  success: boolean;
  results: {
    id: string;
    key: string;
    content: string;
    score: number;
    namespace: string;
    provenance?: string;
  }[];
  searchTime: number;
  searchMethod?: string;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const { query: queryStr, namespace, limit = 10, threshold = 0.3 } = options;
    const effectiveNamespace = namespace || 'all';
    const startTime = Date.now();

    // Generate query embedding
    let queryEmbedding: number[] | null = null;
    try {
      const embedder = ctx.agentdb.embedder;
      if (embedder) {
        const emb = await embedder.embed(queryStr);
        queryEmbedding = Array.from(emb);
      }
    } catch {
      // Fall back to keyword search
    }

    // better-sqlite3: .prepare().all() returns array of objects
    const nsFilter = effectiveNamespace !== 'all'
      ? `AND namespace = ?`
      : '';

    let rows: any[];
    try {
      const stmt = ctx.db.prepare(`
        SELECT id, key, namespace, content, embedding
        FROM memory_entries
        WHERE status = 'active' ${nsFilter}
        LIMIT 1000
      `);
      rows = effectiveNamespace !== 'all' ? stmt.all(effectiveNamespace) : stmt.all();
    } catch {
      return null;
    }

    // Phase 2: Compute BM25 term stats for the corpus
    const queryTerms = queryStr.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const { termDocFreqs, avgDocLength } = computeTermDocFreqs(queryTerms, rows);
    const docCount = rows.length;

    const results: { id: string; key: string; content: string; score: number; namespace: string; provenance?: string }[] = [];

    for (const row of rows) {
      let semanticScore = 0;
      let bm25ScoreVal = 0;

      // Semantic scoring via cosine similarity
      if (queryEmbedding && row.embedding) {
        try {
          const embedding = JSON.parse(row.embedding) as number[];
          semanticScore = cosineSim(queryEmbedding, embedding);
        } catch {
          // Invalid embedding
        }
      }

      // Phase 2: BM25 keyword scoring (replaces String.includes fallback)
      if (queryTerms.length > 0 && row.content) {
        bm25ScoreVal = bm25Score(queryTerms, row.content, avgDocLength, docCount, termDocFreqs);
        // Normalize BM25 to 0-1 range (cap at 10 for normalization)
        bm25ScoreVal = Math.min(bm25ScoreVal / 10, 1.0);
      }

      // Reciprocal rank fusion: combine semantic and BM25
      // Weight: 0.7 semantic + 0.3 BM25 when both embeddings present
      // Fall back to BM25-only when either query or row lacks an embedding
      const score = semanticScore > 0
        ? (0.7 * semanticScore + 0.3 * bm25ScoreVal)
        : bm25ScoreVal;

      if (score >= threshold) {
        // Phase 4: ExplainableRecall provenance
        const provenance = queryEmbedding
          ? `semantic:${semanticScore.toFixed(3)}+bm25:${bm25ScoreVal.toFixed(3)}`
          : `bm25:${bm25ScoreVal.toFixed(3)}`;

        results.push({
          id: String(row.id).substring(0, 12),
          key: row.key || String(row.id).substring(0, 15),
          content: (row.content || '').substring(0, 60) + ((row.content || '').length > 60 ? '...' : ''),
          score,
          namespace: row.namespace || 'default',
          provenance,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return {
      success: true,
      results: results.slice(0, limit),
      searchTime: Date.now() - startTime,
      searchMethod: queryEmbedding ? 'hybrid-bm25-semantic' : 'bm25-only',
    };
  } catch {
    return null;
  }
}

/**
 * List entries via AgentDB v3.
 */
export async function bridgeListEntries(options: {
  namespace?: string;
  limit?: number;
  offset?: number;
  dbPath?: string;
  /** #2073: When true, include the entry's full `content` string in each result. */
  includeContent?: boolean;
}): Promise<{
  success: boolean;
  entries: {
    id: string;
    key: string;
    namespace: string;
    size: number;
    accessCount: number;
    createdAt: string;
    updatedAt: string;
    hasEmbedding: boolean;
    /** #2073: Present when `includeContent: true` was requested. */
    content?: string;
  }[];
  total: number;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const { namespace, limit = 20, offset = 0 } = options;

    const nsFilter = namespace ? `AND namespace = ?` : '';
    const nsParams = namespace ? [namespace] : [];

    // #2120 — `status IS NULL` accepted alongside `'active'`. Old
    // databases imported by the auto-memory bridge (before the status
    // column existed) end up with NULL status after schema migration if
    // the migration ran on an existing DB without a backfill. Reporter
    // @alexandrelealbess on WSL2 had 251 entries with NULL status, so
    // the `status = 'active'` filter matched zero. Treat NULL as
    // "legacy-active" — the safe default for any entry that predates the
    // status column.
    const statusFilter = `(status = 'active' OR status IS NULL)`;

    // Count
    let total = 0;
    try {
      const countStmt = ctx.db.prepare(
        `SELECT COUNT(*) as cnt FROM memory_entries WHERE ${statusFilter} ${nsFilter}`
      );
      const countRow = countStmt.get(...nsParams);
      total = countRow?.cnt ?? 0;
    } catch {
      return null;
    }

    // List
    const entries: any[] = [];
    try {
      const stmt = ctx.db.prepare(`
        SELECT id, key, namespace, content, embedding, access_count, created_at, updated_at
        FROM memory_entries
        WHERE ${statusFilter} ${nsFilter}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(...nsParams, limit, offset);
      for (const row of rows) {
        const entry: Record<string, unknown> = {
          // #2073: don't truncate id when content is requested — callers
          // (notably memory_export) need the full id to round-trip via import.
          id: options.includeContent ? String(row.id) : String(row.id).substring(0, 20),
          key: row.key || String(row.id).substring(0, 15),
          namespace: row.namespace || 'default',
          size: (row.content || '').length,
          accessCount: row.access_count ?? 0,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
          hasEmbedding: !!(row.embedding && String(row.embedding).length > 10),
        };
        if (options.includeContent) {
          entry.content = row.content || '';
        }
        entries.push(entry);
      }
    } catch {
      return null;
    }

    return { success: true, entries, total };
  } catch {
    return null;
  }
}

/**
 * Get a specific entry via AgentDB v3.
 * Phase 2: TieredCache consulted before DB hit.
 */
export async function bridgeGetEntry(options: {
  key: string;
  namespace?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  found: boolean;
  entry?: {
    id: string;
    key: string;
    namespace: string;
    content: string;
    accessCount: number;
    createdAt: string;
    updatedAt: string;
    hasEmbedding: boolean;
    tags: string[];
  };
  cacheHit?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const { key, namespace = 'default' } = options;

    // Phase 2: Check TieredCache first
    const safeNs = String(namespace).replace(/:/g, '_');
    const safeKey = String(key).replace(/:/g, '_');
    const cacheKey = `entry:${safeNs}:${safeKey}`;
    const cached = await cacheGet(registry, cacheKey);
    if (cached && cached.content) {
      return {
        success: true,
        found: true,
        cacheHit: true,
        entry: {
          id: String(cached.id || ''),
          key: cached.key || key,
          namespace: cached.namespace || namespace,
          content: cached.content || '',
          accessCount: cached.accessCount ?? 0,
          createdAt: cached.createdAt || new Date().toISOString(),
          updatedAt: cached.updatedAt || new Date().toISOString(),
          hasEmbedding: !!cached.embedding,
          tags: cached.tags || [],
        },
      };
    }

    let row: any;
    try {
      const stmt = ctx.db.prepare(`
        SELECT id, key, namespace, content, embedding, access_count, created_at, updated_at, tags
        FROM memory_entries
        WHERE status = 'active' AND key = ? AND namespace = ?
        LIMIT 1
      `);
      row = stmt.get(key, namespace);
    } catch {
      return null;
    }

    if (!row) {
      return { success: true, found: false };
    }

    // Update access count
    try {
      ctx.db.prepare(
        `UPDATE memory_entries SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`
      ).run(Date.now(), row.id);
    } catch {
      // Non-fatal
    }

    let tags: string[] = [];
    if (row.tags) {
      try { tags = JSON.parse(row.tags); } catch { /* invalid */ }
    }

    const entry = {
      id: String(row.id),
      key: row.key || String(row.id),
      namespace: row.namespace || 'default',
      content: row.content || '',
      accessCount: (row.access_count ?? 0) + 1,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      hasEmbedding: !!(row.embedding && String(row.embedding).length > 10),
      tags,
    };

    // Phase 2: Populate cache for next read
    await cacheSet(registry, cacheKey, entry);

    return { success: true, found: true, cacheHit: false, entry };
  } catch {
    return null;
  }
}

/**
 * Delete an entry via AgentDB v3.
 * Phase 5: MutationGuard validation, cache invalidation, attestation logging.
 */
export async function bridgeDeleteEntry(options: {
  key: string;
  namespace?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  deleted: boolean;
  key: string;
  namespace: string;
  remainingEntries: number;
  guarded?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const { key, namespace = 'default' } = options;

    // Phase 5: MutationGuard validation before delete
    const guardResult = await guardValidate(registry, 'delete', { key, namespace });
    if (!guardResult.allowed) {
      return { success: false, deleted: false, key, namespace, remainingEntries: 0, error: `MutationGuard rejected: ${guardResult.reason}` };
    }

    // Soft delete using parameterized query
    let changes = 0;
    try {
      const result = ctx.db.prepare(`
        UPDATE memory_entries
        SET status = 'deleted', updated_at = ?
        WHERE key = ? AND namespace = ? AND status = 'active'
      `).run(Date.now(), key, namespace);
      changes = result?.changes ?? 0;
    } catch {
      return null;
    }

    // Phase 2: Invalidate cache
    const safeNs = String(namespace).replace(/:/g, '_');
    const safeKey = String(key).replace(/:/g, '_');
    await cacheInvalidate(registry, `entry:${safeNs}:${safeKey}`);

    // Phase 4: AttestationLog delete audit
    if (changes > 0) {
      await logAttestation(registry, 'delete', key, { namespace });
    }

    let remaining = 0;
    try {
      const row = ctx.db.prepare(`SELECT COUNT(*) as cnt FROM memory_entries WHERE status = 'active'`).get();
      remaining = row?.cnt ?? 0;
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      deleted: changes > 0,
      key,
      namespace,
      remainingEntries: remaining,
      guarded: true,
    };
  } catch {
    return null;
  }
}

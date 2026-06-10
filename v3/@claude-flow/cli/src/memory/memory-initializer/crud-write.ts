/**
 * Memory CRUD write + query operations — extracted from
 * memory-initializer.ts.
 *
 *   - storeEntry      (write a key+value entry directly via sql.js,
 *                     bridge-first; embeds the value + adds it to the
 *                     HNSW index when an embedding is generated)
 *   - searchEntries   (semantic + substring query; HNSW vector search
 *                     when embeddings exist, cosine re-rank, sql.js
 *                     fallback)
 *   - cosineSim       (internal unit-cosine helper for the re-rank)
 *
 * Extracted from memory-initializer.ts (W61, P3.3 cut #8). All deps are
 * already-extracted sibling modules.
 */
import * as fs from 'fs';
import * as path from 'path';
import { readFileMaybeEncrypted, writeFileRestricted } from '../../fs-secure.js';
import { getMemoryRoot, getBridge } from './paths.js';
import { ensureSchemaColumns } from './schema-mgmt.js';
import { generateEmbedding } from './embedding.js';
import { addToHNSWIndex, searchHNSWIndex } from './hnsw.js';

/**
 * Store an entry directly using sql.js
 * This bypasses MCP and writes directly to the database
 */
export async function storeEntry(options: {
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
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeStoreEntry(options);
    if (bridgeResult) {
      // Keep HNSW index in sync with bridge-stored entries
      if (bridgeResult.rawEmbedding && bridgeResult.success) {
        const ns = options.namespace || 'default';
        await addToHNSWIndex(bridgeResult.id, bridgeResult.rawEmbedding, {
          id: bridgeResult.id,
          key: options.key,
          namespace: ns,
          content: options.value,
        }).catch(() => {});
      }
      return bridgeResult;
    }
  }

  // Fallback: raw sql.js
  const {
    key,
    value,
    namespace = 'default',
    generateEmbeddingFlag = true,
    tags = [],
    ttl,
    dbPath: customPath,
    upsert = false
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath ? path.resolve(customPath) : path.join(swarmDir, 'memory.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, id: '', error: 'Database not initialized. Run: claude-flow memory init' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    const id = `entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Generate embedding if requested
    let embeddingJson: string | null = null;
    let embeddingDimensions: number | null = null;
    let embeddingModel: string | null = null;

    if (generateEmbeddingFlag && value.length > 0) {
      const embResult = await generateEmbedding(value);
      embeddingJson = JSON.stringify(embResult.embedding);
      embeddingDimensions = embResult.dimensions;
      embeddingModel = embResult.model;
    }

    // #1941: provision a `vector_indexes` row for this namespace before the
    // entry insert. The HNSW lookup uses this table to find which namespaces
    // are indexed — without a row, `memory_search({namespace:"X"})` returns
    // 0 even when memory_entries holds matching rows. INSERT OR IGNORE
    // preserves the existing `default` / `patterns` rows.
    try {
      db.run(
        `INSERT OR IGNORE INTO vector_indexes (id, name, dimensions) VALUES (?, ?, ?)`,
        [namespace, namespace, embeddingDimensions ?? 384]
      );
    } catch { /* vector_indexes may not exist on legacy DBs — fall through */ }

    // Insert or update entry (upsert mode uses REPLACE)
    const insertSql = upsert
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

    db.run(insertSql, [
      id,
      key,
      namespace,
      value,
      embeddingJson,
      embeddingDimensions,
      embeddingModel,
      tags.length > 0 ? JSON.stringify(tags) : null,
      '{}',
      now,
      now,
      ttl ? now + (ttl * 1000) : null
    ]);

    // Save
    const data = db.export();
    writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });
    db.close();

    // Add to HNSW index for faster future searches
    if (embeddingJson) {
      const embResult = JSON.parse(embeddingJson) as number[];
      await addToHNSWIndex(id, embResult, {
        id,
        key,
        namespace,
        content: value
      });
    }

    return {
      success: true,
      id,
      embedding: embeddingJson ? { dimensions: embeddingDimensions!, model: embeddingModel! } : undefined
    };
  } catch (error) {
    return {
      success: false,
      id: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Search entries using sql.js with vector similarity
 * Uses HNSW index for HNSW-indexed search when available
 */
export async function searchEntries(options: {
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
  }[];
  searchTime: number;
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeSearchEntries(options);
    if (bridgeResult) return bridgeResult;
  }

  // Fallback: raw sql.js
  const {
    query,
    namespace,
    limit = 10,
    threshold = 0.3,
    dbPath: customPath
  } = options;
  const effectiveNamespace = namespace || 'all';

  const swarmDir = getMemoryRoot();
  const dbPath = customPath ? path.resolve(customPath) : path.join(swarmDir, 'memory.db');
  const startTime = Date.now();

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, results: [], searchTime: 0, error: 'Database not found' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    // Generate query embedding
    const queryEmb = await generateEmbedding(query);
    const queryEmbedding = queryEmb.embedding;

    // Try RaBitQ pre-filter first (32× compressed Hamming scan)
    try {
      const { searchRabitq } = await import('../rabitq-index.js');
      const rabitqCandidates = await searchRabitq(queryEmbedding, { k: limit * 2, namespace: effectiveNamespace });
      if (rabitqCandidates && rabitqCandidates.length > 0) {
        // Rerank candidates with exact cosine similarity from SQLite
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();
        const fileBuffer = readFileMaybeEncrypted(dbPath, null);
        const db = new SQL.Database(fileBuffer);
        const reranked: { id: string; key: string; content: string; score: number; namespace: string }[] = [];

        for (const candidate of rabitqCandidates) {
          const stmt = db.prepare('SELECT content, embedding FROM memory_entries WHERE id = ? AND status = ?');
          stmt.bind([candidate.id, 'active']);
          if (stmt.step()) {
            const [content, embeddingJson] = stmt.get() as [string, string | null];
            let score = 0;
            if (embeddingJson) {
              try {
                const embedding = JSON.parse(embeddingJson) as number[];
                score = cosineSim(queryEmbedding, embedding);
              } catch { /* skip */ }
            }
            if (score >= threshold) {
              reranked.push({
                id: candidate.id.substring(0, 12),
                key: candidate.key || candidate.id.substring(0, 15),
                content: (content || '').substring(0, 60) + ((content || '').length > 60 ? '...' : ''),
                score,
                namespace: candidate.namespace,
              });
            }
          }
          stmt.free();
        }
        db.close();

        if (reranked.length > 0) {
          reranked.sort((a, b) => b.score - a.score);
          return { success: true, results: reranked.slice(0, limit), searchTime: Date.now() - startTime };
        }
      }
    } catch { /* RaBitQ unavailable, fall through */ }

    // Try HNSW search (faster than brute-force (~1.9x-4.7x, measured))
    const hnswResults = await searchHNSWIndex(queryEmbedding, { k: limit, namespace: effectiveNamespace });
    if (hnswResults && hnswResults.length > 0) {
      // Filter by threshold
      const filtered = hnswResults.filter(r => r.score >= threshold);
      return {
        success: true,
        results: filtered,
        searchTime: Date.now() - startTime
      };
    }

    // Fall back to brute-force SQLite search
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Get entries with embeddings
    const searchStmt = db.prepare(
      effectiveNamespace !== 'all'
        ? `SELECT id, key, namespace, content, embedding FROM memory_entries WHERE status = 'active' AND namespace = ? LIMIT 1000`
        : `SELECT id, key, namespace, content, embedding FROM memory_entries WHERE status = 'active' LIMIT 1000`
    );
    if (effectiveNamespace !== 'all') {
      searchStmt.bind([effectiveNamespace]);
    }
    const searchRows: unknown[][] = [];
    while (searchStmt.step()) {
      searchRows.push(searchStmt.get());
    }
    searchStmt.free();
    const entries = searchRows.length > 0 ? [{ values: searchRows }] : [];

    const results: { id: string; key: string; content: string; score: number; namespace: string }[] = [];

    if (entries[0]?.values) {
      for (const row of entries[0].values) {
        const [id, key, ns, content, embeddingJson] = row as [string, string, string, string, string | null];

        let score = 0;

        if (embeddingJson) {
          try {
            const embedding = JSON.parse(embeddingJson) as number[];
            score = cosineSim(queryEmbedding, embedding);
          } catch {
            // Invalid embedding, use keyword score
          }
        }

        // Fallback to keyword matching
        if (score < threshold) {
          const lowerContent = (content || '').toLowerCase();
          const lowerQuery = query.toLowerCase();
          const words = lowerQuery.split(/\s+/);
          const matchCount = words.filter(w => lowerContent.includes(w)).length;
          const keywordScore = matchCount / words.length * 0.5;
          score = Math.max(score, keywordScore);
        }

        if (score >= threshold) {
          results.push({
            id: id.substring(0, 12),
            key: key || id.substring(0, 15),
            content: (content || '').substring(0, 60) + ((content || '').length > 60 ? '...' : ''),
            score,
            namespace: ns || 'default'
          });
        }
      }
    }

    db.close();

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return {
      success: true,
      results: results.slice(0, limit),
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Optimized cosine similarity
 * V8 JIT-friendly - avoids manual unrolling which can hurt performance
 * ~0.5μs per 384-dim vector comparison
 */
function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;

  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;

  // Simple loop - V8 optimizes this well
  for (let i = 0; i < len; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  // Combined sqrt for slightly better performance
  const mag = Math.sqrt(normA * normB);
  return mag === 0 ? 0 : dot / mag;
}

/**
 * HNSW vector-index singleton extracted from memory-initializer.ts.
 *
 * Owns the in-memory HNSW index lifecycle:
 *   - HNSWEntry / HNSWIndex types (internal)
 *   - hnswIndex + hnswInitializing module-level singletons
 *   - getHNSWIndex          (lazy init from SQLite + persisted hnsw.index)
 *   - saveHNSWMetadata      (persist entry metadata alongside the index)
 *   - addToHNSWIndex        (insert a vector + metadata)
 *   - searchHNSWIndex       (k-NN query against the live singleton)
 *   - getHNSWStatus         (availability / entry-count introspection)
 *   - clearHNSWIndex        (drop the singleton)
 *   - rebuildSearchIndex    (invalidate so the next search rebuilds from DB)
 *   - evictHNSWEntryByKeyNamespace / evictHNSWEntryById
 *                           (delete-path cache invalidation, #1122 — used
 *                            by deleteEntry in the parent so it never has
 *                            to reach into the private singleton)
 *
 * Uses @ruvector/core for the WASM-accelerated HNSW backend, falling back
 * to a sql.js-backed brute-force rebuild when the native module or the
 * bridge is unavailable.
 *
 * Extracted from memory-initializer.ts (W56, P3.3 cut #4). Unblocked by
 * W55 which moved getMemoryRoot / getBridge / isBridgeLoaded into
 * paths.ts so this module imports them rather than the monolith.
 */
import * as fs from 'fs';
import * as path from 'path';
import { readFileMaybeEncrypted } from '../../fs-secure.js';
import { getMemoryRoot, getBridge, isBridgeLoaded } from './paths.js';


interface HNSWEntry {
  id: string;
  key: string;
  namespace: string;
  content: string;
}

interface HNSWIndex {
  db: any;
  entries: Map<string, HNSWEntry>;
  dimensions: number;
  initialized: boolean;
}

let hnswIndex: HNSWIndex | null = null;
let hnswInitializing = false;

/**
 * Get or create the HNSW index singleton
 * Lazily initializes from SQLite data on first use
 */
export async function getHNSWIndex(options?: {
  dbPath?: string;
  dimensions?: number;
  forceRebuild?: boolean;
}): Promise<HNSWIndex | null> {
  const dimensions = options?.dimensions ?? 384;

  // Return existing index if already initialized
  if (hnswIndex?.initialized && !options?.forceRebuild) {
    return hnswIndex;
  }

  // Prevent concurrent initialization
  if (hnswInitializing) {
    // Wait for initialization to complete
    while (hnswInitializing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return hnswIndex;
  }

  hnswInitializing = true;

  try {
    // Import @ruvector/core dynamically
    // Handle both ESM (default export) and CJS patterns
    const ruvectorModule = await import('@ruvector/core').catch(() => null);
    if (!ruvectorModule) {
      hnswInitializing = false;
      return null; // HNSW not available
    }

    // ESM returns { default: { VectorDb, ... } }, CJS returns { VectorDb, ... }
    const ruvectorCore = (ruvectorModule as any).default || ruvectorModule;
    if (!ruvectorCore?.VectorDb) {
      hnswInitializing = false;
      return null; // VectorDb not found
    }

    const { VectorDb } = ruvectorCore;

    // Persistent storage paths — resolve to absolute to survive CWD changes
    const swarmDir = getMemoryRoot();
    if (!fs.existsSync(swarmDir)) {
      fs.mkdirSync(swarmDir, { recursive: true });
    }
    const hnswPath = path.join(swarmDir, 'hnsw.index');
    const metadataPath = path.join(swarmDir, 'hnsw.metadata.json');
    const dbPath = options?.dbPath ? path.resolve(options.dbPath) : path.join(swarmDir, 'memory.db');

    // Create HNSW index with persistent storage
    // @ruvector/core uses string enum for distanceMetric: 'Cosine', 'Euclidean', 'DotProduct', 'Manhattan'
    const db = new VectorDb({
      dimensions,
      distanceMetric: 'Cosine',
      storagePath: hnswPath  // Persistent storage!
    } as any);

    // Load metadata (entry info) if exists
    const entries = new Map<string, HNSWEntry>();
    if (fs.existsSync(metadataPath)) {
      try {
        const metadataJson = fs.readFileSync(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataJson) as Array<[string, HNSWEntry]>;
        for (const [key, value] of metadata) {
          entries.set(key, value);
        }
      } catch {
        // Metadata load failed, will rebuild
      }
    }

    hnswIndex = {
      db,
      entries,
      dimensions,
      initialized: false
    };

    // Check if index already has data (from persistent storage)
    const existingLen = await db.len();
    if (existingLen > 0 && entries.size > 0) {
      // Index loaded from disk, skip SQLite sync
      hnswIndex.initialized = true;
      hnswInitializing = false;
      return hnswIndex;
    }

    if (fs.existsSync(dbPath)) {
      try {
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();
        const fileBuffer = readFileMaybeEncrypted(dbPath, null);
        const sqlDb = new SQL.Database(fileBuffer);

        // Load all entries with embeddings
        const result = sqlDb.exec(`
          SELECT id, key, namespace, content, embedding
          FROM memory_entries
          WHERE status = 'active' AND embedding IS NOT NULL
          LIMIT 10000
        `);

        if (result[0]?.values) {
          for (const row of result[0].values) {
            const [id, key, ns, content, embeddingJson] = row as [string, string, string, string, string];
            if (embeddingJson) {
              try {
                const embedding = JSON.parse(embeddingJson) as number[];
                const vector = new Float32Array(embedding);

                await db.insert({
                  id: String(id),
                  vector
                });

                hnswIndex.entries.set(String(id), {
                  id: String(id),
                  key: key || String(id),
                  namespace: ns || 'default',
                  content: content || ''
                });
              } catch {
                // Skip invalid embeddings
              }
            }
          }
        }

        sqlDb.close();
      } catch {
        // SQLite load failed, start with empty index
      }
    }

    hnswIndex.initialized = true;
    hnswInitializing = false;
    return hnswIndex;
  } catch {
    hnswInitializing = false;
    return null;
  }
}

/**
 * Save HNSW metadata to disk for persistence
 */
function saveHNSWMetadata(): void {
  if (!hnswIndex?.entries) return;

  try {
    const swarmDir = getMemoryRoot();
    const metadataPath = path.join(swarmDir, 'hnsw.metadata.json');
    const metadata = Array.from(hnswIndex.entries.entries());
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  } catch {
    // Silently fail - metadata save is best-effort
  }
}

/**
 * Add entry to HNSW index (with automatic persistence)
 */
export async function addToHNSWIndex(
  id: string,
  embedding: number[],
  entry: HNSWEntry
): Promise<boolean> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeAddToHNSW(id, embedding, entry);
    if (bridgeResult === true) return true;
  }

  const index = await getHNSWIndex({ dimensions: embedding.length });
  if (!index) return false;

  try {
    const vector = new Float32Array(embedding);
    await index.db.insert({
      id,
      vector
    });
    index.entries.set(id, entry);

    // Save metadata for persistence (debounced would be better for high-volume)
    saveHNSWMetadata();
    return true;
  } catch {
    return false;
  }
}

/**
 * Search HNSW index (faster than brute-force (~1.9x-4.7x, measured))
 * Returns results sorted by similarity (highest first)
 */
export async function searchHNSWIndex(
  queryEmbedding: number[],
  options?: {
    k?: number;
    namespace?: string;
  }
): Promise<Array<{ id: string; key: string; content: string; score: number; namespace: string }> | null> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeSearchHNSW(queryEmbedding, options);
    if (bridgeResult) return bridgeResult;
  }

  const index = await getHNSWIndex({ dimensions: queryEmbedding.length });
  if (!index) return null;

  try {
    const vector = new Float32Array(queryEmbedding);
    const k = options?.k ?? 10;

    // HNSW search returns results with cosine distance (lower = more similar)
    const results = await index.db.search({ vector, k: k * 2 }); // Get extra for filtering

    const filtered: Array<{ id: string; key: string; content: string; score: number; namespace: string }> = [];

    for (const result of results) {
      const entry = index.entries.get(result.id);
      if (!entry) continue;

      // Filter by namespace if specified
      if (options?.namespace && options.namespace !== 'all' && entry.namespace !== options.namespace) {
        continue;
      }

      // Convert cosine distance to similarity score (1 - distance)
      // Cosine distance from @ruvector/core: 0 = identical, 2 = opposite
      const score = 1 - (result.score / 2);

      filtered.push({
        id: entry.id.substring(0, 12),
        key: entry.key || entry.id.substring(0, 15),
        content: entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : ''),
        score,
        namespace: entry.namespace
      });

      if (filtered.length >= k) break;
    }

    // Sort by score descending (highest similarity first)
    filtered.sort((a, b) => b.score - a.score);

    return filtered;
  } catch {
    return null;
  }
}

/**
 * Get HNSW index status
 */
export function getHNSWStatus(): {
  available: boolean;
  initialized: boolean;
  entryCount: number;
  dimensions: number;
} {
  // ADR-053: If bridge was previously loaded, report availability
  if (isBridgeLoaded()) {
    // Bridge is loaded — HNSW-equivalent is available via AgentDB v3
    return {
      available: true,
      initialized: true,
      entryCount: hnswIndex?.entries.size ?? 0,
      dimensions: hnswIndex?.dimensions ?? 384
    };
  }

  return {
    available: hnswIndex !== null,
    initialized: hnswIndex?.initialized ?? false,
    entryCount: hnswIndex?.entries.size ?? 0,
    dimensions: hnswIndex?.dimensions ?? 384
  };
}

/**
 * Clear the HNSW index (for rebuilding)
 */
export function clearHNSWIndex(): void {
  hnswIndex = null;
}

/**
 * Invalidate the in-memory HNSW cache so the next search rebuilds from DB.
 * Call this after deleting entries that had embeddings to prevent ghost
 * vectors from appearing in search results.
 */
export function rebuildSearchIndex(): void {
  hnswIndex = null;
  hnswInitializing = false;
}

/**
 * #1122 delete-path cache invalidation: remove an entry from the
 * in-memory HNSW index by its key+namespace composite, then persist
 * metadata and invalidate so the next search rebuilds from DB. Used by
 * the bridge delete path. No-op when the index isn't loaded.
 */
export function evictHNSWEntryByKeyNamespace(key: string, namespace?: string): void {
  if (!hnswIndex?.entries) return;
  for (const [id, entry] of hnswIndex.entries) {
    if ((entry as any)?.key === key && ((entry as any)?.namespace ?? 'default') === (namespace ?? 'default')) {
      hnswIndex.entries.delete(id);
      break;
    }
  }
  saveHNSWMetadata();
  rebuildSearchIndex();
}

/**
 * #1122 delete-path cache invalidation: remove an entry from the
 * in-memory HNSW index by its id, then persist metadata and invalidate.
 * Used by the raw sql.js delete path. No-op when the index isn't loaded.
 */
export function evictHNSWEntryById(id: string): void {
  if (!hnswIndex?.entries) return;
  hnswIndex.entries.delete(id);
  saveHNSWMetadata();
  rebuildSearchIndex();
}

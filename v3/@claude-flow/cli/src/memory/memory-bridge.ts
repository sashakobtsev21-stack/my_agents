/**
 * Memory Bridge — Routes CLI memory operations through ControllerRegistry + AgentDB v3
 *
 * Per ADR-053 Phases 1-6: Full controller activation pipeline.
 * CLI → ControllerRegistry → AgentDB v3 controllers.
 *
 * Phase 1: Core CRUD + embeddings + HNSW + controller access (complete)
 * Phase 2: BM25 hybrid search, TieredCache read/write, MutationGuard validation
 * Phase 3: ReasoningBank pattern store, recordFeedback, CausalMemoryGraph edges
 * Phase 4: SkillLibrary promotion, ExplainableRecall provenance, AttestationLog
 * Phase 5: ReflexionMemory session lifecycle, WitnessChain attestation
 * Phase 6: AgentDB MCP tools (separate file), COW branching
 *
 * Uses better-sqlite3 API (synchronous .all()/.get()/.run()) since that's
 * what AgentDB v3 uses internally.
 *
 * @module v3/cli/memory-bridge
 */

// Pure scoring helper (cosine similarity) moved to
// ./memory-bridge/scoring.ts (W64, P3.4 cut #1). Still consumed inline
// by bridgeSearchHNSW here; the BM25 pair moved with the CRUD search.
import { cosineSim } from './memory-bridge/scoring.js';

// Shared bridge infrastructure — the ControllerRegistry lazy singleton +
// every cross-cutting helper (id/guard/attestation/db-table) — moved to
// ./memory-bridge/bridge-core.ts (W65, P3.4 cut #2). The bridge*
// functions below build on these; the 3 lifecycle helpers
// (isBridgeAvailable / getControllerRegistry / shutdownBridge) are public
// API, re-exported byte-identically.
import {
  errMsg,
  generateId,
  getRegistry,
  guardValidate,
  logAttestation,
  getDb,
  isBridgeAvailable,
  getControllerRegistry,
  shutdownBridge,
} from './memory-bridge/bridge-core.js';
export { isBridgeAvailable, getControllerRegistry, shutdownBridge };

// CRUD operations (bridgeStoreEntry / SearchEntries / ListEntries /
// GetEntry / DeleteEntry) moved to ./memory-bridge/bridge-crud.ts
// (W66, P3.4 cut #3). bridgeStoreEntry + bridgeSearchEntries are called
// inline by other bridge* functions here (pattern store, hierarchical
// store, semantic route), so they're imported for local bindings; all
// five are re-exported byte-identically — memory-initializer's
// getBridge() resolves them by name.
import {
  bridgeStoreEntry,
  bridgeSearchEntries,
  bridgeListEntries,
} from './memory-bridge/bridge-crud.js';
export {
  bridgeStoreEntry,
  bridgeSearchEntries,
  bridgeListEntries,
  bridgeGetEntry,
  bridgeDeleteEntry,
} from './memory-bridge/bridge-crud.js';

// ===== Bridge functions — match memory-initializer.ts signatures =====

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

// ===== Phase 4: Controller access =====

/**
 * Get a named controller from AgentDB v3 via ControllerRegistry.
 * Returns null if unavailable.
 */
export async function bridgeGetController(
  name: string,
  dbPath?: string,
): Promise<any | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    return registry.get(name) ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a controller is available.
 */
export async function bridgeHasController(
  name: string,
  dbPath?: string,
): Promise<boolean> {
  const registry = await getRegistry(dbPath);
  if (!registry) return false;

  try {
    const controller = registry.get(name);
    return controller !== null && controller !== undefined;
  } catch {
    return false;
  }
}

/**
 * List all controllers and their status.
 */
export async function bridgeListControllers(
  dbPath?: string,
): Promise<Array<{ name: string; enabled: boolean; level: number }> | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    return registry.listControllers();
  } catch {
    return null;
  }
}


// ===== Phase 3: ReasoningBank pattern operations =====

/**
 * Store a pattern via ReasoningBank controller.
 * Falls back to raw SQL if ReasoningBank unavailable.
 */
export async function bridgeStorePattern(options: {
  pattern: string;
  type: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  dbPath?: string;
}): Promise<{ success: boolean; patternId: string; controller: string } | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    const reasoningBank = registry.get('reasoningBank');
    const patternId = generateId('pattern');

    if (reasoningBank && typeof reasoningBank.store === 'function') {
      await reasoningBank.store({
        id: patternId,
        content: options.pattern,
        type: options.type,
        confidence: options.confidence,
        metadata: options.metadata,
        timestamp: Date.now(),
      });
      return { success: true, patternId, controller: 'reasoningBank' };
    }

    // Fallback: store via bridge SQL
    const patternValue = JSON.stringify({ pattern: options.pattern, type: options.type, confidence: options.confidence, metadata: options.metadata });
    const result = await bridgeStoreEntry({
      key: patternId,
      value: patternValue,
      namespace: 'pattern',
      generateEmbeddingFlag: true,
      tags: [options.type, 'reasoning-pattern'],
      dbPath: options.dbPath,
    });

    if (!result) return null;

    // Add to HNSW index for fast semantic search (bridgeStoreEntry stores SQL only)
    if (result.rawEmbedding) {
      try {
        const { addToHNSWIndex } = await import('./memory-initializer.js');
        await addToHNSWIndex(result.id, result.rawEmbedding, {
          id: result.id,
          key: patternId,
          namespace: 'pattern',
          content: patternValue,
        });
      } catch { /* HNSW is best-effort */ }
    }

    return { success: true, patternId: result.id, controller: 'bridge-fallback' };
  } catch {
    return null;
  }
}

/**
 * Search patterns via ReasoningBank controller.
 */
export async function bridgeSearchPatterns(options: {
  query: string;
  topK?: number;
  minConfidence?: number;
  dbPath?: string;
}): Promise<{ results: Array<{ id: string; content: string; score: number }>; controller: string } | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    const reasoningBank = registry.get('reasoningBank');

    // ReasoningBank may expose .searchPatterns() (agentdb) or .search() (legacy) (#1492 Bug 2)
    if (reasoningBank && typeof (reasoningBank.searchPatterns ?? reasoningBank.search) === 'function') {
      let results: any;
      if (typeof reasoningBank.searchPatterns === 'function') {
        results = await reasoningBank.searchPatterns({ task: options.query, k: options.topK || 5, threshold: options.minConfidence || 0.3 });
      } else {
        results = await reasoningBank.search(options.query, { topK: options.topK || 5, minScore: options.minConfidence || 0.3 });
      }
      return {
        results: Array.isArray(results) ? results.map((r: any) => ({
          id: r.id || r.patternId || '',
          content: r.content || r.pattern || '',
          score: r.score ?? r.confidence ?? 0,
        })) : [],
        controller: 'reasoningBank',
      };
    }

    // #2226 — the wired-in LocalReasoningBank implements store() + findSimilar()/getAll()
    // but NOT searchPatterns()/search(). bridgeStorePattern commits patterns to its
    // store(), so search MUST read the SAME backend or stored patterns are never found
    // (previously search fell through to the disjoint sql.js 'pattern' namespace, which
    // the store never wrote to → always-empty results). Adapt findSimilar (semantic) with
    // a getAll() substring fallback so freshly-stored patterns are visible. This mirrors
    // what hooks_intelligence_pattern-search already does against the same backend.
    if (reasoningBank && typeof reasoningBank.findSimilar === 'function') {
      const k = options.topK || 5;
      const threshold = options.minConfidence ?? 0.3;
      let mapped: Array<{ id: string; content: string; score: number }> = [];
      try {
        const { generateEmbedding } = await import('./memory-initializer.js');
        const qEmb = await generateEmbedding(options.query);
        if (qEmb && Array.isArray(qEmb.embedding) && qEmb.embedding.length > 0) {
          const hits = reasoningBank.findSimilar(qEmb.embedding, { k, threshold });
          mapped = (Array.isArray(hits) ? hits : []).map((r: any) => ({
            id: r.id ?? '',
            content: r.content ?? '',
            score: r.confidence ?? r.score ?? 0,
          }));
        }
      } catch { /* embedding unavailable — fall through to substring scan */ }

      // Deterministic substring fallback over the same in-memory store.
      if (mapped.length === 0 && typeof reasoningBank.getAll === 'function') {
        const q = options.query.toLowerCase();
        mapped = (reasoningBank.getAll() as any[])
          .filter((p: any) => typeof p.content === 'string' && p.content.toLowerCase().includes(q))
          .slice(0, k)
          .map((p: any) => ({ id: p.id ?? '', content: p.content ?? '', score: p.confidence ?? 0 }));
      }

      return { results: mapped, controller: 'reasoningBank' };
    }

    // Fallback: search via bridge
    const result = await bridgeSearchEntries({
      query: options.query,
      namespace: 'pattern',
      limit: options.topK || 5,
      threshold: options.minConfidence || 0.3,
      dbPath: options.dbPath,
    });

    return result ? {
      results: result.results.map(r => ({ id: r.id, content: r.content, score: r.score })),
      controller: 'bridge-fallback',
    } : null;
  } catch {
    return null;
  }
}

// ===== Phase 3: Feedback recording =====

/**
 * Record task feedback for learning via ReasoningBank or LearningSystem.
 * Wired into hooks_post-task handler.
 */
export async function bridgeRecordFeedback(options: {
  taskId: string;
  success: boolean;
  quality: number;
  agent?: string;
  duration?: number;
  patterns?: string[];
  dbPath?: string;
}): Promise<{ success: boolean; controller: string; updated: number } | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    let controller = 'none';
    let updated = 0;

    // Try LearningSystem first (Phase 4)
    const learningSystem = registry.get('learningSystem');
    if (learningSystem) {
      try {
        if (typeof learningSystem.recordFeedback === 'function') {
          await learningSystem.recordFeedback({
            taskId: options.taskId, success: options.success, quality: options.quality,
            agent: options.agent, duration: options.duration, timestamp: Date.now(),
          });
          controller = 'learningSystem';
          updated++;
        } else if (typeof learningSystem.record === 'function') {
          await learningSystem.record(options.taskId, options.quality, options.success ? 'success' : 'failure');
          controller = 'learningSystem';
          updated++;
        }
      } catch { /* API mismatch — skip */ }
    }

    // Also record in ReasoningBank for pattern reinforcement
    const reasoningBank = registry.get('reasoningBank');
    if (reasoningBank) {
      try {
        if (typeof reasoningBank.recordOutcome === 'function') {
          await reasoningBank.recordOutcome({
            taskId: options.taskId, verdict: options.success ? 'success' : 'failure',
            score: options.quality, timestamp: Date.now(),
          });
          controller = controller === 'none' ? 'reasoningBank' : `${controller}+reasoningBank`;
          updated++;
        } else if (typeof reasoningBank.record === 'function') {
          await reasoningBank.record(options.taskId, options.quality);
          controller = controller === 'none' ? 'reasoningBank' : `${controller}+reasoningBank`;
          updated++;
        }
      } catch { /* API mismatch — skip */ }
    }

    // Phase 4: SkillLibrary promotion for high-quality patterns
    if (options.success && options.quality >= 0.9 && options.patterns?.length) {
      const skills = registry.get('skills');
      if (skills && typeof skills.promote === 'function') {
        for (const pattern of options.patterns) {
          try { await skills.promote(pattern, options.quality); updated++; } catch { /* skip */ }
        }
        controller += '+skills';
      }
    }

    // Always store feedback as a memory entry for retrieval (ensures it persists)
    const storeResult = await bridgeStoreEntry({
      key: `feedback-${options.taskId}`,
      value: JSON.stringify(options),
      namespace: 'feedback',
      tags: [options.success ? 'success' : 'failure', options.agent || 'unknown'],
      dbPath: options.dbPath,
    });
    if (storeResult?.success) {
      controller = controller === 'none' ? 'bridge-store' : `${controller}+bridge-store`;
      updated++;
    }

    return { success: true, controller, updated };
  } catch {
    return null;
  }
}

// ===== Phase 3: CausalMemoryGraph =====

/**
 * Record a causal edge between two entries (e.g., task → result).
 */
export async function bridgeRecordCausalEdge(options: {
  sourceId: string;
  targetId: string;
  relation: string;
  weight?: number;
  dbPath?: string;
}): Promise<{ success: boolean; controller: string } | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    const causalGraph = registry.get('causalGraph');
    if (causalGraph && typeof causalGraph.addEdge === 'function') {
      causalGraph.addEdge(options.sourceId, options.targetId, {
        relation: options.relation,
        weight: options.weight ?? 1.0,
        timestamp: Date.now(),
      });
      return { success: true, controller: 'causalGraph' };
    }

    // Fallback: store edge as metadata
    const ctx = getDb(registry);
    if (ctx) {
      try {
        ctx.db.prepare(`
          INSERT OR REPLACE INTO memory_entries (id, key, namespace, content, type, created_at, updated_at, status)
          VALUES (?, ?, 'causal-edges', ?, 'procedural', ?, ?, 'active')
        `).run(
          generateId('edge'),
          `${options.sourceId}→${options.targetId}`,
          JSON.stringify(options),
          Date.now(), Date.now(),
        );
        return { success: true, controller: 'bridge-fallback' };
      } catch { /* skip */ }
    }

    return null;
  } catch {
    return null;
  }
}

// ===== #1784: Delete tools for hierarchical + causal-graph =====

/**
 * Delete a hierarchical-memory entry by key (#1784).
 *
 * Reality check: agentdb's HierarchicalMemory class doesn't expose a public
 * delete API today, so the real-backend path falls back to direct SQL on
 * the underlying SQLite tables (status flip to 'deleted' + AttestationLog
 * audit). The bridge-fallback path that bridgeHierarchicalStore uses when
 * HierarchicalMemory isn't loaded writes plain memory_entries rows that
 * `bridgeDeleteEntry` already handles.
 *
 * Returns { controller: 'native-unsupported' } when the real HM is loaded
 * and the SQL fallback can't reach its private tables — surfacing the
 * limitation honestly instead of silently returning success.
 */
export async function bridgeDeleteHierarchical(options: {
  key: string;
  tier?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  deleted: boolean;
  key: string;
  tier?: string;
  controller: string;
  guarded?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;
  try {
    const { key, tier } = options;

    // MutationGuard validation
    const guardResult = await guardValidate(registry, 'delete', { key, namespace: 'hierarchical' });
    if (!guardResult.allowed) {
      return { success: false, deleted: false, key, tier, controller: 'guard', error: `MutationGuard rejected: ${guardResult.reason}` };
    }

    const hm = registry.get('hierarchicalMemory');

    // 1. agentdb@3.0.0-alpha.13+: ReflexionMemory.deleteEpisode propagates through
    //    graph adapter / generic graph backend / vector backend AND purges SQL
    //    episodes + episode_embeddings rows. Single call, durably consistent.
    //    See agentic-flow#150/#151 (closes ruvnet/RuVector#427 the cli-visible way).
    const reflexion = registry.get('reflexionMemory');
    if (reflexion && typeof reflexion.deleteEpisode === 'function') {
      try {
        const removed = await reflexion.deleteEpisode(key);
        if (removed) {
          await logAttestation(registry, 'delete', key, { namespace: 'hierarchical', tier });
          return { success: true, deleted: true, key, tier, controller: 'reflexionMemory', guarded: true };
        }
      } catch { /* fall through */ }
    }

    // 2. Try HierarchicalMemory's own delete API if it ever ships one.
    if (hm && typeof hm.delete === 'function') {
      try {
        await hm.delete(key);
        await logAttestation(registry, 'delete', key, { namespace: 'hierarchical', tier });
        return { success: true, deleted: true, key, tier, controller: 'hierarchicalMemory', guarded: true };
      } catch (err) {
        // Fall through to SQL fallback
      }
    }

    // 3. Stub HierarchicalMemory may expose `remove` or `forget`
    if (hm && typeof hm.remove === 'function') {
      try {
        await hm.remove(key);
        await logAttestation(registry, 'delete', key, { namespace: 'hierarchical', tier });
        return { success: true, deleted: true, key, tier, controller: 'hierarchicalMemory-stub', guarded: true };
      } catch { /* fall through */ }
    }

    // 3. Bridge-fallback: HM stored to memory_entries with namespace prefix
    //    (used when the real controller isn't loaded). Soft-delete via SQL.
    const ctx = getDb(registry);
    if (ctx) {
      try {
        const result = ctx.db.prepare(`
          UPDATE memory_entries
          SET status = 'deleted', updated_at = ?
          WHERE key = ? AND namespace LIKE 'hierarchical%' AND status = 'active'
        `).run(Date.now(), key);
        const changes = result?.changes ?? 0;
        if (changes > 0) {
          await logAttestation(registry, 'delete', key, { namespace: 'hierarchical', tier });
          return { success: true, deleted: true, key, tier, controller: 'bridge-fallback', guarded: true };
        }
        // Nothing to delete in SQL fallback — and no real-HM delete API.
        // Surface the situation honestly.
        return {
          success: false, deleted: false, key, tier,
          controller: hm ? 'native-unsupported' : 'not-found',
          error: hm
            ? 'HierarchicalMemory has no public delete API; entry remains in native storage'
            : 'No hierarchical entry found with this key',
        };
      } catch (err) {
        return { success: false, deleted: false, key, tier, controller: 'sql-error', error: (err as Error).message };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete a causal edge between two memory entries (#1784).
 *
 * The bridge stores fallback edges in namespace='causal-edges' with key
 * '{sourceId}→{targetId}'. Those CAN be soft-deleted. The native graph-node
 * backend has no delete API (createNode/createEdge/createHyperedge only),
 * so an edge that landed in graph-node native storage stays there. We
 * surface that explicitly via controller: 'native-unsupported'.
 */
export async function bridgeDeleteCausalEdge(options: {
  sourceId: string;
  targetId: string;
  relation?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  deleted: boolean;
  sourceId: string;
  targetId: string;
  controller: string;
  guarded?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;
  try {
    const { sourceId, targetId, relation } = options;
    const edgeKey = `${sourceId}→${targetId}`;

    const guardResult = await guardValidate(registry, 'delete', { key: edgeKey, namespace: 'causal-edges' });
    if (!guardResult.allowed) {
      return { success: false, deleted: false, sourceId, targetId, controller: 'guard', error: `MutationGuard rejected: ${guardResult.reason}` };
    }

    const causalGraph = registry.get('causalGraph');

    // 1. agentdb@3.0.0-alpha.13+: GraphDatabaseAdapter.deleteEdgesByEndpoints
    //    handles the (sourceId, targetId, relation?) tuple case directly via
    //    Cypher MATCH … DETACH DELETE. Cypher-injection-safe (label validated
    //    against /^[A-Za-z_][A-Za-z0-9_]*$/ upstream).
    if (causalGraph && typeof causalGraph.deleteEdgesByEndpoints === 'function') {
      try {
        const r = await causalGraph.deleteEdgesByEndpoints(sourceId, targetId, relation);
        const deletedCount = typeof r === 'object' && r ? (r.deleted ?? 0) : (r ? 1 : 0);
        if (deletedCount > 0) {
          await logAttestation(registry, 'delete', edgeKey, { namespace: 'causal-edges', relation, count: deletedCount });
          return { success: true, deleted: true, sourceId, targetId, controller: 'causalGraph-cypher', guarded: true };
        }
      } catch { /* fall through */ }
    }

    // 2. Pre-alpha.13 / different controller: try removeEdge() if exposed.
    if (causalGraph && typeof causalGraph.removeEdge === 'function') {
      try {
        await causalGraph.removeEdge(sourceId, targetId, relation);
        await logAttestation(registry, 'delete', edgeKey, { namespace: 'causal-edges', relation });
        return { success: true, deleted: true, sourceId, targetId, controller: 'causalGraph', guarded: true };
      } catch { /* fall through */ }
    }

    // 2. Bridge-fallback: soft-delete the memory_entries row.
    const ctx = getDb(registry);
    if (ctx) {
      try {
        const result = ctx.db.prepare(`
          UPDATE memory_entries
          SET status = 'deleted', updated_at = ?
          WHERE key = ? AND namespace = 'causal-edges' AND status = 'active'
        `).run(Date.now(), edgeKey);
        const changes = result?.changes ?? 0;
        if (changes > 0) {
          await logAttestation(registry, 'delete', edgeKey, { namespace: 'causal-edges', relation });
          return { success: true, deleted: true, sourceId, targetId, controller: 'bridge-fallback', guarded: true };
        }
        return {
          success: false, deleted: false, sourceId, targetId,
          controller: 'native-unsupported',
          error: 'graph-node native backend has no delete API; edge cannot be removed from native storage. SQL fallback found no matching row.',
        };
      } catch (err) {
        return { success: false, deleted: false, sourceId, targetId, controller: 'sql-error', error: (err as Error).message };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cascade-delete a causal node and all its incident edges (#1784).
 *
 * Same constraint as bridgeDeleteCausalEdge — native graph-node lacks a
 * delete API. SQL fallback path soft-deletes the node (if stored as a
 * memory_entries row) and every edge whose key contains the nodeId.
 */
export async function bridgeDeleteCausalNode(options: {
  nodeId: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  deletedNode: boolean;
  deletedEdges: number;
  nodeId: string;
  controller: string;
  guarded?: boolean;
  error?: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;
  try {
    const { nodeId } = options;

    const guardResult = await guardValidate(registry, 'delete', { key: nodeId, namespace: 'causal-nodes' });
    if (!guardResult.allowed) {
      return { success: false, deletedNode: false, deletedEdges: 0, nodeId, controller: 'guard', error: `MutationGuard rejected: ${guardResult.reason}` };
    }

    // 1. agentdb@3.0.0-alpha.13+: GraphDatabaseAdapter.deleteNode(id, {cascade})
    //    counts incident edges before delete so we get accurate audit numbers
    //    regardless of binding stats. Cypher MATCH (n {id}) DETACH DELETE n.
    const causalGraph = registry.get('causalGraph');
    if (causalGraph && typeof causalGraph.deleteNode === 'function') {
      try {
        const r = await causalGraph.deleteNode(nodeId, { cascade: true });
        if (r && typeof r === 'object') {
          const deletedNodeNative = !!r.deletedNode;
          const deletedEdgesNative = typeof r.deletedEdges === 'number' ? r.deletedEdges : 0;
          await logAttestation(registry, 'delete', nodeId, { namespace: 'causal-nodes', deletedEdges: deletedEdgesNative });
          return {
            success: true,
            deletedNode: deletedNodeNative,
            deletedEdges: deletedEdgesNative,
            nodeId,
            controller: 'causalGraph-cypher',
            guarded: true,
          };
        }
      } catch { /* fall through to SQL */ }
    }

    // 2. SQL fallback: soft-delete the node row + every causal-edges row whose
    //    key contains nodeId on either side. Used when agentdb pre-alpha.13 OR
    //    when the entry was stored via the bridge's SQL fallback path.
    const ctx = getDb(registry);
    if (!ctx) return null;

    let deletedEdges = 0;
    let deletedNode = false;
    try {
      const edgeResult = ctx.db.prepare(`
        UPDATE memory_entries
        SET status = 'deleted', updated_at = ?
        WHERE namespace = 'causal-edges'
          AND status = 'active'
          AND (key LIKE ? OR key LIKE ?)
      `).run(Date.now(), `${nodeId}→%`, `%→${nodeId}`);
      deletedEdges = edgeResult?.changes ?? 0;

      const nodeResult = ctx.db.prepare(`
        UPDATE memory_entries
        SET status = 'deleted', updated_at = ?
        WHERE key = ? AND status = 'active'
      `).run(Date.now(), nodeId);
      deletedNode = (nodeResult?.changes ?? 0) > 0;

      await logAttestation(registry, 'delete', nodeId, { namespace: 'causal-nodes', deletedEdges });
    } catch (err) {
      return { success: false, deletedNode: false, deletedEdges: 0, nodeId, controller: 'sql-error', error: (err as Error).message };
    }

    return {
      success: true,
      deletedNode,
      deletedEdges,
      nodeId,
      controller: 'bridge-fallback',
      guarded: true,
    };
  } catch {
    return null;
  }
}

// ===== Phase 5: ReflexionMemory session lifecycle =====

/**
 * Start a session with ReflexionMemory episodic replay.
 * Loads relevant past session patterns for the new session.
 */
export async function bridgeSessionStart(options: {
  sessionId: string;
  context?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  controller: string;
  restoredPatterns: number;
  sessionId: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    let restoredPatterns = 0;
    let controller = 'none';

    // Try ReflexionMemory for episodic session replay
    const reflexion = registry.get('reflexion');
    if (reflexion && typeof reflexion.startEpisode === 'function') {
      await reflexion.startEpisode(options.sessionId, { context: options.context });
      controller = 'reflexion';
    }

    // Load recent patterns from past sessions
    const searchResult = await bridgeSearchEntries({
      query: options.context || 'session patterns',
      namespace: 'session',
      limit: 10,
      threshold: 0.2,
      dbPath: options.dbPath,
    });

    if (searchResult?.results) {
      restoredPatterns = searchResult.results.length;
    }

    return {
      success: true,
      controller: controller === 'none' ? 'bridge-search' : controller,
      restoredPatterns,
      sessionId: options.sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * End a session and persist episodic summary to ReflexionMemory.
 */
export async function bridgeSessionEnd(options: {
  sessionId: string;
  summary?: string;
  tasksCompleted?: number;
  patternsLearned?: number;
  dbPath?: string;
}): Promise<{
  success: boolean;
  controller: string;
  persisted: boolean;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    let controller = 'none';
    let persisted = false;

    // End episode in ReflexionMemory
    const reflexion = registry.get('reflexion');
    if (reflexion && typeof reflexion.endEpisode === 'function') {
      await reflexion.endEpisode(options.sessionId, {
        summary: options.summary,
        tasksCompleted: options.tasksCompleted,
        patternsLearned: options.patternsLearned,
      });
      controller = 'reflexion';
      persisted = true;
    }

    // Persist session summary as memory entry
    await bridgeStoreEntry({
      key: `session-${options.sessionId}`,
      value: JSON.stringify({
        sessionId: options.sessionId,
        summary: options.summary || 'Session ended',
        tasksCompleted: options.tasksCompleted ?? 0,
        patternsLearned: options.patternsLearned ?? 0,
        endedAt: new Date().toISOString(),
      }),
      namespace: 'session',
      tags: ['session-end'],
      upsert: true,
      dbPath: options.dbPath,
    });

    if (controller === 'none') controller = 'bridge-store';
    persisted = true;

    // Phase 3: Trigger NightlyLearner consolidation if available
    const nightlyLearner = registry.get('nightlyLearner');
    if (nightlyLearner && typeof nightlyLearner.consolidate === 'function') {
      try {
        await nightlyLearner.consolidate({ sessionId: options.sessionId });
        controller += '+nightlyLearner';
      } catch { /* non-fatal */ }
    }

    return { success: true, controller, persisted };
  } catch {
    return null;
  }
}

// ===== Phase 5: SemanticRouter bridge =====

/**
 * Route a task via AgentDB's SemanticRouter.
 * Returns null to fall back to local ruvector router.
 */
export async function bridgeRouteTask(options: {
  task: string;
  context?: string;
  dbPath?: string;
}): Promise<{
  route: string;
  confidence: number;
  agents: string[];
  controller: string;
} | null> {
  const registry = await getRegistry(options.dbPath);
  if (!registry) return null;

  try {
    // Try AgentDB's SemanticRouter
    const semanticRouter = registry.get('semanticRouter');
    if (semanticRouter && typeof semanticRouter.route === 'function') {
      const result = await semanticRouter.route(options.task, { context: options.context });
      if (result) {
        return {
          route: result.route || result.category || 'general',
          confidence: result.confidence ?? result.score ?? 0.5,
          agents: result.agents || result.suggestedAgents || [],
          controller: 'semanticRouter',
        };
      }
    }

    // Try LearningSystem recommendAlgorithm (Phase 4)
    const learningSystem = registry.get('learningSystem');
    if (learningSystem && typeof learningSystem.recommendAlgorithm === 'function') {
      const rec = await learningSystem.recommendAlgorithm(options.task);
      if (rec) {
        return {
          route: rec.algorithm || rec.route || 'general',
          confidence: rec.confidence ?? 0.5,
          agents: rec.agents || [],
          controller: 'learningSystem',
        };
      }
    }

    return null; // Fall back to local router
  } catch {
    return null;
  }
}

// ===== Phase 4: Health check with attestation =====

/**
 * Get comprehensive bridge health including all controller statuses.
 */
export async function bridgeHealthCheck(
  dbPath?: string,
): Promise<{
  available: boolean;
  controllers: Array<{ name: string; enabled: boolean; level: number }>;
  attestationCount?: number;
  cacheStats?: { size: number; hits: number; misses: number };
} | null> {
  const registry = await getRegistry(dbPath);
  if (!registry) return null;

  try {
    const controllers = registry.listControllers();

    // Phase 4: AttestationLog stats
    let attestationCount = 0;
    const attestation = registry.get('attestationLog');
    if (attestation && typeof attestation.count === 'function') {
      attestationCount = attestation.count();
    }

    // Phase 2: TieredCache stats
    let cacheStats = { size: 0, hits: 0, misses: 0 };
    const cache = registry.get('tieredCache');
    if (cache && typeof cache.stats === 'function') {
      const s = cache.stats();
      cacheStats = { size: s.size ?? 0, hits: s.hits ?? 0, misses: s.misses ?? 0 };
    }

    return { available: true, controllers, attestationCount, cacheStats };
  } catch {
    return null;
  }
}

// ===== Phase 7: Hierarchical memory, consolidation, batch, context, semantic route =====

/**
 * Store to hierarchical memory with tier.
 * Valid tiers: working, episodic, semantic
 *
 * Real HierarchicalMemory API (agentdb alpha.10+):
 *   store(content, importance?, tier?, options?) → Promise<string>
 * Stub API (fallback):
 *   store(key, value, tier) — synchronous
 */
export async function bridgeHierarchicalStore(params: { key: string; value: string; tier?: string; importance?: number }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const hm = registry.get('hierarchicalMemory');
    if (!hm) return { success: false, error: 'HierarchicalMemory not available' };
    const tier = params.tier || 'working';

    // Detect real HierarchicalMemory (has async store returning id) vs stub
    if (typeof hm.getStats === 'function' && typeof hm.promote === 'function') {
      // Real agentdb HierarchicalMemory
      const id = await hm.store(params.value, params.importance || 0.5, tier, {
        metadata: { key: params.key },
        tags: [params.key],
      });
      return { success: true, id, key: params.key, tier };
    }
    // Stub fallback
    hm.store(params.key, params.value, tier);
    return { success: true, key: params.key, tier };
  } catch (e) { return { success: false, error: errMsg(e) }; }
}

/**
 * Recall from hierarchical memory.
 *
 * Real HierarchicalMemory API (agentdb alpha.10+):
 *   recall(query: MemoryQuery) → Promise<MemoryItem[]>
 *   where MemoryQuery = { query, tier?, k?, threshold?, context?, includeDecayed? }
 * Stub API (fallback):
 *   recall(query: string, topK: number) → synchronous array
 */
export async function bridgeHierarchicalRecall(params: { query: string; tier?: string; topK?: number }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const hm = registry.get('hierarchicalMemory');
    if (!hm) return { results: [], error: 'HierarchicalMemory not available' };

    // Detect real HierarchicalMemory vs stub
    if (typeof hm.getStats === 'function' && typeof hm.promote === 'function') {
      // Real agentdb HierarchicalMemory — recall takes MemoryQuery object
      const memoryQuery: any = {
        query: params.query,
        k: params.topK || 5,
      };
      if (params.tier) {
        memoryQuery.tier = params.tier;
      }
      const results = await hm.recall(memoryQuery);
      return { results: results || [], controller: 'hierarchicalMemory' };
    }

    // Stub fallback — recall(string, number)
    const results = hm.recall(params.query, params.topK || 5);
    const filtered = params.tier
      ? results.filter((r: any) => r.tier === params.tier)
      : results;
    return { results: filtered, controller: 'hierarchicalMemory' };
  } catch (e) { return { results: [], error: errMsg(e) }; }
}

/**
 * Run memory consolidation.
 *
 * Real MemoryConsolidation API (agentdb alpha.10+):
 *   consolidate() → Promise<ConsolidationReport>
 *   ConsolidationReport = { episodicProcessed, semanticCreated, memoriesForgotten, ... }
 * Stub API (fallback):
 *   consolidate() → { promoted, pruned, timestamp }
 */
export async function bridgeConsolidate(params: { minAge?: number; maxEntries?: number }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const mc = registry.get('memoryConsolidation');
    if (!mc) return { success: false, error: 'MemoryConsolidation not available' };
    const result = await mc.consolidate();
    return { success: true, consolidated: result };
  } catch (e) { return { success: false, error: errMsg(e) }; }
}

/**
 * Batch operations (insert, update, delete).
 * - insert: calls insertEpisodes(entries) where entries are {content, metadata?}
 * - delete: calls bulkDelete(table, conditions) on episodes table
 * - update: calls bulkUpdate(table, updates, conditions) on episodes table
 */
export async function bridgeBatchOperation(params: { operation: string; entries: any[] }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const batch = registry.get('batchOperations');
    if (!batch) return { success: false, error: 'BatchOperations not available' };
    let result;
    switch (params.operation) {
      case 'insert': {
        if (typeof batch.insertEpisodes !== 'function') {
          return { success: false, error: 'BatchOperations.insertEpisodes not available — embedder may not be initialized. Use memory_store instead.' };
        }
        const episodes = params.entries.map((e: any) => ({
          content: e.value || e.content || JSON.stringify(e),
          metadata: e.metadata || { key: e.key },
        }));
        try {
          result = await batch.insertEpisodes(episodes);
        } catch (insertErr) {
          const insertMsg = errMsg(insertErr);
          if (insertMsg.includes('null') || insertMsg.includes('embedBatch')) {
            return { success: false, error: 'Embedder not initialized for batch insert. Use memory_store for individual entries or run embeddings_init first.' };
          }
          throw insertErr;
        }
        break;
      }
      case 'delete': {
        // bulkDelete(table, conditions) — conditions is a WHERE clause object
        const keys = params.entries.map((e: any) => e.key).filter(Boolean);
        for (const key of keys) {
          await batch.bulkDelete('episodes', { key });
        }
        result = { deleted: keys.length };
        break;
      }
      case 'update': {
        // bulkUpdate(table, updates, conditions)
        for (const entry of params.entries) {
          await batch.bulkUpdate('episodes', { content: entry.value || entry.content }, { key: entry.key });
        }
        result = { updated: params.entries.length };
        break;
      }
      default: return { success: false, error: `Unknown operation: ${params.operation}` };
    }
    return { success: true, operation: params.operation, count: params.entries.length, result };
  } catch (e) { return { success: false, error: errMsg(e) }; }
}

/**
 * Synthesize context from memories.
 * ContextSynthesizer.synthesize is a static method that takes MemoryPattern[] (not a string).
 */
export async function bridgeContextSynthesize(params: { query: string; maxEntries?: number }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const CS = registry.get('contextSynthesizer');
    if (!CS || typeof CS.synthesize !== 'function') {
      return { success: false, error: 'ContextSynthesizer not available' };
    }
    // Gather memory patterns from hierarchical memory as input
    const hm = registry.get('hierarchicalMemory');
    let memories: any[] = [];
    if (hm && typeof hm.recall === 'function') {
      // Detect real HierarchicalMemory (MemoryQuery object) vs stub (string, number)
      let recalled: any[];
      if (typeof hm.promote === 'function') {
        // Real agentdb HierarchicalMemory
        recalled = await hm.recall({ query: params.query, k: params.maxEntries || 10 });
      } else {
        // Stub
        recalled = hm.recall(params.query, params.maxEntries || 10);
      }
      memories = (recalled || []).map((r: any) => ({
        content: r.value || r.content || '',
        key: r.key || r.id || '',
        reward: 1,
        verdict: 'success',
      }));
    }
    const result = CS.synthesize(memories, { includeRecommendations: true });
    return { success: true, synthesis: result };
  } catch (e) { return { success: false, error: errMsg(e) }; }
}

/**
 * Route via SemanticRouter.
 * Available since agentdb 3.0.0-alpha.10 — uses @ruvector/router for
 * semantic matching with keyword fallback.
 */
export async function bridgeSemanticRoute(params: { input: string }): Promise<any> {
  const registry = await getRegistry();
  if (!registry) return null;
  try {
    const router = registry.get('semanticRouter');
    if (!router) {
      // ADR-093 F9: surface an actionable error pointing callers at the
      // alternative routing surfaces that DO work, instead of just
      // saying "not available".
      return {
        route: null,
        error: 'SemanticRouter not available in current agentdb build',
        recommendation: 'Use bridgeRouteTask (registers as `agentdb_route` MCP tool) for keyword+pattern routing, or hooks_model-route for ADR-026 model selection.',
        controller: 'none',
      };
    }
    const result = await router.route(params.input);
    return { route: result, controller: 'semanticRouter' };
  } catch (e) { return { route: null, error: errMsg(e), controller: 'error' }; }
}

// ===== RaBitQ data export =====

/**
 * Export all embeddings from the bridge's better-sqlite3 connection.
 * Used by RaBitQ to build its index from the same data that memory_store writes.
 * Returns null if bridge is unavailable (caller falls back to sql.js).
 */
export async function bridgeGetAllEmbeddings(options?: {
  dimensions?: number;
  limit?: number;
  dbPath?: string;
}): Promise<Array<{
  id: string;
  key: string;
  namespace: string;
  embedding: number[];
}> | null> {
  const registry = await getRegistry(options?.dbPath);
  if (!registry) return null;

  const ctx = getDb(registry);
  if (!ctx) return null;

  try {
    const dims = options?.dimensions ?? 384;
    const maxRows = options?.limit ?? 50000;

    const rows: any[] = ctx.db.prepare(`
      SELECT id, key, namespace, embedding
      FROM memory_entries
      WHERE status = 'active' AND embedding IS NOT NULL
      LIMIT ?
    `).all(maxRows);

    const results: Array<{ id: string; key: string; namespace: string; embedding: number[] }> = [];

    for (const row of rows) {
      if (!row.embedding) continue;
      try {
        const emb = JSON.parse(row.embedding) as number[];
        if (emb.length !== dims) continue;
        results.push({
          id: String(row.id),
          key: row.key || String(row.id),
          namespace: row.namespace || 'default',
          embedding: emb,
        });
      } catch { /* skip invalid */ }
    }

    return results;
  } catch {
    return null;
  }
}


/**
 * Public helper for the unified learning-stats aggregator: counts of entries
 * per namespace + the top-level total. Best-effort — if the bridge isn't
 * available it returns zeros so the aggregator can still report the other
 * stores honestly. (#2245 follow-up.)
 */
export async function getMemoryBridgeStats(options: {
  namespaces?: string[];
  dbPath?: string;
} = {}): Promise<{
  totalEntries: number;
  perNamespace: Record<string, number>;
  source: string;
  reachable: boolean;
}> {
  const namespaces = options.namespaces ?? [
    'default', 'patterns', 'claude-memories', 'auto-memory',
    'tasks', 'feedback', 'pretrain', 'trajectories',
  ];
  try {
    const all = await bridgeListEntries({ dbPath: options.dbPath, limit: 1 });
    if (!all) {
      return { totalEntries: 0, perNamespace: {}, source: 'memory-bridge (unreachable)', reachable: false };
    }
    const perNamespace: Record<string, number> = {};
    for (const ns of namespaces) {
      try {
        const r = await bridgeListEntries({ namespace: ns, dbPath: options.dbPath, limit: 1 });
        const n = r?.total ?? 0;
        if (n > 0) perNamespace[ns] = n;
      } catch { /* skip per-namespace failure */ }
    }
    return {
      totalEntries: all.total,
      perNamespace,
      source: 'memory-bridge AgentDB (bridgeListEntries)',
      reachable: true,
    };
  } catch {
    return { totalEntries: 0, perNamespace: {}, source: 'memory-bridge (error)', reachable: false };
  }
}

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


// Shared bridge infrastructure — the ControllerRegistry lazy singleton +
// every cross-cutting helper (id/guard/attestation/db-table) — moved to
// ./memory-bridge/bridge-core.ts (W65, P3.4 cut #2). The bridge*
// functions below build on these; the 3 lifecycle helpers
// (isBridgeAvailable / getControllerRegistry / shutdownBridge) are public
// API, re-exported byte-identically.
import {
  errMsg,
  getRegistry,
  getDb,
  isBridgeAvailable,
  getControllerRegistry,
  shutdownBridge,
} from './memory-bridge/bridge-core.js';
export { isBridgeAvailable, getControllerRegistry, shutdownBridge };

// CRUD operations (bridgeStoreEntry / SearchEntries / ListEntries /
// GetEntry / DeleteEntry) moved to ./memory-bridge/bridge-crud.ts
// (W66, P3.4 cut #3). bridgeListEntries is still called inline by
// getMemoryBridgeStats here, so it's imported for a local binding; all
// five are re-exported byte-identically — memory-initializer's
// getBridge() resolves them by name.
import { bridgeListEntries } from './memory-bridge/bridge-crud.js';
export {
  bridgeStoreEntry,
  bridgeSearchEntries,
  bridgeListEntries,
  bridgeGetEntry,
  bridgeDeleteEntry,
} from './memory-bridge/bridge-crud.js';

// Embedding + HNSW operations (bridgeGenerateEmbedding,
// LoadEmbeddingModel, GetHNSWStatus, SearchHNSW, AddToHNSW) moved to
// ./memory-bridge/bridge-embedding-hnsw.ts (W67, P3.4 cut #4).
// Re-exported byte-identically.
export {
  bridgeGenerateEmbedding,
  bridgeLoadEmbeddingModel,
  bridgeGetHNSWStatus,
  bridgeSearchHNSW,
  bridgeAddToHNSW,
} from './memory-bridge/bridge-embedding-hnsw.js';

// Pattern + learning operations (bridgeStorePattern, SearchPatterns,
// RecordFeedback, RecordCausalEdge) moved to ./memory-bridge/
// bridge-patterns.ts (W68, P3.4 cut #5). Re-exported byte-identically.
export {
  bridgeStorePattern,
  bridgeSearchPatterns,
  bridgeRecordFeedback,
  bridgeRecordCausalEdge,
} from './memory-bridge/bridge-patterns.js';

// Delete tools for hierarchical + causal-graph memory (#1784:
// bridgeDeleteHierarchical, DeleteCausalEdge, DeleteCausalNode) moved to
// ./memory-bridge/bridge-delete.ts (W69, P3.4 cut #6). Re-exported
// byte-identically.
export {
  bridgeDeleteHierarchical,
  bridgeDeleteCausalEdge,
  bridgeDeleteCausalNode,
} from './memory-bridge/bridge-delete.js';

// Session lifecycle + task routing (bridgeSessionStart, SessionEnd,
// RouteTask) moved to ./memory-bridge/bridge-session.ts (W70, P3.4 cut
// #7). Re-exported byte-identically.
export {
  bridgeSessionStart,
  bridgeSessionEnd,
  bridgeRouteTask,
} from './memory-bridge/bridge-session.js';

// ===== Bridge functions — match memory-initializer.ts signatures =====

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

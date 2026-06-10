/**
 * Memory-bridge pattern + learning operations — ReasoningBank pattern
 * store/search plus the feedback + causal-edge learning signals.
 *
 *   - bridgeStorePattern    (ReasoningBank store, raw-SQL fallback)
 *   - bridgeSearchPatterns  (ReasoningBank semantic search)
 *   - bridgeRecordFeedback  (success/failure outcome → learning loop)
 *   - bridgeRecordCausalEdge (CausalMemoryGraph edge write)
 *
 * Extracted from memory-bridge.ts (W68, P3.4 cut #5). Builds on the
 * bridge-core infrastructure + the bridge-crud store/search primitives.
 */
import { generateId, getRegistry, getDb } from './bridge-core.js';
import { bridgeStoreEntry, bridgeSearchEntries } from './bridge-crud.js';

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
        const { addToHNSWIndex } = await import('../memory-initializer.js');
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
        const { generateEmbedding } = await import('../memory-initializer.js');
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


/**
 * Memory-bridge delete tools for hierarchical + causal-graph memory
 * (#1784). agentdb doesn't expose public delete APIs for these
 * controllers, so each tries the real controller path first and falls
 * back to soft-delete via direct SQL, surfacing native-unsupported
 * honestly rather than faking success.
 *
 *   - bridgeDeleteHierarchical (hierarchical-memory entry by key)
 *   - bridgeDeleteCausalEdge   (CausalMemoryGraph edge)
 *   - bridgeDeleteCausalNode   (CausalMemoryGraph node + incident edges)
 *
 * Extracted from memory-bridge.ts (W69, P3.4 cut #6).
 */
import { getRegistry, guardValidate, logAttestation, getDb } from './bridge-core.js';

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


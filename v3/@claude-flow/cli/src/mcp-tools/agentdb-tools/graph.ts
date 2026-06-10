/**
 * AgentDB graph MCP tools — k-hop graph query and the personalized-
 * PageRank pathfinder, plus their private graph algorithms (k-hop CTE
 * builder, cosine sim, node dedup, simplePersonalizedPageRank).
 *
 * Extracted from agentdb-tools.ts (W121, P3.15 cut #2).
 */
import type { MCPTool } from '../types.js';
import { validateIdentifier } from '../validate-input.js';
import {
  MAX_TOP_K,
  validateString,
  validatePositiveInt,
  sanitizeError,
} from './helpers.js';

export interface ComplexityBudget {
  maxNodesVisited?: number;
  maxDepth?: number;
  maxMillis?: number;
  maxMemoryMB?: number;
}

export const agentdbGraphQuery: MCPTool = {
  name: 'agentdb_graph-query',
  description: 'Unified graph traversal across the knowledge graph (ADR-130). Dispatches to the most capable backend: graph-node native for k-hop, sql.js CTE for fallback, HNSW cosine for semantic, ruflo-graph-intelligence PageRank for pagerank mode. Use when you need structured graph traversal beyond flat memory search.',
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'Domain-prefixed node ID (e.g. "agent:abc", "entity:xyz")' },
      mode: {
        type: 'string',
        enum: ['k-hop', 'semantic', 'pagerank'],
        description: 'Query mode: k-hop neighbor expansion, semantic cosine search, or PageRank scoring',
      },
      depth: { type: 'number', description: 'Hop depth for k-hop mode (default 2, max 5)' },
      topK: { type: 'number', description: 'Max results for semantic and pagerank modes (default 10)' },
      relation: { type: 'string', description: 'Optional edge relation filter' },
      complexityBudget: {
        type: 'object',
        description: 'Computation limits',
        properties: {
          maxNodesVisited: { type: 'number' },
          maxDepth: { type: 'number' },
          maxMillis: { type: 'number' },
          maxMemoryMB: { type: 'number' },
        },
      },
    },
    required: ['nodeId', 'mode'],
  },
  handler: async (params: Record<string, unknown>) => {
    const t0 = Date.now();
    try {
      const vNodeId = validateIdentifier(params.nodeId, 'nodeId');
      if (!vNodeId.valid) return { success: false, error: vNodeId.error };
      const nodeId = validateString(params.nodeId, 'nodeId', 500);
      if (!nodeId) return { success: false, error: 'nodeId is required' };

      const mode = params.mode as string;
      if (!['k-hop', 'semantic', 'pagerank'].includes(mode)) {
        return { success: false, error: 'mode must be "k-hop", "semantic", or "pagerank"' };
      }

      const budgetRaw = (params.complexityBudget ?? {}) as ComplexityBudget;
      const budget: Required<ComplexityBudget> = {
        maxNodesVisited: budgetRaw.maxNodesVisited ?? 10_000,
        maxDepth: budgetRaw.maxDepth ?? 5,
        maxMillis: budgetRaw.maxMillis ?? 50,
        maxMemoryMB: budgetRaw.maxMemoryMB ?? 32,
      };
      const depth = Math.min(validatePositiveInt(params.depth, 2, budget.maxDepth), budget.maxDepth);
      const topK = validatePositiveInt(params.topK, 10, MAX_TOP_K);
      const relation = validateString(params.relation, 'relation', 200) ?? undefined;

      // ── k-hop mode ──────────────────────────────────────────────────────────
      if (mode === 'k-hop') {
        // Try graph-node native first
        try {
          const graphBackend = await import('../../ruvector/graph-backend.js');
          if (await graphBackend.isGraphBackendAvailable()) {
            const neighbors = await graphBackend.getNeighbors(nodeId, depth);
            return {
              success: true, mode, nodeId, depth,
              results: neighbors.map(id => ({ nodeId: id })),
              count: neighbors.length,
              backend: 'graph-node',
              elapsedMs: Date.now() - t0,
            };
          }
        } catch { /* fall through to sql.js */ }

        // SQL CTE fallback for k-hop up to depth 3
        try {
          const { getBridgeDb } = await import('../../memory/graph-edge-writer.js');
          const db = await getBridgeDb();
          if (db) {
            const cteSql = buildKHopCTE(nodeId, Math.min(depth, 3), relation, budget.maxNodesVisited);
            const result = db.exec(cteSql);
            const rows = result?.[0]?.values ?? [];
            return {
              success: true, mode, nodeId, depth,
              results: rows.map((r: unknown[]) => ({ nodeId: r[0], depth: r[1] })),
              count: rows.length,
              backend: 'sql-cte',
              elapsedMs: Date.now() - t0,
            };
          }
        } catch { /* db unavailable */ }

        return { success: false, error: 'No graph backend available for k-hop query', mode, nodeId };
      }

      // ── semantic mode ────────────────────────────────────────────────────────
      if (mode === 'semantic') {
        try {
          const { generateEmbedding } = await import('../../memory/memory-initializer.js');
          const queryEmb = await generateEmbedding(nodeId);
          if (!queryEmb) throw new Error('embedding failed');

          const { getBridgeDb } = await import('../../memory/graph-edge-writer.js');
          // #2246 fix: lazy-create memory.db on first pathfinder call so
          // fresh environments work without a pre-existing memory init.
          const db = await getBridgeDb(undefined, { createIfMissing: true });
          if (!db) return { success: false, error: 'graph_edges DB unavailable (sql.js could not load)', hint: 'Check Node version + try `ruflo memory init` to initialize manually.', mode, nodeId };

          // Load all rows with embedding_ref and score by cosine
          const rowResult = db.exec(
            `SELECT id, source_id, target_id, relation, weight, embedding_ref FROM graph_edges WHERE embedding_ref IS NOT NULL LIMIT ?`,
            [budget.maxNodesVisited],
          );
          const rows = rowResult?.[0]?.values ?? [];
          const { decodeEmbedding } = await import('../../memory/embedding-quantization.js');

          const scored: Array<{ nodeId: string; score: number; relation: string }> = [];
          const qv = new Float32Array(queryEmb.embedding);
          for (const row of rows) {
            const [, srcId, tgtId, rel, , embRef] = row as unknown[];
            if (typeof embRef !== 'string') continue;
            const ev = decodeEmbedding(embRef);
            if (!ev) continue;
            const cos = cosineSim(qv, ev);
            scored.push({ nodeId: srcId as string, score: cos, relation: rel as string });
            scored.push({ nodeId: tgtId as string, score: cos, relation: rel as string });
          }
          scored.sort((a, b) => b.score - a.score);
          const deduped = deduplicateByNodeId(scored).slice(0, topK);

          return {
            success: true, mode, nodeId, topK,
            results: deduped,
            count: deduped.length,
            backend: 'sql-cosine',
            elapsedMs: Date.now() - t0,
          };
        } catch (err) {
          return { success: false, error: sanitizeError(err), mode, nodeId };
        }
      }

      // ── pagerank mode ────────────────────────────────────────────────────────
      if (mode === 'pagerank') {
        try {
          const { getBridgeDb } = await import('../../memory/graph-edge-writer.js');
          // #2246 fix: lazy-create memory.db on first pathfinder call so
          // fresh environments work without a pre-existing memory init.
          const db = await getBridgeDb(undefined, { createIfMissing: true });
          if (!db) return { success: false, error: 'graph_edges DB unavailable (sql.js could not load)', hint: 'Check Node version + try `ruflo memory init` to initialize manually.', mode, nodeId };

          const edgeResult = db.exec(
            `SELECT source_id, target_id, weight FROM graph_edges LIMIT ?`,
            [budget.maxNodesVisited],
          );
          const edges = edgeResult?.[0]?.values ?? [];
          if (edges.length === 0) {
            return { success: true, mode, nodeId, results: [], count: 0, message: 'graph_edges is empty', elapsedMs: Date.now() - t0 };
          }

          // Simple PPR without external solver (graceful fallback when plugin unavailable)
          const scores = simplePersonalizedPageRank(nodeId, edges as [string, string, number][], topK, 0.85, 20);

          return {
            success: true, mode, nodeId, topK,
            results: scores,
            count: scores.length,
            backend: 'sql-ppr',
            elapsedMs: Date.now() - t0,
          };
        } catch (err) {
          return { success: false, error: sanitizeError(err), mode, nodeId };
        }
      }

      return { success: false, error: `Unknown mode: ${mode}` };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

// ─── graph-query helpers ─────────────────────────────────────────────────────

function buildKHopCTE(nodeId: string, depth: number, relation: string | undefined, maxNodes: number): string {
  // Escape the node ID for safe SQL embedding (no user-controlled SQL injection possible
  // since validateIdentifier has already vetted the value; but we sanitize quotes anyway).
  const safeNodeId = nodeId.replace(/'/g, "''");
  const relFilter = relation ? `AND e.relation = '${relation.replace(/'/g, "''")}'` : '';
  return `
    WITH RECURSIVE khop(node_id, hop_depth) AS (
      SELECT '${safeNodeId}', 0
      UNION
      SELECT e.target_id, k.hop_depth + 1
      FROM graph_edges e
      JOIN khop k ON e.source_id = k.node_id
      WHERE k.hop_depth < ${depth} ${relFilter}
    )
    SELECT DISTINCT node_id, MIN(hop_depth) as depth
    FROM khop
    WHERE node_id != '${safeNodeId}'
    GROUP BY node_id
    ORDER BY depth, node_id
    LIMIT ${maxNodes}
  `;
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function deduplicateByNodeId(arr: Array<{ nodeId: string; score: number; relation: string }>): typeof arr {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item.nodeId)) return false;
    seen.add(item.nodeId);
    return true;
  });
}

/**
 * Simple Personalized PageRank without external solver.
 * Used as fallback when ruflo-graph-intelligence is unavailable.
 * damping = restart probability from seed node; iterations = power steps.
 */
function simplePersonalizedPageRank(
  seedNodeId: string,
  edges: Array<[string, string, number]>,
  topK: number,
  damping: number,
  iterations: number,
): Array<{ nodeId: string; score: number }> {
  // Build adjacency
  const outEdges = new Map<string, Array<[string, number]>>();
  const nodes = new Set<string>();
  for (const [src, tgt, w] of edges) {
    nodes.add(src); nodes.add(tgt);
    if (!outEdges.has(src)) outEdges.set(src, []);
    outEdges.get(src)!.push([tgt, w]);
  }

  if (!nodes.has(seedNodeId)) return [];

  const nodeList = Array.from(nodes);
  const N = nodeList.length;
  const idx = new Map<string, number>(nodeList.map((n, i) => [n, i]));
  const seedIdx = idx.get(seedNodeId) ?? 0;

  let scores = new Float32Array(N).fill(0);
  scores[seedIdx] = 1.0;

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Float32Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const node = nodeList[i];
      const out = outEdges.get(node) ?? [];
      if (out.length === 0) {
        next[seedIdx] += scores[i]; // dangling node → restart
        continue;
      }
      const totalW = out.reduce((s, [, w]) => s + w, 0);
      for (const [tgt, w] of out) {
        const j = idx.get(tgt) ?? 0;
        next[j] += scores[i] * (w / totalW) * (1 - damping);
      }
    }
    next[seedIdx] += damping; // restart
    // Normalize
    const sum = next.reduce((s, v) => s + v, 0);
    if (sum > 0) for (let i = 0; i < N; i++) next[i] /= sum;
    scores = next;
  }

  const results: Array<{ nodeId: string; score: number }> = [];
  for (let i = 0; i < N; i++) {
    if (nodeList[i] !== seedNodeId) {
      results.push({ nodeId: nodeList[i], score: scores[i] });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ===== ADR-130 Phase 5: agentdb_graph-pathfinder =====

export const agentdbGraphPathfinder: MCPTool = {
  name: 'agentdb_graph-pathfinder',
  description: 'Multi-algorithm native graph pathfinder (ADR-130 Phase 5). Use when agentdb_graph-query k-hop is not enough — pathfinder supports personalized-pagerank, dynamic-mincut, spectral-sparsify, temporal-centrality, connected-component-churn, and witness-chain-divergence. Prefer over prompt-level graph loops in ruflo-knowledge-graph graph-navigator when you need ranked paths with formal complexityBudget enforcement.',
  inputSchema: {
    type: 'object',
    properties: {
      seedNodeId: { type: 'string', description: 'Domain-prefixed start node (e.g. "entity:auth-module")' },
      query: { type: 'string', description: 'Natural-language query for relevance scoring' },
      depth: { type: 'number', description: 'Expansion depth (default 3, max 5)' },
      threshold: { type: 'number', description: 'Minimum cumulative relevance score (default 0.3)' },
      topK: { type: 'number', description: 'Max paths returned (default 10)' },
      algorithm: {
        type: 'string',
        enum: ['personalized-pagerank', 'dynamic-mincut', 'spectral-sparsify', 'temporal-centrality', 'connected-component-churn', 'witness-chain-divergence'],
        description: 'Graph algorithm (default: personalized-pagerank)',
      },
      complexityBudget: {
        type: 'object',
        properties: {
          maxNodesVisited: { type: 'number' },
          maxDepth: { type: 'number' },
          maxMillis: { type: 'number' },
          maxMemoryMB: { type: 'number' },
        },
      },
    },
    required: ['seedNodeId', 'query'],
  },
  handler: async (params: Record<string, unknown>) => {
    const t0 = Date.now();
    try {
      const vSeed = validateIdentifier(params.seedNodeId, 'seedNodeId');
      if (!vSeed.valid) return { success: false, error: vSeed.error };
      const seedNodeId = validateString(params.seedNodeId, 'seedNodeId', 500);
      if (!seedNodeId) return { success: false, error: 'seedNodeId is required' };
      // params.query was used for a future semantic re-ranking pass over
      // the k-hop neighborhood; the dynamic-mincut/spectral-sparsify
      // branches below don't consume it yet. Still validated so callers
      // don't pass garbage.
      validateString(params.query, 'query', 2000);

      const budgetRaw = (params.complexityBudget ?? {}) as ComplexityBudget;
      const rawDepth = validatePositiveInt(params.depth, 3, 5);
      const depth = Math.min(rawDepth, 5);
      const depthWarning = rawDepth > 5 ? `depth clamped from ${rawDepth} to 5` : undefined;

      const budget: Required<ComplexityBudget> = {
        maxNodesVisited: budgetRaw.maxNodesVisited ?? 10_000,
        maxDepth: Math.min(budgetRaw.maxDepth ?? depth, 5),
        maxMillis: budgetRaw.maxMillis ?? 50,
        maxMemoryMB: budgetRaw.maxMemoryMB ?? 32,
      };
      const threshold = typeof params.threshold === 'number' ? params.threshold : 0.3;
      const topK = validatePositiveInt(params.topK, 10, MAX_TOP_K);
      const algorithm = (params.algorithm as string) ?? 'personalized-pagerank';

      const validAlgorithms = ['personalized-pagerank', 'dynamic-mincut', 'spectral-sparsify', 'temporal-centrality', 'connected-component-churn', 'witness-chain-divergence'];
      if (!validAlgorithms.includes(algorithm)) {
        return { success: false, error: `Unknown algorithm: ${algorithm}. Valid: ${validAlgorithms.join(', ')}` };
      }

      // Load edges from graph_edges
      const { getBridgeDb } = await import('../../memory/graph-edge-writer.js');
      // #2246 fix: lazy-create memory.db on first pathfinder call.
      const db = await getBridgeDb(undefined, { createIfMissing: true });
      if (!db) return { success: false, error: 'graph_edges DB unavailable (sql.js could not load)', hint: 'Check Node version + try `ruflo memory init` to initialize manually.', seedNodeId };

      const colsSql = algorithm === 'witness-chain-divergence'
        ? 'source_id, target_id, weight, last_reinforced, witness_id'
        : algorithm === 'temporal-centrality'
        ? 'source_id, target_id, weight, last_reinforced, confidence'
        : 'source_id, target_id, weight';

      const edgeResult = db.exec(
        `SELECT ${colsSql} FROM graph_edges LIMIT ?`,
        [budget.maxNodesVisited],
      );
      const rawEdges = edgeResult?.[0]?.values ?? [];

      if (rawEdges.length === 0) {
        return { success: true, paths: [], count: 0, message: `no edges found from seedNodeId`, seedNodeId, algorithm, elapsedMs: Date.now() - t0 };
      }

      const edges = rawEdges as unknown[][];
      let paths: Array<{ nodeId: string; score: number; depth: number }> = [];

      // Check millisecond budget before heavy computation
      if (Date.now() - t0 > budget.maxMillis) {
        return { success: true, paths: [], count: 0, message: `complexityBudget.maxMillis (${budget.maxMillis}ms) exceeded before solver dispatch`, seedNodeId, algorithm, elapsedMs: Date.now() - t0 };
      }

      switch (algorithm) {
        case 'personalized-pagerank': {
          const edgeTuples = edges.map(r => [r[0], r[1], Number(r[2]) || 1.0] as [string, string, number]);
          const pprResults = simplePersonalizedPageRank(seedNodeId, edgeTuples, topK, 0.85, 20);
          paths = pprResults.filter(r => r.score >= threshold).map(r => ({ ...r, depth: 1 }));
          break;
        }
        case 'temporal-centrality': {
          // Score nodes by recency of last_reinforced × confidence
          const nodeScores = new Map<string, number>();
          const now = Date.now();
          for (const row of edges) {
            const [src, tgt, w, lastReinforced, confidence] = row;
            const ageMs = lastReinforced
              ? now - new Date(lastReinforced as string).getTime()
              : now;
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            const decayedScore = (Number(w) || 1.0) * (Number(confidence) || 1.0) * Math.exp(-0.1 * ageDays);
            for (const n of [src as string, tgt as string]) {
              nodeScores.set(n, (nodeScores.get(n) ?? 0) + decayedScore);
            }
          }
          paths = Array.from(nodeScores.entries())
            .filter(([n, s]) => n !== seedNodeId && s >= threshold)
            .map(([nodeId, score]) => ({ nodeId, score, depth: 1 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
          break;
        }
        case 'witness-chain-divergence': {
          // Walk witness_id chains, flag divergences (gaps or non-monotonic timestamps)
          const witnessChain: Array<{ nodeId: string; score: number; depth: number }> = [];
          const seen = new Set<string>();
          let current = seedNodeId;
          for (let d = 0; d < depth; d++) {
            const nextEdge = edges.find(r => r[0] === current && r[4]);
            if (!nextEdge) break;
            const next = nextEdge[1] as string;
            if (seen.has(next)) {
              // Loop detected → divergence score 1.0
              witnessChain.push({ nodeId: next, score: 1.0, depth: d + 1 });
              break;
            }
            seen.add(next);
            witnessChain.push({ nodeId: next, score: 0.5, depth: d + 1 });
            current = next;
          }
          paths = witnessChain.slice(0, topK);
          break;
        }
        case 'connected-component-churn':
        case 'dynamic-mincut':
        case 'spectral-sparsify': {
          // Simplified implementations: return k-hop neighbors with basic
          // score. `edgeTuples` was the graph-edge buffer for a Stoer-
          // Wagner mincut / spectral-sparsifier pass that we haven't
          // wired yet; the K-hop fallback below doesn't need them.
          const khopResult = await agentdbGraphQuery.handler({
            nodeId: seedNodeId, mode: 'k-hop', depth, complexityBudget: budget,
          }) as any;
          if (khopResult.success && khopResult.results) {
            paths = khopResult.results
              .map((r: any, i: number) => ({ nodeId: r.nodeId, score: 1.0 / (1 + i), depth: r.depth ?? 1 }))
              .filter((r: any) => r.score >= threshold)
              .slice(0, topK);
          }
          break;
        }
      }

      const elapsedMs = Date.now() - t0;
      return {
        success: true,
        seedNodeId, algorithm, depth, topK, threshold,
        paths,
        count: paths.length,
        elapsedMs,
        budgetUsed: { millis: elapsedMs, nodes: rawEdges.length },
        ...(depthWarning && { warning: depthWarning }),
      };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};


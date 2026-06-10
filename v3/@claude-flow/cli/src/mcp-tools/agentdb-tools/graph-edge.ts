/**
 * Shared graph-edge helpers for the AgentDB MCP tools — domain-prefix
 * normalization (ADR-130 §Phase 1) + the fire-and-forget graph_edges
 * writer (embeds the edge text, best-effort). Used by the causal +
 * delete tool clusters.
 *
 * Extracted from agentdb-tools.ts (W123, P3.15 cut #4).
 */

/** Valid domain prefixes for unified node namespace */
export const VALID_DOMAINS = new Set(['mem', 'agent', 'task', 'entity', 'span', 'pattern']);

/**
 * Ensure a node ID uses the domain:uuid prefix format (ADR-130 §Phase 1).
 * IDs without a ':' separator are legacy unprefixed IDs — auto-prefixed as
 * "mem:" and a deprecation warning is logged.
 */
export function ensureDomainPrefix(id: string): { id: string; wasLegacy: boolean } {
  const colonIdx = id.indexOf(':');
  if (colonIdx > 0) {
    const domain = id.slice(0, colonIdx);
    if (VALID_DOMAINS.has(domain)) {
      return { id, wasLegacy: false };
    }
  }
  // Legacy ID or unknown prefix — treat as "mem:" namespace
  return { id: `mem:${id}`, wasLegacy: true };
}

/**
 * Fire-and-forget write of a graph edge to the sql.js graph_edges table.
 * Non-blocking: errors are silently discarded (ADR-130 §Phase 1 semantics).
 */
export async function writeGraphEdge(opts: {
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
  confidence?: number;
  decayRate?: number;
  witnessId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { insertGraphEdge } = await import('../../memory/graph-edge-writer.js');
    // Generate 384-dim embedding for the edge text (async, ~50ms with ONNX)
    let embedding: number[] | undefined;
    try {
      const { generateEmbedding } = await import('../../memory/memory-initializer.js');
      const edgeText = `${opts.relation}: ${opts.sourceId} -> ${opts.targetId}`;
      const embResult = await generateEmbedding(edgeText);
      if (embResult && embResult.embedding.length > 0) {
        embedding = embResult.embedding;
      }
    } catch { /* embedding not available — store without embedding_ref */ }

    await insertGraphEdge({
      sourceId: opts.sourceId,
      targetId: opts.targetId,
      relation: opts.relation,
      weight: opts.weight,
      confidence: opts.confidence,
      decayRate: opts.decayRate,
      witnessId: opts.witnessId,
      embedding,
      metadata: opts.metadata,
    });
  } catch { /* non-fatal: graph_edges write failure must never break callers */ }
}

/**
 * AgentDB pattern MCP tools — store a pattern via ReasoningBank, semantic
 * pattern search, and feedback (success/failure verdict) recording.
 *
 *   - agentdbPatternStore · agentdbPatternSearch · agentdbFeedback
 *
 * Extracted from agentdb-tools.ts (W122, P3.15 cut #3).
 */
import type { MCPTool } from '../types.js';
import { validateIdentifier, validateText } from '../validate-input.js';
import {
  MAX_TOP_K,
  validateString,
  validatePositiveInt,
  validateScore,
  sanitizeError,
  getBridge,
} from './helpers.js';

// ===== agentdb_pattern_store — Store via ReasoningBank =====

export const agentdbPatternStore: MCPTool = {
  name: 'agentdb_pattern-store',
  description: 'Store a pattern directly via ReasoningBank controller Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Pattern description' },
      type: { type: 'string', description: 'Pattern type (e.g., task-routing, error-recovery)' },
      confidence: { type: 'number', description: 'Confidence score (0-1)' },
    },
    required: ['pattern'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vPattern = validateText(params.pattern, 'pattern', 100_000);
      if (!vPattern.valid) return { success: false, error: vPattern.error };
      if (params.type) { const vType = validateIdentifier(params.type, 'type'); if (!vType.valid) return { success: false, error: vType.error }; }
      const pattern = validateString(params.pattern, 'pattern');
      if (!pattern) return { success: false, error: 'pattern is required (non-empty string, max 100KB)' };
      const type = validateString(params.type, 'type', 200) ?? 'general';
      const confidence = validateScore(params.confidence, 0.8);

      const bridge = await getBridge();
      const result = await bridge.bridgeStorePattern({ pattern, type, confidence });
      if (result) return result;

      // ADR-093 F4: when the ReasoningBank controller registry returns
      // null (the cause of audit-reported "AgentDB bridge not available"
      // even though `agentdb_health.reasoningBank.enabled === true`), fall
      // back to a direct memory_store write so the caller's pattern still
      // persists. Surface the controller as `memory-store-fallback` so the
      // path is observable instead of silently lost.
      try {
        const { storeEntry } = await import('../../memory/memory-initializer.js');
        const patternId = `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const value = JSON.stringify({ pattern, type, confidence, _fallback: 'reasoningBank-unavailable' });
        await storeEntry({
          key: patternId,
          value,
          namespace: 'pattern',
          tags: [type, 'reasoning-pattern', 'fallback'],
        });
        return {
          success: true,
          patternId,
          controller: 'memory-store-fallback',
          note: 'ReasoningBank controller registry unavailable. Pattern persisted via memory_store. Run `agentdb_health` to inspect controller registration.',
        };
      } catch (fallbackErr) {
        return {
          success: false,
          error: 'Pattern store failed: both ReasoningBank bridge and memory_store fallback unavailable',
          fallbackError: sanitizeError(fallbackErr),
          recommendation: 'Run agentdb_health to inspect controller registration and check that .swarm/memory.db is writable.',
        };
      }
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

// ===== agentdb_pattern_search — Search via ReasoningBank =====

export const agentdbPatternSearch: MCPTool = {
  name: 'agentdb_pattern-search',
  description: 'Search patterns via ReasoningBank controller with BM25+semantic hybrid Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      topK: { type: 'number', description: 'Number of results (default: 5)' },
      minConfidence: { type: 'number', description: 'Minimum score threshold (0-1)' },
    },
    required: ['query'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vQuery = validateText(params.query, 'query', 10_000);
      if (!vQuery.valid) return { results: [], error: vQuery.error };
      const query = validateString(params.query, 'query', 10_000);
      if (!query) return { results: [], error: 'query is required (non-empty string, max 10KB)' };
      const topK = validatePositiveInt(params.topK, 5, MAX_TOP_K);
      const minConfidence = validateScore(params.minConfidence, 0.3);

      const bridge = await getBridge();
      const result = await bridge.bridgeSearchPatterns({ query, topK, minConfidence });
      if (result && Array.isArray(result.results) && result.results.length > 0) {
        return result;
      }

      // #1889 — symmetric fallback. pattern-store writes to the `pattern`
      // namespace via memory_store when ReasoningBank is unavailable; the
      // search path used to return an empty list with `controller: 'unavailable'`
      // even though the user's pattern was sitting in that namespace. We now
      // tier the fallback so freshly-written entries are findable before HNSW
      // catches up:
      //   1. Try semantic search via searchEntries (HNSW-backed)
      //   2. If that returns 0, list the namespace and substring-match the query
      //      against each entry's pattern text. Deterministic; survives
      //      embedding-index latency and threshold tuning.
      try {
        const { searchEntries, listEntries, getEntry } = await import('../../memory/memory-initializer.js');

        const parseEntry = (e: Record<string, unknown>): Record<string, unknown> | null => {
          const raw = typeof e.content === 'string' ? e.content : (e as { value?: unknown }).value;
          if (typeof raw !== 'string') return null;
          try {
            const parsed = JSON.parse(raw);
            const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
            if (confidence < minConfidence) return null;
            return {
              patternId: e.key ?? e.id,
              pattern: parsed.pattern,
              type: parsed.type ?? 'general',
              confidence,
              score: typeof e.score === 'number' ? e.score : undefined,
            };
          } catch {
            return null;
          }
        };

        // Tier 1 — semantic
        let results: Array<Record<string, unknown>> = [];
        let tier: 'semantic' | 'substring' = 'semantic';
        try {
          const semantic = await searchEntries({ query, namespace: 'pattern', limit: topK });
          results = (semantic?.results ?? [])
            .map(parseEntry)
            .filter((r): r is Record<string, unknown> => r !== null);
        } catch { /* fall through to tier 2 */ }

        // Tier 2 — substring scan (catches just-written entries before HNSW indexes them).
        // #2226: listEntries returns metadata only (no content/value — see open #2014),
        // so parseEntry would always null out here. Fetch each entry's content by key via
        // getEntry (which DOES return content) before parsing/matching. This is the path
        // that actually runs when the ReasoningBank controller is unavailable (the common
        // real-world state), so a stored pattern is now findable by search.
        if (results.length === 0) {
          tier = 'substring';
          const all = await listEntries({ namespace: 'pattern', limit: 200 });
          const qLower = query.toLowerCase();
          const matched: Array<Record<string, unknown>> = [];
          for (const e of (all?.entries ?? [])) {
            const meta = e as Record<string, unknown>;
            let entry: Record<string, unknown> = meta;
            // If the listing lacks content, hydrate it from the keyed store.
            if (typeof meta.content !== 'string' && typeof (meta as { value?: unknown }).value !== 'string') {
              const key = typeof meta.key === 'string' ? meta.key : (typeof meta.id === 'string' ? meta.id : null);
              if (!key) continue;
              const got = await getEntry({ key, namespace: 'pattern' });
              if (!got?.found || !got.entry) continue;
              entry = got.entry as unknown as Record<string, unknown>;
            }
            const parsed = parseEntry(entry);
            if (!parsed) continue;
            const text = typeof parsed.pattern === 'string' ? parsed.pattern.toLowerCase() : '';
            if (text.includes(qLower)) matched.push(parsed);
            if (matched.length >= topK) break;
          }
          results = matched;
        }

        // #1889 — controller label must match pattern-store's so the smoke
        // round-trip sees both ends agree. The store reports
        // `memory-store-fallback`; we use the same name + a `tier` field
        // to expose which sub-strategy fired.
        return {
          results,
          controller: 'memory-store-fallback',
          tier,
          note: result
            ? `ReasoningBank returned 0 results; tier=${tier} from pattern namespace.`
            : `ReasoningBank controller unavailable; tier=${tier} from pattern namespace.`,
        };
      } catch (fallbackErr) {
        return { results: [], controller: 'unavailable', fallbackError: sanitizeError(fallbackErr) };
      }
    } catch (error) {
      return { results: [], error: sanitizeError(error) };
    }
  },
};

// ===== agentdb_feedback — Record task feedback =====

export const agentdbFeedback: MCPTool = {
  name: 'agentdb_feedback',
  description: 'Record task feedback for learning via LearningSystem + ReasoningBank controllers Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier' },
      success: { type: 'boolean', description: 'Whether task succeeded' },
      quality: { type: 'number', description: 'Quality score (0-1)' },
      agent: { type: 'string', description: 'Agent that performed the task' },
    },
    required: ['taskId'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vTaskId = validateIdentifier(params.taskId, 'taskId');
      if (!vTaskId.valid) return { success: false, error: vTaskId.error };
      if (params.agent) { const vAgent = validateIdentifier(params.agent, 'agent'); if (!vAgent.valid) return { success: false, error: vAgent.error }; }
      const taskId = validateString(params.taskId, 'taskId', 500);
      if (!taskId) return { success: false, error: 'taskId is required (non-empty string, max 500 chars)' };
      const bridge = await getBridge();
      const result = await bridge.bridgeRecordFeedback({
        taskId,
        success: params.success === true,
        quality: validateScore(params.quality, 0.85),
        agent: validateString(params.agent, 'agent', 200) ?? undefined,
      });
      return result ?? { success: false, error: 'AgentDB bridge not available. Use memory_store/memory_search instead.' };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

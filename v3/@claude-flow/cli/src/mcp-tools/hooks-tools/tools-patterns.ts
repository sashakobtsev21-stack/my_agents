/**
 * MCP tool definitions for the ReasoningBank pattern store + search:
 *   - hooks_intelligence_pattern-store  (HNSW-indexed, ReasoningBank
 *                                        via bridge → memory-initializer
 *                                        store fallback)
 *   - hooks_intelligence_pattern-search (HNSW + brute-force vector
 *                                        search via bridge or via
 *                                        real-search function)
 *
 * Extracted from hooks-tools.ts (W44, P3.2 cut #14).
 */
import { type MCPTool } from '../types.js';
import { validateIdentifier, validateText } from '../validate-input.js';
import { getRealSearchFunction, getRealStoreFunction } from './memory-search-store.js';

export const hooksPatternStore: MCPTool = {
  name: 'hooks_intelligence_pattern-store',
  description: 'Store pattern in ReasoningBank (HNSW-indexed) Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Pattern description' },
      type: { type: 'string', description: 'Pattern type' },
      confidence: { type: 'number', description: 'Confidence score' },
      metadata: { type: 'object', description: 'Additional metadata' },
    },
    required: ['pattern'],
  },
  handler: async (params: Record<string, unknown>) => {
    const pattern = params.pattern as string;
    const type = (params.type as string) || 'general';
    const confidence = (params.confidence as number) || 0.8;
    const metadata = params.metadata as Record<string, unknown> | undefined;
    const timestamp = new Date().toISOString();

    { const v = validateText(pattern, 'pattern'); if (!v.valid) return { success: false, error: v.error }; }
    if (params.type) { const v = validateIdentifier(params.type as string, 'type'); if (!v.valid) return { success: false, error: v.error }; }
    const patternId = `pattern-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Phase 3: Try ReasoningBank via bridge first
    let reasoningResult: { success: boolean; patternId: string; controller: string } | null = null;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      reasoningResult = await bridge.bridgeStorePattern({ pattern, type, confidence, metadata: metadata as Record<string, unknown> | undefined });
    } catch {
      // Bridge not available
    }

    // Fallback: persist using memory-initializer store
    let storeResult: { success: boolean; id?: string; embedding?: { dimensions: number; model: string }; error?: string } = { success: false };
    if (!reasoningResult) {
      const storeFn = await getRealStoreFunction();
      if (storeFn) {
        try {
          storeResult = await storeFn({
            key: patternId,
            value: JSON.stringify({ pattern, type, confidence, metadata, timestamp }),
            namespace: 'pattern',
            generateEmbeddingFlag: true,
            tags: [type, `confidence-${Math.round(confidence * 100)}`, 'reasoning-pattern'],
          });
        } catch (error) {
          storeResult = { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
    }

    const success = reasoningResult?.success || storeResult.success;
    const controller = reasoningResult?.controller || (storeResult.success ? 'bridge-store' : 'none');
    const hasEmbedding = !!storeResult.embedding || controller === 'reasoningBank' || controller === 'bridge-fallback';

    return {
      patternId: reasoningResult?.patternId || storeResult.id || patternId,
      pattern,
      type,
      confidence,
      indexed: success,
      hnswIndexed: success && hasEmbedding,
      embedding: storeResult.embedding,
      timestamp,
      controller,
      implementation: (controller === 'reasoningBank' || controller === 'bridge-fallback')
        ? 'reasoning-bank-controller'
        : (storeResult.success ? 'real-hnsw-indexed' : 'memory-only'),
      note: controller === 'reasoningBank'
        ? 'Pattern stored via ReasoningBank controller with HNSW indexing'
        : controller === 'bridge-fallback'
          ? 'Pattern stored via bridge with embedding and HNSW indexing'
          : (storeResult.success ? 'Pattern stored with vector embedding for semantic search' : (storeResult.error || 'Store function unavailable')),
    };
  },
};

export const hooksPatternSearch: MCPTool = {
  name: 'hooks_intelligence_pattern-search',
  description: 'Search patterns using REAL vector search (HNSW when available, brute-force fallback) Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      topK: { type: 'number', description: 'Number of results' },
      minConfidence: { type: 'number', description: 'Minimum similarity threshold (0-1)' },
      namespace: { type: 'string', description: 'Namespace to search (default: pattern)' },
    },
    required: ['query'],
  },
  handler: async (params: Record<string, unknown>) => {
    const query = params.query as string;
    const topK = (params.topK as number) || 5;
    const minConfidence = (params.minConfidence as number) || 0.3;
    const namespace = (params.namespace as string) || 'pattern';

    { const v = validateText(query, 'query'); if (!v.valid) return { success: false, error: v.error }; }
    if (params.namespace) { const v = validateIdentifier(params.namespace as string, 'namespace'); if (!v.valid) return { success: false, error: v.error }; }

    // Phase 3: Try ReasoningBank search via bridge first
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      const rbResult = await bridge.bridgeSearchPatterns({ query, topK, minConfidence });
      if (rbResult && rbResult.results.length > 0) {
        return {
          query,
          results: rbResult.results.map(r => ({
            patternId: r.id,
            pattern: r.content,
            similarity: r.score,
            confidence: r.score,
            namespace,
          })),
          searchTimeMs: 0,
          backend: rbResult.controller,
          note: `Results from ${rbResult.controller} controller`,
        };
      }
    } catch {
      // Bridge not available — fall through
    }

    // Fallback: Try real vector search via memory-initializer
    const searchFn = await getRealSearchFunction();

    if (searchFn) {
      try {
        const searchResult = await searchFn({
          query,
          namespace,
          limit: topK,
          threshold: minConfidence,
        });

        if (searchResult.success && searchResult.results.length > 0) {
          return {
            query,
            results: searchResult.results.map(r => ({
              patternId: r.id,
              pattern: r.content,
              similarity: r.score,
              confidence: r.score,
              namespace: r.namespace,
              key: r.key,
            })),
            searchTimeMs: searchResult.searchTime,
            backend: 'real-vector-search',
            note: 'Results from HNSW/SQLite vector search (BM25 hybrid)',
          };
        }

        // No results found
        return {
          query,
          results: [],
          searchTimeMs: searchResult.searchTime,
          backend: 'real-vector-search',
          note: searchResult.error || 'No matching patterns found. Store patterns first using memory/store with namespace "pattern".',
        };
      } catch (error) {
        // Fall through to empty response with error
        return {
          query,
          results: [],
          searchTimeMs: 0,
          backend: 'error',
          error: String(error),
          note: 'Vector search failed. Ensure memory database is initialized.',
        };
      }
    }

    // No search function available
    return {
      query,
      results: [],
      searchTimeMs: 0,
      backend: 'unavailable',
      note: 'Real vector search not available. Initialize memory database with: claude-flow memory init',
    };
  },
};

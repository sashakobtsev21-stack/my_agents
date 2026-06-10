/**
 * Memory CRUD MCP tools — store / retrieve / search / delete / list.
 * Extracted from memory-tools.ts (W125, P3.16 cut #2).
 */
import type { MCPTool } from '../types.js';
import { validateIdentifier } from '../validate-input.js';
import {
  validateMemoryInput,
  getMemoryFunctions,
  ensureInitialized,
} from './helpers.js';

export const memoryStore: MCPTool =   {
    name: 'memory_store',
    description: 'Persistent key-value store with vector embedding — survives across sessions and is searchable by meaning, not just by file path. Use when native Write is wrong because the data is not a file (e.g. a learned pattern, a decision, a budget config) AND you need to recall it later by semantic query, not by path. Defaults to namespace="default"; pass --upsert=true to update an existing key.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key (unique within namespace)' },
        value: { description: 'Value to store (string or object)' },
        namespace: { type: 'string', description: 'Namespace for organization (default: "default")' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for filtering',
        },
        ttl: { type: 'number', description: 'Time-to-live in seconds (optional)' },
        upsert: { type: 'boolean', description: 'If true, update existing key instead of failing (default: false)' },
      },
      required: ['key', 'value'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { storeEntry } = await getMemoryFunctions();

      const key = input.key as string;
      const namespace = (input.namespace as string) || 'default';
      const rawValue = input.value;
      const value = typeof rawValue === 'string' ? rawValue : (rawValue !== undefined ? JSON.stringify(rawValue) : '');
      const tags = (input.tags as string[]) || [];
      const ttl = input.ttl as number | undefined;
      const upsert = (input.upsert as boolean) || false;

      if (!value) {
        return {
          success: false,
          key,
          stored: false,
          hasEmbedding: false,
          error: 'Value is required and cannot be empty',
        };
      }

      validateMemoryInput(key, value, undefined, namespace);

      const startTime = performance.now();

      try {
        const result = await storeEntry({
          key,
          value,
          namespace,
          generateEmbeddingFlag: true,
          tags,
          ttl,
          upsert,
        });

        const duration = performance.now() - startTime;

        return {
          success: result.success,
          key,
          namespace,
          stored: result.success,
          storedAt: new Date().toISOString(),
          hasEmbedding: !!result.embedding,
          embeddingDimensions: result.embedding?.dimensions || null,
          backend: 'sql.js + HNSW',
          storeTime: `${duration.toFixed(2)}ms`,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

export const memoryRetrieve: MCPTool =   {
    name: 'memory_retrieve',
    description: 'Read back a value previously stored via memory_store, by exact (namespace, key) — lossless, includes metadata. Use when native Read is wrong because the value is not a file (it lives in the .swarm/memory.db SQLite store) AND you know the exact key. For semantic lookup by meaning, use memory_search.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key' },
        namespace: { type: 'string', description: 'Namespace (default: "default")' },
      },
      required: ['key'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { getEntry } = await getMemoryFunctions();

      const key = input.key as string;
      const namespace = (input.namespace as string) || 'default';

      validateMemoryInput(key, undefined, undefined, namespace);

      try {
        const result = await getEntry({ key, namespace });

        if (result.found && result.entry) {
          // Try to parse JSON value
          let value: unknown = result.entry.content;
          try {
            value = JSON.parse(result.entry.content);
          } catch {
            // Keep as string
          }

          return {
            key,
            namespace,
            value,
            tags: result.entry.tags,
            storedAt: result.entry.createdAt,
            updatedAt: result.entry.updatedAt,
            accessCount: result.entry.accessCount,
            hasEmbedding: result.entry.hasEmbedding,
            found: true,
            backend: 'sql.js + HNSW',
          };
        }

        return {
          key,
          namespace,
          value: null,
          found: false,
        };
      } catch (error) {
        return {
          key,
          namespace,
          value: null,
          found: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

export const memorySearch: MCPTool =   {
    name: 'memory_search',
    description: 'Find stored memories by meaning (vector similarity), not by literal text — finds "JWT auth pattern" when you query "token-based login flow". Use when native Grep is wrong because Grep matches characters and you need to find conceptually-related entries across past sessions. Backed by HNSW index over ONNX embeddings; returns top-k with similarity scores. Pair with smart=true for query expansion + MMR diversity.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (semantic similarity)' },
        namespace: { type: 'string', description: 'Namespace to search (default: "default")' },
        limit: { type: 'number', description: 'Maximum results (default: 10)' },
        threshold: { type: 'number', description: 'Minimum similarity threshold 0-1 (default: 0.3)' },
        smart: { type: 'boolean', description: 'Enable SmartRetrieval pipeline — query expansion, RRF fusion, recency boost, MMR diversity (default: false)' },
      },
      required: ['query'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { searchEntries } = await getMemoryFunctions();

      const query = input.query as string;
      const namespace = (input.namespace as string) || 'default';
      const limit = (input.limit as number) ?? 10;
      const threshold = (input.threshold as number) ?? 0.3;

      validateMemoryInput(undefined, undefined, query);

      const startTime = performance.now();

      try {
        // #1846: feature-detect smartSearch on the resolved memory package.
        // The export landed in @claude-flow/memory@>3.0.0-alpha.14 — older
        // installs pin to a build that exposes search/store/retrieve but
        // not smartSearch. Throwing `is not a function` is hostile; instead
        // detect at runtime and gracefully fall through to plain semantic
        // search with an explicit fallback note.
        let smartFallbackReason: string | undefined;
        if (input.smart) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let memMod: any;
          try {
            memMod = await import('@claude-flow/memory');
          } catch (err) {
            smartFallbackReason = `@claude-flow/memory failed to load: ${(err as Error).message}`;
          }
          const smartSearch = memMod && typeof memMod.smartSearch === 'function'
            ? memMod.smartSearch
            : undefined;

          if (smartSearch) {
            // SmartRetrieval pipeline (ADR-090)
            const rawSearch = async (req: { query: string; namespace?: string; limit?: number; threshold?: number }) => {
              const r = await searchEntries({
                query: req.query,
                namespace: req.namespace || namespace,
                limit: req.limit || limit * 3,
                threshold: req.threshold ?? threshold,
              });
              return {
                results: r.results.map(e => ({
                  id: e.id,
                  key: e.key,
                  content: e.content,
                  score: e.score,
                  namespace: e.namespace,
                })),
              };
            };

            const smartResult = await smartSearch(rawSearch, {
              query,
              namespace,
              limit,
              threshold,
            });

            const duration = performance.now() - startTime;

            const results = smartResult.results.map((r: { content: string; key: string; namespace: string; score: number }) => {
              let value: unknown = r.content;
              try { value = JSON.parse(r.content); } catch { /* keep as string */ }
              return {
                key: r.key,
                namespace: r.namespace,
                value,
                similarity: r.score,
              };
            });

            return {
              query,
              results,
              total: results.length,
              searchTime: `${duration.toFixed(2)}ms`,
              backend: 'SmartRetrieval (RRF + MMR + Recency)',
              stats: smartResult.stats,
            };
          }

          // smart=true but smartSearch unavailable on installed package.
          // Fall through to plain search with an explicit warning.
          smartFallbackReason = smartFallbackReason
            ?? 'smartSearch is not exported by the installed @claude-flow/memory build (likely a release lag — see #1846). Falling back to standard semantic search.';
        }

        // Original non-smart path (unchanged) — also reached when smart was
        // requested but unavailable. We attach `smartFallback` to the
        // response so callers can see the degradation explicitly.
        const result = await searchEntries({
          query,
          namespace,
          limit,
          threshold,
        });

        const duration = performance.now() - startTime;

        // Parse JSON values in results
        const results = result.results.map(r => {
          let value: unknown = r.content;
          try {
            value = JSON.parse(r.content);
          } catch {
            // Keep as string
          }

          return {
            key: r.key,
            namespace: r.namespace,
            value,
            similarity: r.score,
          };
        });

        return {
          query,
          results,
          total: results.length,
          searchTime: `${duration.toFixed(2)}ms`,
          backend: 'HNSW + sql.js',
          ...(smartFallbackReason ? { smartFallback: smartFallbackReason } : {}),
        };
      } catch (error) {
        return {
          query,
          results: [],
          total: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

export const memoryDelete: MCPTool =   {
    name: 'memory_delete',
    description: 'Remove a stored memory entry by exact (namespace, key). Use when a previously stored decision is invalidated or contains stale data. No native equivalent — Write to a file does not affect the .swarm/memory.db SQLite store.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key' },
        namespace: { type: 'string', description: 'Namespace (default: "default")' },
      },
      required: ['key'],
    },
    handler: async (input) => {
      await ensureInitialized();
      const { deleteEntry } = await getMemoryFunctions();

      const key = input.key as string;
      const namespace = (input.namespace as string) || 'default';

      validateMemoryInput(key, undefined, undefined, namespace);

      try {
        const result = await deleteEntry({ key, namespace });

        return {
          success: result.deleted,
          key,
          namespace,
          deleted: result.deleted,
          hnswIndexInvalidated: result.deleted,
          backend: 'sql.js + HNSW',
        };
      } catch (error) {
        return {
          success: false,
          key,
          namespace,
          deleted: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

export const memoryList: MCPTool =   {
    name: 'memory_list',
    description: 'Enumerate stored memory entries (optionally filtered by namespace/tags) without semantic search. Use when native Glob is wrong because the entries are not files (they live in .swarm/memory.db). For inspection / audit / "what is in my memory" — pair with memory_search for retrieval-by-meaning.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: 'Filter by namespace' },
        limit: { type: 'number', description: 'Maximum results (default: 50)' },
        offset: { type: 'number', description: 'Offset for pagination (default: 0)' },
      },
    },
    handler: async (input) => {
      await ensureInitialized();
      const { listEntries } = await getMemoryFunctions();

      const namespace = input.namespace as string | undefined;
      const limit = (input.limit as number) || 50;
      const offset = (input.offset as number) || 0;

      if (namespace) { const vNs = validateIdentifier(namespace, 'namespace'); if (!vNs.valid) throw new Error(vNs.error); }

      try {
        const result = await listEntries({
          namespace,
          limit,
          offset,
        });

        const entries = result.entries.map(e => ({
          key: e.key,
          namespace: e.namespace,
          storedAt: e.createdAt,
          updatedAt: e.updatedAt,
          accessCount: e.accessCount,
          hasEmbedding: e.hasEmbedding,
          size: e.size,
        }));

        return {
          entries,
          total: result.total,
          limit,
          offset,
          backend: 'sql.js + HNSW',
        };
      } catch (error) {
        return {
          entries: [],
          total: 0,
          limit,
          offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };

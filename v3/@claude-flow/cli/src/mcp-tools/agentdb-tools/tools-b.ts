/**
 * AgentDB MCP tools — consolidation, batch ops, context synthesis,
 * semantic routing, and the hierarchical/causal delete tools.
 *
 * Extracted from agentdb-tools.ts (W123, P3.15 cut #6 — final).
 */
import type { MCPTool } from '../types.js';
import { validateIdentifier, validateText } from '../validate-input.js';
import {
  MAX_TOP_K,
  MAX_BATCH_SIZE,
  validateString,
  validatePositiveInt,
  sanitizeError,
  getBridge,
} from './helpers.js';

// ===== agentdb_consolidate — Run memory consolidation =====

export const agentdbConsolidate: MCPTool = {
  name: 'agentdb_consolidate',
  description: 'Run memory consolidation to promote entries across tiers and compress old data Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      minAge: { type: 'number', description: 'Minimum age in hours since store (optional)' },
      maxEntries: { type: 'number', description: 'Maximum entries to consolidate (optional)' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const bridge = await getBridge();
      const result = await bridge.bridgeConsolidate({
        minAge: typeof params.minAge === 'number' ? Math.max(0, params.minAge) : undefined,
        maxEntries: validatePositiveInt(params.maxEntries, 1000, 10_000),
      });
      return result ?? { success: false, error: 'AgentDB bridge not available. Use memory_store/memory_search instead.' };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

// ===== agentdb_batch — Batch operations (insert, update, delete) =====

export const agentdbBatch: MCPTool = {
  name: 'agentdb_batch',
  description: 'Batch operations on AgentDB episodes (insert, update, delete). Note: entries are stored in the AgentDB episodes table, not the memory_search namespace. Use memory_store for entries that should be searchable via memory_search. Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Batch operation type',
        enum: ['insert', 'update', 'delete'],
      },
      entries: {
        type: 'array',
        description: 'Array of {key, value} entries to operate on',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['key'],
        },
      },
    },
    required: ['operation', 'entries'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vOp = validateIdentifier(params.operation, 'operation');
      if (!vOp.valid) return { success: false, error: vOp.error };
      const operation = validateString(params.operation, 'operation', 20);
      if (!operation) return { success: false, error: 'operation is required (string)' };
      if (!['insert', 'update', 'delete'].includes(operation)) {
        return { success: false, error: `Invalid operation: ${operation}. Must be insert, update, or delete` };
      }
      if (!Array.isArray(params.entries) || params.entries.length === 0) {
        return { success: false, error: 'entries is required (non-empty array)' };
      }
      if (params.entries.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Too many entries: ${params.entries.length}. Max is ${MAX_BATCH_SIZE}` };
      }
      // Validate each entry
      const validatedEntries: Array<{ key: string; value?: string; metadata?: Record<string, unknown> }> = [];
      for (let i = 0; i < params.entries.length; i++) {
        const entry = params.entries[i];
        if (!entry || typeof entry !== 'object') {
          return { success: false, error: `entries[${i}] must be an object` };
        }
        const key = validateString((entry as any).key, `entries[${i}].key`, 1000);
        if (!key) return { success: false, error: `entries[${i}].key is required (non-empty string)` };
        const value = validateString((entry as any).value, `entries[${i}].value`);
        validatedEntries.push({ key, value: value ?? undefined });
      }
      const bridge = await getBridge();
      const result = await bridge.bridgeBatchOperation({
        operation,
        entries: validatedEntries,
      });
      return result ?? { success: false, error: 'AgentDB bridge not available. Use memory_store/memory_search instead.' };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

// ===== agentdb_context_synthesize — Synthesize context from memories =====

export const agentdbContextSynthesize: MCPTool = {
  name: 'agentdb_context-synthesize',
  description: 'Synthesize context from stored memories for a given query Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query to synthesize context for' },
      maxEntries: { type: 'number', description: 'Maximum entries to include (default: 10)' },
    },
    required: ['query'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vQuery = validateText(params.query, 'query', 10_000);
      if (!vQuery.valid) return { success: false, error: vQuery.error };
      const query = validateString(params.query, 'query', 10_000);
      if (!query) return { success: false, error: 'query is required (non-empty string, max 10KB)' };
      const bridge = await getBridge();
      const result = await bridge.bridgeContextSynthesize({
        query,
        maxEntries: validatePositiveInt(params.maxEntries, 10, MAX_TOP_K),
      });
      return result ?? { success: false, error: 'AgentDB bridge not available. Use memory_store/memory_search instead.' };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};

// ===== agentdb_semantic_route — Route via SemanticRouter =====

export const agentdbSemanticRoute: MCPTool = {
  name: 'agentdb_semantic-route',
  description: 'Route an input via AgentDB SemanticRouter for intent classification Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input text to route' },
    },
    required: ['input'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vInput = validateText(params.input, 'input', 10_000);
      if (!vInput.valid) return { route: null, error: vInput.error };
      const input = validateString(params.input, 'input', 10_000);
      if (!input) return { route: null, error: 'input is required (non-empty string, max 10KB)' };
      const bridge = await getBridge();
      const result = await bridge.bridgeSemanticRoute({ input });
      return result ?? { route: null, error: 'AgentDB bridge not available. Use hooks route instead.' };
    } catch (error) {
      return { route: null, error: sanitizeError(error) };
    }
  },
};

// ===== #1784: Delete tools — symmetry for hierarchical-store + causal-edge =====

export const agentdbHierarchicalDelete: MCPTool = {
  name: 'agentdb_hierarchical-delete',
  description: 'Delete a hierarchical-memory entry by key. Returns controller="native-unsupported" when the entry is in a backend without a public delete API. Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Memory entry key to delete' },
      tier: {
        type: 'string',
        description: 'Optional tier filter (working, episodic, semantic)',
        enum: ['working', 'episodic', 'semantic'],
      },
    },
    required: ['key'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vKey = validateIdentifier(params.key, 'key');
      if (!vKey.valid) return { success: false, deleted: false, error: vKey.error };
      if (params.tier) { const vTier = validateIdentifier(params.tier, 'tier'); if (!vTier.valid) return { success: false, deleted: false, error: vTier.error }; }
      const key = validateString(params.key, 'key', 1000);
      if (!key) return { success: false, deleted: false, error: 'key is required (non-empty string, max 1KB)' };
      const tier = validateString(params.tier, 'tier', 20);
      if (tier && !['working', 'episodic', 'semantic'].includes(tier)) {
        return { success: false, deleted: false, error: `Invalid tier: ${tier}. Must be working, episodic, or semantic` };
      }
      const bridge = await getBridge();
      const result = await bridge.bridgeDeleteHierarchical({ key, tier: tier ?? undefined });
      return result ?? { success: false, deleted: false, error: 'AgentDB bridge not available' };
    } catch (error) {
      return { success: false, deleted: false, error: sanitizeError(error) };
    }
  },
};

export const agentdbCausalEdgeDelete: MCPTool = {
  name: 'agentdb_causal-edge-delete',
  description: 'Delete a causal edge between two memory entries. Returns controller="native-unsupported" when the edge lives in graph-node native storage (no public delete API). Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      sourceId: { type: 'string', description: 'Source entry ID' },
      targetId: { type: 'string', description: 'Target entry ID' },
      relation: { type: 'string', description: 'Optional relationship type filter' },
    },
    required: ['sourceId', 'targetId'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vSourceId = validateIdentifier(params.sourceId, 'sourceId');
      if (!vSourceId.valid) return { success: false, deleted: false, error: vSourceId.error };
      const vTargetId = validateIdentifier(params.targetId, 'targetId');
      if (!vTargetId.valid) return { success: false, deleted: false, error: vTargetId.error };
      const sourceId = validateString(params.sourceId, 'sourceId', 500);
      const targetId = validateString(params.targetId, 'targetId', 500);
      if (!sourceId) return { success: false, deleted: false, error: 'sourceId is required (non-empty string)' };
      if (!targetId) return { success: false, deleted: false, error: 'targetId is required (non-empty string)' };
      const relation = validateString(params.relation, 'relation', 200) ?? undefined;
      const bridge = await getBridge();
      const result = await bridge.bridgeDeleteCausalEdge({ sourceId, targetId, relation });
      return result ?? { success: false, deleted: false, error: 'AgentDB bridge not available' };
    } catch (error) {
      return { success: false, deleted: false, error: sanitizeError(error) };
    }
  },
};

export const agentdbCausalNodeDelete: MCPTool = {
  name: 'agentdb_causal-node-delete',
  description: 'Cascade-delete a causal node and all its incident edges from the SQL fallback. Native graph-node entries are unaffected (no delete API in the binding). Use when generic memory_* tools are wrong because you need AgentDB-specific controllers (HNSW vector search, hierarchical tiers, causal-graph links, pattern store/recall, RaBitQ quantization). For simple key-value persistence, memory_store/memory_retrieve are simpler. For unrelated file work, native Read/Write are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'Node ID to delete (cascades to all incident edges)' },
    },
    required: ['nodeId'],
  },
  handler: async (params: Record<string, unknown>) => {
    try {
      const vNodeId = validateIdentifier(params.nodeId, 'nodeId');
      if (!vNodeId.valid) return { success: false, deletedNode: false, deletedEdges: 0, error: vNodeId.error };
      const nodeId = validateString(params.nodeId, 'nodeId', 500);
      if (!nodeId) return { success: false, deletedNode: false, deletedEdges: 0, error: 'nodeId is required (non-empty string)' };
      const bridge = await getBridge();
      const result = await bridge.bridgeDeleteCausalNode({ nodeId });
      return result ?? { success: false, deletedNode: false, deletedEdges: 0, error: 'AgentDB bridge not available' };
    } catch (error) {
      return { success: false, deletedNode: false, deletedEdges: 0, error: sanitizeError(error) };
    }
  },
};

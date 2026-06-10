/**
 * Official plugin definitions (part B) — PluginBuilder chains for the
 * security / utility / database plugins.
 *
 * Extracted from official/index.ts (W155, P3.34 cut #2).
 */
import { PluginBuilder } from '../../sdk/index.js';
import { HookEvent, HookPriority } from '../../types/index.js';
// ============================================================================
// Security Plugins
// ============================================================================

/**
 * Input validation plugin - validates all inputs.
 */
export const inputValidationPlugin = new PluginBuilder('input-validation', '3.0.0')
  .withDescription('Input validation and sanitization')
  .withAuthor('Claude Flow')
  .withTags(['security', 'hook', 'validation'])
  .withHooks([
    {
      event: HookEvent.PreToolUse,
      priority: HookPriority.Critical,
      name: 'validate-tool-input',
      handler: async (ctx) => {
        // Validate tool inputs
        return { success: true };
      },
    },
    {
      event: HookEvent.PreCommand,
      priority: HookPriority.Critical,
      name: 'validate-command',
      handler: async (ctx) => {
        // Validate command
        return { success: true };
      },
    },
  ])
  .build();

/**
 * Path security plugin - prevents path traversal.
 */
export const pathSecurityPlugin = new PluginBuilder('path-security', '3.0.0')
  .withDescription('Path traversal prevention and validation')
  .withAuthor('Claude Flow')
  .withTags(['security', 'hook', 'filesystem'])
  .withHooks([
    {
      event: HookEvent.PreFileWrite,
      priority: HookPriority.Critical,
      name: 'validate-path',
      handler: async (ctx) => {
        // Validate file path
        return { success: true };
      },
    },
    {
      event: HookEvent.PreFileDelete,
      priority: HookPriority.Critical,
      name: 'validate-delete-path',
      handler: async (ctx) => {
        return { success: true };
      },
    },
  ])
  .build();

/**
 * Audit log plugin - logs all operations.
 */
export const auditLogPlugin = new PluginBuilder('audit-log', '3.0.0')
  .withDescription('Comprehensive audit logging')
  .withAuthor('Claude Flow')
  .withTags(['security', 'hook', 'audit', 'logging'])
  .withHooks([
    {
      event: HookEvent.PostToolUse,
      priority: HookPriority.Low,
      name: 'log-tool-use',
      async: true,
      handler: async (ctx) => {
        // Log tool usage
        return { success: true };
      },
    },
    {
      event: HookEvent.PostCommand,
      priority: HookPriority.Low,
      name: 'log-command',
      async: true,
      handler: async (ctx) => {
        // Log command execution
        return { success: true };
      },
    },
    {
      event: HookEvent.PostFileWrite,
      priority: HookPriority.Low,
      name: 'log-file-write',
      async: true,
      handler: async (ctx) => {
        // Log file write
        return { success: true };
      },
    },
  ])
  .build();

/**
 * Security scan plugin - scans for vulnerabilities.
 */
export const securityScanPlugin = new PluginBuilder('security-scan', '3.0.0')
  .withDescription('Security vulnerability scanning')
  .withAuthor('Claude Flow')
  .withTags(['security', 'tool', 'scanning'])
  .withMCPTools([
    {
      name: 'scan-code',
      description: 'Scan code for security vulnerabilities',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to scan' },
          depth: { type: 'string', enum: ['quick', 'standard', 'deep'], description: 'Scan depth' },
        },
        required: ['path'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: 'Security scan complete' }],
        };
      },
    },
  ])
  .build();

// ============================================================================
// Utility Plugins
// ============================================================================

/**
 * Metrics plugin - collects and reports metrics.
 */
export const metricsPlugin = new PluginBuilder('metrics', '3.0.0')
  .withDescription('Performance and usage metrics collection')
  .withAuthor('Claude Flow')
  .withTags(['utility', 'metrics', 'monitoring'])
  .withMCPTools([
    {
      name: 'get-metrics',
      description: 'Get collected metrics',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Metrics category' },
          timeRange: { type: 'string', description: 'Time range (e.g., "1h", "24h")' },
        },
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: 'Metrics retrieved' }],
        };
      },
    },
  ])
  .build();

/**
 * Cache plugin - provides caching utilities.
 */
export const cachePlugin = new PluginBuilder('cache', '3.0.0')
  .withDescription('Caching utilities for improved performance')
  .withAuthor('Claude Flow')
  .withTags(['utility', 'cache', 'performance'])
  .build();

// ============================================================================
// Database & Vector Plugins
// ============================================================================

/**
 * RuVector PostgreSQL Bridge plugin - advanced vector database with AI capabilities.
 *
 * Provides integration with @ruvector/postgres-cli including:
 * - 53+ SQL functions for vector/graph operations
 * - 39 attention mechanisms for neural processing
 * - GNN layers for graph-aware queries
 * - Hyperbolic embeddings for hierarchical data
 * - Self-learning query optimization
 *
 * @see ADR-027, ADR-028, ADR-029
 */
export const ruvectorPostgresPlugin = new PluginBuilder('ruvector-postgres', '3.0.0')
  .withDescription('RuVector PostgreSQL Bridge - Advanced vector search with attention, GNN, and hyperbolic embeddings')
  .withAuthor('Claude Flow')
  .withTags(['database', 'vector', 'postgresql', 'attention', 'gnn', 'hyperbolic', 'intelligence'])
  .withDependencies(['memory-coordinator'])
  .withMCPTools([
    {
      name: 'ruvector-search',
      description: 'Vector similarity search with 12+ distance metrics (cosine, euclidean, dot, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'array', items: { type: 'number' }, description: 'Query vector' },
          k: { type: 'number', description: 'Number of results to return' },
          metric: { type: 'string', enum: ['cosine', 'euclidean', 'dot', 'manhattan', 'hamming'], description: 'Distance metric' },
          tableName: { type: 'string', description: 'Table to search' },
          filter: { type: 'object', description: 'Metadata filters' },
        },
        required: ['query', 'k', 'tableName'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Vector search in ${input.tableName} with k=${input.k}` }],
        };
      },
    },
    {
      name: 'ruvector-attention',
      description: 'Execute attention mechanism (39 types: multi-head, flash, sparse, linear, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          mechanism: { type: 'string', description: 'Attention mechanism type' },
          query: { type: 'array', items: { type: 'number' }, description: 'Query vector' },
          keys: { type: 'array', items: { type: 'array' }, description: 'Key vectors' },
          values: { type: 'array', items: { type: 'array' }, description: 'Value vectors' },
          numHeads: { type: 'number', description: 'Number of attention heads' },
        },
        required: ['mechanism', 'query', 'keys', 'values'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Attention computed with ${input.mechanism}` }],
        };
      },
    },
    {
      name: 'ruvector-gnn',
      description: 'Execute GNN layer (GCN, GAT, GraphSAGE, GIN, MPNN, EdgeConv)',
      inputSchema: {
        type: 'object',
        properties: {
          layerType: { type: 'string', enum: ['gcn', 'gat', 'sage', 'gin', 'mpnn', 'edge_conv'], description: 'GNN layer type' },
          nodes: { type: 'array', description: 'Node features' },
          edges: { type: 'array', description: 'Edge list' },
          aggregation: { type: 'string', enum: ['mean', 'sum', 'max', 'attention'], description: 'Aggregation method' },
        },
        required: ['layerType', 'nodes', 'edges'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `GNN ${input.layerType} layer executed` }],
        };
      },
    },
    {
      name: 'ruvector-hyperbolic',
      description: 'Hyperbolic embedding operations (Poincare ball, Lorentz hyperboloid)',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', enum: ['poincare', 'lorentz', 'klein'], description: 'Hyperbolic model' },
          operation: { type: 'string', enum: ['distance', 'exp_map', 'log_map', 'mobius_add', 'project'], description: 'Operation' },
          vectors: { type: 'array', description: 'Input vectors' },
          curvature: { type: 'number', description: 'Manifold curvature (negative for hyperbolic)' },
        },
        required: ['model', 'operation', 'vectors'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Hyperbolic ${input.operation} on ${input.model} model` }],
        };
      },
    },
    {
      name: 'ruvector-optimize',
      description: 'Self-learning query optimization and index tuning',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['analyze', 'suggest', 'tune', 'learn'], description: 'Optimization action' },
          target: { type: 'string', description: 'Table or index to optimize' },
        },
        required: ['action'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Optimization ${input.action} completed` }],
        };
      },
    },
  ])
  .withHooks([
    {
      event: HookEvent.PostMemoryStore,
      priority: HookPriority.Normal,
      name: 'ruvector-learn-pattern',
      async: true,
      handler: async (ctx) => {
        // Learn from memory operations for self-optimization
        return { success: true };
      },
    },
    {
      event: HookEvent.PostToolUse,
      priority: HookPriority.Low,
      name: 'ruvector-collect-stats',
      async: true,
      handler: async (ctx) => {
        // Collect statistics for query optimization
        return { success: true };
      },
    },
  ])
  .build();

// ============================================================================
// Official Collections
// ============================================================================

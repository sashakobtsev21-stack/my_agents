/**
 * Hyperbolic Reasoning MCP Tools
 *
 * MCP tool definitions for hyperbolic geometry operations including:
 * - hyperbolic/embed-hierarchy: Embed hierarchies in Poincare ball
 * - hyperbolic/taxonomic-reason: Taxonomic reasoning and queries
 * - hyperbolic/semantic-search: Hierarchically-aware search
 * - hyperbolic/hierarchy-compare: Compare hierarchical structures
 * - hyperbolic/entailment-graph: Build and query entailment graphs
 */


import type { MCPTool } from './types.js';
// Shared bridges + the five handlers were extracted into
// ./mcp-tools-handlers.ts during campaign-2 wave 35 (W241).
import {
  embedHierarchyHandler,
  entailmentGraphHandler,
  hierarchyCompareHandler,
  semanticSearchHandler,
  taxonomicReasonHandler,
} from './mcp-tools-handlers.js';

export const embedHierarchyTool: MCPTool = {
  name: 'hyperbolic_embed_hierarchy',
  description: 'Embed hierarchical structure in Poincare ball. Uses hyperbolic geometry for optimal tree representation with logarithmic distortion.',
  category: 'hyperbolic',
  version: '0.1.0',
  tags: ['hyperbolic', 'poincare', 'hierarchy', 'embedding', 'tree'],
  cacheable: true,
  cacheTTL: 300000,
  inputSchema: {
    type: 'object',
    properties: {
      hierarchy: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                parent: { type: 'string' },
                features: { type: 'object' },
              },
            },
          },
          edges: { type: 'array' },
        },
      },
      model: { type: 'string', enum: ['poincare_ball', 'lorentz', 'klein', 'half_plane'] },
      parameters: {
        type: 'object',
        properties: {
          dimensions: { type: 'number', default: 32 },
          curvature: { type: 'number', default: -1.0 },
          learnCurvature: { type: 'boolean', default: true },
          epochs: { type: 'number', default: 100 },
          learningRate: { type: 'number', default: 0.01 },
        },
      },
    },
    required: ['hierarchy'],
  },
  handler: embedHierarchyHandler,
};

// ============================================================================

export const taxonomicReasonTool: MCPTool = {
  name: 'hyperbolic_taxonomic_reason',
  description: 'Taxonomic reasoning using hyperbolic entailment. Supports IS-A, subsumption, LCA, path, and similarity queries.',
  category: 'hyperbolic',
  version: '0.1.0',
  tags: ['hyperbolic', 'taxonomy', 'reasoning', 'is-a', 'subsumption'],
  cacheable: true,
  cacheTTL: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['is_a', 'subsumption', 'lowest_common_ancestor', 'path', 'similarity'] },
          subject: { type: 'string' },
          object: { type: 'string' },
        },
      },
      taxonomy: { type: 'string', description: 'Taxonomy index ID from embed-hierarchy' },
      inference: {
        type: 'object',
        properties: {
          transitive: { type: 'boolean', default: true },
          fuzzy: { type: 'boolean', default: false },
          confidence: { type: 'number', default: 0.8 },
        },
      },
    },
    required: ['query', 'taxonomy'],
  },
  handler: taxonomicReasonHandler,
};

// ============================================================================

export const semanticSearchTool: MCPTool = {
  name: 'hyperbolic_semantic_search',
  description: 'Semantic search with hierarchical awareness. Supports nearest, subtree, ancestors, siblings, and cone search modes.',
  category: 'hyperbolic',
  version: '0.1.0',
  tags: ['hyperbolic', 'search', 'semantic', 'hierarchy', 'nearest-neighbor'],
  cacheable: true,
  cacheTTL: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      index: { type: 'string', description: 'Index ID from embed-hierarchy' },
      searchMode: { type: 'string', enum: ['nearest', 'subtree', 'ancestors', 'siblings', 'cone'] },
      constraints: {
        type: 'object',
        properties: {
          maxDepth: { type: 'number' },
          minDepth: { type: 'number' },
          subtreeRoot: { type: 'string' },
        },
      },
      topK: { type: 'number', default: 10 },
    },
    required: ['query', 'index'],
  },
  handler: semanticSearchHandler,
};

// ============================================================================

export const hierarchyCompareTool: MCPTool = {
  name: 'hyperbolic_hierarchy_compare',
  description: 'Compare hierarchies using hyperbolic alignment. Computes structural and semantic similarity with node-level alignments.',
  category: 'hyperbolic',
  version: '0.1.0',
  tags: ['hyperbolic', 'comparison', 'alignment', 'tree-edit', 'similarity'],
  cacheable: true,
  cacheTTL: 120000,
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'object', description: 'First hierarchy' },
      target: { type: 'object', description: 'Second hierarchy' },
      alignment: {
        type: 'string',
        enum: ['wasserstein', 'gromov_wasserstein', 'tree_edit', 'subtree_isomorphism'],
      },
      metrics: {
        type: 'array',
        items: { type: 'string', enum: ['structural_similarity', 'semantic_similarity', 'coverage', 'precision'] },
      },
    },
    required: ['source', 'target'],
  },
  handler: hierarchyCompareHandler,
};

// ============================================================================

export const entailmentGraphTool: MCPTool = {
  name: 'hyperbolic_entailment_graph',
  description: 'Build and query entailment graphs using hyperbolic embeddings. Supports transitive closure and pruning strategies.',
  category: 'hyperbolic',
  version: '0.1.0',
  tags: ['hyperbolic', 'entailment', 'graph', 'nli', 'reasoning'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['build', 'query', 'expand', 'prune'] },
      concepts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            type: { type: 'string' },
          },
        },
      },
      graphId: { type: 'string' },
      query: {
        type: 'object',
        properties: {
          premise: { type: 'string' },
          hypothesis: { type: 'string' },
        },
      },
      entailmentThreshold: { type: 'number', default: 0.7 },
      transitiveClosure: { type: 'boolean', default: true },
      pruneStrategy: { type: 'string', enum: ['none', 'transitive_reduction', 'confidence_threshold'] },
    },
    required: ['action'],
  },
  handler: entailmentGraphHandler,
};

// ============================================================================
// Tool Exports
// ============================================================================

/**
 * All Hyperbolic Reasoning MCP Tools
 */
export const hyperbolicReasoningTools: MCPTool[] = [
  embedHierarchyTool,
  taxonomicReasonTool,
  semanticSearchTool,
  hierarchyCompareTool,
  entailmentGraphTool,
];

/**
 * Tool name to handler map
 */
export const toolHandlers = new Map<string, MCPTool['handler']>([
  ['hyperbolic_embed_hierarchy', embedHierarchyHandler],
  ['hyperbolic_taxonomic_reason', taxonomicReasonHandler],
  ['hyperbolic_semantic_search', semanticSearchHandler],
  ['hyperbolic_hierarchy_compare', hierarchyCompareHandler],
  ['hyperbolic_entailment_graph', entailmentGraphHandler],
]);

/**
 * Get a tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  return hyperbolicReasoningTools.find(t => t.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return hyperbolicReasoningTools.map(t => t.name);
}

export default hyperbolicReasoningTools;

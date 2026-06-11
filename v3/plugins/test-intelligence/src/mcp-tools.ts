/**
 * Test Intelligence MCP Tools
 *
 * 5 MCP tools for AI-powered test intelligence:
 * 1. test/select-predictive - Predictive test selection using RL
 * 2. test/flaky-detect - Flaky test detection and analysis
 * 3. test/coverage-gaps - Test coverage gap identification
 * 4. test/mutation-optimize - Mutation testing optimization
 * 5. test/generate-suggest - Test case generation suggestions
 */


import type { MCPTool } from './types.js';
// Handlers/helpers extracted into ./mcp-tools-handlers.ts during
// campaign-2 wave 37 (W243).
import {
  coverageGapsHandler,
  flakyDetectHandler,
  generateSuggestHandler,
  mutationOptimizeHandler,
  selectPredictiveHandler,
} from './mcp-tools-handlers.js';

export const selectPredictiveTool: MCPTool = {
  name: 'test/select-predictive',
  description: 'Predictively select tests based on code changes using reinforcement learning. Returns tests most likely to fail, optimizing CI time while maintaining confidence.',
  category: 'test-intelligence',
  version: '0.1.0',
  tags: ['testing', 'ci-optimization', 'machine-learning', 'predictive'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      changes: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          gitDiff: { type: 'string' },
          gitRef: { type: 'string' },
        },
      },
      strategy: {
        type: 'string',
        enum: ['fast_feedback', 'high_coverage', 'risk_based', 'balanced'],
      },
      budget: {
        type: 'object',
        properties: {
          maxTests: { type: 'number' },
          maxDuration: { type: 'number' },
          confidence: { type: 'number' },
        },
      },
    },
    required: ['changes'],
  },
  handler: selectPredictiveHandler,
};


export const flakyDetectTool: MCPTool = {
  name: 'test/flaky-detect',
  description: 'Detect flaky tests using pattern analysis. Identifies intermittent failures, timing-sensitive tests, order-dependent tests, and resource contention issues.',
  category: 'test-intelligence',
  version: '0.1.0',
  tags: ['testing', 'flaky', 'reliability', 'analysis'],
  cacheable: true,
  cacheTTL: 300000,
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'object',
        properties: {
          testSuite: { type: 'string' },
          historyDepth: { type: 'number' },
        },
      },
      analysis: {
        type: 'array',
        items: { type: 'string' },
      },
      threshold: { type: 'number' },
    },
  },
  handler: flakyDetectHandler,
};


export const coverageGapsTool: MCPTool = {
  name: 'test/coverage-gaps',
  description: 'Identify test coverage gaps using code-test graph analysis. Prioritizes gaps by risk, complexity, code churn, and recency.',
  category: 'test-intelligence',
  version: '0.1.0',
  tags: ['testing', 'coverage', 'analysis', 'quality'],
  cacheable: true,
  cacheTTL: 600000,
  inputSchema: {
    type: 'object',
    properties: {
      targetPaths: { type: 'array', items: { type: 'string' } },
      coverageType: { type: 'string', enum: ['line', 'branch', 'function', 'semantic'] },
      prioritization: { type: 'string', enum: ['risk', 'complexity', 'churn', 'recency'] },
      minCoverage: { type: 'number' },
    },
  },
  handler: coverageGapsHandler,
};


export const mutationOptimizeTool: MCPTool = {
  name: 'test/mutation-optimize',
  description: 'Optimize mutation testing using selective mutation. Uses ML to prioritize mutations most likely to reveal test weaknesses.',
  category: 'test-intelligence',
  version: '0.1.0',
  tags: ['testing', 'mutation', 'optimization', 'quality'],
  cacheable: false,
  inputSchema: {
    type: 'object',
    properties: {
      targetPath: { type: 'string' },
      budget: { type: 'number' },
      strategy: { type: 'string', enum: ['random', 'coverage_guided', 'ml_guided', 'historical'] },
      mutationTypes: { type: 'array', items: { type: 'string' } },
    },
    required: ['targetPath'],
  },
  handler: mutationOptimizeHandler,
};


export const generateSuggestTool: MCPTool = {
  name: 'test/generate-suggest',
  description: 'Suggest test cases for uncovered code paths. Analyzes function signatures, complexity, and generates framework-specific test code.',
  category: 'test-intelligence',
  version: '0.1.0',
  tags: ['testing', 'generation', 'coverage', 'automation'],
  cacheable: true,
  cacheTTL: 120000,
  inputSchema: {
    type: 'object',
    properties: {
      targetFunction: { type: 'string' },
      testStyle: { type: 'string', enum: ['unit', 'integration', 'property_based', 'snapshot'] },
      framework: { type: 'string', enum: ['jest', 'vitest', 'pytest', 'junit', 'mocha'] },
      edgeCases: { type: 'boolean' },
      mockStrategy: { type: 'string', enum: ['minimal', 'full', 'none'] },
    },
    required: ['targetFunction'],
  },
  handler: generateSuggestHandler,
};

// ============================================================================
// Export All Tools
// ============================================================================

export const testIntelligenceTools: MCPTool[] = [
  selectPredictiveTool,
  flakyDetectTool,
  coverageGapsTool,
  mutationOptimizeTool,
  generateSuggestTool,
];


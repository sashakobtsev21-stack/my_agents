/**
 * V3 MCP System Tools
 *
 * MCP tools for system operations:
 * - system/status - Overall system status
 * - system/metrics - Performance metrics
 * - system/health - Health check endpoint
 * - system/info - System information
 *
 * Implements ADR-005: MCP-First API Design
 */

import { MCPTool } from '../types.js';
// Support + handlers extracted into the sub-modules below during
// campaign-2 wave 24 (W230); the public surface stays here.
import {
  systemHealthSchema,
  systemInfoSchema,
  systemMetricsSchema,
  systemStatusSchema,
} from './system-tools-support.js';
import {
  handleSystemHealth,
  handleSystemInfo,
  handleSystemMetrics,
  handleSystemStatus,
} from './system-tools-handlers.js';

// Tool Definitions
// ============================================================================

/**
 * system/status tool
 */
export const systemStatusTool: MCPTool = {
  name: 'system/status',
  description: 'Get comprehensive system status including agents, tasks, memory, and component health',
  inputSchema: {
    type: 'object',
    properties: {
      includeAgents: {
        type: 'boolean',
        description: 'Include agent information',
        default: true,
      },
      includeTasks: {
        type: 'boolean',
        description: 'Include task information',
        default: true,
      },
      includeMemory: {
        type: 'boolean',
        description: 'Include memory usage',
        default: false,
      },
      includeConnections: {
        type: 'boolean',
        description: 'Include connection pool information',
        default: false,
      },
    },
  },
  handler: async (input, context) => {
    const validated = systemStatusSchema.parse(input);
    return handleSystemStatus(validated, context);
  },
  category: 'system',
  tags: ['system', 'status', 'monitoring'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 2000,
};

/**
 * system/metrics tool
 */
export const systemMetricsTool: MCPTool = {
  name: 'system/metrics',
  description: 'Get system performance metrics for agents, tasks, memory, and swarm',
  inputSchema: {
    type: 'object',
    properties: {
      timeRange: {
        type: 'string',
        enum: ['1h', '6h', '24h', '7d'],
        description: 'Time range for metrics',
        default: '1h',
      },
      includeHistogram: {
        type: 'boolean',
        description: 'Include histogram data',
        default: false,
      },
      components: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['agents', 'tasks', 'memory', 'swarm', 'all'],
        },
        description: 'Components to include',
        default: ['all'],
      },
    },
  },
  handler: async (input, context) => {
    const validated = systemMetricsSchema.parse(input);
    return handleSystemMetrics(validated, context);
  },
  category: 'system',
  tags: ['system', 'metrics', 'performance'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

/**
 * system/health tool
 */
export const systemHealthTool: MCPTool = {
  name: 'system/health',
  description: 'Perform comprehensive health check on all system components',
  inputSchema: {
    type: 'object',
    properties: {
      deep: {
        type: 'boolean',
        description: 'Perform deep health check (checks all dependencies)',
        default: false,
      },
      timeout: {
        type: 'number',
        description: 'Health check timeout in milliseconds',
        minimum: 100,
        maximum: 30000,
        default: 5000,
      },
      components: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific components to check',
      },
    },
  },
  handler: async (input, context) => {
    const validated = systemHealthSchema.parse(input);
    return handleSystemHealth(validated, context);
  },
  category: 'system',
  tags: ['system', 'health', 'monitoring'],
  version: '1.0.0',
};

/**
 * system/info tool
 */
export const systemInfoTool: MCPTool = {
  name: 'system/info',
  description: 'Get system information including versions, platform details, and capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      includeEnv: {
        type: 'boolean',
        description: 'Include environment variables (filtered for safety)',
        default: false,
      },
      includeVersions: {
        type: 'boolean',
        description: 'Include version information',
        default: true,
      },
      includeCapabilities: {
        type: 'boolean',
        description: 'Include system capabilities',
        default: true,
      },
    },
  },
  handler: async (input, context) => {
    const validated = systemInfoSchema.parse(input);
    return handleSystemInfo(validated, context);
  },
  category: 'system',
  tags: ['system', 'info', 'configuration'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 60000, // Cache for 1 minute (rarely changes)
};

// ============================================================================
// Exports
// ============================================================================

export const systemTools: MCPTool[] = [
  systemStatusTool,
  systemMetricsTool,
  systemHealthTool,
  systemInfoTool,
];

export default systemTools;

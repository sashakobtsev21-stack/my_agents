/**
 * V3 MCP Session Tools
 *
 * MCP tools for session management:
 * - session/save - Save current session
 * - session/restore - Restore session
 * - session/list - List available sessions
 *
 * Implements ADR-005: MCP-First API Design
 */


import { MCPTool } from '../types.js';
// Support + handlers extracted into the sub-modules below during
// campaign-2 wave 42 (W248); the public surface stays here.
import {
  saveSessionSchema,
  restoreSessionSchema,
  listSessionsSchema,
} from './session-tools-support.js';
import {
  handleSaveSession,
  handleRestoreSession,
  handleListSessions,
} from './session-tools-handlers.js';

// Tool Definitions
// ============================================================================

/**
 * session/save tool
 */
export const saveSessionTool: MCPTool = {
  name: 'session/save',
  description: 'Save current session including agents, tasks, memory, and swarm state',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Session name (auto-generated if not provided)',
        maxLength: 100,
      },
      description: {
        type: 'string',
        description: 'Session description',
        maxLength: 500,
      },
      includeAgents: {
        type: 'boolean',
        description: 'Include agent states in the session',
        default: true,
      },
      includeTasks: {
        type: 'boolean',
        description: 'Include task queue in the session',
        default: true,
      },
      includeMemory: {
        type: 'boolean',
        description: 'Include memory entries in the session',
        default: true,
      },
      includeSwarmState: {
        type: 'boolean',
        description: 'Include swarm coordination state',
        default: true,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorizing the session',
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata',
        additionalProperties: true,
      },
    },
  },
  handler: async (input, context) => {
    const validated = saveSessionSchema.parse(input);
    return handleSaveSession(validated, context);
  },
  category: 'session',
  tags: ['session', 'save', 'persistence'],
  version: '1.0.0',
};

/**
 * session/restore tool
 */
export const restoreSessionTool: MCPTool = {
  name: 'session/restore',
  description: 'Restore a previously saved session including agents, tasks, memory, and swarm state',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'ID of the session to restore',
      },
      restoreAgents: {
        type: 'boolean',
        description: 'Restore agent states',
        default: true,
      },
      restoreTasks: {
        type: 'boolean',
        description: 'Restore task queue',
        default: true,
      },
      restoreMemory: {
        type: 'boolean',
        description: 'Restore memory entries',
        default: true,
      },
      restoreSwarmState: {
        type: 'boolean',
        description: 'Restore swarm coordination state',
        default: true,
      },
      clearExisting: {
        type: 'boolean',
        description: 'Clear existing state before restore',
        default: false,
      },
    },
    required: ['sessionId'],
  },
  handler: async (input, context) => {
    const validated = restoreSessionSchema.parse(input);
    return handleRestoreSession(validated, context);
  },
  category: 'session',
  tags: ['session', 'restore', 'persistence'],
  version: '1.0.0',
};

/**
 * session/list tool
 */
export const listSessionsTool: MCPTool = {
  name: 'session/list',
  description: 'List available sessions with filtering, sorting, and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return',
        minimum: 1,
        maximum: 1000,
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        minimum: 0,
        default: 0,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags',
      },
      sortBy: {
        type: 'string',
        enum: ['created', 'name', 'size'],
        description: 'Sort order',
        default: 'created',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction',
        default: 'desc',
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include session metadata',
        default: true,
      },
    },
  },
  handler: async (input, context) => {
    const validated = listSessionsSchema.parse(input);
    return handleListSessions(validated, context);
  },
  category: 'session',
  tags: ['session', 'list', 'query'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

// ============================================================================
// Exports
// ============================================================================

export const sessionTools: MCPTool[] = [
  saveSessionTool,
  restoreSessionTool,
  listSessionsTool,
];

export default sessionTools;

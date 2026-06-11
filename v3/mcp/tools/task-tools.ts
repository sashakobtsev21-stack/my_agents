/**
 * V3 MCP Task Tools
 *
 * MCP tools for task management operations:
 * - tasks/create - Create a new task
 * - tasks/list - List tasks with filters
 * - tasks/status - Get task status
 * - tasks/cancel - Cancel running task
 * - tasks/assign - Assign task to agent
 * - tasks/update - Update task properties
 * - tasks/dependencies - Manage task dependencies
 * - tasks/results - Get task results
 *
 * Implements ADR-005: MCP-First API Design
 */


import { MCPTool } from '../types.js';
// The schemas/types and the store + handler implementations were
// extracted into ./task-tools-support.ts and ./task-tools-handlers.ts
// during the P3.61 god-file decomposition (W182). Both were
// module-private and are NOT re-exported; the public surface (the 8
// tool consts + taskTools + default) stays here.
import {
  createTaskSchema,
  listTasksSchema,
  taskStatusSchema,
  cancelTaskSchema,
  assignTaskSchema,
  updateTaskSchema,
  taskDependenciesSchema,
  taskResultsSchema,
} from './task-tools-support.js';
import {
  handleCreateTask,
  handleListTasks,
  handleTaskStatus,
  handleCancelTask,
  handleAssignTask,
  handleUpdateTask,
  handleTaskDependencies,
  handleTaskResults,
} from './task-tools-handlers.js';

// Tool Definitions
// ============================================================================

/**
 * tasks/create tool
 */
export const createTaskTool: MCPTool = {
  name: 'tasks/create',
  description: 'Create a new task for execution with specified type, priority, and configuration',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Task type (e.g., code, review, test, analyze)',
      },
      description: {
        type: 'string',
        description: 'Task description',
      },
      priority: {
        type: 'number',
        description: 'Task priority (1=highest, 10=lowest)',
        minimum: 1,
        maximum: 10,
        default: 5,
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task IDs this task depends on',
      },
      assignToAgent: {
        type: 'string',
        description: 'Specific agent ID to assign the task to',
      },
      assignToAgentType: {
        type: 'string',
        description: 'Agent type to assign the task to',
      },
      input: {
        type: 'object',
        description: 'Task input data',
        additionalProperties: true,
      },
      timeout: {
        type: 'number',
        description: 'Task timeout in milliseconds',
        minimum: 1,
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata',
        additionalProperties: true,
      },
    },
    required: ['type', 'description'],
  },
  handler: async (input, context) => {
    const validated = createTaskSchema.parse(input);
    return handleCreateTask(validated, context);
  },
  category: 'task',
  tags: ['task', 'create', 'orchestration'],
  version: '1.0.0',
};

/**
 * tasks/list tool
 */
export const listTasksTool: MCPTool = {
  name: 'tasks/list',
  description: 'List tasks with optional filtering, sorting, and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'queued', 'assigned', 'running', 'completed', 'failed', 'cancelled', 'all'],
        description: 'Filter by task status',
        default: 'all',
      },
      agentId: {
        type: 'string',
        description: 'Filter by assigned agent ID',
      },
      type: {
        type: 'string',
        description: 'Filter by task type',
      },
      priority: {
        type: 'number',
        description: 'Filter by priority',
        minimum: 1,
        maximum: 10,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tasks to return',
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
      sortBy: {
        type: 'string',
        enum: ['created', 'priority', 'status', 'updated'],
        description: 'Sort order',
        default: 'created',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction',
        default: 'desc',
      },
    },
  },
  handler: async (input, context) => {
    const validated = listTasksSchema.parse(input);
    return handleListTasks(validated, context);
  },
  category: 'task',
  tags: ['task', 'list', 'query'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 2000,
};

/**
 * tasks/status tool
 */
export const taskStatusTool: MCPTool = {
  name: 'tasks/status',
  description: 'Get detailed status of a specific task including optional metrics and history',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to get status for',
      },
      includeMetrics: {
        type: 'boolean',
        description: 'Include execution metrics',
        default: false,
      },
      includeHistory: {
        type: 'boolean',
        description: 'Include status history',
        default: false,
      },
    },
    required: ['taskId'],
  },
  handler: async (input, context) => {
    const validated = taskStatusSchema.parse(input);
    return handleTaskStatus(validated, context);
  },
  category: 'task',
  tags: ['task', 'status', 'monitoring'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 1000,
};

/**
 * tasks/cancel tool
 */
export const cancelTaskTool: MCPTool = {
  name: 'tasks/cancel',
  description: 'Cancel a pending or running task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to cancel',
      },
      reason: {
        type: 'string',
        description: 'Reason for cancellation',
      },
      force: {
        type: 'boolean',
        description: 'Force cancellation even if task is running',
        default: false,
      },
    },
    required: ['taskId'],
  },
  handler: async (input, context) => {
    const validated = cancelTaskSchema.parse(input);
    return handleCancelTask(validated, context);
  },
  category: 'task',
  tags: ['task', 'cancel', 'lifecycle'],
  version: '1.0.0',
};

/**
 * tasks/assign tool
 */
export const assignTaskTool: MCPTool = {
  name: 'tasks/assign',
  description: 'Assign a task to a specific agent',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to assign',
      },
      agentId: {
        type: 'string',
        description: 'ID of the agent to assign to',
      },
      reassign: {
        type: 'boolean',
        description: 'Allow reassignment if task is already assigned',
        default: false,
      },
    },
    required: ['taskId', 'agentId'],
  },
  handler: async (input, context) => {
    const validated = assignTaskSchema.parse(input);
    return handleAssignTask(validated, context);
  },
  category: 'task',
  tags: ['task', 'assign', 'agent'],
  version: '1.0.0',
};

/**
 * tasks/update tool
 */
export const updateTaskTool: MCPTool = {
  name: 'tasks/update',
  description: 'Update task properties like priority, description, timeout, or metadata',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to update',
      },
      priority: {
        type: 'number',
        description: 'New priority',
        minimum: 1,
        maximum: 10,
      },
      description: {
        type: 'string',
        description: 'New description',
      },
      timeout: {
        type: 'number',
        description: 'New timeout in milliseconds',
        minimum: 1,
      },
      metadata: {
        type: 'object',
        description: 'Metadata to merge',
        additionalProperties: true,
      },
    },
    required: ['taskId'],
  },
  handler: async (input, context) => {
    const validated = updateTaskSchema.parse(input);
    return handleUpdateTask(validated, context);
  },
  category: 'task',
  tags: ['task', 'update', 'modify'],
  version: '1.0.0',
};

/**
 * tasks/dependencies tool
 */
export const taskDependenciesTool: MCPTool = {
  name: 'tasks/dependencies',
  description: 'Manage task dependencies - add, remove, list, or clear',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task',
      },
      action: {
        type: 'string',
        enum: ['add', 'remove', 'list', 'clear'],
        description: 'Action to perform on dependencies',
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Dependencies to add or remove',
      },
    },
    required: ['taskId', 'action'],
  },
  handler: async (input, context) => {
    const validated = taskDependenciesSchema.parse(input);
    return handleTaskDependencies(validated, context);
  },
  category: 'task',
  tags: ['task', 'dependencies', 'dag'],
  version: '1.0.0',
};

/**
 * tasks/results tool
 */
export const taskResultsTool: MCPTool = {
  name: 'tasks/results',
  description: 'Get results from a completed task including output, errors, and artifacts',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to get results for',
      },
      format: {
        type: 'string',
        enum: ['summary', 'detailed', 'raw'],
        description: 'Result format',
        default: 'summary',
      },
      includeArtifacts: {
        type: 'boolean',
        description: 'Include generated artifacts',
        default: true,
      },
    },
    required: ['taskId'],
  },
  handler: async (input, context) => {
    const validated = taskResultsSchema.parse(input);
    return handleTaskResults(validated, context);
  },
  category: 'task',
  tags: ['task', 'results', 'output'],
  version: '1.0.0',
  cacheable: true,
  cacheTTL: 5000,
};

// ============================================================================
// Exports
// ============================================================================

export const taskTools: MCPTool[] = [
  createTaskTool,
  listTasksTool,
  taskStatusTool,
  cancelTaskTool,
  assignTaskTool,
  updateTaskTool,
  taskDependenciesTool,
  taskResultsTool,
];

export default taskTools;

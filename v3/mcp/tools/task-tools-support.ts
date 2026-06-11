/**
 * V3 MCP Task Tools — schemas & result types
 *
 * The zod input schemas and the task/result shapes. These were
 * module-private in the original task-tools.ts (P3.61, W182) and are
 * deliberately NOT re-exported by the task-tools.ts barrel — public API
 * unchanged.
 */

import { z } from 'zod';

// Input Schemas
// ============================================================================

export const createTaskSchema = z.object({
  type: z.string().min(1).describe('Task type (e.g., code, review, test, analyze)'),
  description: z.string().min(1).describe('Task description'),
  priority: z.number().int().min(1).max(10).default(5)
    .describe('Task priority (1=highest, 10=lowest)'),
  dependencies: z.array(z.string()).optional()
    .describe('Task IDs this task depends on'),
  assignToAgent: z.string().optional()
    .describe('Specific agent ID to assign the task to'),
  assignToAgentType: z.string().optional()
    .describe('Agent type to assign the task to (will pick available agent)'),
  input: z.record(z.unknown()).optional()
    .describe('Task input data'),
  timeout: z.number().int().positive().optional()
    .describe('Task timeout in milliseconds'),
  metadata: z.record(z.unknown()).optional()
    .describe('Additional metadata'),
});

export const listTasksSchema = z.object({
  status: z.enum(['pending', 'queued', 'assigned', 'running', 'completed', 'failed', 'cancelled', 'all'])
    .default('all')
    .describe('Filter by task status'),
  agentId: z.string().optional()
    .describe('Filter by assigned agent ID'),
  type: z.string().optional()
    .describe('Filter by task type'),
  priority: z.number().int().min(1).max(10).optional()
    .describe('Filter by priority'),
  limit: z.number().int().positive().max(1000).default(50)
    .describe('Maximum number of tasks to return'),
  offset: z.number().int().nonnegative().default(0)
    .describe('Offset for pagination'),
  sortBy: z.enum(['created', 'priority', 'status', 'updated']).default('created')
    .describe('Sort order'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
    .describe('Sort direction'),
});

export const taskStatusSchema = z.object({
  taskId: z.string().describe('ID of the task to get status for'),
  includeMetrics: z.boolean().default(false)
    .describe('Include execution metrics'),
  includeHistory: z.boolean().default(false)
    .describe('Include status history'),
});

export const cancelTaskSchema = z.object({
  taskId: z.string().describe('ID of the task to cancel'),
  reason: z.string().optional()
    .describe('Reason for cancellation'),
  force: z.boolean().default(false)
    .describe('Force cancellation even if task is running'),
});

export const assignTaskSchema = z.object({
  taskId: z.string().describe('ID of the task to assign'),
  agentId: z.string().describe('ID of the agent to assign to'),
  reassign: z.boolean().default(false)
    .describe('Allow reassignment if task is already assigned'),
});

export const updateTaskSchema = z.object({
  taskId: z.string().describe('ID of the task to update'),
  priority: z.number().int().min(1).max(10).optional()
    .describe('New priority'),
  description: z.string().optional()
    .describe('New description'),
  timeout: z.number().int().positive().optional()
    .describe('New timeout'),
  metadata: z.record(z.unknown()).optional()
    .describe('Metadata to merge'),
});

export const taskDependenciesSchema = z.object({
  taskId: z.string().describe('ID of the task'),
  action: z.enum(['add', 'remove', 'list', 'clear'])
    .describe('Action to perform on dependencies'),
  dependencies: z.array(z.string()).optional()
    .describe('Dependencies to add or remove'),
});

export const taskResultsSchema = z.object({
  taskId: z.string().describe('ID of the task to get results for'),
  format: z.enum(['summary', 'detailed', 'raw']).default('summary')
    .describe('Result format'),
  includeArtifacts: z.boolean().default(true)
    .describe('Include generated artifacts'),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type TaskStatus = 'pending' | 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  type: string;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  timeout?: number;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TaskWithMetrics extends Task {
  metrics?: {
    executionTime?: number;
    retryCount?: number;
    waitTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
  history?: Array<{
    timestamp: string;
    status: TaskStatus;
    message?: string;
  }>;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  success: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  artifacts?: Array<{
    name: string;
    type: string;
    path?: string;
    content?: string;
  }>;
  executionTime?: number;
  completedAt?: string;
}

export interface CreateTaskResult {
  taskId: string;
  status: TaskStatus;
  createdAt: string;
  queuePosition?: number;
}

export interface ListTasksResult {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
}

export interface CancelTaskResult {
  taskId: string;
  cancelled: boolean;
  cancelledAt: string;
  previousStatus: TaskStatus;
  reason?: string;
}

export interface AssignTaskResult {
  taskId: string;
  agentId: string;
  assigned: boolean;
  assignedAt: string;
  previousAgent?: string;
}

export interface UpdateTaskResult {
  taskId: string;
  updated: boolean;
  updatedAt: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface TaskDependenciesResult {
  taskId: string;
  action: string;
  dependencies: string[];
  updatedAt?: string;
}

// ============================================================================

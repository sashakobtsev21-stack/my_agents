/**
 * V3 MCP Task Tools — in-memory store & handlers
 *
 * The task/result Maps (module state stays co-located with its only
 * mutators) and the eight tool handler implementations. These were
 * module-private in the original task-tools.ts (P3.61, W182) and are
 * NOT re-exported by the barrel.
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { ToolContext } from '../types.js';
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
import type {
  Task,
  TaskStatus,
  TaskResult,
  CreateTaskResult,
  ListTasksResult,
  CancelTaskResult,
  AssignTaskResult,
  TaskDependenciesResult,
  TaskWithMetrics,
  UpdateTaskResult,
} from './task-tools-support.js';

// Secure ID generation helper (restored in W198 — dropped by the W182
// slice, masked by the stale committed .js artifact)
function generateSecureTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString('hex');
  return `task-${timestamp}-${random}`;
}

// In-memory task store (for simple implementation)
// ============================================================================

const taskStore = new Map<string, Task>();
const taskResults = new Map<string, TaskResult>();

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Create a new task
 */
export async function handleCreateTask(
  input: z.infer<typeof createTaskSchema>,
  context?: ToolContext
): Promise<CreateTaskResult> {
  const taskId = generateSecureTaskId();
  const createdAt = new Date().toISOString();

  const task: Task = {
    id: taskId,
    type: input.type,
    description: input.description,
    status: 'pending',
    priority: input.priority,
    dependencies: input.dependencies || [],
    assignedTo: input.assignToAgent,
    createdAt,
    timeout: input.timeout,
    input: input.input,
    metadata: input.metadata,
  };

  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      // Submit task to orchestrator
      const result = await orchestrator.submitTask({
        id: taskId,
        type: input.type,
        description: input.description,
        priority: input.priority,
        dependencies: input.dependencies,
        assignedAgent: input.assignToAgent,
        input: input.input,
        timeout: input.timeout,
        metadata: input.metadata,
      });

      return {
        taskId: result.id || taskId,
        status: result.status || 'queued',
        createdAt,
        queuePosition: result.queuePosition,
      };
    } catch (error) {
      console.error('Failed to create task via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  if (task.assignedTo) {
    task.status = 'assigned';
  }

  taskStore.set(taskId, task);

  return {
    taskId,
    status: task.status,
    createdAt,
    queuePosition: taskStore.size,
  };
}

/**
 * List tasks with filters
 */
export async function handleListTasks(
  input: z.infer<typeof listTasksSchema>,
  context?: ToolContext
): Promise<ListTasksResult> {
  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.listTasks({
        status: input.status === 'all' ? undefined : input.status,
        agentId: input.agentId,
        type: input.type,
        priority: input.priority,
        limit: input.limit,
        offset: input.offset,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      });

      return {
        tasks: result.tasks.map((t: any) => ({
          id: t.id,
          type: t.type,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dependencies: t.dependencies || [],
          assignedTo: t.assignedAgent,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          timeout: t.timeout,
          input: t.input,
          metadata: t.metadata,
        })),
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      };
    } catch (error) {
      console.error('Failed to list tasks via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  let tasks = Array.from(taskStore.values());

  // Apply filters
  if (input.status !== 'all') {
    tasks = tasks.filter(t => t.status === input.status);
  }
  if (input.agentId) {
    tasks = tasks.filter(t => t.assignedTo === input.agentId);
  }
  if (input.type) {
    tasks = tasks.filter(t => t.type === input.type);
  }
  if (input.priority !== undefined) {
    tasks = tasks.filter(t => t.priority === input.priority);
  }

  // Apply sorting
  tasks.sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (input.sortBy) {
      case 'created':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'priority':
        aVal = a.priority;
        bVal = b.priority;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'updated':
        aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
        bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
        break;
      default:
        aVal = 0;
        bVal = 0;
    }

    if (input.sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  const total = tasks.length;
  const paginated = tasks.slice(input.offset, input.offset + input.limit);

  return {
    tasks: paginated,
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * Get task status
 */
export async function handleTaskStatus(
  input: z.infer<typeof taskStatusSchema>,
  context?: ToolContext
): Promise<TaskWithMetrics> {
  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.getTaskStatus(input.taskId, {
        includeMetrics: input.includeMetrics,
        includeHistory: input.includeHistory,
      });

      const task: TaskWithMetrics = {
        id: result.id,
        type: result.type,
        description: result.description,
        status: result.status,
        priority: result.priority,
        dependencies: result.dependencies || [],
        assignedTo: result.assignedAgent,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        timeout: result.timeout,
        input: result.input,
        metadata: result.metadata,
      };

      if (input.includeMetrics && result.metrics) {
        task.metrics = result.metrics;
      }

      if (input.includeHistory && result.history) {
        task.history = result.history;
      }

      return task;
    } catch (error) {
      console.error('Failed to get task status via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const result: TaskWithMetrics = { ...task };

  if (input.includeMetrics) {
    result.metrics = {
      executionTime: 0,
      retryCount: 0,
      waitTime: 0,
    };
  }

  if (input.includeHistory) {
    result.history = [
      {
        timestamp: task.createdAt,
        status: 'pending',
        message: 'Task created',
      },
    ];
    if (task.status !== 'pending') {
      result.history.push({
        timestamp: task.updatedAt || task.createdAt,
        status: task.status,
        message: `Status changed to ${task.status}`,
      });
    }
  }

  return result;
}

/**
 * Cancel a task
 */
export async function handleCancelTask(
  input: z.infer<typeof cancelTaskSchema>,
  context?: ToolContext
): Promise<CancelTaskResult> {
  const cancelledAt = new Date().toISOString();

  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.cancelTask(input.taskId, {
        reason: input.reason,
        force: input.force,
      });

      return {
        taskId: input.taskId,
        cancelled: result.cancelled,
        cancelledAt,
        previousStatus: result.previousStatus,
        reason: input.reason,
      };
    } catch (error) {
      console.error('Failed to cancel task via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const previousStatus = task.status;

  // Check if task can be cancelled
  if (task.status === 'completed' || task.status === 'cancelled') {
    return {
      taskId: input.taskId,
      cancelled: false,
      cancelledAt,
      previousStatus,
      reason: `Task is already ${task.status}`,
    };
  }

  if (task.status === 'running' && !input.force) {
    return {
      taskId: input.taskId,
      cancelled: false,
      cancelledAt,
      previousStatus,
      reason: 'Task is running. Use force=true to cancel.',
    };
  }

  // Cancel the task
  task.status = 'cancelled';
  task.updatedAt = cancelledAt;
  task.completedAt = cancelledAt;
  if (input.reason) {
    task.metadata = { ...task.metadata, cancelReason: input.reason };
  }

  return {
    taskId: input.taskId,
    cancelled: true,
    cancelledAt,
    previousStatus,
    reason: input.reason,
  };
}

/**
 * Assign a task to an agent
 */
export async function handleAssignTask(
  input: z.infer<typeof assignTaskSchema>,
  context?: ToolContext
): Promise<AssignTaskResult> {
  const assignedAt = new Date().toISOString();

  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.assignTask(input.taskId, input.agentId, {
        reassign: input.reassign,
      });

      return {
        taskId: input.taskId,
        agentId: input.agentId,
        assigned: result.assigned,
        assignedAt,
        previousAgent: result.previousAgent,
      };
    } catch (error) {
      console.error('Failed to assign task via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const previousAgent = task.assignedTo;

  // Check if task can be assigned
  if (task.assignedTo && !input.reassign) {
    return {
      taskId: input.taskId,
      agentId: input.agentId,
      assigned: false,
      assignedAt,
      previousAgent,
    };
  }

  if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed') {
    throw new Error(`Cannot assign task with status: ${task.status}`);
  }

  // Assign the task
  task.assignedTo = input.agentId;
  task.status = 'assigned';
  task.updatedAt = assignedAt;

  return {
    taskId: input.taskId,
    agentId: input.agentId,
    assigned: true,
    assignedAt,
    previousAgent,
  };
}

/**
 * Update task properties
 */
export async function handleUpdateTask(
  input: z.infer<typeof updateTaskSchema>,
  context?: ToolContext
): Promise<UpdateTaskResult> {
  const updatedAt = new Date().toISOString();
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.updateTask(input.taskId, {
        priority: input.priority,
        description: input.description,
        timeout: input.timeout,
        metadata: input.metadata,
      });

      return {
        taskId: input.taskId,
        updated: result.updated,
        updatedAt,
        changes: result.changes || {},
      };
    } catch (error) {
      console.error('Failed to update task via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  // Check if task can be updated
  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error(`Cannot update task with status: ${task.status}`);
  }

  // Apply updates
  if (input.priority !== undefined && input.priority !== task.priority) {
    changes.priority = { from: task.priority, to: input.priority };
    task.priority = input.priority;
  }

  if (input.description !== undefined && input.description !== task.description) {
    changes.description = { from: task.description, to: input.description };
    task.description = input.description;
  }

  if (input.timeout !== undefined && input.timeout !== task.timeout) {
    changes.timeout = { from: task.timeout, to: input.timeout };
    task.timeout = input.timeout;
  }

  if (input.metadata) {
    changes.metadata = { from: task.metadata, to: { ...task.metadata, ...input.metadata } };
    task.metadata = { ...task.metadata, ...input.metadata };
  }

  task.updatedAt = updatedAt;

  return {
    taskId: input.taskId,
    updated: Object.keys(changes).length > 0,
    updatedAt,
    changes,
  };
}

/**
 * Manage task dependencies
 */
export async function handleTaskDependencies(
  input: z.infer<typeof taskDependenciesSchema>,
  context?: ToolContext
): Promise<TaskDependenciesResult> {
  const updatedAt = new Date().toISOString();

  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      let result;
      switch (input.action) {
        case 'add':
          result = await orchestrator.addTaskDependencies(input.taskId, input.dependencies || []);
          break;
        case 'remove':
          result = await orchestrator.removeTaskDependencies(input.taskId, input.dependencies || []);
          break;
        case 'list':
          result = await orchestrator.getTaskDependencies(input.taskId);
          break;
        case 'clear':
          result = await orchestrator.clearTaskDependencies(input.taskId);
          break;
      }

      return {
        taskId: input.taskId,
        action: input.action,
        dependencies: result?.dependencies || [],
        updatedAt: input.action !== 'list' ? updatedAt : undefined,
      };
    } catch (error) {
      console.error('Failed to manage task dependencies via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  switch (input.action) {
    case 'add':
      if (input.dependencies) {
        task.dependencies = Array.from(new Set([...task.dependencies, ...input.dependencies]));
        task.updatedAt = updatedAt;
      }
      break;
    case 'remove':
      if (input.dependencies) {
        task.dependencies = task.dependencies.filter(d => !input.dependencies!.includes(d));
        task.updatedAt = updatedAt;
      }
      break;
    case 'list':
      // No changes needed
      break;
    case 'clear':
      task.dependencies = [];
      task.updatedAt = updatedAt;
      break;
  }

  return {
    taskId: input.taskId,
    action: input.action,
    dependencies: task.dependencies,
    updatedAt: input.action !== 'list' ? updatedAt : undefined,
  };
}

/**
 * Get task results
 */
export async function handleTaskResults(
  input: z.infer<typeof taskResultsSchema>,
  context?: ToolContext
): Promise<TaskResult> {
  // Try to use orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;

      const result = await orchestrator.getTaskResults(input.taskId, {
        format: input.format,
        includeArtifacts: input.includeArtifacts,
      });

      return {
        taskId: input.taskId,
        status: result.status,
        success: result.success,
        output: result.output,
        error: result.error,
        artifacts: input.includeArtifacts ? result.artifacts : undefined,
        executionTime: result.executionTime,
        completedAt: result.completedAt,
      };
    } catch (error) {
      console.error('Failed to get task results via orchestrator:', error);
      // Fall through to simple implementation
    }
  }

  // Simple implementation
  const task = taskStore.get(input.taskId);
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  // Check if task has results
  const result = taskResults.get(input.taskId);
  if (result) {
    return {
      ...result,
      artifacts: input.includeArtifacts ? result.artifacts : undefined,
    };
  }

  // Task exists but no results yet
  return {
    taskId: input.taskId,
    status: task.status,
    success: task.status === 'completed',
    output: undefined,
    error: task.status === 'failed' ? {
      code: 'TASK_FAILED',
      message: 'Task failed to complete',
    } : undefined,
    completedAt: task.completedAt,
  };
}

// ============================================================================

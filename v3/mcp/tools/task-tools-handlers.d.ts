/**
 * V3 MCP Task Tools — in-memory store & handlers
 *
 * The task/result Maps (module state stays co-located with its only
 * mutators) and the eight tool handler implementations. These were
 * module-private in the original task-tools.ts (P3.61, W182) and are
 * NOT re-exported by the barrel.
 */
import { z } from 'zod';
import type { ToolContext } from '../types.js';
import { createTaskSchema, listTasksSchema, taskStatusSchema, cancelTaskSchema, assignTaskSchema, updateTaskSchema, taskDependenciesSchema, taskResultsSchema } from './task-tools-support.js';
import type { TaskResult, CreateTaskResult, ListTasksResult, CancelTaskResult, AssignTaskResult, TaskDependenciesResult, TaskWithMetrics, UpdateTaskResult } from './task-tools-support.js';
/**
 * Create a new task
 */
export declare function handleCreateTask(input: z.infer<typeof createTaskSchema>, context?: ToolContext): Promise<CreateTaskResult>;
/**
 * List tasks with filters
 */
export declare function handleListTasks(input: z.infer<typeof listTasksSchema>, context?: ToolContext): Promise<ListTasksResult>;
/**
 * Get task status
 */
export declare function handleTaskStatus(input: z.infer<typeof taskStatusSchema>, context?: ToolContext): Promise<TaskWithMetrics>;
/**
 * Cancel a task
 */
export declare function handleCancelTask(input: z.infer<typeof cancelTaskSchema>, context?: ToolContext): Promise<CancelTaskResult>;
/**
 * Assign a task to an agent
 */
export declare function handleAssignTask(input: z.infer<typeof assignTaskSchema>, context?: ToolContext): Promise<AssignTaskResult>;
/**
 * Update task properties
 */
export declare function handleUpdateTask(input: z.infer<typeof updateTaskSchema>, context?: ToolContext): Promise<UpdateTaskResult>;
/**
 * Manage task dependencies
 */
export declare function handleTaskDependencies(input: z.infer<typeof taskDependenciesSchema>, context?: ToolContext): Promise<TaskDependenciesResult>;
/**
 * Get task results
 */
export declare function handleTaskResults(input: z.infer<typeof taskResultsSchema>, context?: ToolContext): Promise<TaskResult>;

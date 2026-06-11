/**
 * V3 MCP Task Tools — schemas & result types
 *
 * The zod input schemas and the task/result shapes. These were
 * module-private in the original task-tools.ts (P3.61, W182) and are
 * deliberately NOT re-exported by the task-tools.ts barrel — public API
 * unchanged.
 */
import { z } from 'zod';
export declare const createTaskSchema: z.ZodObject<{
    type: z.ZodString;
    description: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignToAgent: z.ZodOptional<z.ZodString>;
    assignToAgentType: z.ZodOptional<z.ZodString>;
    input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timeout: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    description: string;
    priority: number;
    metadata?: Record<string, unknown> | undefined;
    dependencies?: string[] | undefined;
    assignToAgent?: string | undefined;
    assignToAgentType?: string | undefined;
    input?: Record<string, unknown> | undefined;
    timeout?: number | undefined;
}, {
    type: string;
    description: string;
    metadata?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    dependencies?: string[] | undefined;
    assignToAgent?: string | undefined;
    assignToAgentType?: string | undefined;
    input?: Record<string, unknown> | undefined;
    timeout?: number | undefined;
}>;
export declare const listTasksSchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<["pending", "queued", "assigned", "running", "completed", "failed", "cancelled", "all"]>>;
    agentId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["created", "priority", "status", "updated"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    status: "all" | "pending" | "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled";
    limit: number;
    offset: number;
    sortBy: "created" | "status" | "priority" | "updated";
    sortOrder: "asc" | "desc";
    type?: string | undefined;
    priority?: number | undefined;
    agentId?: string | undefined;
}, {
    type?: string | undefined;
    status?: "all" | "pending" | "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled" | undefined;
    priority?: number | undefined;
    agentId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    sortBy?: "created" | "status" | "priority" | "updated" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const taskStatusSchema: z.ZodObject<{
    taskId: z.ZodString;
    includeMetrics: z.ZodDefault<z.ZodBoolean>;
    includeHistory: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    includeMetrics: boolean;
    includeHistory: boolean;
}, {
    taskId: string;
    includeMetrics?: boolean | undefined;
    includeHistory?: boolean | undefined;
}>;
export declare const cancelTaskSchema: z.ZodObject<{
    taskId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    force: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    force: boolean;
    taskId: string;
    reason?: string | undefined;
}, {
    taskId: string;
    reason?: string | undefined;
    force?: boolean | undefined;
}>;
export declare const assignTaskSchema: z.ZodObject<{
    taskId: z.ZodString;
    agentId: z.ZodString;
    reassign: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    taskId: string;
    reassign: boolean;
}, {
    agentId: string;
    taskId: string;
    reassign?: boolean | undefined;
}>;
export declare const updateTaskSchema: z.ZodObject<{
    taskId: z.ZodString;
    priority: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    metadata?: Record<string, unknown> | undefined;
    description?: string | undefined;
    priority?: number | undefined;
    timeout?: number | undefined;
}, {
    taskId: string;
    metadata?: Record<string, unknown> | undefined;
    description?: string | undefined;
    priority?: number | undefined;
    timeout?: number | undefined;
}>;
export declare const taskDependenciesSchema: z.ZodObject<{
    taskId: z.ZodString;
    action: z.ZodEnum<["add", "remove", "list", "clear"]>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    action: "remove" | "list" | "add" | "clear";
    dependencies?: string[] | undefined;
}, {
    taskId: string;
    action: "remove" | "list" | "add" | "clear";
    dependencies?: string[] | undefined;
}>;
export declare const taskResultsSchema: z.ZodObject<{
    taskId: z.ZodString;
    format: z.ZodDefault<z.ZodEnum<["summary", "detailed", "raw"]>>;
    includeArtifacts: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    format: "summary" | "detailed" | "raw";
    taskId: string;
    includeArtifacts: boolean;
}, {
    taskId: string;
    format?: "summary" | "detailed" | "raw" | undefined;
    includeArtifacts?: boolean | undefined;
}>;
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
    changes: Record<string, {
        from: unknown;
        to: unknown;
    }>;
}
export interface TaskDependenciesResult {
    taskId: string;
    action: string;
    dependencies: string[];
    updatedAt?: string;
}

/**
 * V3 MCP Hooks Tools — schemas, result types & helpers
 *
 * The zod input schemas, handler result shapes, and the embedding/
 * trajectory/agent-inference helpers. These were module-private in the
 * original hooks-tools.ts (P3.60, W181) and are deliberately NOT
 * re-exported by the hooks-tools.ts barrel — public API unchanged.
 */
import { z } from 'zod';
import type { Trajectory } from '../../@claude-flow/neural/src/index.js';
export declare const preEditSchema: z.ZodObject<{
    filePath: z.ZodString;
    operation: z.ZodDefault<z.ZodEnum<["create", "modify", "delete"]>>;
    includeContext: z.ZodDefault<z.ZodBoolean>;
    includeSuggestions: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    operation: "create" | "modify" | "delete";
    includeContext: boolean;
    includeSuggestions: boolean;
}, {
    filePath: string;
    operation?: "create" | "modify" | "delete" | undefined;
    includeContext?: boolean | undefined;
    includeSuggestions?: boolean | undefined;
}>;
export declare const postEditSchema: z.ZodObject<{
    filePath: z.ZodString;
    operation: z.ZodDefault<z.ZodEnum<["create", "modify", "delete"]>>;
    success: z.ZodBoolean;
    outcome: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    filePath: string;
    operation: "create" | "modify" | "delete";
    outcome?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    success: boolean;
    filePath: string;
    operation?: "create" | "modify" | "delete" | undefined;
    outcome?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const preCommandSchema: z.ZodObject<{
    command: z.ZodString;
    workingDirectory: z.ZodOptional<z.ZodString>;
    includeRiskAssessment: z.ZodDefault<z.ZodBoolean>;
    includeSuggestions: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeSuggestions: boolean;
    command: string;
    includeRiskAssessment: boolean;
    workingDirectory?: string | undefined;
}, {
    command: string;
    includeSuggestions?: boolean | undefined;
    workingDirectory?: string | undefined;
    includeRiskAssessment?: boolean | undefined;
}>;
export declare const postCommandSchema: z.ZodObject<{
    command: z.ZodString;
    exitCode: z.ZodDefault<z.ZodNumber>;
    success: z.ZodBoolean;
    output: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    executionTime: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    command: string;
    exitCode: number;
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    output?: string | undefined;
    executionTime?: number | undefined;
}, {
    success: boolean;
    command: string;
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    exitCode?: number | undefined;
    output?: string | undefined;
    executionTime?: number | undefined;
}>;
export declare const routeSchema: z.ZodObject<{
    task: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    preferredAgents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    constraints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    includeExplanation: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    task: string;
    includeExplanation: boolean;
    context?: string | undefined;
    preferredAgents?: string[] | undefined;
    constraints?: Record<string, unknown> | undefined;
}, {
    task: string;
    context?: string | undefined;
    preferredAgents?: string[] | undefined;
    constraints?: Record<string, unknown> | undefined;
    includeExplanation?: boolean | undefined;
}>;
export declare const explainSchema: z.ZodObject<{
    task: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    verbose: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    task: string;
    verbose: boolean;
    context?: string | undefined;
}, {
    task: string;
    context?: string | undefined;
    verbose?: boolean | undefined;
}>;
export declare const pretrainSchema: z.ZodObject<{
    repositoryPath: z.ZodOptional<z.ZodString>;
    includeGitHistory: z.ZodDefault<z.ZodBoolean>;
    includeDependencies: z.ZodDefault<z.ZodBoolean>;
    maxPatterns: z.ZodDefault<z.ZodNumber>;
    force: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxPatterns: number;
    includeGitHistory: boolean;
    includeDependencies: boolean;
    force: boolean;
    repositoryPath?: string | undefined;
}, {
    maxPatterns?: number | undefined;
    repositoryPath?: string | undefined;
    includeGitHistory?: boolean | undefined;
    includeDependencies?: boolean | undefined;
    force?: boolean | undefined;
}>;
export declare const metricsSchema: z.ZodObject<{
    category: z.ZodDefault<z.ZodEnum<["all", "routing", "edits", "commands", "patterns"]>>;
    timeRange: z.ZodDefault<z.ZodEnum<["hour", "day", "week", "month", "all"]>>;
    includeDetailedStats: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<["json", "summary"]>>;
}, "strip", z.ZodTypeAny, {
    category: "patterns" | "all" | "routing" | "edits" | "commands";
    timeRange: "all" | "hour" | "day" | "week" | "month";
    includeDetailedStats: boolean;
    format: "json" | "summary";
}, {
    category?: "patterns" | "all" | "routing" | "edits" | "commands" | undefined;
    timeRange?: "all" | "hour" | "day" | "week" | "month" | undefined;
    includeDetailedStats?: boolean | undefined;
    format?: "json" | "summary" | undefined;
}>;
export declare const listHooksSchema: z.ZodObject<{
    category: z.ZodDefault<z.ZodEnum<["all", "pre-edit", "post-edit", "pre-command", "post-command", "routing"]>>;
    includeDisabled: z.ZodDefault<z.ZodBoolean>;
    includeMetadata: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    category: "all" | "routing" | "pre-edit" | "post-edit" | "pre-command" | "post-command";
    includeDisabled: boolean;
    includeMetadata: boolean;
}, {
    category?: "all" | "routing" | "pre-edit" | "post-edit" | "pre-command" | "post-command" | undefined;
    includeDisabled?: boolean | undefined;
    includeMetadata?: boolean | undefined;
}>;
export interface PreEditResult {
    filePath: string;
    operation: string;
    context?: {
        fileExists: boolean;
        fileType?: string;
        relatedFiles?: string[];
        similarPatterns?: Array<{
            pattern: string;
            confidence: number;
            description: string;
        }>;
    };
    suggestions?: Array<{
        agent: string;
        suggestion: string;
        confidence: number;
        rationale: string;
    }>;
    warnings?: string[];
}
export interface PostEditResult {
    filePath: string;
    operation: string;
    success: boolean;
    recorded: boolean;
    recordedAt: string;
    patternId?: string;
}
export interface PreCommandResult {
    command: string;
    riskAssessment?: {
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        concerns: string[];
        recommendations: string[];
    };
    suggestions?: Array<{
        type: 'safety' | 'performance' | 'alternative';
        suggestion: string;
        rationale: string;
    }>;
    shouldProceed: boolean;
    warnings?: string[];
}
export interface PostCommandResult {
    command: string;
    success: boolean;
    recorded: boolean;
    recordedAt: string;
    patternId?: string;
    executionTime?: number;
}
export interface RouteResult {
    task: string;
    recommendedAgent: string;
    confidence: number;
    alternativeAgents?: Array<{
        agent: string;
        confidence: number;
    }>;
    explanation?: string;
    reasoning?: {
        factors: Array<{
            factor: string;
            weight: number;
            value: number;
        }>;
        historicalPerformance?: {
            agent: string;
            successRate: number;
            avgQuality: number;
            tasksSimilar: number;
        }[];
    };
}
export interface ExplainResult {
    task: string;
    recommendedAgent: string;
    explanation: string;
    reasoning: {
        primaryFactors: string[];
        historicalData: {
            similarTasksCount: number;
            avgSuccessRate: number;
            topPerformingAgents: Array<{
                agent: string;
                performance: number;
            }>;
        };
        patternMatching: {
            matchedPatterns: number;
            relevantPatterns: Array<{
                pattern: string;
                relevance: number;
            }>;
        };
    };
    alternatives?: Array<{
        agent: string;
        whyNotBest: string;
    }>;
}
export interface PretrainResult {
    success: boolean;
    repositoryPath: string;
    statistics: {
        filesAnalyzed: number;
        patternsExtracted: number;
        commitsAnalyzed?: number;
        dependenciesAnalyzed?: number;
        executionTime: number;
    };
    patterns: {
        byCategory: Record<string, number>;
        byAgent: Record<string, number>;
    };
    recommendations: string[];
}
export interface MetricsResult {
    category: string;
    timeRange: string;
    summary: {
        totalOperations: number;
        successRate: number;
        avgQuality: number;
        patternsLearned: number;
    };
    routing?: {
        totalRoutes: number;
        avgConfidence: number;
        topAgents: Array<{
            agent: string;
            count: number;
            successRate: number;
        }>;
    };
    edits?: {
        totalEdits: number;
        successRate: number;
        commonPatterns: string[];
    };
    commands?: {
        totalCommands: number;
        successRate: number;
        avgExecutionTime: number;
        commonCommands: string[];
    };
    detailedStats?: Record<string, unknown>;
}
export interface HookInfo {
    name: string;
    category: string;
    enabled: boolean;
    priority: number;
    executionCount: number;
    lastExecuted?: string;
    metadata?: Record<string, unknown>;
}
export interface ListHooksResult {
    hooks: HookInfo[];
    total: number;
    byCategory: Record<string, number>;
}
/**
 * Generate hash-based embedding from text.
 * For ML embeddings, use: import('agentic-flow').computeEmbedding
 */
export declare function generateSimpleEmbedding(text: string, dim?: number): Float32Array;
/**
 * Create a trajectory from an operation
 */
export declare function createTrajectory(context: string, domain: 'code' | 'creative' | 'reasoning' | 'chat' | 'math' | 'general', action: string, reward: number): Trajectory;
/**
 * Infer agent type from task description
 */
export declare function inferAgentFromTask(task: string): {
    agent: string;
    confidence: number;
};

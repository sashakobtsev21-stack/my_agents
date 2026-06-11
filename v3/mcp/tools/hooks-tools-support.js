/**
 * V3 MCP Hooks Tools — schemas, result types & helpers
 *
 * The zod input schemas, handler result shapes, and the embedding/
 * trajectory/agent-inference helpers. These were module-private in the
 * original hooks-tools.ts (P3.60, W181) and are deliberately NOT
 * re-exported by the hooks-tools.ts barrel — public API unchanged.
 */
import { z } from 'zod';
// Input Schemas
// ============================================================================
export const preEditSchema = z.object({
    filePath: z.string().describe('Absolute path to the file being edited'),
    operation: z.enum(['create', 'modify', 'delete']).default('modify').describe('Type of edit operation'),
    includeContext: z.boolean().default(true).describe('Include file context and related patterns'),
    includeSuggestions: z.boolean().default(true).describe('Include agent suggestions'),
});
export const postEditSchema = z.object({
    filePath: z.string().describe('Absolute path to the file that was edited'),
    operation: z.enum(['create', 'modify', 'delete']).default('modify').describe('Type of edit operation'),
    success: z.boolean().describe('Whether the edit was successful'),
    outcome: z.string().optional().describe('Description of the outcome'),
    metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
});
export const preCommandSchema = z.object({
    command: z.string().describe('Command to be executed'),
    workingDirectory: z.string().optional().describe('Working directory for command execution'),
    includeRiskAssessment: z.boolean().default(true).describe('Include risk assessment'),
    includeSuggestions: z.boolean().default(true).describe('Include safety suggestions'),
});
export const postCommandSchema = z.object({
    command: z.string().describe('Command that was executed'),
    exitCode: z.number().int().default(0).describe('Command exit code'),
    success: z.boolean().describe('Whether the command was successful'),
    output: z.string().optional().describe('Command output'),
    error: z.string().optional().describe('Error message if failed'),
    executionTime: z.number().positive().optional().describe('Execution time in milliseconds'),
    metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
});
export const routeSchema = z.object({
    task: z.string().describe('Task description to route'),
    context: z.string().optional().describe('Additional context about the task'),
    preferredAgents: z.array(z.string()).optional().describe('List of preferred agent types'),
    constraints: z.record(z.unknown()).optional().describe('Routing constraints'),
    includeExplanation: z.boolean().default(true).describe('Include routing explanation'),
});
export const explainSchema = z.object({
    task: z.string().describe('Task description to explain routing for'),
    context: z.string().optional().describe('Additional context about the task'),
    verbose: z.boolean().default(false).describe('Include detailed reasoning'),
});
export const pretrainSchema = z.object({
    repositoryPath: z.string().optional().describe('Path to repository (defaults to current)'),
    includeGitHistory: z.boolean().default(true).describe('Include git history in analysis'),
    includeDependencies: z.boolean().default(true).describe('Analyze dependencies'),
    maxPatterns: z.number().int().positive().max(10000).default(1000)
        .describe('Maximum number of patterns to extract'),
    force: z.boolean().default(false).describe('Force retraining even if data exists'),
});
export const metricsSchema = z.object({
    category: z.enum(['all', 'routing', 'edits', 'commands', 'patterns']).default('all')
        .describe('Category of metrics to retrieve'),
    timeRange: z.enum(['hour', 'day', 'week', 'month', 'all']).default('all')
        .describe('Time range for metrics'),
    includeDetailedStats: z.boolean().default(false).describe('Include detailed statistics'),
    format: z.enum(['json', 'summary']).default('summary').describe('Output format'),
});
export const listHooksSchema = z.object({
    category: z.enum(['all', 'pre-edit', 'post-edit', 'pre-command', 'post-command', 'routing']).default('all')
        .describe('Filter hooks by category'),
    includeDisabled: z.boolean().default(false).describe('Include disabled hooks'),
    includeMetadata: z.boolean().default(true).describe('Include hook metadata'),
});
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Generate hash-based embedding from text.
 * For ML embeddings, use: import('agentic-flow').computeEmbedding
 */
export function generateSimpleEmbedding(text, dim = 768) {
    const embedding = new Float32Array(dim);
    const textLower = text.toLowerCase();
    // Simple hash-based embedding for demo
    for (let i = 0; i < dim; i++) {
        let hash = 0;
        for (let j = 0; j < textLower.length; j++) {
            hash = ((hash << 5) - hash + textLower.charCodeAt(j) + i) | 0;
        }
        embedding[i] = Math.sin(hash) * 0.5 + 0.5;
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) {
        norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < dim; i++) {
            embedding[i] /= norm;
        }
    }
    return embedding;
}
/**
 * Create a trajectory from an operation
 */
export function createTrajectory(context, domain, action, reward) {
    const embedding = generateSimpleEmbedding(context);
    const step = {
        stepId: `step_${Date.now()}`,
        timestamp: Date.now(),
        action,
        stateBefore: embedding,
        stateAfter: embedding,
        reward,
    };
    return {
        trajectoryId: `traj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        context,
        domain,
        steps: [step],
        qualityScore: reward,
        isComplete: true,
        startTime: Date.now(),
        endTime: Date.now(),
    };
}
/**
 * Infer agent type from task description
 */
export function inferAgentFromTask(task) {
    const taskLower = task.toLowerCase();
    const agentPatterns = [
        {
            patterns: [/test/, /spec/, /assert/, /mock/],
            agent: 'tester',
            baseConfidence: 0.9,
        },
        {
            patterns: [/review/, /refactor/, /clean/, /improve/],
            agent: 'reviewer',
            baseConfidence: 0.85,
        },
        {
            patterns: [/research/, /analyze/, /investigate/, /study/],
            agent: 'researcher',
            baseConfidence: 0.88,
        },
        {
            patterns: [/plan/, /design/, /architect/, /structure/],
            agent: 'planner',
            baseConfidence: 0.82,
        },
        {
            patterns: [/security/, /audit/, /vulnerab/, /cve/],
            agent: 'security-auditor',
            baseConfidence: 0.95,
        },
        {
            patterns: [/implement/, /code/, /develop/, /build/, /create/],
            agent: 'coder',
            baseConfidence: 0.85,
        },
        {
            patterns: [/document/, /readme/, /comment/, /explain/],
            agent: 'documenter',
            baseConfidence: 0.8,
        },
        {
            patterns: [/debug/, /fix/, /error/, /bug/],
            agent: 'debugger',
            baseConfidence: 0.88,
        },
    ];
    for (const { patterns, agent, baseConfidence } of agentPatterns) {
        for (const pattern of patterns) {
            if (pattern.test(taskLower)) {
                return { agent, confidence: baseConfidence };
            }
        }
    }
    return { agent: 'coder', confidence: 0.7 };
}
// ============================================================================

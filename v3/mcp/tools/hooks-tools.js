/**
 * V3 MCP Hooks Tools
 *
 * MCP tools for hooks system operations:
 * - hooks/pre-edit - Pre-edit hook with context and suggestions
 * - hooks/post-edit - Post-edit hook for learning
 * - hooks/pre-command - Pre-command hook for risk assessment
 * - hooks/post-command - Post-command hook for recording
 * - hooks/route - Route task to optimal agent
 * - hooks/explain - Explain routing decision
 * - hooks/pretrain - Bootstrap intelligence
 * - hooks/metrics - Get learning metrics
 * - hooks/list - List registered hooks
 *
 * Implements ADR-005: MCP-First API Design
 * Integrates with ReasoningBank for self-learning capabilities
 */
// The schemas/types/helpers and the singleton + handler implementations
// were extracted into ./hooks-tools-support.ts and
// ./hooks-tools-handlers.ts during the P3.60 god-file decomposition
// (W181). Both were module-private and are NOT re-exported; the public
// surface (the 9 tool consts + hooksTools + default) stays here.
import { preEditSchema, postEditSchema, preCommandSchema, postCommandSchema, routeSchema, explainSchema, pretrainSchema, metricsSchema, listHooksSchema, } from './hooks-tools-support.js';
import { handlePreEdit, handlePostEdit, handlePreCommand, handlePostCommand, handleRoute, handleExplain, handlePretrain, handleMetrics, handleListHooks, } from './hooks-tools-handlers.js';
// Tool Definitions
// ============================================================================
/**
 * hooks/pre-edit tool
 */
export const preEditTool = {
    name: 'hooks/pre-edit',
    description: 'Pre-edit hook that provides context, suggestions, and warnings before file edits. Uses ReasoningBank for pattern retrieval.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute path to the file being edited',
            },
            operation: {
                type: 'string',
                enum: ['create', 'modify', 'delete'],
                description: 'Type of edit operation',
                default: 'modify',
            },
            includeContext: {
                type: 'boolean',
                description: 'Include file context and related patterns',
                default: true,
            },
            includeSuggestions: {
                type: 'boolean',
                description: 'Include agent suggestions',
                default: true,
            },
        },
        required: ['filePath'],
    },
    handler: async (input, context) => {
        const validated = preEditSchema.parse(input);
        return handlePreEdit(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'pre-edit', 'learning', 'reasoningbank'],
    version: '1.0.0',
};
/**
 * hooks/post-edit tool
 */
export const postEditTool = {
    name: 'hooks/post-edit',
    description: 'Post-edit hook that records outcomes and learns from edit operations. Stores trajectories in ReasoningBank.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute path to the file that was edited',
            },
            operation: {
                type: 'string',
                enum: ['create', 'modify', 'delete'],
                description: 'Type of edit operation',
                default: 'modify',
            },
            success: {
                type: 'boolean',
                description: 'Whether the edit was successful',
            },
            outcome: {
                type: 'string',
                description: 'Description of the outcome',
            },
            metadata: {
                type: 'object',
                description: 'Additional metadata',
                additionalProperties: true,
            },
        },
        required: ['filePath', 'success'],
    },
    handler: async (input, context) => {
        const validated = postEditSchema.parse(input);
        return handlePostEdit(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'post-edit', 'learning', 'reasoningbank'],
    version: '1.0.0',
};
/**
 * hooks/pre-command tool
 */
export const preCommandTool = {
    name: 'hooks/pre-command',
    description: 'Pre-command hook that assesses risk and provides safety suggestions before command execution',
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Command to be executed',
            },
            workingDirectory: {
                type: 'string',
                description: 'Working directory for command execution',
            },
            includeRiskAssessment: {
                type: 'boolean',
                description: 'Include risk assessment',
                default: true,
            },
            includeSuggestions: {
                type: 'boolean',
                description: 'Include safety suggestions',
                default: true,
            },
        },
        required: ['command'],
    },
    handler: async (input, context) => {
        const validated = preCommandSchema.parse(input);
        return handlePreCommand(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'pre-command', 'safety', 'risk-assessment'],
    version: '1.0.0',
};
/**
 * hooks/post-command tool
 */
export const postCommandTool = {
    name: 'hooks/post-command',
    description: 'Post-command hook that records command execution outcomes for learning',
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Command that was executed',
            },
            exitCode: {
                type: 'number',
                description: 'Command exit code',
                default: 0,
            },
            success: {
                type: 'boolean',
                description: 'Whether the command was successful',
            },
            output: {
                type: 'string',
                description: 'Command output',
            },
            error: {
                type: 'string',
                description: 'Error message if failed',
            },
            executionTime: {
                type: 'number',
                description: 'Execution time in milliseconds',
                minimum: 0,
            },
            metadata: {
                type: 'object',
                description: 'Additional metadata',
                additionalProperties: true,
            },
        },
        required: ['command', 'success'],
    },
    handler: async (input, context) => {
        const validated = postCommandSchema.parse(input);
        return handlePostCommand(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'post-command', 'learning', 'reasoningbank'],
    version: '1.0.0',
};
/**
 * hooks/route tool
 */
export const routeTool = {
    name: 'hooks/route',
    description: 'Route a task to the optimal agent based on learned patterns and historical performance. Uses ReasoningBank for retrieval and scoring.',
    inputSchema: {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Task description to route',
            },
            context: {
                type: 'string',
                description: 'Additional context about the task',
            },
            preferredAgents: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of preferred agent types',
            },
            constraints: {
                type: 'object',
                description: 'Routing constraints',
                additionalProperties: true,
            },
            includeExplanation: {
                type: 'boolean',
                description: 'Include routing explanation',
                default: true,
            },
        },
        required: ['task'],
    },
    handler: async (input, context) => {
        const validated = routeSchema.parse(input);
        return handleRoute(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'routing', 'ai', 'reasoningbank', 'learning'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 5000,
};
/**
 * hooks/explain tool
 */
export const explainTool = {
    name: 'hooks/explain',
    description: 'Explain the routing decision for a task with detailed reasoning and transparency',
    inputSchema: {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Task description to explain routing for',
            },
            context: {
                type: 'string',
                description: 'Additional context about the task',
            },
            verbose: {
                type: 'boolean',
                description: 'Include detailed reasoning',
                default: false,
            },
        },
        required: ['task'],
    },
    handler: async (input, context) => {
        const validated = explainSchema.parse(input);
        return handleExplain(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'routing', 'explanation', 'transparency'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 5000,
};
/**
 * hooks/pretrain tool
 */
export const pretrainTool = {
    name: 'hooks/pretrain',
    description: 'Bootstrap intelligence by analyzing repository patterns, git history, and dependencies. Uses ReasoningBank judge() and distill() pipeline.',
    inputSchema: {
        type: 'object',
        properties: {
            repositoryPath: {
                type: 'string',
                description: 'Path to repository (defaults to current directory)',
            },
            includeGitHistory: {
                type: 'boolean',
                description: 'Include git history in analysis',
                default: true,
            },
            includeDependencies: {
                type: 'boolean',
                description: 'Analyze dependencies',
                default: true,
            },
            maxPatterns: {
                type: 'number',
                description: 'Maximum number of patterns to extract',
                minimum: 1,
                maximum: 10000,
                default: 1000,
            },
            force: {
                type: 'boolean',
                description: 'Force retraining even if data exists',
                default: false,
            },
        },
    },
    handler: async (input, context) => {
        const validated = pretrainSchema.parse(input);
        return handlePretrain(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'pretraining', 'intelligence', 'reasoningbank', 'learning'],
    version: '1.0.0',
};
/**
 * hooks/metrics tool
 */
export const metricsTool = {
    name: 'hooks/metrics',
    description: 'Get learning metrics and performance statistics from the hooks system. Retrieves real stats from ReasoningBank.',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['all', 'routing', 'edits', 'commands', 'patterns'],
                description: 'Category of metrics to retrieve',
                default: 'all',
            },
            timeRange: {
                type: 'string',
                enum: ['hour', 'day', 'week', 'month', 'all'],
                description: 'Time range for metrics',
                default: 'all',
            },
            includeDetailedStats: {
                type: 'boolean',
                description: 'Include detailed statistics',
                default: false,
            },
            format: {
                type: 'string',
                enum: ['json', 'summary'],
                description: 'Output format',
                default: 'summary',
            },
        },
    },
    handler: async (input, context) => {
        const validated = metricsSchema.parse(input);
        return handleMetrics(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'metrics', 'analytics', 'performance'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 10000,
};
/**
 * hooks/list tool
 */
export const listHooksTool = {
    name: 'hooks/list',
    description: 'List all registered hooks with filtering and metadata',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['all', 'pre-edit', 'post-edit', 'pre-command', 'post-command', 'routing'],
                description: 'Filter hooks by category',
                default: 'all',
            },
            includeDisabled: {
                type: 'boolean',
                description: 'Include disabled hooks',
                default: false,
            },
            includeMetadata: {
                type: 'boolean',
                description: 'Include hook metadata',
                default: true,
            },
        },
    },
    handler: async (input, context) => {
        const validated = listHooksSchema.parse(input);
        return handleListHooks(validated, context);
    },
    category: 'hooks',
    tags: ['hooks', 'list', 'registry'],
    version: '1.0.0',
    cacheable: true,
    cacheTTL: 5000,
};
// ============================================================================
// Exports
// ============================================================================
export const hooksTools = [
    preEditTool,
    postEditTool,
    preCommandTool,
    postCommandTool,
    routeTool,
    explainTool,
    pretrainTool,
    metricsTool,
    listHooksTool,
];
export default hooksTools;

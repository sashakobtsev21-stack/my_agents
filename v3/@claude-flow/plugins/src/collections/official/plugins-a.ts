/**
 * Official plugin definitions (part A) — PluginBuilder chains for the
 * core / development / intelligence / swarm plugins.
 *
 * Extracted from official/index.ts (W155, P3.34 cut #1).
 */
import { PluginBuilder } from '../../sdk/index.js';
import { HookEvent, HookPriority } from '../../types/index.js';
export const sessionPlugin = new PluginBuilder('session-manager', '3.0.0')
  .withDescription('Manages session lifecycle with auto-save and restore')
  .withAuthor('Claude Flow')
  .withTags(['core', 'session', 'persistence'])
  .withHooks([
    {
      event: HookEvent.SessionStart,
      priority: HookPriority.Critical,
      name: 'session-init',
      handler: async (ctx) => {
        return { success: true, data: { sessionId: Date.now().toString() } };
      },
    },
    {
      event: HookEvent.SessionEnd,
      priority: HookPriority.Critical,
      name: 'session-cleanup',
      handler: async (ctx) => {
        return { success: true };
      },
    },
  ])
  .build();

/**
 * Memory coordination plugin - coordinates memory across agents.
 */
export const memoryCoordinatorPlugin = new PluginBuilder('memory-coordinator', '3.0.0')
  .withDescription('Coordinates memory access and synchronization across agents')
  .withAuthor('Claude Flow')
  .withTags(['core', 'memory', 'coordination'])
  .withHooks([
    {
      event: HookEvent.PreMemoryStore,
      priority: HookPriority.High,
      name: 'memory-validate',
      handler: async (ctx) => {
        return { success: true };
      },
    },
    {
      event: HookEvent.PostMemoryStore,
      priority: HookPriority.Normal,
      name: 'memory-sync',
      handler: async (ctx) => {
        return { success: true };
      },
    },
  ])
  .build();

/**
 * Event bus plugin - provides pub/sub messaging.
 */
export const eventBusPlugin = new PluginBuilder('event-bus', '3.0.0')
  .withDescription('Pub/sub event messaging system')
  .withAuthor('Claude Flow')
  .withTags(['core', 'events', 'messaging'])
  .withMCPTools([
    {
      name: 'emit-event',
      description: 'Emit an event to subscribers',
      inputSchema: {
        type: 'object',
        properties: {
          event: { type: 'string', description: 'Event name' },
          data: { type: 'object', description: 'Event data' },
        },
        required: ['event'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Event ${input.event} emitted` }],
        };
      },
    },
  ])
  .build();

// ============================================================================
// Development Plugins
// ============================================================================

/**
 * Coder agent plugin - provides coding assistance.
 */
export const coderAgentPlugin = new PluginBuilder('coder-agent', '3.0.0')
  .withDescription('AI-powered coding assistance agent')
  .withAuthor('Claude Flow')
  .withTags(['development', 'agent', 'coding'])
  .withAgentTypes([
    {
      type: 'coder',
      name: 'Coder Agent',
      description: 'Writes clean, efficient code following best practices',
      capabilities: ['code-generation', 'refactoring', 'debugging'],
      systemPrompt: 'You are an expert software engineer...',
      model: 'claude-sonnet-4-6',
      temperature: 0.3,
    },
  ])
  .build();

/**
 * Tester agent plugin - provides testing assistance.
 */
export const testerAgentPlugin = new PluginBuilder('tester-agent', '3.0.0')
  .withDescription('AI-powered testing and QA agent')
  .withAuthor('Claude Flow')
  .withTags(['development', 'agent', 'testing'])
  .withAgentTypes([
    {
      type: 'tester',
      name: 'Tester Agent',
      description: 'Writes comprehensive tests and validates code quality',
      capabilities: ['unit-testing', 'integration-testing', 'test-coverage'],
      systemPrompt: 'You are an expert QA engineer...',
      model: 'claude-sonnet-4-6',
      temperature: 0.2,
    },
  ])
  .build();

/**
 * Reviewer agent plugin - provides code review.
 */
export const reviewerAgentPlugin = new PluginBuilder('reviewer-agent', '3.0.0')
  .withDescription('AI-powered code review agent')
  .withAuthor('Claude Flow')
  .withTags(['development', 'agent', 'review'])
  .withAgentTypes([
    {
      type: 'reviewer',
      name: 'Reviewer Agent',
      description: 'Reviews code for quality, security, and best practices',
      capabilities: ['code-review', 'security-audit', 'performance-review'],
      systemPrompt: 'You are an expert code reviewer...',
      model: 'claude-sonnet-4-6',
      temperature: 0.1,
    },
  ])
  .build();

/**
 * Git integration plugin - provides Git operations.
 */
export const gitIntegrationPlugin = new PluginBuilder('git-integration', '3.0.0')
  .withDescription('Git version control integration')
  .withAuthor('Claude Flow')
  .withTags(['development', 'integration', 'git'])
  .withMCPTools([
    {
      name: 'git-status',
      description: 'Get current Git repository status',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Repository path' },
        },
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: 'Git status retrieved' }],
        };
      },
    },
    {
      name: 'git-commit',
      description: 'Create a Git commit',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' },
        },
        required: ['message'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Commit created: ${input.message}` }],
        };
      },
    },
  ])
  .build();

/**
 * Linter plugin - provides code linting.
 */
export const linterPlugin = new PluginBuilder('linter', '3.0.0')
  .withDescription('Code linting and style checking')
  .withAuthor('Claude Flow')
  .withTags(['development', 'tool', 'linting'])
  .withHooks([
    {
      event: HookEvent.PreFileWrite,
      priority: HookPriority.Normal,
      name: 'lint-check',
      handler: async (ctx) => {
        // Lint the file before writing
        return { success: true };
      },
    },
  ])
  .build();

// ============================================================================
// Intelligence Plugins
// ============================================================================

/**
 * SONA integration plugin - self-optimizing neural architecture.
 */
export const sonaPlugin = new PluginBuilder('sona-integration', '3.0.0')
  .withDescription('SONA self-optimizing neural architecture integration')
  .withAuthor('Claude Flow')
  .withTags(['intelligence', 'neural', 'learning'])
  .withDependencies(['memory-coordinator@^3.0.0'])
  .withHooks([
    {
      event: HookEvent.PatternDetected,
      priority: HookPriority.High,
      name: 'sona-learn',
      handler: async (ctx) => {
        return { success: true, data: { adapted: true } };
      },
    },
  ])
  .build();

/**
 * ReasoningBank plugin - stores and retrieves reasoning patterns.
 */
export const reasoningBankPlugin = new PluginBuilder('reasoning-bank', '3.0.0')
  .withDescription('Pattern storage and retrieval for reasoning')
  .withAuthor('Claude Flow')
  .withTags(['intelligence', 'memory', 'patterns'])
  .withMCPTools([
    {
      name: 'store-reasoning',
      description: 'Store a reasoning pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Pattern identifier' },
          context: { type: 'object', description: 'Pattern context' },
          outcome: { type: 'string', description: 'Pattern outcome' },
        },
        required: ['pattern', 'outcome'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Pattern ${input.pattern} stored` }],
        };
      },
    },
    {
      name: 'retrieve-reasoning',
      description: 'Retrieve similar reasoning patterns',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query context' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: 'Retrieved patterns' }],
        };
      },
    },
  ])
  .build();

/**
 * Pattern learning plugin - learns from task execution.
 */
export const patternLearningPlugin = new PluginBuilder('pattern-learning', '3.0.0')
  .withDescription('Learns patterns from task execution')
  .withAuthor('Claude Flow')
  .withTags(['intelligence', 'learning', 'hooks'])
  .withHooks([
    {
      event: HookEvent.PostTaskComplete,
      priority: HookPriority.Low,
      name: 'learn-from-task',
      handler: async (ctx) => {
        return { success: true };
      },
    },
    {
      event: HookEvent.TaskFailed,
      priority: HookPriority.Low,
      name: 'learn-from-failure',
      handler: async (ctx) => {
        return { success: true };
      },
    },
  ])
  .build();

// ============================================================================
// Swarm Plugins
// ============================================================================

/**
 * HiveMind plugin - collective intelligence coordination.
 */
export const hiveMindPlugin = new PluginBuilder('hive-mind', '3.0.0')
  .withDescription('Collective intelligence and consensus mechanisms')
  .withAuthor('Claude Flow')
  .withTags(['swarm', 'integration', 'consensus'])
  .withMCPTools([
    {
      name: 'collective-decide',
      description: 'Request collective decision from agents',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Decision question' },
          options: { type: 'array', items: { type: 'string' }, description: 'Options' },
          threshold: { type: 'number', description: 'Consensus threshold (0-1)' },
        },
        required: ['question', 'options'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: 'Decision requested' }],
        };
      },
    },
  ])
  .build();

/**
 * Maestro plugin - workflow orchestration.
 */
export const maestroPlugin = new PluginBuilder('maestro', '3.0.0')
  .withDescription('Multi-agent workflow orchestration')
  .withAuthor('Claude Flow')
  .withTags(['swarm', 'integration', 'orchestration'])
  .withMCPTools([
    {
      name: 'create-workflow',
      description: 'Create a new workflow',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Workflow name' },
          steps: { type: 'array', items: { type: 'object' }, description: 'Workflow steps' },
        },
        required: ['name', 'steps'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Workflow ${input.name} created` }],
        };
      },
    },
    {
      name: 'execute-workflow',
      description: 'Execute a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', description: 'Workflow ID' },
          input: { type: 'object', description: 'Workflow input' },
        },
        required: ['workflowId'],
      },
      handler: async (input) => {
        return {
          content: [{ type: 'text', text: `Workflow ${input.workflowId} started` }],
        };
      },
    },
  ])
  .build();

/**
 * Consensus plugin - Byzantine fault-tolerant consensus.
 */
export const consensusPlugin = new PluginBuilder('consensus', '3.0.0')
  .withDescription('Byzantine fault-tolerant consensus mechanisms')
  .withAuthor('Claude Flow')
  .withTags(['swarm', 'integration', 'consensus', 'byzantine'])
  .withDependencies(['hive-mind@^3.0.0'])
  .build();

/**
 * Coordinator agent plugin - swarm coordination.
 */
export const coordinatorAgentPlugin = new PluginBuilder('coordinator-agent', '3.0.0')
  .withDescription('Swarm coordination agent')
  .withAuthor('Claude Flow')
  .withTags(['swarm', 'agent', 'coordination'])
  .withAgentTypes([
    {
      type: 'coordinator',
      name: 'Coordinator Agent',
      description: 'Coordinates multi-agent swarm operations',
      capabilities: ['task-distribution', 'progress-tracking', 'conflict-resolution'],
      systemPrompt: 'You are a swarm coordinator...',
      model: 'claude-sonnet-4-6',
      temperature: 0.2,
    },
  ])
  .build();

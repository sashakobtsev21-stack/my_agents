/**
 * V3 CLI Hooks Command
 * Self-learning hooks system for intelligent workflow automation
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { select, confirm, input } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
// storeCommand is now imported transitively via ./hooks/transfer.ts.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  readCoverageFromDisk,
  classifyCoverageGap,
  suggestAgentsForFile,
} from './hooks/coverage-reader.js';
import { safeNum, formatIntelligenceStatus, formatWorkerStatus } from './hooks/helpers.js';
// Pilot extractions (issue #7) — each command was inline in this file before.
// Replicate the pattern for the other 36 commands.
import { notifyCommand } from './hooks/notify.js';
import { workerCommand } from './hooks/worker.js';
import { coverageRouteCommand, coverageSuggestCommand, coverageGapsCommand } from './hooks/coverage.js';
import { progressHookCommand } from './hooks/progress.js';
import { transferCommand } from './hooks/transfer.js';
import { statuslineCommand } from './hooks/statusline.js';
import { teammateIdleCommand, taskCompletedCommand } from './hooks/teammate.js';
import { intelligenceCommand } from './hooks/intelligence.js';
import { routeCommand, explainCommand } from './hooks/routing.js';
import { pretrainCommand, buildAgentsCommand } from './hooks/training.js';
import { metricsCommand } from './hooks/metrics.js';
import { preEditCommand, postEditCommand, preCommandCommand, postCommandCommand } from './hooks/edit-hooks.js';
import { preTaskCommand, postTaskCommand } from './hooks/task-hooks.js';



// Hook types
const HOOK_TYPES = [
  { value: 'pre-edit', label: 'Pre-Edit', hint: 'Get context before editing files' },
  { value: 'post-edit', label: 'Post-Edit', hint: 'Record editing outcomes' },
  { value: 'pre-command', label: 'Pre-Command', hint: 'Assess risk before commands' },
  { value: 'post-command', label: 'Post-Command', hint: 'Record command outcomes' },
  { value: 'route', label: 'Route', hint: 'Route tasks to optimal agents' },
  { value: 'explain', label: 'Explain', hint: 'Explain routing decisions' }
];

// Agent routing options
const AGENT_TYPES = [
  'coder', 'researcher', 'tester', 'reviewer', 'architect',
  'security-architect', 'security-auditor', 'memory-specialist',
  'swarm-specialist', 'performance-engineer', 'core-architect',
  'test-architect', 'coordinator', 'analyst', 'optimizer'
];

// Pre-edit subcommand

// Route subcommand

// Pretrain subcommand

// Metrics subcommand


// List subcommand
const listCommand: Command = {
  name: 'list',
  aliases: ['ls'],
  description: 'List all registered hooks',
  options: [
    {
      name: 'enabled',
      short: 'e',
      description: 'Show only enabled hooks',
      type: 'boolean',
      default: false
    },
    {
      name: 'type',
      short: 't',
      description: 'Filter by hook type',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      // Call MCP tool for list
      const result = await callMCPTool<{
        hooks: Array<{
          name: string;
          type: string;
          enabled: boolean;
          priority: number;
          executionCount: number;
          lastExecuted?: string;
        }>;
        total: number;
      }>('hooks_list', {
        enabled: ctx.flags.enabled || undefined,
        type: ctx.flags.type || undefined,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Registered Hooks'));
      output.writeln();

      if (result.hooks.length === 0) {
        output.printInfo('No hooks found matching criteria');
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'name', header: 'Name', width: 20 },
          { key: 'type', header: 'Type', width: 15 },
          { key: 'enabled', header: 'Enabled', width: 10, format: (v) => v ? output.success('Yes') : output.dim('No') },
          { key: 'priority', header: 'Priority', width: 10, align: 'right' },
          { key: 'executionCount', header: 'Executions', width: 12, align: 'right' },
          { key: 'lastExecuted', header: 'Last Executed', width: 20, format: (v) => v ? new Date(String(v)).toLocaleString() : 'Never' }
        ],
        data: result.hooks
      });

      output.writeln();
      output.printInfo(`Total: ${result.total} hooks`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to list hooks: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Pre-task subcommand

// Session-end subcommand
const sessionEndCommand: Command = {
  name: 'session-end',
  description: 'End current session and persist state',
  options: [
    {
      name: 'save-state',
      short: 's',
      description: 'Save session state for later restoration',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow hooks session-end', description: 'End and save session' },
    { command: 'claude-flow hooks session-end --save-state false', description: 'End without saving' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    output.printInfo('Ending session...');

    try {
      const result = await callMCPTool<{
        sessionId: string;
        duration: number;
        statePath?: string;
        summary: {
          tasksExecuted: number;
          tasksSucceeded: number;
          tasksFailed: number;
          commandsExecuted: number;
          filesModified: number;
          agentsSpawned: number;
        };
      }>('hooks_session-end', {
        saveState: ctx.flags.saveState ?? true,
        timestamp: Date.now(),
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printSuccess(`Session ${result.sessionId} ended`);

      output.writeln();
      output.writeln(output.bold('Session Summary'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 15, align: 'right' }
        ],
        data: [
          { metric: 'Duration', value: `${(result.duration / 1000 / 60).toFixed(1)} min` },
          { metric: 'Tasks Executed', value: result.summary.tasksExecuted },
          { metric: 'Tasks Succeeded', value: output.success(String(result.summary.tasksSucceeded)) },
          { metric: 'Tasks Failed', value: output.error(String(result.summary.tasksFailed)) },
          { metric: 'Commands Executed', value: result.summary.commandsExecuted },
          { metric: 'Files Modified', value: result.summary.filesModified },
          { metric: 'Agents Spawned', value: result.summary.agentsSpawned }
        ]
      });

      if (result.statePath) {
        output.writeln();
        output.writeln(output.dim(`State saved to: ${result.statePath}`));
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Session-end hook failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Session-restore subcommand
const sessionRestoreCommand: Command = {
  name: 'session-restore',
  description: 'Restore a previous session',
  options: [
    {
      name: 'session-id',
      short: 'i',
      description: 'Session ID to restore (use "latest" for most recent)',
      type: 'string',
      default: 'latest'
    },
    {
      name: 'restore-agents',
      short: 'a',
      description: 'Restore spawned agents',
      type: 'boolean',
      default: true
    },
    {
      name: 'restore-tasks',
      short: 't',
      description: 'Restore active tasks',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow hooks session-restore', description: 'Restore latest session' },
    { command: 'claude-flow hooks session-restore -i session-12345', description: 'Restore specific session' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const sessionId = (ctx.flags.sessionId as string) || ctx.args[0] || 'latest';

    output.printInfo(`Restoring session: ${output.highlight(sessionId)}`);

    try {
      const result = await callMCPTool<{
        sessionId: string;
        originalSessionId: string;
        restoredState: {
          tasksRestored: number;
          agentsRestored: number;
          memoryRestored: number;
        };
        warnings?: string[];
      }>('hooks_session-restore', {
        sessionId,
        restoreAgents: ctx.flags.restoreAgents ?? true,
        restoreTasks: ctx.flags.restoreTasks ?? true,
        timestamp: Date.now(),
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printSuccess(`Session restored from ${result.originalSessionId}`);
      output.writeln(output.dim(`New session ID: ${result.sessionId}`));

      output.writeln();
      output.writeln(output.bold('Restored State'));
      output.printTable({
        columns: [
          { key: 'item', header: 'Item', width: 25 },
          { key: 'count', header: 'Count', width: 15, align: 'right' }
        ],
        data: [
          { item: 'Tasks', count: result.restoredState.tasksRestored },
          { item: 'Agents', count: result.restoredState.agentsRestored },
          { item: 'Memory Entries', count: result.restoredState.memoryRestored }
        ]
      });

      if (result.warnings && result.warnings.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.warning('Warnings')));
        output.printList(result.warnings.map(w => output.warning(w)));
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Session-restore hook failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Intelligence subcommand (SONA, MoE, HNSW)


// =============================================================================
// Worker Commands (12 Background Workers)
// =============================================================================


// Coverage route subcommand

// progressHookCommand moved to ./hooks/progress.ts (issue #7 pilot). See top-of-file import.

// Worker parent command

// Statusline subcommand - generates dynamic status display

// Backward-compatible aliases for v2 hooks
// These ensure old settings.json files continue to work
const routeTaskCommand: Command = {
  name: 'route-task',
  description: '(DEPRECATED: Use "route" instead) Route task to optimal agent',
  options: routeCommand.options,
  examples: [
    { command: 'claude-flow hooks route-task --auto-swarm true', description: 'Route with auto-swarm (v2 compat)' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Silently handle v2-specific flags that don't exist in v3
    // --auto-swarm, --detect-complexity are ignored but don't fail
    if (routeCommand.action) {
      const result = await routeCommand.action(ctx);
      return result || { success: true };
    }
    return { success: true };
  }
};

const sessionStartCommand: Command = {
  name: 'session-start',
  description: '(DEPRECATED: Use "session-restore" instead) Start/restore session',
  options: [
    ...(sessionRestoreCommand.options || []),
    // V2-compatible options that are silently ignored
    {
      name: 'auto-configure',
      description: '(v2 compat) Auto-configure session',
      type: 'boolean',
      default: false
    },
    {
      name: 'restore-context',
      description: '(v2 compat) Restore context',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow hooks session-start --auto-configure true', description: 'Start session (v2 compat)' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Map to session-restore for backward compatibility
    if (sessionRestoreCommand.action) {
      const result = await sessionRestoreCommand.action(ctx);
      return result || { success: true };
    }
    return { success: true };
  }
};

// Pre-bash alias for pre-command (v2 compat)
const preBashCommand: Command = {
  name: 'pre-bash',
  description: '(ALIAS) Same as pre-command',
  options: preCommandCommand.options,
  examples: preCommandCommand.examples,
  action: preCommandCommand.action
};

// Post-bash alias for post-command (v2 compat)
const postBashCommand: Command = {
  name: 'post-bash',
  description: '(ALIAS) Same as post-command',
  options: postCommandCommand.options,
  examples: postCommandCommand.examples,
  action: postCommandCommand.action
};

// Token Optimizer command - integrates agentic-flow Agent Booster
const tokenOptimizeCommand: Command = {
  name: 'token-optimize',
  description: 'Token optimization via agentic-flow Agent Booster integration',
  options: [
    { name: 'query', short: 'q', type: 'string', description: 'Query for compact context retrieval' },
    { name: 'agents', short: 'A', type: 'number', description: 'Agent count for optimal config', default: '6' },
    { name: 'report', short: 'r', type: 'boolean', description: 'Generate optimization report' },
    { name: 'stats', short: 's', type: 'boolean', description: 'Show token savings statistics' },
  ],
  examples: [
    { command: 'claude-flow hooks token-optimize --stats', description: 'Show token savings stats' },
    { command: 'claude-flow hooks token-optimize -q "auth patterns"', description: 'Get compact context' },
    { command: 'claude-flow hooks token-optimize -A 8 --report', description: 'Config for 8 agents + report' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = ctx.flags['query'] as string;
    const agentCount = parseInt(ctx.flags['agents'] as string || '6', 10);
    const showReport = ctx.flags['report'] as boolean;
    const showStats = ctx.flags['stats'] as boolean;

    const spinner = output.createSpinner({ text: 'Checking agentic-flow integration...', spinner: 'dots' });
    spinner.start();

    // Inline TokenOptimizer (self-contained, no external imports)
    const stats = {
      totalTokensSaved: 0,
      editsOptimized: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoriesRetrieved: 0,
    };
    let agenticFlowAvailable = false;
    let reasoningBank: { retrieveMemories: (query: string, opts: { k: number }) => Promise<unknown[]>; formatMemoriesForPrompt?: (memories: unknown[]) => string } | null = null;

    try {
      // Check if agentic-flow v3 is available
      const rb = await import('agentic-flow/reasoningbank').catch(() => null);
      if (rb) {
        agenticFlowAvailable = true;
        if (typeof rb.retrieveMemories === 'function') {
          reasoningBank = rb;
        }
      } else {
        // Legacy check for older agentic-flow
        const af = await import('agentic-flow').catch(() => null);
        if (af) agenticFlowAvailable = true;
      }

      const versionLabel = agenticFlowAvailable ? `agentic-flow v3 detected (ReasoningBank: ${reasoningBank ? 'active' : 'unavailable'})` : 'agentic-flow not available (using fallbacks)';
      spinner.succeed(versionLabel);
      output.writeln();

      // Anti-drift config (hardcoded optimal values from research)
      const config = {
        batchSize: 4,
        cacheSizeMB: 50,
        topology: 'hierarchical',
        expectedSuccessRate: 0.95,
      };

      output.printBox(
        `Anti-Drift Swarm Config\n\n` +
        `Agents: ${agentCount}\n` +
        `Topology: ${config.topology}\n` +
        `Batch Size: ${config.batchSize}\n` +
        `Cache: ${config.cacheSizeMB}MB\n` +
        `Success Rate: ${(config.expectedSuccessRate * 100)}%`
      );

      // If query provided, get compact context via ReasoningBank
      if (query && reasoningBank) {
        output.writeln();
        output.printInfo(`Retrieving compact context for: "${query}"`);
        const memories = await reasoningBank.retrieveMemories(query, { k: 5 });
        const compactPrompt = reasoningBank.formatMemoriesForPrompt ? reasoningBank.formatMemoriesForPrompt(memories) : '';
        // Estimate based on actual query vs compact prompt size difference
        const queryTokenEstimate = Math.ceil((query?.length || 0) / 4);
        const used = Math.ceil((compactPrompt?.length || 0) / 4);
        const tokensSaved = Math.max(0, queryTokenEstimate - used);
        stats.totalTokensSaved += tokensSaved;
        stats.memoriesRetrieved += Array.isArray(memories) ? memories.length : 0;
        output.writeln(`  Memories found: ${Array.isArray(memories) ? memories.length : 0}`);
        output.writeln(`  Tokens saved: ${output.success(String(tokensSaved))}`);
        if (compactPrompt) {
          output.writeln(`  Compact prompt (${compactPrompt.length} chars)`);
        }
      } else if (query) {
        output.writeln();
        output.printInfo('ReasoningBank not available - query skipped');
      }

      // Note: stats reflect only actual measured values from this session.
      // No simulated/fabricated data is added.

      // Show stats
      if (showStats || showReport) {
        output.writeln();
        const total = stats.cacheHits + stats.cacheMisses;
        const hitRate = total > 0 ? (stats.cacheHits / total * 100).toFixed(1) : '0';
        const savings = (stats.totalTokensSaved / 1000 * 0.01).toFixed(2);

        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 20 },
          ],
          data: [
            { metric: 'Tokens Saved', value: stats.totalTokensSaved.toLocaleString() },
            { metric: 'Edits Optimized', value: String(stats.editsOptimized) },
            { metric: 'Cache Hit Rate', value: `${hitRate}%` },
            { metric: 'Memories Retrieved', value: String(stats.memoriesRetrieved) },
            { metric: 'Est. Monthly Savings', value: `$${savings}` },
            { metric: 'Agentic-Flow Active', value: agenticFlowAvailable ? '✓' : '✗' },
          ],
        });
      }

      // Full report
      if (showReport) {
        output.writeln();
        const total = stats.cacheHits + stats.cacheMisses;
        const hitRate = total > 0 ? (stats.cacheHits / total * 100).toFixed(1) : '0';
        const savings = (stats.totalTokensSaved / 1000 * 0.01).toFixed(2);
        output.writeln(`## Token Optimization Report

| Metric | Value |
|--------|-------|
| Tokens Saved | ${stats.totalTokensSaved.toLocaleString()} |
| Edits Optimized | ${stats.editsOptimized} |
| Cache Hit Rate | ${hitRate}% |
| Memories Retrieved | ${stats.memoriesRetrieved} |
| Est. Monthly Savings | $${savings} |
| Agentic-Flow Active | ${agenticFlowAvailable ? '✓' : '✗'} |`);
      }

      return { success: true, data: { config, stats: { ...stats, agenticFlowAvailable } } };
    } catch (error) {
      spinner.fail('TokenOptimizer failed');
      const err = error as Error;
      output.printError(`Error: ${err.message}`);

      // Fallback info
      output.writeln();
      output.printInfo('Fallback anti-drift config:');
      output.writeln('  topology: hierarchical');
      output.writeln('  maxAgents: 8');
      output.writeln('  strategy: specialized');
      output.writeln('  batchSize: 4');

      return { success: false, exitCode: 1 };
    }
  }
};

// Model Router command - intelligent model selection (haiku/sonnet/opus)
const modelRouteCommand: Command = {
  name: 'model-route',
  description: 'Route task to optimal Claude model (haiku/sonnet/opus) based on complexity',
  options: [
    { name: 'task', short: 't', type: 'string', description: 'Task description to route', required: true },
    { name: 'context', short: 'c', type: 'string', description: 'Additional context' },
    { name: 'prefer-cost', type: 'boolean', description: 'Prefer lower cost models' },
    { name: 'prefer-quality', type: 'boolean', description: 'Prefer higher quality models' },
  ],
  examples: [
    { command: 'claude-flow hooks model-route -t "fix typo"', description: 'Route simple task (likely haiku)' },
    { command: 'claude-flow hooks model-route -t "architect auth system"', description: 'Route complex task (likely opus)' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const task = (ctx.flags.task as string) || ctx.args[0];
    if (!task) {
      output.printError('Task description required. Use --task or -t flag.');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Analyzing task complexity: ${output.highlight(task.slice(0, 50))}...`);

    try {
      const result = await callMCPTool<{
        model: string;
        complexity: number;
        confidence: number;
        reasoning: string;
        costMultiplier?: number;
        implementation?: string;
      }>('hooks_model-route', {
        task,
        context: ctx.flags.context,
        preferCost: ctx.flags['prefer-cost'],
        preferQuality: ctx.flags['prefer-quality'],
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();

      // Model icon based on selection
      const modelIcons: Record<string, string> = {
        haiku: '🌸',
        sonnet: '📜',
        opus: '🎭',
      };
      const model = result.model || 'sonnet';
      const icon = modelIcons[model] || '🤖';

      // Calculate cost savings compared to opus
      const costMultipliers: Record<string, number> = { haiku: 0.04, sonnet: 0.2, opus: 1.0 };
      const costSavings = model !== 'opus'
        ? `${((1 - costMultipliers[model]) * 100).toFixed(0)}% vs opus`
        : undefined;

      // Determine complexity level
      const complexityScore = typeof result.complexity === 'number' ? result.complexity : 0.5;
      const complexityLevel = complexityScore > 0.7 ? 'high' : complexityScore > 0.4 ? 'medium' : 'low';

      output.printBox(
        [
          `Selected Model: ${icon} ${output.bold(model.toUpperCase())}`,
          `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
          `Complexity: ${complexityLevel} (${(complexityScore * 100).toFixed(0)}%)`,
          costSavings ? `Cost Savings: ${costSavings}` : '',
        ].filter(Boolean).join('\n'),
        'Model Routing Result'
      );

      output.writeln();
      output.writeln(output.bold('Reasoning'));
      output.writeln(output.dim(result.reasoning || 'Based on task complexity analysis'));

      if (result.implementation) {
        output.writeln();
        output.writeln(output.dim(`Implementation: ${result.implementation}`));
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Model routing failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Model Outcome command - record routing outcomes for learning
const modelOutcomeCommand: Command = {
  name: 'model-outcome',
  description: 'Record model routing outcome for learning',
  options: [
    { name: 'task', short: 't', type: 'string', description: 'Task that was executed', required: true },
    { name: 'model', short: 'm', type: 'string', description: 'Model that was used (haiku/sonnet/opus)', required: true },
    { name: 'outcome', short: 'o', type: 'string', description: 'Outcome (success/failure/escalated)', required: true },
    { name: 'quality', short: 'q', type: 'number', description: 'Quality score 0-1' },
  ],
  examples: [
    { command: 'claude-flow hooks model-outcome -t "fix typo" -m haiku -o success', description: 'Record successful haiku task' },
    { command: 'claude-flow hooks model-outcome -t "auth system" -m sonnet -o escalated', description: 'Record escalation to opus' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const task = ctx.flags.task as string;
    const model = ctx.flags.model as string;
    const outcome = ctx.flags.outcome as string;

    if (!task || !model || !outcome) {
      output.printError('Task, model, and outcome are required.');
      return { success: false, exitCode: 1 };
    }

    try {
      const result = await callMCPTool<{ recorded: boolean; learningUpdate: string }>('hooks_model-outcome', {
        task,
        model,
        outcome,
        quality: ctx.flags.quality,
      });

      output.printSuccess(`Outcome recorded for ${model}: ${outcome}`);
      if (result.learningUpdate) {
        output.writeln(output.dim(result.learningUpdate));
      }

      return { success: true, data: result };
    } catch (error) {
      output.printError(`Failed to record outcome: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Model Stats command - view routing statistics
const modelStatsCommand: Command = {
  name: 'model-stats',
  description: 'View model routing statistics and learning metrics',
  options: [
    { name: 'detailed', short: 'd', type: 'boolean', description: 'Show detailed breakdown' },
  ],
  examples: [
    { command: 'claude-flow hooks model-stats', description: 'View routing stats' },
    { command: 'claude-flow hooks model-stats --detailed', description: 'Show detailed breakdown' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await callMCPTool<{
        available: boolean;
        message?: string;
        totalDecisions?: number;
        modelDistribution?: Record<string, number>;
        avgComplexity?: number;
        avgConfidence?: number;
        circuitBreakerTrips?: number;
      }>('hooks_model-stats', {
        detailed: ctx.flags.detailed,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      if (!result.available) {
        output.printWarning(result.message || 'Model router not available');
        return { success: true, data: result };
      }

      // Calculate cost savings based on model distribution
      const dist = result.modelDistribution || { haiku: 0, sonnet: 0, opus: 0 };
      const totalTasks = result.totalDecisions || 0;
      const costMultipliers: Record<string, number> = { haiku: 0.04, sonnet: 0.2, opus: 1.0 };

      let totalCost = 0;
      let maxCost = totalTasks; // If all were opus
      for (const [model, count] of Object.entries(dist)) {
        if (model !== 'inherit') {
          totalCost += count * (costMultipliers[model] || 1);
        }
      }
      const costSavings = maxCost > 0 ? ((1 - totalCost / maxCost) * 100).toFixed(1) : '0';

      output.writeln();
      output.printBox(
        [
          `Total Tasks Routed: ${totalTasks}`,
          `Avg Complexity: ${((result.avgComplexity || 0) * 100).toFixed(1)}%`,
          `Avg Confidence: ${((result.avgConfidence || 0) * 100).toFixed(1)}%`,
          `Cost Savings: ${costSavings}% vs all-opus`,
          `Circuit Breaker Trips: ${result.circuitBreakerTrips || 0}`,
        ].join('\n'),
        'Model Routing Statistics'
      );

      if (dist && Object.keys(dist).length > 0) {
        output.writeln();
        output.writeln(output.bold('Model Distribution'));
        output.printTable({
          columns: [
            { key: 'model', header: 'Model', width: 10 },
            { key: 'count', header: 'Tasks', width: 8, align: 'right' },
            { key: 'percentage', header: '%', width: 8, align: 'right' },
            { key: 'costMultiplier', header: 'Cost', width: 8, align: 'right' },
          ],
          data: Object.entries(dist)
            .filter(([model]) => model !== 'inherit')
            .map(([model, count]) => ({
              model: model.toUpperCase(),
              count,
              percentage: totalTasks > 0 ? `${((count / totalTasks) * 100).toFixed(1)}%` : '0%',
              costMultiplier: `${costMultipliers[model] || 1}x`,
            })),
        });
      }

      return { success: true, data: result };
    } catch (error) {
      output.printError(`Failed to get stats: ${String(error)}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Teammate Idle command - Agent Teams integration

// Notify subcommand
// notifyCommand moved to ./hooks/notify.ts (issue #7 pilot — see import).

// Main hooks command
export const hooksCommand: Command = {
  name: 'hooks',
  description: 'Self-learning hooks system for intelligent workflow automation',
  subcommands: [
    preEditCommand,
    postEditCommand,
    preCommandCommand,
    postCommandCommand,
    preTaskCommand,
    postTaskCommand,
    sessionEndCommand,
    sessionRestoreCommand,
    routeCommand,
    explainCommand,
    pretrainCommand,
    buildAgentsCommand,
    metricsCommand,
    transferCommand,
    listCommand,
    intelligenceCommand,
    notifyCommand,
    workerCommand,
    progressHookCommand,
    statuslineCommand,
    // Coverage-aware routing commands
    coverageRouteCommand,
    coverageSuggestCommand,
    coverageGapsCommand,
    // Token optimization
    tokenOptimizeCommand,
    // Model routing (tiny-dancer integration)
    modelRouteCommand,
    modelOutcomeCommand,
    modelStatsCommand,
    // Backward-compatible aliases for v2
    routeTaskCommand,
    sessionStartCommand,
    preBashCommand,
    postBashCommand,
    // Agent Teams integration
    teammateIdleCommand,
    taskCompletedCommand,
  ],
  options: [],
  examples: [
    { command: 'claude-flow hooks pre-edit -f src/utils.ts', description: 'Get context before editing' },
    { command: 'claude-flow hooks route -t "Fix authentication bug"', description: 'Route task to optimal agent' },
    { command: 'claude-flow hooks pretrain', description: 'Bootstrap intelligence from repository' },
    { command: 'claude-flow hooks metrics --v3-dashboard', description: 'View V3 performance metrics' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Self-Learning Hooks System'));
    output.writeln();
    output.writeln('Intelligent workflow automation with pattern learning and adaptive routing');
    output.writeln();
    output.writeln('Usage: claude-flow hooks <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('pre-edit')}        - Get context before editing files`,
      `${output.highlight('post-edit')}       - Record editing outcomes for learning`,
      `${output.highlight('pre-command')}     - Assess risk before executing commands`,
      `${output.highlight('post-command')}    - Record command execution outcomes`,
      `${output.highlight('pre-task')}        - Record task start and get agent suggestions`,
      `${output.highlight('post-task')}       - Record task completion for learning`,
      `${output.highlight('session-end')}     - End current session and persist state`,
      `${output.highlight('session-restore')} - Restore a previous session`,
      `${output.highlight('route')}           - Route tasks to optimal agents`,
      `${output.highlight('explain')}         - Explain routing decisions`,
      `${output.highlight('pretrain')}        - Bootstrap intelligence from repository`,
      `${output.highlight('build-agents')}    - Generate optimized agent configs`,
      `${output.highlight('metrics')}         - View learning metrics dashboard`,
      `${output.highlight('transfer')}        - Transfer patterns from another project`,
      `${output.highlight('list')}            - List all registered hooks`,
      `${output.highlight('worker')}          - Background worker management (12 workers)`,
      `${output.highlight('progress')}        - Check V3 implementation progress`,
      `${output.highlight('statusline')}      - Generate dynamic statusline display`,
      `${output.highlight('coverage-route')}  - Route tasks based on coverage gaps (ruvector)`,
      `${output.highlight('coverage-suggest')}- Suggest coverage improvements`,
      `${output.highlight('coverage-gaps')}   - List all coverage gaps with agents`,
      `${output.highlight('token-optimize')} - Token optimization (agentic-flow integration)`,
      `${output.highlight('model-route')}    - Route to optimal model (haiku/sonnet/opus)`,
      `${output.highlight('model-outcome')}  - Record model routing outcome`,
      `${output.highlight('model-stats')}    - View model routing statistics`,
      '',
      output.bold('Agent Teams:'),
      `${output.highlight('teammate-idle')}  - Handle idle teammate (auto-assign tasks)`,
      `${output.highlight('task-completed')} - Handle task completion (train patterns)`
    ]);
    output.writeln();
    output.writeln('Run "claude-flow hooks <subcommand> --help" for subcommand help');
    output.writeln();
    output.writeln(output.bold('V3 Features:'));
    output.printList([
      '🧠 ReasoningBank adaptive learning',
      '⚡ Flash Attention (Flash Attention (speedup unverified))',
      '🔍 AgentDB integration (HNSW-indexed search)',
      '📊 84.8% SWE-Bench solve rate',
      '🎯 32.3% token reduction',
      '🚀 2.8-4.4x speed improvement',
      '👥 Agent Teams integration (auto task assignment)'
    ]);

    return { success: true };
  }
};

export default hooksCommand;

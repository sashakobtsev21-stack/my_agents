/**
 * V3 CLI Hive Mind Command
 * Queen-led consensus-based multi-agent coordination
 *
 * Updated to support --claude flag for launching interactive Claude Code sessions
 * PR: Fix #955 - Implement --claude flag for hive-mind spawn command
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { confirm, input } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
// Spawn infra (spawn.ts) is now consumed by the lifecycle subcommand
// module (W118); the parent no longer references it directly.
// Status/health/priority formatters moved to ./hive-mind/format.ts (W117).
import { formatAgentStatus, formatHiveStatus, formatHealth, formatPriority } from './hive-mind/format.js';
// Lifecycle subcommands (init, spawn) moved to ./hive-mind/commands-lifecycle.ts (W118).
import { initCommand, spawnCommand } from './hive-mind/commands-lifecycle.js';


// Status subcommand
const statusCommand: Command = {
  name: 'status',
  description: 'Show hive mind status',
  options: [
    {
      name: 'detailed',
      short: 'd',
      description: 'Show detailed metrics',
      type: 'boolean',
      default: false
    },
    {
      name: 'watch',
      short: 'w',
      description: 'Watch for changes',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const detailed = ctx.flags.detailed as boolean;

    try {
      const result = await callMCPTool<{
        hiveId?: string;
        id?: string;
        initialized?: boolean;
        status?: 'active' | 'idle' | 'degraded' | 'offline' | 'running' | 'stopped';
        topology?: string;
        consensus?: string;
        queen?: {
          id?: string;
          agentId?: string;
          status?: string;
          load?: number;
          tasksQueued?: number;
        };
        workers?: Array<{
          id?: string;
          agentId?: string;
          type?: string;
          agentType?: string;
          status?: string;
          currentTask?: string;
          tasksCompleted?: number;
        } | string>;
        metrics?: {
          totalTasks?: number;
          completedTasks?: number;
          failedTasks?: number;
          avgTaskTime?: number;
          consensusRounds?: number;
          memoryUsage?: string;
        };
        health?: {
          overall?: string;
          queen?: string;
          workers?: string;
          consensus?: string;
          memory?: string;
        };
      }>('hive-mind_status', {
        includeMetrics: detailed,
        includeWorkers: true,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      // Handle both simple and complex response formats - cast to flexible type
      const flexResult = result as Record<string, unknown>;
      const hiveId = result.hiveId ?? (flexResult.id as string) ?? 'default';
      const status = result.status ?? ((flexResult.initialized as boolean) ? 'running' : 'stopped');
      const queen = result.queen ?? { id: 'N/A', status: 'unknown', load: 0, tasksQueued: 0 };
      const flexQueen = queen as Record<string, unknown>;
      const queenId = typeof queen === 'object' ? (queen.id ?? (flexQueen.agentId as string) ?? 'N/A') : String(queen);
      const queenLoad = typeof queen === 'object' ? (queen.load ?? 0) : 0;
      const queenTasks = typeof queen === 'object' ? (queen.tasksQueued ?? 0) : 0;
      const queenStatus = typeof queen === 'object' ? (queen.status ?? 'active') : 'active';

      output.writeln();
      output.printBox(
        [
          `Hive ID: ${hiveId}`,
          `Status: ${formatHiveStatus(String(status))}`,
          `Topology: ${result.topology ?? 'mesh'}`,
          `Consensus: ${result.consensus ?? 'byzantine'}`,
          '',
          `Queen: ${queenId}`,
          `  Status: ${formatAgentStatus(queenStatus)}`,
          `  Load: ${(queenLoad * 100).toFixed(1)}%`,
          `  Queued Tasks: ${queenTasks}`
        ].join('\n'),
        'Hive Mind Status'
      );

      // Handle workers array - could be worker objects or just IDs
      const workers = result.workers ?? [];
      const workerData = Array.isArray(workers) ? workers.map(w => {
        if (typeof w === 'string') {
          return { id: w, type: 'worker', status: 'idle', currentTask: '-', tasksCompleted: 0 };
        }
        const flexWorker = w as Record<string, unknown>;
        return {
          id: w.id ?? (flexWorker.agentId as string) ?? 'unknown',
          type: w.type ?? (flexWorker.agentType as string) ?? 'worker',
          status: w.status ?? 'idle',
          currentTask: w.currentTask ?? '-',
          tasksCompleted: w.tasksCompleted ?? 0
        };
      }) : [];

      output.writeln();
      output.writeln(output.bold('Worker Agents'));
      if (workerData.length === 0) {
        output.printInfo('No workers in hive. Use "claude-flow hive-mind spawn" to add workers.');
      } else {
        output.printTable({
          columns: [
            { key: 'id', header: 'ID', width: 20 },
            { key: 'type', header: 'Type', width: 12 },
            { key: 'status', header: 'Status', width: 10, format: formatAgentStatus },
            { key: 'currentTask', header: 'Current Task', width: 20, format: (v: unknown) => String(v || '-') },
            { key: 'tasksCompleted', header: 'Completed', width: 10, align: 'right' }
          ],
          data: workerData
        });
      }

      if (detailed) {
        const metrics = result.metrics ?? { totalTasks: 0, completedTasks: 0, failedTasks: 0, avgTaskTime: 0, consensusRounds: 0, memoryUsage: '0 MB' };
        output.writeln();
        output.writeln(output.bold('Metrics'));
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 20 },
            { key: 'value', header: 'Value', width: 15, align: 'right' }
          ],
          data: [
            { metric: 'Total Tasks', value: metrics.totalTasks ?? 0 },
            { metric: 'Completed', value: metrics.completedTasks ?? 0 },
            { metric: 'Failed', value: metrics.failedTasks ?? 0 },
            { metric: 'Avg Task Time', value: `${(metrics.avgTaskTime ?? 0).toFixed(1)}ms` },
            { metric: 'Consensus Rounds', value: metrics.consensusRounds ?? 0 },
            { metric: 'Memory Usage', value: metrics.memoryUsage ?? '0 MB' }
          ]
        });

        const health = result.health ?? { overall: 'healthy', queen: 'healthy', workers: 'healthy', consensus: 'healthy', memory: 'healthy' };
        output.writeln();
        output.writeln(output.bold('Health'));
        output.printList([
          `Overall: ${formatHealth(health.overall ?? 'healthy')}`,
          `Queen: ${formatHealth(health.queen ?? 'healthy')}`,
          `Workers: ${formatHealth(health.workers ?? 'healthy')}`,
          `Consensus: ${formatHealth(health.consensus ?? 'healthy')}`,
          `Memory: ${formatHealth(health.memory ?? 'healthy')}`
        ]);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Status error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Task subcommand
const taskCommand: Command = {
  name: 'task',
  description: 'Submit tasks to the hive',
  options: [
    {
      name: 'description',
      short: 'd',
      description: 'Task description',
      type: 'string'
    },
    {
      name: 'priority',
      short: 'p',
      description: 'Task priority',
      type: 'string',
      choices: ['low', 'normal', 'high', 'critical'],
      default: 'normal'
    },
    {
      name: 'require-consensus',
      short: 'c',
      description: 'Require consensus for completion',
      type: 'boolean',
      default: false
    },
    {
      name: 'timeout',
      description: 'Task timeout in seconds',
      type: 'number',
      default: 300
    }
  ],
  examples: [
    { command: 'claude-flow hive-mind task -d "Implement auth module"', description: 'Submit task' },
    { command: 'claude-flow hive-mind task -d "Security review" -p critical -c', description: 'Critical task with consensus' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let description = ctx.flags.description as string || ctx.args.join(' ');

    if (!description && ctx.interactive) {
      description = await input({
        message: 'Task description:',
        validate: (v) => v.length > 0 || 'Description is required'
      });
    }

    if (!description) {
      output.printError('Task description is required');
      return { success: false, exitCode: 1 };
    }

    const priority = ctx.flags.priority as string;
    const requireConsensus = ctx.flags.requireConsensus as boolean;
    const timeout = ctx.flags.timeout as number;

    output.printInfo('Submitting task to hive...');

    try {
      // #1791.1 — `hive-mind_task` was never registered in the bundled MCP
      // server (the `mcp__ruflo__hive-mind_*` surface only exposes init,
      // spawn, status, broadcast, consensus, memory, shutdown, leave). The
      // CLI was dispatching to a tool that doesn't exist, producing
      // `MCP tool not found: hive-mind_task` and aborting.
      //
      // Re-route to the existing `task_create` tool. Hive-specific options
      // (consensus requirement, timeout) are preserved as tags so a future
      // hive-mind worker / consensus tool can pick them up — the data is
      // not lost just because the dedicated hive-mind tool isn't there yet.
      const consensusTag = `consensus:${requireConsensus ? 'required' : 'none'}`;
      const timeoutTag = `timeout:${timeout}s`;

      const result = await callMCPTool<{
        taskId: string;
        type: string;
        description: string;
        priority: string;
        status: string;
        assignedTo: string[];
        tags: string[];
        createdAt: string;
      }>('task_create', {
        type: 'hive-mind',
        description,
        priority,
        tags: ['hive-mind', consensusTag, timeoutTag],
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `Task ID: ${result.taskId}`,
          `Status: ${formatAgentStatus(result.status)}`,
          `Priority: ${formatPriority(priority)}`,
          `Assigned: ${result.assignedTo.length > 0 ? result.assignedTo.join(', ') : 'pending dispatch'}`,
          `Consensus: ${requireConsensus ? 'Yes' : 'No'}`,
          `Timeout: ${timeout}s`,
          `Tags: ${result.tags.join(', ')}`
        ].join('\n'),
        'Task Submitted'
      );

      output.writeln();
      output.printSuccess('Task submitted to hive');
      output.writeln(output.dim(`  Track with: claude-flow hive-mind task-status ${result.taskId}`));

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Task submission error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Optimize memory subcommand
const optimizeMemoryCommand: Command = {
  name: 'optimize-memory',
  description: 'Optimize hive memory and patterns',
  options: [
    {
      name: 'aggressive',
      short: 'a',
      description: 'Aggressive optimization',
      type: 'boolean',
      default: false
    },
    {
      name: 'threshold',
      description: 'Quality threshold for pattern retention',
      type: 'number',
      default: 0.7
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const aggressive = ctx.flags.aggressive as boolean;
    const threshold = ctx.flags.threshold as number;

    output.printInfo('Optimizing hive memory...');

    const spinner = output.createSpinner({ text: 'Analyzing patterns...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await callMCPTool<{
        optimized: boolean;
        before: { patterns: number; memory: string };
        after: { patterns: number; memory: string };
        removed: number;
        consolidated: number;
        timeMs: number;
      }>('hive-mind_optimize-memory', {
        aggressive,
        qualityThreshold: threshold,
      });

      spinner.succeed('Memory optimized');

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 20 },
          { key: 'before', header: 'Before', width: 15, align: 'right' },
          { key: 'after', header: 'After', width: 15, align: 'right' }
        ],
        data: [
          { metric: 'Patterns', before: result.before.patterns, after: result.after.patterns },
          { metric: 'Memory', before: result.before.memory, after: result.after.memory }
        ]
      });

      output.writeln();
      output.printList([
        `Patterns removed: ${result.removed}`,
        `Patterns consolidated: ${result.consolidated}`,
        `Optimization time: ${result.timeMs}ms`
      ]);

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Optimization failed');
      if (error instanceof MCPClientError) {
        output.printError(`Optimization error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Join subcommand
const joinCommand: Command = {
  name: 'join',
  description: 'Join an agent to the hive mind',
  options: [
    { name: 'agent-id', short: 'a', description: 'Agent ID to join', type: 'string' },
    { name: 'role', short: 'r', description: 'Agent role (worker, specialist, scout)', type: 'string', default: 'worker' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentId = ctx.args[0] || ctx.flags['agent-id'] as string || ctx.flags.agentId as string;
    if (!agentId) {
      output.printError('Agent ID is required. Use --agent-id or -a flag, or provide as argument.');
      return { success: false, exitCode: 1 };
    }
    try {
      const result = await callMCPTool<{ success: boolean; agentId: string; totalWorkers: number; error?: string }>('hive-mind_join', { agentId, role: ctx.flags.role });
      if (!result.success) { output.printError(result.error || 'Failed'); return { success: false, exitCode: 1 }; }
      output.printSuccess(`Agent ${agentId} joined hive (${result.totalWorkers} workers)`);
      return { success: true, data: result };
    } catch (error) { output.printError(`Join error: ${error instanceof MCPClientError ? error.message : String(error)}`); return { success: false, exitCode: 1 }; }
  }
};

// Leave subcommand
const leaveCommand: Command = {
  name: 'leave',
  description: 'Remove an agent from the hive mind',
  options: [{ name: 'agent-id', short: 'a', description: 'Agent ID to remove', type: 'string' }],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentId = ctx.args[0] || ctx.flags['agent-id'] as string || ctx.flags.agentId as string;
    if (!agentId) { output.printError('Agent ID required.'); return { success: false, exitCode: 1 }; }
    try {
      const result = await callMCPTool<{ success: boolean; agentId: string; remainingWorkers: number; error?: string }>('hive-mind_leave', { agentId });
      if (!result.success) { output.printError(result.error || 'Failed'); return { success: false, exitCode: 1 }; }
      output.printSuccess(`Agent ${agentId} left hive (${result.remainingWorkers} remaining)`);
      return { success: true, data: result };
    } catch (error) { output.printError(`Leave error: ${error instanceof MCPClientError ? error.message : String(error)}`); return { success: false, exitCode: 1 }; }
  }
};

// Consensus subcommand
const consensusCommand: Command = {
  name: 'consensus',
  description: 'Manage consensus proposals and voting',
  options: [
    { name: 'action', short: 'a', description: 'Consensus action', type: 'string', choices: ['propose', 'vote', 'status', 'list'], default: 'list' },
    { name: 'proposal-id', short: 'p', description: 'Proposal ID', type: 'string' },
    { name: 'type', short: 't', description: 'Proposal type', type: 'string' },
    { name: 'value', description: 'Proposal value', type: 'string' },
    { name: 'vote', short: 'v', description: 'Vote (yes/no)', type: 'string' },
    { name: 'voter-id', description: 'Voter agent ID', type: 'string' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'list';
    try {
      const result = await callMCPTool<Record<string, unknown>>('hive-mind_consensus', { action, proposalId: ctx.flags.proposalId, type: ctx.flags.type, value: ctx.flags.value, vote: ctx.flags.vote === 'yes', voterId: ctx.flags.voterId });
      if (ctx.flags.format === 'json') { output.printJson(result); return { success: true, data: result }; }
      if (action === 'list') {
        output.writeln(output.bold('\nPending Proposals'));
        const pending = (result.pending as Array<Record<string, unknown>>) || [];
        if (pending.length === 0) output.printInfo('No pending proposals');
        else output.printTable({ columns: [{ key: 'proposalId', header: 'ID', width: 30 }, { key: 'type', header: 'Type', width: 12 }], data: pending });
      } else if (action === 'propose') { output.printSuccess(`Proposal created: ${result.proposalId}`); }
      else if (action === 'vote') { output.printSuccess(`Vote recorded (For: ${result.votesFor}, Against: ${result.votesAgainst})`); }
      return { success: true, data: result };
    } catch (error) { output.printError(`Consensus error: ${error instanceof MCPClientError ? error.message : String(error)}`); return { success: false, exitCode: 1 }; }
  }
};

// Broadcast subcommand
const broadcastCommand: Command = {
  name: 'broadcast',
  description: 'Broadcast a message to all workers in the hive',
  options: [
    { name: 'message', short: 'm', description: 'Message to broadcast', type: 'string', required: true },
    { name: 'priority', short: 'p', description: 'Message priority', type: 'string', choices: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    { name: 'from', short: 'f', description: 'Sender agent ID', type: 'string' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const message = ctx.args.join(' ') || ctx.flags.message as string;
    if (!message) { output.printError('Message required. Use --message or -m flag.'); return { success: false, exitCode: 1 }; }
    try {
      const result = await callMCPTool<{ success: boolean; messageId: string; recipients: number; error?: string }>('hive-mind_broadcast', { message, priority: ctx.flags.priority, fromId: ctx.flags.from });
      if (!result.success) { output.printError(result.error || 'Failed'); return { success: false, exitCode: 1 }; }
      output.printSuccess(`Message broadcast to ${result.recipients} workers (ID: ${result.messageId})`);
      return { success: true, data: result };
    } catch (error) { output.printError(`Broadcast error: ${error instanceof MCPClientError ? error.message : String(error)}`); return { success: false, exitCode: 1 }; }
  }
};

// Memory subcommand
const memorySubCommand: Command = {
  name: 'memory',
  description: 'Access hive shared memory',
  options: [
    { name: 'action', short: 'a', description: 'Memory action', type: 'string', choices: ['get', 'set', 'delete', 'list'], default: 'list' },
    { name: 'key', short: 'k', description: 'Memory key', type: 'string' },
    { name: 'value', short: 'v', description: 'Value to store', type: 'string' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = ctx.flags.action as string || 'list';
    const key = ctx.flags.key as string;
    const value = ctx.flags.value as string;
    if ((action === 'get' || action === 'delete') && !key) { output.printError('Key required for get/delete.'); return { success: false, exitCode: 1 }; }
    if (action === 'set' && (!key || value === undefined)) { output.printError('Key and value required for set.'); return { success: false, exitCode: 1 }; }
    try {
      const result = await callMCPTool<Record<string, unknown>>('hive-mind_memory', { action, key, value });
      if (ctx.flags.format === 'json') { output.printJson(result); return { success: true, data: result }; }
      if (action === 'list') {
        const keys = (result.keys as string[]) || [];
        output.writeln(output.bold(`\nShared Memory (${result.count} keys)`));
        if (keys.length === 0) output.printInfo('No keys in shared memory');
        else output.printList(keys.map(k => output.highlight(k)));
      } else if (action === 'get') {
        output.writeln(output.bold(`\nKey: ${key}`));
        output.writeln(result.exists ? `Value: ${JSON.stringify(result.value, null, 2)}` : 'Key not found');
      } else if (action === 'set') { output.printSuccess(`Set ${key} in shared memory`); }
      else if (action === 'delete') { output.printSuccess(result.deleted ? `Deleted ${key}` : `Key ${key} did not exist`); }
      return { success: true, data: result };
    } catch (error) { output.printError(`Memory error: ${error instanceof MCPClientError ? error.message : String(error)}`); return { success: false, exitCode: 1 }; }
  }
};

// Shutdown subcommand
const shutdownCommand: Command = {
  name: 'shutdown',
  description: 'Shutdown the hive mind',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force shutdown',
      type: 'boolean',
      default: false
    },
    {
      name: 'save-state',
      short: 's',
      description: 'Save state before shutdown',
      type: 'boolean',
      default: true
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const force = ctx.flags.force as boolean;
    const saveState = ctx.flags.saveState as boolean;

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: 'Shutdown the hive mind? All agents will be terminated.',
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.printInfo('Shutting down hive mind...');

    const spinner = output.createSpinner({ text: 'Graceful shutdown in progress...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await callMCPTool<{
        shutdown: boolean;
        agentsTerminated: number;
        stateSaved: boolean;
        shutdownTime: string;
      }>('hive-mind_shutdown', {
        force,
        saveState,
      });

      spinner.succeed('Hive mind shutdown complete');

      output.writeln();
      output.printList([
        `Agents terminated: ${result.agentsTerminated}`,
        `State saved: ${result.stateSaved ? 'Yes' : 'No'}`,
        `Shutdown time: ${result.shutdownTime}`
      ]);

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Shutdown failed');
      if (error instanceof MCPClientError) {
        output.printError(`Shutdown error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Main hive-mind command
export const hiveMindCommand: Command = {
  name: 'hive-mind',
  aliases: ['hive'],
  description: 'Queen-led consensus-based multi-agent coordination',
  subcommands: [initCommand, spawnCommand, statusCommand, taskCommand, joinCommand, leaveCommand, consensusCommand, broadcastCommand, memorySubCommand, optimizeMemoryCommand, shutdownCommand],
  options: [],
  examples: [
    { command: 'claude-flow hive-mind init -t hierarchical-mesh', description: 'Initialize hive' },
    { command: 'claude-flow hive-mind spawn -n 5', description: 'Spawn workers' },
    { command: 'claude-flow hive-mind spawn --claude -o "Build a feature"', description: 'Launch Claude Code with hive mind' },
    { command: 'claude-flow hive-mind task -d "Build feature"', description: 'Submit task' }
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Hive Mind - Consensus-Based Multi-Agent Coordination'));
    output.writeln();
    output.writeln('Usage: claude-flow hive-mind <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('init')}            - Initialize hive mind`,
      `${output.highlight('spawn')}           - Spawn worker agents (use --claude to launch Claude Code)`,
      `${output.highlight('status')}          - Show hive status`,
      `${output.highlight('task')}            - Submit task to hive`,
      `${output.highlight('join')}            - Join an agent to the hive`,
      `${output.highlight('leave')}           - Remove an agent from the hive`,
      `${output.highlight('consensus')}       - Manage consensus proposals`,
      `${output.highlight('broadcast')}       - Broadcast message to workers`,
      `${output.highlight('memory')}          - Access shared memory`,
      `${output.highlight('optimize-memory')} - Optimize patterns and memory`,
      `${output.highlight('shutdown')}        - Shutdown the hive`
    ]);
    output.writeln();
    output.writeln('Features:');
    output.printList([
      'Queen-led hierarchical coordination',
      'Byzantine fault tolerant consensus',
      'HNSW-accelerated pattern matching',
      'Cross-session memory persistence',
      'Automatic load balancing',
      output.success('NEW: --claude flag to launch interactive Claude Code sessions')
    ]);
    output.writeln();
    output.writeln('Quick Start with Claude Code:');
    output.writeln(output.dim('  claude-flow hive-mind init'));
    output.writeln(output.dim('  claude-flow hive-mind spawn -n 5 --claude -o "Your objective here"'));

    return { success: true };
  }
};


export default hiveMindCommand;

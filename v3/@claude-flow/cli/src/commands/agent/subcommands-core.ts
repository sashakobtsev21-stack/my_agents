/**
 * Agent core subcommands — spawn / list / status / stop.
 *
 * Extracted from agent.ts (W136, P3.20 cut #2).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { select, confirm, input } from '../../prompt.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';
import { updateSwarmActivityMetrics, AGENT_TYPES, getAgentCapabilities, formatStatus } from './helpers.js';

export const spawnCommand: Command = {
  name: 'spawn',
  description: 'Spawn a new agent',
  options: [
    {
      name: 'type',
      short: 't',
      description: 'Agent type to spawn',
      type: 'string',
      choices: AGENT_TYPES.map(a => a.value)
    },
    {
      name: 'name',
      short: 'n',
      description: 'Agent name/identifier',
      type: 'string'
    },
    {
      name: 'provider',
      short: 'p',
      description: 'Provider to use (anthropic, openrouter, ollama)',
      type: 'string',
      default: 'anthropic'
    },
    {
      name: 'model',
      short: 'm',
      description: 'Model to use',
      type: 'string'
    },
    {
      name: 'task',
      description: 'Initial task for the agent',
      type: 'string'
    },
    {
      name: 'timeout',
      description: 'Agent timeout in seconds',
      type: 'number',
      default: 300
    },
    {
      name: 'auto-tools',
      description: 'Enable automatic tool usage',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow agent spawn --type coder --name bot-1', description: 'Spawn a coder agent' },
    { command: 'claude-flow agent spawn -t researcher --task "Research React 19"', description: 'Spawn researcher with task' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let agentType = ctx.flags.type as string;
    let agentName = ctx.flags.name as string;

    // Interactive mode if type not specified
    if (!agentType && ctx.interactive) {
      agentType = await select({
        message: 'Select agent type:',
        options: AGENT_TYPES
      });
    }

    if (!agentType) {
      output.printError('Agent type is required. Use --type or -t flag.');
      return { success: false, exitCode: 1 };
    }

    // Generate name if not provided
    if (!agentName) {
      agentName = `${agentType}-${Date.now().toString(36)}`;
    }

    output.printInfo(`Spawning ${agentType} agent: ${output.highlight(agentName)}`);

    try {
      // Call MCP tool to spawn agent
      const result = await callMCPTool<{
        agentId: string;
        agentType: string;
        status: string;
        createdAt: string;
      }>('agent_spawn', {
        agentType,
        id: agentName,
        config: {
          provider: ctx.flags.provider || 'anthropic',
          model: ctx.flags.model,
          task: ctx.flags.task,
          timeout: ctx.flags.timeout,
          autoTools: ctx.flags.autoTools,
        },
        priority: 'normal',
        metadata: {
          name: agentName,
          capabilities: getAgentCapabilities(agentType),
        },
      });

      output.writeln();
      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 15 },
          { key: 'value', header: 'Value', width: 40 }
        ],
        data: [
          { property: 'ID', value: result.agentId },
          { property: 'Type', value: result.agentType },
          { property: 'Name', value: agentName },
          { property: 'Status', value: result.status },
          { property: 'Created', value: result.createdAt },
          { property: 'Capabilities', value: getAgentCapabilities(agentType).join(', ') }
        ]
      });

      output.writeln();
      output.printSuccess(`Agent ${agentName} spawned successfully`);

      // Update swarm-activity.json so statusline reflects the new agent count
      updateSwarmActivityMetrics(1);

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to spawn agent: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Agent list subcommand
export const listCommand: Command = {
  name: 'list',
  aliases: ['ls'],
  description: 'List all active agents',
  options: [
    {
      name: 'all',
      short: 'a',
      description: 'Include inactive agents',
      type: 'boolean',
      default: false
    },
    {
      name: 'type',
      short: 't',
      description: 'Filter by agent type',
      type: 'string'
    },
    {
      name: 'status',
      short: 's',
      description: 'Filter by status',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      // Call MCP tool to list agents
      const result = await callMCPTool<{
        agents: Array<{
          id: string;
          agentType: string;
          status: 'active' | 'idle' | 'terminated';
          createdAt: string;
          lastActivityAt?: string;
        }>;
        total: number;
      }>('agent_list', {
        status: ctx.flags.all ? 'all' : ctx.flags.status || undefined,
        agentType: ctx.flags.type || undefined,
        limit: 100,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Active Agents'));
      output.writeln();

      if (result.agents.length === 0) {
        output.printInfo('No agents found matching criteria');
        return { success: true, data: result };
      }

      // Format for display
      const displayAgents = result.agents.map(agent => ({
        id: agent.id,
        type: agent.agentType,
        status: agent.status,
        created: new Date(agent.createdAt).toLocaleTimeString(),
        lastActivity: agent.lastActivityAt
          ? new Date(agent.lastActivityAt).toLocaleTimeString()
          : 'N/A',
      }));

      output.printTable({
        columns: [
          { key: 'id', header: 'ID', width: 20 },
          { key: 'type', header: 'Type', width: 15 },
          { key: 'status', header: 'Status', width: 12, format: formatStatus },
          { key: 'created', header: 'Created', width: 12 },
          { key: 'lastActivity', header: 'Last Activity', width: 12 }
        ],
        data: displayAgents
      });

      output.writeln();
      output.printInfo(`Total: ${result.total} agents`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to list agents: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Agent status subcommand
export const statusCommand: Command = {
  name: 'status',
  description: 'Show detailed status of an agent',
  options: [
    {
      name: 'id',
      description: 'Agent ID',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let agentId = ctx.args[0] || ctx.flags.id as string;

    if (!agentId && ctx.interactive) {
      agentId = await input({
        message: 'Enter agent ID:',
        validate: (v) => v.length > 0 || 'Agent ID is required'
      });
    }

    if (!agentId) {
      output.printError('Agent ID is required');
      return { success: false, exitCode: 1 };
    }

    try {
      // Call MCP tool to get agent status
      const status = await callMCPTool<{
        id: string;
        agentType: string;
        status: 'active' | 'idle' | 'terminated';
        createdAt: string;
        lastActivityAt?: string;
        config?: Record<string, unknown>;
        metrics?: {
          tasksCompleted: number;
          tasksInProgress: number;
          tasksFailed: number;
          averageExecutionTime: number;
          uptime: number;
        };
      }>('agent_status', {
        agentId,
        includeMetrics: true,
        includeHistory: false,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(status);
        return { success: true, data: status };
      }

      output.writeln();
      output.printBox(
        [
          `Type: ${status.agentType}`,
          `Status: ${formatStatus(status.status)}`,
          `Created: ${new Date(status.createdAt).toLocaleString()}`,
          `Last Activity: ${status.lastActivityAt ? new Date(status.lastActivityAt).toLocaleString() : 'N/A'}`
        ].join('\n'),
        `Agent: ${status.id}`
      );

      if (status.metrics) {
        output.writeln();
        output.writeln(output.bold('Metrics'));
        const avgExecTime = status.metrics.averageExecutionTime ?? 0;
        const uptime = status.metrics.uptime ?? 0;
        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 15, align: 'right' }
          ],
          data: [
            { metric: 'Tasks Completed', value: status.metrics.tasksCompleted ?? 0 },
            { metric: 'Tasks In Progress', value: status.metrics.tasksInProgress ?? 0 },
            { metric: 'Tasks Failed', value: status.metrics.tasksFailed ?? 0 },
            { metric: 'Avg Execution Time', value: `${avgExecTime.toFixed(2)}ms` },
            { metric: 'Uptime', value: `${(uptime / 1000 / 60).toFixed(1)}m` }
          ]
        });
      }

      return { success: true, data: status };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get agent status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Agent stop subcommand
export const stopCommand: Command = {
  name: 'stop',
  aliases: ['kill'],
  description: 'Stop a running agent',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force stop without graceful shutdown',
      type: 'boolean',
      default: false
    },
    {
      name: 'timeout',
      description: 'Graceful shutdown timeout in seconds',
      type: 'number',
      default: 30
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentId = ctx.args[0];

    if (!agentId) {
      output.printError('Agent ID is required');
      return { success: false, exitCode: 1 };
    }

    const force = ctx.flags.force as boolean;

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: `Are you sure you want to stop agent ${agentId}?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.printInfo(`Stopping agent ${agentId}...`);

    try {
      // Call MCP tool to terminate agent
      const result = await callMCPTool<{
        agentId: string;
        terminated: boolean;
        terminatedAt: string;
      }>('agent_terminate', {
        agentId,
        graceful: !force,
        reason: 'Stopped by user via CLI',
      });

      if (!force) {
        output.writeln(output.dim('  Completing current task...'));
        output.writeln(output.dim('  Saving state...'));
        output.writeln(output.dim('  Releasing resources...'));
      }

      output.printSuccess(`Agent ${agentId} stopped successfully`);

      // Update swarm-activity.json so statusline reflects the reduced agent count
      updateSwarmActivityMetrics(-1);

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to stop agent: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};


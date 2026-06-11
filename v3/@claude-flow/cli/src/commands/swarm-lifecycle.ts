/**
 * Swarm Command — init / start / status subcommands
 *
 * Extracted verbatim from swarm.ts (lines 245-638) during campaign-2
 * wave 15 (W221). Module-private group.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { select, confirm } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import {
  STRATEGIES,
  TOPOLOGIES,
  getAgentPlan,
  getSwarmStatus,
} from './swarm-helpers.js';

export const initCommand: Command = {
  name: 'init',
  description: 'Initialize a new swarm',
  options: [
    {
      name: 'topology',
      short: 't',
      description: 'Swarm topology',
      type: 'string',
      choices: TOPOLOGIES.map(t => t.value),
      default: 'hierarchical'
    },
    {
      name: 'max-agents',
      short: 'm',
      description: 'Maximum number of agents',
      type: 'number',
      default: 15
    },
    {
      name: 'auto-scale',
      description: 'Enable automatic scaling',
      type: 'boolean',
      default: true
    },
    {
      name: 'strategy',
      short: 's',
      description: 'Coordination strategy',
      type: 'string',
      choices: STRATEGIES.map(s => s.value)
    },
    {
      name: 'v3-mode',
      description: 'Enable V3 15-agent hierarchical mesh mode',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let topology = ctx.flags.topology as string;
    const maxAgents = ctx.flags.maxAgents as number || 15;
    const v3Mode = ctx.flags.v3Mode as boolean;

    // V3 mode enables hierarchical-mesh hybrid
    if (v3Mode) {
      topology = 'hierarchical-mesh';
      output.printInfo('V3 Mode: Using hierarchical-mesh topology with 15-agent coordination');
    }

    // Interactive topology selection
    if (!topology && ctx.interactive) {
      topology = await select({
        message: 'Select swarm topology:',
        options: TOPOLOGIES,
        default: 'hierarchical'
      });
    }

    output.writeln();
    output.printInfo('Initializing swarm...');

    try {
      // Call MCP tool to initialize swarm
      const result = await callMCPTool<{
        swarmId: string;
        topology: string;
        initializedAt: string;
        config: {
          topology: string;
          maxAgents: number;
          currentAgents: number;
          communicationProtocol?: string;
          autoScaling?: boolean;
        };
      }>('swarm_init', {
        topology: topology as 'hierarchical' | 'mesh' | 'adaptive' | 'collective' | 'hierarchical-mesh',
        maxAgents,
        config: {
          communicationProtocol: 'message-bus',
          consensusMechanism: 'majority',
          failureHandling: 'retry',
          loadBalancing: true,
          autoScaling: ctx.flags.autoScale ?? true,
        },
        metadata: {
          v3Mode,
          strategy: ctx.flags.strategy || 'development',
        },
      });

      // Display initialization progress
      output.writeln(output.dim('  Creating coordination topology...'));
      output.writeln(output.dim('  Initializing memory namespace...'));
      output.writeln(output.dim('  Setting up communication channels...'));

      if (v3Mode) {
        output.writeln(output.dim('  Enabling Flash Attention (experimental)...'));
        output.writeln(output.dim('  Configuring AgentDB integration (HNSW ANN search)...'));
        output.writeln(output.dim('  Initializing SONA learning system...'));
      }

      output.writeln();
      output.printTable({
        columns: [
          { key: 'property', header: 'Property', width: 20 },
          { key: 'value', header: 'Value', width: 35 }
        ],
        data: [
          { property: 'Swarm ID', value: result.swarmId },
          { property: 'Topology', value: result.topology },
          { property: 'Max Agents', value: result.config.maxAgents },
          { property: 'Auto Scale', value: result.config.autoScaling ? 'Enabled' : 'Disabled' },
          { property: 'Protocol', value: result.config.communicationProtocol || 'N/A' },
          { property: 'V3 Mode', value: v3Mode ? 'Enabled' : 'Disabled' }
        ]
      });

      output.writeln();
      output.printSuccess('Swarm initialized successfully');

      // Save swarm state locally for status command to read
      const swarmDir = path.join(process.cwd(), '.swarm');
      try {
        if (!fs.existsSync(swarmDir)) {
          fs.mkdirSync(swarmDir, { recursive: true });
        }
        const stateFile = path.join(swarmDir, 'state.json');
        fs.writeFileSync(stateFile, JSON.stringify({
          id: result.swarmId,
          topology: result.topology,
          maxAgents: result.config.maxAgents,
          strategy: ctx.flags.strategy || 'development',
          v3Mode,
          initializedAt: result.initializedAt,
          status: 'ready'
        }, null, 2));
      } catch {
        // Ignore errors writing state file
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to initialize swarm: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Start swarm execution
export const startCommand: Command = {
  name: 'start',
  description: 'Start swarm execution',
  options: [
    {
      name: 'objective',
      short: 'o',
      description: 'Swarm objective/task',
      type: 'string',
      required: true
    },
    {
      name: 'strategy',
      short: 's',
      description: 'Execution strategy',
      type: 'string',
      choices: STRATEGIES.map(s => s.value)
    },
    {
      name: 'parallel',
      short: 'p',
      description: 'Enable parallel execution',
      type: 'boolean',
      default: true
    },
    {
      name: 'monitor',
      description: 'Enable real-time monitoring',
      type: 'boolean',
      default: true
    }
  ],
  examples: [
    { command: 'claude-flow swarm start -o "Build REST API" -s development', description: 'Start development swarm' },
    { command: 'claude-flow swarm start -o "Analyze codebase" --parallel', description: 'Parallel analysis' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const objective = ctx.args[0] || ctx.flags.objective as string;
    let strategy = ctx.flags.strategy as string;

    if (!objective) {
      output.printError('Objective is required. Use -o or provide as argument.');
      return { success: false, exitCode: 1 };
    }

    // Interactive strategy selection
    if (!strategy && ctx.interactive) {
      strategy = await select({
        message: 'Select execution strategy:',
        options: STRATEGIES,
        default: 'development'
      });
    }

    strategy = strategy || 'development';

    output.writeln();
    output.printInfo(`Starting swarm with objective: ${output.highlight(objective)}`);
    output.writeln();

    // Compute agent deployment plan based on strategy
    const agentPlan = getAgentPlan(strategy);

    output.writeln(output.bold('Agent Deployment Plan'));
    output.printTable({
      columns: [
        { key: 'role', header: 'Role', width: 20 },
        { key: 'type', header: 'Type', width: 15 },
        { key: 'count', header: 'Count', width: 8, align: 'right' },
        { key: 'purpose', header: 'Purpose', width: 30 }
      ],
      data: agentPlan
    });

    // Confirm execution
    if (ctx.interactive) {
      const confirmed = await confirm({
        message: `Deploy ${agentPlan.reduce((sum, a) => sum + a.count, 0)} agents?`,
        default: true
      });

      if (!confirmed) {
        output.printInfo('Swarm execution cancelled');
        return { success: true };
      }
    }

    // Initialize swarm via MCP and persist state (#1423: was stub-only, no actual execution)
    const swarmId = `swarm-${Date.now().toString(36)}`;
    const totalAgents = agentPlan.reduce((sum: number, a: { count: number }) => sum + a.count, 0);

    output.writeln();
    const spinner = output.createSpinner({ text: 'Initializing swarm via MCP...', spinner: 'dots' });
    spinner.start();

    try {
      // Actually call MCP to initialize the swarm. The result payload is
      // not consumed — success is signalled by the absence of a throw,
      // and the renderer reads back from MCP via swarm_status afterwards.
      await callMCPTool('swarm_init', {
        topology: 'hierarchical',
        maxAgents: totalAgents,
        strategy: strategy === 'development' ? 'specialized' : strategy,
      });
      spinner.succeed('Swarm initialized via MCP');
    } catch (err) {
      spinner.fail('MCP swarm_init failed — swarm metadata saved locally only');
      output.writeln(output.dim(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      output.writeln(output.dim('  The MCP server may not be running. Start it with: claude mcp add claude-flow npx claude-flow@v3alpha mcp start'));
    }

    // Persist swarm state to disk so `swarm status` can read it
    const swarmDir = path.join(process.cwd(), '.swarm');
    if (!fs.existsSync(swarmDir)) fs.mkdirSync(swarmDir, { recursive: true });

    const executionState = {
      swarmId,
      objective,
      strategy,
      status: 'initialized',
      agents: totalAgents,
      agentPlan,
      startedAt: new Date().toISOString(),
      parallel: ctx.flags.parallel ?? true
    };

    fs.writeFileSync(
      path.join(swarmDir, 'state.json'),
      JSON.stringify(executionState, null, 2)
    );

    output.writeln();
    output.printSuccess(`Swarm ${swarmId} initialized with ${totalAgents} agent slots`);
    output.writeln(output.dim('  This CLI coordinates agent state. Execution happens via:'));
    output.writeln(output.dim('  - Claude Code Agent tool (interactive)'));
    output.writeln(output.dim('  - claude -p (headless background)'));
    output.writeln(output.dim('  - hive-mind spawn --claude (autonomous)'));
    output.writeln(output.dim(`  Monitor: claude-flow swarm status ${swarmId}`));

    return { success: true, data: executionState };
  }
};

// Swarm status
export const statusCommand: Command = {
  name: 'status',
  description: 'Show swarm status',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const swarmId = ctx.args[0];

    // Get dynamic status from actual swarm state files
    const status = getSwarmStatus(swarmId);

    if (ctx.flags.format === 'json') {
      output.printJson(status);
      return { success: true, data: status };
    }

    output.writeln();

    // Show different message if no active swarm
    if (!status.hasActiveSwarm) {
      output.writeln(output.warning('No active swarm'));
      output.writeln();
      output.writeln(output.dim('Start a swarm with:'));
      output.writeln(output.dim('  npx @claude-flow/cli@latest swarm init'));
      output.writeln(output.dim('  npx @claude-flow/cli@latest swarm start'));
      output.writeln();
      return { success: true, data: status };
    }

    output.writeln(output.bold(`Swarm Status: ${status.id}`));
    output.writeln();

    // Progress bar
    output.writeln(`Overall Progress: ${output.progressBar(status.progress, 100, 40)}`);
    output.writeln();

    // Agent status
    output.writeln(output.bold('Agents'));
    output.printTable({
      columns: [
        { key: 'status', header: 'Status', width: 12 },
        { key: 'count', header: 'Count', width: 10, align: 'right' }
      ],
      data: [
        { status: output.success('Active'), count: status.agents.active },
        { status: output.warning('Idle'), count: status.agents.idle },
        { status: output.dim('Completed'), count: status.agents.completed },
        { status: 'Total', count: status.agents.total }
      ]
    });

    output.writeln();

    // Task status
    output.writeln(output.bold('Tasks'));
    output.printTable({
      columns: [
        { key: 'status', header: 'Status', width: 12 },
        { key: 'count', header: 'Count', width: 10, align: 'right' }
      ],
      data: [
        { status: output.success('Completed'), count: status.tasks.completed },
        { status: output.info('In Progress'), count: status.tasks.inProgress },
        { status: output.dim('Pending'), count: status.tasks.pending },
        { status: 'Total', count: status.tasks.total }
      ]
    });

    output.writeln();

    // Metrics
    output.writeln(output.bold('Performance Metrics'));
    output.printList([
      `Tokens Used: ${status.metrics.tokensUsed != null ? status.metrics.tokensUsed.toLocaleString() : output.dim('unknown')}`,
      `Avg Response Time: ${status.metrics.avgResponseTime ?? output.dim('no data')}`,
      `Success Rate: ${status.metrics.successRate ?? output.dim('no data')}`,
      `Elapsed Time: ${status.metrics.elapsedTime ?? output.dim('no data')}`
    ]);

    output.writeln();

    // Coordination stats
    output.writeln(output.bold('Coordination'));
    output.printList([
      `Consensus Rounds: ${status.coordination.consensusRounds}`,
      `Messages Sent: ${status.coordination.messagesSent}`,
      `Conflicts Resolved: ${status.coordination.conflictsResolved}`
    ]);

    return { success: true, data: status };
  }
};

// Stop swarm

/**
 * Hive-mind lifecycle subcommands — initialize a hive and spawn its
 * worker agents (optionally launching headless Claude Code instances).
 *
 *   - initCommand
 *   - spawnCommand
 *
 * Extracted from hive-mind.ts (W118, P3.14 cut #3).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { select, input } from '../../prompt.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';
import { TOPOLOGIES, CONSENSUS_STRATEGIES, spawnClaudeCodeInstance } from './spawn.js';
import type { HiveWorker } from './spawn.js';
import { formatAgentStatus } from './format.js';

// Init subcommand
export const initCommand: Command = {
  name: 'init',
  description: 'Initialize a hive mind',
  options: [
    {
      name: 'topology',
      short: 't',
      description: 'Hive topology',
      type: 'string',
      choices: TOPOLOGIES.map(t => t.value),
      default: 'hierarchical-mesh'
    },
    {
      name: 'consensus',
      short: 'c',
      description: 'Consensus strategy',
      type: 'string',
      choices: CONSENSUS_STRATEGIES.map(s => s.value),
      default: 'byzantine'
    },
    {
      name: 'max-agents',
      short: 'm',
      description: 'Maximum agents',
      type: 'number',
      default: 15
    },
    {
      name: 'persist',
      short: 'p',
      description: 'Enable persistent state',
      type: 'boolean',
      default: true
    },
    {
      name: 'memory-backend',
      description: 'Memory backend (agentdb, sqlite, hybrid)',
      type: 'string',
      default: 'hybrid'
    }
  ],
  examples: [
    { command: 'claude-flow hive-mind init -t hierarchical-mesh', description: 'Init hierarchical mesh' },
    { command: 'claude-flow hive-mind init -c byzantine -m 20', description: 'Init with Byzantine consensus' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let topology = ctx.flags.topology as string;
    let consensus = ctx.flags.consensus as string;

    if (ctx.interactive && !ctx.flags.topology) {
      topology = await select({
        message: 'Select hive topology:',
        options: TOPOLOGIES,
        default: 'hierarchical-mesh'
      });
    }

    if (ctx.interactive && !ctx.flags.consensus) {
      consensus = await select({
        message: 'Select consensus strategy:',
        options: CONSENSUS_STRATEGIES,
        default: 'byzantine'
      });
    }

    const config = {
      topology: topology || 'hierarchical-mesh',
      consensus: consensus || 'byzantine',
      maxAgents: ctx.flags.maxAgents as number || 15,
      persist: ctx.flags.persist as boolean,
      memoryBackend: ctx.flags.memoryBackend as string || 'hybrid'
    };

    output.writeln();
    output.writeln(output.bold('Initializing Hive Mind'));

    const spinner = output.createSpinner({ text: 'Setting up hive infrastructure...', spinner: 'dots' });
    spinner.start();

    try {
      const result = await callMCPTool<{
        hiveId: string;
        topology: string;
        consensus: string;
        queenId: string;
        status: 'initialized' | 'ready';
        config: typeof config;
      }>('hive-mind_init', config);

      spinner.succeed('Hive Mind initialized');

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `Hive ID: ${result.hiveId ?? 'default'}`,
          `Queen ID: ${result.queenId ?? 'N/A'}`,
          `Topology: ${result.topology ?? config.topology}`,
          `Consensus: ${result.consensus ?? config.consensus}`,
          `Max Agents: ${config.maxAgents}`,
          `Memory: ${config.memoryBackend}`,
          `Status: ${output.success(result.status ?? 'initialized')}`
        ].join('\n'),
        'Hive Mind Configuration'
      );

      output.writeln();
      output.printInfo('Queen agent is ready to coordinate worker agents');
      output.writeln(output.dim('  Use "claude-flow hive-mind spawn" to add workers'));
      output.writeln(output.dim('  Use "claude-flow hive-mind spawn --claude" to launch Claude Code'));

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Failed to initialize');
      if (error instanceof MCPClientError) {
        output.printError(`Init error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Spawn subcommand - UPDATED with --claude flag
export const spawnCommand: Command = {
  name: 'spawn',
  description: 'Spawn worker agents into the hive (use --claude to launch Claude Code)',
  options: [
    {
      name: 'count',
      short: 'n',
      description: 'Number of workers to spawn',
      type: 'number',
      default: 1
    },
    {
      name: 'role',
      short: 'r',
      description: 'Worker role (worker, specialist, scout)',
      type: 'string',
      choices: ['worker', 'specialist', 'scout'],
      default: 'worker'
    },
    {
      name: 'type',
      short: 't',
      description: 'Agent type',
      type: 'string',
      default: 'worker'
    },
    {
      name: 'prefix',
      short: 'p',
      description: 'Prefix for worker IDs',
      type: 'string',
      default: 'hive-worker'
    },
    // NEW: --claude flag for launching Claude Code
    {
      name: 'claude',
      description: 'Launch Claude Code with hive-mind coordination prompt',
      type: 'boolean',
      default: false
    },
    {
      name: 'objective',
      short: 'o',
      description: 'Objective for the hive mind (used with --claude)',
      type: 'string'
    },
    {
      name: 'dangerously-skip-permissions',
      description: 'Skip permission prompts in Claude Code (use with caution)',
      type: 'boolean',
      default: true
    },
    {
      name: 'no-auto-permissions',
      description: 'Disable automatic permission skipping',
      type: 'boolean',
      default: false
    },
    {
      name: 'dry-run',
      description: 'Show what would be done without launching Claude Code',
      type: 'boolean',
      default: false
    },
    {
      name: 'non-interactive',
      description: 'Run Claude Code in non-interactive mode',
      type: 'boolean',
      default: false
    },
    {
      name: 'mcp-config',
      description: 'Path to .mcp.json for the spawned worker (auto-detects ./.mcp.json or ~/.claude.json if omitted) — fixes #1748 Issue 2',
      type: 'string'
    }
  ],
  examples: [
    { command: 'claude-flow hive-mind spawn -n 5', description: 'Spawn 5 workers' },
    { command: 'claude-flow hive-mind spawn -n 3 -r specialist', description: 'Spawn 3 specialists' },
    { command: 'claude-flow hive-mind spawn -t coder -p my-coder', description: 'Spawn coder with custom prefix' },
    { command: 'claude-flow hive-mind spawn --claude -o "Build a REST API"', description: 'Launch Claude Code with objective' },
    { command: 'claude-flow hive-mind spawn -n 5 --claude -o "Research AI patterns"', description: 'Spawn workers and launch Claude Code' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Parse count with fallback to default
    const count = (ctx.flags.count as number) || 1;
    const role = (ctx.flags.role as string) || 'worker';
    const agentType = (ctx.flags.type as string) || 'worker';
    const prefix = (ctx.flags.prefix as string) || 'hive-worker';
    const launchClaude = ctx.flags.claude as boolean;
    let objective = (ctx.flags.objective as string) || ctx.args.join(' ');

    output.printInfo(`Spawning ${count} ${role} agent(s)...`);

    try {
      const result = await callMCPTool<{
        success: boolean;
        spawned: number;
        workers: Array<{
          agentId: string;
          role: string;
          joinedAt: string;
        }>;
        totalWorkers: number;
        hiveStatus: string;
        hiveId?: string;
        message: string;
        error?: string;
      }>('hive-mind_spawn', {
        count,
        role,
        agentType,
        prefix,
      });

      // Check for errors from MCP tool
      if (!result.success) {
        output.printError(result.error || 'Failed to spawn workers');
        return { success: false, exitCode: 1 };
      }

      if (ctx.flags.format === 'json' && !launchClaude) {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();

      // Transform workers array to display format
      const displayData = (result.workers || []).map(w => ({
        id: w.agentId,
        role: w.role,
        status: 'idle',
        joinedAt: new Date(w.joinedAt).toLocaleTimeString()
      }));

      output.printTable({
        columns: [
          { key: 'id', header: 'Agent ID', width: 30 },
          { key: 'role', header: 'Role', width: 12 },
          { key: 'status', header: 'Status', width: 10, format: formatAgentStatus },
          { key: 'joinedAt', header: 'Joined', width: 12 }
        ],
        data: displayData
      });

      output.writeln();
      output.printSuccess(`Spawned ${result.spawned} agent(s)`);
      output.writeln(output.dim(`  Total workers in hive: ${result.totalWorkers}`));

      // NEW: Handle --claude flag
      if (launchClaude) {
        // Get objective if not provided
        if (!objective && ctx.interactive) {
          objective = await input({
            message: 'Enter the objective for the hive mind:',
            validate: (v) => v.length > 0 || 'Objective is required when using --claude'
          });
        }

        if (!objective) {
          output.writeln();
          output.printWarning('No objective provided. Using default objective.');
          objective = 'Coordinate the hive mind workers to complete tasks efficiently.';
        }

        // Get hive status for swarm info
        let swarmId = result.hiveId || 'default';
        let swarmName = 'Hive Mind Swarm';

        try {
          const statusResult = await callMCPTool<{
            hiveId?: string;
            topology?: string;
            consensus?: string;
          }>('hive-mind_status', { includeWorkers: false });
          swarmId = statusResult.hiveId || swarmId;
        } catch {
          // Use defaults if status call fails
        }

        // Convert workers to expected format
        const workers: HiveWorker[] = (result.workers || []).map(w => ({
          agentId: w.agentId,
          role: w.role,
          type: agentType,
          joinedAt: w.joinedAt
        }));

        // Launch Claude Code with hive mind prompt
        const claudeResult = await spawnClaudeCodeInstance(
          swarmId,
          swarmName,
          objective,
          workers,
          ctx.flags as Record<string, unknown>
        );

        if (!claudeResult.success) {
          return { success: false, exitCode: 1, data: { spawn: result, claude: claudeResult } };
        }

        return { success: true, data: { spawn: result, claude: claudeResult } };
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Spawn error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

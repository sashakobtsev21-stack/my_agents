/**
 * V3 CLI Status Command
 * System status display for Claude Flow
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Helpers/subcommands extracted into ./status-helpers.ts and
// ./status-subcommands.ts during campaign-2 wave 71 (W277). The watch
// loop + statusAction stay here with the public command.
import {
  DEFAULT_WATCH_INTERVAL,
  displayStatus,
  getSystemStatus,
  isInitialized,
} from './status-helpers.js';
import { agentsCommand, memoryCommand, tasksCommand } from './status-subcommands.js';

const statusAction = async (ctx: CommandContext): Promise<CommandResult> => {
  const watch = ctx.flags.watch as boolean;
  const interval = (ctx.flags.interval as number) || DEFAULT_WATCH_INTERVAL / 1000;
  const healthCheck = ctx.flags['health-check'] as boolean;
  const cwd = ctx.cwd;

  // Check initialization
  if (!isInitialized(cwd)) {
    output.printError('AlexKo is not initialized in this directory');
    output.printInfo('Run "ruflo init" to initialize');
    return { success: false, exitCode: 1 };
  }

  // Get status
  const status = await getSystemStatus();

  // Health check mode
  if (healthCheck) {
    return performHealthCheck(status);
  }

  // JSON output
  if (ctx.flags.format === 'json') {
    output.printJson(status);
    return { success: true, data: status };
  }

  // Watch mode
  if (watch) {
    return watchStatus(interval);
  }

  // Single status display
  displayStatus(status);

  return { success: true, data: status };
};

// Perform health checks
async function performHealthCheck(
  status: Awaited<ReturnType<typeof getSystemStatus>>
): Promise<CommandResult> {
  output.writeln();
  output.writeln(output.bold('Health Check'));
  output.writeln();

  const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  // Check if system is running
  checks.push({
    name: 'System Running',
    status: status.running ? 'pass' : 'fail',
    message: status.running ? 'System is running' : 'System is not running'
  });

  // Check swarm health
  if (status.running) {
    checks.push({
      name: 'Swarm Health',
      status: status.swarm.health === 'healthy' ? 'pass' :
              status.swarm.health === 'degraded' ? 'warn' : 'fail',
      message: `Swarm is ${status.swarm.health}`
    });

    // Check agent count
    checks.push({
      name: 'Agents Available',
      status: status.swarm.agents.active > 0 ? 'pass' :
              status.swarm.agents.idle > 0 ? 'warn' : 'fail',
      message: `${status.swarm.agents.active} active, ${status.swarm.agents.idle} idle`
    });

    // Check MCP
    checks.push({
      name: 'MCP Server',
      status: status.mcp.running ? 'pass' : 'warn',
      message: status.mcp.running
        ? (status.mcp.transport === 'stdio' ? 'Running (stdio mode)' : `Running on port ${status.mcp.port}`)
        : 'Not running'
    });

    // Check memory backend
    checks.push({
      name: 'Memory Backend',
      status: status.memory.backend !== 'none' ? 'pass' : 'fail',
      message: `Using ${status.memory.backend} backend`
    });

    // Check for failed tasks
    const failRate = status.tasks.total > 0
      ? status.tasks.failed / status.tasks.total
      : 0;
    checks.push({
      name: 'Task Success Rate',
      status: failRate < 0.05 ? 'pass' : failRate < 0.2 ? 'warn' : 'fail',
      message: `${((1 - failRate) * 100).toFixed(1)}% success rate`
    });
  }

  // Display results
  for (const check of checks) {
    const icon = check.status === 'pass' ? output.success('[PASS]') :
                 check.status === 'warn' ? output.warning('[WARN]') :
                 output.error('[FAIL]');
    output.writeln(`${icon} ${check.name}: ${check.message}`);
  }

  output.writeln();

  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  if (failed === 0) {
    output.printSuccess(`All checks passed (${passed} passed, ${warned} warnings)`);
  } else {
    output.printError(`Health check failed (${passed} passed, ${warned} warnings, ${failed} failed)`);
  }

  return {
    success: failed === 0,
    exitCode: failed > 0 ? 1 : 0,
    data: { checks, summary: { passed, warned, failed } }
  };
}

// Watch mode - continuous status updates
async function watchStatus(intervalSeconds: number): Promise<CommandResult> {
  output.writeln();
  output.writeln(output.bold('Watch Mode'));
  output.writeln(output.dim(`Refreshing every ${intervalSeconds}s. Press Ctrl+C to exit.`));
  output.writeln();

  const refresh = async () => {
    // Clear screen
    process.stdout.write('\x1b[2J\x1b[H');

    output.writeln(output.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
    output.writeln();

    const status = await getSystemStatus();
    displayStatus(status);
  };

  // Initial display
  await refresh();

  // Set up interval
  const intervalId = setInterval(refresh, intervalSeconds * 1000);

  // Handle exit
  return new Promise((resolve) => {
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      output.writeln();
      output.printInfo('Watch mode stopped');
      resolve({ success: true });
    });
  });
}

// Agents subcommand

export const statusCommand: Command = {
  name: 'status',
  description: 'Show system status',
  subcommands: [agentsCommand, tasksCommand, memoryCommand],
  options: [
    {
      name: 'watch',
      short: 'w',
      description: 'Watch mode - continuously update status',
      type: 'boolean',
      default: false
    },
    {
      name: 'interval',
      short: 'i',
      description: 'Watch mode update interval in seconds',
      type: 'number',
      default: 2
    },
    {
      name: 'health-check',
      description: 'Perform health checks and exit',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow status', description: 'Show current system status' },
    { command: 'claude-flow status --watch', description: 'Watch mode with live updates' },
    { command: 'claude-flow status --watch -i 5', description: 'Watch mode updating every 5 seconds' },
    { command: 'claude-flow status --health-check', description: 'Run health checks' },
    { command: 'claude-flow status --json', description: 'Output status as JSON' },
    { command: 'claude-flow status agents', description: 'Show detailed agent status' },
    { command: 'claude-flow status tasks', description: 'Show detailed task status' },
    { command: 'claude-flow status memory', description: 'Show detailed memory status' }
  ],
  action: statusAction
};

export default statusCommand;

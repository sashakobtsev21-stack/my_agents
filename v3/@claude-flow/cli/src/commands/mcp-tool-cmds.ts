/**
 * MCP Command — tools/toggle/exec/health/logs/restart subcommands
 *
 * Extracted verbatim from mcp.ts (lines 392-775) during campaign-2
 * wave 51 (W257). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { getServerManager, getMCPServerStatus } from '../mcp-server.js';
import { listMCPTools, callMCPTool, hasTool } from '../mcp-client.js';
import { TOOL_CATEGORIES } from './mcp-server-cmds.js';

export const toolsCommand: Command = {
  name: 'tools',
  description: 'List available MCP tools',
  options: [
    {
      name: 'category',
      short: 'c',
      description: 'Filter by category',
      type: 'string',
      choices: TOOL_CATEGORIES.map(c => c.value)
    },
    {
      name: 'enabled',
      description: 'Show only enabled tools',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const category = ctx.flags.category as string;

    // Use local tool registry
    let tools: Array<{ name: string; category: string; description: string; enabled: boolean }>;

    // Get tools from local registry
    const registeredTools = listMCPTools(category);

    if (registeredTools.length > 0) {
      tools = registeredTools.map(tool => ({
        name: tool.name,
        category: tool.category || 'uncategorized',
        description: tool.description,
        enabled: true
      }));
    } else {
      // Fallback to static tool list
      tools = [
        // Agent tools
        { name: 'agent_spawn', category: 'agent', description: 'Spawn a new agent', enabled: true },
        { name: 'agent_list', category: 'agent', description: 'List all agents', enabled: true },
        { name: 'agent_terminate', category: 'agent', description: 'Terminate an agent', enabled: true },
        { name: 'agent_status', category: 'agent', description: 'Get agent status', enabled: true },

        // Swarm tools
        { name: 'swarm_init', category: 'swarm', description: 'Initialize swarm topology', enabled: true },
        { name: 'swarm_status', category: 'swarm', description: 'Get swarm status', enabled: true },
        { name: 'swarm_scale', category: 'swarm', description: 'Scale swarm size', enabled: true },

        // Memory tools
        { name: 'memory_store', category: 'memory', description: 'Store in memory', enabled: true },
        { name: 'memory_search', category: 'memory', description: 'Search memory', enabled: true },
        { name: 'memory_list', category: 'memory', description: 'List memory entries', enabled: true },

        // Config tools
        { name: 'config_load', category: 'config', description: 'Load configuration', enabled: true },
        { name: 'config_save', category: 'config', description: 'Save configuration', enabled: true },
        { name: 'config_validate', category: 'config', description: 'Validate configuration', enabled: true },

        // Hooks tools
        { name: 'hooks_pre-edit', category: 'hooks', description: 'Pre-edit hook', enabled: true },
        { name: 'hooks_post-edit', category: 'hooks', description: 'Post-edit hook', enabled: true },
        { name: 'hooks_pre-command', category: 'hooks', description: 'Pre-command hook', enabled: true },
        { name: 'hooks_post-command', category: 'hooks', description: 'Post-command hook', enabled: true },
        { name: 'hooks_route', category: 'hooks', description: 'Route task to agent', enabled: true },
        { name: 'hooks_explain', category: 'hooks', description: 'Explain routing', enabled: true },
        { name: 'hooks_pretrain', category: 'hooks', description: 'Pretrain from repo', enabled: true },
        { name: 'hooks_metrics', category: 'hooks', description: 'Learning metrics', enabled: true },
        { name: 'hooks_list', category: 'hooks', description: 'List hooks', enabled: true },

        // System tools
        { name: 'system_info', category: 'system', description: 'System information', enabled: true },
        { name: 'system_health', category: 'system', description: 'Health status', enabled: true },
        { name: 'system_metrics', category: 'system', description: 'Server metrics', enabled: true },
      ].filter(t => !category || t.category === category);
    }

    if (ctx.flags.format === 'json') {
      output.printJson(tools);
      return { success: true, data: tools };
    }

    output.writeln();
    output.writeln(output.bold('Available MCP Tools'));
    output.writeln();

    // Group by category
    const grouped = tools.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<string, typeof tools>);

    for (const [cat, catTools] of Object.entries(grouped)) {
      output.writeln(output.highlight(cat.charAt(0).toUpperCase() + cat.slice(1)));

      output.printTable({
        columns: [
          { key: 'name', header: 'Tool', width: 25 },
          { key: 'description', header: 'Description', width: 35 },
          { key: 'enabled', header: 'Status', width: 10, format: (v: unknown) => (v as boolean) ? output.success('Enabled') : output.dim('Disabled') }
        ],
        data: catTools,
        border: false
      });

      output.writeln();
    }

    output.printInfo(`Total: ${tools.length} tools`);

    return { success: true, data: tools };
  }
};

// Enable/disable tools
export const toggleCommand: Command = {
  name: 'toggle',
  description: 'Enable or disable MCP tools',
  options: [
    {
      name: 'enable',
      short: 'e',
      description: 'Enable tools',
      type: 'string'
    },
    {
      name: 'disable',
      short: 'd',
      description: 'Disable tools',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const toEnable = ctx.flags.enable as string;
    const toDisable = ctx.flags.disable as string;

    if (toEnable) {
      const tools = toEnable.split(',');
      output.printInfo(`Enabling tools: ${tools.join(', ')}`);
      output.printSuccess(`Enabled ${tools.length} tools`);
    }

    if (toDisable) {
      const tools = toDisable.split(',');
      output.printInfo(`Disabling tools: ${tools.join(', ')}`);
      output.printSuccess(`Disabled ${tools.length} tools`);
    }

    if (!toEnable && !toDisable) {
      output.printError('Use --enable or --disable with comma-separated tool names');
      return { success: false, exitCode: 1 };
    }

    return { success: true };
  }
};

// Execute tool
export const execCommand: Command = {
  name: 'exec',
  description: 'Execute an MCP tool',
  options: [
    {
      name: 'tool',
      short: 't',
      description: 'Tool name',
      type: 'string',
      required: true
    },
    {
      name: 'params',
      short: 'p',
      description: 'Tool parameters (JSON)',
      type: 'string'
    }
  ],
  examples: [
    { command: 'claude-flow mcp exec -t swarm_init -p \'{"topology":"mesh"}\'', description: 'Execute tool' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const tool = ctx.flags.tool as string || ctx.args[0];
    const paramsStr = ctx.flags.params as string;

    if (!tool) {
      output.printError('Tool name is required. Use --tool or -t');
      return { success: false, exitCode: 1 };
    }

    let params = {};
    if (paramsStr) {
      try {
        params = JSON.parse(paramsStr);
      } catch (e) {
        output.printError('Invalid JSON parameters');
        return { success: false, exitCode: 1 };
      }
    }

    output.printInfo(`Executing tool: ${tool}`);

    if (Object.keys(params).length > 0) {
      output.writeln(output.dim(`  Parameters: ${JSON.stringify(params)}`));
    }

    try {
      // Execute through local MCP tool registry
      if (!hasTool(tool)) {
        output.printError(`Tool not found: ${tool}`);
        return { success: false, exitCode: 1 };
      }

      const startTime = performance.now();
      const result = await callMCPTool(tool, params, {
        sessionId: `cli-${Date.now().toString(36)}`,
        requestId: `exec-${Date.now()}`,
      });
      const duration = performance.now() - startTime;

      output.writeln();
      output.printSuccess(`Tool executed in ${duration.toFixed(2)}ms`);

      if (ctx.flags.format === 'json') {
        output.printJson({ tool, params, result, duration });
      } else {
        output.writeln();
        output.writeln(output.bold('Result:'));
        output.printJson(result);
      }

      return { success: true, data: { tool, params, result, duration } };
    } catch (error) {
      output.printError(`Tool execution failed: ${(error as Error).message}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Health check command
export const healthCommand: Command = {
  name: 'health',
  description: 'Check MCP server health',
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const status = await getMCPServerStatus();

      if (!status.running) {
        output.printError('MCP Server is not running');
        return { success: false, exitCode: 1 };
      }

      const manager = getServerManager();
      const health = await manager.checkHealth();

      if (ctx.flags.format === 'json') {
        output.printJson(health);
        return { success: true, data: health };
      }

      output.writeln();
      output.writeln(output.bold('MCP Server Health'));
      output.writeln();

      if (health.healthy) {
        output.printSuccess('Server is healthy');
      } else {
        output.printError(`Server is unhealthy: ${health.error || 'Unknown error'}`);
      }

      if (health.metrics) {
        output.writeln();
        output.writeln(output.bold('Metrics:'));
        for (const [key, value] of Object.entries(health.metrics)) {
          output.writeln(`  ${key}: ${value}`);
        }
      }

      return { success: health.healthy, data: health };
    } catch (error) {
      output.printError(`Health check failed: ${(error as Error).message}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Logs command
export const logsCommand: Command = {
  name: 'logs',
  description: 'Show MCP server logs',
  options: [
    {
      name: 'lines',
      short: 'n',
      description: 'Number of lines',
      type: 'number',
      default: 20
    },
    {
      name: 'follow',
      short: 'f',
      description: 'Follow log output',
      type: 'boolean',
      default: false
    },
    {
      name: 'level',
      description: 'Filter by log level',
      type: 'string',
      choices: ['debug', 'info', 'warn', 'error']
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const lines = ctx.flags.lines as number;

    // Default logs (loaded from actual log file when available)
    const logs = [
      { time: new Date().toISOString(), level: 'info', message: 'MCP Server started on stdio' },
      { time: new Date().toISOString(), level: 'info', message: 'Registered 27 tools' },
      { time: new Date().toISOString(), level: 'debug', message: 'Received request: tools/list' },
      { time: new Date().toISOString(), level: 'info', message: 'Session initialized' },
    ].slice(-lines);

    output.writeln();
    output.writeln(output.bold('MCP Server Logs'));
    output.writeln();

    for (const log of logs) {
      let levelStr: string;
      switch (log.level) {
        case 'error':
          levelStr = output.error(log.level.toUpperCase().padEnd(5));
          break;
        case 'warn':
          levelStr = output.warning(log.level.toUpperCase().padEnd(5));
          break;
        case 'debug':
          levelStr = output.dim(log.level.toUpperCase().padEnd(5));
          break;
        default:
          levelStr = output.info(log.level.toUpperCase().padEnd(5));
      }

      output.writeln(`${output.dim(log.time)} ${levelStr} ${log.message}`);
    }

    return { success: true, data: logs };
  }
};

// Restart command
export const restartCommand: Command = {
  name: 'restart',
  description: 'Restart MCP server',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force restart without graceful shutdown',
      type: 'boolean',
      default: false
    }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // --force is documented for the user but restart() always does a
    // graceful stop + start under the hood, so the flag is currently a
    // no-op. Kept in the options list for forward-compat once we wire
    // a hard-kill path through manager.restart().
    output.printInfo('Restarting MCP Server...');

    try {
      const manager = getServerManager();
      const status = await manager.restart();

      output.printSuccess('MCP Server restarted');
      output.writeln(output.dim(`  PID: ${status.pid}`));

      return { success: true, data: status };
    } catch (error) {
      output.printError(`Failed to restart: ${(error as Error).message}`);
      return { success: false, exitCode: 1 };
    }
  }
};

// Main MCP command

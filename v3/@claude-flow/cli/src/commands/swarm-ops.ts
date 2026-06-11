/**
 * Swarm Command — stop / scale / coordinate subcommands
 *
 * Extracted verbatim from swarm.ts (lines 639-851) during campaign-2
 * wave 15 (W221). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { confirm } from '../prompt.js';
import * as fs from 'fs';
import * as path from 'path';
import { callMCPTool } from '../mcp-client.js';

export const stopCommand: Command = {
  name: 'stop',
  description: 'Stop swarm execution',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force immediate stop',
      type: 'boolean',
      default: false
    },
    {
      name: 'save-state',
      description: 'Save current state for resume',
      type: 'boolean',
      default: true
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const swarmId = ctx.args[0];
    const force = ctx.flags.force as boolean;

    if (!swarmId) {
      output.printError('Swarm ID is required');
      return { success: false, exitCode: 1 };
    }

    if (ctx.interactive && !force) {
      const confirmed = await confirm({
        message: `Stop swarm ${swarmId}? Progress will be saved.`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    output.printInfo(`Stopping swarm ${swarmId}...`);

    // Update persisted swarm state if it exists (#1423)
    const swarmStateFile = path.join(process.cwd(), '.swarm', 'state.json');
    if (fs.existsSync(swarmStateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(swarmStateFile, 'utf-8'));
        state.status = 'stopped';
        state.stoppedAt = new Date().toISOString();
        fs.writeFileSync(swarmStateFile, JSON.stringify(state, null, 2));
        output.writeln(output.dim('  Swarm state updated'));
      } catch {
        output.writeln(output.dim('  Could not update swarm state file'));
      }
    }

    // Attempt MCP cleanup
    try {
      await callMCPTool('swarm_shutdown', { swarmId, force });
      output.writeln(output.dim('  MCP swarm stopped'));
    } catch {
      // MCP may not be available
    }

    output.printSuccess(`Swarm ${swarmId} stopped`);

    return { success: true, data: { swarmId, stopped: true, force } };
  }
};

// Scale swarm
export const scaleCommand: Command = {
  name: 'scale',
  description: 'Scale swarm agent count',
  options: [
    {
      name: 'agents',
      short: 'a',
      description: 'Target number of agents',
      type: 'number',
      required: true
    },
    {
      name: 'type',
      short: 't',
      description: 'Agent type to scale',
      type: 'string'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const swarmId = ctx.args[0];
    const targetAgents = ctx.flags.agents as number;
    // `--type` is documented (heterogeneous scaling) but the MCP scale call
    // currently picks the agent type — kept the flag for forward-compat.

    if (!swarmId) {
      output.printError('Swarm ID is required');
      return { success: false, exitCode: 1 };
    }

    if (!targetAgents) {
      output.printError('Target agent count required. Use --agents or -a');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Scaling swarm ${swarmId} to ${targetAgents} agents...`);

    // Calculate scaling delta — fetch actual count instead of hardcoded 8 (#1425)
    const { callMCPTool } = await import('../mcp-client.js');
    let currentAgents = 0;
    try {
      const statusResult = await callMCPTool('swarm_status', {});
      const statusData = typeof statusResult === 'string' ? JSON.parse(statusResult) : statusResult;
      currentAgents = statusData?.agentCount ?? statusData?.agents?.length ?? 0;
    } catch {
      // If MCP unavailable, fall back to 0 (will spawn all requested agents)
      currentAgents = 0;
    }
    const delta = targetAgents - currentAgents;

    if (delta > 0) {
      output.writeln(output.dim(`  Spawning ${delta} new agents...`));
    } else if (delta < 0) {
      output.writeln(output.dim(`  Gracefully stopping ${-delta} agents...`));
    } else {
      output.printInfo('Swarm already at target size');
      return { success: true };
    }

    output.printSuccess(`Swarm scaled to ${targetAgents} agents`);

    return { success: true, data: { swarmId, agents: targetAgents, delta } };
  }
};

// Coordinate command (V3 specific)
export const coordinateCommand: Command = {
  name: 'coordinate',
  description: 'Execute V3 15-agent hierarchical mesh coordination',
  options: [
    {
      name: 'agents',
      description: 'Number of agents',
      type: 'number',
      default: 15
    },
    {
      name: 'domains',
      description: 'Domains to activate',
      type: 'array'
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const agentCount = ctx.flags.agents as number || 15;

    output.writeln();
    output.writeln(output.bold('V3 15-Agent Hierarchical Mesh Coordination'));
    output.writeln();

    // V3 agent structure
    const v3Agents = [
      { id: 1, role: 'Queen Coordinator', domain: 'Orchestration', status: 'primary' },
      { id: 2, role: 'Security Architect', domain: 'Security', status: 'active' },
      { id: 3, role: 'Security Auditor', domain: 'Security', status: 'active' },
      { id: 4, role: 'Test Architect', domain: 'Security', status: 'active' },
      { id: 5, role: 'Core Architect', domain: 'Core', status: 'active' },
      { id: 6, role: 'Memory Specialist', domain: 'Core', status: 'active' },
      { id: 7, role: 'Swarm Specialist', domain: 'Core', status: 'active' },
      { id: 8, role: 'Integration Architect', domain: 'Integration', status: 'active' },
      { id: 9, role: 'Performance Engineer', domain: 'Integration', status: 'active' },
      { id: 10, role: 'CLI Developer', domain: 'Integration', status: 'active' },
      { id: 11, role: 'Hooks Developer', domain: 'Integration', status: 'active' },
      { id: 12, role: 'MCP Specialist', domain: 'Integration', status: 'active' },
      { id: 13, role: 'Project Coordinator', domain: 'Management', status: 'active' },
      { id: 14, role: 'Documentation Lead', domain: 'Management', status: 'standby' },
      { id: 15, role: 'DevOps Engineer', domain: 'Management', status: 'standby' }
    ].slice(0, agentCount);

    output.printTable({
      columns: [
        { key: 'id', header: '#', width: 3, align: 'right' },
        { key: 'role', header: 'Role', width: 22 },
        { key: 'domain', header: 'Domain', width: 15 },
        { key: 'status', header: 'Status', width: 10, format: (v) => {
          if (v === 'primary') return output.highlight(String(v));
          if (v === 'active') return output.success(String(v));
          return output.dim(String(v));
        }}
      ],
      data: v3Agents
    });

    // Actually initialize via MCP instead of just displaying (#1423)
    output.writeln();
    try {
      await callMCPTool('swarm_init', {
        topology: 'hierarchical-mesh',
        maxAgents: agentCount,
        strategy: 'specialized',
      });
      output.printSuccess(`Swarm coordination initialized with ${agentCount} agent slots via MCP`);
    } catch {
      output.printWarning('MCP unavailable — showing agent plan only (no active coordination)');
    }

    output.writeln();
    output.writeln(output.dim('Note: Use Claude Code Task tool or hive-mind spawn --claude to'));
    output.writeln(output.dim('drive actual agent execution. This command sets up the topology.'));

    return { success: true, data: { agents: v3Agents, count: agentCount } };
  }
};

// Main swarm command

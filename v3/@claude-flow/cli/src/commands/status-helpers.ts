/**
 * Status Command — system-status collection & display helpers
 *
 * Module-private in the original status.ts (campaign-2 W277); NOT
 * re-exported.
 */

import { callMCPTool } from '../mcp-client.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { output } from '../output.js';

export const DEFAULT_WATCH_INTERVAL = 2000;

// Track CPU usage over time
let lastCpuUsage: { user: number; system: number } | null = null;
let lastCpuTime = Date.now();

// Get real process CPU usage percentage
export function getProcessCpuUsage(): number {
  const cpuUsage = process.cpuUsage(lastCpuUsage ? { user: lastCpuUsage.user, system: lastCpuUsage.system } : undefined);
  const now = Date.now();
  const elapsed = now - lastCpuTime;

  // Calculate percentage (cpuUsage is in microseconds)
  const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to ms
  const percentage = elapsed > 0 ? (totalCpu / elapsed) * 100 : 0;

  // Update for next call
  lastCpuUsage = cpuUsage;
  lastCpuTime = now;

  return Math.min(100, Math.max(0, percentage));
}

// Get real process memory usage percentage
export function getProcessMemoryUsage(): number {
  const memoryUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const usedMemory = memoryUsage.heapUsed + memoryUsage.external;

  return (usedMemory / totalMemory) * 100;
}

// Check if project is initialized
//
// #2120 — the old check required `.claude-flow/config.yaml`, which
// missed projects that were initialized via `ruflo memory init` (writes
// `.swarm/memory.db` but no config.yaml) or via the auto-memory bridge.
// Reporter @alexandrelealbess on WSL2 had a 251-entry `.swarm/memory.db`
// and a running MCP, yet `ruflo status` reported "not initialized".
//
// Now: any of these signals counts as initialized:
//   - `.claude-flow/config.yaml`   (the canonical `ruflo init` output)
//   - `.claude-flow/config.json`   (same, alt format)
//   - `.swarm/memory.db`           (the `ruflo memory init` output)
//   - `.claude/settings.json`      (the Claude Code hook surface)
export function isInitialized(cwd: string): boolean {
  const candidates = [
    path.join(cwd, '.claude-flow', 'config.yaml'),
    path.join(cwd, '.claude-flow', 'config.json'),
    path.join(cwd, '.swarm', 'memory.db'),
    path.join(cwd, '.claude', 'settings.json'),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

// Format uptime
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Get system status data
export async function getSystemStatus(): Promise<{
  initialized: boolean;
  running: boolean;
  swarm: {
    id: string | null;
    topology: string;
    agents: { total: number; active: number; idle: number };
    health: string;
    uptime: number;
  };
  mcp: {
    running: boolean;
    port: number | null;
    transport: string;
  };
  memory: {
    entries: number;
    size: string;
    backend: string;
    performance: { searchTime: number; cacheHitRate: number };
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    flashAttention: string;
    searchSpeed: string;
  };
}> {
  try {
    // Get swarm status
    const swarmStatus = await callMCPTool<{
      swarmId: string;
      topology: string;
      agents: { total: number; active: number; idle: number; terminated: number };
      health: string;
      uptime: number;
    }>('swarm_status', { includeMetrics: true });

    // Get MCP status
    let mcpStatus = { running: false, port: null as number | null, transport: 'stdio' };
    try {
      const mcp = await callMCPTool<{
        running: boolean;
        port: number;
        transport: string;
      }>('mcp_status', {});
      mcpStatus = mcp;
    } catch {
      // MCP not running
    }

    // Get memory status
    const memoryStatus = await callMCPTool<{
      entries: number;
      size: number;
      backend: string;
      performance: { avgSearchTime: number; cacheHitRate: number };
    }>('memory_stats', {});

    // Get task status
    const taskStatus = await callMCPTool<{
      total: number;
      pending: number;
      running: number;
      completed: number;
      failed: number;
    }>('task_summary', {});

    return {
      initialized: true,
      running: true,
      swarm: {
        id: swarmStatus.swarmId,
        topology: swarmStatus.topology,
        agents: {
          total: swarmStatus.agents.total,
          active: swarmStatus.agents.active,
          idle: swarmStatus.agents.idle
        },
        health: swarmStatus.health,
        uptime: swarmStatus.uptime
      },
      mcp: mcpStatus,
      memory: {
        entries: memoryStatus.entries,
        size: formatBytes(memoryStatus.size),
        backend: memoryStatus.backend,
        performance: {
          searchTime: memoryStatus.performance.avgSearchTime,
          cacheHitRate: memoryStatus.performance.cacheHitRate
        }
      },
      tasks: taskStatus,
      performance: {
        cpuUsage: getProcessCpuUsage(),
        memoryUsage: getProcessMemoryUsage(),
        flashAttention: 'not measured',
        searchSpeed: 'not measured'
      }
    };
  } catch (error) {
    // System not running
    return {
      initialized: true,
      running: false,
      swarm: {
        id: null,
        topology: 'none',
        agents: { total: 0, active: 0, idle: 0 },
        health: 'stopped',
        uptime: 0
      },
      mcp: { running: false, port: null, transport: 'stdio' },
      memory: {
        entries: 0,
        size: '0 B',
        backend: 'none',
        performance: { searchTime: 0, cacheHitRate: 0 }
      },
      tasks: { total: 0, pending: 0, running: 0, completed: 0, failed: 0 },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        flashAttention: 'N/A',
        searchSpeed: 'N/A'
      }
    };
  }
}

// Display status in text format
export function displayStatus(status: Awaited<ReturnType<typeof getSystemStatus>>): void {
  output.writeln();

  // Header with overall status
  const statusIcon = status.running
    ? output.success('[RUNNING]')
    : output.warning('[STOPPED]');
  output.writeln(`${output.bold('AlexKo V3')} ${statusIcon}`);
  output.writeln();

  // Swarm section
  output.writeln(output.bold('Swarm'));
  if (status.running) {
    output.printTable({
      columns: [
        { key: 'property', header: 'Property', width: 15 },
        { key: 'value', header: 'Value', width: 30 }
      ],
      data: [
        { property: 'ID', value: status.swarm.id },
        { property: 'Topology', value: status.swarm.topology },
        { property: 'Health', value: formatHealth(status.swarm.health) },
        { property: 'Uptime', value: formatUptime(status.swarm.uptime) }
      ]
    });
  } else {
    output.printInfo('  Swarm not running');
  }
  output.writeln();

  // Agents section
  output.writeln(output.bold('Agents'));
  output.printTable({
    columns: [
      { key: 'status', header: 'Status', width: 12 },
      { key: 'count', header: 'Count', width: 10, align: 'right' }
    ],
    data: [
      { status: 'Active', count: status.swarm.agents.active },
      { status: 'Idle', count: status.swarm.agents.idle },
      { status: output.bold('Total'), count: status.swarm.agents.total }
    ]
  });
  output.writeln();

  // Tasks section
  output.writeln(output.bold('Tasks'));
  output.printTable({
    columns: [
      { key: 'status', header: 'Status', width: 12 },
      { key: 'count', header: 'Count', width: 10, align: 'right' }
    ],
    data: [
      { status: 'Pending', count: status.tasks.pending },
      { status: 'Running', count: status.tasks.running },
      { status: 'Completed', count: status.tasks.completed },
      { status: 'Failed', count: status.tasks.failed },
      { status: output.bold('Total'), count: status.tasks.total }
    ]
  });
  output.writeln();

  // Memory section
  output.writeln(output.bold('Memory'));
  output.printTable({
    columns: [
      { key: 'property', header: 'Property', width: 18 },
      { key: 'value', header: 'Value', width: 20, align: 'right' }
    ],
    data: [
      { property: 'Backend', value: status.memory.backend },
      { property: 'Entries', value: status.memory.entries },
      { property: 'Size', value: status.memory.size },
      { property: 'Search Time', value: `${status.memory.performance.searchTime.toFixed(2)}ms` },
      { property: 'Cache Hit Rate', value: `${(status.memory.performance.cacheHitRate * 100).toFixed(1)}%` }
    ]
  });
  output.writeln();

  // MCP section
  output.writeln(output.bold('MCP Server'));
  if (status.mcp.running) {
    if (status.mcp.transport === 'stdio') {
      output.printInfo('  Running (stdio mode)');
    } else {
      output.printInfo(`  Running on port ${status.mcp.port} (${status.mcp.transport})`);
    }
  } else {
    output.printInfo('  Not running');
  }
  output.writeln();

  // Performance section
  if (status.running) {
    output.writeln(output.bold('V3 Performance Gains'));
    output.printList([
      `Flash Attention: ${output.success(status.performance.flashAttention)}`,
      `Vector Search: ${output.success(status.performance.searchSpeed)}`,
      `CPU Usage: ${status.performance.cpuUsage.toFixed(1)}%`,
      `Memory Usage: ${status.performance.memoryUsage.toFixed(1)}%`
    ]);
  }
}

// Format health status with color
export function formatHealth(health: string): string {
  switch (health) {
    case 'healthy':
      return output.success(health);
    case 'degraded':
      return output.warning(health);
    case 'unhealthy':
    case 'stopped':
      return output.error(health);
    default:
      return health;
  }
}

// Main status action

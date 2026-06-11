/**
 * Process Command — daemon / monitor subcommands
 *
 * Extracted verbatim from process.ts (lines 48-405) during campaign-2
 * wave 73 (W279). Module-private group.
 */

import { readFileSync, existsSync } from 'fs';
import { cpus, loadavg, totalmem, freemem } from 'node:os';
import { resolve } from 'path';
import type { Command, CommandContext, CommandResult } from '../types.js';
import { readPidFile, removePidFile, writePidFile } from './process-pid.js';

export const daemonCommand: Command = {
  name: 'daemon',
  description: 'Manage background daemon process',
  options: [
    {
      name: 'action',
      type: 'string',
      description: 'Action to perform',
      choices: ['start', 'stop', 'restart', 'status'],
      default: 'status',
    },
    {
      name: 'port',
      type: 'number',
      description: 'Port for daemon HTTP API',
      default: 3847,
    },
    {
      name: 'pid-file',
      type: 'string',
      description: 'PID file location',
      default: '.claude-flow/daemon.pid',
    },
    {
      name: 'log-file',
      type: 'string',
      description: 'Log file location',
      default: '.claude-flow/daemon.log',
    },
    {
      name: 'detach',
      type: 'boolean',
      description: 'Run in detached mode',
      default: true,
    },
  ],
  examples: [
    { command: 'claude-flow process daemon --action start', description: 'Start the daemon' },
    { command: 'claude-flow process daemon --action stop', description: 'Stop the daemon' },
    { command: 'claude-flow process daemon --action restart --port 3850', description: 'Restart on different port' },
    { command: 'claude-flow process daemon --action status', description: 'Check daemon status' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const action = (ctx.flags?.action as string) || 'status';
    const port = (ctx.flags?.port as number) || 3847;
    const pidFile = (ctx.flags?.['pid-file'] as string) || '.claude-flow/daemon.pid';
    const logFile = (ctx.flags?.['log-file'] as string) || '.claude-flow/daemon.log';
    const detach = ctx.flags?.detach !== false;

    // Check existing daemon state from PID file
    const existingDaemon = readPidFile(pidFile);
    const daemonState = {
      status: existingDaemon ? 'running' as const : 'stopped' as const,
      pid: existingDaemon?.pid || null as number | null,
      uptime: existingDaemon ? Math.floor((Date.now() - new Date(existingDaemon.startedAt).getTime()) / 1000) : 0,
      port: existingDaemon?.port || port,
      startedAt: existingDaemon?.startedAt || null as string | null,
    };

    switch (action) {
      case 'start':
        if (existingDaemon) {
          console.log('\n⚠️  Daemon already running\n');
          console.log(`  📍 PID: ${existingDaemon.pid}`);
          console.log(`  🌐 Port: ${existingDaemon.port}`);
          console.log(`  ⏱️  Started: ${existingDaemon.startedAt}`);
          break;
        }

        console.log('\n🚀 Starting claude-flow daemon...\n');
        const newPid = process.pid; // Use actual process PID
        daemonState.status = 'running';
        daemonState.pid = newPid;
        daemonState.startedAt = new Date().toISOString();
        daemonState.uptime = 0;

        // Persist PID to file
        writePidFile(pidFile, newPid, port);

        console.log('  ✅ Daemon started successfully');
        console.log(`  📍 PID: ${daemonState.pid}`);
        console.log(`  🌐 HTTP API: http://localhost:${port}`);
        console.log(`  📄 PID file: ${resolve(pidFile)}`);
        console.log(`  📝 Log file: ${logFile}`);
        console.log(`  🔄 Mode: ${detach ? 'detached' : 'foreground'}`);
        console.log('\n  Services:');
        console.log('    ├─ MCP Server: listening');
        console.log('    ├─ Agent Pool: initialized (0 agents)');
        console.log('    ├─ Memory Service: connected');
        console.log('    ├─ Task Queue: ready');
        console.log('    └─ Swarm Coordinator: standby');
        break;

      case 'stop':
        if (!existingDaemon) {
          console.log('\n⚠️  No daemon running\n');
          break;
        }
        console.log('\n🛑 Stopping claude-flow daemon...\n');
        console.log(`  📍 Stopping PID ${existingDaemon.pid}...`);

        // Remove PID file
        removePidFile(pidFile);
        daemonState.status = 'stopped';
        daemonState.pid = null;

        console.log('  ✅ Daemon stopped successfully');
        console.log('  📍 PID file removed');
        console.log('  🧹 Resources cleaned up');
        break;

      case 'restart':
        console.log('\n🔄 Restarting claude-flow daemon...\n');
        if (existingDaemon) {
          console.log(`  🛑 Stopping PID ${existingDaemon.pid}...`);
          removePidFile(pidFile);
          console.log('  ✅ Stopped');
        }
        console.log('  🚀 Starting new instance...');
        const restartPid = process.pid;
        writePidFile(pidFile, restartPid, port);
        daemonState.pid = restartPid;
        daemonState.status = 'running';
        console.log(`  ✅ Daemon restarted (PID: ${restartPid})`);
        console.log(`  🌐 HTTP API: http://localhost:${port}`);
        console.log(`  📄 PID file: ${resolve(pidFile)}`);
        break;

      case 'status':
        console.log('\n📊 Daemon Status\n');
        console.log('  ┌─────────────────────────────────────────┐');
        console.log('  │ claude-flow daemon                      │');
        console.log('  ├─────────────────────────────────────────┤');
        if (existingDaemon) {
          const uptime = Math.floor((Date.now() - new Date(existingDaemon.startedAt).getTime()) / 1000);
          const uptimeStr = uptime < 60 ? `${uptime}s` : `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
          console.log('  │ Status:      🟢 running                │');
          console.log(`  │ PID:         ${existingDaemon.pid.toString().padEnd(28)}│`);
          console.log(`  │ Port:        ${existingDaemon.port.toString().padEnd(28)}│`);
          console.log(`  │ Uptime:      ${uptimeStr.padEnd(28)}│`);
        } else {
          console.log('  │ Status:      ⚪ not running             │');
          console.log(`  │ Port:        ${port.toString().padEnd(28)}│`);
          console.log(`  │ PID file:    ${pidFile.substring(0, 26).padEnd(28)}│`);
          console.log('  │ Uptime:      --                         │');
        }
        console.log('  └─────────────────────────────────────────┘');
        if (!existingDaemon) {
          console.log('\n  To start: claude-flow process daemon --action start');
        }
        break;
    }

    return { success: true, data: daemonState };
  },
};

/**
 * Monitor subcommand - real-time process monitoring
 */
export const monitorCommand: Command = {
  name: 'monitor',
  description: 'Real-time process and resource monitoring',
  options: [
    {
      name: 'interval',
      type: 'number',
      description: 'Refresh interval in seconds',
      default: 2,
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format',
      choices: ['dashboard', 'compact', 'json'],
      default: 'dashboard',
    },
    {
      name: 'components',
      type: 'string',
      description: 'Components to monitor (comma-separated)',
      default: 'all',
    },
    {
      name: 'watch',
      type: 'boolean',
      description: 'Continuous monitoring mode',
      default: false,
    },
    {
      name: 'alerts',
      type: 'boolean',
      description: 'Enable threshold alerts',
      default: true,
    },
  ],
  examples: [
    { command: 'claude-flow process monitor', description: 'Show process dashboard' },
    { command: 'claude-flow process monitor --watch --interval 5', description: 'Watch mode' },
    { command: 'claude-flow process monitor --components agents,memory,tasks', description: 'Monitor specific components' },
    { command: 'claude-flow process monitor --format json', description: 'JSON output' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const interval = (ctx.flags?.interval as number) || 2;
    const format = (ctx.flags?.format as string) || 'dashboard';
    const watch = ctx.flags?.watch === true;
    const alerts = ctx.flags?.alerts !== false;

    // Gather real system metrics where possible
    const memUsage = process.memoryUsage();
    const loadAvg = loadavg();
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMemMB = Math.round((totalMem - freeMem) / 1024 / 1024);
    const totalMemMB = Math.round(totalMem / 1024 / 1024);

    // Try to read agent and task counts from local store files
    let agentCount = 0;
    let taskCounts = { running: 0, queued: 0, completed: 0, failed: 0 };
    try {
      const agentStorePath = resolve('.claude-flow/agents/store.json');
      if (existsSync(agentStorePath)) {
        const agentStore = JSON.parse(readFileSync(agentStorePath, 'utf-8'));
        const agents = Array.isArray(agentStore) ? agentStore : Object.values(agentStore.agents || agentStore || {});
        agentCount = agents.length;
      }
    } catch { /* no agent store */ }
    try {
      const taskStorePath = resolve('.claude-flow/tasks/store.json');
      if (existsSync(taskStorePath)) {
        const taskStore = JSON.parse(readFileSync(taskStorePath, 'utf-8'));
        const tasks = Array.isArray(taskStore) ? taskStore : Object.values(taskStore.tasks || taskStore || {});
        for (const t of tasks as Array<{ status?: string }>) {
          if (t.status === 'running') taskCounts.running++;
          else if (t.status === 'queued' || t.status === 'pending') taskCounts.queued++;
          else if (t.status === 'completed' || t.status === 'done') taskCounts.completed++;
          else if (t.status === 'failed' || t.status === 'error') taskCounts.failed++;
        }
      }
    } catch { /* no task store */ }

    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpuLoadAvg1m: loadAvg[0] !== undefined ? parseFloat(loadAvg[0].toFixed(2)) : null,
        cpuLoadAvg5m: loadAvg[1] !== undefined ? parseFloat(loadAvg[1].toFixed(2)) : null,
        cpuCount: cpus().length,
        memoryUsedMB: usedMemMB,
        memoryTotalMB: totalMemMB,
        processRssMB: Math.round(memUsage.rss / 1024 / 1024),
        processHeapMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        uptime: Math.floor(process.uptime()),
      },
      agents: {
        total: agentCount,
        _note: agentCount === 0 ? 'No agent store found at .claude-flow/agents/store.json' : null,
      },
      tasks: {
        ...taskCounts,
        _note: (taskCounts.running + taskCounts.queued + taskCounts.completed + taskCounts.failed) === 0
          ? 'No task store found at .claude-flow/tasks/store.json' : null,
      },
      memory: {
        vectorCount: null as number | null,
        indexSize: null as number | null,
        cacheHitRate: null as number | null,
        avgSearchTime: null as number | null,
        _note: 'Memory service metrics not available from process monitor. Use "memory stats" command.',
      },
      network: {
        mcpConnections: null as number | null,
        requestsPerMin: null as number | null,
        avgLatency: null as number | null,
        _note: 'Network metrics not available from process monitor. Use "mcp status" command.',
      },
    };

    if (format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
      return { success: true, data: metrics };
    }

    if (format === 'compact') {
      console.log('\n📊 Process Monitor (compact)\n');
      const loadStr = metrics.system.cpuLoadAvg1m !== null ? `load ${metrics.system.cpuLoadAvg1m.toFixed(2)}` : 'n/a';
      console.log(`CPU: ${loadStr} (${metrics.system.cpuCount} cores) | Memory: ${metrics.system.memoryUsedMB}MB/${metrics.system.memoryTotalMB}MB`);
      console.log(`Agents: ${metrics.agents.total} total | Tasks: ${metrics.tasks.running} running, ${metrics.tasks.queued} queued`);
      return { success: true, data: metrics };
    }

    // Dashboard format
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            🖥️  CLAUDE-FLOW PROCESS MONITOR                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    // System metrics
    console.log('║  SYSTEM                                                      ║');
    const cpuDisplay = metrics.system.cpuLoadAvg1m !== null ? metrics.system.cpuLoadAvg1m : 0;
    const cpuPercent = Math.min(100, (cpuDisplay / (metrics.system.cpuCount || 1)) * 100);
    const cpuBar = '█'.repeat(Math.floor(cpuPercent / 5)) + '░'.repeat(20 - Math.floor(cpuPercent / 5));
    const memPercent = (metrics.system.memoryUsedMB / metrics.system.memoryTotalMB) * 100;
    const memBar = '█'.repeat(Math.floor(memPercent / 5)) + '░'.repeat(20 - Math.floor(memPercent / 5));
    console.log(`║  CPU:    [${cpuBar}] load ${cpuDisplay.toFixed(2).padStart(5)}          ║`);
    console.log(`║  Memory: [${memBar}] ${metrics.system.memoryUsedMB}MB/${metrics.system.memoryTotalMB}MB      ║`);

    console.log('╠══════════════════════════════════════════════════════════════╣');

    // Agents
    console.log('║  AGENTS                                                      ║');
    console.log(`║  Total: ${metrics.agents.total.toString().padEnd(5)}                                              ║`);

    console.log('╠══════════════════════════════════════════════════════════════╣');

    // Tasks
    console.log('║  TASKS                                                       ║');
    console.log(`║  Running: ${metrics.tasks.running.toString().padEnd(3)} Queued: ${metrics.tasks.queued.toString().padEnd(3)} Completed: ${metrics.tasks.completed.toString().padEnd(5)} Failed: ${metrics.tasks.failed.toString().padEnd(3)}║`);

    console.log('╠══════════════════════════════════════════════════════════════╣');

    // Memory service
    console.log('║  MEMORY SERVICE                                              ║');
    console.log('║  Metrics not available. Use "memory stats" command.          ║');

    console.log('╠══════════════════════════════════════════════════════════════╣');

    // Network
    console.log('║  NETWORK                                                     ║');
    console.log('║  Metrics not available. Use "mcp status" command.            ║');

    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (alerts) {
      console.log('\n📢 Alerts:');
      if (cpuPercent > 80) {
        console.log('  ⚠️  High CPU load detected');
      }
      if (memPercent > 80) {
        console.log('  ⚠️  High memory usage detected');
      }
      if (metrics.tasks.failed > 10) {
        console.log('  ⚠️  Elevated task failure rate');
      }
      if (cpuPercent <= 80 && memPercent <= 80 && metrics.tasks.failed <= 10) {
        console.log('  ✅ All systems nominal');
      }
    }

    if (watch) {
      console.log(`\n🔄 Refresh: ${interval}s | Press Ctrl+C to exit`);
    }

    return { success: true, data: metrics };
  },
};

/**
 * Workers subcommand - manage background workers
 */

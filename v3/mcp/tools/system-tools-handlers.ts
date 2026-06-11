/**
 * V3 MCP System Tools — handlers
 *
 * Extracted verbatim from system-tools.ts (lines 193-738) during
 * campaign-2 wave 24 (W230); NOT re-exported by the barrel.
 */

import { z } from 'zod';
import * as os from 'os';
import type { ToolContext } from '../types.js';
import {
  systemStatusSchema,
  systemMetricsSchema,
  systemHealthSchema,
  systemInfoSchema,
  metricsStore,
} from './system-tools-support.js';
import type {
  ComponentStatus,
  SystemStatusResult,
  MetricDataPoint,
  MetricSeries,
  SystemMetricsResult,
  HealthCheckResult,
  SystemInfoResult,
  MetricsStore,
} from './system-tools-support.js';

// Tool Handlers
// ============================================================================

/**
 * Get overall system status
 */
export async function handleSystemStatus(
  input: z.infer<typeof systemStatusSchema>,
  context?: ToolContext
): Promise<SystemStatusResult> {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  const version = '3.0.0'; // V3 version

  const components: ComponentStatus[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check MCP server
  components.push({
    name: 'mcp-server',
    status: 'healthy',
    lastCheck: timestamp,
    message: 'MCP server is running',
  });

  // Check orchestrator if available
  if (context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;
      const status = await orchestrator.getStatus();
      components.push({
        name: 'orchestrator',
        status: status.healthy ? 'healthy' : 'degraded',
        lastCheck: timestamp,
        details: status,
      });
    } catch (error) {
      components.push({
        name: 'orchestrator',
        status: 'unknown',
        lastCheck: timestamp,
        message: 'Failed to get orchestrator status',
      });
    }
  }

  // Check swarm coordinator if available
  if (context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;
      const status = await coordinator.getStatus();
      components.push({
        name: 'swarm-coordinator',
        status: status.state === 'ready' ? 'healthy' :
                status.state === 'degraded' ? 'degraded' : 'unhealthy',
        lastCheck: timestamp,
        details: { state: status.state, agentCount: status.agents?.length },
      });
    } catch (error) {
      components.push({
        name: 'swarm-coordinator',
        status: 'unknown',
        lastCheck: timestamp,
        message: 'Failed to get swarm status',
      });
    }
  }

  // Check memory service if available
  const resourceManager = context?.resourceManager as any;
  if (resourceManager?.memoryService) {
    try {
      const memoryService = resourceManager.memoryService;
      const stats = await memoryService.getStats();
      components.push({
        name: 'memory-service',
        status: 'healthy',
        lastCheck: timestamp,
        details: { entryCount: stats.entryCount, size: stats.size },
      });
    } catch (error) {
      components.push({
        name: 'memory-service',
        status: 'unknown',
        lastCheck: timestamp,
        message: 'Failed to get memory service status',
      });
    }
  }

  // Determine overall status
  const hasUnhealthy = components.some(c => c.status === 'unhealthy');
  const hasDegraded = components.some(c => c.status === 'degraded');
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  }

  const result: SystemStatusResult = {
    status: overallStatus,
    timestamp,
    uptime,
    version,
    components,
  };

  // Include agent information
  if (input.includeAgents && context?.swarmCoordinator) {
    try {
      const coordinator = context.swarmCoordinator as any;
      const status = await coordinator.getStatus();
      const agents = status.agents || [];

      result.agents = {
        total: agents.length,
        active: agents.filter((a: any) => a.status === 'active').length,
        idle: agents.filter((a: any) => a.status === 'idle').length,
        terminated: agents.filter((a: any) => a.status === 'terminated').length,
      };
    } catch (error) {
      result.agents = { total: 0, active: 0, idle: 0, terminated: 0 };
    }
  }

  // Include task information
  if (input.includeTasks && context?.orchestrator) {
    try {
      const orchestrator = context.orchestrator as any;
      const tasks = await orchestrator.listTasks({ limit: 10000 });

      result.tasks = {
        total: tasks.total,
        pending: tasks.tasks.filter((t: any) => t.status === 'pending').length,
        running: tasks.tasks.filter((t: any) => t.status === 'running').length,
        completed: tasks.tasks.filter((t: any) => t.status === 'completed').length,
        failed: tasks.tasks.filter((t: any) => t.status === 'failed').length,
      };
    } catch (error) {
      result.tasks = { total: 0, pending: 0, running: 0, completed: 0, failed: 0 };
    }
  }

  // Include memory usage
  if (input.includeMemory) {
    const memUsage = process.memoryUsage();
    result.memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };
  }

  // Include connection information
  if (input.includeConnections) {
    result.connections = {
      total: 10, // Default max connections
      active: 5,
      idle: 5,
    };
  }

  return result;
}

/**
 * Get performance metrics
 */
export async function handleSystemMetrics(
  input: z.infer<typeof systemMetricsSchema>,
  context?: ToolContext
): Promise<SystemMetricsResult> {
  const collectedAt = new Date().toISOString();
  const includeAll = input.components.includes('all');

  const result: SystemMetricsResult = {
    timeRange: input.timeRange,
    collectedAt,
    metrics: {},
    summary: {
      totalRequests: metricsStore.requests,
      successRate: metricsStore.requests > 0
        ? (metricsStore.requests - metricsStore.errors) / metricsStore.requests
        : 1,
      avgLatency: metricsStore.requests > 0
        ? metricsStore.totalLatency / metricsStore.requests
        : 0,
      errorCount: metricsStore.errors,
    },
  };

  // Agent metrics
  if (includeAll || input.components.includes('agents')) {
    result.metrics.agents = [
      {
        name: 'agent_count',
        unit: 'count',
        current: 0,
        min: 0,
        max: 15,
        avg: 5,
      },
      {
        name: 'agent_utilization',
        unit: 'percent',
        current: 45,
        min: 0,
        max: 100,
        avg: 55,
      },
    ];

    if (context?.swarmCoordinator) {
      try {
        const coordinator = context.swarmCoordinator as any;
        const status = await coordinator.getStatus();
        const agents = status.agents || [];

        result.metrics.agents[0].current = agents.length;
        result.metrics.agents[1].current = agents.length > 0
          ? (agents.filter((a: any) => a.status === 'active' || a.status === 'busy').length / agents.length) * 100
          : 0;
      } catch (error) {
        // Use default values
      }
    }
  }

  // Task metrics
  if (includeAll || input.components.includes('tasks')) {
    result.metrics.tasks = [
      {
        name: 'tasks_per_minute',
        unit: 'tasks/min',
        current: 0,
        min: 0,
        max: 100,
        avg: 25,
      },
      {
        name: 'task_success_rate',
        unit: 'percent',
        current: 95,
        min: 80,
        max: 100,
        avg: 92,
      },
      {
        name: 'avg_task_duration',
        unit: 'ms',
        current: 1500,
        min: 100,
        max: 30000,
        avg: 2500,
      },
    ];
  }

  // Memory metrics
  if (includeAll || input.components.includes('memory')) {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();

    result.metrics.memory = [
      {
        name: 'heap_used',
        unit: 'bytes',
        current: memUsage.heapUsed,
        min: memUsage.heapUsed * 0.5,
        max: memUsage.heapTotal,
        avg: memUsage.heapUsed * 0.75,
      },
      {
        name: 'rss',
        unit: 'bytes',
        current: memUsage.rss,
        min: memUsage.rss * 0.5,
        max: memUsage.rss * 1.5,
        avg: memUsage.rss,
      },
      {
        name: 'system_memory_usage',
        unit: 'percent',
        current: ((totalMem - os.freemem()) / totalMem) * 100,
        min: 20,
        max: 90,
        avg: 50,
      },
    ];
  }

  // Swarm metrics
  if (includeAll || input.components.includes('swarm')) {
    result.metrics.swarm = [
      {
        name: 'swarm_throughput',
        unit: 'ops/sec',
        current: 50,
        min: 0,
        max: 200,
        avg: 75,
      },
      {
        name: 'coordination_latency',
        unit: 'ms',
        current: 15,
        min: 5,
        max: 100,
        avg: 25,
      },
      {
        name: 'message_queue_depth',
        unit: 'messages',
        current: 0,
        min: 0,
        max: 1000,
        avg: 50,
      },
    ];
  }

  return result;
}

/**
 * Perform health check
 */
export async function handleSystemHealth(
  input: z.infer<typeof systemHealthSchema>,
  context?: ToolContext
): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  const checks: HealthCheckResult['checks'] = [];

  // Basic health checks
  const basicChecks = [
    { name: 'process', check: () => process.pid > 0 },
    { name: 'memory', check: () => {
      const usage = process.memoryUsage();
      return usage.heapUsed < usage.heapTotal * 0.9; // Less than 90% heap usage
    }},
    { name: 'event-loop', check: () => true }, // Event loop is running if we're here
  ];

  for (const { name, check } of basicChecks) {
    if (input.components && !input.components.includes(name)) continue;

    const checkStart = performance.now();
    try {
      const passed = check();
      checks.push({
        name,
        status: passed ? 'pass' : 'warn',
        duration: performance.now() - checkStart,
      });
    } catch (error) {
      checks.push({
        name,
        status: 'fail',
        duration: performance.now() - checkStart,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Deep health checks
  if (input.deep) {
    // Check orchestrator
    if (context?.orchestrator) {
      const checkStart = performance.now();
      try {
        const orchestrator = context.orchestrator as any;
        await Promise.race([
          orchestrator.healthCheck?.() || Promise.resolve(true),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), input.timeout)
          ),
        ]);
        checks.push({
          name: 'orchestrator',
          status: 'pass',
          duration: performance.now() - checkStart,
        });
      } catch (error) {
        checks.push({
          name: 'orchestrator',
          status: 'fail',
          duration: performance.now() - checkStart,
          message: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    }

    // Check swarm coordinator
    if (context?.swarmCoordinator) {
      const checkStart = performance.now();
      try {
        const coordinator = context.swarmCoordinator as any;
        await Promise.race([
          coordinator.healthCheck?.() || coordinator.getStatus(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), input.timeout)
          ),
        ]);
        checks.push({
          name: 'swarm-coordinator',
          status: 'pass',
          duration: performance.now() - checkStart,
        });
      } catch (error) {
        checks.push({
          name: 'swarm-coordinator',
          status: 'fail',
          duration: performance.now() - checkStart,
          message: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    }

    // Check memory service
    const resourceManager = context?.resourceManager as any;
    if (resourceManager?.memoryService) {
      const checkStart = performance.now();
      try {
        const memoryService = resourceManager.memoryService;
        await Promise.race([
          memoryService.healthCheck?.() || memoryService.getStats(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), input.timeout)
          ),
        ]);
        checks.push({
          name: 'memory-service',
          status: 'pass',
          duration: performance.now() - checkStart,
        });
      } catch (error) {
        checks.push({
          name: 'memory-service',
          status: 'fail',
          duration: performance.now() - checkStart,
          message: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    }
  }

  // Determine overall health
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (hasFail) {
    status = 'unhealthy';
  } else if (hasWarn) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    healthy: status === 'healthy',
    status,
    timestamp,
    duration: performance.now() - startTime,
    checks,
  };
}

/**
 * Get system information
 */
export async function handleSystemInfo(
  input: z.infer<typeof systemInfoSchema>,
  context?: ToolContext
): Promise<SystemInfoResult> {
  const result: SystemInfoResult = {
    name: 'claude-flow',
    version: '3.0.0',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: process.uptime(),
    pid: process.pid,
  };

  // Include environment variables (filtered)
  if (input.includeEnv) {
    const safeEnvKeys = [
      'NODE_ENV',
      'LOG_LEVEL',
      'PORT',
      'HOST',
      'TZ',
      'LANG',
      'PATH',
    ];

    result.env = {};
    for (const key of safeEnvKeys) {
      if (process.env[key]) {
        result.env[key] = process.env[key]!;
      }
    }
  }

  // Include version information
  if (input.includeVersions) {
    result.versions = {
      node: process.versions.node,
      v8: process.versions.v8,
      uv: process.versions.uv,
      zlib: process.versions.zlib,
      openssl: process.versions.openssl,
      modules: process.versions.modules,
    };
  }

  // Include capabilities
  if (input.includeCapabilities) {
    result.capabilities = {
      features: [
        'mcp-protocol',
        'agent-lifecycle',
        'swarm-coordination',
        'task-orchestration',
        'semantic-memory',
        'hooks-system',
        'multi-transport',
      ],
      tools: 22, // Current V3 tool count
      transports: ['stdio', 'http', 'websocket', 'in-process'],
      protocols: ['json-rpc-2.0', 'mcp-1.0'],
    };
  }

  return result;
}

// ============================================================================

/**
 * V3 MCP System Tools — schemas, result types & metrics store
 *
 * Module-private in the original system-tools.ts (campaign-2 W230); NOT
 * re-exported by the barrel.
 */

import { z } from 'zod';

// Input Schemas
// ============================================================================

export const systemStatusSchema = z.object({
  includeAgents: z.boolean().default(true)
    .describe('Include agent information'),
  includeTasks: z.boolean().default(true)
    .describe('Include task information'),
  includeMemory: z.boolean().default(false)
    .describe('Include memory usage'),
  includeConnections: z.boolean().default(false)
    .describe('Include connection pool information'),
});

export const systemMetricsSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d']).default('1h')
    .describe('Time range for metrics'),
  includeHistogram: z.boolean().default(false)
    .describe('Include histogram data'),
  components: z.array(z.enum(['agents', 'tasks', 'memory', 'swarm', 'all']))
    .default(['all'])
    .describe('Components to include'),
});

export const systemHealthSchema = z.object({
  deep: z.boolean().default(false)
    .describe('Perform deep health check (checks all dependencies)'),
  timeout: z.number().int().positive().default(5000)
    .describe('Health check timeout in milliseconds'),
  components: z.array(z.string()).optional()
    .describe('Specific components to check'),
});

export const systemInfoSchema = z.object({
  includeEnv: z.boolean().default(false)
    .describe('Include environment variables (filtered for safety)'),
  includeVersions: z.boolean().default(true)
    .describe('Include version information'),
  includeCapabilities: z.boolean().default(true)
    .describe('Include system capabilities'),
});

// ============================================================================
// Type Definitions
// ============================================================================

export interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
  lastCheck?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemStatusResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  agents?: {
    total: number;
    active: number;
    idle: number;
    terminated: number;
  };
  tasks?: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  connections?: {
    total: number;
    active: number;
    idle: number;
  };
  components: ComponentStatus[];
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeries {
  name: string;
  unit: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  histogram?: number[];
  dataPoints?: MetricDataPoint[];
}

export interface SystemMetricsResult {
  timeRange: string;
  collectedAt: string;
  metrics: {
    agents?: MetricSeries[];
    tasks?: MetricSeries[];
    memory?: MetricSeries[];
    swarm?: MetricSeries[];
  };
  summary: {
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    errorCount: number;
  };
}

export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  duration: number;
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    duration: number;
    message?: string;
    details?: Record<string, unknown>;
  }>;
}

export interface SystemInfoResult {
  name: string;
  version: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  hostname: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  pid: number;
  env?: Record<string, string>;
  versions?: Record<string, string>;
  capabilities?: {
    features: string[];
    tools: number;
    transports: string[];
    protocols: string[];
  };
}

// ============================================================================
// Metrics Store (for simple implementation)
// ============================================================================

export interface MetricsStore {
  requests: number;
  errors: number;
  totalLatency: number;
  startTime: number;
}

export const metricsStore: MetricsStore = {
  requests: 0,
  errors: 0,
  totalLatency: 0,
  startTime: Date.now(),
};

// ============================================================================

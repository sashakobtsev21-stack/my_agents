/**
 * Container Worker Pool — state/info/config shapes & defaults
 *
 * Extracted verbatim from container-worker-pool.ts (lines 34-143)
 * during campaign-2 wave 59 (W265). The 5 public shapes are re-exported
 * by the barrel; DEFAULT_CONFIG stays unexported from it.
 */

import type { HeadlessWorkerType, SandboxMode } from './headless-worker-executor.js';

// ============================================
// Type Definitions
// ============================================

/**
 * Container state
 */
export type ContainerState = 'creating' | 'ready' | 'busy' | 'unhealthy' | 'terminated';

/**
 * Container info
 */
export interface ContainerInfo {
  id: string;
  name: string;
  state: ContainerState;
  createdAt: Date;
  lastUsedAt?: Date;
  workerType?: HeadlessWorkerType;
  executionCount: number;
  healthCheckFailures: number;
  pid?: number;
}

/**
 * Container pool configuration
 */
export interface ContainerPoolConfig {
  /** Maximum number of containers in the pool */
  maxContainers: number;

  /** Minimum number of containers to keep warm */
  minContainers: number;

  /** Docker image to use */
  image: string;

  /** Container resource limits */
  resources: {
    cpus: string;
    memory: string;
  };

  /** Health check interval in ms */
  healthCheckIntervalMs: number;

  /** Container idle timeout in ms */
  idleTimeoutMs: number;

  /** Workspace volume mount path */
  workspacePath: string;

  /** State persistence path */
  statePath: string;

  /** Network name for container isolation */
  network?: string;

  /** Environment variables for containers */
  env?: Record<string, string>;

  /** Default sandbox mode */
  defaultSandbox: SandboxMode;
}

/**
 * Container execution options
 */
export interface ContainerExecutionOptions {
  workerType: HeadlessWorkerType;
  prompt: string;
  contextPatterns?: string[];
  sandbox?: SandboxMode;
  model?: string;
  timeoutMs?: number;
}

/**
 * Pool status
 */
export interface ContainerPoolStatus {
  totalContainers: number;
  readyContainers: number;
  busyContainers: number;
  unhealthyContainers: number;
  queuedTasks: number;
  containers: ContainerInfo[];
  dockerAvailable: boolean;
  lastHealthCheck?: Date;
}

// ============================================
// Constants
// ============================================

export const DEFAULT_CONFIG: ContainerPoolConfig = {
  maxContainers: 3,
  minContainers: 1,
  image: 'ghcr.io/ruvnet/claude-flow-headless:latest',
  resources: {
    cpus: '2',
    memory: '4g',
  },
  healthCheckIntervalMs: 30000,
  idleTimeoutMs: 300000, // 5 minutes
  workspacePath: '/workspace',
  statePath: '.claude-flow/container-pool',
  defaultSandbox: 'strict',
};


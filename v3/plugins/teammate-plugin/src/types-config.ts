/**
 * Teammate Plugin — Task schema, events, plugin config, infra types
 *
 * Extracted verbatim from types.ts (lines 406-762) during campaign-2
 * wave 69 (W275). types.ts stays the barrel.
 */

import {
  TeammateErrorCode,
  HEALTH_CHECK_DEFAULTS,
  RATE_LIMIT_DEFAULTS,
  RETRY_DEFAULTS,
} from './types-core.js';
import type {
  DelegationConfig,
  MailboxMessage,
  PermissionMode,
  RecoveryConfig,
  RemoteSyncConfig,
  SyncResult,
  TeamConfig,
  TeamPlan,
  TeammateInfo,
  TeleportConfig,
  TeleportResult,
  TeleportTarget,
} from './types-core.js';


// ============================================================================
// AgentInput (Claude Code Task tool schema)
// ============================================================================

export interface AgentInput {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  resume?: string;
  run_in_background?: boolean;
  max_turns?: number;
  allowed_tools?: string[];
  name?: string;
  team_name?: string;
  mode?: PermissionMode;
}

// ============================================================================
// ExitPlanModeInput (Claude Code plan exit schema)
// ============================================================================

export interface ExitPlanModeInput {
  allowedPrompts?: Array<{ tool: 'Bash'; prompt: string }>;
  pushToRemote?: boolean;
  remoteSessionId?: string;
  remoteSessionUrl?: string;
  remoteSessionTitle?: string;
  launchSwarm?: boolean;
  teammateCount?: number;
}

// ============================================================================
// Event Types
// ============================================================================

export interface TeammateBridgeEvents {
  // Initialization
  'initialized': { claudeCodeVersion: string | null; teammateToolAvailable: boolean };

  // Team lifecycle
  'team:spawned': { team: string; config: TeamConfig };
  'team:cleanup': { team: string };

  // Join/Leave
  'team:join_requested': { team: string; agent: TeammateInfo };
  'team:join_approved': { team: string; agent: string };
  'team:join_rejected': { team: string; agent: string; reason?: string };

  // Teammate lifecycle
  'teammate:spawned': { teammate: TeammateInfo; agentInput: AgentInput };
  'teammate:shutdown_requested': { team: string; teammateId: string; reason?: string };
  'teammate:shutdown_approved': { team: string; teammateId: string };
  'teammate:shutdown_rejected': { team: string; teammateId: string };

  // Messaging
  'message:sent': { team: string; message: MailboxMessage };
  'message:broadcast': { team: string; message: MailboxMessage };
  'mailbox:messages': { team: string; teammateId: string; messages: MailboxMessage[] };

  // Plans
  'plan:submitted': { team: string; plan: TeamPlan };
  'plan:approval_added': { team: string; planId: string; approverId: string };
  'plan:approved': { team: string; plan: TeamPlan };
  'plan:rejected': { team: string; plan: TeamPlan; rejecterId: string; reason?: string };
  'plan:paused': { team: string; planId: string; atStep: number };
  'plan:resumed': { team: string; planId: string; fromStep: number };
  'plan:completed': { team: string; planId: string };
  'plan:failed': { team: string; planId: string; error: string };

  // Swarm
  'swarm:launched': { team: string; plan: TeamPlan; exitPlanInput: ExitPlanModeInput; teammateCount: number };

  // Delegation (NEW)
  'delegate:granted': { team: string; from: string; to: string; permissions: string[] };
  'delegate:revoked': { team: string; from: string; to: string };

  // Remote sync (NEW)
  'remote:pushed': { team: string; remoteUrl: string };
  'remote:pulled': { team: string; changes: number };
  'remote:synced': { team: string; result: SyncResult };
  'remote:disconnected': { team: string; reason?: string };

  // Memory (NEW)
  'memory:saved': { team: string; teammateId: string; size: number };
  'memory:loaded': { team: string; teammateId: string };
  'memory:cleared': { team: string; teammateId?: string };

  // Transcript (NEW)
  'transcript:shared': { team: string; from: string; to: string; messageCount: number };

  // Context (NEW)
  'context:updated': { team: string; keys: string[] };

  // Permissions (NEW)
  'permissions:updated': { team: string; teammateId: string; added: string[]; removed: string[] };

  // Teleport (NEW)
  'teleport:started': { team: string; target: TeleportTarget };
  'teleport:completed': { team: string; result: TeleportResult };
  'teleport:failed': { team: string; error: string };

  // Errors
  'error': Error;
}

// ============================================================================
// Plugin Configuration
// ============================================================================

export interface PluginConfig {
  autoInitialize: boolean;
  fallbackToMCP: boolean;
  recovery: RecoveryConfig;
  delegation: DelegationConfig;
  remoteSync: RemoteSyncConfig;
  teleport: TeleportConfig;
  memory: {
    autoPersist: boolean;
    persistIntervalMs: number;
    maxSizeMb: number;
  };
  mailbox: {
    pollingIntervalMs: number;
    maxMessages: number;
    retentionMs: number;
  };
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  autoInitialize: true,
  fallbackToMCP: true,
  recovery: {
    maxRetries: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true,
    fallbackToMCP: true,
    autoCleanupOnError: true,
  },
  delegation: {
    maxDepth: 3,
    autoExpireMs: 3600000, // 1 hour
    requireApproval: false,
  },
  remoteSync: {
    enabled: false,
    autoSync: false,
    syncInterval: 30000, // 30 seconds
    preserveOnDisconnect: true,
  },
  teleport: {
    autoResume: true,
    gitAware: true,
    preserveMailbox: true,
    preserveMemory: true,
  },
  memory: {
    autoPersist: true,
    persistIntervalMs: 60000, // 1 minute
    maxSizeMb: 100,
  },
  mailbox: {
    pollingIntervalMs: 1000,
    maxMessages: 1000,
    retentionMs: 3600000, // 1 hour
  },
};

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitConfig {
  spawnPerMinute: number;
  messagesPerMinute: number;
  broadcastsPerMinute: number;
  plansPerMinute: number;
  apiCallsPerMinute: number;
}

export interface RateLimitState {
  operation: string;
  count: number;
  windowStart: number;
  blocked: boolean;
  nextAllowedAt?: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  spawnPerMinute: RATE_LIMIT_DEFAULTS.SPAWN_PER_MINUTE,
  messagesPerMinute: RATE_LIMIT_DEFAULTS.MESSAGES_PER_MINUTE,
  broadcastsPerMinute: RATE_LIMIT_DEFAULTS.BROADCASTS_PER_MINUTE,
  plansPerMinute: RATE_LIMIT_DEFAULTS.PLANS_PER_MINUTE,
  apiCallsPerMinute: RATE_LIMIT_DEFAULTS.API_CALLS_PER_MINUTE,
};

// ============================================================================
// Metrics & Telemetry
// ============================================================================

export interface BridgeMetrics {
  // Counters
  teamsCreated: number;
  teammatesSpawned: number;
  messagesSent: number;
  broadcastsSent: number;
  plansSubmitted: number;
  plansApproved: number;
  plansRejected: number;
  swarmsLaunched: number;
  delegationsGranted: number;
  errorsCount: number;

  // Gauges
  activeTeams: number;
  activeTeammates: number;
  pendingPlans: number;
  mailboxSize: number;

  // Histograms (timing in ms)
  spawnLatency: number[];
  messageLatency: number[];
  planApprovalLatency: number[];

  // Rate limiting
  rateLimitHits: number;
  rateLimitBlocks: number;

  // Health
  healthChecksPassed: number;
  healthChecksFailed: number;

  // Timestamps
  startedAt: Date;
  lastActivityAt: Date;
}

export interface MetricSnapshot {
  timestamp: Date;
  metrics: BridgeMetrics;
  rates: {
    messagesPerSecond: number;
    spawnsPerMinute: number;
    errorRate: number;
  };
}

// ============================================================================
// Health Checks
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface TeammateHealthCheck {
  teammateId: string;
  teamName: string;
  status: HealthStatus;
  lastCheck: Date;
  lastHealthy: Date | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  latencyMs: number | null;
  error?: string;
}

export interface TeamHealthReport {
  teamName: string;
  overallStatus: HealthStatus;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  teammates: TeammateHealthCheck[];
  checkedAt: Date;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  autoRemoveUnhealthy: boolean;
}

export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: HEALTH_CHECK_DEFAULTS.INTERVAL_MS,
  timeoutMs: HEALTH_CHECK_DEFAULTS.TIMEOUT_MS,
  unhealthyThreshold: HEALTH_CHECK_DEFAULTS.UNHEALTHY_THRESHOLD,
  healthyThreshold: HEALTH_CHECK_DEFAULTS.HEALTHY_THRESHOLD,
  autoRemoveUnhealthy: false,
};

// ============================================================================
// Retry Logic
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: TeammateErrorCode[];
}

export interface RetryState {
  attempt: number;
  lastError: Error | null;
  nextRetryAt: Date | null;
  totalDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: RETRY_DEFAULTS.MAX_RETRIES,
  initialDelayMs: RETRY_DEFAULTS.INITIAL_DELAY_MS,
  maxDelayMs: RETRY_DEFAULTS.MAX_DELAY_MS,
  backoffMultiplier: RETRY_DEFAULTS.BACKOFF_MULTIPLIER,
  retryableErrors: [
    TeammateErrorCode.TIMEOUT,
    TeammateErrorCode.BACKEND_UNAVAILABLE,
    TeammateErrorCode.REMOTE_SYNC_FAILED,
    TeammateErrorCode.MEMORY_SAVE_FAILED,
  ],
};

// ============================================================================
// Circuit Breaker
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  resetTimeMs: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
  nextAttemptAt: Date | null;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 10000,
  resetTimeMs: 30000,
};

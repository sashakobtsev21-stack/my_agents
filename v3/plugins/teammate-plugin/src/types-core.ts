/**
 * Teammate Plugin — version/team/config/messaging/plan core types
 *
 * Extracted verbatim from types.ts (lines 12-405) during campaign-2
 * wave 69 (W275). types.ts stays the barrel.
 */

// Version Requirements
// ============================================================================

export const MINIMUM_CLAUDE_CODE_VERSION = '2.1.19';

// Security limits
export const SECURITY_LIMITS = {
  MAX_NAME_LENGTH: 64,
  MAX_PAYLOAD_SIZE: 1024 * 1024, // 1MB
  MAX_TEAMMATES_PER_TEAM: 50,
  MAX_MESSAGES_PER_MAILBOX: 1000,
  MAX_PLANS_PER_TEAM: 100,
  MAX_DELEGATION_DEPTH: 5,
} as const;

// Rate limiting defaults
export const RATE_LIMIT_DEFAULTS = {
  SPAWN_PER_MINUTE: 10,
  MESSAGES_PER_MINUTE: 100,
  BROADCASTS_PER_MINUTE: 20,
  PLANS_PER_MINUTE: 5,
  API_CALLS_PER_MINUTE: 200,
} as const;

// Retry configuration
export const RETRY_DEFAULTS = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 100,
  MAX_DELAY_MS: 5000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Health check configuration
export const HEALTH_CHECK_DEFAULTS = {
  INTERVAL_MS: 30000, // 30 seconds
  TIMEOUT_MS: 5000,   // 5 seconds
  UNHEALTHY_THRESHOLD: 3,
  HEALTHY_THRESHOLD: 2,
} as const;

// MCP tool parameter limits
export const MCP_PARAM_LIMITS = {
  MAX_PARAM_LENGTH: 10000,
  MAX_ARRAY_ITEMS: 100,
} as const;

export interface VersionInfo {
  claudeCode: string | null;
  plugin: string;
  compatible: boolean;
  missingFeatures: string[];
}

// ============================================================================
// TeammateTool Operations (13 operations from Claude Code v2.1.19)
// ============================================================================

export type TeammateOperation =
  | 'spawnTeam'
  | 'discoverTeams'
  | 'requestJoin'
  | 'approveJoin'
  | 'rejectJoin'
  | 'write'
  | 'broadcast'
  | 'requestShutdown'
  | 'approveShutdown'
  | 'rejectShutdown'
  | 'approvePlan'
  | 'rejectPlan'
  | 'cleanup';

// ============================================================================
// Team Configuration
// ============================================================================

export type TeamTopology = 'flat' | 'hierarchical' | 'mesh';
export type SpawnBackend = 'tmux' | 'in_process' | 'auto';
export type TeammateType = 'regular' | 'swarm' | 'coordinator' | 'worker';
export type PermissionMode =
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'default'
  | 'delegate'
  | 'dontAsk'
  | 'plan';

export interface TeamConfig {
  name: string;
  topology: TeamTopology;
  maxTeammates: number;
  spawnBackend: SpawnBackend;
  planModeRequired: boolean;
  autoApproveJoin: boolean;
  messageRetention: number;
  delegationEnabled: boolean;
  remoteSync: RemoteSyncConfig;
  tmuxConfig?: TmuxBackendConfig;
}

// ============================================================================
// Teammate Configuration
// ============================================================================

export interface TeammateSpawnConfig {
  name: string;
  role: string;
  prompt: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  allowedTools?: string[];
  mode?: PermissionMode;
  teamName?: string;
  runInBackground?: boolean;
  maxTurns?: number;
  teammateType?: TeammateType;
  delegateAuthority?: boolean;
  delegatedPermissions?: string[];
  delegationDepth?: number;
}

export interface TeammateInfo {
  id: string;
  name: string;
  role: string;
  status: TeammateStatus;
  spawnedAt: Date;
  messagesSent: number;
  messagesReceived: number;
  currentTask?: string;
  delegatedFrom?: string;
  delegatedPermissions?: string[];
  memoryUsage?: number;
  lastHeartbeat?: Date;
}

export type TeammateStatus =
  | 'active'
  | 'idle'
  | 'busy'
  | 'shutdown_pending'
  | 'paused'
  | 'error';

// ============================================================================
// Team State
// ============================================================================

export interface TeamState {
  name: string;
  createdAt: Date;
  teammates: TeammateInfo[];
  pendingJoinRequests: JoinRequest[];
  activePlans: TeamPlan[];
  messageCount: number;
  topology: TeamTopology;
  context: TeamContext;
  delegations: DelegationRecord[];
  remoteSessionId?: string;
  remoteSessionUrl?: string;
}

export interface JoinRequest {
  agentId: string;
  agentName: string;
  requestedAt: Date;
  role: string;
}

// ============================================================================
// Team Context (NEW - from gap analysis)
// ============================================================================

export interface TeamContext {
  teamName: string;
  sharedVariables: Record<string, unknown>;
  inheritedPermissions: string[];
  workingDirectory: string;
  gitBranch?: string;
  gitRepo?: string;
  environmentVariables: Record<string, string>;
}

// ============================================================================
// Delegation (NEW - from gap analysis)
// ============================================================================

export interface DelegationRecord {
  id: string;
  fromId: string;
  toId: string;
  permissions: string[];
  grantedAt: Date;
  expiresAt?: Date;
  depth: number;
  active: boolean;
}

export interface DelegationConfig {
  maxDepth: number;
  autoExpireMs?: number;
  requireApproval: boolean;
}

// ============================================================================
// Messaging
// ============================================================================

export type MessageType = 'task' | 'result' | 'status' | 'plan' | 'approval' | 'delegation' | 'context_update';

export interface MailboxMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  timestamp: Date;
  type: MessageType;
  payload: unknown;
  acknowledged: boolean;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  ttlMs?: number;
}

// ============================================================================
// Plan System
// ============================================================================

export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'paused' | 'completed' | 'failed';

export interface TeamPlan {
  id: string;
  description: string;
  proposedBy: string;
  steps: PlanStep[];
  requiredApprovals: number;
  approvals: string[];
  rejections: string[];
  status: PlanStatus;
  createdAt: Date;
  approvedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  currentStep?: number;
  pausedAt?: number;
}

export interface PlanStep {
  order: number;
  action: string;
  assignee?: string;
  tools: string[];
  estimatedDuration?: number;
  status?: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

// ============================================================================
// Remote Sync (NEW - from gap analysis)
// ============================================================================

export interface RemoteSyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number;
  preserveOnDisconnect: boolean;
}

export interface RemoteSession {
  remoteSessionId: string;
  remoteSessionUrl: string;
  remoteSessionTitle?: string;
  syncedAt: Date;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
}

export interface SyncResult {
  success: boolean;
  changesPushed: number;
  changesPulled: number;
  conflicts: number;
  remoteUrl?: string;
  error?: string;
}

// ============================================================================
// Session Memory (NEW - from gap analysis)
// ============================================================================

export interface TeammateMemory {
  sessionId: string;
  teammateId: string;
  teamName: string;
  transcript: MailboxMessage[];
  context: Record<string, unknown>;
  nestedMemories: TeammateMemory[];
  createdAt: Date;
  updatedAt: Date;
  size: number;
}

export interface MemoryQuery {
  teammateId?: string;
  teamName?: string;
  query?: string;
  limit?: number;
  since?: Date;
  types?: MessageType[];
}

// ============================================================================
// Teleport (NEW - from gap analysis)
// ============================================================================

export interface TeleportConfig {
  autoResume: boolean;
  gitAware: boolean;
  preserveMailbox: boolean;
  preserveMemory: boolean;
}

export interface TeleportTarget {
  workingDirectory?: string;
  gitRepo?: string;
  gitBranch?: string;
  sessionId?: string;
  terminalType?: 'tmux' | 'iterm2' | 'default';
}

export interface TeleportResult {
  success: boolean;
  teamState?: TeamState;
  blockers?: string[];
  warnings?: string[];
}

// ============================================================================
// Spawn Backends
// ============================================================================

export interface TmuxBackendConfig {
  sessionName?: string;
  windowName?: string;
  paneLayout?: 'tiled' | 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical';
  prefixKey?: string;
  shellCommand?: string;
  environment?: Record<string, string>;
}

export interface InProcessConfig {
  maxConcurrent: number;
  memoryLimitMb: number;
  timeoutMs: number;
  isolationLevel: 'none' | 'vm' | 'worker';
}

export interface BackendStatus {
  backend: SpawnBackend;
  available: boolean;
  activeTeammates: number;
  capacity: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Error Handling
// ============================================================================

export enum TeammateErrorCode {
  VERSION_INCOMPATIBLE = 'VERSION_INCOMPATIBLE',
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  TEAMMATE_NOT_FOUND = 'TEAMMATE_NOT_FOUND',
  ALREADY_IN_TEAM = 'ALREADY_IN_TEAM',
  NO_TEAM_CONTEXT = 'NO_TEAM_CONTEXT',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  PLAN_NOT_APPROVED = 'PLAN_NOT_APPROVED',
  PLAN_ALREADY_EXECUTING = 'PLAN_ALREADY_EXECUTING',
  DELEGATION_DENIED = 'DELEGATION_DENIED',
  DELEGATION_DEPTH_EXCEEDED = 'DELEGATION_DEPTH_EXCEEDED',
  REMOTE_SYNC_FAILED = 'REMOTE_SYNC_FAILED',
  TELEPORT_FAILED = 'TELEPORT_FAILED',
  MAILBOX_FULL = 'MAILBOX_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
  MEMORY_SAVE_FAILED = 'MEMORY_SAVE_FAILED',
  MEMORY_LOAD_FAILED = 'MEMORY_LOAD_FAILED',
}

export interface RecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  fallbackToMCP: boolean;
  autoCleanupOnError: boolean;
}

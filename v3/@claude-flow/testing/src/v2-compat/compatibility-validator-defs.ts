/**
 * V2 Compatibility Validator — definitions
 *
 * The validation result shapes and the V2 capability tables
 * (V2_CLI_COMMANDS / V2_MCP_TOOLS / V2_HOOKS / V2_API_INTERFACES).
 * Extracted verbatim from compatibility-validator.ts (lines 15-332)
 * during the P3.57 god-file decomposition (W178).
 * compatibility-validator.ts stays the barrel and re-exports everything
 * here (all of it was public).
 */

export interface ValidationCheck {
  name: string;
  category: 'cli' | 'mcp' | 'hooks' | 'api';
  passed: boolean;
  message: string;
  v2Behavior: string;
  v3Behavior: string;
  breaking: boolean;
  migrationPath?: string;
  details?: Record<string, unknown>;
}

/**
 * Validation result for a category
 */
export interface ValidationResult {
  category: 'cli' | 'mcp' | 'hooks' | 'api';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  breakingChanges: number;
  checks: ValidationCheck[];
  duration: number;
}

/**
 * Full validation report
 */
export interface FullValidationReport {
  timestamp: Date;
  v2Version: string;
  v3Version: string;
  overallPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  breakingChanges: number;
  cli: ValidationResult;
  mcp: ValidationResult;
  hooks: ValidationResult;
  api: ValidationResult;
  summary: string;
  recommendations: string[];
  duration: number;
}

/**
 * V2 CLI command definition
 */
export interface V2CLICommand {
  name: string;
  aliases: string[];
  flags: string[];
  description: string;
  v3Equivalent?: string;
  deprecated?: boolean;
}

/**
 * V2 MCP tool definition
 */
export interface V2MCPTool {
  name: string;
  parameters: Record<string, { type: string; required: boolean }>;
  returnType: string;
  v3Equivalent?: string;
  deprecated?: boolean;
}

/**
 * V2 hook definition
 */
export interface V2Hook {
  name: string;
  trigger: string;
  parameters: string[];
  returnType: string;
  v3Equivalent?: string;
  deprecated?: boolean;
}

/**
 * V2 API interface definition
 */
export interface V2APIInterface {
  name: string;
  methods: { name: string; signature: string }[];
  v3Equivalent?: string;
  deprecated?: boolean;
}

/**
 * V2 CLI Commands (25 total)
 */
export const V2_CLI_COMMANDS: V2CLICommand[] = [
  // Core commands
  { name: 'init', aliases: ['i'], flags: ['--force', '--template'], description: 'Initialize claude-flow project', v3Equivalent: 'init' },
  { name: 'start', aliases: ['s'], flags: ['--detached', '--port'], description: 'Start MCP server', v3Equivalent: 'start' },
  { name: 'stop', aliases: [], flags: ['--force'], description: 'Stop MCP server', v3Equivalent: 'stop' },
  { name: 'status', aliases: ['st'], flags: ['--json', '--verbose'], description: 'Show system status', v3Equivalent: 'status' },
  { name: 'config', aliases: ['c'], flags: ['--get', '--set', '--list'], description: 'Manage configuration', v3Equivalent: 'config' },

  // Agent commands
  { name: 'agent spawn', aliases: ['a spawn'], flags: ['--type', '--id', '--config'], description: 'Spawn new agent', v3Equivalent: 'agent spawn' },
  { name: 'agent list', aliases: ['a ls'], flags: ['--status', '--type'], description: 'List agents', v3Equivalent: 'agent list' },
  { name: 'agent terminate', aliases: ['a kill'], flags: ['--force', '--all'], description: 'Terminate agent', v3Equivalent: 'agent terminate' },
  { name: 'agent info', aliases: ['a info'], flags: ['--metrics'], description: 'Show agent info', v3Equivalent: 'agent status' },

  // Swarm commands
  { name: 'swarm init', aliases: ['sw init'], flags: ['--topology', '--max-agents'], description: 'Initialize swarm', v3Equivalent: 'swarm init' },
  { name: 'swarm status', aliases: ['sw st'], flags: ['--detailed'], description: 'Show swarm status', v3Equivalent: 'swarm status' },
  { name: 'swarm scale', aliases: ['sw scale'], flags: ['--up', '--down'], description: 'Scale swarm', v3Equivalent: 'swarm scale' },

  // Memory commands
  { name: 'memory list', aliases: ['mem ls'], flags: ['--type', '--limit'], description: 'List memories', v3Equivalent: 'memory list' },
  { name: 'memory query', aliases: ['mem q'], flags: ['--search', '--type'], description: 'Query memory', v3Equivalent: 'memory search' },
  { name: 'memory clear', aliases: ['mem clear'], flags: ['--force', '--type'], description: 'Clear memory', v3Equivalent: 'memory clear' },

  // Hooks commands
  { name: 'hooks pre-edit', aliases: [], flags: ['--file'], description: 'Pre-edit hook', v3Equivalent: 'hooks pre-edit' },
  { name: 'hooks post-edit', aliases: [], flags: ['--file', '--success'], description: 'Post-edit hook', v3Equivalent: 'hooks post-edit' },
  { name: 'hooks pre-command', aliases: [], flags: ['--command'], description: 'Pre-command hook', v3Equivalent: 'hooks pre-command' },
  { name: 'hooks post-command', aliases: [], flags: ['--command', '--success'], description: 'Post-command hook', v3Equivalent: 'hooks post-command' },
  { name: 'hooks route', aliases: [], flags: ['--task'], description: 'Route task', v3Equivalent: 'hooks route' },
  { name: 'hooks pretrain', aliases: [], flags: [], description: 'Pretrain from repo', v3Equivalent: 'hooks pretrain' },
  { name: 'hooks metrics', aliases: [], flags: ['--dashboard'], description: 'Show metrics', v3Equivalent: 'hooks metrics' },

  // Deprecated but supported
  { name: 'hive-mind init', aliases: [], flags: [], description: 'Initialize hive', v3Equivalent: 'swarm init', deprecated: true },
  { name: 'neural init', aliases: [], flags: [], description: 'Initialize neural', v3Equivalent: 'hooks pretrain', deprecated: true },
  { name: 'goal init', aliases: [], flags: [], description: 'Initialize goals', v3Equivalent: 'hooks pretrain', deprecated: true },
];

/**
 * V2 MCP Tools (65 total - showing key ones)
 */
export const V2_MCP_TOOLS: V2MCPTool[] = [
  // Agent tools
  { name: 'dispatch_agent', parameters: { type: { type: 'string', required: true }, name: { type: 'string', required: false } }, returnType: 'AgentInfo', v3Equivalent: 'agent/spawn' },
  { name: 'agents/spawn', parameters: { type: { type: 'string', required: true }, config: { type: 'object', required: false } }, returnType: 'AgentInfo', v3Equivalent: 'agent/spawn' },
  { name: 'agents/list', parameters: { status: { type: 'string', required: false } }, returnType: 'AgentInfo[]', v3Equivalent: 'agent/list' },
  { name: 'agents/terminate', parameters: { id: { type: 'string', required: true } }, returnType: 'boolean', v3Equivalent: 'agent/terminate' },
  { name: 'agents/info', parameters: { id: { type: 'string', required: true } }, returnType: 'AgentInfo', v3Equivalent: 'agent/status' },
  { name: 'agent/create', parameters: { type: { type: 'string', required: true } }, returnType: 'AgentInfo', v3Equivalent: 'agent/spawn' },

  // Swarm tools
  { name: 'swarm_status', parameters: {}, returnType: 'SwarmStatus', v3Equivalent: 'swarm/status' },
  { name: 'swarm/get-status', parameters: {}, returnType: 'SwarmStatus', v3Equivalent: 'swarm/status' },
  { name: 'swarm/get-comprehensive-status', parameters: {}, returnType: 'ComprehensiveStatus', v3Equivalent: 'swarm/status' },
  { name: 'mcp__ruv-swarm__swarm_init', parameters: { topology: { type: 'string', required: false } }, returnType: 'SwarmInfo', v3Equivalent: 'swarm/init' },
  { name: 'mcp__ruv-swarm__swarm_status', parameters: {}, returnType: 'SwarmStatus', v3Equivalent: 'swarm/status' },
  { name: 'mcp__ruv-swarm__agent_spawn', parameters: { type: { type: 'string', required: true } }, returnType: 'AgentInfo', v3Equivalent: 'agent/spawn' },
  { name: 'mcp__ruv-swarm__agent_list', parameters: {}, returnType: 'AgentInfo[]', v3Equivalent: 'agent/list' },
  { name: 'mcp__ruv-swarm__agent_metrics', parameters: { id: { type: 'string', required: true } }, returnType: 'AgentMetrics', v3Equivalent: 'agent/status' },

  // Memory tools
  { name: 'memory/query', parameters: { search: { type: 'string', required: true } }, returnType: 'MemoryEntry[]', v3Equivalent: 'memory/search' },
  { name: 'memory/store', parameters: { content: { type: 'string', required: true }, type: { type: 'string', required: false } }, returnType: 'MemoryEntry', v3Equivalent: 'memory/store' },
  { name: 'memory/delete', parameters: { id: { type: 'string', required: true } }, returnType: 'boolean', v3Equivalent: 'memory/delete' },
  { name: 'mcp__ruv-swarm__memory_usage', parameters: {}, returnType: 'MemoryStats', v3Equivalent: 'memory/list' },

  // Config tools
  { name: 'config/get', parameters: { key: { type: 'string', required: true } }, returnType: 'any', v3Equivalent: 'config/load' },
  { name: 'config/update', parameters: { key: { type: 'string', required: true }, value: { type: 'any', required: true } }, returnType: 'boolean', v3Equivalent: 'config/save' },

  // Task tools
  { name: 'task/create', parameters: { description: { type: 'string', required: true } }, returnType: 'TaskInfo', v3Equivalent: 'task/create' },
  { name: 'task/assign', parameters: { taskId: { type: 'string', required: true }, agentId: { type: 'string', required: true } }, returnType: 'boolean', v3Equivalent: 'task/assign' },
  { name: 'task/status', parameters: { taskId: { type: 'string', required: true } }, returnType: 'TaskStatus', v3Equivalent: 'task/status' },
  { name: 'task/complete', parameters: { taskId: { type: 'string', required: true }, result: { type: 'any', required: false } }, returnType: 'boolean', v3Equivalent: 'task/complete' },

  // Neural/Learning tools
  { name: 'mcp__ruv-swarm__neural_status', parameters: {}, returnType: 'NeuralStatus', v3Equivalent: 'hooks/metrics' },
  { name: 'mcp__ruv-swarm__neural_train', parameters: { data: { type: 'object', required: true } }, returnType: 'TrainingResult', v3Equivalent: 'hooks/pretrain' },

  // GitHub integration tools
  { name: 'github/pr-create', parameters: { title: { type: 'string', required: true }, body: { type: 'string', required: false } }, returnType: 'PRInfo', v3Equivalent: 'github/pr-create' },
  { name: 'github/pr-review', parameters: { prNumber: { type: 'number', required: true } }, returnType: 'ReviewInfo', v3Equivalent: 'github/pr-review' },
  { name: 'github/issue-create', parameters: { title: { type: 'string', required: true } }, returnType: 'IssueInfo', v3Equivalent: 'github/issue-create' },

  // Coordination tools
  { name: 'coordinate/consensus', parameters: { proposal: { type: 'object', required: true } }, returnType: 'ConsensusResult', v3Equivalent: 'swarm/consensus' },
  { name: 'coordinate/broadcast', parameters: { message: { type: 'object', required: true } }, returnType: 'BroadcastResult', v3Equivalent: 'swarm/broadcast' },
];

/**
 * V2 Hooks (42 total)
 */
export const V2_HOOKS: V2Hook[] = [
  // Edit hooks
  { name: 'pre-edit', trigger: 'before:file:edit', parameters: ['filePath', 'content'], returnType: 'HookResult', v3Equivalent: 'pre-edit' },
  { name: 'post-edit', trigger: 'after:file:edit', parameters: ['filePath', 'success', 'changes'], returnType: 'HookResult', v3Equivalent: 'post-edit' },
  { name: 'pre-create', trigger: 'before:file:create', parameters: ['filePath'], returnType: 'HookResult', v3Equivalent: 'pre-edit' },
  { name: 'post-create', trigger: 'after:file:create', parameters: ['filePath', 'success'], returnType: 'HookResult', v3Equivalent: 'post-edit' },

  // Command hooks
  { name: 'pre-command', trigger: 'before:command:execute', parameters: ['command', 'args'], returnType: 'HookResult', v3Equivalent: 'pre-command' },
  { name: 'post-command', trigger: 'after:command:execute', parameters: ['command', 'success', 'output'], returnType: 'HookResult', v3Equivalent: 'post-command' },
  { name: 'pre-bash', trigger: 'before:bash:execute', parameters: ['script'], returnType: 'HookResult', v3Equivalent: 'pre-command' },
  { name: 'post-bash', trigger: 'after:bash:execute', parameters: ['script', 'exitCode'], returnType: 'HookResult', v3Equivalent: 'post-command' },

  // Task hooks
  { name: 'pre-task', trigger: 'before:task:start', parameters: ['task'], returnType: 'HookResult', v3Equivalent: 'pre-task' },
  { name: 'post-task', trigger: 'after:task:complete', parameters: ['task', 'result'], returnType: 'HookResult', v3Equivalent: 'post-task' },
  { name: 'task-assign', trigger: 'on:task:assign', parameters: ['task', 'agent'], returnType: 'HookResult', v3Equivalent: 'task-assign' },
  { name: 'task-fail', trigger: 'on:task:fail', parameters: ['task', 'error'], returnType: 'HookResult', v3Equivalent: 'task-fail' },

  // Agent hooks
  { name: 'agent-spawn', trigger: 'on:agent:spawn', parameters: ['agentConfig'], returnType: 'HookResult', v3Equivalent: 'agent-spawn' },
  { name: 'agent-terminate', trigger: 'on:agent:terminate', parameters: ['agentId', 'reason'], returnType: 'HookResult', v3Equivalent: 'agent-terminate' },
  { name: 'agent-message', trigger: 'on:agent:message', parameters: ['from', 'to', 'message'], returnType: 'HookResult', v3Equivalent: 'agent-message' },
  { name: 'agent-error', trigger: 'on:agent:error', parameters: ['agentId', 'error'], returnType: 'HookResult', v3Equivalent: 'agent-error' },

  // Swarm hooks
  { name: 'swarm-init', trigger: 'on:swarm:init', parameters: ['topology', 'config'], returnType: 'HookResult', v3Equivalent: 'swarm-init' },
  { name: 'swarm-scale', trigger: 'on:swarm:scale', parameters: ['direction', 'count'], returnType: 'HookResult', v3Equivalent: 'swarm-scale' },
  { name: 'swarm-consensus', trigger: 'on:swarm:consensus', parameters: ['proposal', 'result'], returnType: 'HookResult', v3Equivalent: 'swarm-consensus' },
  { name: 'swarm-broadcast', trigger: 'on:swarm:broadcast', parameters: ['message'], returnType: 'HookResult', v3Equivalent: 'swarm-broadcast' },

  // Memory hooks
  { name: 'memory-store', trigger: 'on:memory:store', parameters: ['entry'], returnType: 'HookResult', v3Equivalent: 'memory-store' },
  { name: 'memory-retrieve', trigger: 'on:memory:retrieve', parameters: ['query', 'results'], returnType: 'HookResult', v3Equivalent: 'memory-retrieve' },
  { name: 'memory-delete', trigger: 'on:memory:delete', parameters: ['id'], returnType: 'HookResult', v3Equivalent: 'memory-delete' },
  { name: 'memory-consolidate', trigger: 'on:memory:consolidate', parameters: [], returnType: 'HookResult', v3Equivalent: 'memory-consolidate' },

  // Learning hooks
  { name: 'learning-pattern', trigger: 'on:learning:pattern', parameters: ['pattern'], returnType: 'HookResult', v3Equivalent: 'learning-pattern' },
  { name: 'learning-reward', trigger: 'on:learning:reward', parameters: ['trajectory', 'reward'], returnType: 'HookResult', v3Equivalent: 'learning-reward' },
  { name: 'learning-distill', trigger: 'on:learning:distill', parameters: ['memories'], returnType: 'HookResult', v3Equivalent: 'learning-distill' },
  { name: 'learning-consolidate', trigger: 'on:learning:consolidate', parameters: [], returnType: 'HookResult', v3Equivalent: 'learning-consolidate' },

  // Session hooks
  { name: 'session-start', trigger: 'on:session:start', parameters: ['sessionId'], returnType: 'HookResult', v3Equivalent: 'session-start' },
  { name: 'session-end', trigger: 'on:session:end', parameters: ['sessionId', 'metrics'], returnType: 'HookResult', v3Equivalent: 'session-end' },
  { name: 'session-resume', trigger: 'on:session:resume', parameters: ['sessionId'], returnType: 'HookResult', v3Equivalent: 'session-resume' },
  { name: 'session-pause', trigger: 'on:session:pause', parameters: ['sessionId'], returnType: 'HookResult', v3Equivalent: 'session-pause' },

  // Config hooks
  { name: 'config-load', trigger: 'on:config:load', parameters: ['config'], returnType: 'HookResult', v3Equivalent: 'config-load' },
  { name: 'config-save', trigger: 'on:config:save', parameters: ['config'], returnType: 'HookResult', v3Equivalent: 'config-save' },
  { name: 'config-change', trigger: 'on:config:change', parameters: ['key', 'oldValue', 'newValue'], returnType: 'HookResult', v3Equivalent: 'config-change' },

  // Error hooks
  { name: 'error-global', trigger: 'on:error:global', parameters: ['error'], returnType: 'HookResult', v3Equivalent: 'error-global' },
  { name: 'error-recover', trigger: 'on:error:recover', parameters: ['error', 'strategy'], returnType: 'HookResult', v3Equivalent: 'error-recover' },

  // Performance hooks
  { name: 'perf-threshold', trigger: 'on:perf:threshold', parameters: ['metric', 'value'], returnType: 'HookResult', v3Equivalent: 'perf-threshold' },
  { name: 'perf-report', trigger: 'on:perf:report', parameters: ['report'], returnType: 'HookResult', v3Equivalent: 'perf-report' },

  // Security hooks
  { name: 'security-alert', trigger: 'on:security:alert', parameters: ['alert'], returnType: 'HookResult', v3Equivalent: 'security-alert' },
  { name: 'security-block', trigger: 'on:security:block', parameters: ['operation', 'reason'], returnType: 'HookResult', v3Equivalent: 'security-block' },
  { name: 'security-audit', trigger: 'on:security:audit', parameters: ['action', 'context'], returnType: 'HookResult', v3Equivalent: 'security-audit' },
];

/**
 * V2 API Interfaces
 */
export const V2_API_INTERFACES: V2APIInterface[] = [
  // Core interfaces
  {
    name: 'HiveMind',
    methods: [
      { name: 'initialize', signature: '(config?: HiveMindConfig): Promise<void>' },
      { name: 'spawn', signature: '(type: string, config?: AgentConfig): Promise<Agent>' },
      { name: 'getStatus', signature: '(): Promise<HiveMindStatus>' },
      { name: 'shutdown', signature: '(): Promise<void>' },
    ],
    v3Equivalent: 'UnifiedSwarmCoordinator',
  },
  {
    name: 'SwarmCoordinator',
    methods: [
      { name: 'init', signature: '(topology: string): Promise<void>' },
      { name: 'addAgent', signature: '(agent: Agent): Promise<void>' },
      { name: 'removeAgent', signature: '(agentId: string): Promise<void>' },
      { name: 'broadcast', signature: '(message: Message): Promise<void>' },
      { name: 'consensus', signature: '(proposal: Proposal): Promise<ConsensusResult>' },
    ],
    v3Equivalent: 'UnifiedSwarmCoordinator',
  },
  {
    name: 'MemoryManager',
    methods: [
      { name: 'store', signature: '(entry: MemoryEntry): Promise<string>' },
      { name: 'query', signature: '(search: string): Promise<MemoryEntry[]>' },
      { name: 'delete', signature: '(id: string): Promise<boolean>' },
      { name: 'clear', signature: '(): Promise<void>' },
      { name: 'getStats', signature: '(): Promise<MemoryStats>' },
    ],
    v3Equivalent: 'UnifiedMemoryService',
  },
  {
    name: 'AgentManager',
    methods: [
      { name: 'spawn', signature: '(config: AgentConfig): Promise<Agent>' },
      { name: 'terminate', signature: '(id: string): Promise<void>' },
      { name: 'list', signature: '(): Promise<Agent[]>' },
      { name: 'getInfo', signature: '(id: string): Promise<AgentInfo>' },
    ],
    v3Equivalent: 'AgentLifecycleService',
  },
  {
    name: 'TaskOrchestrator',
    methods: [
      { name: 'create', signature: '(definition: TaskDefinition): Promise<Task>' },
      { name: 'assign', signature: '(taskId: string, agentId: string): Promise<void>' },
      { name: 'complete', signature: '(taskId: string, result?: any): Promise<void>' },
      { name: 'getStatus', signature: '(taskId: string): Promise<TaskStatus>' },
    ],
    v3Equivalent: 'TaskExecutionService',
  },
];

/**
 * Mock V3 service for testing
 */

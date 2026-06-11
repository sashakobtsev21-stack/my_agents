/**
 * Init types — core
 *
 * Extracted verbatim during campaign-2 wave W303. Barrel stays.
 */
import os from 'os';
import path from 'path';

export interface InitComponents {
  /** Create .claude/settings.json with hooks */
  settings: boolean;
  /** Copy skills to .claude/skills/ */
  skills: boolean;
  /** Copy commands to .claude/commands/ */
  commands: boolean;
  /** Copy agents to .claude/agents/ */
  agents: boolean;
  /** Create helper scripts in .claude/helpers/ */
  helpers: boolean;
  /** Configure statusline */
  statusline: boolean;
  /** Create MCP configuration */
  mcp: boolean;
  /** Create .claude-flow/ directory (V3 runtime) */
  runtime: boolean;
  /** Create CLAUDE.md with swarm guidance */
  claudeMd: boolean;
}

/**
 * Hook configuration options
 * Valid Claude Code hook events (23 total):
 *   PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit,
 *   SessionStart, SessionEnd, Stop, SubagentStart, SubagentStop,
 *   PreCompact, PostCompact, Notification, ConfigChange,
 *   InstructionsLoaded, PermissionRequest, WorktreeCreate, WorktreeRemove,
 *   TeammateIdle, TaskCompleted, Elicitation, ElicitationResult
 */
export interface HooksConfig {
  /** Enable PreToolUse hooks */
  preToolUse: boolean;
  /** Enable PostToolUse hooks */
  postToolUse: boolean;
  /** Enable UserPromptSubmit for routing */
  userPromptSubmit: boolean;
  /** Enable SessionStart hooks */
  sessionStart: boolean;
  /** Enable Stop hooks */
  stop: boolean;
  /** Enable PreCompact hooks (context preservation before compaction) */
  preCompact: boolean;
  /** Enable Notification hooks */
  notification: boolean;
  /** Enable TeammateIdle hooks (agent teams auto-assign) */
  teammateIdle: boolean;
  /** Enable TaskCompleted hooks (agent teams pattern learning) */
  taskCompleted: boolean;
  /** Hook timeout in milliseconds */
  timeout: number;
  /** Continue on hook error */
  continueOnError: boolean;
}

/**
 * Skills configuration
 */
export interface SkillsConfig {
  /** Include core skills (swarm, memory, sparc) */
  core: boolean;
  /** Include AgentDB skills */
  agentdb: boolean;
  /** Include GitHub integration skills */
  github: boolean;
  /** Include Flow Nexus skills */
  flowNexus: boolean;
  /** Include browser automation skills (agent-browser) */
  browser: boolean;
  /** Include V3 implementation skills */
  v3: boolean;
  /** Include dual-mode skills (Claude Code + Codex hybrid) */
  dualMode: boolean;
  /** Include all available skills */
  all: boolean;
}

/**
 * Commands configuration
 * ADR-128 Phase 4: new keys for promoted substrate dirs and opt-in categories.
 */
export interface CommandsConfig {
  /** Include core commands */
  core: boolean;
  /** Include analysis commands */
  analysis: boolean;
  /** Include automation commands */
  automation: boolean;
  /** Include github commands */
  github: boolean;
  /** Include hooks commands */
  hooks: boolean;
  /** Include monitoring commands */
  monitoring: boolean;
  /** Include optimization commands */
  optimization: boolean;
  /** Include SPARC commands */
  sparc: boolean;
  // ADR-128 Phase 4 — substrate promotions (default true)
  /** Include agents commands */
  agents?: boolean;
  /** Include coordination commands */
  coordination?: boolean;
  /** Include hive-mind commands */
  hiveMind?: boolean;
  /** Include memory commands */
  memory?: boolean;
  /** Include swarm commands */
  swarm?: boolean;
  /** Include workflows commands */
  workflows?: boolean;
  // ADR-128 Phase 4 — opt-in categories (default false)
  /** Include pair programming commands (opt-in) */
  pair?: boolean;
  /** Include training commands (opt-in) */
  training?: boolean;
  /** Include stream-chain commands (opt-in) */
  streamChain?: boolean;
  /** Include truth commands (opt-in) */
  truth?: boolean;
  /** Include verify commands (opt-in) */
  verify?: boolean;
  /** Include all commands */
  all: boolean;
}

/**
 * Agents configuration
 */
export interface AgentsConfig {
  /** Include core agents (coder, tester, reviewer) */
  core: boolean;
  /** Include consensus agents */
  consensus: boolean;
  /** Include GitHub agents */
  github: boolean;
  /** Include hive-mind agents */
  hiveMind: boolean;
  /** Include SPARC agents */
  sparc: boolean;
  /** Include swarm coordinators */
  swarm: boolean;
  /** Include browser automation agents (agent-browser) */
  browser: boolean;
  /** Include V3-specific agents (security, memory, performance, etc.) */
  v3: boolean;
  /** Include optimization agents */
  optimization: boolean;
  /** Include testing agents */
  testing: boolean;
  /** Include dual-mode agents (Claude Code + Codex hybrid) */
  dualMode: boolean;
  /** Include all agents */
  all: boolean;
}

/**
 * Statusline configuration
 */
export interface StatuslineConfig {
  /** Enable statusline */
  enabled: boolean;
  /** Show V3 progress */
  showProgress: boolean;
  /** Show security status */
  showSecurity: boolean;
  /** Show swarm activity */
  showSwarm: boolean;
  /** Show hooks metrics */
  showHooks: boolean;
  /** Show performance targets */
  showPerformance: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval: number;
}

/**
 * MCP configuration
 */
export interface MCPConfig {
  /** Include claude-flow MCP server */
  claudeFlow: boolean;
  /** Include ruv-swarm MCP server */
  ruvSwarm: boolean;
  /** Include flow-nexus MCP server */
  flowNexus: boolean;
  /** Auto-start MCP server */
  autoStart: boolean;
  /** Server port */
  port: number;
}

/**
 * Runtime configuration (.claude-flow/)
 */
export interface RuntimeConfig {
  /** Swarm topology */
  topology: 'mesh' | 'hierarchical' | 'hierarchical-mesh' | 'adaptive';
  /** Maximum agents */
  maxAgents: number;
  /** Memory backend */
  memoryBackend: 'memory' | 'sqlite' | 'agentdb' | 'hybrid';
  /** Enable HNSW indexing */
  enableHNSW: boolean;
  /** Enable neural learning */
  enableNeural: boolean;
  /** Enable LearningBridge (ADR-049) - connects insights to SONA/ReasoningBank */
  enableLearningBridge?: boolean;
  /** Enable MemoryGraph (ADR-049) - PageRank knowledge graph */
  enableMemoryGraph?: boolean;
  /** Enable AgentMemoryScope (ADR-049) - 3-scope agent memory */
  enableAgentScopes?: boolean;
  /** CLAUDE.md template variant */
  claudeMdTemplate?: ClaudeMdTemplate;
}

/** Template variants for generated CLAUDE.md files */
export type ClaudeMdTemplate = 'minimal' | 'standard' | 'full' | 'security' | 'performance' | 'solo';

/**
 * Embeddings configuration
 */
export interface EmbeddingsConfig {
  /** Enable embedding subsystem */
  enabled: boolean;
  /** ONNX model ID */
  model: 'Xenova/all-MiniLM-L6-v2' | 'Xenova/all-mpnet-base-v2' | 'Xenova/bge-small-en-v1.5' | string;
  /** Enable hyperbolic (Poincaré ball) embeddings */
  hyperbolic: boolean;
  /** Poincaré ball curvature (negative value, typically -1) */
  curvature: number;
  /** Pre-download model during init */
  predownload: boolean;
  /** LRU cache size (number of embeddings) */
  cacheSize: number;
  /** Enable neural substrate integration */
  neuralSubstrate: boolean;
}

/**
 * Detected platform information
 */
export interface PlatformInfo {
  /** Operating system */
  os: 'windows' | 'darwin' | 'linux';
  /** Architecture */
  arch: 'x64' | 'arm64' | 'arm' | 'ia32';
  /** Node.js version */
  nodeVersion: string;
  /** Shell type */
  shell: 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh';
  /** Home directory */
  homeDir: string;
  /** Config directory (platform-specific) */
  configDir: string;
}

/**
 * Detect current platform
 */
export function detectPlatform(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();
  const homeDir = os.homedir();

  let osType: 'windows' | 'darwin' | 'linux';
  let shell: 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh';
  let configDir: string;

  switch (platform) {
    case 'win32':
      osType = 'windows';
      shell = process.env.PSModulePath ? 'powershell' : 'cmd';
      configDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      break;
    case 'darwin':
      osType = 'darwin';
      shell = process.env.SHELL?.includes('zsh') ? 'zsh' : 'bash';
      configDir = path.join(homeDir, 'Library', 'Application Support');
      break;
    default:
      osType = 'linux';
      shell = process.env.SHELL?.includes('zsh') ? 'zsh' : (process.env.SHELL?.includes('bash') ? 'bash' : 'sh');
      configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  }

  return {
    os: osType,
    arch: arch as PlatformInfo['arch'],
    nodeVersion: process.version,
    shell,
    homeDir,
    configDir,
  };
}

/**
 * Complete init options
 */

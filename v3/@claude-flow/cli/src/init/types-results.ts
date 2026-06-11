/**
 * Init types — extended
 *
 * Extracted verbatim during campaign-2 wave W303. Barrel stays.
 */
import type {
  AgentsConfig,
  CommandsConfig,
  EmbeddingsConfig,
  HooksConfig,
  InitComponents,
  MCPConfig,
  PlatformInfo,
  RuntimeConfig,
  SkillsConfig,
  StatuslineConfig,
} from './types-core.js';

export interface InitOptions {
  /** Target directory */
  targetDir: string;
  /** Source base directory for skills/commands/agents (optional) */
  sourceBaseDir?: string;
  /** Force overwrite existing files */
  force: boolean;
  /** Run in interactive mode */
  interactive: boolean;
  /** Components to initialize */
  components: InitComponents;
  /** Hooks configuration */
  hooks: HooksConfig;
  /** Skills configuration */
  skills: SkillsConfig;
  /** Commands configuration */
  commands: CommandsConfig;
  /** Agents configuration */
  agents: AgentsConfig;
  /** Statusline configuration */
  statusline: StatuslineConfig;
  /** MCP configuration */
  mcp: MCPConfig;
  /** Runtime configuration */
  runtime: RuntimeConfig;
  /** Embeddings configuration */
  embeddings: EmbeddingsConfig;
  /**
   * Skip the user-global ~/.claude/CLAUDE.md "Ruflo Integration" pointer block.
   * Defaults to false (current behavior — block is appended once, idempotent).
   * Set true via --no-global to keep the global Claude rules file pristine (#1744).
   */
  skipGlobalClaudeMd?: boolean;
  /**
   * #1670 — opt in to writing the `attribution` block in `.claude/settings.json`
   * (Co-Authored-By trailer + PR footer). Defaults to false: most users do not
   * want a third-party Co-Authored-By line silently added to their commits and
   * GitHub contributor graph. Pass `--attribution` to opt in.
   */
  attribution?: boolean;
}

/**
 * Default init options - full V3 setup
 */
export const DEFAULT_INIT_OPTIONS: InitOptions = {
  targetDir: process.cwd(),
  force: false,
  interactive: true,
  components: {
    settings: true,
    skills: true,
    commands: true,
    agents: true,
    helpers: true,
    statusline: true,
    mcp: true,
    runtime: true,
    claudeMd: true,
  },
  hooks: {
    preToolUse: true,
    postToolUse: true,
    userPromptSubmit: true,
    sessionStart: true,
    stop: true,
    preCompact: true,
    notification: true,
    teammateIdle: true,
    taskCompleted: true,
    timeout: 5000,
    continueOnError: true,
  },
  skills: {
    core: true,
    agentdb: true,
    github: true,
    flowNexus: false,
    browser: true,
    v3: true,
    dualMode: false,  // Optional: enable with --dual flag
    all: false,
  },
  commands: {
    core: true,
    analysis: true,
    automation: true,
    github: true,
    hooks: true,
    monitoring: true,
    optimization: true,
    sparc: true,
    // ADR-128 Phase 4 substrate promotions (default true — core swarm substrate)
    agents: true,
    coordination: true,
    hiveMind: true,
    memory: true,
    swarm: true,
    workflows: true,
    // ADR-128 Phase 4 opt-in (default false — not universal)
    pair: false,
    training: false,
    streamChain: false,
    truth: false,
    verify: false,
    all: false,
  },
  agents: {
    core: true,
    consensus: true,
    github: false,    // ADR-128 Phase 3: opt-in via --agents=github or --all-agents
    hiveMind: false,  // ADR-128 Phase 3: opt-in via --all-agents
    sparc: true,
    swarm: true,
    browser: true,
    v3: false,        // ADR-128 Phase 3: opt-in via --agents=v3 or --all-agents
    optimization: false, // ADR-128 Phase 3: opt-in via --all-agents
    testing: true,
    dualMode: false,  // Optional: enable with --dual flag
    all: false,       // ADR-128 Phase 3: was true; use --all-agents to restore
  },
  statusline: {
    enabled: true,
    showProgress: true,
    showSecurity: true,
    showSwarm: true,
    showHooks: true,
    showPerformance: true,
    refreshInterval: 5000,
  },
  mcp: {
    claudeFlow: true,
    ruvSwarm: false,
    flowNexus: false,
    autoStart: false,
    port: 3000,
  },
  runtime: {
    topology: 'hierarchical-mesh',
    maxAgents: 15,
    memoryBackend: 'hybrid',
    enableHNSW: true,
    enableNeural: true,
    enableLearningBridge: true,
    enableMemoryGraph: true,
    enableAgentScopes: true,
  },
  embeddings: {
    enabled: true,
    model: 'Xenova/all-MiniLM-L6-v2',
    hyperbolic: true,
    curvature: -1.0,
    predownload: false,  // Don't auto-download to speed up init
    cacheSize: 256,
    neuralSubstrate: true,
  },
};

/**
 * Minimal init options
 */
export const MINIMAL_INIT_OPTIONS: InitOptions = {
  ...DEFAULT_INIT_OPTIONS,
  components: {
    settings: true,
    skills: true,
    commands: false,
    agents: false,
    helpers: false,
    statusline: false,
    mcp: true,
    runtime: true,
    claudeMd: true,
  },
  hooks: {
    ...DEFAULT_INIT_OPTIONS.hooks,
    userPromptSubmit: false,
    stop: false,
    notification: false,
    teammateIdle: false,
    taskCompleted: false,
  },
  skills: {
    core: true,
    agentdb: false,
    github: false,
    flowNexus: false,
    browser: false,
    v3: false,
    dualMode: false,
    all: false,
  },
  agents: {
    core: true,
    consensus: false,
    github: false,
    hiveMind: false,
    sparc: false,
    swarm: false,
    browser: false,
    v3: false,
    optimization: false,
    testing: false,
    dualMode: false,
    all: false,
  },
  runtime: {
    topology: 'mesh',
    maxAgents: 5,
    memoryBackend: 'memory',
    enableHNSW: false,
    enableNeural: false,
    enableLearningBridge: false,
    enableMemoryGraph: false,
    enableAgentScopes: false,
  },
  embeddings: {
    enabled: false,
    model: 'Xenova/all-MiniLM-L6-v2',
    hyperbolic: false,
    curvature: -1.0,
    predownload: false,
    cacheSize: 128,
    neuralSubstrate: false,
  },
};

/**
 * Full init options (everything enabled)
 */
export const FULL_INIT_OPTIONS: InitOptions = {
  ...DEFAULT_INIT_OPTIONS,
  components: {
    settings: true,
    skills: true,
    commands: true,
    agents: true,
    helpers: true,
    statusline: true,
    mcp: true,
    runtime: true,
    claudeMd: true,
  },
  skills: {
    core: true,
    agentdb: true,
    github: true,
    flowNexus: true,
    browser: true,
    v3: true,
    dualMode: true,  // Include in full init
    all: true,
  },
  commands: {
    ...DEFAULT_INIT_OPTIONS.commands,
    all: true,
  },
  agents: {
    ...DEFAULT_INIT_OPTIONS.agents,
    all: true,
  },
  mcp: {
    claudeFlow: true,
    ruvSwarm: true,
    flowNexus: true,
    autoStart: false,
    port: 3000,
  },
  embeddings: {
    enabled: true,
    model: 'Xenova/all-MiniLM-L6-v2',
    hyperbolic: true,
    curvature: -1.0,
    predownload: true,  // Pre-download for full init
    cacheSize: 256,
    neuralSubstrate: true,
  },
};

/**
 * Init result
 */
export interface InitResult {
  success: boolean;
  platform: PlatformInfo;
  created: {
    directories: string[];
    files: string[];
  };
  skipped: string[];
  errors: string[];
  summary: {
    skillsCount: number;
    commandsCount: number;
    agentsCount: number;
    hooksEnabled: number;
  };
}

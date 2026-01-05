# Configuration Options

Complete reference for V3 init configuration options.

## InitOptions Interface

```typescript
interface InitOptions {
  targetDir: string;           // Target directory for initialization
  sourceBaseDir?: string;      // Source directory for skills/commands/agents
  force: boolean;              // Overwrite existing files
  interactive: boolean;        // Enable interactive prompts
  components: InitComponents;  // Components to initialize
  hooks: HooksConfig;          // Hooks configuration
  skills: SkillsConfig;        // Skills selection
  commands: CommandsConfig;    // Commands selection
  agents: AgentsConfig;        // Agents selection
  statusline: StatuslineConfig; // Statusline configuration
  mcp: MCPConfig;              // MCP server configuration
  runtime: RuntimeConfig;      // Runtime configuration
}
```

## Components

Control which components are created:

```typescript
interface InitComponents {
  settings: boolean;    // .claude/settings.json
  skills: boolean;      // .claude/skills/
  commands: boolean;    // .claude/commands/
  agents: boolean;      // .claude/agents/
  helpers: boolean;     // .claude/helpers/
  statusline: boolean;  // Statusline scripts
  mcp: boolean;         // .mcp.json
  runtime: boolean;     // .claude-flow/
}
```

| Component | Default | Minimal | Full |
|-----------|---------|---------|------|
| settings | true | true | true |
| skills | true | true | true |
| commands | true | false | true |
| agents | true | false | true |
| helpers | true | false | true |
| statusline | true | false | true |
| mcp | true | true | true |
| runtime | true | true | true |

## Hooks Configuration

Configure which Claude Code hooks are enabled:

```typescript
interface HooksConfig {
  preToolUse: boolean;       // Before tool execution
  postToolUse: boolean;      // After tool execution
  userPromptSubmit: boolean; // Task routing
  sessionStart: boolean;     // Session initialization
  stop: boolean;             // Task completion evaluation
  notification: boolean;     // Swarm notifications
  permissionRequest: boolean; // Auto-allow claude-flow tools
  timeout: number;           // Hook timeout (ms)
  continueOnError: boolean;  // Continue if hook fails
}
```

### Default Hook Settings
```typescript
{
  preToolUse: true,
  postToolUse: true,
  userPromptSubmit: true,
  sessionStart: true,
  stop: true,
  notification: true,
  permissionRequest: true,
  timeout: 5000,
  continueOnError: true
}
```

## Skills Configuration

Select which skill sets to install:

```typescript
interface SkillsConfig {
  core: boolean;      // swarm-orchestration, sparc-methodology, etc.
  agentdb: boolean;   // agentdb-*, reasoningbank-*
  github: boolean;    // github-code-review, github-multi-repo, etc.
  flowNexus: boolean; // flow-nexus-neural, flow-nexus-platform, etc.
  v3: boolean;        // v3-cli-modernization, v3-core-implementation, etc.
  all: boolean;       // Install all available skills
}
```

### Skills by Category

**Core Skills:**
- swarm-orchestration
- swarm-advanced
- sparc-methodology
- hooks-automation
- pair-programming
- verification-quality
- stream-chain
- skill-builder

**AgentDB Skills:**
- agentdb-advanced
- agentdb-learning
- agentdb-memory-patterns
- agentdb-optimization
- agentdb-vector-search
- reasoningbank-agentdb
- reasoningbank-intelligence

**GitHub Skills:**
- github-code-review
- github-multi-repo
- github-project-management
- github-release-management
- github-workflow-automation

**Flow Nexus Skills:**
- flow-nexus-neural
- flow-nexus-platform
- flow-nexus-swarm

**V3 Skills:**
- v3-cli-modernization
- v3-core-implementation
- v3-ddd-architecture
- v3-integration-deep
- v3-mcp-optimization
- v3-memory-unification
- v3-performance-optimization
- v3-security-overhaul
- v3-swarm-coordination

## Commands Configuration

Select which command groups to install:

```typescript
interface CommandsConfig {
  core: boolean;         // claude-flow-help, claude-flow-swarm, etc.
  analysis: boolean;     // analysis/
  automation: boolean;   // automation/
  github: boolean;       // github/
  hooks: boolean;        // hooks/
  monitoring: boolean;   // monitoring/
  optimization: boolean; // optimization/
  sparc: boolean;        // sparc/
  all: boolean;          // Install all commands
}
```

## Agents Configuration

Select which agent categories to install:

```typescript
interface AgentsConfig {
  core: boolean;      // core/ (coder, tester, reviewer, etc.)
  consensus: boolean; // consensus/
  github: boolean;    // github/
  hiveMind: boolean;  // hive-mind/
  sparc: boolean;     // sparc/
  swarm: boolean;     // swarm/
  all: boolean;       // Install all agents
}
```

## Statusline Configuration

Configure shell statusline integration:

```typescript
interface StatuslineConfig {
  enabled: boolean;         // Enable statusline
  showProgress: boolean;    // Show V3 progress
  showSecurity: boolean;    // Show security status
  showSwarm: boolean;       // Show swarm activity
  showHooks: boolean;       // Show hooks metrics
  showPerformance: boolean; // Show performance targets
  refreshInterval: number;  // Refresh interval (ms)
}
```

## MCP Configuration

Configure MCP server integration:

```typescript
interface MCPConfig {
  claudeFlow: boolean; // Include claude-flow MCP server
  ruvSwarm: boolean;   // Include ruv-swarm MCP server
  flowNexus: boolean;  // Include flow-nexus MCP server
  autoStart: boolean;  // Auto-start MCP server
  port: number;        // Server port
}
```

## Runtime Configuration

Configure V3 runtime settings:

```typescript
interface RuntimeConfig {
  topology: 'mesh' | 'hierarchical' | 'hierarchical-mesh' | 'adaptive';
  maxAgents: number;        // Maximum concurrent agents
  memoryBackend: 'memory' | 'sqlite' | 'agentdb' | 'hybrid';
  enableHNSW: boolean;      // Enable HNSW indexing
  enableNeural: boolean;    // Enable neural learning
}
```

### Topology Options

| Topology | Description | Best For |
|----------|-------------|----------|
| mesh | Peer-to-peer coordination | Small teams, simple tasks |
| hierarchical | Tree-based coordination | Large teams, complex tasks |
| hierarchical-mesh | Combined approach | Complex projects (recommended) |
| adaptive | Dynamic switching | Variable workloads |

### Memory Backend Options

| Backend | Speed | Persistence | Vector Search | Best For |
|---------|-------|-------------|---------------|----------|
| memory | Fast | No | No | Development, testing |
| sqlite | Medium | Yes | No | Standard projects |
| agentdb | Fast | Yes | 150x faster | AI-heavy workloads |
| hybrid | Fast | Yes | Yes | Production (recommended) |

## Preset Configurations

### DEFAULT_INIT_OPTIONS
```typescript
{
  components: { all: true except statusline },
  hooks: { all: true },
  skills: { core, agentdb, github, v3 },
  commands: { all: true },
  agents: { core, github, hiveMind, sparc, swarm },
  runtime: {
    topology: 'hierarchical-mesh',
    maxAgents: 15,
    memoryBackend: 'hybrid',
    enableHNSW: true,
    enableNeural: true
  }
}
```

### MINIMAL_INIT_OPTIONS
```typescript
{
  components: { settings, skills, mcp, runtime only },
  hooks: { preToolUse, postToolUse, permissionRequest only },
  skills: { core only },
  agents: { core only },
  runtime: {
    topology: 'mesh',
    maxAgents: 5,
    memoryBackend: 'memory',
    enableHNSW: false,
    enableNeural: false
  }
}
```

### FULL_INIT_OPTIONS
```typescript
{
  components: { all: true },
  hooks: { all: true },
  skills: { all: true },
  commands: { all: true },
  agents: { all: true },
  mcp: { claudeFlow, ruvSwarm, flowNexus },
  runtime: {
    topology: 'hierarchical-mesh',
    maxAgents: 15,
    memoryBackend: 'hybrid',
    enableHNSW: true,
    enableNeural: true
  }
}
```

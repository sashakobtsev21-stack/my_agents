/**
 * Static configuration maps for the init pipeline — which skills,
 * commands, and agents to copy per preset, plus the directory scaffold.
 * Pure data, no logic.
 *
 * Extracted from executor.ts (W77, P3.6 cut #1).
 */

/**
 * Skills to copy based on configuration
 */
export const SKILLS_MAP: Record<string, string[]> = {
  core: [
    'swarm-orchestration',
    'swarm-advanced',
    'sparc-methodology',
    'hooks-automation',
    'pair-programming',
    'verification-quality',
    'stream-chain',
    'skill-builder',
  ],
  browser: ['browser'],  // agent-browser integration
  dualMode: ['dual-mode'],  // Claude Code + Codex hybrid execution
  agentdb: [
    'agentdb-advanced',
    'agentdb-learning',
    'agentdb-memory-patterns',
    'agentdb-optimization',
    'agentdb-vector-search',
    'reasoningbank-agentdb',
    'reasoningbank-intelligence',
  ],
  github: [
    'github-code-review',
    'github-multi-repo',
    'github-project-management',
    'github-release-management',
    'github-workflow-automation',
  ],
  flowNexus: [
    'flow-nexus-neural',
    'flow-nexus-platform',
    'flow-nexus-swarm',
  ],
  v3: [
    'v3-cli-modernization',
    'v3-core-implementation',
    'v3-ddd-architecture',
    'v3-integration-deep',
    'v3-mcp-optimization',
    'v3-memory-unification',
    'v3-performance-optimization',
    'v3-security-overhaul',
    'v3-swarm-coordination',
  ],
};

/**
 * Commands to copy based on configuration
 * ADR-128 Phase 4: every subdirectory under .claude/commands/ now has a
 * corresponding key. The flow-nexus/ dir was deleted (belongs to the plugin).
 * New substrate keys default true; opt-in keys (pair, training, stream-chain,
 * truth, verify) default false per ADR-128 §Phase 3 opt-in rationale.
 */
export const COMMANDS_MAP: Record<string, string[]> = {
  core: ['claude-flow-help.md', 'claude-flow-swarm.md', 'claude-flow-memory.md'],
  analysis: ['analysis'],
  automation: ['automation'],
  github: ['github'],
  hooks: ['hooks'],
  monitoring: ['monitoring'],
  optimization: ['optimization'],
  sparc: ['sparc'],
  // ADR-128 Phase 4 promotions (previously orphaned)
  agents: ['agents'],
  coordination: ['coordination'],
  hiveMind: ['hive-mind'],
  memory: ['memory'],
  swarm: ['swarm'],
  workflows: ['workflows'],
  // Opt-in categories (non-universal; default false in CommandsConfig)
  pair: ['pair'],
  training: ['training'],
  streamChain: ['stream-chain'],
  truth: ['truth'],
  verify: ['verify'],
};

/**
 * Agents to copy based on configuration
 */
export const AGENTS_MAP: Record<string, string[]> = {
  core: ['core'],
  consensus: ['consensus'],
  github: ['github'],
  hiveMind: ['hive-mind'],
  sparc: ['sparc'],
  swarm: ['swarm'],
  browser: ['browser'],  // agent-browser integration
  dualMode: ['dual-mode'],  // Claude Code + Codex hybrid execution
  // V3-specific agents
  v3: ['v3'],
  optimization: ['optimization'],
  templates: ['templates'],
  testing: ['testing'],
  sublinear: ['sublinear'],
  flowNexus: ['flow-nexus'],
  analysis: ['analysis'],
  architecture: ['architecture'],
  development: ['development'],
  devops: ['devops'],
  documentation: ['documentation'],
  specialized: ['specialized'],
  goal: ['goal'],
  sona: ['sona'],
  payments: ['payments'],
  data: ['data'],
  custom: ['custom'],
};

/**
 * Directory structure to create
 */
export const DIRECTORIES = {
  claude: [
    '.claude',
    '.claude/skills',
    '.claude/commands',
    '.claude/agents',
    '.claude/helpers',
  ],
  runtime: [
    '.claude-flow',
    '.claude-flow/data',
    '.claude-flow/logs',
    '.claude-flow/sessions',
    '.claude-flow/hooks',
    '.claude-flow/agents',
    '.claude-flow/workflows',
  ],
};

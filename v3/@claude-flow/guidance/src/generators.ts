/**
 * CLAUDE.md Generator
 *
 * Generates a structured CLAUDE.md file optimized for the Guidance Control Plane.
 * The output is designed so that when compiled by GuidanceCompiler, it produces
 * a clean constitution (always-loaded invariants) and well-tagged shards
 * (task-scoped rules retrievable by intent).
 *
 * Structure conventions:
 * - Lines 1-60: Constitution (always loaded into every task)
 * - Remaining: Tagged shards (retrieved by intent classification)
 * - Headings map to shard boundaries
 * - Keywords in headings drive intent tagging: "test", "build", "security", etc.
 *
 * @module @claude-flow/guidance/generators
 */

// ============================================================================
// Types
// ============================================================================

export interface ProjectProfile {
  /** Project name */
  name: string;
  /** Short description */
  description?: string;
  /** Primary language(s) */
  languages: string[];
  /** Frameworks in use */
  frameworks?: string[];
  /** Package manager */
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  /** Monorepo? */
  monorepo?: boolean;
  /** Build command */
  buildCommand?: string;
  /** Test command */
  testCommand?: string;
  /** Lint command */
  lintCommand?: string;
  /** Source directory */
  srcDir?: string;
  /** Test directory */
  testDir?: string;
  /** Domain-specific rules */
  domainRules?: string[];
  /** Architecture notes */
  architecture?: string;
  /** Team conventions */
  conventions?: string[];
  /** Forbidden patterns */
  forbidden?: string[];
  /** Required patterns */
  required?: string[];
  /** Import paths for personal instructions */
  imports?: string[];
  /** Enable guidance control plane integration */
  guidanceControlPlane?: boolean;
  /** Enable WASM kernel for hot paths */
  wasmKernel?: boolean;
  /** Agent swarm configuration */
  swarm?: {
    topology?: 'hierarchical' | 'mesh' | 'adaptive';
    maxAgents?: number;
    strategy?: 'specialized' | 'balanced';
  };
}

export interface LocalProfile {
  /** Developer name or identifier */
  developer?: string;
  /** Local API URLs */
  localUrls?: Record<string, string>;
  /** Local database connection strings */
  databases?: Record<string, string>;
  /** Personal preferences */
  preferences?: string[];
  /** Machine-specific notes */
  machineNotes?: string[];
  /** Editor / IDE */
  editor?: string;
  /** OS */
  os?: string;
  /** Custom environment variables */
  envVars?: Record<string, string>;
  /** Debug settings */
  debug?: string[];
}

export interface SkillDefinition {
  /** Skill name (kebab-case) */
  name: string;
  /** Version */
  version?: string;
  /** Description */
  description: string;
  /** Category */
  category: 'core' | 'github' | 'testing' | 'security' | 'deployment' | 'analysis' | 'custom';
  /** Tags */
  tags?: string[];
  /** Required tools */
  requires?: string[];
  /** Capabilities list */
  capabilities?: string[];
  /** Skill instructions (markdown body) */
  instructions: string;
}

export interface AgentDefinition {
  /** Agent name (kebab-case) */
  name: string;
  /** Agent type */
  type: 'coordinator' | 'developer' | 'tester' | 'reviewer' | 'security-specialist' | 'researcher' | 'architect' | 'devops' | 'custom';
  /** Description */
  description: string;
  /** Category subdirectory */
  category?: string;
  /** Color for UI */
  color?: string;
  /** Capabilities */
  capabilities?: string[];
  /** Focus areas */
  focus?: string[];
  /** Temperature (0.0-1.0) */
  temperature?: number;
  /** Priority */
  priority?: 'high' | 'medium' | 'low';
  /** System prompt */
  systemPrompt?: string;
  /** Pre-execution hook */
  preHook?: string;
  /** Post-execution hook */
  postHook?: string;
  /** Detailed instructions (markdown body) */
  instructions?: string;
}


// The template generators were extracted into ./generators-md.ts and
// ./generators-agents.ts during campaign-2 wave 30 (W236) (type-only
// back-imports — the W208/W234 static-cycle shape). 'export' keeps the
// surface byte-identical; scaffold() composes them below.
export { generateClaudeMd, generateClaudeLocalMd } from './generators-md.js';
export { generateSkillMd, generateAgentMd } from './generators-agents.js';
import { generateClaudeLocalMd, generateClaudeMd } from './generators-md.js';
import { generateAgentMd, generateSkillMd } from './generators-agents.js';

// ============================================================================
// Agent Index Generator
// ============================================================================

export function generateAgentIndex(agents: AgentDefinition[]): string {
  const lines: string[] = [];
  lines.push('# Generated Agent Index');
  lines.push('');
  lines.push('agents:');
  for (const a of agents) {
    lines.push(`  - ${a.name}`);
  }
  lines.push('');

  // Group by type
  const byType = new Map<string, string[]>();
  for (const a of agents) {
    const list = byType.get(a.type) || [];
    list.push(a.name);
    byType.set(a.type, list);
  }

  lines.push('types:');
  for (const [type, names] of byType) {
    lines.push(`  ${type}:`);
    for (const n of names) {
      lines.push(`    - ${n}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Scaffold Generator (creates full .claude/ directory structure)
// ============================================================================

export interface ScaffoldOptions {
  /** Project profile for CLAUDE.md */
  project: ProjectProfile;
  /** Local profile for CLAUDE.local.md (optional) */
  local?: LocalProfile;
  /** Skills to generate */
  skills?: SkillDefinition[];
  /** Agents to generate */
  agents?: AgentDefinition[];
  /** Include default agents based on project profile */
  includeDefaultAgents?: boolean;
  /** Include default skills based on project profile */
  includeDefaultSkills?: boolean;
}

export interface ScaffoldResult {
  /** Map of relative file path → content */
  files: Map<string, string>;
}

export function scaffold(options: ScaffoldOptions): ScaffoldResult {
  const files = new Map<string, string>();

  // CLAUDE.md
  files.set('CLAUDE.md', generateClaudeMd(options.project));

  // CLAUDE.local.md
  if (options.local) {
    files.set('CLAUDE.local.md', generateClaudeLocalMd(options.local));
  }

  // Default agents based on project
  const agents = [...(options.agents || [])];
  if (options.includeDefaultAgents) {
    agents.push(...getDefaultAgents(options.project));
  }

  // Default skills based on project
  const skills = [...(options.skills || [])];
  if (options.includeDefaultSkills) {
    skills.push(...getDefaultSkills(options.project));
  }

  // Generate agent files
  for (const agent of agents) {
    const category = agent.category || 'core';
    const path = `.claude/agents/${category}/${agent.name}.md`;
    files.set(path, generateAgentMd(agent));
  }

  // Generate agent index
  if (agents.length > 0) {
    files.set('.claude/agents/index.yaml', generateAgentIndex(agents));
  }

  // Generate skill files
  for (const skill of skills) {
    const path = `.claude/skills/${skill.name}/SKILL.md`;
    files.set(path, generateSkillMd(skill));
  }

  return { files };
}

// ============================================================================
// Helpers
// ============================================================================

// formatTitle moved to ./generators-agents.ts (W236).

// getLanguageInvariants moved to ./generators-md.ts (W236).

// getFrameworkRules moved to ./generators-md.ts (W236).

function getDefaultAgents(profile: ProjectProfile): AgentDefinition[] {
  const agents: AgentDefinition[] = [];

  // Every project gets a coordinator and coder
  agents.push({
    name: 'coordinator',
    type: 'coordinator',
    description: `Coordinates multi-agent workflows for ${profile.name}`,
    category: 'core',
    color: '#4A90D9',
    capabilities: ['task-decomposition', 'agent-routing', 'context-management', 'progress-tracking'],
    temperature: 0.2,
    priority: 'high',
    instructions: [
      'Break complex tasks into subtasks and assign to specialized agents.',
      'Track progress across all active agents.',
      'Resolve conflicts when agents produce contradictory outputs.',
      'Ensure all subtasks align with the original goal.',
    ].join('\n'),
  });

  agents.push({
    name: 'coder',
    type: 'developer',
    description: `Implementation specialist for ${profile.name}`,
    category: 'core',
    color: '#FF6B35',
    capabilities: ['code-generation', 'refactoring', 'optimization', 'api-design', 'error-handling'],
    focus: profile.languages,
    temperature: 0.2,
    priority: 'high',
    instructions: [
      `Write clean, idiomatic ${profile.languages.join('/')} code.`,
      'Follow the coding standards defined in CLAUDE.md.',
      'Prefer editing existing files over creating new ones.',
      'Run tests after making changes.',
    ].join('\n'),
  });

  agents.push({
    name: 'tester',
    type: 'tester',
    description: `Test specialist for ${profile.name}`,
    category: 'core',
    color: '#2ECC71',
    capabilities: ['unit-testing', 'integration-testing', 'test-coverage', 'edge-cases'],
    temperature: 0.2,
    priority: 'high',
    instructions: [
      'Write tests that cover the happy path and meaningful edge cases.',
      'Use descriptive test names that explain the expected behavior.',
      'Keep tests isolated — no shared mutable state between tests.',
      `Run: \`${profile.testCommand || (profile.packageManager || 'npm') + ' test'}\``,
    ].join('\n'),
  });

  agents.push({
    name: 'reviewer',
    type: 'reviewer',
    description: `Code review specialist for ${profile.name}`,
    category: 'core',
    color: '#9B59B6',
    capabilities: ['code-review', 'quality-analysis', 'security-review', 'performance-review'],
    temperature: 0.3,
    priority: 'medium',
    instructions: [
      'Review for correctness, readability, and maintainability.',
      'Check for security issues: injection, XSS, hardcoded secrets.',
      'Flag unnecessary complexity and suggest simpler alternatives.',
      'Verify test coverage for changed code.',
    ].join('\n'),
  });

  // Security agent if guidance control plane is enabled
  if (profile.guidanceControlPlane) {
    agents.push({
      name: 'security-auditor',
      type: 'security-specialist',
      description: 'Security analysis integrated with guidance control plane',
      category: 'security',
      color: '#E74C3C',
      capabilities: ['threat-detection', 'secret-scanning', 'input-validation', 'dependency-audit'],
      temperature: 0.1,
      priority: 'high',
      instructions: [
        'Scan all code changes for secrets and credentials.',
        'Check for OWASP Top 10 vulnerabilities.',
        'Validate that enforcement gates are wired for all external inputs.',
        'Report findings through the guidance proof chain for audit trail.',
      ].join('\n'),
    });
  }

  return agents;
}

function getDefaultSkills(profile: ProjectProfile): SkillDefinition[] {
  const skills: SkillDefinition[] = [];

  // Build & test skill
  skills.push({
    name: 'build-and-test',
    description: `Build and test ${profile.name}`,
    category: 'core',
    tags: ['build', 'test', 'ci'],
    capabilities: ['Run build', 'Run tests', 'Fix build errors', 'Fix test failures'],
    instructions: [
      `## Build`,
      '',
      '```bash',
      profile.buildCommand || `${profile.packageManager || 'npm'} run build`,
      '```',
      '',
      '## Test',
      '',
      '```bash',
      profile.testCommand || `${profile.packageManager || 'npm'} test`,
      '```',
      '',
      '## Workflow',
      '',
      '1. Run the build first to catch type errors',
      '2. Run tests to verify correctness',
      '3. If either fails, fix the issue and re-run',
      '4. Never commit with failing tests or build errors',
    ].join('\n'),
  });

  // Code review skill
  skills.push({
    name: 'code-review',
    description: 'Review code for quality, security, and correctness',
    category: 'core',
    tags: ['review', 'quality', 'security'],
    capabilities: ['Security scanning', 'Quality analysis', 'Performance review', 'Style checking'],
    instructions: [
      '## Review Checklist',
      '',
      '1. **Correctness**: Does the code do what it claims?',
      '2. **Security**: Any secrets, injection vectors, or unsafe patterns?',
      '3. **Tests**: Are changes covered by tests?',
      '4. **Readability**: Can another developer understand this without context?',
      '5. **Performance**: Any obvious O(n^2) loops or unnecessary allocations?',
      '6. **Style**: Does it follow the project coding standards?',
    ].join('\n'),
  });

  // Guidance control plane skill
  if (profile.guidanceControlPlane) {
    skills.push({
      name: 'guidance-enforcement',
      description: 'Enforce guidance rules through the control plane',
      category: 'security',
      tags: ['guidance', 'enforcement', 'gates', 'policy'],
      requires: ['@claude-flow/guidance'],
      capabilities: [
        'Gate enforcement for commands, edits, and tool calls',
        'Proof chain generation for audit trails',
        'Memory write authorization',
        'Trust score tracking',
      ],
      instructions: [
        '## Guidance Control Plane',
        '',
        'This project uses `@claude-flow/guidance` to enforce CLAUDE.md rules programmatically.',
        '',
        '### Before executing commands:',
        '```typescript',
        "const results = plane.evaluateCommand('rm -rf /tmp/build');",
        "if (results.some(r => r.decision === 'deny')) { /* blocked */ }",
        '```',
        '',
        '### Before editing files:',
        '```typescript',
        "const results = plane.evaluateEdit('config.ts', content, lineCount);",
        '```',
        '',
        '### Track every run:',
        '```typescript',
        "const event = plane.startRun('task-id', 'feature');",
        '// ... work ...',
        'await plane.finalizeRun(event);',
        '```',
      ].join('\n'),
    });
  }

  return skills;
}

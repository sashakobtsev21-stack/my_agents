/**
 * Init Executor
 * Main execution logic for V3 initialization
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import type { InitOptions, InitResult } from './types.js';
import { detectPlatform } from './types.js';
import { generateSettingsJson } from './settings-generator.js';
import { generateMCPJson } from './mcp-generator.js';
import { generateStatuslineScript } from './statusline-generator.js';
import {
  generatePreCommitHook,
  generatePostCommitHook,
  generateSessionManager,
  generateAgentRouter,
  generateMemoryHelper,
  generateHookHandler,
  generateIntelligenceStub,
  generateAutoMemoryHook,
  generateRufloHookCjs,
} from './helpers-generator.js';
import { generateClaudeMd } from './claudemd-generator.js';
// Static config maps moved to ./executor-maps.ts (W77, P3.6 cut #1).
// DIRECTORIES is still used inline by createDirectories; the SKILLS/
// COMMANDS/AGENTS maps moved to the copiers with their consumers.
import { DIRECTORIES } from './executor-maps.js';
// Pure fs/counting utilities moved to ./executor-fs-utils.ts (W78/W79).
// countEnabledHooks (executeInit) + findSourceHelpersDir (writeHelpers)
// remain inline consumers here; the rest moved with the copiers.
import {
  countEnabledHooks,
  findSourceHelpersDir,
} from './executor-fs-utils.js';
// Init upgrade path (executeUpgrade, executeUpgradeWithMissing,
// UpgradeResult, mergeSettingsForUpgrade) moved to ./executor-upgrade.ts
// (W79, P3.6 cut #3). Re-exported so the init command resolves them.
export type { UpgradeResult } from './executor-upgrade.js';
export { executeUpgrade, executeUpgradeWithMissing } from './executor-upgrade.js';
// Asset copiers (copySkills, copyCommands, copyAgents) moved to
// ./executor-copiers.ts (W80, P3.6 cut #4).
import { copySkills, copyCommands, copyAgents } from './executor-copiers.js';

/**
 * Execute initialization
 */
export async function executeInit(options: InitOptions): Promise<InitResult> {
  // Detect platform
  const platform = detectPlatform();

  const result: InitResult = {
    success: true,
    platform,
    created: {
      directories: [],
      files: [],
    },
    skipped: [],
    errors: [],
    summary: {
      skillsCount: 0,
      commandsCount: 0,
      agentsCount: 0,
      hooksEnabled: 0,
    },
  };

  const targetDir = options.targetDir;

  try {
    // Create directory structure
    await createDirectories(targetDir, options, result);

    // Generate and write settings.json
    if (options.components.settings) {
      await writeSettings(targetDir, options, result);
    }

    // Generate and write .mcp.json
    if (options.components.mcp) {
      await writeMCPConfig(targetDir, options, result);
    }

    // Copy skills
    if (options.components.skills) {
      await copySkills(targetDir, options, result);
    }

    // Copy commands
    if (options.components.commands) {
      await copyCommands(targetDir, options, result);
    }

    // Copy agents
    if (options.components.agents) {
      await copyAgents(targetDir, options, result);
    }

    // Generate helpers
    if (options.components.helpers) {
      await writeHelpers(targetDir, options, result);
    }

    // Generate statusline
    if (options.components.statusline) {
      await writeStatusline(targetDir, options, result);
    }

    // Generate runtime config
    if (options.components.runtime) {
      await writeRuntimeConfig(targetDir, options, result);
    }

    // Create initial metrics for statusline (prevents "all zeros" display)
    if (options.components.statusline) {
      await writeInitialMetrics(targetDir, options, result);
    }

    // Generate CLAUDE.md
    if (options.components.claudeMd) {
      await writeClaudeMd(targetDir, options, result);
    }

    // Count enabled hooks
    result.summary.hooksEnabled = countEnabledHooks(options);

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Create directory structure
 */
async function createDirectories(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const dirs = [
    ...DIRECTORIES.claude,
    ...(options.components.runtime ? DIRECTORIES.runtime : []),
  ];

  for (const dir of dirs) {
    const fullPath = path.join(targetDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      result.created.directories.push(dir);
    }
  }
}

/**
 * Write settings.json
 */
async function writeSettings(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  const generated = JSON.parse(generateSettingsJson(options));

  if (fs.existsSync(settingsPath) && !options.force) {
    // Merge hooks/env/permissions into existing settings instead of skipping
    try {
      const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      let merged = false;

      // Merge hooks (the critical missing piece — #1484)
      if (generated.hooks && !existing.hooks) {
        existing.hooks = generated.hooks;
        merged = true;
      }

      // Merge env vars (for CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS etc.)
      if (generated.env) {
        existing.env = { ...(existing.env || {}), ...generated.env };
        merged = true;
      }

      // Merge permissions (add ruflo allow rules)
      if (generated.permissions?.allow) {
        const existingAllow = existing.permissions?.allow || [];
        const newRules = generated.permissions.allow.filter(
          (r: string) => !existingAllow.includes(r)
        );
        if (newRules.length > 0) {
          existing.permissions = existing.permissions || {};
          existing.permissions.allow = [...existingAllow, ...newRules];
          merged = true;
        }
      }

      if (merged) {
        fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
        result.created.files.push('.claude/settings.json (merged hooks)');
      } else {
        result.skipped.push('.claude/settings.json');
      }
    } catch {
      // Existing file is corrupt — overwrite
      fs.writeFileSync(settingsPath, JSON.stringify(generated, null, 2), 'utf-8');
      result.created.files.push('.claude/settings.json');
    }
    return;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(generated, null, 2), 'utf-8');
  result.created.files.push('.claude/settings.json');
}

/**
 * #1779 — Walk parents of `targetDir` plus the user-global Claude Code
 * config locations, looking for any `.mcp.json` (or `~/.claude.json`)
 * that already declares a `ruflo`-keyed MCP server. We use this to skip
 * writing our own `claude-flow`-keyed entry when the user has already
 * registered the same binary under the new name — that's exactly the
 * "same MCP server twice under two different prefixes" duplication the
 * issue describes.
 *
 * Returns the path of the file that already declares `ruflo` (so we can
 * surface it in the skipped-message), or null if none found.
 */
function detectExistingRufloMCP(targetDir: string): string | null {
  const home = (process.env.HOME ?? process.env.USERPROFILE) ?? '';
  const candidates = new Set<string>();
  // User-global Claude Code config locations
  if (home) {
    candidates.add(path.join(home, '.claude.json'));
    candidates.add(path.join(home, '.claude', 'mcp.json'));
  }
  // Walk parents of targetDir up to root, checking for .mcp.json at each
  const targetResolved = path.resolve(targetDir);
  let dir = targetResolved;
  const targetAncestors = new Set<string>();
  while (true) {
    candidates.add(path.join(dir, '.mcp.json'));
    targetAncestors.add(normalizeProjectKey(dir));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Skip the targetDir itself — that's the one we're about to write
  candidates.delete(path.join(targetResolved, '.mcp.json'));

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      if (!parsed || typeof parsed !== 'object') continue;
      // (a) Top-level mcpServers (legacy / global form).
      // #2207: accept BOTH the old 'ruflo' key AND the new 'claude-flow' key so that
      // a prior install with either key is correctly detected as already-initialized.
      // This also avoids the reverse problem: after #2206 fixed the generator to write
      // 'claude-flow', a second `ruflo init` must still recognise the existing install.
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        const servers = parsed.mcpServers as Record<string, unknown>;
        if ('claude-flow' in servers || 'ruflo' in servers) return candidate;
      }
      // (b) #1840: Claude Code project-scoped registrations under
      //     parsed.projects[<projectPath>].mcpServers. Match by
      //     normalized path against targetDir or any of its ancestors so
      //     a `claude mcp add claude-flow` (or legacy `ruflo`) in this repo is
      //     detected even when Claude stored the key with different casing/slash style.
      // #2207: accept both keys here too.
      if (parsed.projects && typeof parsed.projects === 'object') {
        for (const [projectKey, projectVal] of Object.entries(parsed.projects)) {
          if (!projectVal || typeof projectVal !== 'object') continue;
          const projectMcp = (projectVal as { mcpServers?: unknown }).mcpServers;
          if (!projectMcp || typeof projectMcp !== 'object') continue;
          const mcp = projectMcp as Record<string, unknown>;
          if (!('claude-flow' in mcp) && !('ruflo' in mcp)) continue;
          if (targetAncestors.has(normalizeProjectKey(projectKey))) {
            return `${candidate} (projects[${projectKey}])`;
          }
        }
      }
    } catch { /* malformed JSON — ignore */ }
  }
  return null;
}

/**
 * Normalize a project path key for cross-platform comparison.
 * Claude Code stores Windows paths like "C:/Users/.../Project" while
 * Node's `path.resolve()` may emit "C:\Users\...\Project". Lowercase +
 * forward-slash gives a stable comparison key on both platforms.
 */
function normalizeProjectKey(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

/**
 * Write .mcp.json
 */
async function writeMCPConfig(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const mcpPath = path.join(targetDir, '.mcp.json');

  if (fs.existsSync(mcpPath) && !options.force) {
    result.skipped.push('.mcp.json');
    return;
  }

  // #1779 — Skip writing if the user already has a `ruflo`-keyed MCP
  // server registered elsewhere (parent .mcp.json, ~/.claude.json, etc).
  // Writing our `claude-flow`-keyed entry on top of that produces the
  // duplicate-registration the issue describes (~250 duplicate tools).
  // Force-mode (`--force`) bypasses this guard for users who actually
  // want both registrations.
  if (!options.force) {
    const existingRufloPath = detectExistingRufloMCP(targetDir);
    if (existingRufloPath) {
      result.skipped.push(`.mcp.json (existing 'ruflo' MCP registration found at ${existingRufloPath} — would create duplicate; pass --force to write anyway)`);
      return;
    }
  }

  const content = generateMCPJson(options);
  fs.writeFileSync(mcpPath, content, 'utf-8');
  result.created.files.push('.mcp.json');
}

/**
 * Write helper scripts
 */
async function writeHelpers(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const helpersDir = path.join(targetDir, '.claude', 'helpers');

  // Find source helpers directory (works for npm package and local dev)
  const sourceHelpersDir = findSourceHelpersDir(options.sourceBaseDir);

  // On Windows: emit a notice before writing helpers — the settings.json
  // hooks will use node-based commands instead of bash shims (#2132).
  if (process.platform === 'win32') {
    console.log('Detected Windows — adding cross-platform hook overrides to .claude/settings.json (#2132)');
  }

  // Try to copy existing helpers from source first
  if (sourceHelpersDir && fs.existsSync(sourceHelpersDir)) {
    const helperFiles = fs.readdirSync(sourceHelpersDir);
    let copiedCount = 0;

    for (const file of helperFiles) {
      const sourcePath = path.join(sourceHelpersDir, file);
      const destPath = path.join(helpersDir, file);

      // Skip directories and only copy files
      if (!fs.statSync(sourcePath).isFile()) continue;

      if (!fs.existsSync(destPath) || options.force) {
        fs.copyFileSync(sourcePath, destPath);

        // Make shell scripts and mjs files executable
        if (file.endsWith('.sh') || file.endsWith('.mjs')) {
          fs.chmodSync(destPath, '755');
        }

        result.created.files.push(`.claude/helpers/${file}`);
        copiedCount++;
      } else {
        result.skipped.push(`.claude/helpers/${file}`);
      }
    }

    // #2132: Always generate ruflo-hook.cjs regardless of source copy path.
    // The source helpers dir may not contain this file (it lives in
    // plugins/ruflo-core/scripts/, not .claude/helpers/), but it must
    // always be present so Windows users can use the node-based shim.
    const rufloHookDest = path.join(helpersDir, 'ruflo-hook.cjs');
    if (!fs.existsSync(rufloHookDest) || options.force) {
      fs.writeFileSync(rufloHookDest, generateRufloHookCjs(), 'utf-8');
      result.created.files.push('.claude/helpers/ruflo-hook.cjs');
    } else {
      result.skipped.push('.claude/helpers/ruflo-hook.cjs');
    }

    if (copiedCount > 0) {
      return; // Skip generating if we copied from source
    }
  }

  // Fall back to generating helpers if source not available
  const helpers: Record<string, string> = {
    'pre-commit': generatePreCommitHook(),
    'post-commit': generatePostCommitHook(),
    'session.js': generateSessionManager(),
    'router.js': generateAgentRouter(),
    'memory.js': generateMemoryHelper(),
    'hook-handler.cjs': generateHookHandler(),
    'intelligence.cjs': generateIntelligenceStub(),
    'auto-memory-hook.mjs': generateAutoMemoryHook(),
    // #2132: cross-platform Node.js port of ruflo-hook.sh — always deployed so
    // Windows users have a working shim even if the plugin's hooks.json bash
    // commands are overridden via settings.json.
    'ruflo-hook.cjs': generateRufloHookCjs(),
  };

  for (const [name, content] of Object.entries(helpers)) {
    const filePath = path.join(helpersDir, name);

    if (!fs.existsSync(filePath) || options.force) {
      fs.writeFileSync(filePath, content, 'utf-8');

      // Make shell scripts executable
      if (!name.endsWith('.js')) {
        fs.chmodSync(filePath, '755');
      }

      result.created.files.push(`.claude/helpers/${name}`);
    } else {
      result.skipped.push(`.claude/helpers/${name}`);
    }
  }
}

/**
 * Find source .claude directory for statusline files
 */
function findSourceClaudeDir(sourceBaseDir?: string): string | null {
  const possiblePaths: string[] = [];

  // If explicit source base directory is provided, check it first
  if (sourceBaseDir) {
    possiblePaths.push(path.join(sourceBaseDir, '.claude'));
  }

  // IMPORTANT: Check the package's own .claude directory
  // Go up 3 levels: dist/src/init -> dist/src -> dist -> root
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const packageClaude = path.join(packageRoot, '.claude');
  if (fs.existsSync(packageClaude)) {
    possiblePaths.unshift(packageClaude); // Add to beginning (highest priority)
  }

  // From dist/src/init -> go up to project root
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    const parentDir = path.dirname(currentDir);
    const claudePath = path.join(parentDir, '.claude');
    if (fs.existsSync(claudePath)) {
      possiblePaths.push(claudePath);
    }
    currentDir = parentDir;
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Write statusline configuration
 */
async function writeStatusline(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const claudeDir = path.join(targetDir, '.claude');
  const helpersDir = path.join(targetDir, '.claude', 'helpers');

  // Find source .claude directory (works for npm package and local dev)
  const sourceClaudeDir = findSourceClaudeDir(options.sourceBaseDir);

  // Try to copy existing advanced statusline files from source
  const advancedStatuslineFiles = [
    { src: 'statusline.sh', dest: 'statusline.sh', dir: claudeDir },
    { src: 'statusline.mjs', dest: 'statusline.mjs', dir: claudeDir },
  ];

  if (sourceClaudeDir) {
    for (const file of advancedStatuslineFiles) {
      const sourcePath = path.join(sourceClaudeDir, file.src);
      const destPath = path.join(file.dir, file.dest);

      if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(destPath) || options.force) {
          fs.copyFileSync(sourcePath, destPath);
          // Make shell scripts and mjs executable
          if (file.src.endsWith('.sh') || file.src.endsWith('.mjs')) {
            fs.chmodSync(destPath, '755');
          }
          result.created.files.push(`.claude/${file.dest}`);
        } else {
          result.skipped.push(`.claude/${file.dest}`);
        }
      }
    }
  }

  // ALWAYS generate statusline.cjs — the generated version includes AgentDB
  // vectors/size, tests, ADRs, hooks, and integration stats that the
  // pre-installed static copy in the npm package lacks.
  // This must overwrite any copy from writeHelpers() which copies the legacy file.
  const statuslineScript = generateStatuslineScript(options);
  const statuslinePath = path.join(helpersDir, 'statusline.cjs');

  fs.writeFileSync(statuslinePath, statuslineScript, 'utf-8');
  result.created.files.push('.claude/helpers/statusline.cjs');
}

/**
 * Write runtime configuration (.claude-flow/)
 */
async function writeRuntimeConfig(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const configPath = path.join(targetDir, '.claude-flow', 'config.yaml');

  if (fs.existsSync(configPath) && !options.force) {
    result.skipped.push('.claude-flow/config.yaml');
    return;
  }

  const config = `# AlexKo V3 Runtime Configuration
# Generated: ${new Date().toISOString()}

version: "3.0.0"

swarm:
  topology: ${options.runtime.topology}
  maxAgents: ${options.runtime.maxAgents}
  autoScale: true
  coordinationStrategy: consensus

memory:
  backend: ${options.runtime.memoryBackend}
  enableHNSW: ${options.runtime.enableHNSW}
  persistPath: .claude-flow/data
  cacheSize: 100
  # ADR-049: Self-Learning Memory
  learningBridge:
    enabled: ${options.runtime.enableLearningBridge ?? options.runtime.enableNeural}
    sonaMode: balanced
    confidenceDecayRate: 0.005
    accessBoostAmount: 0.03
    consolidationThreshold: 10
  memoryGraph:
    enabled: ${options.runtime.enableMemoryGraph ?? true}
    pageRankDamping: 0.85
    maxNodes: 5000
    similarityThreshold: 0.8
  agentScopes:
    enabled: ${options.runtime.enableAgentScopes ?? true}
    defaultScope: project

neural:
  enabled: ${options.runtime.enableNeural}
  modelPath: .claude-flow/neural

hooks:
  enabled: true
  autoExecute: true

mcp:
  autoStart: ${options.mcp.autoStart}
  port: ${options.mcp.port}
`;

  fs.writeFileSync(configPath, config, 'utf-8');
  result.created.files.push('.claude-flow/config.yaml');

  // Write .gitignore
  const gitignorePath = path.join(targetDir, '.claude-flow', '.gitignore');
  const gitignore = `# Claude Flow runtime files
data/
logs/
sessions/
neural/
*.log
*.tmp
`;

  if (!fs.existsSync(gitignorePath) || options.force) {
    fs.writeFileSync(gitignorePath, gitignore, 'utf-8');
    result.created.files.push('.claude-flow/.gitignore');
  }

  // Write CAPABILITIES.md with full system overview
  await writeCapabilitiesDoc(targetDir, options, result);
}

/**
 * Write initial metrics files for statusline
 * Creates baseline data so statusline shows meaningful state instead of all zeros
 */
async function writeInitialMetrics(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const metricsDir = path.join(targetDir, '.claude-flow', 'metrics');
  const learningDir = path.join(targetDir, '.claude-flow', 'learning');
  const securityDir = path.join(targetDir, '.claude-flow', 'security');

  // Ensure directories exist
  for (const dir of [metricsDir, learningDir, securityDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create initial v3-progress.json
  const progressPath = path.join(metricsDir, 'v3-progress.json');
  if (!fs.existsSync(progressPath) || options.force) {
    const progress = {
      version: '3.0.0',
      initialized: new Date().toISOString(),
      domains: {
        completed: 0,
        total: 5,
        status: 'INITIALIZING'
      },
      ddd: {
        progress: 0,
        modules: 0,
        totalFiles: 0,
        totalLines: 0
      },
      swarm: {
        activeAgents: 0,
        maxAgents: options.runtime.maxAgents,
        topology: options.runtime.topology
      },
      learning: {
        status: 'READY',
        patternsLearned: 0,
        sessionsCompleted: 0
      },
      _note: 'Metrics will update as you use Ruflo. Run: npx ruflo@latest daemon start'
    };
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
    result.created.files.push('.claude-flow/metrics/v3-progress.json');
  }

  // Create initial swarm-activity.json
  const activityPath = path.join(metricsDir, 'swarm-activity.json');
  if (!fs.existsSync(activityPath) || options.force) {
    const activity = {
      timestamp: new Date().toISOString(),
      processes: {
        agentic_flow: 0,
        mcp_server: 0,
        estimated_agents: 0
      },
      swarm: {
        active: false,
        agent_count: 0,
        coordination_active: false
      },
      integration: {
        agentic_flow_active: false,
        mcp_active: false
      },
      _initialized: true
    };
    fs.writeFileSync(activityPath, JSON.stringify(activity, null, 2), 'utf-8');
    result.created.files.push('.claude-flow/metrics/swarm-activity.json');
  }

  // Create initial learning.json
  const learningPath = path.join(metricsDir, 'learning.json');
  if (!fs.existsSync(learningPath) || options.force) {
    const learning = {
      initialized: new Date().toISOString(),
      routing: {
        accuracy: 0,
        decisions: 0
      },
      patterns: {
        shortTerm: 0,
        longTerm: 0,
        quality: 0
      },
      sessions: {
        total: 0,
        current: null
      },
      _note: 'Intelligence grows as you use Ruflo'
    };
    fs.writeFileSync(learningPath, JSON.stringify(learning, null, 2), 'utf-8');
    result.created.files.push('.claude-flow/metrics/learning.json');
  }

  // Create initial audit-status.json
  const auditPath = path.join(securityDir, 'audit-status.json');
  if (!fs.existsSync(auditPath) || options.force) {
    const audit = {
      initialized: new Date().toISOString(),
      status: 'PENDING',
      cvesFixed: 0,
      totalCves: 3,
      lastScan: null,
      _note: 'Run: npx @claude-flow/cli@latest security scan'
    };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf-8');
    result.created.files.push('.claude-flow/security/audit-status.json');
  }
}

/**
 * Write CAPABILITIES.md - comprehensive overview of all Ruflo features
 */
async function writeCapabilitiesDoc(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const capabilitiesPath = path.join(targetDir, '.claude-flow', 'CAPABILITIES.md');

  if (fs.existsSync(capabilitiesPath) && !options.force) {
    result.skipped.push('.claude-flow/CAPABILITIES.md');
    return;
  }

  const capabilities = `# AlexKo V3 - Complete Capabilities Reference
> Generated: ${new Date().toISOString()}
> Full documentation: https://github.com/ruvnet/claude-flow

## 📋 Table of Contents

1. [Overview](#overview)
2. [Swarm Orchestration](#swarm-orchestration)
3. [Available Agents (60+)](#available-agents)
4. [CLI Commands (26 Commands, 140+ Subcommands)](#cli-commands)
5. [Hooks System (27 Hooks + 12 Workers)](#hooks-system)
6. [Memory & Intelligence (RuVector)](#memory--intelligence)
7. [Hive-Mind Consensus](#hive-mind-consensus)
8. [Performance Targets](#performance-targets)
9. [Integration Ecosystem](#integration-ecosystem)

---

## Overview

AlexKo V3 is a domain-driven design architecture for multi-agent AI coordination with:

- **15-Agent Swarm Coordination** with hierarchical and mesh topologies
- **HNSW Vector Search** - ~1.9x–4.7x faster pattern retrieval (measured, vs brute force above crossover)
- **SONA Neural Learning** - Self-optimizing with <0.05ms adaptation
- **Byzantine Fault Tolerance** - Queen-led consensus mechanisms
- **MCP Server Integration** - Model Context Protocol support

### Current Configuration
| Setting | Value |
|---------|-------|
| Topology | ${options.runtime.topology} |
| Max Agents | ${options.runtime.maxAgents} |
| Memory Backend | ${options.runtime.memoryBackend} |
| HNSW Indexing | ${options.runtime.enableHNSW ? 'Enabled' : 'Disabled'} |
| Neural Learning | ${options.runtime.enableNeural ? 'Enabled' : 'Disabled'} |
| LearningBridge | ${options.runtime.enableLearningBridge ? 'Enabled (SONA + ReasoningBank)' : 'Disabled'} |
| Knowledge Graph | ${options.runtime.enableMemoryGraph ? 'Enabled (PageRank + Communities)' : 'Disabled'} |
| Agent Scopes | ${options.runtime.enableAgentScopes ? 'Enabled (project/local/user)' : 'Disabled'} |

---

## Swarm Orchestration

### Topologies
| Topology | Description | Best For |
|----------|-------------|----------|
| \`hierarchical\` | Queen controls workers directly | Anti-drift, tight control |
| \`mesh\` | Fully connected peer network | Distributed tasks |
| \`hierarchical-mesh\` | V3 hybrid (recommended) | 10+ agents |
| \`ring\` | Circular communication | Sequential workflows |
| \`star\` | Central coordinator | Simple coordination |
| \`adaptive\` | Dynamic based on load | Variable workloads |

### Strategies
- \`balanced\` - Even distribution across agents
- \`specialized\` - Clear roles, no overlap (anti-drift)
- \`adaptive\` - Dynamic task routing

### Quick Commands
\`\`\`bash
# Initialize swarm
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized

# Check status
npx @claude-flow/cli@latest swarm status

# Monitor activity
npx @claude-flow/cli@latest swarm monitor
\`\`\`

---

## Available Agents

### Core Development (5)
\`coder\`, \`reviewer\`, \`tester\`, \`planner\`, \`researcher\`

### V3 Specialized (4)
\`security-architect\`, \`security-auditor\`, \`memory-specialist\`, \`performance-engineer\`

### Swarm Coordination (5)
\`hierarchical-coordinator\`, \`mesh-coordinator\`, \`adaptive-coordinator\`, \`collective-intelligence-coordinator\`, \`swarm-memory-manager\`

### Consensus & Distributed (7)
\`byzantine-coordinator\`, \`raft-manager\`, \`gossip-coordinator\`, \`consensus-builder\`, \`crdt-synchronizer\`, \`quorum-manager\`, \`security-manager\`

### Performance & Optimization (5)
\`perf-analyzer\`, \`performance-benchmarker\`, \`task-orchestrator\`, \`memory-coordinator\`, \`smart-agent\`

### GitHub & Repository (9)
\`github-modes\`, \`pr-manager\`, \`code-review-swarm\`, \`issue-tracker\`, \`release-manager\`, \`workflow-automation\`, \`project-board-sync\`, \`repo-architect\`, \`multi-repo-swarm\`

### SPARC Methodology (6)
\`sparc-coord\`, \`sparc-coder\`, \`specification\`, \`pseudocode\`, \`architecture\`, \`refinement\`

### Specialized Development (8)
\`backend-dev\`, \`mobile-dev\`, \`ml-developer\`, \`cicd-engineer\`, \`api-docs\`, \`system-architect\`, \`code-analyzer\`, \`base-template-generator\`

### Testing & Validation (2)
\`tdd-london-swarm\`, \`production-validator\`

### Agent Routing by Task
| Task Type | Recommended Agents | Topology |
|-----------|-------------------|----------|
| Bug Fix | researcher, coder, tester | mesh |
| New Feature | coordinator, architect, coder, tester, reviewer | hierarchical |
| Refactoring | architect, coder, reviewer | mesh |
| Performance | researcher, perf-engineer, coder | hierarchical |
| Security | security-architect, auditor, reviewer | hierarchical |
| Docs | researcher, api-docs | mesh |

---

## CLI Commands

### Core Commands (12)
| Command | Subcommands | Description |
|---------|-------------|-------------|
| \`init\` | 4 | Project initialization |
| \`agent\` | 8 | Agent lifecycle management |
| \`swarm\` | 6 | Multi-agent coordination |
| \`memory\` | 11 | AgentDB with HNSW search |
| \`mcp\` | 9 | MCP server management |
| \`task\` | 6 | Task assignment |
| \`session\` | 7 | Session persistence |
| \`config\` | 7 | Configuration |
| \`status\` | 3 | System monitoring |
| \`workflow\` | 6 | Workflow templates |
| \`hooks\` | 17 | Self-learning hooks |
| \`hive-mind\` | 6 | Consensus coordination |

### Advanced Commands (14)
| Command | Subcommands | Description |
|---------|-------------|-------------|
| \`daemon\` | 5 | Background workers |
| \`neural\` | 5 | Pattern training |
| \`security\` | 6 | Security scanning |
| \`performance\` | 5 | Profiling & benchmarks |
| \`providers\` | 5 | AI provider config |
| \`plugins\` | 5 | Plugin management |
| \`deployment\` | 5 | Deploy management |
| \`embeddings\` | 4 | Vector embeddings |
| \`claims\` | 4 | Authorization |
| \`migrate\` | 5 | V2→V3 migration |
| \`process\` | 4 | Process management |
| \`doctor\` | 1 | Health diagnostics |
| \`completions\` | 4 | Shell completions |

### Example Commands
\`\`\`bash
# Initialize
npx @claude-flow/cli@latest init --wizard

# Spawn agent
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder

# Memory operations
npx @claude-flow/cli@latest memory store --key "pattern" --value "data" --namespace patterns
npx @claude-flow/cli@latest memory search --query "authentication"

# Diagnostics
npx @claude-flow/cli@latest doctor --fix
\`\`\`

---

## Hooks System

### 27 Available Hooks

#### Core Hooks (6)
| Hook | Description |
|------|-------------|
| \`pre-edit\` | Context before file edits |
| \`post-edit\` | Record edit outcomes |
| \`pre-command\` | Risk assessment |
| \`post-command\` | Command metrics |
| \`pre-task\` | Task start + agent suggestions |
| \`post-task\` | Task completion learning |

#### Session Hooks (4)
| Hook | Description |
|------|-------------|
| \`session-start\` | Start/restore session |
| \`session-end\` | Persist state |
| \`session-restore\` | Restore previous |
| \`notify\` | Cross-agent notifications |

#### Intelligence Hooks (5)
| Hook | Description |
|------|-------------|
| \`route\` | Optimal agent routing |
| \`explain\` | Routing decisions |
| \`pretrain\` | Bootstrap intelligence |
| \`build-agents\` | Generate configs |
| \`transfer\` | Pattern transfer |

#### Coverage Hooks (3)
| Hook | Description |
|------|-------------|
| \`coverage-route\` | Coverage-based routing |
| \`coverage-suggest\` | Improvement suggestions |
| \`coverage-gaps\` | Gap analysis |

### 12 Background Workers
| Worker | Priority | Purpose |
|--------|----------|---------|
| \`ultralearn\` | normal | Deep knowledge |
| \`optimize\` | high | Performance |
| \`consolidate\` | low | Memory consolidation |
| \`predict\` | normal | Predictive preload |
| \`audit\` | critical | Security |
| \`map\` | normal | Codebase mapping |
| \`preload\` | low | Resource preload |
| \`deepdive\` | normal | Deep analysis |
| \`document\` | normal | Auto-docs |
| \`refactor\` | normal | Suggestions |
| \`benchmark\` | normal | Benchmarking |
| \`testgaps\` | normal | Coverage gaps |

---

## Memory & Intelligence

### RuVector Intelligence System
- **SONA**: Self-Optimizing Neural Architecture (<0.05ms)
- **MoE**: Mixture of Experts routing
- **HNSW**: ~1.9x–4.7x faster search (measured)
- **EWC++**: Prevents catastrophic forgetting
- **Flash Attention**: experimental (unverified)
- **Int8 Quantization**: 3.92x memory reduction

### 4-Step Intelligence Pipeline
1. **RETRIEVE** - HNSW pattern search
2. **JUDGE** - Success/failure verdicts
3. **DISTILL** - LoRA learning extraction
4. **CONSOLIDATE** - EWC++ preservation

### Self-Learning Memory (ADR-049)

| Component | Status | Description |
|-----------|--------|-------------|
| **LearningBridge** | ${options.runtime.enableLearningBridge ? '✅ Enabled' : '⏸ Disabled'} | Connects insights to SONA/ReasoningBank neural pipeline |
| **MemoryGraph** | ${options.runtime.enableMemoryGraph ? '✅ Enabled' : '⏸ Disabled'} | PageRank knowledge graph + community detection |
| **AgentMemoryScope** | ${options.runtime.enableAgentScopes ? '✅ Enabled' : '⏸ Disabled'} | 3-scope agent memory (project/local/user) |

**LearningBridge** - Insights trigger learning trajectories. Confidence evolves: +0.03 on access, -0.005/hour decay. Consolidation runs the JUDGE/DISTILL/CONSOLIDATE pipeline.

**MemoryGraph** - Builds a knowledge graph from entry references. PageRank identifies influential insights. Communities group related knowledge. Graph-aware ranking blends vector + structural scores.

**AgentMemoryScope** - Maps Claude Code 3-scope directories:
- \`project\`: \`<gitRoot>/.claude/agent-memory/<agent>/\`
- \`local\`: \`<gitRoot>/.claude/agent-memory-local/<agent>/\`
- \`user\`: \`~/.claude/agent-memory/<agent>/\`

High-confidence insights (>0.8) can transfer between agents.

### Memory Commands
\`\`\`bash
# Store pattern
npx @claude-flow/cli@latest memory store --key "name" --value "data" --namespace patterns

# Semantic search
npx @claude-flow/cli@latest memory search --query "authentication"

# List entries
npx @claude-flow/cli@latest memory list --namespace patterns

# Initialize database
npx @claude-flow/cli@latest memory init --force
\`\`\`

---

## Hive-Mind Consensus

### Queen Types
| Type | Role |
|------|------|
| Strategic Queen | Long-term planning |
| Tactical Queen | Execution coordination |
| Adaptive Queen | Dynamic optimization |

### Worker Types (8)
\`researcher\`, \`coder\`, \`analyst\`, \`tester\`, \`architect\`, \`reviewer\`, \`optimizer\`, \`documenter\`

### Consensus Mechanisms
| Mechanism | Fault Tolerance | Use Case |
|-----------|-----------------|----------|
| \`byzantine\` | f < n/3 faulty | Adversarial |
| \`raft\` | f < n/2 failed | Leader-based |
| \`gossip\` | Eventually consistent | Large scale |
| \`crdt\` | Conflict-free | Distributed |
| \`quorum\` | Configurable | Flexible |

### Hive-Mind Commands
\`\`\`bash
# Initialize
npx @claude-flow/cli@latest hive-mind init --queen-type strategic

# Status
npx @claude-flow/cli@latest hive-mind status

# Spawn workers
npx @claude-flow/cli@latest hive-mind spawn --count 5 --type worker

# Consensus
npx @claude-flow/cli@latest hive-mind consensus --propose "task"
\`\`\`

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| HNSW Search | ~1.9x–4.7x faster (measured) | ✅ Implemented |
| Memory Reduction | 50-75% | ✅ Implemented (3.92x) |
| SONA Integration | Pattern learning | ✅ Implemented |
| Flash Attention | experimental (unverified) | 🔄 In Progress |
| MCP Response | <100ms | ✅ Achieved |
| CLI Startup | <500ms | ✅ Achieved |
| SONA Adaptation | <0.05ms | 🔄 In Progress |
| Graph Build (1k) | <200ms | ✅ 2.78ms (71.9x headroom) |
| PageRank (1k) | <100ms | ✅ 12.21ms (8.2x headroom) |
| Insight Recording | <5ms/each | ✅ 0.12ms (41x headroom) |
| Consolidation | <500ms | ✅ 0.26ms (1,955x headroom) |
| Knowledge Transfer | <100ms | ✅ 1.25ms (80x headroom) |

---

## Integration Ecosystem

### Integrated Packages
| Package | Version | Purpose |
|---------|---------|---------|
| agentic-flow | 3.0.0-alpha.1 | Core coordination + ReasoningBank + Router |
| agentdb | 3.0.0-alpha.10 | Vector database + 8 controllers |
| @ruvector/attention | 0.1.3 | Flash attention |
| @ruvector/sona | 0.1.5 | Neural learning |

### Optional Integrations
| Package | Command |
|---------|---------|
| ruv-swarm | \`npx ruv-swarm mcp start\` |
| flow-nexus | \`npx flow-nexus@latest mcp start\` |
| agentic-jujutsu | \`npx agentic-jujutsu@latest\` |

### MCP Server Setup
\`\`\`bash
# Add Ruflo MCP
claude mcp add ruflo -- npx -y ruflo@latest

# Optional servers
claude mcp add ruv-swarm -- npx -y ruv-swarm mcp start
claude mcp add flow-nexus -- npx -y flow-nexus@latest mcp start
\`\`\`

---

## Quick Reference

### Essential Commands
\`\`\`bash
# Setup
npx ruflo@latest init --wizard
npx ruflo@latest daemon start
npx ruflo@latest doctor --fix

# Swarm
npx ruflo@latest swarm init --topology hierarchical --max-agents 8
npx ruflo@latest swarm status

# Agents
npx ruflo@latest agent spawn -t coder
npx ruflo@latest agent list

# Memory
npx ruflo@latest memory search --query "patterns"

# Hooks
npx ruflo@latest hooks pre-task --description "task"
npx ruflo@latest hooks worker dispatch --trigger optimize
\`\`\`

### File Structure
\`\`\`
.claude-flow/
├── config.yaml      # Runtime configuration
├── CAPABILITIES.md  # This file
├── data/            # Memory storage
├── logs/            # Operation logs
├── sessions/        # Session state
├── hooks/           # Custom hooks
├── agents/          # Agent configs
└── workflows/       # Workflow templates
\`\`\`

---

**Full Documentation**: https://github.com/ruvnet/claude-flow
**Issues**: https://github.com/ruvnet/claude-flow/issues
`;

  fs.writeFileSync(capabilitiesPath, capabilities, 'utf-8');
  result.created.files.push('.claude-flow/CAPABILITIES.md');
}

/**
 * Write CLAUDE.md with swarm guidance
 */
async function writeClaudeMd(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

  if (fs.existsSync(claudeMdPath) && !options.force) {
    result.skipped.push('CLAUDE.md');
  } else {
    // #2208: if overwriting an existing CLAUDE.md (force mode), back it up first so
    // users don't silently lose curated project context.
    if (fs.existsSync(claudeMdPath)) {
      const backupBase = `${claudeMdPath}.pre-ruflo`;
      // Don't clobber an existing backup — append a timestamp if one already exists.
      const backupPath = fs.existsSync(backupBase)
        ? `${backupBase}.${Date.now()}`
        : backupBase;
      fs.copyFileSync(claudeMdPath, backupPath);
      result.created.files.push(path.basename(backupPath));
      console.warn(`[ruflo init] Existing CLAUDE.md backed up to ${path.basename(backupPath)} before overwrite`);
    }
    // Determine template: explicit option > infer from components > 'standard'
    const inferredTemplate = (!options.components.commands && !options.components.agents) ? 'minimal' : undefined;
    const content = generateClaudeMd(options, inferredTemplate);

    fs.writeFileSync(claudeMdPath, content, 'utf-8');
    result.created.files.push('CLAUDE.md');
  }

  // Also write/append global ~/.claude/CLAUDE.md so ruflo tools are used automatically (#1497).
  // Opt-out via --no-global / options.skipGlobalClaudeMd (#1744 — keeps global rules file pristine
  // for users who don't want a per-machine pointer block).
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir && !options.skipGlobalClaudeMd) {
    const globalClaudeDir = path.join(homeDir, '.claude');
    const globalClaudeMd = path.join(globalClaudeDir, 'CLAUDE.md');
    const rufloBlock = [
      '',
      '# Ruflo Integration (auto-generated by ruflo init)',
      'When working on multi-file tasks or complex features, use ToolSearch to find and invoke ruflo MCP tools.',
      'Key tools: memory_store, memory_search, hooks_route, swarm_init, agent_spawn.',
      'Check system-reminder tags for [INTELLIGENCE] pattern suggestions before starting work.',
      '',
    ].join('\n');

    try {
      if (!fs.existsSync(globalClaudeDir)) {
        fs.mkdirSync(globalClaudeDir, { recursive: true });
      }
      if (fs.existsSync(globalClaudeMd)) {
        const existing = fs.readFileSync(globalClaudeMd, 'utf-8');
        if (!existing.includes('Ruflo Integration')) {
          fs.appendFileSync(globalClaudeMd, rufloBlock);
          result.created.files.push('~/.claude/CLAUDE.md (appended ruflo block)');
        }
      } else {
        fs.writeFileSync(globalClaudeMd, rufloBlock.trimStart(), 'utf-8');
        result.created.files.push('~/.claude/CLAUDE.md');
      }
    } catch {
      // Non-critical — global CLAUDE.md is best-effort
    }
  } else if (options.skipGlobalClaudeMd) {
    result.skipped.push('~/.claude/CLAUDE.md (--no-global)');
  }
}


export default executeInit;

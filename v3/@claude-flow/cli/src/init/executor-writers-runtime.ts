/**
 * Init runtime-asset writers — the .claude/helpers scripts, the
 * statusline, the .claude-flow runtime config, and the seed metrics.
 *
 *   - writeHelpers        (copy bundled helpers or generate them; always
 *                         emits ruflo-hook.cjs for the #2132 Windows shim)
 *   - writeStatusline     (statusline.cjs)
 *   - writeRuntimeConfig  (.claude-flow runtime config + data dirs; also
 *                         triggers the CAPABILITIES.md doc write)
 *   - writeInitialMetrics (seed metrics so the statusline isn't all-zeros)
 *   - findSourceClaudeDir (internal: locate the bundled .claude source)
 *
 * Extracted from executor.ts (W83, P3.6 cut #7 — final). __dirname is
 * recomputed via fileURLToPath; same init/ directory as executor.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { InitOptions, InitResult } from './types.js';
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
import { findSourceHelpersDir } from './executor-fs-utils.js';
import { writeCapabilitiesDoc } from './executor-writers-docs.js';

// ESM-compatible __dirname (same init/ directory as executor.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Write helper scripts
 */
export async function writeHelpers(
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
export async function writeStatusline(
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
export async function writeRuntimeConfig(
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
export async function writeInitialMetrics(
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

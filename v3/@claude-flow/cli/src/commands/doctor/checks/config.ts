/**
 * Config / daemon / memory-database / api-keys health checks.
 *
 * Pilot extraction (issue #7). Sibling of checks/node.ts and checks/git.ts.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { HealthCheck } from '../utils.js';

export async function checkConfigFile(): Promise<HealthCheck> {
  // JSON configs (parse-validated). The first three are LEGACY shapes from
  // pre-v3 init flows; v3 init writes only `.claude-flow/config.yaml`.
  const jsonPaths = [
    '.claude-flow/config.json',
    'claude-flow.config.json',
    '.claude-flow.json'
  ];
  // YAML configs (existence-checked only — no heavy yaml parser dependency).
  const yamlPaths = [
    '.claude-flow/config.yaml',
    '.claude-flow/config.yml',
    'claude-flow.config.yaml'
  ];

  // #1798 — collect ALL configs that exist instead of returning at the first
  // hit. The previous early-return masked silent collisions: if both a v2
  // JSON and a v3 YAML existed, doctor reported only the JSON while the
  // daemon was actually reading from the YAML. Surfacing both lets the user
  // see and resolve the disagreement.
  const foundJson: string[] = [];
  const invalidJson: string[] = [];
  for (const configPath of jsonPaths) {
    if (!existsSync(configPath)) continue;
    try {
      JSON.parse(readFileSync(configPath, 'utf8'));
      foundJson.push(configPath);
    } catch {
      invalidJson.push(configPath);
    }
  }
  const foundYaml = yamlPaths.filter(p => existsSync(p));

  // Hard failures first: malformed JSON wins.
  if (invalidJson.length > 0) {
    return { name: 'Config File', status: 'fail', message: `Invalid JSON: ${invalidJson.join(', ')}`, fix: 'Fix JSON syntax in config file' };
  }

  // #1798 — collision: legacy JSON + new YAML both present. Subsystems can
  // disagree on which to read; surface this as a warn with the recommended
  // resolution (keep the YAML, archive the JSON).
  if (foundJson.length > 0 && foundYaml.length > 0) {
    return {
      name: 'Config File',
      status: 'warn',
      message: `Config collision: legacy ${foundJson.join(', ')} + ${foundYaml.join(', ')} — subsystems may disagree silently`,
      fix: `Archive the legacy JSON (mv ${foundJson[0]} ${foundJson[0]}.bak) and keep ${foundYaml[0]} as the canonical config`,
    };
  }

  if (foundYaml.length > 0) {
    return { name: 'Config File', status: 'pass', message: `Found: ${foundYaml[0]}` };
  }
  if (foundJson.length > 0) {
    return { name: 'Config File', status: 'pass', message: `Found: ${foundJson[0]}` };
  }

  return { name: 'Config File', status: 'warn', message: 'No config file (using defaults)', fix: 'claude-flow config init' };
}

// Check daemon status
export async function checkDaemonStatus(): Promise<HealthCheck> {
  try {
    const pidFile = '.claude-flow/daemon.pid';
    if (existsSync(pidFile)) {
      const pid = readFileSync(pidFile, 'utf8').trim();
      try {
        process.kill(parseInt(pid, 10), 0); // Check if process exists
        return { name: 'Daemon Status', status: 'pass', message: `Running (PID: ${pid})` };
      } catch {
        return { name: 'Daemon Status', status: 'warn', message: 'Stale PID file', fix: 'rm .claude-flow/daemon.pid && claude-flow daemon start' };
      }
    }
    return { name: 'Daemon Status', status: 'warn', message: 'Not running', fix: 'claude-flow daemon start' };
  } catch {
    return { name: 'Daemon Status', status: 'warn', message: 'Unable to check', fix: 'claude-flow daemon status' };
  }
}

// Check memory database
export async function checkMemoryDatabase(): Promise<HealthCheck> {
  // Authoritative path comes from `getMemoryRoot()` (honors
  // `CLAUDE_FLOW_MEMORY_PATH`, claude-flow.config.json's `memory.persistPath`,
  // then defaults to `.swarm/`). #1946: the previous hard-coded list missed
  // `data/memory/memory.db` (a common config) and ignored the env var
  // entirely, so doctor reported "Not initialized" on perfectly-init'd DBs.
  // Try the configured path first, then fall back to the historic candidates.
  const candidates: string[] = [];
  try {
    const { getMemoryRoot } = await import('../../../memory/memory-initializer.js');
    candidates.push(join(getMemoryRoot(), 'memory.db'));
  } catch {
    /* memory-initializer not available — fall through to legacy candidates */
  }
  candidates.push(
    '.swarm/memory.db',
    '.claude-flow/memory.db',
    'data/memory/memory.db', // matches `CLAUDE_FLOW_MEMORY_PATH=data/memory`
    'data/memory.db',
  );

  for (const dbPath of candidates) {
    if (existsSync(dbPath)) {
      try {
        const stats = statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        return { name: 'Memory Database', status: 'pass', message: `${dbPath} (${sizeMB} MB)` };
      } catch {
        return { name: 'Memory Database', status: 'warn', message: `${dbPath} (unable to stat)` };
      }
    }
  }

  return { name: 'Memory Database', status: 'warn', message: 'Not initialized', fix: 'claude-flow memory configure --backend hybrid' };
}

// Check API keys
export async function checkApiKeys(): Promise<HealthCheck> {
  const keys = ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY'];
  const found: string[] = [];

  for (const key of keys) {
    if (process.env[key]) {
      found.push(key);
    }
  }

  // Detect Claude Code environment — API keys are managed internally
  const inClaudeCode = !!(process.env.CLAUDE_CODE || process.env.CLAUDE_PROJECT_DIR || process.env.MCP_SESSION_ID);

  if (found.includes('ANTHROPIC_API_KEY') || found.includes('CLAUDE_API_KEY')) {
    return { name: 'API Keys', status: 'pass', message: `Found: ${found.join(', ')}` };
  } else if (inClaudeCode) {
    return { name: 'API Keys', status: 'pass', message: 'Claude Code (managed internally)' };
  } else if (found.length > 0) {
    return { name: 'API Keys', status: 'warn', message: `Found: ${found.join(', ')} (no Claude key)`, fix: 'export ANTHROPIC_API_KEY=your_key' };
  } else {
    return { name: 'API Keys', status: 'warn', message: 'No API keys found', fix: 'export ANTHROPIC_API_KEY=your_key' };
  }
}

// checkGit + checkGitRepo moved to ./doctor/checks/git.ts (issue #7).

// Check AIDefence package availability (#1807)
//
// `aidefence_*` MCP tools (scan, analyze, has_pii, stats, learn) require
// `@claude-flow/aidefence` to be installed and loadable. The package is an
// optional dependency — present in some installs (project-local) but
// missing in others (npm-global of `claude-flow`). Without it, every
// aidefence MCP call fails at runtime with "Cannot find module".
//
// Surface that state in `doctor` so operators know BEFORE they rely on
// AI-defence scanning. The probe is the same dynamic `import()` the MCP
// tool's handler uses, so a `pass` here means the actual tools will work.

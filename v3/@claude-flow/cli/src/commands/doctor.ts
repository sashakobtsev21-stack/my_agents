/**
 * V3 CLI Doctor Command
 * System diagnostics, dependency checks, config validation
 *
 * Created with ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { decodeKey, isEncryptionEnabled } from '../encryption/vault.js';
import { isEncryptedBlob } from '../encryption/vault.js';
// Shared utilities + pilot extractions live under ./doctor/ (issue #7).
import { runCommand, type HealthCheck } from './doctor/utils.js';
import { checkNodeVersion, checkNpmVersion } from './doctor/checks/node.js';
import { checkGit, checkGitRepo } from './doctor/checks/git.js';
import { checkConfigFile, checkDaemonStatus, checkMemoryDatabase, checkApiKeys } from './doctor/checks/config.js';
import { checkDiskSpace, checkBuildTools, checkVersionFreshness } from './doctor/checks/build.js';
import { checkClaudeCode, checkAgenticFlow, installClaudeCode } from './doctor/checks/cli-tools.js';

// Check AIDefence package availability (#1807)
async function checkAIDefence(): Promise<HealthCheck> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await import('@claude-flow/aidefence');
    return {
      name: 'AIDefence',
      status: 'pass',
      message: '@claude-flow/aidefence loadable — aidefence_* MCP tools functional',
    };
  } catch {
    return {
      name: 'AIDefence',
      status: 'warn',
      message: '@claude-flow/aidefence not loadable — aidefence_* MCP tools will fail (optional package)',
      fix: 'npm install --save @claude-flow/aidefence  (in your project), or run `claude-flow mcp start` from a directory that has it installed',
    };
  }
}

/**
 * ADR-097 Phase 4: federation peer-state surface for doctor.
 *
 * Probes the federation plugin loadability + asserts the breaker entity
 * layer is present in the installed version. Without the plugin
 * installed this is a "not configured" pass — federation is opt-in.
 *
 * Live coordinator state (per-peer counts) requires a running MCP server
 * with `federation_init` called; operators inspect that via the
 * `federation_breaker_status` MCP tool, not the doctor (which is a
 * one-shot CLI process with no coordinator session).
 */
async function checkFederationBreaker(): Promise<HealthCheck> {
  try {
    // Optional plugin — not a hard dep of @claude-flow/cli. Build the
    // module specifier dynamically so TypeScript cannot statically
    // resolve it (which would emit TS2307); at runtime the import
    // either resolves (plugin installed) or throws (handled below).
    const specifier = ['@claude-flow', 'plugin-agent-federation'].join('/');
    const mod: { FederationNodeState?: unknown } = await import(specifier);
    if (!mod.FederationNodeState) {
      return {
        name: 'Federation Breaker',
        status: 'warn',
        message:
          '@claude-flow/plugin-agent-federation loaded but FederationNodeState export missing — version older than ADR-097 Phase 2',
        fix: 'Upgrade: npm install @claude-flow/plugin-agent-federation@alpha',
      };
    }
    return {
      name: 'Federation Breaker',
      status: 'pass',
      message:
        'ADR-097 breaker loadable — federation_breaker_status / federation_evict / federation_reactivate MCP tools available',
    };
  } catch {
    return {
      name: 'Federation Breaker',
      status: 'pass',
      message:
        'Federation plugin not installed (optional) — install only if you need cross-installation peering',
      fix: 'npm install --save @claude-flow/plugin-agent-federation@alpha',
    };
  }
}

// Check MCP servers
async function checkMcpServers(): Promise<HealthCheck> {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  // #1842: ~/.claude.json holds project-scoped registrations under
  // parsed.projects[<projectPath>].mcpServers.ruflo, in addition to any
  // top-level mcpServers. Check both shapes plus the legacy desktop and
  // local .mcp.json paths.
  const mcpConfigPaths = [
    join(home, '.claude.json'),
    join(home, '.claude/claude_desktop_config.json'),
    join(home, '.config/claude/mcp.json'),
    '.mcp.json',
  ];

  const isRufloKey = (k: string) =>
    k === 'ruflo' || k === 'ruflo_alpha' || k === 'claude-flow' || k === 'claude-flow_alpha';

  for (const configPath of mcpConfigPaths) {
    if (!existsSync(configPath)) continue;
    try {
      const content = JSON.parse(readFileSync(configPath, 'utf8'));
      // Top-level mcpServers (legacy / desktop form)
      const topServers = content.mcpServers || content.servers || {};
      const topServerKeys = Object.keys(topServers);
      const topHasRuflo = topServerKeys.some(isRufloKey);

      // Project-scoped (Claude Code shape): projects[*].mcpServers.ruflo
      let projectHits = 0;
      let projectScannedServers = 0;
      if (content.projects && typeof content.projects === 'object') {
        for (const projectVal of Object.values(content.projects)) {
          const pm = (projectVal as { mcpServers?: Record<string, unknown> })?.mcpServers;
          if (pm && typeof pm === 'object') {
            const keys = Object.keys(pm);
            projectScannedServers += keys.length;
            if (keys.some(isRufloKey)) projectHits += 1;
          }
        }
      }

      const totalServers = topServerKeys.length + projectScannedServers;
      if (topHasRuflo || projectHits > 0) {
        const where = topHasRuflo
          ? 'top-level'
          : `${projectHits} project-scoped`;
        return {
          name: 'MCP Servers',
          status: 'pass',
          message: `${totalServers} servers (ruflo configured: ${where})`,
        };
      }
      if (totalServers > 0) {
        return {
          name: 'MCP Servers',
          status: 'warn',
          message: `${totalServers} servers (ruflo not found)`,
          fix: 'claude mcp add ruflo -- npx -y ruflo@latest mcp start',
        };
      }
    } catch {
      // continue to next path
    }
  }

  return {
    name: 'MCP Servers',
    status: 'warn',
    message: 'No MCP config found',
    fix: 'claude mcp add ruflo -- npx -y ruflo@latest mcp start',
  };
}

// Check disk space (async with proper env inheritance)
async function checkEncryptionAtRest(): Promise<HealthCheck> {
  if (!isEncryptionEnabled()) {
    return {
      name: 'Encryption at Rest',
      status: 'warn',
      message: 'Off — session/terminal/memory stores are plaintext (mode 0600 only)',
      fix: 'export CLAUDE_FLOW_ENCRYPT_AT_REST=1 && export CLAUDE_FLOW_ENCRYPTION_KEY=<64-char-hex>',
    };
  }

  // Gate is on — try to resolve the key. Fail-closed if missing or malformed.
  const rawKey = process.env.CLAUDE_FLOW_ENCRYPTION_KEY;
  if (!rawKey) {
    return {
      name: 'Encryption at Rest',
      status: 'fail',
      message: 'Gate is on but CLAUDE_FLOW_ENCRYPTION_KEY is unset (fail-closed)',
      fix: 'Generate a key: openssl rand -hex 32 → export CLAUDE_FLOW_ENCRYPTION_KEY=<value>',
    };
  }
  let keyFingerprint: string;
  try {
    const key = decodeKey(rawKey);
    keyFingerprint = createHash('sha256').update(key).digest('hex').slice(0, 16);
  } catch (err) {
    return {
      name: 'Encryption at Rest',
      status: 'fail',
      message: `CLAUDE_FLOW_ENCRYPTION_KEY invalid: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Provide a 64-char hex or 44-char base64 key (32 bytes)',
    };
  }

  // Check the three high-tier store paths for RFE1 magic
  const cwd = process.cwd();
  const stores: Array<{ label: string; path: string }> = [
    { label: 'sessions/', path: join(cwd, '.claude-flow', 'sessions') },
    { label: 'terminals', path: join(cwd, '.claude-flow', 'terminals', 'store.json') },
    { label: 'memory.db', path: join(cwd, '.swarm', 'memory.db') },
  ];
  const status: string[] = [];
  for (const s of stores) {
    if (!existsSync(s.path)) {
      status.push(`${s.label}=∅`);
      continue;
    }
    try {
      const stat = statSync(s.path);
      if (stat.isDirectory()) {
        // Sessions: probe the first .json file
        const { readdirSync } = await import('fs');
        const files = readdirSync(s.path).filter(f => f.endsWith('.json'));
        if (files.length === 0) { status.push(`${s.label}=∅`); continue; }
        const first = readFileSync(join(s.path, files[0]));
        status.push(`${s.label}=${isEncryptedBlob(first) ? 'enc' : 'plain'}`);
      } else {
        const buf = readFileSync(s.path);
        status.push(`${s.label}=${isEncryptedBlob(buf) ? 'enc' : 'plain'}`);
      }
    } catch {
      status.push(`${s.label}=err`);
    }
  }

  return {
    name: 'Encryption at Rest',
    status: 'pass',
    message: `On — key fp:${keyFingerprint}… (${status.join(' ')})`,
  };
}

// Format health check result
function formatCheck(check: HealthCheck): string {
  const icon = check.status === 'pass' ? output.success('✓') :
               check.status === 'warn' ? output.warning('⚠') :
               output.error('✗');
  return `${icon} ${check.name}: ${check.message}`;
}

// Main doctor command
export const doctorCommand: Command = {
  name: 'doctor',
  description: 'System diagnostics and health checks',
  options: [
    {
      name: 'fix',
      short: 'f',
      // #1791.5 — flag name was misleading: it does NOT auto-apply fixes,
      // it only prints the suggested commands so the user can run them
      // themselves. Make that explicit in the help output.
      description: 'Print suggested fix commands (does not auto-apply — copy/paste them yourself)',
      type: 'boolean',
      default: false
    },
    {
      name: 'install',
      short: 'i',
      description: 'Auto-install missing dependencies (Claude Code CLI)',
      type: 'boolean',
      default: false
    },
    {
      name: 'component',
      short: 'c',
      description: 'Check specific component (version, node, npm, config, daemon, memory, api, git, mcp, claude, disk, typescript)',
      type: 'string'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow doctor', description: 'Run full health check' },
    { command: 'claude-flow doctor --fix', description: 'Print suggested fix commands (does not auto-apply)' },
    { command: 'claude-flow doctor --install', description: 'Auto-install missing dependencies' },
    { command: 'claude-flow doctor -c version', description: 'Check for stale npx cache' },
    { command: 'claude-flow doctor -c claude', description: 'Check Claude Code CLI only' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const showFix = ctx.flags.fix as boolean;
    const autoInstall = ctx.flags.install as boolean;
    const component = ctx.flags.component as string;
    const verbose = ctx.flags.verbose as boolean;

    output.writeln();
    output.writeln(output.bold('AlexKo Doctor'));
    output.writeln(output.dim('System diagnostics and health check'));
    output.writeln(output.dim('─'.repeat(50)));
    output.writeln();

    const allChecks: (() => Promise<HealthCheck>)[] = [
      checkVersionFreshness,
      checkNodeVersion,
      checkNpmVersion,
      checkClaudeCode,
      checkGit,
      checkGitRepo,
      checkConfigFile,
      checkDaemonStatus,
      checkMemoryDatabase,
      checkApiKeys,
      checkMcpServers,
      checkAIDefence, // #1807
      checkDiskSpace,
      checkBuildTools,
      checkAgenticFlow,
      checkEncryptionAtRest, // ADR-096 Phase 5
      checkFederationBreaker, // ADR-097 Phase 4
    ];

    const componentMap: Record<string, () => Promise<HealthCheck>> = {
      'version': checkVersionFreshness,
      'freshness': checkVersionFreshness,
      'node': checkNodeVersion,
      'npm': checkNpmVersion,
      'claude': checkClaudeCode,
      'config': checkConfigFile,
      'daemon': checkDaemonStatus,
      'memory': checkMemoryDatabase,
      'api': checkApiKeys,
      'git': checkGit,
      'mcp': checkMcpServers,
      'aidefence': checkAIDefence, // #1807
      'disk': checkDiskSpace,
      'typescript': checkBuildTools,
      'agentic-flow': checkAgenticFlow,
      'encryption': checkEncryptionAtRest, // ADR-096 Phase 5
      'federation': checkFederationBreaker, // ADR-097 Phase 4
    };

    let checksToRun = allChecks;
    if (component && componentMap[component]) {
      checksToRun = [componentMap[component]];
    }

    const results: HealthCheck[] = [];
    const fixes: string[] = [];

    // OPTIMIZATION: Run all checks in parallel for 3-5x faster execution
    const spinner = output.createSpinner({ text: 'Running health checks in parallel...', spinner: 'dots' });
    spinner.start();

    try {
      // Execute all checks concurrently
      const checkResults = await Promise.allSettled(checksToRun.map(check => check()));
      spinner.stop();

      // Process results in order
      for (const settledResult of checkResults) {
        if (settledResult.status === 'fulfilled') {
          const result = settledResult.value;
          results.push(result);
          output.writeln(formatCheck(result));

          if (result.fix && (result.status === 'fail' || result.status === 'warn')) {
            fixes.push(`${result.name}: ${result.fix}`);
          }
        } else {
          const errorResult: HealthCheck = {
            name: 'Check',
            status: 'fail',
            message: settledResult.reason?.message || 'Unknown error'
          };
          results.push(errorResult);
          output.writeln(formatCheck(errorResult));
        }
      }
    } catch (error) {
      spinner.stop();
      output.writeln(output.error('Failed to run health checks'));
    }

    // Auto-install missing dependencies if requested
    if (autoInstall) {
      const claudeCodeResult = results.find(r => r.name === 'Claude Code CLI');
      if (claudeCodeResult && claudeCodeResult.status !== 'pass') {
        const installed = await installClaudeCode();
        if (installed) {
          // Re-check Claude Code after installation
          const newCheck = await checkClaudeCode();
          const idx = results.findIndex(r => r.name === 'Claude Code CLI');
          if (idx !== -1) {
            results[idx] = newCheck;
            // Update fixes list
            const fixIdx = fixes.findIndex(f => f.startsWith('Claude Code CLI:'));
            if (fixIdx !== -1 && newCheck.status === 'pass') {
              fixes.splice(fixIdx, 1);
            }
          }
          output.writeln(formatCheck(newCheck));
        }
      }
    }

    // Summary
    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;

    output.writeln();
    output.writeln(output.dim('─'.repeat(50)));
    output.writeln();

    const summaryParts = [
      output.success(`${passed} passed`),
      warnings > 0 ? output.warning(`${warnings} warnings`) : null,
      failed > 0 ? output.error(`${failed} failed`) : null
    ].filter(Boolean);

    output.writeln(`Summary: ${summaryParts.join(', ')}`);

    // Show fixes — #1791.5: header makes it explicit these are commands you
    // run yourself, not actions doctor took.
    if (showFix && fixes.length > 0) {
      output.writeln();
      output.writeln(output.bold('Suggested commands (run them yourself):'));
      output.writeln();
      for (const fix of fixes) {
        output.writeln(output.dim(`  ${fix}`));
      }
    } else if (fixes.length > 0 && !showFix) {
      output.writeln();
      output.writeln(output.dim(`Run with --fix to see ${fixes.length} suggested command${fixes.length > 1 ? 's' : ''} (does not auto-apply)`));
    }

    // Overall result
    if (failed > 0) {
      output.writeln();
      output.writeln(output.error('Some checks failed. Please address the issues above.'));
      return { success: false, exitCode: 1, data: { passed, warnings, failed, results } };
    } else if (warnings > 0) {
      output.writeln();
      output.writeln(output.warning('All checks passed with some warnings.'));
      return { success: true, data: { passed, warnings, failed, results } };
    } else {
      output.writeln();
      output.writeln(output.success('All checks passed! System is healthy.'));
      return { success: true, data: { passed, warnings, failed, results } };
    }
  }
};

export default doctorCommand;

/**
 * Optional service / package health checks: AIDefence (#1807), Federation
 * Breaker (ADR-097 Phase 4), MCP servers config (#1842).
 *
 * Pilot extraction (issue #7) — these all share the "is the optional
 * package loadable + is it wired in the right place" pattern, so they
 * live in one file.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { HealthCheck } from '../utils.js';

export async function checkAIDefence(): Promise<HealthCheck> {
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
export async function checkFederationBreaker(): Promise<HealthCheck> {
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
export async function checkMcpServers(): Promise<HealthCheck> {
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

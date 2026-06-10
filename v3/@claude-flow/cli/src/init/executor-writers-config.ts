/**
 * Init config-file writers — the directory scaffold + settings.json +
 * .mcp.json generation.
 *
 *   - createDirectories      (mkdir the .claude / .claude-flow scaffold)
 *   - writeSettings          (settings.json, merge-preserving on re-init)
 *   - writeMCPConfig         (.mcp.json, with #1779 duplicate-ruflo skip)
 *   - detectExistingRufloMCP (internal: find a pre-existing ruflo MCP
 *                            registration to avoid double-registering)
 *   - normalizeProjectKey    (internal: stable project key)
 *
 * Extracted from executor.ts (W81, P3.6 cut #5).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { InitOptions, InitResult } from './types.js';
import { generateSettingsJson } from './settings-generator.js';
import { generateMCPJson } from './mcp-generator.js';
import { DIRECTORIES } from './executor-maps.js';

export async function createDirectories(
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
export async function writeSettings(
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
export async function writeMCPConfig(
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

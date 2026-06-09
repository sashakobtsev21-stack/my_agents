/**
 * Claude Code CLI + agentic-flow package health checks.
 *
 * Pilot extraction (issue #7).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import type { HealthCheck } from '../utils.js';
import { runCommand } from '../utils.js';
import { output } from '../../../output.js';

export async function checkClaudeCode(): Promise<HealthCheck> {
  try {
    const version = await runCommand('claude', ['--version']);
    // Parse version from output like "claude 1.0.0" or "Claude Code v1.0.0"
    const versionMatch = version.match(/v?(\d+\.\d+\.\d+)/);
    const versionStr = versionMatch ? `v${versionMatch[1]}` : version;
    return { name: 'Claude Code CLI', status: 'pass', message: versionStr };
  } catch {
    return {
      name: 'Claude Code CLI',
      status: 'warn',
      message: 'Not installed',
      fix: 'npm install -g @anthropic-ai/claude-code'
    };
  }
}

// Install Claude Code CLI
export async function installClaudeCode(): Promise<boolean> {
  try {
    output.writeln();
    output.writeln(output.bold('Installing Claude Code CLI...'));
    // ADR-078: execFileSync (no shell). Argv array — no string interpolation
    // possible. .cmd shim needed on Windows where bare `npm` is a batch script.
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFileSync(npmCmd, ['install', '-g', '@anthropic-ai/claude-code'], {
      encoding: 'utf8',
      stdio: 'inherit',
    });
    output.writeln(output.success('Claude Code CLI installed successfully!'));
    return true;
  } catch (error) {
    output.writeln(output.error('Failed to install Claude Code CLI'));
    if (error instanceof Error) {
      output.writeln(output.dim(error.message));
    }
    return false;
  }
}

// Check agentic-flow v3 integration (filesystem-based to avoid slow WASM/DB init)
export async function checkAgenticFlow(): Promise<HealthCheck> {
  try {
    // Walk common node_modules paths to find agentic-flow/package.json
    const candidates = [
      join(process.cwd(), 'node_modules', 'agentic-flow', 'package.json'),
      join(process.cwd(), '..', 'node_modules', 'agentic-flow', 'package.json'),
    ];
    let pkgJsonPath: string | null = null;
    for (const p of candidates) {
      if (existsSync(p)) { pkgJsonPath = p; break; }
    }
    if (!pkgJsonPath) {
      return {
        name: 'agentic-flow',
        status: 'warn',
        message: 'Not installed (optional — embeddings/routing will use fallbacks)',
        fix: 'npm install agentic-flow@latest'
      };
    }
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const version = pkg.version || 'unknown';
    const exports = pkg.exports || {};
    const features = [
      exports['./reasoningbank'] ? 'ReasoningBank' : null,
      exports['./router'] ? 'Router' : null,
      exports['./transport/quic'] ? 'QUIC' : null,
    ].filter(Boolean);
    return {
      name: 'agentic-flow',
      status: 'pass',
      message: `v${version} (${features.join(', ')})`
    };
  } catch {
    return { name: 'agentic-flow', status: 'warn', message: 'Check failed' };
  }
}

// Check encryption-at-rest status (ADR-096 Phase 5)
//
// Reports four facets without disclosing the key itself:
//   1. Gate status — is CLAUDE_FLOW_ENCRYPT_AT_REST set?
//   2. Key resolution — does CLAUDE_FLOW_ENCRYPTION_KEY resolve to a valid
//      32-byte key (env-var path only; keychain/passphrase are deferred)?
//   3. Key fingerprint — first 16 hex chars of sha256(key) so users can
//      sanity-check across machines without ever logging the key bytes.
//   4. High-tier store presence — for sessions/, terminals/, .swarm/memory.db
//      report whether on-disk bytes carry the RFE1 magic (encrypted) or not.

/**
 * Helpers Generator
 * Creates utility scripts in .claude/helpers/
 */

import type { InitOptions } from './types.js';
import { generateStatuslineScript, generateStatuslineHook } from './statusline-generator.js';
// Individual helper-file generators moved to ./generators-a.ts +
// ./generators-b.ts (W142, P3.24). generateHelpers composes them; they're
// re-exported so executor-upgrade / executor-writers-runtime / index keep
// importing them from './helpers-generator.js' byte-identically.
import {
  generatePreCommitHook, generatePostCommitHook,
  generateAgentRouter, generateMemoryHelper,
} from './generators-a.js';
import {
  generateWindowsDaemonManager,
  generateWindowsBatchWrapper, generateCrossPlatformSessionManager,
} from './generators-b.js';
export {
  generatePreCommitHook, generatePostCommitHook, generateSessionManager,
  generateAgentRouter, generateMemoryHelper, generateHookHandler,
} from './generators-a.js';
export {
  generateIntelligenceStub, generateAutoMemoryHook, generateWindowsDaemonManager,
  generateWindowsBatchWrapper, generateCrossPlatformSessionManager,
} from './generators-b.js';

// ADR-127 Phase 4 — attribution is opt-in (#1670 / #2089).
// When the user passes --attribution (options.attribution === true),
// this footer is available for injection into generated content such as
// PR body templates and release notes.  It is NEVER hard-wired into the
// static command-file templates — those are user-owned content.
export const ATTRIBUTION_FOOTER =
  '🤖 Generated with [AlexKo](https://github.com/ruvnet/ruflo)';

/**
 * Generate all helper files
 */
export function generateHelpers(options: InitOptions): Record<string, string> {
  const helpers: Record<string, string> = {};

  if (options.components.helpers) {
    // Unix/macOS shell scripts
    helpers['pre-commit'] = generatePreCommitHook();
    helpers['post-commit'] = generatePostCommitHook();

    // Cross-platform Node.js scripts
    helpers['session.js'] = generateCrossPlatformSessionManager();
    helpers['router.js'] = generateAgentRouter();
    helpers['memory.js'] = generateMemoryHelper();

    // Windows-specific scripts
    helpers['daemon-manager.ps1'] = generateWindowsDaemonManager();
    helpers['daemon-manager.cmd'] = generateWindowsBatchWrapper();

    // ADR-127 Phase 4 — expose the attribution footer as a helper file only
    // when the user explicitly opts in. The file content is the single-line
    // string so init-generated PR templates can `cat .claude/helpers/attribution`
    // and append it conditionally without hard-wiring the string everywhere.
    if (options.attribution === true) {
      helpers['attribution'] = ATTRIBUTION_FOOTER + '\n';
    }
  }

  if (options.components.statusline) {
    helpers['statusline.cjs'] = generateStatuslineScript(options);  // .cjs for ES module compatibility
    helpers['statusline-hook.sh'] = generateStatuslineHook(options);
  }

  return helpers;
}

/**
 * Generate cross-platform Node.js port of ruflo-hook.sh (#2132).
 *
 * The bash shim works on Mac/Linux but fails on native Windows (exit 126).
 * This .cjs version is always deployed to .claude/helpers/ so:
 *   - Windows: settings.json overrides plugin bash hooks with node-based cmds
 *   - Mac/Linux: plugin hooks.json still uses .sh (faster, battle-tested)
 *   - Both: .claude/helpers/ruflo-hook.cjs available as a canonical cross-platform shim
 */
export function generateRufloHookCjs(): string {
  return `#!/usr/bin/env node
/**
 * ruflo-hook.cjs — cross-platform Node.js port of ruflo-hook.sh (#2132)
 *
 * Deployed to .claude/helpers/ during ruflo init. On Windows, the
 * generated .claude/settings.json hooks point here instead of the
 * plugin's bash-only ruflo-hook.sh.
 *
 * Always exits 0 — hook subcommands are best-effort telemetry and must
 * never block a Claude Code turn.
 */

'use strict';

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');

function done() { process.exit(0); }

function commandExists(cmd) {
  try {
    const r = execSync(
      process.platform === 'win32' ? 'where ' + cmd : 'command -v ' + cmd,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return r.trim().length > 0;
  } catch { return false; }
}

function invokeHook(bin, binArgs, hookArgs, stdinData) {
  const args = [...binArgs, ...hookArgs];
  const result = spawnSync(bin, args, {
    shell: process.platform === 'win32',
    input: stdinData || '',
    encoding: 'utf8',
    stdio: ['pipe', 'ignore', 'ignore'],
    timeout: 30_000,
  });
  return result.status === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) done();

  const [subcommand, ...rest] = args;

  let stdinData = '';
  try { stdinData = fs.readFileSync(0, 'utf8'); } catch { stdinData = ''; }

  const hookArgs = ['hooks', subcommand, ...rest];

  if (commandExists('ruflo')) { invokeHook('ruflo', [], hookArgs, stdinData); done(); }
  if (commandExists('claude-flow')) { invokeHook('claude-flow', [], hookArgs, stdinData); done(); }
  invokeHook('npx', ['--prefer-offline', '--yes', 'ruflo@latest'], hookArgs, stdinData);
  done();
}

main();
`;
}


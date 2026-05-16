#!/usr/bin/env node
/**
 * Regression guard for ruvnet/ruflo#2015.
 *
 * ruvector@0.2.25's `rvf create` requires a `-d, --dimension <n>`
 * flag. ruflo-browser 0.2.0's `browser_session_record` MCP tool
 * invoked the command WITHOUT it, so every call failed with:
 *
 *   error: required option '-d, --dimension <n>' not specified
 *
 * The fix passes `--dimension 384` (matches the MiniLM-L6 default
 * used by AgentDB indexes and the ONNX embedder). This script
 * statically scans every place we shell out to `ruvector rvf create`
 * across the repo and fails if any of them is missing the flag.
 *
 * Covers:
 *   - TS source + compiled dist of the MCP tool
 *   - Shell scripts in plugins/ruflo-browser/scripts/
 *   - Doc snippets in plugins/ruflo-browser/{agents,skills}/*.md
 *     (these are agent-facing recipes that get pasted into bashes —
 *      if the doc is wrong, agents reproduce the broken call)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = resolve(process.cwd());

// Find every file that mentions `rvf create` with the browser-session
// kind. ripgrep is faster than glob+read; fall back to find+grep if rg
// isn't on the runner.
let hits;
try {
  hits = execSync(
    `rg -l --no-messages "rvf.{0,8}create" -g '!node_modules' -g '!**/dist/**/*.map' -g '!.git'`,
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
} catch {
  hits = execSync(
    `grep -rl --exclude-dir=node_modules --exclude-dir=.git "rvf create" .`,
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
}

// We only police call sites that pair `rvf create` with `--kind browser-session`.
// Other `rvf create` uses (e.g. inside ruvector's own dist or unrelated kinds)
// aren't in scope of #2015.
const failures = [];
const checked = [];

for (const rel of hits) {
  const path = resolve(REPO_ROOT, rel);
  if (!existsSync(path)) continue;
  // Skip worktree clones — they're not on the publish path and they
  // duplicate every finding.
  if (rel.includes('.claude/worktrees/')) continue;
  // Skip node_modules just in case the rg ignore didn't match.
  if (rel.includes('node_modules/')) continue;
  // Skip stale untracked dist/ at the repo root (the real published
  // dist lives under v3/@claude-flow/cli/dist/, which IS scanned).
  if (rel.startsWith('dist/') || rel.startsWith('./dist/')) continue;
  // Skip this script itself — its grep patterns aren't real calls.
  if (rel.endsWith('smoke-browser-rvf-create-flags.mjs')) continue;

  const content = readFileSync(path, 'utf8');

  // Find every line that has both `rvf create` and `browser-session`.
  // Multi-line shell quoting is fine — the args we care about land
  // on the same line in every call site we control.
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/rvf['"\s,]*create/.test(line)) continue;
    if (!/browser-session/.test(line)) continue;

    checked.push(`${rel}:${i + 1}`);

    // Accept either flag form: `--dimension <n>` or `-d <n>`.
    const hasFlag = /--dimension\b|(^|[^a-zA-Z0-9_])-d\b/.test(line);
    if (!hasFlag) {
      failures.push(`${rel}:${i + 1}  missing --dimension on rvf create`);
    }
  }
}

if (checked.length === 0) {
  console.error('smoke-browser-rvf-create-flags: no call sites matched — pattern broken?');
  process.exit(1);
}

console.log(`Checked ${checked.length} call site(s):`);
for (const c of checked) console.log(`  - ${c}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} call site(s) missing --dimension:`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\nFix: append "--dimension 384" (or your project's vector dim)`);
  console.error(`to the rvf create invocation. See ruvnet/ruflo#2015.`);
  process.exit(1);
}

console.log('\nsmoke-browser-rvf-create-flags: all call sites carry --dimension');

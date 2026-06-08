#!/usr/bin/env node
/**
 * ruflo-internal witness regen — thin wrapper around the canonical
 * implementation in `plugins/ruflo-core/scripts/witness/regen.mjs`.
 *
 * The plugin script is project-agnostic; this wrapper hard-codes ruflo's
 * paths so contributors can run a one-liner. Add new fix entries by
 * editing `witness-fixes.json` at the repo root.
 *
 * Usage:
 *   node scripts/regen-witness.mjs            # regen + append history
 *   node scripts/regen-witness.mjs --dry-run  # preview without writing
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { regenerate, appendHistory, osDir } from '../plugins/ruflo-core/scripts/witness/lib.mjs';

const REPO_ROOT = process.cwd();

// Per-OS layout (see ADR-103 §6 — verification cognitive container).
// Each OS subdir holds the manifest signed by that OS's runner; CI
// regenerates its own per-OS bundle. Shared inputs live at verification/.
//
// `--os <name>` overrides the current OS so one machine can regen all 3
// manifests at once. Hashes are content-based (deterministic across OSes
// for a built artefact), only the "os" field differs.
const OS_ARG = process.argv.find((a) => a.startsWith('--os='))?.slice(5)
  ?? (process.argv.includes('--os') ? process.argv[process.argv.indexOf('--os') + 1] : null);
const OS = OS_ARG ?? osDir();
const VERIFICATION_DIR = join(REPO_ROOT, 'verification');
const MANIFEST_PATH = join(VERIFICATION_DIR, OS, 'manifest.md.json');
const HISTORY_PATH = join(VERIFICATION_DIR, OS, 'history.jsonl');
const FIXES_CONFIG = join(VERIFICATION_DIR, 'witness-fixes.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Ensure the per-OS subdir exists (CI on a new OS bootstraps cleanly).
mkdirSync(dirname(MANIFEST_PATH), { recursive: true });

const newFixes = existsSync(FIXES_CONFIG)
  ? JSON.parse(readFileSync(FIXES_CONFIG, 'utf8')).fixes ?? []
  : [];

const releases = {};
for (const [key, pkgPath] of [
  ['ruflo', 'ruflo/package.json'],
  ['claude-flow', 'package.json'],
  ['@claude-flow/cli', 'v3/@claude-flow/cli/package.json'],
  ['@claude-flow/memory', 'v3/@claude-flow/memory/package.json'],
]) {
  const fullPath = join(REPO_ROOT, pkgPath);
  if (existsSync(fullPath)) releases[key] = JSON.parse(readFileSync(fullPath, 'utf8')).version;
}

const result = regenerate({
  repoRoot: REPO_ROOT,
  manifestPath: MANIFEST_PATH,
  newFixes,
  releases,
  ed25519Roots: [REPO_ROOT, join(REPO_ROOT, 'v3')],
  osOverride: OS_ARG ?? undefined,
});

console.log('witness regen summary');
console.log('─────────────────────');
console.log(result.summary);

if (DRY_RUN) {
  console.log('\n(dry-run — manifest NOT written)');
  process.exit(0);
}

writeFileSync(MANIFEST_PATH, JSON.stringify(result.witness, null, 2));
console.log(`\nwritten:  ${MANIFEST_PATH}`);

appendHistory(HISTORY_PATH, result.witness.manifest, result.manifestHash);
console.log(`appended: ${HISTORY_PATH}`);

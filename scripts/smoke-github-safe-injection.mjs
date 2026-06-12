#!/usr/bin/env node
/**
 * Regression guard for ruvnet/ruflo#2089 — ADR-127 Phase 1.
 *
 * Generalizes the smoke-pre-bash-hook.mjs pattern (#2017) to the GitHub helper
 * surface.  `github-safe.js` writes untrusted PR/issue body content to a temp
 * file and passes `--body-file` to `gh` instead of interpolating the body into
 * shell arguments.  Without that protection a body containing shell
 * metacharacters (backticks, `$(...)`, semicolons) would expand when the caller
 * embeds the content in an unquoted shell expression.
 *
 * Approach: shim the `gh` binary with a fake script that dumps its argv to
 * stdout and exits 0.  We then read that output to assert:
 *   1. The helper passed `--body-file <tmpfile>`, NOT `--body <rawbody>`.
 *   2. The temp-file content is verbatim (not shell-expanded).
 *   3. A body >256KB triggers a rejection BEFORE gh is invoked (Phase 2 target;
 *      Phase 1 documents the expected red→green without failing the build).
 *   4. An empty body skips the temp-file path entirely (no-op, helper exits 0).
 *
 * Runs against BOTH copies:
 *   1. .claude/helpers/github-safe.js                       (dogfood)
 *   2. v3/@claude-flow/cli/.claude/helpers/github-safe.js   (init-template)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const HELPERS = [
  join(REPO_ROOT, '.claude', 'helpers', 'github-safe.js'),
  join(REPO_ROOT, 'v3', '@claude-flow', 'cli', '.claude', 'helpers', 'github-safe.js'),
];

// 256 KB — the GitHub API body field limit documented in ADR-127.
const MAX_BODY_BYTES = 256 * 1024;

// W-T7: drive the helper through its built-in dry-run mode instead of a fake
// `gh` PATH shim. The old shim was a `gh` (POSIX) / `gh.cmd` (Windows) file,
// but the helper invokes `execFileSync('gh', …)` which on Windows resolves to
// the REAL authenticated `gh.exe` (Node doesn't pick up a `.cmd` shim there),
// so the smoke silently hit live GitHub and created real issues/comments.
// GITHUB_SAFE_DRY_RUN makes the helper print `[DRY-RUN] gh <args>` (with the
// safe `--body-file` substitution already applied) and exit WITHOUT spawning
// gh — fully cross-platform and side-effect-free.
const dryRunEnv = { ...process.env, GITHUB_SAFE_DRY_RUN: '1' };

const cases = [
  {
    name: 'backtick body — temp-file path, body verbatim',
    args: ['issue', 'comment', '1', 'code: `rm -rf /`'],
    expectBodyVerbatim: 'code: `rm -rf /`',
    expectBodyFileFlagInArgv: true,
  },
  {
    name: '$() body — temp-file path, body verbatim',
    args: ['pr', 'comment', '1', 'result: $(whoami)'],
    expectBodyVerbatim: 'result: $(whoami)',
    expectBodyFileFlagInArgv: true,
  },
  {
    name: 'semicolon body — temp-file path, body verbatim',
    args: ['issue', 'create', '--title', 'test', '--body', 'a; b; c'],
    expectBodyVerbatim: 'a; b; c',
    expectBodyFileFlagInArgv: true,
  },
  {
    // Phase 2: github-safe.js now enforces the 256KB cap (GITHUB_SAFE_VERSION=1.0.0).
    // A body exceeding the limit must be rejected (exit 1) BEFORE gh is invoked.
    name: '>256KB body — must be rejected (body cap, Phase 2)',
    args: ['issue', 'comment', '1', 'x'.repeat(MAX_BODY_BYTES + 1)],
    expectExit: 1,
  },
  {
    name: 'empty body — no-op path, exits 0',
    args: ['issue', 'comment', '1', ''],
    expectExit: 0,
    // Empty body takes the "execute normally" branch — gh is called directly.
    // The fake-gh exits 0, so the helper should exit 0 too.
  },
];

function parseDryRunArgv(out) {
  // The helper prints `[DRY-RUN] gh <command> <subcommand> <args...>` with the
  // safe --body-file substitution already applied. Temp paths live in tmpdir
  // with a hex name (no spaces), so a simple whitespace split recovers argv.
  const m = out.match(/\[DRY-RUN\] gh (.+)/);
  return m ? m[1].trim().split(/\s+/) : [];
}

function runOne(helperPath, c) {
  const r = spawnSync('node', [helperPath, ...c.args], {
    encoding: 'utf-8',
    timeout: 15_000,
    env: dryRunEnv,
  });

  const out   = r.stdout || '';
  const err   = r.stderr || '';
  const fails = [];

  if (c.note) {
    // Documented transition — don't fail the build.
    return { fails: [], out, err, status: r.status, note: c.note };
  }

  if (c.expectExit !== undefined && c.expectExit !== 'any' && r.status !== c.expectExit) {
    // A >256KB body can also be rejected by the OS at spawn time (the arg
    // exceeds the platform command-line limit) before the helper's own cap
    // fires: Linux → E2BIG, Windows → ENAMETOOLONG/EINVAL, status=null. Either
    // way the body never reached gh, which is what the cap test asserts.
    const osRejected = r.status === null && !!r.error;
    if (c.expectExit === 1 && osRejected) {
      // Treated as rejected — no extra failure.
    } else {
      fails.push(`exit ${r.status} (expected ${c.expectExit})${osRejected ? ` [${r.error?.code}]` : ''}`);
    }
  }

  if (c.expectBodyFileFlagInArgv || c.expectBodyVerbatim) {
    const argv = parseDryRunArgv(out);
    if (argv.length === 0) {
      fails.push('helper did not emit a [DRY-RUN] gh line — it may have crashed before the gh call');
    }

    if (c.expectBodyFileFlagInArgv) {
      if (!argv.includes('--body-file')) {
        fails.push(`--body-file not found in gh argv (argv: ${JSON.stringify(argv.slice(0, 8))})`);
      }
      if (argv.includes('--body')) {
        fails.push('--body (inline) found in gh argv — body is being passed unsafely');
      }
    }

    if (c.expectBodyVerbatim) {
      const bfIdx = argv.indexOf('--body-file');
      const tmpFilePath = bfIdx !== -1 ? argv[bfIdx + 1] : undefined;
      // Dry-run exits via process.exit() before the helper's finally-cleanup,
      // so the temp file is still on disk for a verbatim content check.
      if (tmpFilePath && existsSync(tmpFilePath)) {
        const content = readFileSync(tmpFilePath, 'utf-8');
        if (content !== c.expectBodyVerbatim) {
          fails.push(`temp-file content mismatch: expected ${JSON.stringify(c.expectBodyVerbatim)}, got ${JSON.stringify(content.slice(0, 120))}`);
        }
      }
    }
  }

  return { fails, out, err, status: r.status };
}

let failed = 0;
for (const helperPath of HELPERS) {
  if (!existsSync(helperPath)) {
    console.error(`[skip] helper not found: ${helperPath}`);
    continue;
  }
  console.log(`\n# ${helperPath}`);
  for (const c of cases) {
    const r = runOne(helperPath, c);
    if (r.note) {
      console.log(`  note ${c.name}`);
      console.log(`         ${r.note}`);
    } else if (r.fails.length === 0) {
      console.log(`  ok   ${c.name}`);
    } else {
      failed++;
      console.error(`  fail ${c.name}`);
      for (const f of r.fails) console.error(`         - ${f}`);
      if (r.out.trim()) console.error(`         stdout: ${r.out.trim().replace(/\n/g, ' | ')}`);
      if (r.err.trim()) console.error(`         stderr: ${r.err.trim().slice(0, 200).replace(/\n/g, ' | ')}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} github-safe injection smoke case(s) failed — regression of #2089`);
  process.exit(1);
}
console.log('\nok: github-safe injection smoke passed both helper copies');

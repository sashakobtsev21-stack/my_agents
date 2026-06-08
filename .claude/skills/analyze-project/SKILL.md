---
name: "Analyze Project"
description: "Run a full, evidence-based audit of any codebase — vulnerabilities, build/runtime health, bottlenecks, tests, and git — and produce a prioritized report + improvement plan. Use when the user wants to analyze, audit, or review an existing project (local path or git URL) and get a clear plan to improve it."
---

# Analyze Project

Repeatable end-to-end audit of an existing codebase. Orchestrate parallel
specialists + run **real tools** (never guess), then synthesize one prioritized
report with an improvement plan. This is the canonical "analyze existing" flow.

## Input

A local path (`C:\...\app`) or a git URL. If a URL: `git clone` it into a temp
dir first. If neither is given, ask once for the target and the depth
("quick scan" vs "deep audit").

## Pipeline (run real tools — evidence over assertion)

1. **Recon** — map structure, stack, entry points, size (`git ls-files`, globs).
   Detect the project type first: `node scripts/detect-profile.mjs <path>` → use the
   matching agent pack from `docs/CORE-AGENTS.md`, ignore the Advanced agents
   (consensus/sublinear/flow-nexus). Don't audit a game like a backend.
   Spawn `Explore` agents in parallel for breadth when the repo is large.
2. **Build & runtime health** — install + build (`npm/pnpm build`, `tsc`),
   `lint`, and a smoke run. Record exact pass/fail + output. Agents: `analyst`,
   `code-analyzer`.
3. **Vulnerabilities** — `npm audit` (or ecosystem equivalent), secret scan,
   dependency CVEs, input-validation review. Agents: `security-auditor`,
   `dependency-auditor`.
4. **Bottlenecks** — god-files (>1000 lines), complexity, heavy deps, hot
   paths. Agents: `perf-analyzer`, `performance-benchmarker`.
5. **Tests** — run the suite, capture coverage, map untested packages/modules.
   Agents: `tester`, `test-architect`.
6. **Git** — branch/commit hygiene, secrets in history, `.gitignore`, CI
   workflows, release process.

Run independent stages/agents **in parallel** (one message, background) and run
slow steps (full build) in the background. Do **not** poll — synthesize when
results arrive.

## Verify gate (mandatory)

Every claim in the report must be backed by a command you actually ran. If a
tool could not run (missing deps, no lockfile, build broke), **say so
explicitly** — never report green you didn't observe. Distinguish "measured"
from "unverified".

## Output contract

A single report:
- **Snapshot** — what it is, builds? tests pass? audit clean? (one line each)
- **Findings by area** with `file:line` evidence and a "claimed vs real" table
  where docs disagree with reality.
- **Plan** — prioritized P1/P2/P3 with rough effort, leading with one
  recommended first step.

If the user then asks to fix items, apply them, **re-run the relevant tool to
confirm green**, and (per repo policy) commit + push.

## Anti-drift

Keep scope to what was asked; cite evidence; one explicit verdict per area;
prefer reading excerpts over dumping whole files.

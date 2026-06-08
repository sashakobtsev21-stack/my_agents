# Agent Prompt Remediation Changelog

A fix pass over the agent prompts under `.claude/agents/` to enforce the prompt
standard: router-keyable **triggers** ("Use when …"), required body sections
(When to use / How you work / Coordination + Tier / Scope), valid **handoffs**
(every referenced agent must resolve to a real agent), honest claims (no banned
or fabricated benchmark figures), and reasonable file size (no copy-paste bloat).

## Summary

- **Agents scanned:** 117
- **Agents edited:** 30
- **Agents already compliant (no change):** 87

## Most common fix types

| Fix type | Count | What it fixes |
|----------|------:|---------------|
| Missing sections added (When to use / How you work / Coordination + Tier / Scope) | 19 | Prompt-standard body sections that were absent |
| Trigger rewrite (router-keyable "Use when …" description) | 16 | Frontmatter `description` lacked a clear WHEN-to-invoke |
| Dangling handoff fixed (numeric `#N` refs + non-existent agents → real names) | 9 | References that did not resolve to a real agent |
| Bloat trimmed (copy-paste code samples / duplicated prose removed) | 5 | Files padded with non-behavioral sample code |
| Fabrication removed / labelled unverified (banned HNSW & throughput figures, faster-than-light claims) | 5 | Unsupported or banned performance/marketing claims |

## Edited agents

| Agent | Fixes |
|-------|-------|
| `dual-mode/dual-orchestrator.md` | Added "When to use" section (had Routing Rules but no when-to-invoke note) |
| `v3/v3-integration-architect.md` | Dangling handoff: `v3-queen-coordinator` → `queen-coordinator`; rewrote numeric agent refs (Memory/Swarm/Performance specialists) to real names |
| `flow-nexus/app-store.md` | Trigger: multiline description rewritten to one-line router-keyable "Use when …" |
| `game-dev/build-release-engineer.md` | Dangling handoff: file-path ref `devops/ci-cd/ops-cicd-github` → real agent `cicd-engineer` |
| `v3/v3-memory-specialist.md` | Dangling handoffs: `v3-queen-coordinator` → `queen-coordinator`; numeric `#10/#5/#14` refs → `v3-integration-architect`, `system-architect`, `v3-performance-engineer` |
| `templates/implementer-sparc-coder.md` | Trigger: bare capability line rewritten to a router-keyable SPARC "Use during Refinement/Completion …" trigger |
| `v3/v3-performance-engineer.md` | Fabrication (critical): banned HNSW figures `[150, 12500]` replaced with measured `[1.9, 4.7]`; numeric agent refs → `v3-memory-specialist`, `v3-integration-architect`, `queen-coordinator`; `v3-queen-coordinator` → `queen-coordinator` |
| `architecture/system-design/arch-system-design.md` | Trigger: rewritten to lead with "Use when …"; added Coordination section (Tier 2, upstream/downstream handoffs) |
| `v3/v3-security-architect.md` | Dangling handoffs: `v3-queen-coordinator` → `queen-coordinator`; removed fabricated `Agent #3/#4` refs, retargeted to real `security-auditor`/`test-architect` |
| `flow-nexus-neural` | Trigger rewritten to "Use when …"; added "When to use" section |
| `mobile-dev` | Trigger rewritten; added "When to use"; added Coordination section (Tier + real handoffs frontend-specialist/tester/backend-dev) |
| `migration-planner` | Trigger rewritten (planning template, not runtime agent); added When to use / How you work / Coordination (Tier 3); bloat trimmed 737 → ~209 lines; `sparc-coordinator` → `sparc-coord` |
| `custom/test-long-runner.md` | Trigger rewritten to "Use when …"; added Coordination section (Tier 2 test fixture) |
| `sublinear/matrix-optimizer.md` | Dangling handoff: `consensus-coordinator` softened to "a swarm coordinator", real sibling names backticked; added Coordination section (Tier 2) |
| `sublinear/pagerank-analyzer.md` | Bloat trimmed 308 → 50 lines; trigger tightened; added When to use / How you work / Coordination (Tier) / Scope |
| `templates/performance-analyzer.md` | Dangling handoff: fixed self-referential "canonical agent `perf-analyzer`" claim; reworded vs `performance-benchmarker` |
| `flow-nexus/swarm.md` | Added "When to use"; added explicit Tier (Tier 1 coordinator); added "prefer instead" boundary line |
| `sublinear/performance-optimizer.md` | Bloat trimmed 384 → 81 lines (removed copy-paste JS/Python class samples); removed contentless integration paragraph |
| `templates/sparc-coordinator.md` | Trigger rewritten to "Use when …"; added "When to use"; fixed self-referential canonical-agent claim; added Tier 1 note |
| `documentation/api-docs/docs-api-openapi.md` | Trigger rewritten to "Use when …"; added "When to use" + Coordination (Tier 3); fixed `dev-backend-api` → real `backend-dev` |
| `sublinear/trading-predictor.md` | Fabrication (critical): removed banned faster-than-light / "execute trades before market data arrives" claims; added honest latency-arbitrage framing; reframed description and code comments |
| `flow-nexus/sandbox.md` (.claude/agents) | Trigger rewritten to lead with a clear "Use when …" clause (E2B environment lifecycle) |
| `github/repo-architect.md` (.claude/agents) | Added Coordination section (Tier 3) naming real handoffs multi-repo-swarm / sync-coordinator / release-manager |
| `python-specialist.md` (.claude/agents) | Added "Tier 3 — execution" to Coordination header; backticked real refs planner/tester/reviewer |
| `sublinear/performance-optimizer.md` (.claude/agents) | Trigger rewritten (sublinear variant "Use when bottleneck/resource-allocation … solvable linear system"); added Coordination (Tier 3) |
| `templates/orchestrator-task.md` (.claude/agents) | Trigger extended to say WHEN to use (break complex objective into subtasks); verified real refs |
| `dual-mode/codex-coordinator.md` | Trigger rewritten to router-keyable "Use when …"; bloat trimmed 219 → 98 lines (removed copy-paste code samples) |
| `dual-mode/codex-worker.md` | Trigger rewritten to lead with a "Use when …" trigger for dual-mode Codex worker |
| `neural/safla-neural.md` | Trigger rewritten to "Use when …"; labelled unverified "60% compression"/"172,000+ ops/sec"; added When to use + Coordination (Tier 3) |
| `sona/sona-learning-optimizer.md` | Trigger rewritten to "Use when …"; labelled unverified headline figures (+55% quality, 761 dec/sec, 99% param reduction, 10–100x, 60% cost); added When to use + Coordination (Tier 3) |

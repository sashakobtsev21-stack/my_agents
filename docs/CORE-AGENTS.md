# Core Agents — the curated entry point

> **Quality over quantity.** The full roster is **126 agents** ([AGENT-CATALOG.md](AGENT-CATALOG.md)),
> but most work needs ~20. This page is the curated short list to reach for first,
> plus an honest map of where the catalog overlaps and could be consolidated.
>
> **Nothing here is deleted.** Every agent still exists and resolves; this is a
> recommendation overlay + a safe consolidation roadmap, not a removal.

## The core ~20 (reach for these first)

| Area | Agent | Use it for |
|------|-------|------------|
| **Build** | `coder` | turn a design/spec/bug into tested code |
| | `system-architect` | component/interface/tech-stack design |
| | `planner` | decompose a complex goal into an ordered plan |
| | `researcher` | understand existing code/patterns before building |
| **Verify** | `reviewer` | correctness/security/perf review before merge |
| | `tester` | write + run tests against requirements |
| | `test-architect` | decide *what* to test and at which level |
| | `production-validator` | pre-deploy go/no-go (no surviving mocks) |
| **Security** | `security-auditor` | find/fix vulns, threat-model, CVE triage |
| | `dependency-auditor` | CVE triage by reachability, safe upgrades |
| **Specialists** | `backend-dev` | REST/GraphQL APIs (Controller-Service-Repository) |
| | `frontend-specialist` | accessible, performant, typed UI |
| | `database-specialist` | schema design, query tuning, migrations |
| | `typescript-specialist` / `python-specialist` | language-idiomatic work |
| **Performance** | `perf-analyzer` | find + resolve bottlenecks |
| **Ops** | `devops-engineer` | IaC, containers, deploys |
| | `cicd-engineer` | GitHub Actions pipelines |
| **Docs** | `api-docs` | OpenAPI/Swagger |
| **Coordination** | `hierarchical-coordinator` | anti-drift default for coding swarms |
| | `task-orchestrator` | decomposition + execution + synthesis |

For the two end-to-end flows, prefer the skills over hand-wiring agents:
**`/analyze-project`** (audit existing) and **`/new-project`** (build new) — both
already orchestrate the right specialists with a verify gate.

## Where the catalog overlaps (consolidation candidates)

These clusters carry real redundancy. Listed so a future cleanup can merge them
**deliberately** (each merge must update every `` `agent-name` `` reference and
pass `scripts/check-agents.mjs`):

| Cluster | Count | Keep (core) | Notes |
|---------|-------|-------------|-------|
| Coordinators / orchestrators | 17 | `hierarchical-coordinator`, `mesh-coordinator`, `task-orchestrator` | `adaptive-`, `queen-`, `collective-intelligence-`, `project-coordinator`, `coordinator-swarm-init`, `orchestrator-task`, `sparc-coordinator`, `sync-coordinator` overlap heavily |
| Consensus | 7 | keep as a **hive-mind pack** | `byzantine`/`raft`/`gossip`/`quorum`/`crdt`/`consensus-coordinator` — advanced, not core; surface only under hive-mind |
| Goal planners | 3 | `goal-planner` | `goal-planner-reasoning`, `sublinear-goal-planner`, `code-goal-planner` are near-duplicates |
| Backend | 2 | `backend-dev` | `backend-dev-basic` is the same minus ReasoningBank — fold into a flag |
| Optimization tier | 5 | `perf-analyzer` | `load-balancer`/`resource-allocator`/`performance-monitor`/`topology-optimizer` are swarm-internal; not user-facing core |
| `v3-*` project agents | 6 | — | `v3-queen-coordinator`, `v3-integration-architect`, `v3-memory-specialist`, `v3-performance-engineer`, `v3-security-architect` duplicate generic roles for this repo's own build; scope to internal use |

## Domain packs (opt-in, not core)

Powerful but only relevant to their domain — keep them, surface them on demand:

- **game-dev (15)** — a full game studio (`game-director`, `game-designer`,
  `3d-artist`, `gameplay-programmer`, `vfx-artist`, …). Irrelevant to non-game work.
- **github (13)** — PR/issue/release/board ops (`pr-manager`, `issue-tracker`, …).
- **flow-nexus (9)** — Flow Nexus cloud platform.
- **sublinear (5)** / **sona (1)** / **neural (1)** — research/algorithm agents.

## Why this matters

The toolkit's value is reliability, not headcount. A smaller, well-understood
core is easier to route to correctly and less confusing than 126 thinly-distinct
options. Treat this list as the default; drop into the long tail only when a core
agent doesn't fit.

# Core Agents — the curated entry point

> **Quality over quantity.** The full roster is **124 agents** ([AGENT-CATALOG.md](AGENT-CATALOG.md)),
> but most work needs ~20. This page is the curated short list to reach for first,
> tailored to the projects in use, plus an honest map of where the catalog still overlaps.
>
> **Recently cleaned up:** 3 cruft agents removed (`template-pr-manager` — a self-declared
> scaffold; `consensus-coordinator` and `v3-queen-coordinator` — empty descriptions). Everything
> else still exists and resolves; the rest of this page is a recommendation overlay, not a removal.

## The core ~25 (reach for these first)

| Area | Agent | Use it for |
|------|-------|------------|
| **Build** | `coder` | turn a design/spec/bug into tested code |
| | `system-architect` | component/interface/tech-stack design |
| | `planner` | decompose a complex goal into an ordered plan |
| | `researcher` | understand existing code/patterns before building |
| | `debugger` | reproduce + root-cause a bug before the fix *(new)* |
| **Verify** | `reviewer` | correctness/security/perf review before merge |
| | `tester` | write + run tests against requirements |
| | `test-architect` | decide *what* to test and at which level |
| | `production-validator` | pre-deploy go/no-go (no surviving mocks) |
| **Security** | `security-auditor` | find/fix vulns, threat-model, CVE triage |
| | `dependency-auditor` | CVE triage by reachability, safe upgrades |
| | `incident-responder` | triage/mitigate a production incident *(new)* |
| **Specialists** | `backend-dev` | REST/GraphQL APIs (Controller-Service-Repository) |
| | `frontend-specialist` | accessible, performant, typed UI |
| | `accessibility-specialist` | WCAG/keyboard/screen-reader a11y *(new)* |
| | `database-specialist` | schema design, query tuning, migrations |
| | `data-engineer` / `data-analyst` | pipelines vs. interpreting the data *(analyst new)* |
| | `typescript-specialist` / `python-specialist` | language-idiomatic work |
| **Performance** | `perf-analyzer` | find + resolve bottlenecks |
| **Ops** | `devops-engineer` | IaC, containers, deploys |
| | `cicd-engineer` | GitHub Actions pipelines |
| **Docs** | `technical-writer` | READMEs/guides/changelogs *(new)* · `api-docs` for OpenAPI |
| **Coordination** | `project-coordinator` | decompose goal, assign agents, synthesize |
| | `hierarchical-coordinator` | anti-drift default for coding swarms |
| | `pr-manager` / `release-manager` | PR lifecycle · release planning |

For the two end-to-end flows, prefer the skills over hand-wiring agents:
**`/analyze-project`** (audit existing) and **`/new-project`** (build new) — both
already orchestrate the right specialists with a verify gate.

## 🎯 Tailored to your projects

**🎮 Android game** — the game-dev pack is *first-class* for you (not opt-in):

| Role | Agents |
|------|--------|
| Direction & design | `game-director` · `game-designer` · `ui-ux-designer` |
| Engine & code | `unity-engine-architect` · `gameplay-programmer` · `physics-programmer` |
| Art & feel | `3d-artist` · `character-animator` · `rendering-engineer` · `vfx-artist` · `technical-artist` · `audio-designer` |
| Ship & QA | `mobile-performance-engineer` (frame/battery on real Android) · `build-release-engineer` (Gradle/AAB/Play Console) · `game-qa-engineer` |

**🕷️ Web scraping service** — lead with the dedicated `web-scraping-specialist`:

| Role | Agent / tool |
|------|--------------|
| **Extraction (lead)** | **`web-scraping-specialist`** *(new)* — selectors, rate-limit, proxy rotation, anti-bot, robots.txt/ToS hygiene |
| Actual browser work | the **`ruflo-browser`** plugin (Playwright — headless browser, page automation) |
| The service/API | `backend-dev` (canonical) |
| Store & shape data | `database-specialist` · `data-engineer` (ETL) · `data-analyst` (read it back) |
| Reliability (scrapers are flaky) | `debugger` · `incident-responder` · `observability-engineer` |
| Dashboard (if any) | `frontend-specialist` · `accessibility-specialist` |
| Deploy | `devops-engineer` · `cicd-engineer` |

## Where the catalog still overlaps (consolidation candidates)

Real redundancy that a future cleanup could merge **deliberately** (each merge must
update every `` `agent-name` `` reference and pass `scripts/check-agents.mjs`):

| Cluster | Keep (core) | Notes |
|---------|-------------|-------|
| Coordinators / orchestrators | `project-coordinator`, `hierarchical-coordinator`, `adaptive-coordinator`, `task-orchestrator` | `queen-coordinator`, `collective-intelligence-coordinator`, `sparc-coord`, `smart-agent`, `swarm-init`, `topology-optimizer` overlap |
| Goal planners (3) | `goal-planner` | `goal-planner-reasoning`, `sublinear-goal-planner` are near-duplicates |
| Backend (2) | `backend-dev` | `backend-dev-basic` is the same minus ReasoningBank |
| `v3-*` self-build agents | — | `v3-integration-architect`/`v3-memory-specialist`/`v3-performance-engineer`/`v3-security-architect` are for this repo's own build |

## ⚙️ Advanced — available, but you'll rarely need these

Kept for completeness (and the occasional hive-mind run), but **not relevant to an
Android game or a scraping service**. Ignore them day-to-day:

- **Consensus pack (7)** — `raft-manager`, `byzantine-coordinator`, `gossip-coordinator`,
  `quorum-manager`, `crdt-synchronizer`, `security-manager` … distributed-systems
  agreement. You don't need Byzantine fault tolerance to scrape websites.
- **sublinear (4)** / **optimization tier** (`load-balancer`, `resource-allocator`,
  `topology-optimizer`, `performance-monitor`) — swarm-internal math, not user-facing.
- **flow-nexus (9)** — only if you use the Flow Nexus cloud platform.
- **consensus/hive-mind coordinators** — surface only under an explicit hive-mind task.

## Why this matters

The toolkit's value is reliability, not headcount. A smaller, well-understood core is
easier to route to correctly and less confusing than 124 thinly-distinct options. Treat
the core + your tailored packs as the default; drop into the long tail only when nothing
in the core fits.

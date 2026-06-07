# 🧭 Каталог агентов — my_agents

> Авто-генерируется из `.claude/agents/**/*.md`. Не редактируй вручную — `node scripts/gen-agent-catalog.mjs`.
> Агентов: **121** · направлений: **28** · руководителей: **27** · модернизировано: **121/121**.

## Как выбрать агента

- **Сложная многошаговая задача?** Подключи **руководителя** (оркестратор/координатор) — он соберёт команду и раздаст работу.
- **Узкая задача?** Бери **специалиста** из направления.
- **Тиры:** 🟣 opus — сложное/архитектура/безопасность · 🔵 sonnet — основное · 🟢 haiku — простое.

---

## 🎖 Оркестраторы, координаторы и руководители

| Агент | Тир | Направление | Когда подключать |
|---|---|---|---|
| [`queen-coordinator`](../.claude/agents/hive-mind/queen-coordinator.md) | 🟣 opus | Hive-Mind | Sovereign hive orchestrator (Tier 0). Use as the top-level lead of a hive-mind run — owns the goal, picks the topology, allocates resources across agent classes, and keeps the hive coherent. Produces the authoritative strategic plan. |
| [`v3-queen-coordinator`](../.claude/agents/v3/v3-queen-coordinator.md) | 🟣 opus | V3 | V3 Queen Coordinator for 15-agent concurrent swarm orchestration, GitHub issue management, and cross-agent coordination. Implements ADR-001 through ADR-010 with hierarchical mesh topology for 14-week v3 delivery. |
| [`collective-intelligence-coordinator`](../.claude/agents/hive-mind/collective-intelligence-coordinator.md) | 🟣 opus | Hive-Mind | Collective-intelligence nexus (Tier 0). Use to orchestrate distributed cognition across the hive — aggregate decisions, synchronize shared knowledge, and balance cognitive load. Produces a coherent collective decision + synchronized knowledge graph. |
| [`project-coordinator`](../.claude/agents/project-coordinator.md) | 🔵 sonnet | Прочие | Coordinates multi-agent workflows — decomposes the goal, assigns named agents, sequences handoffs via SendMessage, and synthesizes results. Use as the lead for multi-step, multi-agent tasks. |
| [`dual-orchestrator`](../.claude/agents/dual-mode/dual-orchestrator.md) | 🟣 opus | Dual-Mode (Claude + Codex) | Orchestrates Claude Code (interactive) + Codex (headless) for hybrid workflows |
| [`task-orchestrator`](../.claude/agents/templates/orchestrator-task.md) | 🟢 haiku | Templates | Central coordination agent for task decomposition, execution planning, and result synthesis |
| [`sparc-coord`](../.claude/agents/templates/sparc-coordinator.md) | 🔵 sonnet | Templates | SPARC methodology orchestrator for systematic development phase coordination |
| [`adaptive-coordinator`](../.claude/agents/swarm/adaptive-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Adaptive topology coordinator. Use when the best swarm shape isn't known up front and should switch on live metrics — picks hierarchical/mesh/ring/hybrid, monitors performance, and migrates safely with rollback. Produces the active topology plus a migration plan. |
| [`hierarchical-coordinator`](../.claude/agents/swarm/hierarchical-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Hierarchical (queen-led) swarm coordinator. Use when a complex task needs central planning with one coordinator delegating to specialized workers — the anti-drift default for coding swarms. Produces a task tree, an agent-assignment map, and an integrated result. |
| [`mesh-coordinator`](../.claude/agents/swarm/mesh-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Peer-to-peer mesh swarm coordinator. Use when agents must collaborate as equals with no single point of failure — fault-tolerant, partition-resilient, distributed decision-making. Produces peer assignments and consensus decisions. |
| [`byzantine-coordinator`](../.claude/agents/consensus/byzantine-coordinator.md) | 🔵 sonnet | Consensus / распределённые | Byzantine fault-tolerant consensus coordinator. Use when nodes may be adversarial/compromised and you need agreement despite arbitrary faults (tolerates f < n/3). Produces a PBFT-committed value + malicious-actor report. |
| [`codex-coordinator`](../.claude/agents/dual-mode/codex-coordinator.md) | 🔵 sonnet | Dual-Mode (Claude + Codex) | Coordinates multiple headless Codex workers for parallel execution |
| [`consensus-coordinator`](../.claude/agents/sublinear/consensus-coordinator.md) | 🔵 sonnet | Sublinear | Distributed consensus agent that uses sublinear solvers for fast agreement protocols in multi-agent systems. Specializes in Byzantine fault tolerance, voting mechanisms, distributed coordination, and consensus optimization using advanced mathematical algorithms for large-scale distributed systems. |
| [`crdt-synchronizer`](../.claude/agents/consensus/crdt-synchronizer.md) | 🔵 sonnet | Consensus / распределённые | CRDT state-synchronization coordinator. Use when multiple writers (incl. offline) concurrently mutate shared state and it must converge automatically with no coordination. Produces a merged, conflict-free state. |
| [`gossip-coordinator`](../.claude/agents/consensus/gossip-coordinator.md) | 🔵 sonnet | Consensus / распределённые | Gossip/epidemic consensus coordinator. Use for large-scale, highly-available dissemination where eventual consistency beats strong agreement. Scales to many nodes with probabilistic guarantees. |
| [`memory-coordinator`](../.claude/agents/templates/memory-coordinator.md) | 🟢 haiku | Templates | Manage persistent memory across sessions and facilitate cross-agent memory sharing |
| [`performance-benchmarker`](../.claude/agents/consensus/performance-benchmarker.md) | 🔵 sonnet | Consensus / распределённые | Consensus benchmarking specialist. Use to measure and compare consensus protocols (throughput/latency/fault-tolerance) under your real workload so you can choose between them empirically. Not a consensus strategy itself. |
| [`pr-manager`](../.claude/agents/github/pr-manager.md) | 🔵 sonnet | GitHub | Pull-request lifecycle owner. Use to drive ONE PR end-to-end — create, metadata, reviewers, labels, CI/test reconciliation, conflict handling, and merge. The canonical owner of PR lifecycle. |
| [`quorum-manager`](../.claude/agents/consensus/quorum-manager.md) | 🔵 sonnet | Consensus / распределённые | Dynamic quorum & membership coordinator. Use when you want configurable read/write quorums to tune the consistency-vs-availability trade-off without committing to full Raft leadership. |
| [`raft-manager`](../.claude/agents/consensus/raft-manager.md) | 🔵 sonnet | Consensus / распределённые | Raft consensus coordinator. Use when nodes are trusted (crash-only faults) and you need a single authoritative leader with a linearizable replicated log. Tolerates f < n/2 crash faults. The hive-mind default. |
| [`release-manager`](../.claude/agents/github/release-manager.md) | 🔵 sonnet | GitHub | Release planner & coordinator. Use to PLAN one release — semver decision, changelog/release notes, cross-package version alignment, validation gates, and sequencing/rollback — culminating in the release PR/tag. |
| [`scout-explorer`](../.claude/agents/hive-mind/scout-explorer.md) | 🔵 sonnet | Hive-Mind | Reconnaissance specialist (Tier 3). Use to explore unknown territory — map a codebase/dependencies, scan the environment, surface threats and opportunities — and report intelligence to the hive. Gathers and reports only; never changes code. |
| [`security-manager`](../.claude/agents/consensus/security-manager.md) | 🔵 sonnet | Consensus / распределённые | Consensus security layer. Use to add cryptographic authentication, membership enforcement, and attack detection (Byzantine/Sybil/Eclipse/DoS) on top of a consensus strategy — not a standalone consensus. |
| [`swarm-memory-manager`](../.claude/agents/hive-mind/swarm-memory-manager.md) | 🟢 haiku | Hive-Mind | Hive memory/persistence layer (Tier 3). Use to manage distributed memory — consistency, persistence, fast retrieval, caching, and sync — the durable substrate every agent reads/writes. Mechanical and frequent. |
| [`sync-coordinator`](../.claude/agents/github/sync-coordinator.md) | 🔵 sonnet | GitHub | Multi-package alignment coordinator. Use for ongoing alignment between packages/repos — version harmonization, dependency resolution, doc/config sync — and the resulting sync PR. Keeps things consistent over time. |
| [`template-pr-manager`](../.claude/agents/templates/github-pr-manager.md) | 🔵 sonnet | Templates | Template/scaffold for a PR-lifecycle agent. Canonical runtime agent is pr-manager (github/pr-manager.md). |
| [`worker-specialist`](../.claude/agents/hive-mind/worker-specialist.md) | 🔵 sonnet | Hive-Mind | Hive task-execution specialist (execution layer). Use to carry out a concrete assigned task with precision, reporting progress before/during/after. Produces the completed work product, never strategy. |

---

## 👷 Специалисты по направлениям

### Game Dev (Unity / 3D mobile) (15)

| Агент | Тир | Описание |
|---|---|---|
| [`3d-artist`](../.claude/agents/game-dev/3d-artist.md) ✓ | 🔵 sonnet | 3D artist — models, sculpts, retopologizes, UVs, and PBR-textures game-ready assets (characters, props, environments) within mobile poly/texture budgets. Use to create the game's 3D content. |
| [`audio-designer`](../.claude/agents/game-dev/audio-designer.md) ✓ | 🔵 sonnet | Audio designer — SFX, adaptive music, mixing, and middleware (FMOD/Wwise or Unity audio) for immersive, responsive sound that fits the mobile memory/CPU budget. Use for all game audio. |
| [`build-release-engineer`](../.claude/agents/game-dev/build-release-engineer.md) ✓ | 🔵 sonnet | Build & release engineer — Unity build pipeline, Android (Gradle/AAB/Play Console) now and iOS (Xcode/Metal/App Store) later, CI automation, signing, and store submission. Use to ship the game to stores. |
| [`character-animator`](../.claude/agents/game-dev/character-animator.md) ✓ | 🔵 sonnet | Animation specialist — rigging, skinning, Mecanim animator controllers, blend trees, IK, and procedural animation for responsive, believable motion. Use for anything that moves and deforms. |
| [`game-designer`](../.claude/agents/game-dev/game-designer.md) ✓ | 🔵 sonnet | Gameplay systems & level designer — core loop, mechanics, progression, economy, balance, and level layouts. Use to design what the player does and how it stays fun and fair. |
| [`game-director`](../.claude/agents/game-dev/game-director.md) ✓ | 🟣 opus | Creative & technical director for the game — owns the vision, pillars, and Game Design Document, and keeps every discipline coherent. Use as the Tier-0 lead for the whole game project. |
| [`game-qa-engineer`](../.claude/agents/game-dev/game-qa-engineer.md) ✓ | 🔵 sonnet | Game QA engineer — playtesting, automated tests (Unity Test Framework), device-matrix coverage, and bug reproduction for a stable, fun, shippable build. Use to validate the game on real devices. |
| [`gameplay-programmer`](../.claude/agents/game-dev/gameplay-programmer.md) ✓ | 🔵 sonnet | Unity C# gameplay programmer — implements mechanics, player/camera control, game state, AI behaviors, and input from design specs. Use to build the playable systems in-engine. |
| [`mobile-performance-engineer`](../.claude/agents/game-dev/mobile-performance-engineer.md) ✓ | 🔵 sonnet | Mobile performance engineer — profiles and optimizes frame time, memory, battery, and thermals on real Android (then iOS) devices against the budget. Use to hit/keep frame rate and diagnose hitches. |
| [`physics-programmer`](../.claude/agents/game-dev/physics-programmer.md) ✓ | 🔵 sonnet | Physics & simulation specialist — character/vehicle/ragdoll physics, colliders, joints, and PhysX tuning for great-feeling, stable, performant motion on mobile. Use for anything physics-driven. |
| [`rendering-engineer`](../.claude/agents/game-dev/rendering-engineer.md) ✓ | 🔵 sonnet | Graphics/rendering engineer — URP setup, shaders, lighting, post-processing, and GPU performance for great-looking 3D that holds frame rate on mobile. Use for the visual pipeline and render perf. |
| [`technical-artist`](../.claude/agents/game-dev/technical-artist.md) ✓ | 🔵 sonnet | Technical artist — the bridge between art and engine. Owns look-dev, material/shader standards, the art pipeline, and asset optimization so art looks great and runs fast. Use for art-engine integration. |
| [`ui-ux-designer`](../.claude/agents/game-dev/ui-ux-designer.md) ✓ | 🔵 sonnet | Mobile UI/UX designer — touch controls, HUD, menus, and flows that are thumb-friendly, readable, and responsive across screen sizes. Use for all on-screen interface and player-facing UX. |
| [`unity-engine-architect`](../.claude/agents/game-dev/unity-engine-architect.md) ✓ | 🟣 opus | Unity engine & project architect — project structure, render pipeline choice, Addressables, assembly/build setup, performance budgets, and Android→iOS strategy. Use for engine-level architecture decisions. |
| [`vfx-artist`](../.claude/agents/game-dev/vfx-artist.md) ✓ | 🔵 sonnet | VFX artist — particle systems and effects (VFX Graph / Shuriken), effect shaders, and game-feel juice (impacts, trails, magic, weather) within the mobile overdraw budget. Use to make actions feel impactful. |

### GitHub (13)

| Агент | Тир | Описание |
|---|---|---|
| [`code-review-swarm`](../.claude/agents/github/code-review-swarm.md) ✓ | 🔵 sonnet | Parallel multi-agent deep code review. Use to run several specialist reviewers (security/performance/style/architecture/accessibility) over an existing PR's diff. Produces consolidated findings + an aggregate verdict. |
| [`github-modes`](../.claude/agents/github/github-modes.md) ✓ | 🔵 sonnet | GitHub request dispatcher. Use FIRST when it's unclear which github agent fits — routes a GitHub task to the right specialist (pr-manager, code-review-swarm, release-*, issue-tracker, …) with context. Produces a routing decision, not the end work. |
| [`issue-tracker`](../.claude/agents/github/issue-tracker.md) ✓ | 🟢 haiku | GitHub issue lifecycle manager. Use for issue CRUD, triage, labeling, milestones, and issue-to-issue linking + progress comments. Produces issues with correct metadata — not PRs or boards. |
| [`multi-repo-swarm`](../.claude/agents/github/multi-repo-swarm.md) ✓ | 🟣 opus | Cross-repository change orchestrator. Use to fan ONE change out across MANY repos (org-wide updates, shared-lib bumps, cross-service refactors) with cross-repo consistency guarantees. Produces per-repo PRs + a consistency verdict. |
| [`pr-manager`](../.claude/agents/github/pr-manager.md) 🎖 ✓ | 🔵 sonnet | Pull-request lifecycle owner. Use to drive ONE PR end-to-end — create, metadata, reviewers, labels, CI/test reconciliation, conflict handling, and merge. The canonical owner of PR lifecycle. |
| [`project-board-sync`](../.claude/agents/github/project-board-sync.md) ✓ | 🟢 haiku | GitHub Projects board keeper. Use to mirror issue/PR state onto a project board — move cards, update columns/custom fields, run board automation. Produces board state, not issues or PRs. |
| [`release-manager`](../.claude/agents/github/release-manager.md) 🎖 ✓ | 🔵 sonnet | Release planner & coordinator. Use to PLAN one release — semver decision, changelog/release notes, cross-package version alignment, validation gates, and sequencing/rollback — culminating in the release PR/tag. |
| [`release-swarm`](../.claude/agents/github/release-swarm.md) ✓ | 🔵 sonnet | Release execution swarm. Use to EXECUTE release tasks in parallel across targets (build, test, publish, deploy, monitor, rollback) under a release-manager plan. Produces built/published artifacts + per-target results. |
| [`repo-architect`](../.claude/agents/github/repo-architect.md) ✓ | 🟣 opus | Repository architecture designer. Use to DESIGN repo structure, standards, templates, and governance (greenfield setup or restructuring). Produces a blueprint + scaffolding, not a propagated content change. |
| [`swarm-issue`](../.claude/agents/github/swarm-issue.md) ✓ | 🔵 sonnet | Issue-to-swarm executor. Use to CONVERT a GitHub issue into executing work — auto-decompose into subtasks, assign agents, orchestrate, and report progress back on the issue until done. |
| [`swarm-pr`](../.claude/agents/github/swarm-pr.md) ✓ | 🔵 sonnet | Comment/label-driven PR swarm. Use only when you want swarm control of a PR directly from GitHub (/swarm comment commands, webhook-triggered PR swarms). For canonical PR lifecycle use pr-manager; for deep review use code-review-swarm. |
| [`sync-coordinator`](../.claude/agents/github/sync-coordinator.md) 🎖 ✓ | 🔵 sonnet | Multi-package alignment coordinator. Use for ongoing alignment between packages/repos — version harmonization, dependency resolution, doc/config sync — and the resulting sync PR. Keeps things consistent over time. |
| [`workflow-automation`](../.claude/agents/github/workflow-automation.md) ✓ | 🔵 sonnet | GitHub Actions author. Use to author/maintain CI/CD as code (Actions YAML) — pipelines, matrices, caching, self-healing, optimization. Produces workflow files, not PRs/releases/issues. |

### Прочие (9)

| Агент | Тир | Описание |
|---|---|---|
| [`base-template-generator`](../.claude/agents/base-template-generator.md) ✓ | 🟢 haiku | Use this agent when you need to create foundational templates, boilerplate code, or starter configurations for new projects, components, or features. This agent excels at generating clean, well-structured base templates that follow best practices and can be easily customized. Examples: <example>Context: User needs to start a new React component and wants a solid foundation. user: 'I need to create a new user profile component' assistant: 'I'll use the base-template-generator agent to create a comprehensive React component template with proper structure, TypeScript definitions, and styling setup.' <commentary>Since the user needs a foundational template for a new component, use the base-template-generator agent to create a well-structured starting point.</commentary></example> <example>Context: User is setting up a new API endpoint and needs a template. user: 'Can you help me set up a new REST API endpoint for user management?' assistant: 'I'll use the base-template-generator agent to create a complete API endpoint template with proper error handling, validation, and documentation structure.' <commentary>The user needs a foundational template for an API endpoint, so use the base-template-generator agent to provide a comprehensive starting point.</commentary></example> |
| [`database-specialist`](../.claude/agents/database-specialist.md) ✓ | 🔵 sonnet | Database design and optimization specialist — schema design, query tuning, indexing, migrations, data integrity. Use for data-model decisions, slow-query diagnosis, and migration safety. |
| [`dependency-auditor`](../.claude/agents/dependency-auditor.md) ✓ | 🔵 sonnet | Dependency & supply-chain specialist — CVE triage by reachability, lockfile/version hygiene, and safe upgrades. Use for npm-audit triage, dependency upgrades, and supply-chain risk review. |
| [`frontend-specialist`](../.claude/agents/frontend-specialist.md) ✓ | 🔵 sonnet | Web frontend specialist — accessible, performant, type-safe UI (React/Vue/Svelte). Use to build/review web components, fix UI bugs, and improve accessibility and client performance. |
| [`project-coordinator`](../.claude/agents/project-coordinator.md) 🎖 ✓ | 🔵 sonnet | Coordinates multi-agent workflows — decomposes the goal, assigns named agents, sequences handoffs via SendMessage, and synthesizes results. Use as the lead for multi-step, multi-agent tasks. |
| [`prompt-engineer`](../.claude/agents/prompt-engineer.md) ✓ | 🔵 sonnet | Prompt & agent-definition specialist — writes and optimizes agent prompts, tool descriptions, and instructions for clarity, correct routing, and cost. Use to improve this repo's agent/skill definitions or any LLM prompt. |
| [`python-specialist`](../.claude/agents/python-specialist.md) ✓ | 🔵 sonnet | Python development specialist — idiomatic, typed, tested Python. Use for writing/reviewing Python services, scripts, and packaging, with async, typing, and performance awareness. |
| [`security-auditor`](../.claude/agents/security-auditor.md) ✓ | 🔵 sonnet | Security audit and hardening specialist — finds and remediates vulnerabilities, validates inputs, reviews auth/crypto. Use for security reviews, threat modeling, and CVE triage. |
| [`typescript-specialist`](../.claude/agents/typescript-specialist.md) ✓ | 🔵 sonnet | TypeScript development specialist — strict typing, sound domain models, modern ESM. Use for writing/reviewing TS, fixing type errors, and designing type-safe APIs. |

### Flow-Nexus (облако) (9)

| Агент | Тир | Описание |
|---|---|---|
| [`flow-nexus-app-store`](../.claude/agents/flow-nexus/app-store.md) ✓ | 🟢 haiku | Application marketplace and template management specialist. Handles app publishing, discovery, deployment, and marketplace operations within Flow Nexus. |
| [`flow-nexus-auth`](../.claude/agents/flow-nexus/authentication.md) ✓ | 🔵 sonnet | Flow Nexus authentication and user management specialist. Handles login, registration, session management, and user account operations using Flow Nexus MCP tools. |
| [`flow-nexus-challenges`](../.claude/agents/flow-nexus/challenges.md) ✓ | 🟢 haiku | Coding challenges and gamification specialist. Manages challenge creation, solution validation, leaderboards, and achievement systems within Flow Nexus. |
| [`flow-nexus-neural`](../.claude/agents/flow-nexus/neural-network.md) ✓ | 🔵 sonnet | Neural network training and deployment specialist. Manages distributed neural network training, inference, and model lifecycle using Flow Nexus cloud infrastructure. |
| [`flow-nexus-payments`](../.claude/agents/flow-nexus/payments.md) ✓ | 🔵 sonnet | Credit management and billing specialist. Handles payment processing, credit systems, tier management, and financial operations within Flow Nexus. |
| [`flow-nexus-sandbox`](../.claude/agents/flow-nexus/sandbox.md) ✓ | 🔵 sonnet | E2B sandbox deployment and management specialist. Creates, configures, and manages isolated execution environments for code development and testing. |
| [`flow-nexus-swarm`](../.claude/agents/flow-nexus/swarm.md) ✓ | 🔵 sonnet | AI swarm orchestration and management specialist. Deploys, coordinates, and scales multi-agent swarms in the Flow Nexus cloud platform for complex task execution. |
| [`flow-nexus-user-tools`](../.claude/agents/flow-nexus/user-tools.md) ✓ | 🟢 haiku | User management and system utilities specialist. Handles profile management, storage operations, real-time subscriptions, and platform administration. |
| [`flow-nexus-workflow`](../.claude/agents/flow-nexus/workflow.md) ✓ | 🔵 sonnet | Event-driven workflow automation specialist. Creates, executes, and manages complex automated workflows with message queue processing and intelligent agent coordination. |

### Templates (9)

| Агент | Тир | Описание |
|---|---|---|
| [`memory-coordinator`](../.claude/agents/templates/memory-coordinator.md) 🎖 ✓ | 🟢 haiku | Manage persistent memory across sessions and facilitate cross-agent memory sharing |
| [`migration-planner`](../.claude/agents/templates/migration-plan.md) ✓ | 🔵 sonnet | Comprehensive migration plan for converting commands to agent-based system |
| [`perf-analyzer`](../.claude/agents/templates/performance-analyzer.md) ✓ | 🔵 sonnet | Performance bottleneck analyzer for identifying and resolving workflow inefficiencies |
| [`smart-agent`](../.claude/agents/templates/automation-smart-agent.md) ✓ | 🔵 sonnet | Intelligent agent coordination and dynamic spawning specialist |
| [`sparc-coder`](../.claude/agents/templates/implementer-sparc-coder.md) ✓ | 🔵 sonnet | Transform specifications into working code with TDD practices |
| [`sparc-coord`](../.claude/agents/templates/sparc-coordinator.md) 🎖 ✓ | 🔵 sonnet | SPARC methodology orchestrator for systematic development phase coordination |
| [`swarm-init`](../.claude/agents/templates/coordinator-swarm-init.md) ✓ | 🟢 haiku | Swarm initialization and topology optimization specialist |
| [`task-orchestrator`](../.claude/agents/templates/orchestrator-task.md) 🎖 ✓ | 🟢 haiku | Central coordination agent for task decomposition, execution planning, and result synthesis |
| [`template-pr-manager`](../.claude/agents/templates/github-pr-manager.md) 🎖 ✓ | 🔵 sonnet | Template/scaffold for a PR-lifecycle agent. Canonical runtime agent is pr-manager (github/pr-manager.md). |

### Consensus / распределённые (7)

| Агент | Тир | Описание |
|---|---|---|
| [`byzantine-coordinator`](../.claude/agents/consensus/byzantine-coordinator.md) 🎖 ✓ | 🔵 sonnet | Byzantine fault-tolerant consensus coordinator. Use when nodes may be adversarial/compromised and you need agreement despite arbitrary faults (tolerates f < n/3). Produces a PBFT-committed value + malicious-actor report. |
| [`crdt-synchronizer`](../.claude/agents/consensus/crdt-synchronizer.md) 🎖 ✓ | 🔵 sonnet | CRDT state-synchronization coordinator. Use when multiple writers (incl. offline) concurrently mutate shared state and it must converge automatically with no coordination. Produces a merged, conflict-free state. |
| [`gossip-coordinator`](../.claude/agents/consensus/gossip-coordinator.md) 🎖 ✓ | 🔵 sonnet | Gossip/epidemic consensus coordinator. Use for large-scale, highly-available dissemination where eventual consistency beats strong agreement. Scales to many nodes with probabilistic guarantees. |
| [`performance-benchmarker`](../.claude/agents/consensus/performance-benchmarker.md) 🎖 ✓ | 🔵 sonnet | Consensus benchmarking specialist. Use to measure and compare consensus protocols (throughput/latency/fault-tolerance) under your real workload so you can choose between them empirically. Not a consensus strategy itself. |
| [`quorum-manager`](../.claude/agents/consensus/quorum-manager.md) 🎖 ✓ | 🔵 sonnet | Dynamic quorum & membership coordinator. Use when you want configurable read/write quorums to tune the consistency-vs-availability trade-off without committing to full Raft leadership. |
| [`raft-manager`](../.claude/agents/consensus/raft-manager.md) 🎖 ✓ | 🔵 sonnet | Raft consensus coordinator. Use when nodes are trusted (crash-only faults) and you need a single authoritative leader with a linearizable replicated log. Tolerates f < n/2 crash faults. The hive-mind default. |
| [`security-manager`](../.claude/agents/consensus/security-manager.md) 🎖 ✓ | 🔵 sonnet | Consensus security layer. Use to add cryptographic authentication, membership enforcement, and attack detection (Byzantine/Sybil/Eclipse/DoS) on top of a consensus strategy — not a standalone consensus. |

### V3 (6)

| Агент | Тир | Описание |
|---|---|---|
| [`test-architect`](../.claude/agents/v3/test-architect.md) ✓ | 🔵 sonnet | Test strategy and quality-assurance architect — designs the test approach (what to test, at which level), not just individual tests. Use to plan coverage, choose test levels, and close gaps. |
| [`v3-integration-architect`](../.claude/agents/v3/v3-integration-architect.md) ✓ | 🟣 opus | V3 Integration Architect for deep agentic-flow@alpha integration. Implements ADR-001 to eliminate 10,000+ duplicate lines and build claude-flow as specialized extension rather than parallel implementation. |
| [`v3-memory-specialist`](../.claude/agents/v3/v3-memory-specialist.md) ✓ | 🔵 sonnet | V3 Memory Specialist for unifying 6+ memory systems into AgentDB with HNSW indexing. Implements ADR-006 (Unified Memory Service) and ADR-009 (Hybrid Memory Backend) to achieve 150x-12,500x search improvements. |
| [`v3-performance-engineer`](../.claude/agents/v3/v3-performance-engineer.md) ✓ | 🔵 sonnet | V3 Performance Engineer for achieving aggressive performance targets. Responsible for 2.49x-7.47x Flash Attention speedup, 150x-12,500x search improvements, and comprehensive benchmarking suite. |
| [`v3-queen-coordinator`](../.claude/agents/v3/v3-queen-coordinator.md) 🎖 ✓ | 🟣 opus | V3 Queen Coordinator for 15-agent concurrent swarm orchestration, GitHub issue management, and cross-agent coordination. Implements ADR-001 through ADR-010 with hierarchical mesh topology for 14-week v3 delivery. |
| [`v3-security-architect`](../.claude/agents/v3/v3-security-architect.md) ✓ | 🟣 opus | V3 Security Architect responsible for complete security overhaul, threat modeling, and CVE remediation planning. Addresses critical vulnerabilities CVE-1, CVE-2, CVE-3 and implements secure-by-default patterns. |

### Optimization / Performance (5)

| Агент | Тир | Описание |
|---|---|---|
| [`benchmark-suite`](../.claude/agents/optimization/benchmark-suite.md) ✓ | 🔵 sonnet | MEASURE tier. Use to run controlled benchmark/load/stress campaigns and produce baselines, regression verdicts, and pass/fail SLA validation. Quantifies performance — does not change the running system. |
| [`load-balancer`](../.claude/agents/optimization/load-balancer.md) ✓ | 🔵 sonnet | IMPROVE/DISTRIBUTE tier. Use to actively redistribute work across agents (work-stealing, migration, capability-based routing) to even out utilization in a running swarm. Acts in real time. |
| [`performance-monitor`](../.claude/agents/optimization/performance-monitor.md) ✓ | 🟢 haiku | OBSERVE tier. Use to continuously collect live metrics, detect bottlenecks/anomalies, and track SLA compliance for a running swarm. Watches and reports — never changes the system. The signal source for the other optimization agents. |
| [`resource-allocator`](../.claude/agents/optimization/resource-allocator.md) ✓ | 🔵 sonnet | ALLOCATE tier. Use to decide how much compute/memory each agent class gets and when to scale the swarm up/down based on predicted demand. Sizes the pool; load-balancer then distributes work within it. |
| [`topology-optimizer`](../.claude/agents/optimization/topology-optimizer.md) ✓ | 🔵 sonnet | OPTIMIZE-SHAPE tier. Use to tune the communication graph of an existing swarm (edges, fan-out, routing, agent placement) to cut latency and bottlenecks. Refines the shape; the Tier 1 coordinator owns switching topology mode. |

### Core (разработка) (5)

| Агент | Тир | Описание |
|---|---|---|
| [`coder`](../.claude/agents/core/coder.md) ✓ | 🔵 sonnet | Implementation specialist. Use when turning a design, spec, or ADR into production code, fixing a bug, or refactoring. Produces working, tested code with explicit verification notes. |
| [`planner`](../.claude/agents/core/planner.md) ✓ | 🔵 sonnet | Strategic planning agent. Use when a goal is complex enough to need decomposition into an ordered, dependency-aware plan before work starts. Produces a small executable plan with owners, dependencies, a critical path, and risks. |
| [`researcher`](../.claude/agents/core/researcher.md) ✓ | 🔵 sonnet | Codebase/topic investigation agent. Use when you need to understand existing code, patterns, or dependencies before designing or implementing. Produces evidence-backed findings with file:line citations. |
| [`reviewer`](../.claude/agents/core/reviewer.md) ✓ | 🔵 sonnet | Code review agent. Use when a diff/PR needs a correctness, security, performance, and maintainability check before merge. Produces a prioritized review ending in one explicit verdict. |
| [`tester`](../.claude/agents/core/tester.md) ✓ | 🔵 sonnet | Testing & QA agent. Use when an implementation needs tests written/run and validated against requirements and edge cases. Produces test files plus an honest run summary. |

### Hive-Mind (5)

| Агент | Тир | Описание |
|---|---|---|
| [`collective-intelligence-coordinator`](../.claude/agents/hive-mind/collective-intelligence-coordinator.md) 🎖 ✓ | 🟣 opus | Collective-intelligence nexus (Tier 0). Use to orchestrate distributed cognition across the hive — aggregate decisions, synchronize shared knowledge, and balance cognitive load. Produces a coherent collective decision + synchronized knowledge graph. |
| [`queen-coordinator`](../.claude/agents/hive-mind/queen-coordinator.md) 🎖 ✓ | 🟣 opus | Sovereign hive orchestrator (Tier 0). Use as the top-level lead of a hive-mind run — owns the goal, picks the topology, allocates resources across agent classes, and keeps the hive coherent. Produces the authoritative strategic plan. |
| [`scout-explorer`](../.claude/agents/hive-mind/scout-explorer.md) 🎖 ✓ | 🔵 sonnet | Reconnaissance specialist (Tier 3). Use to explore unknown territory — map a codebase/dependencies, scan the environment, surface threats and opportunities — and report intelligence to the hive. Gathers and reports only; never changes code. |
| [`swarm-memory-manager`](../.claude/agents/hive-mind/swarm-memory-manager.md) 🎖 ✓ | 🟢 haiku | Hive memory/persistence layer (Tier 3). Use to manage distributed memory — consistency, persistence, fast retrieval, caching, and sync — the durable substrate every agent reads/writes. Mechanical and frequent. |
| [`worker-specialist`](../.claude/agents/hive-mind/worker-specialist.md) 🎖 ✓ | 🔵 sonnet | Hive task-execution specialist (execution layer). Use to carry out a concrete assigned task with precision, reporting progress before/during/after. Produces the completed work product, never strategy. |

### Sublinear (5)

| Агент | Тир | Описание |
|---|---|---|
| [`consensus-coordinator`](../.claude/agents/sublinear/consensus-coordinator.md) 🎖 ✓ | 🔵 sonnet | Distributed consensus agent that uses sublinear solvers for fast agreement protocols in multi-agent systems. Specializes in Byzantine fault tolerance, voting mechanisms, distributed coordination, and consensus optimization using advanced mathematical algorithms for large-scale distributed systems. |
| [`matrix-optimizer`](../.claude/agents/sublinear/matrix-optimizer.md) ✓ | 🔵 sonnet | Expert agent for matrix analysis and optimization using sublinear algorithms. Specializes in matrix property analysis, diagonal dominance checking, condition number estimation, and optimization recommendations for large-scale linear systems. Use when you need to analyze matrix properties, optimize matrix operations, or prepare matrices for sublinear solvers. |
| [`pagerank-analyzer`](../.claude/agents/sublinear/pagerank-analyzer.md) ✓ | 🔵 sonnet | Expert agent for graph analysis and PageRank calculations using sublinear algorithms. Specializes in network optimization, influence analysis, swarm topology optimization, and large-scale graph computations. Use for social network analysis, web graph analysis, recommendation systems, and distributed system topology design. |
| [`performance-optimizer`](../.claude/agents/sublinear/performance-optimizer.md) ✓ | 🔵 sonnet | System performance optimization agent that identifies bottlenecks and optimizes resource allocation using sublinear algorithms. Specializes in computational performance analysis, system optimization, resource management, and efficiency maximization across distributed systems and cloud infrastructure. |
| [`trading-predictor`](../.claude/agents/sublinear/trading-predictor.md) ✓ | 🔵 sonnet | Advanced financial trading agent that leverages temporal advantage calculations to predict and execute trades before market data arrives. Specializes in using sublinear algorithms for real-time market analysis, risk assessment, and high-frequency trading strategies with computational lead advantages. |

### SPARC (4)

| Агент | Тир | Описание |
|---|---|---|
| [`architecture`](../.claude/agents/sparc/architecture.md) ✓ | 🟣 opus | SPARC Architecture phase. Use after Pseudocode to design the system — components, interfaces/contracts, tech-stack choices (as ADRs), scalability/security. Produces the binding design package for implementation. |
| [`pseudocode`](../.claude/agents/sparc/pseudocode.md) ✓ | 🔵 sonnet | SPARC Pseudocode phase. Use after Specification to translate requirements into language-agnostic algorithms, data structures, and complexity analysis. Produces the implementation roadmap (docs/pseudocode/*.md). |
| [`refinement`](../.claude/agents/sparc/refinement.md) ✓ | 🔵 sonnet | SPARC Refinement phase. Use after Architecture to turn the design into production-ready code via TDD, optimization, refactoring, and hardening. Produces tested, optimized implementation with green tests. |
| [`specification`](../.claude/agents/sparc/specification.md) ✓ | 🔵 sonnet | SPARC Specification phase. Use first in a SPARC run to turn a goal into a complete, testable requirements spec (functional + non-functional, constraints, acceptance criteria). Produces docs/SPEC.md — the "what to build" contract. |

### Swarm (топологии) (3)

| Агент | Тир | Описание |
|---|---|---|
| [`adaptive-coordinator`](../.claude/agents/swarm/adaptive-coordinator.md) 🎖 ✓ | 🔵 sonnet | Adaptive topology coordinator. Use when the best swarm shape isn't known up front and should switch on live metrics — picks hierarchical/mesh/ring/hybrid, monitors performance, and migrates safely with rollback. Produces the active topology plus a migration plan. |
| [`hierarchical-coordinator`](../.claude/agents/swarm/hierarchical-coordinator.md) 🎖 ✓ | 🔵 sonnet | Hierarchical (queen-led) swarm coordinator. Use when a complex task needs central planning with one coordinator delegating to specialized workers — the anti-drift default for coding swarms. Produces a task tree, an agent-assignment map, and an integrated result. |
| [`mesh-coordinator`](../.claude/agents/swarm/mesh-coordinator.md) 🎖 ✓ | 🔵 sonnet | Peer-to-peer mesh swarm coordinator. Use when agents must collaborate as equals with no single point of failure — fault-tolerant, partition-resilient, distributed decision-making. Produces peer assignments and consensus decisions. |

### Development (3)

| Агент | Тир | Описание |
|---|---|---|
| [`backend-dev`](../.claude/agents/development/dev-backend-api.md) ✓ | 🔵 sonnet | Backend API developer (self-learning). Use to build/review REST or GraphQL APIs with the Controller-Service-Repository pattern, validation, authz, and tests. The canonical backend agent; persists successful patterns to ReasoningBank. |
| [`backend-dev-basic`](../.claude/agents/development/backend/dev-backend-api.md) ✓ | 🔵 sonnet | Baseline backend API developer (REST/GraphQL). Leaner variant of backend-dev without ReasoningBank pattern persistence. Use when you want the baseline without self-learning overhead. |
| [`migration-engineer`](../.claude/agents/development/migration-engineer.md) ✓ | 🔵 sonnet | Migration specialist — version upgrades, schema/data migrations, and breaking-change rollouts with safe, reversible, incremental steps. Use to plan/execute v2→v3-style migrations or risky cutovers. |

### DevOps (3)

| Агент | Тир | Описание |
|---|---|---|
| [`cicd-engineer`](../.claude/agents/devops/ci-cd/ops-cicd-github.md) ✓ | 🔵 sonnet | GitHub Actions CI/CD specialist. Use to create/optimize build-test-deploy pipelines as Actions YAML — job matrices, caching, scoped tokens, secrets, reusable actions. Produces workflow files. |
| [`devops-engineer`](../.claude/agents/devops/devops-engineer.md) ✓ | 🔵 sonnet | DevOps / infrastructure specialist — IaC (Terraform/Pulumi), containers, Kubernetes, and deployment pipelines. Use to provision infra, write/review IaC, containerize, and design safe deploys. |
| [`observability-engineer`](../.claude/agents/devops/observability-engineer.md) ✓ | 🔵 sonnet | Observability specialist — logging, distributed tracing, metrics, dashboards, and alerting. Use to instrument code, diagnose production issues from telemetry, or design SLO-based alerts. |

### Goal / GOAP (3)

| Агент | Тир | Описание |
|---|---|---|
| [`code-goal-planner`](../.claude/agents/goal/code-goal-planner.md) ✓ | 🔵 sonnet | Code-centric Goal-Oriented Action Planning specialist that creates intelligent plans for software development objectives. Excels at breaking down complex coding tasks into achievable milestones with clear success criteria. Examples: <example>Context: User needs to implement a new authentication system. user: 'I need to add OAuth2 authentication to our API' assistant: 'I'll use the code-goal-planner agent to create a comprehensive implementation plan with milestones for OAuth2 integration, including provider setup, token management, and security considerations.' <commentary>Since this is a complex feature implementation, the code-goal-planner will break it down into testable milestones.</commentary></example> <example>Context: User wants to improve application performance. user: 'Our app is slow, we need to optimize database queries' assistant: 'I'll use the code-goal-planner agent to develop a performance optimization plan with measurable targets for query optimization, including profiling, indexing strategies, and caching implementation.' <commentary>Performance optimization requires systematic planning with clear metrics, perfect for code-goal-planner.</commentary></example> |
| [`goal-planner`](../.claude/agents/goal/goal-planner.md) ✓ | 🔵 sonnet | Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives. Uses gaming AI techniques to discover novel solutions by combining actions in creative ways. Excels at adaptive replanning, multi-step reasoning, and finding optimal paths through complex state spaces. Examples: <example>Context: User needs to optimize a complex workflow with many dependencies. user: 'I need to deploy this application but there are many prerequisites and dependencies' assistant: 'I'll use the goal-planner agent to analyze all requirements and create an optimal action sequence that satisfies all preconditions and achieves your deployment goal.' <commentary>Complex multi-step planning with dependencies requires the goal-planner agent's GOAP algorithm to find the optimal path.</commentary></example> <example>Context: User has a high-level goal but isn't sure of the steps. user: 'Make my application production-ready' assistant: 'I'll use the goal-planner agent to break down this goal into concrete actions, analyze preconditions, and create an adaptive plan that achieves production readiness.' <commentary>High-level goals that need intelligent decomposition and planning benefit from the goal-planner agent's capabilities.</commentary></example> |
| [`sublinear-goal-planner`](../.claude/agents/goal/agent.md) ✓ | 🔵 sonnet | Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives. Uses gaming AI techniques to discover novel solutions by combining actions in creative ways. Excels at adaptive replanning, multi-step reasoning, and finding optimal paths through complex state spaces. |

### Dual-Mode (Claude + Codex) (3)

| Агент | Тир | Описание |
|---|---|---|
| [`codex-coordinator`](../.claude/agents/dual-mode/codex-coordinator.md) 🎖 ✓ | 🔵 sonnet | Coordinates multiple headless Codex workers for parallel execution |
| [`codex-worker`](../.claude/agents/dual-mode/codex-worker.md) ✓ | 🔵 sonnet | Headless Codex background worker for parallel task execution with self-learning |
| [`dual-orchestrator`](../.claude/agents/dual-mode/dual-orchestrator.md) 🎖 ✓ | 🟣 opus | Orchestrates Claude Code (interactive) + Codex (headless) for hybrid workflows |

### Analysis (2)

| Агент | Тир | Описание |
|---|---|---|
| [`analyst`](../.claude/agents/analysis/code-analyzer.md) ✓ | 🔵 sonnet | Structural code analyst (heavier lane). Use for module dependency mapping, circular-dependency detection, architectural-consistency review, and quality-trend tracking over time. Produces structural analysis + actionable insights. |
| [`code-analyzer`](../.claude/agents/analysis/analyze-code-quality.md) ✓ | 🔵 sonnet | Code quality reviewer (metrics lane). Use for readability, maintainability, complexity thresholds, coding-standard adherence, and surface smell detection. Produces a quality report — review feedback, not refactored code. |

### Data (2)

| Агент | Тир | Описание |
|---|---|---|
| [`data-engineer`](../.claude/agents/data/data-engineer.md) ✓ | 🔵 sonnet | Data engineering specialist — ETL/ELT pipelines, ingestion, transformation, and data quality/validation. Use to build/review data pipelines, schemas-in-motion, and batch/stream processing. |
| [`ml-developer`](../.claude/agents/data/ml/data-ml-model.md) ✓ | 🔵 sonnet | Machine-learning developer — end-to-end ML workflows: feature engineering, training, tuning, evaluation, and deployment scaffolding. Use to build/train/evaluate a model or stand up serving + monitoring. |

### Testing (2)

| Агент | Тир | Описание |
|---|---|---|
| [`production-validator`](../.claude/agents/testing/production-validator.md) ✓ | 🔵 sonnet | Pre-production readiness gate. Use last, before deploy, to verify a built system is REAL and deployment-ready — no surviving mocks/stubs, integration tests against real services, performance under load. Produces a go/no-go verdict. |
| [`tdd-london-swarm`](../.claude/agents/testing/tdd-london-swarm.md) ✓ | 🔵 sonnet | TDD London-School (mockist) specialist. Use up front to drive NEW code's design outside-in via mock expectations and collaborator contracts, within a swarm. Produces failing-then-passing tests + contracts, not production code. |

### Payments (1)

| Агент | Тир | Описание |
|---|---|---|
| [`agentic-payments`](../.claude/agents/payments/agentic-payments.md) ✓ | 🔵 sonnet | Multi-agent payment authorization specialist for autonomous AI commerce with cryptographic verification and Byzantine consensus |

### Documentation (1)

| Агент | Тир | Описание |
|---|---|---|
| [`api-docs`](../.claude/agents/documentation/api-docs/docs-api-openapi.md) ✓ | 🔵 sonnet | Expert agent for creating and maintaining OpenAPI/Swagger documentation |

### Reasoning (1)

| Агент | Тир | Описание |
|---|---|---|
| [`goal-planner-reasoning`](../.claude/agents/reasoning/goal-planner.md) ✓ | 🔵 sonnet | Reasoning-domain GOAP (Goal-Oriented Action Planning) variant focused on adaptive replanning and multi-step reasoning via MCP integration. Leaner reasoning-side counterpart to the canonical goal-planner. Discovers novel solutions by combining actions and finding optimal paths through complex state spaces. |

### Specialized (1)

| Агент | Тир | Описание |
|---|---|---|
| [`mobile-dev`](../.claude/agents/specialized/mobile/spec-mobile-react-native.md) ✓ | 🔵 sonnet | Expert agent for React Native mobile application development across iOS and Android |

### Neural (1)

| Агент | Тир | Описание |
|---|---|---|
| [`safla-neural`](../.claude/agents/neural/safla-neural.md) ✓ | 🔵 sonnet | Self-Aware Feedback Loop Algorithm (SAFLA) neural specialist that creates intelligent, memory-persistent AI systems with self-learning capabilities. Combines distributed neural training with persistent memory patterns for autonomous improvement. Excels at creating self-aware agents that learn from experience, maintain context across sessions, and adapt strategies through feedback loops. |

### SONA (1)

| Агент | Тир | Описание |
|---|---|---|
| [`sona-learning-optimizer`](../.claude/agents/sona/sona-learning-optimizer.md) ✓ | 🔵 sonnet | SONA-powered self-optimizing agent with LoRA fine-tuning and EWC++ memory preservation |

### Architecture (1)

| Агент | Тир | Описание |
|---|---|---|
| [`system-architect`](../.claude/agents/architecture/system-design/arch-system-design.md) ✓ | 🟣 opus | Expert agent for system architecture design, patterns, and high-level technical decisions |

### Custom (1)

| Агент | Тир | Описание |
|---|---|---|
| [`test-long-runner`](../.claude/agents/custom/test-long-runner.md) ✓ | 🟢 haiku | Test agent that can run for 30+ minutes on complex tasks |

---

_🎖 = руководитель · ✓ = промпт модернизирован. Каталог покрывает `.claude/agents/`; плагины несут собственных агентов в `plugins/*/agents/`._

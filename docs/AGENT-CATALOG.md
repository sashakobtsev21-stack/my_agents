# 🧭 Каталог агентов — my_agents

> Авто-генерируется из `.claude/agents/**/*.md`. Не редактируй вручную — запусти `node scripts/gen-agent-catalog.mjs`.
> Всего агентов: **121** в **28** направлениях · из них руководителей: **28**.

## Как выбрать агента

- **Сложная задача из нескольких шагов?** Подключи **руководителя** (оркестратор/координатор) из таблицы ниже — он соберёт команду и раздаст работу.
- **Узкая конкретная задача?** Бери **специалиста** из нужного направления.
- **Тиры модели:** 🟣 opus — сложное рассуждение/архитектура/безопасность · 🔵 sonnet — основная работа · 🟢 haiku — простое/механическое.

---

## 🎖 Оркестраторы, координаторы и руководители

Эти агенты управляют другими — координируют swarm, держат консенсус, ведут пайплайны.

| Агент | Тир | Направление | Когда подключать |
|---|---|---|---|
| [`queen-coordinator`](../.claude/agents/hive-mind/queen-coordinator.md) | 🟣 opus | Hive-Mind | The sovereign orchestrator of hierarchical hive operations, managing strategic decisions, resource allocation, and maintaining hive coherence through centralized-decentralized hybrid control |
| [`v3-queen-coordinator`](../.claude/agents/v3/v3-queen-coordinator.md) | 🟣 opus | V3 | V3 Queen Coordinator for 15-agent concurrent swarm orchestration, GitHub issue management, and cross-agent coordination. Implements ADR-001 through ADR-010 with hierarchical mesh topology for 14-week v3 delivery. |
| [`collective-intelligence-coordinator`](../.claude/agents/hive-mind/collective-intelligence-coordinator.md) | 🟣 opus | Hive-Mind | Orchestrates distributed cognitive processes across the hive mind, ensuring coherent collective decision-making through memory synchronization and consensus protocols |
| [`project-coordinator`](../.claude/agents/project-coordinator.md) | 🔵 sonnet | Прочие | Coordinates multi-agent workflows — decomposes the goal, assigns named agents, sequences handoffs via SendMessage, and synthesizes results. Use as the lead for multi-step, multi-agent tasks. |
| [`dual-orchestrator`](../.claude/agents/dual-mode/dual-orchestrator.md) | 🟣 opus | Dual-Mode (Claude + Codex) | Orchestrates Claude Code (interactive) + Codex (headless) for hybrid workflows |
| [`task-orchestrator`](../.claude/agents/templates/orchestrator-task.md) | 🟢 haiku | Templates | Central coordination agent for task decomposition, execution planning, and result synthesis |
| [`sparc-coord`](../.claude/agents/templates/sparc-coordinator.md) | 🔵 sonnet | Templates | SPARC methodology orchestrator for systematic development phase coordination |
| [`adaptive-coordinator`](../.claude/agents/swarm/adaptive-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Dynamic topology switching coordinator with self-organizing swarm patterns and real-time optimization |
| [`hierarchical-coordinator`](../.claude/agents/swarm/hierarchical-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Queen-led hierarchical swarm coordination with specialized worker delegation |
| [`mesh-coordinator`](../.claude/agents/swarm/mesh-coordinator.md) | 🔵 sonnet | Swarm (топологии) | Peer-to-peer mesh network swarm with distributed decision making and fault tolerance |
| [`byzantine-coordinator`](../.claude/agents/consensus/byzantine-coordinator.md) | 🔵 sonnet | Consensus / распределённые | Coordinates Byzantine fault-tolerant consensus protocols with malicious actor detection |
| [`codex-coordinator`](../.claude/agents/dual-mode/codex-coordinator.md) | 🔵 sonnet | Dual-Mode (Claude + Codex) | Coordinates multiple headless Codex workers for parallel execution |
| [`consensus-coordinator`](../.claude/agents/sublinear/consensus-coordinator.md) | 🔵 sonnet | Sublinear | Distributed consensus agent that uses sublinear solvers for fast agreement protocols in multi-agent systems. Specializes in Byzantine fault tolerance, voting mechanisms, distributed coordination, and consensus optimization using advanced mathematical algorithms for large-scale distributed systems. |
| [`crdt-synchronizer`](../.claude/agents/consensus/crdt-synchronizer.md) | 🔵 sonnet | Consensus / распределённые | Implements Conflict-free Replicated Data Types for eventually consistent state synchronization |
| [`gossip-coordinator`](../.claude/agents/consensus/gossip-coordinator.md) | 🔵 sonnet | Consensus / распределённые | Coordinates gossip-based consensus protocols for scalable eventually consistent systems |
| [`Load Balancing Coordinator`](../.claude/agents/optimization/load-balancer.md) | 🔵 sonnet | Optimization / Performance | Dynamic task distribution, work-stealing algorithms and adaptive load balancing |
| [`memory-coordinator`](../.claude/agents/templates/memory-coordinator.md) | 🟢 haiku | Templates | Manage persistent memory across sessions and facilitate cross-agent memory sharing |
| [`performance-benchmarker`](../.claude/agents/consensus/performance-benchmarker.md) | 🔵 sonnet | Consensus / распределённые | Implements comprehensive performance benchmarking for distributed consensus protocols |
| [`pr-manager`](../.claude/agents/github/pr-manager.md) | 🔵 sonnet | GitHub | Comprehensive pull request management with swarm coordination for automated reviews, testing, and merge workflows |
| [`quorum-manager`](../.claude/agents/consensus/quorum-manager.md) | 🔵 sonnet | Consensus / распределённые | Implements dynamic quorum adjustment and intelligent membership management |
| [`raft-manager`](../.claude/agents/consensus/raft-manager.md) | 🔵 sonnet | Consensus / распределённые | Manages Raft consensus algorithm with leader election and log replication |
| [`release-manager`](../.claude/agents/github/release-manager.md) | 🔵 sonnet | GitHub | Automated release coordination and deployment with ruv-swarm orchestration for seamless version management, testing, and deployment across multiple packages |
| [`scout-explorer`](../.claude/agents/hive-mind/scout-explorer.md) | 🔵 sonnet | Hive-Mind | Information reconnaissance specialist that explores unknown territories, gathers intelligence, and reports findings to the hive mind through continuous memory updates |
| [`security-manager`](../.claude/agents/consensus/security-manager.md) | 🔵 sonnet | Consensus / распределённые | Implements comprehensive security mechanisms for distributed consensus protocols |
| [`swarm-memory-manager`](../.claude/agents/hive-mind/swarm-memory-manager.md) | 🟢 haiku | Hive-Mind | Manages distributed memory across the hive mind, ensuring data consistency, persistence, and efficient retrieval through advanced caching and synchronization protocols |
| [`sync-coordinator`](../.claude/agents/github/sync-coordinator.md) | 🔵 sonnet | GitHub | Multi-repository synchronization coordinator that manages version alignment, dependency synchronization, and cross-package integration with intelligent swarm orchestration |
| [`template-pr-manager`](../.claude/agents/templates/github-pr-manager.md) | 🔵 sonnet | Templates | Template/scaffold for a PR-lifecycle agent. Canonical runtime agent is pr-manager (github/pr-manager.md). |
| [`worker-specialist`](../.claude/agents/hive-mind/worker-specialist.md) | 🔵 sonnet | Hive-Mind | Dedicated task execution specialist that carries out assigned work with precision, continuously reporting progress through memory coordination |

---

## 👷 Специалисты по направлениям

### Game Dev (Unity / 3D mobile) (15)

| Агент | Тир | Описание |
|---|---|---|
| [`3d-artist`](../.claude/agents/game-dev/3d-artist.md) | 🔵 sonnet | 3D artist — models, sculpts, retopologizes, UVs, and PBR-textures game-ready assets (characters, props, environments) within mobile poly/texture budgets. Use to create the game's 3D content. |
| [`audio-designer`](../.claude/agents/game-dev/audio-designer.md) | 🔵 sonnet | Audio designer — SFX, adaptive music, mixing, and middleware (FMOD/Wwise or Unity audio) for immersive, responsive sound that fits the mobile memory/CPU budget. Use for all game audio. |
| [`build-release-engineer`](../.claude/agents/game-dev/build-release-engineer.md) | 🔵 sonnet | Build & release engineer — Unity build pipeline, Android (Gradle/AAB/Play Console) now and iOS (Xcode/Metal/App Store) later, CI automation, signing, and store submission. Use to ship the game to stores. |
| [`character-animator`](../.claude/agents/game-dev/character-animator.md) | 🔵 sonnet | Animation specialist — rigging, skinning, Mecanim animator controllers, blend trees, IK, and procedural animation for responsive, believable motion. Use for anything that moves and deforms. |
| [`game-designer`](../.claude/agents/game-dev/game-designer.md) | 🔵 sonnet | Gameplay systems & level designer — core loop, mechanics, progression, economy, balance, and level layouts. Use to design what the player does and how it stays fun and fair. |
| [`game-director`](../.claude/agents/game-dev/game-director.md) | 🟣 opus | Creative & technical director for the game — owns the vision, pillars, and Game Design Document, and keeps every discipline coherent. Use as the Tier-0 lead for the whole game project. |
| [`game-qa-engineer`](../.claude/agents/game-dev/game-qa-engineer.md) | 🔵 sonnet | Game QA engineer — playtesting, automated tests (Unity Test Framework), device-matrix coverage, and bug reproduction for a stable, fun, shippable build. Use to validate the game on real devices. |
| [`gameplay-programmer`](../.claude/agents/game-dev/gameplay-programmer.md) | 🔵 sonnet | Unity C# gameplay programmer — implements mechanics, player/camera control, game state, AI behaviors, and input from design specs. Use to build the playable systems in-engine. |
| [`mobile-performance-engineer`](../.claude/agents/game-dev/mobile-performance-engineer.md) | 🔵 sonnet | Mobile performance engineer — profiles and optimizes frame time, memory, battery, and thermals on real Android (then iOS) devices against the budget. Use to hit/keep frame rate and diagnose hitches. |
| [`physics-programmer`](../.claude/agents/game-dev/physics-programmer.md) | 🔵 sonnet | Physics & simulation specialist — character/vehicle/ragdoll physics, colliders, joints, and PhysX tuning for great-feeling, stable, performant motion on mobile. Use for anything physics-driven. |
| [`rendering-engineer`](../.claude/agents/game-dev/rendering-engineer.md) | 🔵 sonnet | Graphics/rendering engineer — URP setup, shaders, lighting, post-processing, and GPU performance for great-looking 3D that holds frame rate on mobile. Use for the visual pipeline and render perf. |
| [`technical-artist`](../.claude/agents/game-dev/technical-artist.md) | 🔵 sonnet | Technical artist — the bridge between art and engine. Owns look-dev, material/shader standards, the art pipeline, and asset optimization so art looks great and runs fast. Use for art-engine integration. |
| [`ui-ux-designer`](../.claude/agents/game-dev/ui-ux-designer.md) | 🔵 sonnet | Mobile UI/UX designer — touch controls, HUD, menus, and flows that are thumb-friendly, readable, and responsive across screen sizes. Use for all on-screen interface and player-facing UX. |
| [`unity-engine-architect`](../.claude/agents/game-dev/unity-engine-architect.md) | 🟣 opus | Unity engine & project architect — project structure, render pipeline choice, Addressables, assembly/build setup, performance budgets, and Android→iOS strategy. Use for engine-level architecture decisions. |
| [`vfx-artist`](../.claude/agents/game-dev/vfx-artist.md) | 🔵 sonnet | VFX artist — particle systems and effects (VFX Graph / Shuriken), effect shaders, and game-feel juice (impacts, trails, magic, weather) within the mobile overdraw budget. Use to make actions feel impactful. |

### GitHub (13)

| Агент | Тир | Описание |
|---|---|---|
| [`code-review-swarm`](../.claude/agents/github/code-review-swarm.md) | 🔵 sonnet | Deploy specialized AI agents to perform comprehensive, intelligent code reviews that go beyond traditional static analysis |
| [`github-modes`](../.claude/agents/github/github-modes.md) | 🔵 sonnet | Comprehensive GitHub integration modes for workflow orchestration, PR management, and repository coordination with batch optimization |
| [`issue-tracker`](../.claude/agents/github/issue-tracker.md) | 🟢 haiku | Intelligent issue management and project coordination with automated tracking, progress monitoring, and team coordination |
| [`multi-repo-swarm`](../.claude/agents/github/multi-repo-swarm.md) | 🟣 opus | Cross-repository swarm orchestration for organization-wide automation and intelligent collaboration |
| [`pr-manager`](../.claude/agents/github/pr-manager.md) 🎖 | 🔵 sonnet | Comprehensive pull request management with swarm coordination for automated reviews, testing, and merge workflows |
| [`project-board-sync`](../.claude/agents/github/project-board-sync.md) | 🟢 haiku | Synchronize AI swarms with GitHub Projects for visual task management, progress tracking, and team coordination |
| [`release-manager`](../.claude/agents/github/release-manager.md) 🎖 | 🔵 sonnet | Automated release coordination and deployment with ruv-swarm orchestration for seamless version management, testing, and deployment across multiple packages |
| [`release-swarm`](../.claude/agents/github/release-swarm.md) | 🔵 sonnet | Orchestrate complex software releases using AI swarms that handle everything from changelog generation to multi-platform deployment |
| [`repo-architect`](../.claude/agents/github/repo-architect.md) | 🟣 opus | Repository structure optimization and multi-repo management with ruv-swarm coordination for scalable project architecture and development workflows |
| [`swarm-issue`](../.claude/agents/github/swarm-issue.md) | 🔵 sonnet | GitHub issue-based swarm coordination agent that transforms issues into intelligent multi-agent tasks with automatic decomposition and progress tracking |
| [`swarm-pr`](../.claude/agents/github/swarm-pr.md) | 🔵 sonnet | Pull request swarm management agent that coordinates multi-agent code review, validation, and integration workflows with automated PR lifecycle management |
| [`sync-coordinator`](../.claude/agents/github/sync-coordinator.md) 🎖 | 🔵 sonnet | Multi-repository synchronization coordinator that manages version alignment, dependency synchronization, and cross-package integration with intelligent swarm orchestration |
| [`workflow-automation`](../.claude/agents/github/workflow-automation.md) | 🔵 sonnet | GitHub Actions workflow automation agent that creates intelligent, self-organizing CI/CD pipelines with adaptive multi-agent coordination and automated optimization |

### Прочие (9)

| Агент | Тир | Описание |
|---|---|---|
| [`base-template-generator`](../.claude/agents/base-template-generator.md) | 🟢 haiku | Use this agent when you need to create foundational templates, boilerplate code, or starter configurations for new projects, components, or features. This agent excels at generating clean, well-structured base templates that follow best practices and can be easily customized. Examples: <example>Context: User needs to start a new React component and wants a solid foundation. user: 'I need to create a new user profile component' assistant: 'I'll use the base-template-generator agent to create a comprehensive React component template with proper structure, TypeScript definitions, and styling setup.' <commentary>Since the user needs a foundational template for a new component, use the base-template-generator agent to create a well-structured starting point.</commentary></example> <example>Context: User is setting up a new API endpoint and needs a template. user: 'Can you help me set up a new REST API endpoint for user management?' assistant: 'I'll use the base-template-generator agent to create a complete API endpoint template with proper error handling, validation, and documentation structure.' <commentary>The user needs a foundational template for an API endpoint, so use the base-template-generator agent to provide a comprehensive starting point.</commentary></example> |
| [`database-specialist`](../.claude/agents/database-specialist.md) | 🔵 sonnet | Database design and optimization specialist — schema design, query tuning, indexing, migrations, data integrity. Use for data-model decisions, slow-query diagnosis, and migration safety. |
| [`dependency-auditor`](../.claude/agents/dependency-auditor.md) | 🔵 sonnet | Dependency & supply-chain specialist — CVE triage by reachability, lockfile/version hygiene, and safe upgrades. Use for npm-audit triage, dependency upgrades, and supply-chain risk review. |
| [`frontend-specialist`](../.claude/agents/frontend-specialist.md) | 🔵 sonnet | Web frontend specialist — accessible, performant, type-safe UI (React/Vue/Svelte). Use to build/review web components, fix UI bugs, and improve accessibility and client performance. |
| [`project-coordinator`](../.claude/agents/project-coordinator.md) 🎖 | 🔵 sonnet | Coordinates multi-agent workflows — decomposes the goal, assigns named agents, sequences handoffs via SendMessage, and synthesizes results. Use as the lead for multi-step, multi-agent tasks. |
| [`prompt-engineer`](../.claude/agents/prompt-engineer.md) | 🔵 sonnet | Prompt & agent-definition specialist — writes and optimizes agent prompts, tool descriptions, and instructions for clarity, correct routing, and cost. Use to improve this repo's agent/skill definitions or any LLM prompt. |
| [`python-specialist`](../.claude/agents/python-specialist.md) | 🔵 sonnet | Python development specialist — idiomatic, typed, tested Python. Use for writing/reviewing Python services, scripts, and packaging, with async, typing, and performance awareness. |
| [`security-auditor`](../.claude/agents/security-auditor.md) | 🔵 sonnet | Security audit and hardening specialist — finds and remediates vulnerabilities, validates inputs, reviews auth/crypto. Use for security reviews, threat modeling, and CVE triage. |
| [`typescript-specialist`](../.claude/agents/typescript-specialist.md) | 🔵 sonnet | TypeScript development specialist — strict typing, sound domain models, modern ESM. Use for writing/reviewing TS, fixing type errors, and designing type-safe APIs. |

### Flow-Nexus (облако) (9)

| Агент | Тир | Описание |
|---|---|---|
| [`flow-nexus-app-store`](../.claude/agents/flow-nexus/app-store.md) | 🟢 haiku | Application marketplace and template management specialist. Handles app publishing, discovery, deployment, and marketplace operations within Flow Nexus. |
| [`flow-nexus-auth`](../.claude/agents/flow-nexus/authentication.md) | 🔵 sonnet | Flow Nexus authentication and user management specialist. Handles login, registration, session management, and user account operations using Flow Nexus MCP tools. |
| [`flow-nexus-challenges`](../.claude/agents/flow-nexus/challenges.md) | 🟢 haiku | Coding challenges and gamification specialist. Manages challenge creation, solution validation, leaderboards, and achievement systems within Flow Nexus. |
| [`flow-nexus-neural`](../.claude/agents/flow-nexus/neural-network.md) | 🔵 sonnet | Neural network training and deployment specialist. Manages distributed neural network training, inference, and model lifecycle using Flow Nexus cloud infrastructure. |
| [`flow-nexus-payments`](../.claude/agents/flow-nexus/payments.md) | 🔵 sonnet | Credit management and billing specialist. Handles payment processing, credit systems, tier management, and financial operations within Flow Nexus. |
| [`flow-nexus-sandbox`](../.claude/agents/flow-nexus/sandbox.md) | 🔵 sonnet | E2B sandbox deployment and management specialist. Creates, configures, and manages isolated execution environments for code development and testing. |
| [`flow-nexus-swarm`](../.claude/agents/flow-nexus/swarm.md) | 🔵 sonnet | AI swarm orchestration and management specialist. Deploys, coordinates, and scales multi-agent swarms in the Flow Nexus cloud platform for complex task execution. |
| [`flow-nexus-user-tools`](../.claude/agents/flow-nexus/user-tools.md) | 🟢 haiku | User management and system utilities specialist. Handles profile management, storage operations, real-time subscriptions, and platform administration. |
| [`flow-nexus-workflow`](../.claude/agents/flow-nexus/workflow.md) | 🔵 sonnet | Event-driven workflow automation specialist. Creates, executes, and manages complex automated workflows with message queue processing and intelligent agent coordination. |

### Templates (9)

| Агент | Тир | Описание |
|---|---|---|
| [`memory-coordinator`](../.claude/agents/templates/memory-coordinator.md) 🎖 | 🟢 haiku | Manage persistent memory across sessions and facilitate cross-agent memory sharing |
| [`migration-planner`](../.claude/agents/templates/migration-plan.md) | 🔵 sonnet | Comprehensive migration plan for converting commands to agent-based system |
| [`perf-analyzer`](../.claude/agents/templates/performance-analyzer.md) | 🔵 sonnet | Performance bottleneck analyzer for identifying and resolving workflow inefficiencies |
| [`smart-agent`](../.claude/agents/templates/automation-smart-agent.md) | 🔵 sonnet | Intelligent agent coordination and dynamic spawning specialist |
| [`sparc-coder`](../.claude/agents/templates/implementer-sparc-coder.md) | 🔵 sonnet | Transform specifications into working code with TDD practices |
| [`sparc-coord`](../.claude/agents/templates/sparc-coordinator.md) 🎖 | 🔵 sonnet | SPARC methodology orchestrator for systematic development phase coordination |
| [`swarm-init`](../.claude/agents/templates/coordinator-swarm-init.md) | 🟢 haiku | Swarm initialization and topology optimization specialist |
| [`task-orchestrator`](../.claude/agents/templates/orchestrator-task.md) 🎖 | 🟢 haiku | Central coordination agent for task decomposition, execution planning, and result synthesis |
| [`template-pr-manager`](../.claude/agents/templates/github-pr-manager.md) 🎖 | 🔵 sonnet | Template/scaffold for a PR-lifecycle agent. Canonical runtime agent is pr-manager (github/pr-manager.md). |

### Consensus / распределённые (7)

| Агент | Тир | Описание |
|---|---|---|
| [`byzantine-coordinator`](../.claude/agents/consensus/byzantine-coordinator.md) 🎖 | 🔵 sonnet | Coordinates Byzantine fault-tolerant consensus protocols with malicious actor detection |
| [`crdt-synchronizer`](../.claude/agents/consensus/crdt-synchronizer.md) 🎖 | 🔵 sonnet | Implements Conflict-free Replicated Data Types for eventually consistent state synchronization |
| [`gossip-coordinator`](../.claude/agents/consensus/gossip-coordinator.md) 🎖 | 🔵 sonnet | Coordinates gossip-based consensus protocols for scalable eventually consistent systems |
| [`performance-benchmarker`](../.claude/agents/consensus/performance-benchmarker.md) 🎖 | 🔵 sonnet | Implements comprehensive performance benchmarking for distributed consensus protocols |
| [`quorum-manager`](../.claude/agents/consensus/quorum-manager.md) 🎖 | 🔵 sonnet | Implements dynamic quorum adjustment and intelligent membership management |
| [`raft-manager`](../.claude/agents/consensus/raft-manager.md) 🎖 | 🔵 sonnet | Manages Raft consensus algorithm with leader election and log replication |
| [`security-manager`](../.claude/agents/consensus/security-manager.md) 🎖 | 🔵 sonnet | Implements comprehensive security mechanisms for distributed consensus protocols |

### V3 (6)

| Агент | Тир | Описание |
|---|---|---|
| [`test-architect`](../.claude/agents/v3/test-architect.md) | 🔵 sonnet | Test strategy and quality-assurance architect — designs the test approach (what to test, at which level), not just individual tests. Use to plan coverage, choose test levels, and close gaps. |
| [`v3-integration-architect`](../.claude/agents/v3/v3-integration-architect.md) | 🟣 opus | V3 Integration Architect for deep agentic-flow@alpha integration. Implements ADR-001 to eliminate 10,000+ duplicate lines and build claude-flow as specialized extension rather than parallel implementation. |
| [`v3-memory-specialist`](../.claude/agents/v3/v3-memory-specialist.md) | 🔵 sonnet | V3 Memory Specialist for unifying 6+ memory systems into AgentDB with HNSW indexing. Implements ADR-006 (Unified Memory Service) and ADR-009 (Hybrid Memory Backend) to achieve 150x-12,500x search improvements. |
| [`v3-performance-engineer`](../.claude/agents/v3/v3-performance-engineer.md) | 🔵 sonnet | V3 Performance Engineer for achieving aggressive performance targets. Responsible for 2.49x-7.47x Flash Attention speedup, 150x-12,500x search improvements, and comprehensive benchmarking suite. |
| [`v3-queen-coordinator`](../.claude/agents/v3/v3-queen-coordinator.md) 🎖 | 🟣 opus | V3 Queen Coordinator for 15-agent concurrent swarm orchestration, GitHub issue management, and cross-agent coordination. Implements ADR-001 through ADR-010 with hierarchical mesh topology for 14-week v3 delivery. |
| [`v3-security-architect`](../.claude/agents/v3/v3-security-architect.md) | 🟣 opus | V3 Security Architect responsible for complete security overhaul, threat modeling, and CVE remediation planning. Addresses critical vulnerabilities CVE-1, CVE-2, CVE-3 and implements secure-by-default patterns. |

### Optimization / Performance (5)

| Агент | Тир | Описание |
|---|---|---|
| [`Benchmark Suite`](../.claude/agents/optimization/benchmark-suite.md) | 🔵 sonnet | Comprehensive performance benchmarking, regression detection and performance validation |
| [`Load Balancing Coordinator`](../.claude/agents/optimization/load-balancer.md) 🎖 | 🔵 sonnet | Dynamic task distribution, work-stealing algorithms and adaptive load balancing |
| [`Performance Monitor`](../.claude/agents/optimization/performance-monitor.md) | 🟢 haiku | Real-time metrics collection, bottleneck analysis, SLA monitoring and anomaly detection |
| [`Resource Allocator`](../.claude/agents/optimization/resource-allocator.md) | 🔵 sonnet | Adaptive resource allocation, predictive scaling and intelligent capacity planning |
| [`Topology Optimizer`](../.claude/agents/optimization/topology-optimizer.md) | 🔵 sonnet | Dynamic swarm topology reconfiguration and communication pattern optimization |

### Core (разработка) (5)

| Агент | Тир | Описание |
|---|---|---|
| [`coder`](../.claude/agents/core/coder.md) | 🔵 sonnet | Implementation specialist. Use when turning a design, spec, or ADR into production code, fixing a bug, or refactoring. Produces working, tested code with explicit verification notes. |
| [`planner`](../.claude/agents/core/planner.md) | 🔵 sonnet | Strategic planning agent. Use when a goal is complex enough to need decomposition into an ordered, dependency-aware plan before work starts. Produces a small executable plan with owners, dependencies, a critical path, and risks. |
| [`researcher`](../.claude/agents/core/researcher.md) | 🔵 sonnet | Codebase/topic investigation agent. Use when you need to understand existing code, patterns, or dependencies before designing or implementing. Produces evidence-backed findings with file:line citations. |
| [`reviewer`](../.claude/agents/core/reviewer.md) | 🔵 sonnet | Code review agent. Use when a diff/PR needs a correctness, security, performance, and maintainability check before merge. Produces a prioritized review ending in one explicit verdict. |
| [`tester`](../.claude/agents/core/tester.md) | 🔵 sonnet | Testing & QA agent. Use when an implementation needs tests written/run and validated against requirements and edge cases. Produces test files plus an honest run summary. |

### Hive-Mind (5)

| Агент | Тир | Описание |
|---|---|---|
| [`collective-intelligence-coordinator`](../.claude/agents/hive-mind/collective-intelligence-coordinator.md) 🎖 | 🟣 opus | Orchestrates distributed cognitive processes across the hive mind, ensuring coherent collective decision-making through memory synchronization and consensus protocols |
| [`queen-coordinator`](../.claude/agents/hive-mind/queen-coordinator.md) 🎖 | 🟣 opus | The sovereign orchestrator of hierarchical hive operations, managing strategic decisions, resource allocation, and maintaining hive coherence through centralized-decentralized hybrid control |
| [`scout-explorer`](../.claude/agents/hive-mind/scout-explorer.md) 🎖 | 🔵 sonnet | Information reconnaissance specialist that explores unknown territories, gathers intelligence, and reports findings to the hive mind through continuous memory updates |
| [`swarm-memory-manager`](../.claude/agents/hive-mind/swarm-memory-manager.md) 🎖 | 🟢 haiku | Manages distributed memory across the hive mind, ensuring data consistency, persistence, and efficient retrieval through advanced caching and synchronization protocols |
| [`worker-specialist`](../.claude/agents/hive-mind/worker-specialist.md) 🎖 | 🔵 sonnet | Dedicated task execution specialist that carries out assigned work with precision, continuously reporting progress through memory coordination |

### Sublinear (5)

| Агент | Тир | Описание |
|---|---|---|
| [`consensus-coordinator`](../.claude/agents/sublinear/consensus-coordinator.md) 🎖 | 🔵 sonnet | Distributed consensus agent that uses sublinear solvers for fast agreement protocols in multi-agent systems. Specializes in Byzantine fault tolerance, voting mechanisms, distributed coordination, and consensus optimization using advanced mathematical algorithms for large-scale distributed systems. |
| [`matrix-optimizer`](../.claude/agents/sublinear/matrix-optimizer.md) | 🔵 sonnet | Expert agent for matrix analysis and optimization using sublinear algorithms. Specializes in matrix property analysis, diagonal dominance checking, condition number estimation, and optimization recommendations for large-scale linear systems. Use when you need to analyze matrix properties, optimize matrix operations, or prepare matrices for sublinear solvers. |
| [`pagerank-analyzer`](../.claude/agents/sublinear/pagerank-analyzer.md) | 🔵 sonnet | Expert agent for graph analysis and PageRank calculations using sublinear algorithms. Specializes in network optimization, influence analysis, swarm topology optimization, and large-scale graph computations. Use for social network analysis, web graph analysis, recommendation systems, and distributed system topology design. |
| [`performance-optimizer`](../.claude/agents/sublinear/performance-optimizer.md) | 🔵 sonnet | System performance optimization agent that identifies bottlenecks and optimizes resource allocation using sublinear algorithms. Specializes in computational performance analysis, system optimization, resource management, and efficiency maximization across distributed systems and cloud infrastructure. |
| [`trading-predictor`](../.claude/agents/sublinear/trading-predictor.md) | 🔵 sonnet | Advanced financial trading agent that leverages temporal advantage calculations to predict and execute trades before market data arrives. Specializes in using sublinear algorithms for real-time market analysis, risk assessment, and high-frequency trading strategies with computational lead advantages. |

### SPARC (4)

| Агент | Тир | Описание |
|---|---|---|
| [`architecture`](../.claude/agents/sparc/architecture.md) | 🟣 opus | SPARC Architecture phase specialist for system design |
| [`pseudocode`](../.claude/agents/sparc/pseudocode.md) | 🔵 sonnet | SPARC Pseudocode phase specialist for algorithm design |
| [`refinement`](../.claude/agents/sparc/refinement.md) | 🔵 sonnet | SPARC Refinement phase specialist for iterative improvement |
| [`specification`](../.claude/agents/sparc/specification.md) | 🔵 sonnet | SPARC Specification phase specialist for requirements analysis |

### Swarm (топологии) (3)

| Агент | Тир | Описание |
|---|---|---|
| [`adaptive-coordinator`](../.claude/agents/swarm/adaptive-coordinator.md) 🎖 | 🔵 sonnet | Dynamic topology switching coordinator with self-organizing swarm patterns and real-time optimization |
| [`hierarchical-coordinator`](../.claude/agents/swarm/hierarchical-coordinator.md) 🎖 | 🔵 sonnet | Queen-led hierarchical swarm coordination with specialized worker delegation |
| [`mesh-coordinator`](../.claude/agents/swarm/mesh-coordinator.md) 🎖 | 🔵 sonnet | Peer-to-peer mesh network swarm with distributed decision making and fault tolerance |

### Development (3)

| Агент | Тир | Описание |
|---|---|---|
| [`backend-dev`](../.claude/agents/development/dev-backend-api.md) | 🔵 sonnet | Specialized agent for backend API development with self-learning and pattern recognition |
| [`backend-dev-basic`](../.claude/agents/development/backend/dev-backend-api.md) | 🔵 sonnet | Baseline backend API developer (REST/GraphQL). Leaner variant of backend-dev without ReasoningBank pattern persistence. |
| [`migration-engineer`](../.claude/agents/development/migration-engineer.md) | 🔵 sonnet | Migration specialist — version upgrades, schema/data migrations, and breaking-change rollouts with safe, reversible, incremental steps. Use to plan and execute v2→v3-style migrations or risky cutovers. |

### DevOps (3)

| Агент | Тир | Описание |
|---|---|---|
| [`cicd-engineer`](../.claude/agents/devops/ci-cd/ops-cicd-github.md) | 🔵 sonnet | Specialized agent for GitHub Actions CI/CD pipeline creation and optimization |
| [`devops-engineer`](../.claude/agents/devops/devops-engineer.md) | 🔵 sonnet | DevOps / infrastructure specialist — IaC (Terraform/Pulumi), containers, Kubernetes, and deployment pipelines. Use to provision infra, write/review IaC, containerize, and design safe deploys. |
| [`observability-engineer`](../.claude/agents/devops/observability-engineer.md) | 🔵 sonnet | Observability specialist — logging, distributed tracing, metrics, dashboards, and alerting. Use to instrument code, diagnose production issues from telemetry, or design SLO-based alerts. |

### Goal / GOAP (3)

| Агент | Тир | Описание |
|---|---|---|
| [`code-goal-planner`](../.claude/agents/goal/code-goal-planner.md) | 🔵 sonnet | Code-centric Goal-Oriented Action Planning specialist that creates intelligent plans for software development objectives. Excels at breaking down complex coding tasks into achievable milestones with clear success criteria. Examples: <example>Context: User needs to implement a new authentication system. user: 'I need to add OAuth2 authentication to our API' assistant: 'I'll use the code-goal-planner agent to create a comprehensive implementation plan with milestones for OAuth2 integration, including provider setup, token management, and security considerations.' <commentary>Since this is a complex feature implementation, the code-goal-planner will break it down into testable milestones.</commentary></example> <example>Context: User wants to improve application performance. user: 'Our app is slow, we need to optimize database queries' assistant: 'I'll use the code-goal-planner agent to develop a performance optimization plan with measurable targets for query optimization, including profiling, indexing strategies, and caching implementation.' <commentary>Performance optimization requires systematic planning with clear metrics, perfect for code-goal-planner.</commentary></example> |
| [`goal-planner`](../.claude/agents/goal/goal-planner.md) | 🔵 sonnet | Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives. Uses gaming AI techniques to discover novel solutions by combining actions in creative ways. Excels at adaptive replanning, multi-step reasoning, and finding optimal paths through complex state spaces. Examples: <example>Context: User needs to optimize a complex workflow with many dependencies. user: 'I need to deploy this application but there are many prerequisites and dependencies' assistant: 'I'll use the goal-planner agent to analyze all requirements and create an optimal action sequence that satisfies all preconditions and achieves your deployment goal.' <commentary>Complex multi-step planning with dependencies requires the goal-planner agent's GOAP algorithm to find the optimal path.</commentary></example> <example>Context: User has a high-level goal but isn't sure of the steps. user: 'Make my application production-ready' assistant: 'I'll use the goal-planner agent to break down this goal into concrete actions, analyze preconditions, and create an adaptive plan that achieves production readiness.' <commentary>High-level goals that need intelligent decomposition and planning benefit from the goal-planner agent's capabilities.</commentary></example> |
| [`sublinear-goal-planner`](../.claude/agents/goal/agent.md) | 🔵 sonnet | Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives. Uses gaming AI techniques to discover novel solutions by combining actions in creative ways. Excels at adaptive replanning, multi-step reasoning, and finding optimal paths through complex state spaces. |

### Dual-Mode (Claude + Codex) (3)

| Агент | Тир | Описание |
|---|---|---|
| [`codex-coordinator`](../.claude/agents/dual-mode/codex-coordinator.md) 🎖 | 🔵 sonnet | Coordinates multiple headless Codex workers for parallel execution |
| [`codex-worker`](../.claude/agents/dual-mode/codex-worker.md) | 🔵 sonnet | Headless Codex background worker for parallel task execution with self-learning |
| [`dual-orchestrator`](../.claude/agents/dual-mode/dual-orchestrator.md) 🎖 | 🟣 opus | Orchestrates Claude Code (interactive) + Codex (headless) for hybrid workflows |

### Analysis (2)

| Агент | Тир | Описание |
|---|---|---|
| [`analyst`](../.claude/agents/analysis/code-analyzer.md) | 🔵 sonnet | Advanced code quality analysis agent for comprehensive code reviews and improvements |
| [`code-analyzer`](../.claude/agents/analysis/analyze-code-quality.md) | 🔵 sonnet | Advanced code quality analysis agent for comprehensive code reviews and improvements |

### Data (2)

| Агент | Тир | Описание |
|---|---|---|
| [`data-engineer`](../.claude/agents/data/data-engineer.md) | 🔵 sonnet | Data engineering specialist — ETL/ELT pipelines, ingestion, transformation, and data quality/validation. Use to build/review data pipelines, schemas-in-motion, and batch/stream processing. |
| [`ml-developer`](../.claude/agents/data/ml/data-ml-model.md) | 🔵 sonnet | Specialized agent for machine learning model development, training, and deployment |

### Testing (2)

| Агент | Тир | Описание |
|---|---|---|
| [`production-validator`](../.claude/agents/testing/production-validator.md) | 🔵 sonnet | Production validation specialist ensuring applications are fully implemented and deployment-ready |
| [`tdd-london-swarm`](../.claude/agents/testing/tdd-london-swarm.md) | 🔵 sonnet | TDD London School specialist for mock-driven development within swarm coordination |

### Payments (1)

| Агент | Тир | Описание |
|---|---|---|
| [`agentic-payments`](../.claude/agents/payments/agentic-payments.md) | 🔵 sonnet | Multi-agent payment authorization specialist for autonomous AI commerce with cryptographic verification and Byzantine consensus |

### Documentation (1)

| Агент | Тир | Описание |
|---|---|---|
| [`api-docs`](../.claude/agents/documentation/api-docs/docs-api-openapi.md) | 🔵 sonnet | Expert agent for creating and maintaining OpenAPI/Swagger documentation |

### Reasoning (1)

| Агент | Тир | Описание |
|---|---|---|
| [`goal-planner-reasoning`](../.claude/agents/reasoning/goal-planner.md) | 🔵 sonnet | Reasoning-domain GOAP (Goal-Oriented Action Planning) variant focused on adaptive replanning and multi-step reasoning via MCP integration. Leaner reasoning-side counterpart to the canonical goal-planner. Discovers novel solutions by combining actions and finding optimal paths through complex state spaces. |

### Specialized (1)

| Агент | Тир | Описание |
|---|---|---|
| [`mobile-dev`](../.claude/agents/specialized/mobile/spec-mobile-react-native.md) | 🔵 sonnet | Expert agent for React Native mobile application development across iOS and Android |

### Neural (1)

| Агент | Тир | Описание |
|---|---|---|
| [`safla-neural`](../.claude/agents/neural/safla-neural.md) | 🔵 sonnet | Self-Aware Feedback Loop Algorithm (SAFLA) neural specialist that creates intelligent, memory-persistent AI systems with self-learning capabilities. Combines distributed neural training with persistent memory patterns for autonomous improvement. Excels at creating self-aware agents that learn from experience, maintain context across sessions, and adapt strategies through feedback loops. |

### SONA (1)

| Агент | Тир | Описание |
|---|---|---|
| [`sona-learning-optimizer`](../.claude/agents/sona/sona-learning-optimizer.md) | 🔵 sonnet | SONA-powered self-optimizing agent with LoRA fine-tuning and EWC++ memory preservation |

### Architecture (1)

| Агент | Тир | Описание |
|---|---|---|
| [`system-architect`](../.claude/agents/architecture/system-design/arch-system-design.md) | 🟣 opus | Expert agent for system architecture design, patterns, and high-level technical decisions |

### Custom (1)

| Агент | Тир | Описание |
|---|---|---|
| [`test-long-runner`](../.claude/agents/custom/test-long-runner.md) | 🟢 haiku | Test agent that can run for 30+ minutes on complex tasks |

---

_🎖 = руководитель/координатор. Каталог покрывает `.claude/agents/` (канон). Плагины в `plugins/*/agents/` несут собственных агентов._

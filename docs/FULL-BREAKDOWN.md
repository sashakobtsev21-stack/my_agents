# 📚 my_agents — полный разбор проекта

> Авто-генерируется: `node scripts/gen-full-breakdown.mjs`. Новичкам сначала — [`CONCEPTS.md`](CONCEPTS.md).

**Состав:** 124 агентов · 41 скиллов · 168 команд · 33 плагинов · ~313 MCP-инструментов · 23 v3-пакетов.

## 🤖 Агенты (по направлениям)

| Направление | Кол-во |
|---|---:|
| game-dev | 15 |
| github | 13 |
| (root) | 9 |
| flow-nexus | 9 |
| templates | 8 |
| consensus | 7 |
| development | 6 |
| core | 5 |
| hive-mind | 5 |
| optimization | 5 |
| v3 | 5 |
| devops | 4 |
| sparc | 4 |
| sublinear | 4 |
| analysis | 3 |
| dual-mode | 3 |
| goal | 3 |
| swarm | 3 |
| data | 2 |
| documentation | 2 |
| testing | 2 |
| architecture | 1 |
| custom | 1 |
| neural | 1 |
| payments | 1 |
| reasoning | 1 |
| sona | 1 |
| specialized | 1 |

Полный реестр с ролями и тирами → [`AGENT-CATALOG.md`](AGENT-CATALOG.md).

## 🧩 Скиллы (41)

| Скилл | Что делает |
|---|---|
| `agentdb-advanced` | Master advanced AgentDB features including QUIC synchronization, multi-database management, custom distance metrics, hybrid search, and distributed systems inte |
| `agentdb-learning` | Create and train AI learning plugins with AgentDB's 9 reinforcement learning algorithms. Includes Decision Transformer, Q-Learning, SARSA, Actor-Critic, and mor |
| `agentdb-memory-patterns` | Implement persistent memory patterns for AI agents using AgentDB. Includes session memory, long-term storage, pattern learning, and context management. Use when |
| `agentdb-optimization` | Optimize AgentDB performance with quantization (4-32x memory reduction), HNSW indexing (HNSW-indexed search), caching, and batch operations. Use when optimizing |
| `agentdb-vector-search` | Implement semantic vector search with AgentDB for intelligent document retrieval, similarity matching, and context-aware querying. Use when building RAG systems |
| `agentic-jujutsu` | \| |
| `analyze-project` | Run a full, evidence-based audit of any codebase — vulnerabilities, build/runtime health, bottlenecks, tests, and git — and produce a prioritized report + impro |
| `browser` | Web browser automation with AI-optimized snapshots for claude-flow agents |
| `dual-mode` | Run Claude Code and OpenAI Codex workers in parallel with shared-memory coordination and cross-validation. Use when you want two AI platforms to collaborate on  |
| `flow-nexus-neural` | Train and deploy neural networks in distributed E2B sandboxes with Flow Nexus |
| `flow-nexus-platform` | \| |
| `flow-nexus-swarm` | Cloud-based AI swarm deployment and event-driven workflow automation with Flow Nexus platform |
| `github-code-review` | Comprehensive GitHub code review with AI-powered swarm coordination |
| `github-multi-repo` | \| |
| `github-project-management` | \| |
| `github-release-management` | \| |
| `github-workflow-automation` | \| |
| `hive-mind-advanced` | \| |
| `hooks-automation` | Automated coordination, formatting, and learning from Claude Code operations using intelligent hooks with MCP integration. Includes pre/post task hooks, session |
| `new-project` | Build a brand-new project from an idea to a working, tested first version using a planned multi-agent pipeline with a verify gate. Use when the user wants to cr |
| `pair-programming` | AI-assisted pair programming with multiple modes (driver/navigator/switch), real-time verification, quality monitoring, and comprehensive testing. Supports TDD, |
| `performance-analysis` | \| |
| `reasoningbank-agentdb` | Implement ReasoningBank adaptive learning with AgentDB's HNSW-indexed (measured ~1.9x-4.7x) vector database. Includes trajectory tracking, verdict judgment, mem |
| `reasoningbank-intelligence` | Implement adaptive learning with ReasoningBank for pattern recognition, strategy optimization, and continuous improvement. Use when building self-learning agent |
| `skill-builder` | Create new Claude Code Skills with proper YAML frontmatter, progressive disclosure structure, and complete directory organization. Use when you need to build cu |
| `sparc-methodology` | \| |
| `stream-chain` | Stream-JSON chaining for multi-agent pipelines, data transformation, and sequential workflows |
| `swarm-advanced` | \| |
| `swarm-orchestration` | Orchestrate multi-agent swarms with agentic-flow for parallel task execution, dynamic topology, and intelligent coordination. Use when scaling beyond single age |
| `v3-cli-modernization` | CLI modernization and hooks system enhancement for claude-flow v3. Implements interactive prompts, command decomposition, enhanced hooks integration, and intell |
| `v3-core-implementation` | Core module implementation for claude-flow v3. Implements DDD domains, clean architecture patterns, dependency injection, and modular TypeScript codebase with c |
| `v3-ddd-architecture` | Domain-Driven Design architecture for claude-flow v3. Implements modular, bounded context architecture with clean separation of concerns and microkernel pattern |
| `v3-integration-deep` | Deep agentic-flow@alpha integration implementing ADR-001. Eliminates 10,000+ duplicate lines by building claude-flow as specialized extension rather than parall |
| `v3-mcp-optimization` | MCP server optimization and transport layer enhancement for claude-flow v3. Implements connection pooling, load balancing, tool registry optimization, and perfo |
| `v3-memory-unification` | Unify 6+ memory systems into AgentDB with HNSW indexing for ~1.9x-4.7x (measured) search improvements. Implements ADR-006 (Unified Memory Service) and ADR-009 ( |
| `v3-performance-optimization` | Achieve aggressive v3 performance targets: unverified Flash Attention speedup, ~1.9x-4.7x (measured) search improvements, 50-75% memory reduction. Comprehensive |
| `v3-security-overhaul` | Complete security architecture overhaul for claude-flow v3. Addresses critical CVEs (CVE-1, CVE-2, CVE-3) and implements secure-by-default patterns. Use for sec |
| `v3-swarm-coordination` | 15-agent hierarchical mesh coordination for v3 implementation. Orchestrates parallel execution across security, core, and integration domains following 10 ADRs  |
| `verification-quality` | \| |
| `worker-benchmarks` | Run comprehensive worker system benchmarks and performance analysis |
| `worker-integration` | Worker-Agent integration for intelligent task dispatch and performance tracking |

## ⌨️ Команды (168, по группам)

**sparc** (32): `analyzer` · `architect` · `ask` · `batch-executor` · `code` · `coder` · `debug` · `debugger` · `designer` · `devops` · `docs-writer` · `documenter` · `innovator` · `integration` · `mcp` · `memory-manager` · `optimizer` · `orchestrator` · `post-deployment-monitoring-mode` · `refinement-optimization-mode` · `researcher` · `reviewer` · `security-review` · `sparc` · `sparc-modes` · `spec-pseudocode` · `supabase-admin` · `swarm-coordinator` · `tdd` · `tester` · `tutorial` · `workflow-manager`

**github** (19): `README` · `code-review` · `code-review-swarm` · `github-modes` · `github-swarm` · `issue-tracker` · `issue-triage` · `multi-repo-swarm` · `pr-enhance` · `pr-manager` · `project-board-sync` · `release-manager` · `release-swarm` · `repo-analyze` · `repo-architect` · `swarm-issue` · `swarm-pr` · `sync-coordinator` · `workflow-automation`

**swarm** (17): `README` · `analysis` · `development` · `examples` · `maintenance` · `optimization` · `research` · `swarm` · `swarm-analysis` · `swarm-background` · `swarm-init` · `swarm-modes` · `swarm-monitor` · `swarm-spawn` · `swarm-status` · `swarm-strategies` · `testing`

**hive-mind** (12): `README` · `hive-mind` · `hive-mind-consensus` · `hive-mind-init` · `hive-mind-memory` · `hive-mind-metrics` · `hive-mind-resume` · `hive-mind-sessions` · `hive-mind-spawn` · `hive-mind-status` · `hive-mind-stop` · `hive-mind-wizard`

**flow-nexus** (9): `app-store` · `challenges` · `login-registration` · `neural-network` · `payments` · `sandbox` · `swarm` · `user-tools` · `workflow`

**hooks** (8): `README` · `overview` · `post-edit` · `post-task` · `pre-edit` · `pre-task` · `session-end` · `setup`

**analysis** (7): `COMMAND_COMPLIANCE_REPORT` · `README` · `bottleneck-detect` · `performance-bottlenecks` · `performance-report` · `token-efficiency` · `token-usage`

**automation** (7): `README` · `auto-agent` · `self-healing` · `session-memory` · `smart-agents` · `smart-spawn` · `workflow-select`

**coordination** (7): `README` · `agent-spawn` · `init` · `orchestrate` · `spawn` · `swarm-init` · `task-orchestrate`

**pair** (7): `README` · `commands` · `config` · `examples` · `modes` · `session` · `start`

**monitoring** (6): `README` · `agent-metrics` · `agents` · `real-time-view` · `status` · `swarm-monitor`

**optimization** (6): `README` · `auto-topology` · `cache-manage` · `parallel-execute` · `parallel-execution` · `topology-optimize`

**training** (6): `README` · `model-update` · `neural-patterns` · `neural-train` · `pattern-learn` · `specialization`

**workflows** (6): `README` · `development` · `research` · `workflow-create` · `workflow-execute` · `workflow-export`

**agents** (5): `README` · `agent-capabilities` · `agent-coordination` · `agent-spawning` · `agent-types`

**memory** (5): `README` · `memory-persist` · `memory-search` · `memory-usage` · `neural`

**(root)** (4): `claude-flow-help` · `claude-flow-memory` · `claude-flow-swarm` · `sparc`

**stream-chain** (2): `pipeline` · `run`

**verify** (2): `check` · `start`

**truth** (1): `start`

## 🔌 Плагины (33)

| Плагин | Привозит | Что делает |
|---|---|---|
| `ruflo-adr` | a:1 s:4 c:1 | ADR lifecycle management — create, index, supersede, and link Architecture Decision Records to code |
| `ruflo-agent` | a:1 s:3 c:2 | Agent runtimes — local WASM-sandboxed agents (rvagent) + Anthropic Claude Managed Agents (cloud); one interface, local-vs-cloud backends |
| `ruflo-agentdb` | a:1 s:2 c:2 | AgentDB memory controllers with HNSW vector search, RuVector embeddings, and causal graphs |
| `ruflo-aidefence` | a:1 s:2 c:1 | AI safety scanning, PII detection, prompt injection defense, and adaptive threat learning |
| `ruflo-autopilot` | a:1 s:2 c:2 | Autonomous /loop-driven task completion with learning, prediction, and progress tracking |
| `ruflo-browser` | a:1 s:9 c:1 | Agentic browser automation with Playwright for testing, scraping, and UI interaction |
| `ruflo-core` | a:4 s:4 c:2 | Core Ruflo MCP tools, commands, and Claude Code orchestration patterns |
| `ruflo-cost-tracker` | a:1 s:13 c:1 | Token usage tracking, model cost attribution per agent, budget alerts, and optimization recommendations |
| `ruflo-daa` | a:1 s:2 c:1 | Dynamic Agentic Architecture with cognitive patterns, knowledge sharing, and adaptive agents |
| `ruflo-ddd` | a:1 s:3 c:1 | Domain-Driven Design scaffolding — bounded contexts, aggregate roots, domain events, and anti-corruption layers |
| `ruflo-docs` | a:1 s:2 c:1 | Documentation generation, drift detection, and API docs automation |
| `ruflo-federation` | a:1 s:3 c:1 | Cross-installation agent federation with zero-trust security, PII-gated data flow, and compliance-grade audit trails |
| `ruflo-goals` | a:4 s:5 c:1 | Long-horizon goal planning, deep research orchestration, and adaptive replanning using GOAP |
| `ruflo-graph-intelligence` | a:0 s:0 c:1 | Real-time graph intelligence — personalized PageRank, streaming delta updates, witness-signed reasoning, and federation-distributable vector |
| `ruflo-intelligence` | a:1 s:3 c:2 | Self-learning neural intelligence with SONA patterns, trajectory learning, and model routing |
| `ruflo-iot-cognitum` | a:4 s:5 c:1 | IoT device lifecycle, telemetry anomaly detection, fleet management, and witness chain verification for Cognitum Seed hardware |
| `ruflo-jujutsu` | a:1 s:2 c:1 | Advanced git workflows with diff analysis, risk scoring, and reviewer recommendations |
| `ruflo-knowledge-graph` | a:1 s:2 c:1 | Knowledge graph construction — entity extraction, relation mapping, and pathfinder graph traversal |
| `ruflo-loop-workers` | a:1 s:2 c:2 | Cache-aware /loop workers and CronCreate background automation |
| `ruflo-market-data` | a:1 s:2 c:1 | Market data ingestion — feed normalization, OHLCV vectorization, and HNSW-indexed pattern matching |
| `ruflo-migrations` | a:1 s:2 c:1 | Schema migration management — generate, validate, dry-run, and rollback database migrations |
| `ruflo-neural-trader` | a:4 s:9 c:1 | Neural trading strategies — self-learning LSTM/Transformer/N-BEATS models with Rust/NAPI backtesting |
| `ruflo-observability` | a:1 s:2 c:1 | Structured logging, distributed tracing, and metrics — correlate agent swarm activity with application telemetry |
| `ruflo-plugin-creator` | a:1 s:2 c:1 | Scaffold, validate, and publish new Claude Code plugins with proper structure |
| `ruflo-rag-memory` | a:1 s:2 c:2 | RuVector memory with HNSW search, AgentDB, and semantic retrieval |
| `ruflo-ruvector` | a:1 s:4 c:1 | Self-learning vector database — HNSW, FlashAttention-3, Graph RAG, hybrid search, DiskANN, and Brain AGI |
| `ruflo-ruvllm` | a:1 s:2 c:1 | RuVLLM local inference with chat formatting, MicroLoRA fine-tuning, and SONA adaptation |
| `ruflo-rvf` | a:1 s:2 c:1 | RVF format for portable agent memory, session persistence, and cross-platform transfer |
| `ruflo-security-audit` | a:1 s:2 c:1 | Security review, dependency scanning, policy gates, and CVE monitoring |
| `ruflo-sparc` | a:1 s:3 c:1 | SPARC methodology — Specification, Pseudocode, Architecture, Refinement, Completion phases with quality gates |
| `ruflo-swarm` | a:2 s:2 c:2 | Agent teams, swarm coordination, Monitor streams, and worktree isolation |
| `ruflo-testgen` | a:1 s:2 c:1 | Test gap detection, coverage analysis, and automated test generation |
| `ruflo-workflows` | a:3 s:5 c:8 | Visual workflow automation with templates, orchestration, and lifecycle management |

_a = агенты · s = скиллы · c = команды, которые плагин добавляет при установке._

## 🛠️ MCP-инструменты (~313, по группам)

| Группа | Назначение |
|---|---|
| `agent` | Spawn/list/manage agents |
| `agentdb` | AgentDB vector memory ops |
| `analyze` | Code/repo analysis |
| `autopilot` | Autonomous /loop task runs |
| `browser` | Playwright browser automation |
| `browser-session` | Browser session lifecycle |
| `claims` | Claims-based authorization |
| `config` | Configuration & providers |
| `coordination` | Swarm coordination/sync |
| `daa` | Dynamic agentic architecture |
| `embeddings` | Vector embeddings |
| `github` | PRs/issues/repos/releases |
| `guidance` | Governance control plane |
| `hive-mind` | Queen-led consensus |
| `hooks` | Lifecycle hooks + codemods + workers |
| `managed-agent` | Anthropic Managed Agents (cloud) |
| `memory` | Store/search/retrieve memory (HNSW) |
| `neural` | SONA/MoE neural training |
| `performance` | Benchmark/profile/optimize |
| `progress` | Implementation progress |
| `ruvllm` | Local LLM inference |
| `security` | Scan/audit/CVE/threats |
| `session` | Session state & persistence |
| `swarm` | Init/scale/monitor swarms |
| `system` | System diagnostics/doctor |
| `task` | Task lifecycle |
| `terminal` | Sandboxed command execution |
| `transfer` | Pattern transfer (IPFS) |
| `wasm-agent` | Local WASM-sandboxed agents |
| `workflow` | Workflow templates/execution |

## 🏗️ Пакеты движка v3 (23)

| Пакет | Назначение |
|---|---|
| `@claude-flow/aidefence` | AI Manipulation Defense System (AIMDS) with self-learning, prompt injection detection, and vector search integ |
| `@claude-flow/browser` | Browser automation for AI agents - integrates agent-browser with claude-flow swarms |
| `@claude-flow/claims` | Issue claiming and work coordination module for Claude Flow V3 |
| `@claude-flow/cli` | Ruflo CLI - Enterprise AI agent orchestration with 60+ specialized agents, swarm coordination, MCP server, sel |
| `@claude-flow/cli-core` | Lightweight core CLI surface for Claude Flow — memory + hooks commands only. Designed to load fast on cold npx |
| `@claude-flow/codex` | Codex CLI integration for Ruflo (claude-flow) - OpenAI Codex platform adapter |
| `@claude-flow/deployment` | Deployment module - Release management, CI/CD, versioning |
| `@claude-flow/embeddings` | V3 Embedding Service - OpenAI, Transformers.js, Agentic-Flow (ONNX), Mock providers with hyperbolic embeddings |
| `@claude-flow/guidance` | Guidance Control Plane - Compiles, retrieves, enforces, and evolves guidance rules for Claude Code sessions |
| `@claude-flow/hooks` | V3 Hooks System - Event-driven lifecycle hooks with ReasoningBank learning integration |
| `@claude-flow/integration` | Integration module - agentic-flow@alpha deep integration, ADR-001 compliance, TokenOptimizer |
| `@claude-flow/mcp` | Standalone MCP (Model Context Protocol) server - stdio/http/websocket transports, connection pooling, tool reg |
| `@claude-flow/memory` | Memory module - AgentDB unification, HNSW indexing, vector search, hybrid SQLite+AgentDB backend (ADR-009) |
| `@claude-flow/neural` | Self-Optimizing Neural Architecture (SONA) for Claude Flow — adaptive learning, trajectory tracking, pattern r |
| `@claude-flow/performance` | Performance module - benchmarking, Flash Attention validation, optimization |
| `@claude-flow/plugin-agent-federation` | Cross-installation agent federation with zero-trust security, PII-gated data flow, and compliance-grade audit  |
| `@claude-flow/plugin-iot-cognitum` | IoT Cognitum Seed device-agent bridge — treat every Seed as a Ruflo agent. Get a Seed at https://cognitum.one. |
| `@claude-flow/plugins` | Unified Plugin SDK for Claude Flow V3 - Worker, Hook, and Provider Integration |
| `@claude-flow/providers` | Multi-LLM Provider System for Claude Flow V3 |
| `@claude-flow/security` | Security module - CVE fixes, input validation, path security |
| `@claude-flow/shared` | Shared module - common types, events, utilities, core interfaces |
| `@claude-flow/swarm` | Standalone swarm coordination - up to 100+ agents, 4 topologies, hive-mind, consensus |
| `@claude-flow/testing` | Testing module - TDD London School framework, test utilities, fixtures, and mock services for V3 Claude-Flow |

---

См. также: [`CONCEPTS.md`](CONCEPTS.md) · [`agent-catalog.html`](agent-catalog.html) · [`agent-report.html`](agent-report.html) · [`../README.md`](../README.md)

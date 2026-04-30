# Ruflo Plugins

32 Claude Code plugins for agent-powered development workflows. Load with `--plugin-dir`.

## Quick Start

```bash
# Load specific plugins
claude --plugin-dir plugins/ruflo-core --plugin-dir plugins/ruflo-swarm

# Load all plugins
claude $(ls -d plugins/ruflo-*/ | sed 's|^|--plugin-dir |' | tr '\n' ' ')
```

## Plugin Catalog

### Core & Coordination

| Plugin | Description |
|--------|-------------|
| [ruflo-core](ruflo-core/) | MCP server, status, doctor, coder/researcher/reviewer agents |
| [ruflo-swarm](ruflo-swarm/) | Swarm topologies (hierarchical, mesh), Monitor streaming |
| [ruflo-autopilot](ruflo-autopilot/) | Autonomous /loop task completion with prediction |
| [ruflo-loop-workers](ruflo-loop-workers/) | 12 background workers via /loop or CronCreate |
| [ruflo-workflows](ruflo-workflows/) | Workflow templates, parallel execution, branching |

### Memory & Intelligence

| Plugin | Description |
|--------|-------------|
| [ruflo-agentdb](ruflo-agentdb/) | AgentDB with HNSW vector search (150x-12,500x faster) |
| [ruflo-rag-memory](ruflo-rag-memory/) | Simple store/search/recall memory |
| [ruflo-rvf](ruflo-rvf/) | Portable RVF memory format, session persistence |
| [ruflo-ruvector](ruflo-ruvector/) | ONNX embeddings, HNSW indexing, hyperbolic reasoning, clustering |
| [ruflo-knowledge-graph](ruflo-knowledge-graph/) | Entity extraction, relation mapping, pathfinder traversal |
| [ruflo-intelligence](ruflo-intelligence/) | SONA neural patterns, trajectory learning, model routing |
| [ruflo-daa](ruflo-daa/) | Dynamic Agentic Architecture, cognitive patterns |

### Architecture & Methodology

| Plugin | Description |
|--------|-------------|
| [ruflo-adr](ruflo-adr/) | ADR lifecycle — create, index, supersede, compliance checking |
| [ruflo-ddd](ruflo-ddd/) | DDD scaffolding — bounded contexts, aggregates, domain events |
| [ruflo-sparc](ruflo-sparc/) | SPARC methodology with 5 phases and quality gates |

### Quality & Security

| Plugin | Description |
|--------|-------------|
| [ruflo-security-audit](ruflo-security-audit/) | CVE scanning, dependency vulnerability checks |
| [ruflo-aidefence](ruflo-aidefence/) | Prompt injection detection, PII scanning |
| [ruflo-testgen](ruflo-testgen/) | Test gap detection, TDD London School workflow |
| [ruflo-browser](ruflo-browser/) | Playwright browser automation and testing |

### Development Tools

| Plugin | Description |
|--------|-------------|
| [ruflo-jujutsu](ruflo-jujutsu/) | Diff analysis, risk scoring, reviewer recommendations |
| [ruflo-docs](ruflo-docs/) | Doc generation, drift detection, API docs |
| [ruflo-ruvllm](ruflo-ruvllm/) | Local LLM inference, MicroLoRA, chat formatting |
| [ruflo-wasm](ruflo-wasm/) | WASM agent sandboxing and gallery |
| [ruflo-plugin-creator](ruflo-plugin-creator/) | Scaffold and validate new plugins |
| [ruflo-migrations](ruflo-migrations/) | Database schema migration management |
| [ruflo-observability](ruflo-observability/) | Structured logging, tracing, metrics correlation |
| [ruflo-cost-tracker](ruflo-cost-tracker/) | Token usage tracking, budget alerts, cost optimization |

### Domain-Specific

| Plugin | Description |
|--------|-------------|
| [ruflo-goals](ruflo-goals/) | GOAP planning, deep research, horizon tracking |
| [ruflo-federation](ruflo-federation/) | Zero-trust cross-installation agent federation |
| [ruflo-iot-cognitum](ruflo-iot-cognitum/) | Cognitum Seed IoT — trust scoring, anomaly detection, fleet management |
| [ruflo-neural-trader](ruflo-neural-trader/) | Neural trading strategies, backtesting, portfolio optimization |
| [ruflo-market-data](ruflo-market-data/) | Market data ingestion, OHLCV vectorization, pattern matching |

## Recommended Stacks

| Use Case | Plugins |
|----------|---------|
| Feature development | `ruflo-core` + `ruflo-swarm` + `ruflo-testgen` + `ruflo-ddd` |
| Security audit | `ruflo-core` + `ruflo-security-audit` + `ruflo-aidefence` |
| Architecture work | `ruflo-core` + `ruflo-adr` + `ruflo-ddd` + `ruflo-sparc` |
| Deep research | `ruflo-core` + `ruflo-goals` + `ruflo-rag-memory` + `ruflo-intelligence` |
| IoT development | `ruflo-core` + `ruflo-iot-cognitum` + `ruflo-agentdb` |
| Trading systems | `ruflo-core` + `ruflo-neural-trader` + `ruflo-market-data` + `ruflo-ruvector` |
| Full stack | All 32 plugins |

## Plugin Structure

Each plugin follows the Claude Code plugin specification:

```
ruflo-<name>/
  .claude-plugin/plugin.json    # Plugin manifest
  agents/<name>.md              # Agent definitions (frontmatter: name, description, model)
  commands/<name>.md            # CLI command mappings
  skills/<name>/SKILL.md        # Interactive skills (frontmatter: name, description, argument-hint, allowed-tools)
  README.md                     # Plugin documentation (optional)
```

## Creating a Plugin

```bash
claude --plugin-dir plugins/ruflo-plugin-creator
# Then: /create-plugin my-new-plugin
```

Or manually: copy any existing plugin directory and modify.

## Validation

```bash
claude plugin validate plugins/ruflo-<name>
```

## License

MIT

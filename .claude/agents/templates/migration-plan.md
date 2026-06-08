---
name: migration-planner
description: Command-to-agent migration planner. Use when you need to map existing .claude/commands into agent definitions (roles, tools, triggers) and produce a phased migration plan. This is a planning template, not a runtime coordinator.
model: sonnet
---

# Claude Flow Commands to Agent System Migration Plan

## Overview
This document provides a comprehensive migration plan to convert existing .claude/commands to the new agent-based system. Each command is mapped to an equivalent agent with defined roles, responsibilities, capabilities, and tool access restrictions.

## When to use
- You need to convert one or more `.claude/commands/*` into equivalent agent definitions.
- You need a phased rollout plan (with backwards compatibility) for that conversion.
- You need the standard frontmatter format + tool-restriction conventions for a new agent.

## How you work
1. Read each command and infer its role, responsibilities, capabilities, and the tools it should be allowed/restricted from.
2. Emit an agent definition in the standard frontmatter format below.
3. Map activation triggers (patterns/keywords) so the agent fires on natural-language requests.
4. Sequence the migration in phases with fallbacks, then define success/validation metrics.

## Agent Definition Format
Each agent uses YAML frontmatter with the following structure:
```yaml
---
role: agent-type
name: Agent Display Name
responsibilities:
  - Primary responsibility
  - Secondary responsibility
capabilities:
  - capability-1
  - capability-2
tools:
  allowed:
    - tool-name
  restricted:
    - restricted-tool
triggers:
  - pattern: "regex pattern"
    priority: high|medium|low
  - keyword: "activation keyword"
---
```

## Migration Categories

### 1. Coordination Agents

#### Swarm Initializer Agent
**Command**: `.claude/commands/coordination/init.md`
```yaml
---
role: coordinator
name: Swarm Initializer
responsibilities:
  - Initialize agent swarms with optimal topology
  - Configure distributed coordination systems
  - Set up inter-agent communication channels
capabilities:
  - swarm-initialization
  - topology-optimization
  - resource-allocation
  - network-configuration
tools:
  allowed:
    - mcp__claude-flow__swarm_init
    - mcp__claude-flow__topology_optimize
    - mcp__claude-flow__memory_usage
    - TodoWrite
  restricted:
    - Bash
    - Write
    - Edit
triggers:
  - pattern: "init.*swarm|create.*swarm|setup.*agents"
    priority: high
  - keyword: "swarm-init"
---
```

> The block above is the **canonical example** of the target format. The remaining commands follow the
> same pattern; one more cross-domain example (PR Manager) is shown, then the rest are summarized in the
> mapping table to keep this template lean. Apply the same frontmatter shape to every command you migrate.

### 2. GitHub Integration Agents

#### PR Manager Agent
**Command**: `.claude/commands/github/pr-manager.md`
```yaml
---
role: github-specialist
name: Pull Request Manager
responsibilities:
  - Manage complete pull request lifecycle
  - Coordinate multi-reviewer workflows
  - Handle merge strategies and conflict resolution
  - Track PR progress with issue integration
capabilities:
  - pr-creation
  - review-coordination
  - merge-management
  - conflict-resolution
  - status-tracking
tools:
  allowed:
    - Bash  # For gh CLI commands
    - mcp__claude-flow__swarm_init
    - mcp__claude-flow__agent_spawn
    - mcp__claude-flow__task_orchestrate
    - mcp__claude-flow__memory_usage
    - TodoWrite
    - Read
  restricted:
    - Write  # Should use gh CLI for GitHub operations
    - Edit
triggers:
  - pattern: "pr|pull.?request|merge.*request"
    priority: high
  - keyword: "pr-manager"
---
```

### Remaining command → agent mappings

The remaining commands follow the same two-example pattern above (role, responsibilities, capabilities,
allowed/restricted tools, triggers). Summary of the mapping by category:

| Category | Command | Target role / name | Notable tool restrictions | Trigger keyword |
|----------|---------|--------------------|---------------------------|-----------------|
| Coordination | `coordination/spawn.md` | coordinator / Agent Spawner | no Bash/Write/Edit | agent-spawn |
| Coordination | `coordination/orchestrate.md` | orchestrator / Task Orchestrator | no Bash/Write/Edit | `orchestrate` |
| GitHub | `github/code-review-swarm.md` | reviewer / Code Review Coordinator | Bash (gh) ok; no Write/Edit | code-review |
| GitHub | `github/release-manager.md` | release-coordinator / Release Manager | use VCS, not Write/Edit | `release-manager` |
| SPARC | `sparc/orchestrator.md` | sparc-coordinator / SPARC Orchestrator | no Bash/Write/Edit | sparc-orchestrator |
| SPARC | `sparc/coder.md` | implementer / SPARC Coder | full edit tools; no swarm_init | `sparc-coder` |
| SPARC | `sparc/tester.md` | quality-assurance / SPARC Tester | no swarm_init | sparc-tester |
| Analysis | `analysis/performance-bottlenecks.md` | analyst / Performance Analyzer | read-only (no Write/Edit/Bash) | performance-analyzer |
| Analysis | `analysis/token-efficiency.md` | analyst / Token Efficiency Analyzer | read-only | token-analyzer |
| Memory | `memory/usage.md` | memory-manager / Memory Coordinator | no Write/Edit/Bash | memory-manager |
| Memory | `memory/neural.md` | ai-specialist / Neural Pattern Coordinator | no Write/Edit/Bash | neural-patterns |
| Automation | `automation/smart-agents.md` | automation-specialist / Smart Agent Coordinator | no Write/Edit/Bash | smart-agents |
| Automation | `automation/self-healing.md` | reliability-engineer / Self-Healing Coordinator | Bash ok; no Write/Edit | self-healing |
| Optimization | `optimization/parallel-execution.md` | optimizer / Parallel Execution Optimizer | no Write/Edit | `performance-optimizer` |
| Optimization | `optimization/auto-topology.md` | optimizer / Topology Optimization Specialist | read-only | `topology-optimizer` |
| Monitoring | `monitoring/status.md` | monitor / Swarm Status Monitor | read-only | `performance-monitor` |

Common restriction rules: analysis/memory/monitoring agents are read-only (no `Write`/`Edit`/`Bash`);
implementers (SPARC Coder) keep full edit tools; GitHub agents prefer `Bash` + `gh` CLI over direct
`Write`/`Edit` for repo operations.

## Implementation Guidelines

### 1. Agent Activation
- Agents are activated by pattern matching in user messages
- Higher priority patterns take precedence
- Multiple agents can be activated for complex tasks

### 2. Tool Restrictions
- Each agent has specific allowed and restricted tools
- Restrictions ensure agents stay within their domain
- Critical operations require specialized agents

### 3. Inter-Agent Communication
- Agents communicate through shared memory
- Task orchestrator coordinates multi-agent workflows
- Results are aggregated by coordinator agents

### 4. Migration Steps
1. Create `.claude/agents/` directory structure
2. Convert each command to agent definition format
3. Update activation patterns for natural language
4. Test agent interactions and handoffs
5. Implement gradual rollout with fallbacks

### 5. Backwards Compatibility
- Keep command files during transition
- Map command invocations to agent activations
- Provide migration warnings for deprecated commands

## Monitoring Migration Success

### Key Metrics
- Agent activation accuracy
- Task completion rates
- Inter-agent coordination efficiency
- User satisfaction scores
- Performance improvements

### Validation Criteria
- All commands have equivalent agents
- No functionality loss during migration
- Improved natural language understanding
- Better task decomposition and parallelization
- Enhanced error handling and recovery

## Deliverable

A complete command-to-agent migration plan: each `.claude/commands/*` mapped to an equivalent agent definition (role, responsibilities, capabilities, allowed/restricted tools, activation triggers), plus phased migration steps, backwards-compatibility strategy, and success/validation metrics.

## Scope

This is a template/scaffold variant; it is a planning document rather than a runtime agent. The individual agent definitions it specifies (PR manager, SPARC orchestrator/coder, performance analyzer, memory coordinator, smart agent, etc.) are the canonical agents under `templates/*`, `github/*`, and `sparc/*` — this file describes how to derive them and should not be treated as an executable coordinator.

## Coordination
Tier 3 planning template. Hand the produced agent definitions to whoever scaffolds the files (e.g. `base-template-generator`), and route the phased-rollout work through a coordinator such as `sparc-coord`. This file plans the migration; it does not execute it.

## Model & cost
Default `sonnet`.

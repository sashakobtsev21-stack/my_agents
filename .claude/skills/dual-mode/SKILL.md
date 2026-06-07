---
name: "Dual-Mode Collaboration"
description: "Run Claude Code and OpenAI Codex workers in parallel with shared-memory coordination and cross-validation. Use when you want two AI platforms to collaborate on a task (architect/coder/tester/reviewer pipelines) via the dual-mode CLI and shared namespaces."
---

# Dual-Mode Collaboration (Claude Code + Codex)

Coordinate Claude Code (🔵) and OpenAI Codex (🟢) workers in parallel through a shared
memory namespace, so the two platforms cross-validate each other's work.

## When to use

- Complex tasks that benefit from two independent reasoning styles (design vs. fast implementation).
- Built-in review: one platform implements, the other reviews.
- Parallel pipelines where stages hand off via a shared `collaboration` namespace.

## Workflow

1. **Spawn** both platforms — see [`dual-spawn.md`](dual-spawn.md).
2. **Coordinate** via the shared namespace — see [`dual-coordinate.md`](dual-coordinate.md).
3. **Collect** and synthesize results — see [`dual-collect.md`](dual-collect.md).

## CLI

```bash
# Pre-built templates (feature / security / refactor / bugfix)
npx claude-flow-codex dual run feature --task "Add OAuth login"

# Custom multi-platform swarm
npx claude-flow-codex dual run \
  --worker "claude:architect:Design the API" \
  --worker "codex:coder:Implement endpoints" \
  --worker "claude:tester:Write integration tests" \
  --namespace "api-feature"

npx claude-flow-codex dual status
npx claude-flow-codex dual templates
```

See the companion files in this directory for the spawn, coordinate, and collect steps.

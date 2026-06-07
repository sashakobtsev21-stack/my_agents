# ruflo-graph-intelligence

Real-time graph intelligence for the my_agents ecosystem: personalized PageRank,
streaming delta updates, complexity-aware execution, witness-signed reasoning, and
federation-distributable vectors (ADR-123).

> This plugin ships a TypeScript **engine** (`src/`) that exposes MCP tools rather than
> standalone agents/skills. Its capabilities are used via the `/graph-intelligence`
> command and the MCP tools registered from `src/mcp-tools/index.ts`.

## What it does

- **Personalized PageRank** — rank nodes relative to a seed set (relevance / influence).
- **Streaming delta updates** — incremental recompute as the graph changes, no full rebuild.
- **Complexity-aware execution** — sublinear-time algorithms where the graph structure allows.
- **Witness-signed reasoning** — signed reasoning traces for auditability.
- **Federation-distributable vectors** — graph embeddings shareable across federated nodes.

## Use

```
/graph-intelligence
```

…or call its MCP tools directly from Claude.

## Build the engine

```bash
cd plugins/ruflo-graph-intelligence
npm install && npm run build
```

MIT · part of [my_agents](https://github.com/sashakobtsev21-stack/my_agents).

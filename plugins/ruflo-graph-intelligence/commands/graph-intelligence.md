---
name: graph-intelligence
description: Run sublinear graph intelligence — personalized PageRank, streaming delta updates, and witness-signed reasoning over an entity/code/knowledge graph.
---

# /graph-intelligence

Analyze a graph (codebase, knowledge graph, or federated entity graph) with the
`ruflo-graph-intelligence` engine:

1. **Build / update the graph** from the target (code, knowledge graph, or imported entities).
2. **Personalized PageRank** from a seed set → rank the most relevant / influential nodes.
3. **Streaming deltas** → recompute incrementally as the graph changes (no full rebuild).
4. **Witness-signed reasoning** → emit a signed, auditable reasoning trace.

Invoke the engine's MCP tools (registered from `src/mcp-tools/index.ts`) to run each step,
then summarize the ranked nodes and the reasoning path.

---
name: vector-hyperbolic
description: Embed hierarchical data in hyperbolic space (Poincare ball model), compute geodesic distances, and find hierarchical neighbors
argument-hint: "<text> [--model poincare]"
allowed-tools: mcp__claude-flow__embeddings_hyperbolic mcp__claude-flow__embeddings_generate mcp__claude-flow__embeddings_compare mcp__claude-flow__embeddings_status mcp__claude-flow__ruvllm_hnsw_create mcp__claude-flow__ruvllm_hnsw_add mcp__claude-flow__ruvllm_hnsw_route mcp__claude-flow__memory_store mcp__claude-flow__memory_search Read Bash
---

# Vector Hyperbolic

Embed hierarchical data in the Poincare ball model for operations that respect tree-like structure.

## When to use

Use this skill when your data has inherent hierarchy -- dependency trees, module structures, taxonomies, org charts, ontologies, or any parent-child relationship graph. Hyperbolic space naturally captures hierarchical distances: nodes near the center are generic/root-level, nodes near the boundary are specific/leaf-level. This requires far fewer dimensions than Euclidean embeddings to represent the same hierarchical fidelity.

## Steps

1. **Identify hierarchical structure** -- determine what hierarchy the data represents (dependency tree, taxonomy, module graph, etc.). If needed, read source files to extract parent-child relationships.
2. **Embed in Poincare ball** -- call `mcp__claude-flow__embeddings_hyperbolic` with the text and `model=poincare`. The engine returns coordinates inside the unit ball where:
   - Coordinates near the origin represent generic/root concepts
   - Coordinates near the boundary represent specific/leaf concepts
   - Geodesic distance between points reflects hierarchical distance
3. **Compute geodesic distances** -- for two hyperbolic embeddings, compute the Poincare distance: `d(u, v) = arcosh(1 + 2 * ||u - v||^2 / ((1 - ||u||^2)(1 - ||v||^2)))`. This distance grows logarithmically with tree depth, preserving hierarchy.
4. **Find hierarchical neighbors** -- call `mcp__claude-flow__ruvllm_hnsw_route` with the hyperbolic embedding to find nearest neighbors in the hyperbolic HNSW index. Neighbors are semantically and hierarchically related.
5. **Analyze hierarchy** -- report the embedding's position (center vs. boundary), its nearest hierarchical neighbors, and the geodesic distances. Identify parent-like (closer to center) and child-like (closer to boundary) neighbors.
6. **Store results** -- call `mcp__claude-flow__memory_store` to persist the hyperbolic embedding and hierarchy analysis in the `hyperbolic-embeddings` namespace.

## CLI alternative

```bash
npx @claude-flow/cli@latest embeddings embed --text "your text" --model poincare
npx @claude-flow/cli@latest embeddings search --query "your query" --model poincare
```

## Poincare ball properties

| Property | Meaning |
|----------|---------|
| Norm close to 0 | Generic, root-level concept |
| Norm close to 1 | Specific, leaf-level concept |
| Small geodesic distance | Closely related in the hierarchy |
| Large geodesic distance | Distantly related or in different subtrees |

## Use cases

- **Dependency analysis**: embed module imports to find tightly coupled subtrees
- **Code architecture**: map class hierarchies to discover structural patterns
- **Knowledge organization**: embed concepts to reveal taxonomic relationships
- **Codebase navigation**: find the most specific or most general modules relative to a query

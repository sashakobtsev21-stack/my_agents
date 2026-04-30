---
name: vector-cluster
description: Cluster vectors by similarity using k-means or density-based methods, then label and summarize groups
argument-hint: "<namespace> [--k N]"
allowed-tools: mcp__claude-flow__embeddings_search mcp__claude-flow__embeddings_generate mcp__claude-flow__embeddings_compare mcp__claude-flow__embeddings_status mcp__claude-flow__ruvllm_hnsw_route mcp__claude-flow__memory_search mcp__claude-flow__memory_store mcp__claude-flow__memory_list Read Bash
---

# Vector Cluster

Cluster vectors in a namespace by semantic similarity, producing labeled groups with summaries.

## When to use

Use this skill when you have a collection of embeddings (e.g., all files in a project, all memory entries in a namespace) and want to discover natural groupings. Clustering reveals themes, identifies outliers, and helps organize large vector collections.

## Steps

1. **Fetch all vectors** -- call `mcp__claude-flow__memory_list` with the target namespace to enumerate entries, then call `mcp__claude-flow__memory_search` with a broad query to retrieve vectors. For HNSW-backed namespaces, use `mcp__claude-flow__embeddings_status` to check the vector count.
2. **Compute pairwise distances** -- for each pair of vectors, compute cosine distance (1 - cosine_similarity). Build a distance matrix.
3. **Select clustering method**:
   - If `--k N` is provided, use **k-means**: initialize k centroids via k-means++, assign vectors to nearest centroid, recompute centroids, repeat until convergence (max 100 iterations).
   - If `--k` is omitted, use **density clustering**: find core points (vectors with >= minPts neighbors within epsilon distance), expand clusters from core points, mark remaining vectors as outliers.
4. **Label clusters** -- for each cluster, examine the source texts of member vectors and generate a descriptive label summarizing the cluster theme.
5. **Visualize** -- present a summary table with cluster ID, label, member count, and cohesion score (average intra-cluster similarity). List outliers separately if density clustering was used.
6. **Store results** -- call `mcp__claude-flow__memory_store` to persist cluster assignments in the `vector-clusters` namespace for future reference.

## CLI alternative

```bash
npx @claude-flow/cli@latest embeddings search --query "*" --namespace patterns --limit 1000
npx @claude-flow/cli@latest memory list --namespace patterns
```

## Interpreting results

- **High cohesion** (>0.85): tight, well-defined cluster with closely related content
- **Medium cohesion** (0.6-0.85): related but diverse content
- **Low cohesion** (<0.6): loose grouping, may benefit from splitting with higher k
- **Outliers**: content that does not fit any cluster -- often novel or anomalous entries worth investigating

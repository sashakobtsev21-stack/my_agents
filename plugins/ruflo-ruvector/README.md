# ruflo-ruvector

RuVector operations -- HNSW indexing, embedding generation, vector clustering, and hyperbolic space reasoning.

## Overview

Vector operations specialist for the RuVector system. Generates 384-dimensional embeddings via ONNX all-MiniLM-L6-v2, manages HNSW approximate nearest-neighbor indexes, performs k-means and density-based clustering, and supports hyperbolic embeddings in the Poincare ball model for hierarchical data (taxonomies, dependency trees, org charts).

## Installation

```bash
claude --plugin-dir plugins/ruflo-ruvector
```

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `vector-engineer` | sonnet | Embedding generation, HNSW index management, similarity search, clustering, hyperbolic space reasoning |

## Skills

| Skill | Usage | Description |
|-------|-------|-------------|
| `vector-embed` | `/vector-embed <text-or-file>` | Generate ONNX embeddings (384-dim), normalize, and store in HNSW index |
| `vector-cluster` | `/vector-cluster <namespace> [--k N]` | Cluster vectors using k-means or density-based methods |
| `vector-hyperbolic` | `/vector-hyperbolic <text> [--model poincare]` | Embed hierarchical data in hyperbolic space (Poincare ball) |

## Commands (9 subcommands)

```bash
# Embedding
vector embed <text>
vector batch <glob-pattern>
vector compare <text1> <text2>

# Search
vector search <query> [--limit N]

# Clustering
vector cluster <namespace> [--k N]

# Index management
vector index create <name>
vector index stats <name>

# Hyperbolic
vector hyperbolic embed <text>
```

## HNSW Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `M` | 16 | Graph connectivity (edges per node) |
| `efConstruction` | 200 | Build-time search quality |
| `efSearch` | 50 | Query-time search quality |

## Normalization Options

| Method | Use Case |
|--------|----------|
| L2 (unit sphere) | Cosine similarity -- default for semantic search |
| L1 (manhattan) | Sparse feature comparison |
| min-max | Bounded [0,1] range for visualization |
| z-score | Standardized distribution for statistical analysis |

## Related Plugins

- `ruflo-knowledge-graph` -- HNSW-backed semantic search across graph nodes
- `ruflo-market-data` -- Pattern vector indexing for candlestick similarity
- `ruflo-neural-trader` -- Strategy pattern similarity search

## License

MIT

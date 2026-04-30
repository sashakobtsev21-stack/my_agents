---
name: vector
description: RuVector embedding, HNSW index, clustering, and hyperbolic space commands
---

Vector operations commands:

1. Parse the user's subcommand (embed, batch, search, compare, cluster, index, hyperbolic)

2. For **embed `<text>`**: call `mcp__claude-flow__embeddings_generate` with the text. Return the 384-dim vector and confirm it was stored in the active HNSW index.

3. For **batch `<glob-pattern>`**: expand the glob to matching files, read each file, call `mcp__claude-flow__embeddings_generate` for each chunk, and call `mcp__claude-flow__ruvllm_hnsw_add` to insert all vectors. Report count and index size.

4. For **search `<query>` [--limit N]**: call `mcp__claude-flow__embeddings_search` with the query text and limit (default 10). Present results ranked by similarity score.

5. For **compare `<text1>` `<text2>`**: call `mcp__claude-flow__embeddings_compare` with both texts. Report cosine similarity as a decimal and a percentage.

6. For **cluster `<namespace>` [--k N]**: fetch all vectors from the namespace, compute pairwise distances, run k-means (if --k given) or density clustering (if --k omitted), label each vector with its cluster ID, and present cluster summaries with member counts and centroid descriptions.

7. For **index create `<name>`**: call `mcp__claude-flow__ruvllm_hnsw_create` with the index name and default parameters (M=16, efConstruction=200). Confirm creation.

8. For **index stats `<name>`**: call `mcp__claude-flow__embeddings_status` for the named index. Report vector count, dimension, M, efConstruction, efSearch, and memory usage.

9. For **hyperbolic embed `<text>`**: call `mcp__claude-flow__embeddings_hyperbolic` with the text and model=poincare. Return the Poincare ball coordinates and curvature.

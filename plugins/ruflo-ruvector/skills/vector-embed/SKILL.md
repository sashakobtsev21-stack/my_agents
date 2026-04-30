---
name: vector-embed
description: Generate ONNX embeddings (all-MiniLM-L6-v2, 384-dim), normalize, and store in an HNSW index
argument-hint: "<text-or-file>"
allowed-tools: mcp__claude-flow__embeddings_generate mcp__claude-flow__embeddings_init mcp__claude-flow__embeddings_status mcp__claude-flow__embeddings_compare mcp__claude-flow__ruvllm_hnsw_create mcp__claude-flow__ruvllm_hnsw_add mcp__claude-flow__ruvllm_hnsw_route mcp__claude-flow__memory_store mcp__claude-flow__memory_search Read Bash
---

# Vector Embed

Generate and store vector embeddings for text or file contents.

## When to use

Use this skill to embed text, code, or documents into 384-dimensional vectors for semantic search, similarity comparison, or clustering. Embeddings are generated via ONNX all-MiniLM-L6-v2 and stored in an HNSW index for fast approximate nearest-neighbor retrieval.

## Steps

1. **Ensure the embedding engine is ready** -- call `mcp__claude-flow__embeddings_status` to check engine health. If not initialized, call `mcp__claude-flow__embeddings_init`.
2. **Read the input** -- if the argument is a file path, read the file contents. If it is raw text, use it directly. For large files, chunk into segments of ~512 tokens with 50-token overlap.
3. **Generate the embedding** -- call `mcp__claude-flow__embeddings_generate` with the text. The engine returns a 384-dim float32 vector.
4. **Normalize** -- the embedding is L2-normalized by default (unit sphere) for cosine similarity. Specify `--norm l1`, `--norm minmax`, or `--norm zscore` for alternatives.
5. **Store in HNSW index** -- call `mcp__claude-flow__ruvllm_hnsw_add` to insert the vector with metadata (source text hash, timestamp, file path if applicable).
6. **Confirm** -- report the vector ID, dimension (384), norm, and index the vector was stored in.

## CLI alternative

```bash
npx @claude-flow/cli@latest embeddings embed --text "your text here"
npx @claude-flow/cli@latest embeddings batch --glob "src/**/*.ts"
npx @claude-flow/cli@latest embeddings init --force
npx @claude-flow/cli@latest embeddings status
```

## Batch embedding

For multiple files, iterate over each file, chunk contents, and embed each chunk. Use `mcp__claude-flow__ruvllm_hnsw_add` with batch mode for efficient insertion. Report total vectors inserted and index growth.

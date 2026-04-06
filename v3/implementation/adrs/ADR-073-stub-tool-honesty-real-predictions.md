# ADR-073: Stub Tool Honesty & Real Predictions

**Status**: Accepted  
**Date**: 2026-04-06  
**Context**: Issue #1514 (independent audit), Issues #1516, #1518, #1521, #1526

## Decision

### 1. Remove fabricated metrics from token-optimizer

The `TokenOptimizer` class (`@claude-flow/integration`) contained hardcoded savings numbers:

| Before | After |
|--------|-------|
| `totalTokensSaved += 100` per cache hit | Removed — cache hits tracked but no fabricated token count |
| `baseline = 1000` (hardcoded) | `queryTokenEstimate = query.length / 4` (actual content size) |
| `totalTokensSaved += 50` per edit | Removed — edit count tracked, savings not fabricated |
| `executionMs: 352` fallback | `executionMs: 0` (honest: no optimization occurred) |

### 2. Make `getOptimalConfig()` responsive to `agentCount`

Previously returned identical config regardless of input. Now scales:

| Agent Count | Batch Size | Topology | Cache |
|-------------|-----------|----------|-------|
| 1-4 | 2 | hierarchical | 25MB |
| 5-8 | 4 | hierarchical | 50MB |
| 9-12 | 6 | hierarchical-mesh | 75MB |
| 13+ | 6 | mesh | 100MB+ |

### 3. Wire `neural_predict` to real embedding similarity

Previously: hardcoded labels `['coder', 'researcher', 'reviewer', 'tester']` with random confidence.

Now:
- If stored patterns exist: generates real embedding for input, computes cosine similarity against all stored pattern embeddings, returns top-K nearest neighbors
- If no patterns stored: returns defaults with `_simulated: true` flag
- All results include `_realEmbedding` and `_hasStoredPatterns` transparency flags

### 4. Mark `neural_train` as stub

Added clear code comment that training is simulated (no real ML occurs). Accuracy numbers are random. This is honest about current state while the real training pipeline is developed.

### 5. Fix bare model names (#1516)

All embedding model defaults now use `Xenova/` prefix (e.g., `Xenova/all-MiniLM-L6-v2`) so `@xenova/transformers` can resolve them.

### 6. Fix intelligence data bloat (#1518, #1526)

- Deduplicate store entries by ID before building graph
- Scope `bootstrapFromMemoryFiles()` to current project only (was scanning all 51+ project dirs)
- Fix `tool_input` snake_case mismatch in hook-handler

## Consequences

- Token optimizer reports honest numbers (will show 0 savings when agentic-flow is not installed)
- `neural_predict` returns meaningful results when patterns are stored
- Stub tools clearly marked in code and API responses
- Users can distinguish real vs simulated behavior via `_simulated` and `_realEmbedding` flags

## Tools Status (Post-Fix)

| Category | Status | Notes |
|----------|--------|-------|
| Memory/HNSW | Real | Vector search, persistence, embeddings |
| AgentDB | Real | Pattern store, hierarchical recall, HNSW |
| Embeddings | Real | Xenova/transformers, cosine similarity |
| Neural predict | Real (with patterns) | Embedding-based nearest-neighbor search |
| Neural train | Stub | Simulated, marked as such |
| Token optimizer | Honest metrics | No fabricated numbers |
| Agent spawn/task | Coordination stubs | State tracking, no LLM execution |
| WASM agents | Stub | Echo-based, no WASM runtime |
| Hive-mind | Partial | Vote counting works, BFT not differentiated |

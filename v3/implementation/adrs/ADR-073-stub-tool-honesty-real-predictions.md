
# ADR-073: Stub Tool Honesty & Real Predictions

**Status**: Accepted  
**Date**: 2026-04-06 (updated v3.5.55)  
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

| Agent Count | Batch Size | Topology | Cache (MB) |
|-------------|-----------|----------|------------|
| 1-2 | 2 | hierarchical | 25 |
| 3-4 | 2 | hierarchical | 50 |
| 5-6 | 4 | hierarchical | 75 |
| 7-8 | 4 | hierarchical-mesh | 100 |
| 9-12 | 6 | hierarchical-mesh | 125-150 |
| 13+ | 6 | mesh | 175-200 |

Formula: `batchSize = agentCount<=4?2 : agentCount<=8?4 : 6`, `cacheSizeMB = min(200, 25*ceil(agentCount/2))`

### 3. Wire `neural_predict` to real embedding similarity

Previously: hardcoded labels `['coder', 'researcher', 'reviewer', 'tester']` with random confidence.

Now:
- If stored patterns exist: generates real embedding for input, computes cosine similarity against all stored pattern embeddings, returns top-K nearest neighbors
- If no patterns stored: returns empty array `[]` (no fake labels, no simulated data)
- All results include `_realEmbedding` (bool: ML model loaded) and `_hasStoredPatterns` (bool: patterns available) transparency flags

### 4. `neural_train` stores real embeddings

Training now generates real embeddings for each training data entry (via ML model or deterministic hash fallback) and stores them as searchable patterns. Accuracy is `1.0` if patterns were stored, `0` otherwise — not simulated. Cosine similarity search against these stored embeddings produces real nearest-neighbor results.

### 5. Fix bare model names (#1516)

All embedding model defaults now use `Xenova/` prefix (e.g., `Xenova/all-MiniLM-L6-v2`) so `@xenova/transformers` can resolve them.

### 6. Fix intelligence data bloat (#1518, #1526)

- Deduplicate store entries by ID before building graph (v3.5.54: also persist deduped store in consolidate via `preDedupCount` tracking)
- Applied dedup to both v3 and root intelligence.cjs copies
- Scope `bootstrapFromMemoryFiles()` to current project only (was scanning all 51+ project dirs)
- Fix `tool_input` snake_case mismatch in hook-handler

## Consequences

- Token optimizer reports honest numbers (will show 0 savings when agentic-flow is not installed)
- `neural_predict` returns real cosine similarity results when patterns stored, empty array when not
- `neural_train` stores real embeddings, no simulated accuracy
- Zero instances of `Math.random()` for confidence/accuracy/metrics in shipped code
- Users can distinguish real ML vs hash-based embedding via `_realEmbedding` flag
- `hooks explain` matchScore uses real keyword ratio instead of random

## Tools Status (Post-Fix)

| Category | Status | Notes |
|----------|--------|-------|
| Memory/HNSW | Real | Vector search, persistence, embeddings |
| AgentDB | Real | Pattern store, hierarchical recall, HNSW |
| Embeddings | Real | Xenova/transformers, cosine similarity |
| Neural predict | Real (with patterns) | Cosine similarity search; empty array when no patterns |
| Neural train | Real | Embeds training data, stores as searchable patterns |
| Token optimizer | Honest metrics | No fabricated numbers |
| Agent spawn/task | Coordination stubs | State tracking, no LLM execution |
| WASM agents | Stub | Echo-based, no WASM runtime |
| Hive-mind | Partial | Vote counting works, BFT not differentiated |

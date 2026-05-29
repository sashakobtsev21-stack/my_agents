# Intelligence / Self-Learning System — Empirical Capability Audit

**Date:** 2026-05-29 · **Version audited:** `@claude-flow/cli@3.10.6` (built `dist/`) · **Host:** darwin-arm64, Node 22
**Method:** 6 parallel auditors ran **real measurements** against the built `dist` exports, CLI, and MCP tool handlers — not documentation. Every claim is graded by evidence. Throwaway scripts were deleted; no source was modified during the audit.

> **Honesty mandate.** This audit was commissioned to *measure, benchmark, and confirm* — including confirming where claims do **not** hold. Headline performance multipliers in `CLAUDE.md` are largely hardcoded doc strings with no benchmark behind them; several are unsubstantiated and one is fabricated at runtime. At the same time, the **core self-learning loop is genuinely real and was measured end-to-end.** Both halves of that are reported plainly below.

---

## TL;DR

- **The learning loop is real.** A success/failure verdict on a recorded trajectory measurably and directionally changes stored pattern confidence, persisted to disk, surviving across separate processes. Q-learning routing feedback genuinely steers the next routing decision cross-process. This is not theater.
- **The big "×" numbers are not.** "HNSW 150x–12,500x" measured **1.48× peak**; "Flash Attention 2.49–7.47×" is **fabricated with `Math.random()` at runtime**; "75× embeddings" and "RaBitQ 2.70× retrieval" have **no benchmark** anywhere.
- **Confirmed-real with honest numbers:** Int8 **3.92×** memory, RaBitQ **32×** memory, MoE 8-expert gating (measured convergence), SONA WASM adapt **0.0042 ms** (beats the <0.05 ms claim).
- **One critical correctness bug:** the CLI **silently inverts negative reward** (`route feedback -r -1.0` records **+1.00**) — a user training against a bad agent the documented way *reinforces* it.

---

## Capability matrix

### ✅ CONFIRMED-REAL (measured)

| Capability | Evidence (measured) |
|---|---|
| **4-step learning loop** RETRIEVE→JUDGE→DISTILL | Success verdict pushed pattern confidence **0.906→1.0**; subsequent failure pulled **1.0→0.952**; counters persist across separate processes. Steps share one `LocalReasoningBank`+`SonaCoordinator` and feed each other. |
| **ReasoningBank file persistence** | Cross-process: stored in proc 1 → reloaded from disk in proc 2. `.claude-flow/neural/patterns.json` (+`stats.json`). |
| **Pattern store→search roundtrip** (#2226 fix) | Holds on both direct and MCP paths (`controller:"bridge-store", impl:"real-hnsw-indexed"`). 3.10.6 fix verified end-to-end. |
| **Memory bridge** (import_claude / bridge_status / search_unified) | Real import (14 entries, 3 projects), results carry `source:"claude-code"` attribution. Persists to `.swarm/memory.db` ns `claude-memories`. |
| **MoE — 8 experts + gating** | Genuine 384→128→8 softmax MLP + REINFORCE backprop. Measured: coder expert probability **0.081→0.994** after 200 rewards. |
| **SONA <0.05 ms adaptation** (WASM) | `SonaInstantWasm.instantAdapt` measured **0.00417 ms/call** (200k warmed) — 12× under the claim. EMA + adaptive-rank schedule. |
| **Q-learning self-improvement** (mechanism) | Q-table is read at inference and argmax'd (no static fallback). Cross-process: penalize `architect` → router switches greedy pick to `researcher`, persisted to `.swarm/q-learning-model.json`. |
| **Int8 quantization 3.92×** | Measured **3.918×** (1536→392 bytes), reconstruction cosine **0.99999**. |
| **RaBitQ 32× memory** | Real WASM (`@ruvector/rabitq-wasm@0.1.0`), builds a real 1-bit index, compressionRatio **32**. Not a stub. |
| **3-tier model routing** (hybrid) | "typo"→sonnet/11%, "architect distributed consensus"→opus/60%. Static keyword complexity + a **real persisted Beta (Thompson) bandit** that measurably shifts model choice after `model-outcome` feedback. |
| **MCP trajectory start/end** | Real lifecycle; `end` triggers SONA learning (pattern @ 55% confidence), persists to `.swarm/memory.db` + `.swarm/sona-patterns.json`, cross-process verified. |

### 🟡 PARTIAL (real core, overstated or with gaps)

| Capability | What's real / what's not |
|---|---|
| **EWC++** | Penalty math `½·Σ Fᵢ(θᵢ−θ*ᵢ)²` is correctly implemented and runs. **But "Fisher information" is a heuristic proxy** — `Fᵢ = \|wᵢ\|·λ` (ruvllm) / `embeddingᵢ²` (TS), not gradient curvature E[g²]. `forgettingRate = 1−e^(−tasks·0.1)` is a label, not a measurement. |
| **MicroLoRA** | JS `LoraAdapter` forward/backward is real low-rank math. **The WASM adapter the MCP tools actually call is inert** — output L1 delta **0.000000** after 5000 adapts (B stays zero; gradients accumulate but never flush). |
| **CONSOLIDATE (MCP path)** | Real `EWCConsolidator`, but MCP `trajectory-end` feeds it a **synthetic `Math.sin()` gradient** (`hooks-tools.js:2481`), not the embedding-derived one the library path uses. Fisher file didn't persist in a clean run. |
| **ONNX embeddings** | 384-dim shape correct, but on this host `sharp` native build fails → **silent fallback to mock embeddings still labeled `Xenova/all-MiniLM-L6-v2`**. Synonyms scored **−0.988**, unrelated text **+0.775**. Operator cannot tell mock from real — an observability defect regardless of environment. |
| **Trajectory tracking** | MCP tools real & persist; **CLI `hooks intelligence trajectory-*` subcommands are no-op stubs** (positional arg ignored → always render the status dashboard). MCP `step` is **in-memory only** between start/end (lost if server restarts mid-trajectory). |
| **neural train** | Real epoch loop with contrastive loss + LoRA backend (JS fallback does real rank-2 algebra). **But emits zero output in non-TTY** — work happens invisibly. |

### ❌ UNSUBSTANTIATED / FABRICATED

| Claim | Reality |
|---|---|
| **HNSW "150x–12,500x faster"** | Measured **peak 1.48× at N=20k**; *slower* than brute force below N≈5k. The multipliers are hardcoded doc strings; the benchmark command's "recall" is a hardcoded `0.99` constant. Baseline undefined. (A real ANN index exists — only the *magnitude* and missing baseline are the problem; 150× would need millions of vectors.) |
| **Flash Attention "2.49x–7.47x"** | **Fabricated at runtime:** `attention-coordinator.ts:972` → `flashSpeedup = 2.49 + Math.random()*4.98`. A correct tiled kernel exists (`blockAttention`, RMSE 2.6e-8) but measures only **~1.1×**; the *default* path is a lossy top-K sparse approximation (12% of keys, RMSE 0.17) measuring **0.77×–3.62×**, never 7.47×. |
| **RaBitQ "2.70x retrieval"** | Not measured anywhere in source. (The 32× *memory* claim is confirmed; the retrieval-speed number is not.) |
| **Embeddings "75x faster"** | Doc literal, no baseline, never measured. |

---

## Bugs & defects found (prioritized)

| # | Sev | Defect | Location |
|---|-----|--------|----------|
| 1 | 🔴 **Critical** | **CLI inverts negative reward.** `route feedback -r -1.0` (and `--reward -1.0`) parses as **+1.00** — negative feedback reinforces the bad agent. Only `--reward=-1.0` (equals form) preserves the sign; the command's own help example is broken. | `src/commands/route.ts` flag parser |
| 2 | 🟠 High | **Fabricated speedup metric** reported as real telemetry via `Math.random()`. | `v3/@claude-flow/swarm/src/attention-coordinator.ts:972` |
| 3 | 🟠 High | **Silent mock-embedding fallback mislabeled as the real ONNX model** — no way to distinguish mock from real output. | `memory-initializer.ts` embedding path; agentdb `EmbeddingService` |
| 4 | 🟡 Med | **`hooks_intelligence_learn` is cosmetic** — reads/echoes stats; does not run a learning cycle despite its name. | `hooks-tools.js` (~:2920) |
| 5 | 🟡 Med | **MCP `trajectory-end` consolidation uses a synthetic `Math.sin()` gradient**, not the trajectory's real embeddings. | `hooks-tools.js:2481` |
| 6 | 🟡 Med | **CLI `hooks intelligence trajectory-*` subcommands are no-op stubs** (render the status dashboard). | `src/commands/hooks.js:1758` |
| 7 | 🟡 Med | **WASM MicroLoRA `apply()` is inert** (B never flushed → output unchanged). | `@ruvector/ruvllm-wasm`; `ruvllm-wasm.ts` |
| 8 | 🟢 Low | **Benchmark "recall" is a hardcoded `0.99`** constant, not measured. | `commands/ruvector/benchmark.js:377` |
| 9 | 🟢 Low | **`neural train` / `hooks intelligence` emit nothing in non-TTY**; documented `node dist/src/index.js` entry prints nothing (use `bin/cli.js`). | `commands/neural.js`, `commands/hooks.js` |
| 10 | 🟢 Low | Q-router: stale route cache hides learning until 50 updates; `--explore false` is ignored; Beta bandit priors are global-per-model, not per-task. | `q-learning-router.ts`, `route.ts`, `model-router.ts` |

---

## Honest bottom line

The self-learning system is **substantially real where it counts**: there is a genuine closed loop in which task outcomes update persisted pattern confidence and routing Q-values, and those persisted values demonstrably change subsequent behavior across processes. MoE gating, SONA WASM latency, Int8/RaBitQ compression, and the memory bridge all hold up under direct measurement. This is a real reinforcement-style memory system, not a façade.

What does **not** hold up is the **performance-multiplier marketing**: the HNSW and Flash-Attention speedups are unsubstantiated (and one is literally randomized at runtime), and the headline embedding/quantization "×N faster" figures have no benchmark behind them. Several capabilities are real algorithms that are **implemented but inert or disconnected** (WASM MicroLoRA, MCP consolidation gradient, the `learn` tool, CLI trajectory subcommands). And one genuine **correctness bug** (negative-reward inversion) means the documented self-improvement path can train the system *backwards*.

**Recommended next steps** (not yet applied — this branch is the audit only):
1. **Fix #1 (negative-reward inversion)** — highest priority; it actively corrupts learning. (Follow-up to #2222.)
2. **Remove the `Math.random()` speedup (#2)** — replace with a real measurement or drop the metric; it is a credibility liability.
3. **Make the mock-embedding fallback observable (#3)** — surface `embeddingBackend: "mock"|"onnx"` everywhere the model name is reported.
4. **Correct the `CLAUDE.md` / perf-table claims** to measured values (Int8 3.92×, RaBitQ 32× memory, SONA 0.004 ms confirmed; HNSW/Flash/embeddings marked "unverified / approximate" with the real numbers).
5. Wire or remove the inert pieces (#4–#7) so named capabilities are either real or not advertised.

*Per-subsystem raw evidence is preserved in the audit run; load-bearing file:line references are inline above.*

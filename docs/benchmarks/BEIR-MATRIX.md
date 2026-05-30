# BEIR Public-Benchmark Results — ruflo

This page tracks ruflo's measured retrieval performance on BEIR datasets.
Every cell is reproducible from the commands in the rightmost column;
every cell has a run JSON in `docs/benchmarks/runs/`. Published baseline
numbers come from Thakur et al. 2021 (BEIR paper) and the BAAI BGE paper.

## Result Matrix

> Numbers from `docs/benchmarks/runs/beir-{dataset}-bge-latest.json`. ADR-085
> (harness + BGE swap) + ADR-086 (significance testing).

| Dataset | Corpus | Test Q | Pipeline | Model | nDCG@10 | 95% CI | vs BM25 (CI verdict) | vs Best Listed Baseline | Rank | Latency | Run JSON |
|---|---:|---:|---|---|---:|---|---|---:|---:|---:|---|
| **NFCorpus** | 3,633 | 323 | direct dense (no rerank) | BGE-base-en-v1.5 (110M) | **0.352** | [0.317, 0.387] | +0.027 ↑ (n.s.) | -0.028 ↓ BGE-large 0.380 (n.s.) | **2/11** | 388 ms | `beir-nfcorpus-bge-latest.json` |
| **NFCorpus** | 3,633 | 323 | pure BM25 (silent hash-fallback path) | _no real dense_ | 0.289 | _n/a_ | -0.036 ↓ | -0.091 ↓ | 11/11 | 950 ms | `beir-nfcorpus-2026-05-30T19-16-23-024Z.json` |
| **SciFact** | 5,183 | 300 | direct dense (no rerank) | BGE-base-en-v1.5 (110M) | 0.626 | [0.577, 0.672] | **-0.053 ↓ (p<0.05)** | -0.096 ↓ BGE-large 0.722 (p<0.05) | 10/11 | 410 ms | `beir-scifact-bge-latest.json` |

### Bootstrap CI summary (per ADR-086, 10k resamples, seed=42)

The 95% confidence intervals tell the rigorous story. On NFCorpus, we beat BM25 by 0.027 *point estimate* but the CI overlaps the baseline (n.s. at p<0.05) — the "rank-2" headline is a single-realisation outcome, not a statistically distinguishable win. On SciFact, we lose to BM25 by 0.053 and the CI **excludes** the baseline (significant at p<0.05) — that loss is real, not noise.

### Two-dataset mean (rough generalisation gauge)

| System | NFCorpus | SciFact | Mean |
|---|---:|---:|---:|
| BGE-large-v1.5 (published) | 0.380 | 0.722 | 0.551 |
| SPLADE++ | 0.347 | 0.704 | 0.526 |
| BM25 (Lucene published) | 0.325 | 0.679 | 0.502 |
| **ruflo + BGE-base (direct dense, no rerank)** | **0.352** | **0.626** | **0.489** |
| **ruflo + BM25+BGE-base RRF k=60 (3.10.27, did NOT improve)** | 0.328 | 0.569 | 0.449 |

**We're below BM25 on the 2-dataset mean** (0.489 vs 0.502). RRF made it worse (0.449). The BEIR-average story requires more datasets *and* domain-specific tuning. The NFCorpus rank-2 is real but not representative.

### ADR-087 RRF ablation (3.10.27 honest negative result)

Standard BM25+dense RRF k=60 — the textbook "lowest-regret" first move — **degrades nDCG@10 on both datasets** because our multi-field BM25 is weaker than Lucene's (our pure-BM25 NFCorpus = 0.279 vs Lucene 0.325). RRF averages BM25 noise into top-K when one input is materially weaker than the other.

| Config | NFCorpus nDCG@10 | SciFact nDCG@10 | NFCorpus R@100 | SciFact R@100 |
|---|---:|---:|---:|---:|
| dense alone (BGE-base) | **0.352** | **0.626** | 0.305 | 0.828 |
| BM25 alone (ours) | 0.279 | 0.576 | 0.223 | 0.824 |
| **RRF k=60 equal (default)** | 0.328 ↓ | 0.569 ↓ | **0.321 ↑** | **0.951 ↑** |
| RRF k=30 equal | 0.335 ↓ | 0.582 ↓ | 0.321 | 0.954 |
| RRF k=60 dense=1.2, bm25=0.8 | 0.334 ↓ | 0.577 ↓ | 0.324 | 0.961 |

Recall@100 **does** improve (RRF surfaces more candidates) — which makes RRF a useful *first stage* before reranking. Tracked for ADR-088 (cross-encoder rerank).

The default BEIR runner stays at dense-only. RRF is opt-in.

> **What pipeline is reported here:** the NFCorpus 0.352 row is the **direct
> BGE dense path** — no fine-tuning, no hybrid BM25+dense fusion, no
> cross-encoder reranker. The hybrid pipeline (cosine + multi-field BM25 +
> MMR + opt-in rerank, ADRs 078-083) is what ruflo uses internally for
> small-corpus retrieval; the BEIR runner deliberately isolates the dense
> path for clean comparison to dense baselines. Hybrid + rerank variants on
> BEIR are tracked for a future ADR.

## Published Baselines (for reference)

### NFCorpus nDCG@10 (medical IR, n=323 test queries)

| Method | Params | nDCG@10 | Source |
|---|---:|---:|---|
| BGE-large-v1.5 | 335M | 0.380 | BAAI BGE paper |
| **ruflo + BGE-base-en-v1.5** | **110M** | **0.352** | **this repo** |
| SPLADE++ | 110M | 0.347 | Formal et al. 2022 |
| GTR-XL | 1.2B | 0.343 | Ni et al. 2022 |
| DocT5query | 60M | 0.328 | Nogueira & Lin 2019 |
| Contriever | 110M | 0.328 | Izacard et al. 2022 |
| BM25 (Lucene) | — | 0.325 | Thakur et al. 2021 |
| TAS-B | 66M | 0.319 | Hofstätter et al. 2021 |
| GenQ | 110M | 0.319 | Thakur et al. 2021 |
| ColBERT | 110M | 0.305 | Khattab & Zaharia 2020 |
| SBERT (msmarco) | 110M | 0.272 | Reimers & Gurevych 2019 |

### SciFact nDCG@10 (scientific IR, n=300 test queries)

| Method | nDCG@10 | Source |
|---|---:|---|
| BGE-large-v1.5 | 0.722 | BAAI BGE paper |
| SPLADE++ | 0.704 | Formal et al. 2022 |
| BM25 (Lucene) | 0.679 | Thakur et al. 2021 |
| Contriever | 0.677 | Izacard et al. 2022 |
| DocT5query | 0.675 | Nogueira & Lin 2019 |
| ColBERT | 0.671 | Khattab & Zaharia 2020 |
| GTR-XL | 0.662 | Ni et al. 2022 |
| GenQ | 0.644 | Thakur et al. 2021 |
| TAS-B | 0.643 | Hofstätter et al. 2021 |
| SBERT (msmarco) | 0.555 | Reimers & Gurevych 2019 |

## How to reproduce

```bash
git clone https://github.com/ruvnet/ruflo && cd ruflo
npm install && ( cd v3/@claude-flow/cli && npx tsc )

# NFCorpus
mkdir -p /tmp/beir-nfcorpus && cd /tmp/beir-nfcorpus
curl -sL -o nfcorpus.zip 'https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nfcorpus.zip' && unzip -q nfcorpus.zip
node /path/to/ruflo/v3/@claude-flow/cli/scripts/run-beir-bge.mjs
# → nDCG@10 0.352, rank 2 of 11

# SciFact
mkdir -p /tmp/beir-scifact && cd /tmp/beir-scifact
curl -sL -o scifact.zip 'https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip' && unzip -q scifact.zip
BEIR_DATA_DIR=/tmp/beir-scifact/scifact node /path/to/ruflo/v3/@claude-flow/cli/scripts/run-beir-bge.mjs

# Paired bootstrap significance test (ADR-086)
node /path/to/ruflo/v3/@claude-flow/cli/scripts/beir-bootstrap-significance.mjs \
  /path/to/ruflo/docs/benchmarks/runs/beir-nfcorpus-bge-latest.json
```

## Model size / speed / quality trade-offs

| Model | Params | Embed dim | Cache size (NFCorpus) | Ingest (3,633 docs) | Query latency |
|---|---:|---:|---:|---:|---:|
| `Xenova/bge-small-en-v1.5` | 33M | 384 | ~5.5 MB | ~15 min | ~250 ms |
| `Xenova/bge-base-en-v1.5` | 110M | 768 | ~11 MB | ~25 min | ~330 ms |
| `Xenova/bge-large-en-v1.5` | 335M | 1024 | ~15 MB | ~60 min (est.) | ~700 ms (est.) |

Per-row latency is on Apple Silicon CPU through `@xenova/transformers`
int8-quantised ONNX. GPU would be ~10-50× faster.

## Methodology notes

- **No fine-tuning.** All numbers are zero-shot — we use BAAI's released
  BGE models as-is. NFCorpus has a 110K-pair train split that fine-tuning
  could exploit for an additional ~0.02-0.05 nDCG lift; not done here.
- **`@xenova/transformers` direct API** (not `pipeline()`) used to bypass
  the `sharp`/`libvips` transitive dependency that breaks on
  darwin-arm64 (ADR-085 §"sharp-on-darwin-arm64 bug").
- **CLS-token pooling + L2 normalisation** per BAAI's BGE spec; cosine
  becomes dot product on normalised vectors.
- **Graded relevance for nDCG** — qrels use 0/1/2 grades; we use
  `(2^rel - 1) / log2(i+1)` per BEIR convention.
- **Reproducibility**: `BOOTSTRAP_SEED=42` for the significance test
  (mulberry32 PRNG). Run JSONs include full per-query metrics so
  external bootstrap-CI checks reproduce exactly.

## Limits & next steps

- **Two-dataset coverage isn't BEIR-average.** BEIR ships 18 datasets;
  the published "BEIR average" is the standard generalisation gauge.
  Tracking: TREC-COVID, FiQA-2018, ArguAna, HotpotQA, NQ next.
- **Single-annotator labelled retrieval** for internal ruflo bench
  (ADR-081); not relevant to BEIR's externally-curated qrels.
- **The 0.005 gap to SPLADE++** (0.352 vs 0.347) is on the edge of noise
  at N=323. The paired bootstrap test (ADR-086) gives a confidence
  interval; report both point estimate AND CI.

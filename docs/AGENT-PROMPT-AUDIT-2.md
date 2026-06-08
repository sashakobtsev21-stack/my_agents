# Agent Prompt Audit — Round 2 (Post-Remediation)

Re-audit of **122 agent prompts** after a remediation pass, compared against the pre-remediation baseline. Scores are 1–5 across eight aspects (trigger, boundary, structure, output_contract, coordination, model_fit, antidrift, clarity).

## Before → After

| Metric | Before (baseline) | After (remediation) | Δ |
|---|---|---|---|
| Mean score | 4.01 | **4.48** | **+0.47** |
| Agents below 3.0 | 25 | **1** | **−24** |
| Median score | — | 4.75 | — |
| Range | — | 2.88 – 5.00 | — |
| Perfect 5.0s | — | 26 / 122 (21.3%) | — |

Mean rose by nearly half a point and the long tail of failing prompts was almost entirely eliminated — the count below 3.0 dropped from 25 to 1 (a 96% reduction).

## Score Distribution (after)

| Band | Count | Share |
|---|---|---|
| 4.5 – 5.0 (strong) | 84 | 68.9% |
| 4.0 – 4.49 (good) | 12 | 9.8% |
| 3.5 – 3.99 (acceptable) | 20 | 16.4% |
| 3.0 – 3.49 (weak) | 5 | 4.1% |
| < 3.0 (failing) | 1 | 0.8% |

Roughly 79% of prompts now score 4.0 or higher, and 96% score 3.5 or higher. Only 6 prompts (4.9%) remain below 3.5.

## Agents still below 3.0

| Agent | Score | Worst aspects |
|---|---|---|
| `sublinear-goal-planner` | 2.88 | trigger, structure, coordination, model_fit, antidrift, clarity |

This is the single remaining failing prompt. It is weak across six of the eight aspects (notably trigger, structure, and coordination) and is the obvious next remediation target.

## Weakest aspects across the whole roster

Even among passing prompts, the most frequently flagged weak aspects are:

| Aspect | Times flagged as worst |
|---|---|
| coordination | 56 |
| structure | 42 |
| clarity | 36 |
| boundary | 27 |
| antidrift | 23 |
| trigger | 18 |
| output_contract | 7 |
| model_fit | 5 |

**Coordination** (who an agent hands off to / its tier) and **structure** remain the systemic soft spots, so the next pass should focus there rather than on isolated agents.

## Verdict

**Remediation worked** — mean climbed 4.01 → 4.48 and sub-3.0 prompts collapsed from 25 to a single agent (`sublinear-goal-planner`), leaving coordination/structure as the only systemic gap to close next.

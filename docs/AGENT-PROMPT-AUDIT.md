# Agent Prompt Audit

Prompt-quality audit of the agent roster (123 findings entries covering ~106 unique agents; some agents were scored more than once). Each agent was scored 1–5 across trigger, boundary, structure, clarity, coordination, anti-drift, and model-fit, and given an overall average.

## Overall health

- **Mean score:** 4.01 / 5 — a polarized roster, not a uniformly-mediocre one.
- **High-quality (avg ≥ 4.5):** 64 / 123 = **52%**. The core/optimization/consensus/game-dev agents are genuinely strong (several at 4.9–5.0).
- **Good (4.0–4.49):** 15 = 12%.
- **Mid (3.0–3.99):** 19 = 15%.
- **Failing (avg < 3.0):** 25 = **20%** — one in five entries is below an acceptable bar.

| Band | Count | % |
|------|------:|--:|
| Exemplary (≥ 4.5) | 64 | 52% |
| Good (4.0–4.49) | 15 | 12% |
| Mid (3.0–3.99) | 19 | 15% |
| Failing (< 3.0) | 25 | 20% |

**Priority mix:** 30 high · 23 medium · 70 low. The high-priority set is the failing tail plus a few mid-band agents with hard correctness bugs (dangling handoffs, model contradictions, fabricated claims).

## Top weakest agents

The lowest-scoring agents. Nearly all share the same failure shape: a non-trigger description, missing standard section headers, hundreds of lines of code/template padding, and (often) fabricated capability claims.

| Agent | Avg | Weakest aspects | Top fix |
|-------|----:|-----------------|---------|
| test-long-runner | 2.13 | trigger, boundary, structure, coordination, model_fit, antidrift | It's a CI fixture, not a real agent — mark it "test-only / never for real work" or remove from the production roster; haiku tier contradicts its "complex analysis" body. |
| v3-performance-engineer | 2.25 | trigger, structure, antidrift, clarity | Body still hardcodes discredited `[150, 12500]` and `[2.49, 7.47]` targets — delete them (contradicts CLAUDE.md); cut ~300 lines of sample benchmark classes. |
| trading-predictor | 2.25 | trigger, boundary, coordination, antidrift, clarity | Remove physics-defying claims ("execute trades before market data arrives", "exceed light-speed"); reframe as a simulation/research tool; cut ~240 lines of marketing prose. |
| sparc-coder | 2.375 | trigger, structure, antidrift, clarity | Duplicate identity vs `refinement`/`sparc`; rename the template variant; cut ~200 lines of generic SOLID/sample-code filler (file ~255 lines). |
| migration-planner | 2.375 | trigger, structure, coordination, clarity | 737-line design doc, not a runtime agent (admits it) — move to `docs/` or shrink to a real contract; drop embedded duplicate agent YAML definitions. |
| memory-coordinator | 2.5 | trigger, structure, antidrift, clarity | Duplicates its own name; cut ~160 lines of aspirational "GDPR / sharding / compliance" capabilities it can't perform; add a trigger and disambiguate from `swarm-memory-manager`. |
| flow-nexus-auth | 2.5 | trigger, boundary, structure, antidrift | Frontmatter name ≠ filename; rewrite to a "Use when…" trigger; cut the GDPR claim it can't enforce; rename sections to standard; add Tier + sibling boundary. |
| mobile-dev | 2.5 | trigger, boundary, structure, coordination | Add trigger + sibling boundary (vs game-dev / frontend-specialist); add `## When to use` / `## Coordination`; reconcile `name` vs file `spec-mobile-react-native.md`. |
| pagerank-analyzer | 2.5 | all six | Cut ~270 lines of speculative code/capability lists; add trigger, sibling boundary (vs matrix-optimizer/performance-optimizer), Tier, and a real quality bar. |
| performance-optimizer | 2.5 | trigger, boundary, structure, clarity | ~360–380 lines of duplicated taxonomies + code; reduce to ~40; promote the buried `## Scope` differentiator to the top; add a trigger. |
| flow-nexus-workflow | 2.5 | trigger, boundary, structure, antidrift, clarity | Replace generic blurb with a trigger + sibling disambiguation; cut "Quality standards / Advanced features" fluff; add a real anti-drift guard and a Tier. |
| sublinear-goal-planner | 2.5–2.63 | trigger, structure, coordination, (antidrift), clarity | ~830-line file — cut JS dumps (behavior trees, A*, examples) to ~40 lines; remove "temporal advantage / light-speed" claims; trigger + sibling map to the top. |
| smart-agent | 2.75 | all six | Cut ~150 lines of fabricated ML pseudo-blocks (classifiers, predictive spawning); add trigger + standard sections; downgrade claims to honest heuristics. |
| codex-coordinator | 2.75 | trigger, structure, antidrift, clarity | ~200 lines of ASCII diagrams + repeated spawn snippets; lead with standard sections; add a trigger, Tier, and an explicit anti-drift bar. |
| system-architect | 2.75 | trigger, boundary, structure, coordination, antidrift | Add a router-disambiguating trigger; add `When to use` / `How you work` / `Coordination`(+Tier); add anti-drift ("design + ADR, never application code"). |
| flow-nexus-neural | 2.75 | trigger, boundary, structure, clarity | Trigger distinguishing it from `flow-nexus-sandbox` and `safla-neural`; cut the fabricated breadth (federated learning, ensembles, drift detection). |
| flow-nexus-swarm | 2.75 | trigger, boundary, structure, antidrift | Trigger + scope vs other flow-nexus / swarm coordinators; replace marketing prose with checkable behavior; convert to standard sections. |
| flow-nexus-user-tools | 2.75 | trigger, boundary, antidrift, clarity | Delete fabricated "AI categorization / threat detection / disaster recovery" claims; add trigger + concrete user-scoped invariants. |

(Several flow-nexus and SPARC agents recur — the whole family needs the same treatment, not individual hand-tuning.)

## Cross-cutting issues

The same handful of defects drive almost all low scores. Frequency of weakest-aspect flags across the 123 entries:

| Aspect | Times flagged |
|--------|--------------:|
| trigger | 41 |
| structure | 34 |
| clarity | 27 |
| coordination | 26 |
| boundary | 25 |
| antidrift | 24 |
| model_fit | 4 |

1. **No "Use when…" trigger (41×).** The single most common defect. Descriptions open with a role label ("X specialist —") or a bare capability blurb instead of a router-keyable trigger. Even many otherwise-strong agents have this as their only nit. This directly degrades routing and causes sibling collisions.
2. **Non-standard / missing section headers (34×).** Two distinct problems: (a) good agents that use `Deliverable`/`Core practices`/`Read first` instead of the standard `Output contract`/`How you work` (cosmetic but breaks the section check), and (b) failing agents missing whole sections (`When to use`, `Coordination`, `Quality bar & anti-drift`) entirely.
3. **Padding / bloat (clarity, 27×).** A cluster of agents are 200–830 lines of ASCII diagrams, copy-paste code samples, and restated bullet taxonomies that bury the actual contract and blow past the 500-line bar in CLAUDE.md: performance-optimizer (~380), sublinear-goal-planner (~830), migration-planner (737), pagerank-analyzer (~270), code-goal-planner (~400), v3-performance-engineer (~375), trading-predictor (~240). A prompt should specify behavior, not ship implementation.
4. **Missing Tier / weak coordination (26×).** Many agents (even exemplary ones) name real handoff targets but never state their own Tier, so the routing graph is incomplete. A few have **dangling handoffs** that fail connectivity: `v3-queen-coordinator` (should be `queen-coordinator`), `backend-dev` (should be `dev-backend-api`), `Agent #3/#4` by number, `cicd-engineer` vs `ops-cicd-github`.
5. **Weak/overlapping boundaries (25×).** Sibling families silently overlap with no "use me vs siblings" line: the flow-nexus set, the sublinear optimizers (matrix-optimizer / pagerank-analyzer / performance-optimizer / trading-predictor), the goal-planners (goal-planner / code-goal-planner / sublinear-goal-planner / goal-planner-reasoning), the two payment agents (agentic-payments vs flow-nexus-payments), and the memory coordinators.
6. **Fabricated / unverifiable claims (anti-drift, 24×).** The most serious correctness issue. Agents assert capabilities or numbers they cannot back: "execute trades before market data arrives," ML pipelines that don't exist, GDPR enforcement, and — critically — **v3-performance-engineer still hardcodes the discredited `150x–12,500x` and Flash-Attention `2.49–7.47x` figures that CLAUDE.md explicitly marks as NOT reproduced / unverified.**
7. **Duplicate-identity / template self-reference.** Several `templates/*` files set `name:` to the canonical agent and then claim "the canonical agent is `<self>`": perf-analyzer, sparc-coder, sparc-coord, memory-coordinator, plus code-analyzer/analyst pointing its handoffs at itself. These silently collide with the real agent in the router.
8. **Model mis-tier (model_fit, 4×, but high-impact).** Frontmatter/body contradictions a router can't resolve: **security-auditor** (frontmatter `opus`, body says default `sonnet`), **production-validator** (frontmatter `opus`, body says default `sonnet`), **task-orchestrator** and **test-long-runner** (`haiku` budget but bodies claim re-planning / complex-analysis reasoning).

## Prioritized improvement plan

### High priority — correctness bugs and the failing tail (≈30 agents)

These either return wrong routing/handoffs, assert fabricated claims, or score below 3.0.

1. **Strip fabricated claims first (anti-drift / honesty).** Delete the hardcoded `[150,12500]` / `[2.49,7.47]` literals in v3-performance-engineer; remove the light-speed/"trade before data arrives" claims in trading-predictor and sublinear-goal-planner/performance-optimizer; cut the unimplemented ML/GDPR/threat-detection capabilities in smart-agent, memory-coordinator, flow-nexus-user-tools, flow-nexus-neural.
2. **Fix dangling handoffs and model contradictions.** Replace `v3-queen-coordinator`→`queen-coordinator`, `backend-dev`→`dev-backend-api`, by-number "Agent #3/#4" → real names; verify `cicd-engineer`/`sparc-coord`/`consensus-coordinator` resolve. Reconcile security-auditor and production-validator frontmatter `opus` vs body `sonnet` (pick one, the router reads frontmatter).
3. **Resolve template/self-reference duplicates.** Rename `*-template` variants or merge them into the canonical agent: perf-analyzer, sparc-coder, sparc-coord, memory-coordinator, and the code-analyzer/analyst self-handoff.
4. **De-bloat the worst offenders to standard sections.** Cut sublinear-goal-planner (~830→~40), migration-planner (737→doc or contract), performance-optimizer (~380→~40), pagerank-analyzer, code-goal-planner, v3-performance-engineer down to: `When to use` (trigger) / `How you work` / `Output contract` / `Coordination` (+Tier) / `Quality bar & anti-drift` / `Model & cost`.
5. **Decide test-long-runner's fate** — explicitly fence it as a CI-only fixture or remove it from the production roster.

### Medium priority — mid-band agents with one structural gap (≈23 agents)

6. **Add triggers + sibling boundaries** to flow-nexus-payments, flow-nexus-challenges, flow-nexus-sandbox-family, agentic-payments, matrix-optimizer, task-orchestrator, database-specialist, python-specialist, api-docs, base-template-generator, goal-planner. One "Use when…" line + one "use me vs siblings" line each.
7. **Fix frontend-specialist's dangling refs** (`backend-dev`→`dev-backend-api`, pin bare `architect`/`reviewer`) and sharpen its a11y overlap with accessibility-specialist.
8. **Disambiguate the family clusters** with a single shared boundary convention: flow-nexus (auth→compute→billing→neural), sublinear optimizers, goal-planners, payment agents, memory coordinators.

### Low priority — cosmetic consistency on the strong 64 (≈70 agents)

9. **Section-header alignment (mechanical, scriptable).** Rename `Deliverable`→`Output contract` and `Core practices`→`How you work` across the many exemplary agents flagged only for header drift (accessibility-specialist, technical-writer, technical-artist, debugger, gameplay-programmer, incident-responder, etc.). This is the single highest-leverage low-priority pass — it raises section-check compliance roster-wide with near-zero risk.
10. **Add explicit Tier labels** to Coordination sections that name handoffs but omit a Tier (reviewer, researcher, tester, data-engineer, ml-developer, many others).
11. **Front-load triggers** on the strong agents whose description leads with a role label before the "Use when/Use to…" clause (load-balancer, queen-coordinator, adaptive-coordinator, swarm-memory-manager, project-board-sync, observability-engineer, etc.) — pure reordering.
12. **Add one-line model justifications** to the bare `Default sonnet.` notes (character-animator, workflow-automation, game-designer, resource-allocator, refinement).

### Suggested execution order

A scriptable codemod pass for #9–#11 (header rename + trigger reorder) clears most of the 70 low-priority flags cheaply and lifts overall section-check compliance. Then a focused high-priority pass (#1–#5) on the ~30 failing/buggy agents addresses the real routing and honesty risks. Treat the family clusters (flow-nexus, sublinear, goal-planners) as batches with a shared boundary template rather than agent-by-agent.

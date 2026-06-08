# Advanced agents (archived — not loaded by Claude Code)

These ~20 agents were moved **out** of `.claude/agents/` so Claude Code no longer
loads them into the active roster (less clutter, cleaner routing). They remain
valid reference targets — active coordinators can still mention them by name, and
`scripts/check-agents.mjs` keeps their names in its connectivity set.

**Why archived:** they're niche for the project types in use (Android game,
web-scraping service). You don't need Byzantine consensus or the Flow Nexus cloud
platform to ship those.

| Group | Agents | When you'd want them |
|-------|--------|----------------------|
| `consensus/` | byzantine/raft/gossip/quorum/crdt + security-manager, performance-benchmarker | distributed-systems agreement, hive-mind runs |
| `sublinear/` | matrix-optimizer, pagerank-analyzer, performance-optimizer, trading-predictor | sublinear-algorithm / graph / HFT modeling |
| `flow-nexus/` | app-store, auth, challenges, neural-network, payments, sandbox, swarm, user-tools, workflow | the Flow Nexus cloud platform |

## Restore one (or all)
```bash
# bring a whole group back into the active set:
git mv agents-advanced/consensus .claude/agents/consensus
node scripts/check-agents.mjs        # revalidates + regenerates the catalog + counts
```

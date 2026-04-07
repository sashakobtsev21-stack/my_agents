# ADR-076: Bridge Claude Code Auto-Memory to AgentDB Vector Search

**Status**: Implemented
**Date**: 2026-04-07
**Branch**: `feat/claude-code-memory-bridge`
**Related**: ADR-048 (AutoMemoryBridge), ADR-075 (learning pipeline)

## Context

Claude Code's auto-memory system stores project knowledge in `~/.claude/projects/*/memory/MEMORY.md` files with YAML frontmatter. Ruflo's AgentDB stores data in sql.js with ONNX embeddings (all-MiniLM-L6-v2, 384d) for semantic vector search. These two systems were disconnected — data in one was invisible to the other.

The `auto-memory-hook.mjs` (SessionStart/SessionEnd) imported MEMORY.md entries into a flat JSON file (`auto-memory-store.json`) but never vectorized them. AgentDB's intelligence module (SONA, ReasoningBank) learned patterns but never fed them back to Claude Code's memory.

## Decision

Wire bidirectional bridge between Claude Code auto-memory and AgentDB:

### SessionStart (import)
1. `AutoMemoryBridge.importFromAutoMemory()` reads MEMORY.md files → JSON backend (existing)
2. **NEW**: Each imported entry gets stored into sql.js via `memory-initializer.storeEntry()` with `generateEmbeddingFlag: true` → ONNX 384-dim vector generated
3. Entries become searchable via AgentDB's semantic vector search

### SessionEnd (sync)
1. `AutoMemoryBridge.syncToAutoMemory()` writes insights back to MEMORY.md (existing)
2. **NEW**: `intelligence.flushPatterns()` persists SONA/ReasoningBank learned patterns to disk
3. Patterns survive across sessions

## Architecture

```
Claude Code Auto-Memory                    AgentDB (sql.js + ONNX)
~/.claude/projects/*/memory/*.md           .swarm/memory.db
         │                                        ▲
         │ SessionStart hook                      │
         ▼                                        │
auto-memory-hook.mjs ─── import ──► JSON store ──►│ storeEntry()
         │                          (flat)        │ + generateEmbedding()
         │                                        │ → 384-dim ONNX vector
         │ SessionEnd hook                        │
         ▼                                        │
auto-memory-hook.mjs ─── sync ───► MEMORY.md      │
         │                                        │
         └── flushPatterns() ─────────────────────┘
                                    Intelligence module
                                    (SONA + ReasoningBank)
```

## What This Enables

| Before | After |
|--------|-------|
| MEMORY.md searchable by keyword only | MEMORY.md entries searchable by semantic similarity |
| AgentDB can't see Claude Code memories | AgentDB indexes all auto-memory entries with vectors |
| Learned patterns lost between sessions | SONA/ReasoningBank patterns flushed to disk on session end |
| Two disconnected stores | Single query searches both stores |

## Files Changed

- `.claude/helpers/auto-memory-hook.mjs` — vectorization bridge + pattern flush
- `v3/implementation/adrs/ADR-076-claude-code-memory-bridge.md` — this ADR

## References

- [ruDevolution](https://github.com/ruvnet/rudevolution) — Claude Code internals analysis
- Research doc: `07-context-and-session-management.md` — auto-memory paths and env vars
- ADR-048: AutoMemoryBridge design
- ADR-075: Self-learning pipeline wiring

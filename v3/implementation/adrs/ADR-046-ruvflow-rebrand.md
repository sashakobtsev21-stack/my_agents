# ADR-046: Rebrand Umbrella Package to RuvFlow

**Status:** Proposed
**Date:** 2026-02-07
**Authors:** RuvNet, Claude Flow Team

## Context

The umbrella package is currently published to npm as `claude-flow`. As the ecosystem grows and the product establishes its own identity, there are compelling reasons to rebrand to `ruvflow`.

### Current State

| Aspect | Current Value |
|--------|---------------|
| npm package | `claude-flow` |
| CLI binary | `claude-flow` |
| GitHub repo | ruvnet/claude-flow |
| Internal packages | @claude-flow/* |
| Weekly downloads | ~1,000+ |

### Drivers for Change

1. **Brand Cohesion**: Aligns with the ruv ecosystem (ruv.io, @ruvector/*, ruv-swarm)
2. **Trademark Safety**: Removes potential trademark concerns with "Claude" in product name
3. **Product Identity**: Establishes independent product identity beyond Claude integration
4. **Discoverability**: "ruvflow" is unique, memorable, and searchable
5. **Future Flexibility**: Enables the platform to support multiple AI backends without name confusion

## Decision

Rebrand the umbrella npm package from `claude-flow` to `ruvflow` while maintaining the internal `@claude-flow/*` package structure.

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| npm package name | `claude-flow` | `ruvflow` |
| CLI binary name | `claude-flow` | `ruvflow` |
| Install command | `npx claude-flow@latest` | `npx ruvflow@latest` |
| README branding | "Claude-Flow" | "RuvFlow" |
| Product name | Claude-Flow | RuvFlow |

### What Stays the Same

| Aspect | Value | Reason |
|--------|-------|--------|
| GitHub repo | ruvnet/claude-flow | SEO, existing links, history |
| Internal packages | @claude-flow/* | Minimal disruption, existing integrations |
| Functionality | All features | No functional changes |
| License | MIT | No change |
| Author | RuvNet | No change |

## Consequences

### Positive

1. **Unified Brand**: All ruv-prefixed packages under one ecosystem
2. **Professional Image**: Independent product identity
3. **Trademark Safety**: Eliminates any potential trademark concerns
4. **Marketing**: Easier to market as standalone product
5. **Future Proof**: Can add non-Claude integrations without name confusion

### Negative

1. **Migration Effort**: Users must update install commands
2. **Documentation**: ~545 README references to update
3. **SEO Impact**: Temporary reduction in discoverability
4. **Learning Curve**: Users familiar with "claude-flow" must learn new name

### Neutral

1. **GitHub repo unchanged**: Existing links continue to work
2. **Internal packages unchanged**: No code changes required in @claude-flow/*

## Implementation

### Phase 1: Preparation (This PR)

1. Create ADR-046 (this document)
2. Update package.json with new name and bin
3. Update README.md with RuvFlow branding
4. Update install scripts

### Phase 2: Publishing

1. Publish `ruvflow@3.2.0-alpha.1` to npm
2. Add dist-tags: latest, alpha, v3alpha
3. Update old `claude-flow` with deprecation notice

### Phase 3: Migration Support

1. Keep `claude-flow` on npm with deprecation notice
2. Both packages point to same @claude-flow/cli
3. Documentation shows both old and new commands during transition

### Phase 4: Cleanup (60 days later)

1. Remove deprecation notices
2. Update all external documentation
3. Consider archiving claude-flow package

## Alternatives Considered

### 1. Keep claude-flow

**Pros:** No migration effort, existing brand recognition
**Cons:** Trademark risk, no brand cohesion with ruv ecosystem
**Decision:** Rejected - brand cohesion and trademark safety more important

### 2. Rename to ruv-flow (hyphenated)

**Pros:** Matches ruv-swarm pattern
**Cons:** Inconsistent with @ruvector (no hyphen)
**Decision:** Rejected - "ruvflow" is cleaner and matches ruvector pattern

### 3. Rename internal packages too (@ruvflow/*)

**Pros:** Complete rebrand
**Cons:** Major breaking change, complex migration, npm scope registration
**Decision:** Rejected - disruption not worth the benefit

### 4. Use ruv-agents or ruv-orchestrator

**Pros:** More descriptive
**Cons:** Too long, not memorable
**Decision:** Rejected - "ruvflow" captures the essence of agent flow

## Migration Guide

### For Users

```bash
# Old way (deprecated but still works)
npx claude-flow@latest init

# New way
npx ruvflow@latest init

# Update existing projects
sed -i 's/npx claude-flow/npx ruvflow/g' package.json scripts/*.sh

# MCP configuration update
claude mcp remove claude-flow
claude mcp add ruvflow npx ruvflow@latest mcp start
```

### For Contributors

1. README examples use `ruvflow` command
2. Internal imports remain `@claude-flow/*`
3. GitHub repo remains `ruvnet/claude-flow`

## Metrics for Success

| Metric | Target | Measurement |
|--------|--------|-------------|
| npm downloads | Maintain or grow | npm weekly stats |
| GitHub stars | Maintain or grow | GitHub metrics |
| Issues from confusion | < 10 in 30 days | GitHub issues |
| Documentation clarity | No user complaints | GitHub issues |

## References

- GitHub Issue: #1101
- npm: https://npmjs.com/package/ruvflow (after publishing)
- Related: ADR-017 (RuVector Integration)

## Appendix: Branding Guidelines

### Product Names

| Context | Use |
|---------|-----|
| npm package | `ruvflow` (lowercase) |
| README title | "RuvFlow" (PascalCase) |
| CLI binary | `ruvflow` (lowercase) |
| In prose | "RuvFlow" (PascalCase) |

### Command Examples

```bash
# Always use lowercase in commands
npx ruvflow@latest init
npx ruvflow@latest agent spawn -t coder
npx ruvflow@latest swarm init --topology hierarchical
```

### Logo and Visual Assets

- Update banner image with "RuvFlow" branding (post-rebrand)
- Maintain blue/purple color scheme
- Keep wave/flow visual metaphor

---

**Decision Date:** 2026-02-07
**Review Date:** 2026-03-07 (30 days post-implementation)

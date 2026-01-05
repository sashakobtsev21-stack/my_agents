# V3 Init System

Comprehensive initialization system for Claude Flow V3 with Claude Code integration.

## Overview

The V3 init system creates a complete Claude Code integration setup including:
- `.claude/` directory with settings, skills, commands, agents, and helpers
- `.claude-flow/` directory for V3 runtime configuration
- `.mcp.json` for MCP server configuration

## Quick Start

```bash
# Default initialization (recommended settings)
claude-flow init

# Interactive wizard
claude-flow init wizard

# Minimal setup (core features only)
claude-flow init --minimal

# Full setup (all components)
claude-flow init --full
```

## Architecture

```
v3/@claude-flow/cli/src/init/
├── types.ts              # Configuration interfaces
├── settings-generator.ts # settings.json with hooks
├── mcp-generator.ts      # .mcp.json configuration
├── statusline-generator.ts # Shell statusline scripts
├── helpers-generator.ts  # Utility helper scripts
├── executor.ts           # Main execution logic
└── index.ts              # Module exports
```

## Generated Structure

```
project/
├── .claude/
│   ├── settings.json     # Claude Code hooks configuration
│   ├── skills/           # Claude Code skills
│   ├── commands/         # Claude Code commands
│   ├── agents/           # Agent definitions
│   └── helpers/          # Utility scripts
├── .claude-flow/
│   ├── config.yaml       # V3 runtime configuration
│   ├── data/             # Persistent data storage
│   ├── logs/             # Log files
│   ├── sessions/         # Session archives
│   ├── hooks/            # Custom hooks
│   ├── agents/           # Agent state
│   └── workflows/        # Workflow definitions
└── .mcp.json             # MCP server configuration
```

## Documentation

- [Configuration Options](./CONFIGURATION.md) - All configuration options
- [Hooks Reference](./HOOKS.md) - Generated hooks documentation
- [Components](./COMPONENTS.md) - Component details
- [API Reference](./API.md) - Programmatic API usage

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize with default settings |
| `init wizard` | Interactive setup wizard |
| `init check` | Check initialization status |
| `init skills` | Install only skills |
| `init hooks` | Initialize only hooks |

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--force` | `-f` | Overwrite existing files |
| `--minimal` | `-m` | Minimal configuration |
| `--full` | | Full configuration with all components |
| `--skip-claude` | | Skip .claude/ directory |
| `--only-claude` | | Only create .claude/ directory |

## Presets

### Default
Recommended settings for most projects:
- Core skills, AgentDB, GitHub, V3 skills
- All command groups
- Core, GitHub, SPARC, Swarm agents
- All 7 hook types enabled
- Hierarchical-mesh topology
- 15 max agents
- Hybrid memory backend

### Minimal
Lightweight configuration:
- Core skills only
- Core agents only
- Essential hooks (PreToolUse, PostToolUse, PermissionRequest)
- Mesh topology
- 5 max agents
- In-memory backend

### Full
Everything enabled:
- All skill sets including Flow Nexus
- All command groups
- All agent categories
- All hook types
- All MCP servers

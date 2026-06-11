/**
 * V3 Plugin Interface
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Microkernel pattern for extensible Claude-Flow V3
 * Enables modular extension points for agents, tasks, MCP tools, CLI commands, and memory backends
 */

import type { IEventBus } from './core/interfaces/event.interface.js';
import type { IAgentConfig } from './core/interfaces/agent.interface.js';
import type { MCPTool } from './types/mcp.types.js';

/**
 * Logger interface for plugin context
 */

// Split into ./plugin-interface-core.ts + ./plugin-interface-extended.ts during campaign-2 wave W308.
export * from './plugin-interface-core.js';
export * from './plugin-interface-extended.js';

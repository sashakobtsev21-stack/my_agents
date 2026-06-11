/**
 * Claude Flow V3 - Modular AI Agent Coordination System
 *
 * This is the main entry point that re-exports all @claude-flow modules.
 * Each module can also be imported directly for tree-shaking.
 *
 * @example
 * // Import everything
 * import * as claudeFlow from '@claude-flow/v3';
 *
 * // Or import specific modules
 * import { UnifiedSwarmCoordinator } from '@claude-flow/swarm';
 * import { PasswordHasher } from '@claude-flow/security';
 * import { HNSWIndex } from '@claude-flow/memory';
 *
 * Complete reimagining based on 10 ADRs:
 * - ADR-001: Adopt agentic-flow as core foundation
 * - ADR-002: Domain-Driven Design structure
 * - ADR-003: Single coordination engine
 * - ADR-004: Plugin-based architecture
 * - ADR-005: MCP-first API design
 * - ADR-006: Unified memory service
 * - ADR-007: Event sourcing for state changes
 * - ADR-008: Vitest over Jest
 * - ADR-009: Hybrid memory backend default
 * - ADR-010: Remove Deno support (Node.js 20+ only)
 *
 * Performance Targets:
 * - Flash Attention: Flash Attention speedup (unverified)
 * - AgentDB Search: ~1.9x-4.7x (measured) improvement
 * - Memory Reduction: 50-75%
 * - Code Reduction: <5,000 lines (vs 15,000+)
 * - Startup Time: <500ms
 *
 * @module @claude-flow/v3
 * @version 3.0.0-alpha.1
 */

// Split into ./index-core.ts + ./index-extended.ts during campaign-2 wave W307.
export * from './index-core.js';
export * from './index-extended.js';

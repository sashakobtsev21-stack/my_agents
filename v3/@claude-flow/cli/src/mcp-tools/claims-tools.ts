/**
 * Claims MCP Tools for CLI
 *
 * Implements MCP tools for ADR-016: Collaborative Issue Claims
 * Provides programmatic access to claim operations for MCP clients.
 *
 * @module @claude-flow/cli/mcp-tools/claims
 */

import type { MCPTool } from './types.js';

// Inline claim service since we can't import external modules

// Store helpers + the two tool groups extracted into the sub-modules
// below during campaign-2 wave 20 (W226). The single public export
// (claimsTools) is reassembled byte-equivalently.
import { claimsCoreTools } from './claims-tools-core.js';
import { claimsStealingTools } from './claims-tools-stealing.js';

export const claimsTools: MCPTool[] = [
  ...claimsCoreTools,
  ...claimsStealingTools,
];

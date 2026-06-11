/**
 * Browser MCP Tools
 *
 * CLI integration for @claude-flow/browser package.
 * Provides browser automation tools for web navigation, interaction, and data extraction.
 */


import type { MCPTool } from './types.js';
// Session registry + the tool defs were extracted into the sub-modules
// below during campaign-2 wave 76 (W282).
import { browserToolDefs } from './browser-tools-defs.js';

export const browserTools: MCPTool[] = browserToolDefs;

export default browserTools;

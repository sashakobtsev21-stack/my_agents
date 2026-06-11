/**
 * Performance MCP Tools for CLI
 *
 * V2 Compatibility - Performance monitoring and optimization tools
 *
 * ✅ Uses REAL process metrics where available:
 * - process.memoryUsage() for real heap/memory stats
 * - process.cpuUsage() for real CPU time
 * - os module for system load and memory
 * - Real timing for benchmark operations
 */

import type { MCPTool } from './types.js';
// Store helpers + the tool defs were extracted into the sub-modules
// below during campaign-2 wave 74 (W280). The single public export
// (performanceTools) is re-exposed here.
import { performanceToolDefs } from './performance-tools-defs.js';

export const performanceTools: MCPTool[] = performanceToolDefs;

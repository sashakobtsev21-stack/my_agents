/**
 * System MCP Tools for CLI
 *
 * V2 Compatibility - System monitoring tools: status, metrics, health
 *
 * ✅ Uses REAL system metrics via Node.js APIs:
 * - process.memoryUsage() for real memory stats
 * - process.cpuUsage() for real CPU stats
 * - os module for system information
 */


import type { MCPTool } from './types.js';
// Store helpers + the tool defs were extracted into the sub-modules
// below during campaign-2 wave 75 (W281).
import { systemToolDefs } from './system-tools-defs.js';

export const systemTools: MCPTool[] = systemToolDefs;

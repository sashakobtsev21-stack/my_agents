/**
 * Hive-Mind MCP Tools for CLI
 *
 * Tool definitions for collective intelligence and swarm coordination.
 */

// This file is now a thin registrar: it assembles hiveMindTools[] from
// the tool objects + helpers extracted into the ./hive-mind-tools/
// directory during the P3.22 god-file decomposition (W139-W140).
// Sub-modules: helpers · tools
import { type MCPTool } from './types.js';
import {
  hiveMindSpawn, hiveMindInit, hiveMindStatus, hiveMindJoin, hiveMindLeave,
  hiveMindConsensus, hiveMindBroadcast, hiveMindShutdown, hiveMindMemory,
  hiveMindOptimizeMemory,
} from './hive-mind-tools/tools.js';

export const hiveMindTools: MCPTool[] = [
  hiveMindSpawn,
  hiveMindInit,
  hiveMindStatus,
  hiveMindJoin,
  hiveMindLeave,
  hiveMindConsensus,
  hiveMindBroadcast,
  hiveMindShutdown,
  hiveMindMemory,
  hiveMindOptimizeMemory,
];

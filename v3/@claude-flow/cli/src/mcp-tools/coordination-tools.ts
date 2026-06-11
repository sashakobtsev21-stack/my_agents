/**
 * Coordination MCP Tools for CLI
 *
 * V2 Compatibility - Swarm coordination and orchestration tools
 *
 * ⚠️ IMPORTANT: These tools provide LOCAL STATE MANAGEMENT.
 * - Topology/consensus state is tracked locally
 * - No actual distributed coordination
 * - Useful for single-machine workflow orchestration
 */


import type { MCPTool } from './types.js';
// Store + the two tool groups extracted into the sub-modules below
// during campaign-2 wave 48 (W254). The single public export
// (coordinationTools) is reassembled byte-equivalently.
import { coordinationTopologyTools } from './coordination-tools-topology.js';
import { coordinationConsensusTools } from './coordination-tools-consensus.js';

export const coordinationTools: MCPTool[] = [
  ...coordinationTopologyTools,
  ...coordinationConsensusTools,
];

/**
 * @claude-flow/browser - MCP Tools
 * 50+ browser automation tools for claude-flow MCP server
 *
 * This file is now a thin registrar: it assembles browserTools[] from the
 * category groups + infra extracted into the ./browser-tools/ directory
 * during the P3.27 god-file decomposition (W146). Sub-modules:
 *   helpers · tools-a · tools-b (+ the pre-existing signed-trajectory-tools)
 */

import { signedTrajectoryTools } from './signed-trajectory-tools.js';
import type { MCPTool } from './browser-tools/helpers.js';
import {
  navigationTools, snapshotTools, interactionTools,
  getInfoTools, stateTools, waitTools,
} from './browser-tools/tools-a.js';
import {
  evalTools, storageTools, networkTools, tabTools,
  settingsTools, debugTools, findTools,
} from './browser-tools/tools-b.js';

// Re-export the MCPTool type + session helpers so external callers that
// imported them from './browser-tools.js' keep resolving byte-identically.
export type { MCPTool } from './browser-tools/helpers.js';
export { getAdapter, sessions } from './browser-tools/helpers.js';

export const browserTools: MCPTool[] = [
  ...navigationTools,
  ...snapshotTools,
  ...interactionTools,
  ...getInfoTools,
  ...stateTools,
  ...waitTools,
  ...evalTools,
  ...storageTools,
  ...networkTools,
  ...tabTools,
  ...settingsTools,
  ...debugTools,
  ...findTools,
  ...signedTrajectoryTools, // ADR-122 Phase 1
];

export default browserTools;

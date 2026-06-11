/**
 * Workflow MCP Tools for CLI
 *
 * Tool definitions for workflow automation and orchestration.
 */


import type { MCPTool } from './types.js';
// The store helpers and the three tool groups were extracted into the
// sub-modules below during campaign-2 wave 11 (W217). All were
// module-private; the single public export (workflowTools) is
// reassembled here byte-equivalently.
import { workflowExecTools } from './workflow-tools-exec.js';
import { workflowLifecycleTools } from './workflow-tools-lifecycle.js';
import { workflowTemplatesTools } from './workflow-tools-templates.js';

export const workflowTools: MCPTool[] = [
  ...workflowExecTools,
  ...workflowLifecycleTools,
  ...workflowTemplatesTools,
];

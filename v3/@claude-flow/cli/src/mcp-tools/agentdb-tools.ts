/**
 * AgentDB MCP Tools — Phase 6 of ADR-053
 *
 * Exposes AgentDB v3 controller operations as MCP tools.
 * Provides direct access to ReasoningBank, CausalGraph, SkillLibrary,
 * AttestationLog, and bridge health through the MCP protocol.
 *
 * Security: All handlers validate input types, enforce length bounds,
 * and sanitize error messages before returning to MCP callers.
 *
 * @module v3/cli/mcp-tools/agentdb-tools
 */

// This file is now a thin registrar: it assembles agentdbTools[] from the
// tool objects + helpers extracted into the ./agentdb-tools/ directory
// during the P3.15 god-file decomposition (W120-W123). Sub-modules:
//   helpers · graph-edge · graph · pattern · tools-a · tools-b
import type { MCPTool } from './types.js';
import { agentdbGraphQuery, agentdbGraphPathfinder } from './agentdb-tools/graph.js';
import { agentdbPatternStore, agentdbPatternSearch, agentdbFeedback } from './agentdb-tools/pattern.js';
import {
  agentdbHealth,
  agentdbControllers,
  agentdbCausalEdge,
  agentdbRoute,
  agentdbSessionStart,
  agentdbSessionEnd,
  agentdbHierarchicalStore,
  agentdbHierarchicalRecall,
} from './agentdb-tools/tools-a.js';
import {
  agentdbConsolidate,
  agentdbBatch,
  agentdbContextSynthesize,
  agentdbSemanticRoute,
  agentdbHierarchicalDelete,
  agentdbCausalEdgeDelete,
  agentdbCausalNodeDelete,
} from './agentdb-tools/tools-b.js';

// Re-export every tool object so external/test callers that import them
// by name from this module keep resolving byte-identically.
export { agentdbGraphQuery, agentdbGraphPathfinder } from './agentdb-tools/graph.js';
export { agentdbPatternStore, agentdbPatternSearch, agentdbFeedback } from './agentdb-tools/pattern.js';
export {
  agentdbHealth,
  agentdbControllers,
  agentdbCausalEdge,
  agentdbRoute,
  agentdbSessionStart,
  agentdbSessionEnd,
  agentdbHierarchicalStore,
  agentdbHierarchicalRecall,
} from './agentdb-tools/tools-a.js';
export {
  agentdbConsolidate,
  agentdbBatch,
  agentdbContextSynthesize,
  agentdbSemanticRoute,
  agentdbHierarchicalDelete,
  agentdbCausalEdgeDelete,
  agentdbCausalNodeDelete,
} from './agentdb-tools/tools-b.js';

// ===== Export all tools =====

export const agentdbTools: MCPTool[] = [
  agentdbHealth,
  agentdbControllers,
  agentdbPatternStore,
  agentdbPatternSearch,
  agentdbFeedback,
  agentdbCausalEdge,
  agentdbCausalEdgeDelete,
  agentdbCausalNodeDelete,
  agentdbRoute,
  agentdbSessionStart,
  agentdbSessionEnd,
  agentdbHierarchicalStore,
  agentdbHierarchicalRecall,
  agentdbHierarchicalDelete,
  agentdbConsolidate,
  agentdbBatch,
  agentdbContextSynthesize,
  agentdbSemanticRoute,
  agentdbGraphQuery,       // ADR-130 Phase 2
  agentdbGraphPathfinder,  // ADR-130 Phase 5
];

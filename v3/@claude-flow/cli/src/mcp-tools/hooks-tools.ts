/**
 * Hooks MCP Tools
 * Provides intelligent hooks functionality via MCP protocol
 */

import { type MCPTool } from './types.js';
// basePath state + setHooksToolsBasePath helper extracted to
// hooks-tools/base-path.ts so helper modules share it without a
// circular dep on this main file. Re-exported to preserve the public
// surface. (projectRoot itself is no longer consumed inline in this
// file — every callsite moved with its tool extraction.)
import { setHooksToolsBasePath } from './hooks-tools/base-path.js';
export { setHooksToolsBasePath };

// Routing outcomes + static task patterns extracted to
// hooks-tools/routing-patterns.ts (pilot god-file decomposition, P3.2).
// loadRoutingOutcomes no longer used inline here — every consumer moved
// to extracted tool modules.

// Neural lazy loaders + memory-store stats aggregator are now consumed
// only by extracted tool modules — no inline callers remain in this
// parent file.

// Memory search/store lazy loaders + scrubReasoningBlocks extracted to
// ./hooks-tools/memory-search-store.ts (W34, P3.2 cut #4). scrubReasoning
// Blocks is re-exported below to keep the public surface byte-identical.
import { scrubReasoningBlocks } from './hooks-tools/memory-search-store.js';
export { scrubReasoningBlocks };

// =============================================================================
// Neural Module Lazy Loaders (SONA, EWC++, MoE, LoRA, Flash Attention)
// =============================================================================

// SONA / EWC++ / MoE lazy loaders moved to ./hooks-tools/neural-loaders.ts
// (W33, P3.2 cut #3). Same pattern as flashAttention + loraAdapter
// below — also moved to that file.

// Semantic router (state + embedding fn + lazy init with native VectorDb
// → pure-JS SemanticRouter fallback) moved to
// ./hooks-tools/semantic-router.ts (W35, P3.2 cut #5).
// (Direct callers extracted into tools-route.ts in W39 — no remaining
// inline consumer in this parent file.)

// Routing outcomes + static task patterns moved to
// ./hooks-tools/routing-patterns.ts (W31 god-file decomposition pilot).

// getRouterBackendInfo() was a status-display helper that hasn't had a
// caller since the route status payload format flattened. Kept the doc
// strings in the constants below (routerBackend enum) so the same info
// is reachable directly. Dropped to silence noUnusedLocals.

// flashAttention + loraAdapter lazy loaders moved to
// ./hooks-tools/neural-loaders.ts (W33, P3.2 cut #3).

// Trajectory state (TrajectoryStep / TrajectoryData interfaces +
// activeTrajectories Map) moved to ./hooks-tools/trajectory-state.ts
// (W36, P3.2 cut #6).
// activeTrajectories no longer used directly here — all consumers moved
// to extracted tools modules (trajectory + intelligence-init).

// Memory store types and helpers

// hooksPreEdit + hooksPostEdit moved to ./hooks-tools/tools-edit.ts
// (W37, P3.2 cut #7 — first MCP tool cut). Local binding via named
// import + re-export so the hooksTools[] array at the bottom of this
// file (which references the bare names) plus external imports both
// continue to work.
import { hooksPreEdit, hooksPostEdit } from './hooks-tools/tools-edit.js';
export { hooksPreEdit, hooksPostEdit };

// hooksPreCommand + hooksPostCommand moved to ./hooks-tools/tools-command.ts
// (W38, P3.2 cut #8). Same pattern as W37 edit pair: local binding +
// re-export so both the hooksTools[] array and external callers stay
// byte-identical.
import { hooksPreCommand, hooksPostCommand } from './hooks-tools/tools-command.js';
export { hooksPreCommand, hooksPostCommand };

// hooksRoute + hooksExplain moved to ./hooks-tools/tools-route.ts
// (W39, P3.2 cut #9). Same pattern.
import { hooksRoute, hooksExplain } from './hooks-tools/tools-route.js';
export { hooksRoute, hooksExplain };

// hooksPreTask + hooksPostTask moved to ./hooks-tools/tools-task.ts
// (W40, P3.2 cut #10). Same pattern.
import { hooksPreTask, hooksPostTask } from './hooks-tools/tools-task.js';
export { hooksPreTask, hooksPostTask };

// hooksPretrain + hooksBuildAgents moved to ./hooks-tools/tools-pretrain.ts
// (W41, P3.2 cut #11).
import { hooksPretrain, hooksBuildAgents } from './hooks-tools/tools-pretrain.js';
export { hooksPretrain, hooksBuildAgents };

// hooksSessionStart + hooksSessionEnd + hooksSessionRestore moved to
// ./hooks-tools/tools-session.ts (W42, P3.2 cut #12).
import { hooksSessionStart, hooksSessionEnd, hooksSessionRestore } from './hooks-tools/tools-session.js';
export { hooksSessionStart, hooksSessionEnd, hooksSessionRestore };

// hooksTrajectoryStart + hooksTrajectoryStep + hooksTrajectoryEnd moved
// to ./hooks-tools/tools-trajectory.ts (W43, P3.2 cut #13).
import { hooksTrajectoryStart, hooksTrajectoryStep, hooksTrajectoryEnd } from './hooks-tools/tools-trajectory.js';
export { hooksTrajectoryStart, hooksTrajectoryStep, hooksTrajectoryEnd };

// hooksPatternStore + hooksPatternSearch moved to
// ./hooks-tools/tools-patterns.ts (W44, P3.2 cut #14).
import { hooksPatternStore, hooksPatternSearch } from './hooks-tools/tools-patterns.js';
export { hooksPatternStore, hooksPatternSearch };

// hooksIntelligence + hooksIntelligenceReset moved to
// ./hooks-tools/tools-intelligence-init.ts (W45, P3.2 cut #15).
import { hooksIntelligence, hooksIntelligenceReset } from './hooks-tools/tools-intelligence-init.js';
export { hooksIntelligence, hooksIntelligenceReset };

// hooksModelRoute + hooksModelOutcome + hooksModelStats moved to
// ./hooks-tools/tools-model.ts (W46, P3.2 cut #16). Includes the lazy
// model router instance + the fallback complexity analyzer.
import { hooksModelRoute, hooksModelOutcome, hooksModelStats } from './hooks-tools/tools-model.js';
export { hooksModelRoute, hooksModelOutcome, hooksModelStats };

// hooksTeammateIdle + hooksTaskCompleted moved to
// ./hooks-tools/tools-teammate.ts (W47, P3.2 cut #17).
import { hooksTeammateIdle, hooksTaskCompleted } from './hooks-tools/tools-teammate.js';
export { hooksTeammateIdle, hooksTaskCompleted };

// hooks_worker-list/dispatch/status/detect/cancel + the WORKER_*
// catalogue / activeWorkers / detectWorkerTriggers helpers moved to
// ./hooks-tools/tools-worker.ts (W48, P3.2 cut #18).
import {
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
} from './hooks-tools/tools-worker.js';
export {
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
};

// hooks_codemod (Tier-1 deterministic transforms) + the CODEMOD_*
// allow-set + codemodLangForExt helper moved to
// ./hooks-tools/tools-codemod.ts (W49, P3.2 cut #19).
import { hooksCodemod } from './hooks-tools/tools-codemod.js';
export { hooksCodemod };

// hooks_transfer + hooks_notify + hooks_init (3 small standalone
// tools) moved to ./hooks-tools/tools-misc.ts (W50, P3.2 cut #20).
import { hooksTransfer, hooksNotify, hooksInit } from './hooks-tools/tools-misc.js';
export { hooksTransfer, hooksNotify, hooksInit };

// hooks_metrics + hooks_list moved to ./hooks-tools/tools-metrics.ts
// (W51, P3.2 cut #21).
import { hooksMetrics, hooksList } from './hooks-tools/tools-metrics.js';
export { hooksMetrics, hooksList };

// hooks_intelligence_stats + learn + attention + unified-stats moved
// to ./hooks-tools/tools-intelligence-stats.ts (W52, P3.2 cut #22 —
// the final and biggest intelligence_* sub-cut).
import {
  hooksIntelligenceStats,
  hooksIntelligenceLearn,
  hooksIntelligenceAttention,
  hooksIntelligenceUnifiedStats,
} from './hooks-tools/tools-intelligence-stats.js';
export {
  hooksIntelligenceStats,
  hooksIntelligenceLearn,
  hooksIntelligenceAttention,
  hooksIntelligenceUnifiedStats,
};



// Explain hook - transparent routing explanation


// Transfer hook - transfer patterns from another project



// Intelligence stats hook

// Export all hooks tools
export const hooksTools: MCPTool[] = [
  hooksIntelligenceUnifiedStats,
  hooksTeammateIdle,
  hooksTaskCompleted,
  hooksPreEdit,
  hooksPostEdit,
  hooksPreCommand,
  hooksPostCommand,
  hooksRoute,
  hooksMetrics,
  hooksList,
  hooksPreTask,
  hooksPostTask,
  // New hooks
  hooksExplain,
  hooksPretrain,
  hooksBuildAgents,
  hooksTransfer,
  hooksSessionStart,
  hooksSessionEnd,
  hooksSessionRestore,
  hooksNotify,
  hooksInit,
  hooksIntelligence,
  hooksIntelligenceReset,
  hooksTrajectoryStart,
  hooksTrajectoryStep,
  hooksTrajectoryEnd,
  hooksPatternStore,
  hooksPatternSearch,
  hooksIntelligenceStats,
  hooksIntelligenceLearn,
  hooksIntelligenceAttention,
  // Worker tools
  hooksWorkerList,
  hooksWorkerDispatch,
  hooksWorkerStatus,
  hooksWorkerDetect,
  hooksWorkerCancel,
  // Model routing tools
  hooksModelRoute,
  hooksModelOutcome,
  hooksModelStats,
  // Deterministic Tier-1 codemod execution (ADR-143)
  hooksCodemod,
];

export default hooksTools;

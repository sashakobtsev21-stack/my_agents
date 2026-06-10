/**
 * Memory Bridge — barrel module.
 *
 * Routes CLI memory operations through ControllerRegistry + AgentDB v3
 * (ADR-053). The implementation was split into the ./memory-bridge/
 * directory during the P3.4 god-file decomposition (W64-W71); this file
 * is now a thin re-export surface that preserves the public API so every
 * existing `import { … } from './memory-bridge.js'` callsite — notably
 * memory-initializer's getBridge() — keeps working byte-identically.
 *
 * Sub-modules:
 *   scoring · bridge-core · bridge-crud · bridge-embedding-hnsw ·
 *   bridge-patterns · bridge-delete · bridge-session ·
 *   bridge-controllers · bridge-hierarchical
 *
 * @module v3/cli/memory-bridge
 */


// Shared bridge infrastructure — the ControllerRegistry lazy singleton +
// every cross-cutting helper — moved to ./memory-bridge/bridge-core.ts
// (W65, P3.4 cut #2). The 3 registry-lifecycle helpers are public API,
// re-exported byte-identically.
export {
  isBridgeAvailable,
  getControllerRegistry,
  shutdownBridge,
} from './memory-bridge/bridge-core.js';

// CRUD operations (bridgeStoreEntry / SearchEntries / ListEntries /
// GetEntry / DeleteEntry) moved to ./memory-bridge/bridge-crud.ts
// (W66, P3.4 cut #3). Re-exported byte-identically — memory-initializer's
// getBridge() resolves them by name.
export {
  bridgeStoreEntry,
  bridgeSearchEntries,
  bridgeListEntries,
  bridgeGetEntry,
  bridgeDeleteEntry,
} from './memory-bridge/bridge-crud.js';

// Embedding + HNSW operations (bridgeGenerateEmbedding,
// LoadEmbeddingModel, GetHNSWStatus, SearchHNSW, AddToHNSW) moved to
// ./memory-bridge/bridge-embedding-hnsw.ts (W67, P3.4 cut #4).
// Re-exported byte-identically.
export {
  bridgeGenerateEmbedding,
  bridgeLoadEmbeddingModel,
  bridgeGetHNSWStatus,
  bridgeSearchHNSW,
  bridgeAddToHNSW,
} from './memory-bridge/bridge-embedding-hnsw.js';

// Pattern + learning operations (bridgeStorePattern, SearchPatterns,
// RecordFeedback, RecordCausalEdge) moved to ./memory-bridge/
// bridge-patterns.ts (W68, P3.4 cut #5). Re-exported byte-identically.
export {
  bridgeStorePattern,
  bridgeSearchPatterns,
  bridgeRecordFeedback,
  bridgeRecordCausalEdge,
} from './memory-bridge/bridge-patterns.js';

// Delete tools for hierarchical + causal-graph memory (#1784:
// bridgeDeleteHierarchical, DeleteCausalEdge, DeleteCausalNode) moved to
// ./memory-bridge/bridge-delete.ts (W69, P3.4 cut #6). Re-exported
// byte-identically.
export {
  bridgeDeleteHierarchical,
  bridgeDeleteCausalEdge,
  bridgeDeleteCausalNode,
} from './memory-bridge/bridge-delete.js';

// Session lifecycle + task routing (bridgeSessionStart, SessionEnd,
// RouteTask) moved to ./memory-bridge/bridge-session.ts (W70, P3.4 cut
// #7). Re-exported byte-identically.
export {
  bridgeSessionStart,
  bridgeSessionEnd,
  bridgeRouteTask,
} from './memory-bridge/bridge-session.js';

// Controller access + health check (bridgeGetController, HasController,
// ListControllers, HealthCheck) moved to ./memory-bridge/
// bridge-controllers.ts (W71, P3.4 cut #8). Re-exported byte-identically.
export {
  bridgeGetController,
  bridgeHasController,
  bridgeListControllers,
  bridgeHealthCheck,
} from './memory-bridge/bridge-controllers.js';

// Hierarchical memory + consolidation + batch + context + semantic route
// + RaBitQ export + stats (bridgeHierarchicalStore, Recall, Consolidate,
// BatchOperation, ContextSynthesize, SemanticRoute, GetAllEmbeddings,
// getMemoryBridgeStats) moved to ./memory-bridge/bridge-hierarchical.ts
// (W71, P3.4 cut #8). Re-exported byte-identically.
export {
  bridgeHierarchicalStore,
  bridgeHierarchicalRecall,
  bridgeConsolidate,
  bridgeBatchOperation,
  bridgeContextSynthesize,
  bridgeSemanticRoute,
  bridgeGetAllEmbeddings,
  getMemoryBridgeStats,
} from './memory-bridge/bridge-hierarchical.js';


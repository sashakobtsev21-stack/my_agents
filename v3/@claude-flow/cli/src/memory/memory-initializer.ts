/**
 * V3 Memory Initializer — barrel module.
 *
 * The implementation was split into the ./memory-initializer/ directory
 * during the P3.3 god-file decomposition (W53-W63); this file is now a
 * thin re-export surface that preserves the public API so every existing
 * `import { … } from './memory-initializer.js'` callsite keeps working
 * byte-identically. Sub-modules:
 *   numeric-ops · schema · paths · hnsw · embedding · schema-mgmt ·
 *   crud-read · crud-write · verify · db-lifecycle
 *
 * ADR-053: Routes through ControllerRegistry → AgentDB v3 when available,
 * falls back to raw sql.js for backwards compatibility.
 *
 * @module v3/cli/memory-initializer
 */

// Path resolution (#1854 getMemoryRoot, #2105 resolveDbPath) + the
// ADR-053 lazy AgentDB bridge loader moved to ./memory-initializer/
// paths.ts (W55, P3.3 cut #3). Imported for inline use AND re-exported
// so external callers keep working byte-identically.
import {
  getMemoryRoot,
  _resetMemoryRootCache,
  resolveDbPath,
} from './memory-initializer/paths.js';
export { getMemoryRoot, _resetMemoryRootCache, resolveDbPath };

// MEMORY_SCHEMA_V3 (~325 LOC of SQL DDL) extracted to
// ./memory-initializer/schema.ts (W54, P3.3 cut #2). Imported AND
// re-exported so inline `initializeMemoryDatabase` callsites and
// external `import { MEMORY_SCHEMA_V3 } from './memory-initializer.js'`
// callers both keep working byte-identically.
import { MEMORY_SCHEMA_V3 } from './memory-initializer/schema.js';
export { MEMORY_SCHEMA_V3 };

// HNSW vector-index singleton (~325 LOC: getHNSWIndex, saveHNSWMetadata,
// addToHNSWIndex, searchHNSWIndex, getHNSWStatus, clearHNSWIndex,
// rebuildSearchIndex) moved to ./memory-initializer/hnsw.ts (W56, P3.3
// cut #4). Its two #1122 evictHNSWEntry* delete-path cache invalidators
// are now consumed inside crud-read.ts (W60), not here. Public surface
// re-exported byte-identically.
import {
  getHNSWIndex,
  addToHNSWIndex,
  searchHNSWIndex,
  getHNSWStatus,
  clearHNSWIndex,
  rebuildSearchIndex,
} from './memory-initializer/hnsw.js';
export {
  getHNSWIndex,
  addToHNSWIndex,
  searchHNSWIndex,
  getHNSWStatus,
  clearHNSWIndex,
  rebuildSearchIndex,
};

// Embedding model manager (~380 LOC: loadEmbeddingModel, generate
// Embedding, generateBatchEmbeddings, the EmbeddingModel singleton +
// the generateHashEmbedding fallback) moved to ./memory-initializer/
// embedding.ts (W58, P3.3 cut #5). loadEmbeddingModel + generate
// Embedding are imported for the inline callsites (verifyMemoryInit,
// storeEntry, searchEntries, the export-default bundle) and re-exported
// along with generateBatchEmbeddings.
import {
  loadEmbeddingModel,
  generateEmbedding,
} from './memory-initializer/embedding.js';
export {
  loadEmbeddingModel,
  generateEmbedding,
  generateBatchEmbeddings,
} from './memory-initializer/embedding.js';

// ============================================================================
// INT8 quantization + Flash-attention batch ops moved to
// ./memory-initializer/numeric-ops.ts (W53, P3.3 cut #1). Re-exported
// below so existing `import { quantizeInt8, … } from
// './memory-initializer.js'` callers keep working byte-identically.
// ============================================================================
export {
  quantizeInt8,
  dequantizeInt8,
  quantizedCosineSim,
  getQuantizationStats,
  batchCosineSim,
  softmaxAttention,
  topKIndices,
  flashAttentionSearch,
} from './memory-initializer/numeric-ops.js';

// Schema management (~265 LOC: getInitialMetadata, ensureSchemaColumns,
// checkAndMigrateLegacy, activateControllerRegistry) moved to
// ./memory-initializer/schema-mgmt.ts (W59, P3.3 cut #6). The three
// public names + the MemoryInitResult type are imported here so the
// export-default bundle can list them and the barrel can re-export them
// byte-identically (activateControllerRegistry stays internal to the
// db-lifecycle consumer).
import {
  type MemoryInitResult,
  getInitialMetadata,
  ensureSchemaColumns,
  checkAndMigrateLegacy,
} from './memory-initializer/schema-mgmt.js';
export type { MemoryInitResult };
export {
  getInitialMetadata,
  ensureSchemaColumns,
  checkAndMigrateLegacy,
} from './memory-initializer/schema-mgmt.js';

// CRUD read + delete (~420 LOC: listEntries, getEntry, deleteEntry)
// moved to ./memory-initializer/crud-read.ts (W60, P3.3 cut #7). All
// three are referenced by the export-default bundle below, so they're
// imported for local bindings and re-exported byte-identically.
import {
  listEntries,
  getEntry,
  deleteEntry,
} from './memory-initializer/crud-read.js';
export { listEntries, getEntry, deleteEntry };

// CRUD write + query (~370 LOC: storeEntry, searchEntries + the internal
// cosineSim re-rank helper) moved to ./memory-initializer/crud-write.ts
// (W61, P3.3 cut #8). Both public functions are referenced by the
// export-default bundle, so imported for local bindings + re-exported.
import {
  storeEntry,
  searchEntries,
} from './memory-initializer/crud-write.js';
export { storeEntry, searchEntries };

// Post-init verification harness (~200 LOC: verifyMemoryInit) moved to
// ./memory-initializer/verify.ts (W62, P3.3 cut #9). Referenced by the
// export-default bundle, so imported for a local binding + re-exported.
import { verifyMemoryInit } from './memory-initializer/verify.js';
export { verifyMemoryInit };

// Database initialization + lifecycle (~335 LOC: initializeMemory
// Database, checkMemoryInitialization, applyTemporalDecay) moved to
// ./memory-initializer/db-lifecycle.ts (W63, P3.3 cut #10 — final).
// Referenced by the export-default bundle, so imported for local
// bindings + re-exported byte-identically.
import {
  initializeMemoryDatabase,
  checkMemoryInitialization,
  applyTemporalDecay,
} from './memory-initializer/db-lifecycle.js';
export { initializeMemoryDatabase, checkMemoryInitialization, applyTemporalDecay };



export default {
  initializeMemoryDatabase,
  checkMemoryInitialization,
  checkAndMigrateLegacy,
  ensureSchemaColumns,
  applyTemporalDecay,
  loadEmbeddingModel,
  generateEmbedding,
  verifyMemoryInit,
  storeEntry,
  searchEntries,
  listEntries,
  getEntry,
  deleteEntry,
  rebuildSearchIndex,
  MEMORY_SCHEMA_V3,
  getInitialMetadata
};

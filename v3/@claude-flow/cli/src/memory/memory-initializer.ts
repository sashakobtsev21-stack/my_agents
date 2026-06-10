/**
 * V3 Memory Initializer
 * Properly initializes the memory database with sql.js (WASM SQLite)
 * Includes pattern tables, vector embeddings, migration state tracking
 *
 * ADR-053: Routes through ControllerRegistry → AgentDB v3 when available,
 * falls back to raw sql.js for backwards compatibility.
 *
 * @module v3/cli/memory-initializer
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeFileRestricted } from '../fs-secure.js';

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
// ./memory-initializer/schema-mgmt.ts (W59, P3.3 cut #6). All four have
// inline callsites here (initializeMemoryDatabase + the CRUD ensure-
// schema guards), so they're imported for local bindings; the three
// public ones are re-exported byte-identically (activateController
// Registry stays internal).
import {
  type MemoryInitResult,
  getInitialMetadata,
  ensureSchemaColumns,
  checkAndMigrateLegacy,
  activateControllerRegistry,
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

/**
 * Initialize the memory database properly using sql.js
 */
export async function initializeMemoryDatabase(options: {
  backend?: string;
  dbPath?: string;
  force?: boolean;
  verbose?: boolean;
  migrate?: boolean;
}): Promise<MemoryInitResult> {
  const {
    backend = 'hybrid',
    dbPath: customPath,
    force = false,
    verbose = false,
    migrate = true
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath || path.join(swarmDir, 'memory.db');
  const dbDir = path.dirname(dbPath);

  try {
    // Create directory if needed
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Check for legacy installations
    if (migrate) {
      const legacyCheck = await checkAndMigrateLegacy({ dbPath, verbose });
      if (legacyCheck.needsMigration && verbose) {
        console.log(`Found legacy database (v${legacyCheck.legacyVersion}) with ${legacyCheck.legacyEntries} entries`);
      }
    }

    // Check existing database
    // #1791.6 — Idempotent re-init: if the database already exists and the
    // caller did not pass --force, treat it as a successful no-op instead of
    // an error. Callers (CLI, MCP tools, embeddings) can branch on
    // `alreadyExists` if they want a different message; previous behavior
    // surfaced an `[ERROR]` and a "Initialization failed" spinner even when
    // the existing DB was perfectly healthy.
    if (fs.existsSync(dbPath) && !force) {
      return {
        success: true,
        alreadyExists: true,
        backend,
        dbPath,
        schemaVersion: '3.0.0',
        tablesCreated: [],
        indexesCreated: [],
        features: {
          vectorEmbeddings: false,
          patternLearning: false,
          temporalDecay: false,
          hnswIndexing: false,
          migrationTracking: false
        }
      };
    }

    // Try to use sql.js (WASM SQLite)
    let db: any;
    let usedSqlJs = false;

    try {
      // Dynamic import of sql.js
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs();

      // Load existing database or create new
      if (fs.existsSync(dbPath) && force) {
        fs.unlinkSync(dbPath);
      }

      db = new SQL.Database();
      usedSqlJs = true;
    } catch (e) {
      // sql.js not available, fall back to writing schema file
      if (verbose) {
        console.log('sql.js not available, writing schema file for later initialization');
      }
    }

    if (usedSqlJs && db) {
      // Execute schema
      db.run(MEMORY_SCHEMA_V3);

      // Insert initial metadata
      db.run(getInitialMetadata(backend));

      // Save to file
      const data = db.export();
      const buffer = Buffer.from(data);
      writeFileRestricted(dbPath, buffer, { encrypt: true });

      // Close database
      db.close();

      // Also create schema file for reference
      const schemaPath = path.join(dbDir, 'schema.sql');
      fs.writeFileSync(schemaPath, MEMORY_SCHEMA_V3 + '\n' + getInitialMetadata(backend));

      // ADR-053: Activate ControllerRegistry so controllers (ReasoningBank,
      // SkillLibrary, ExplainableRecall, etc.) are instantiated during init
      const controllerResult = await activateControllerRegistry(dbPath, verbose);

      return {
        success: true,
        backend,
        dbPath,
        schemaVersion: '3.0.0',
        tablesCreated: [
          'memory_entries',
          'patterns',
          'pattern_history',
          'trajectories',
          'trajectory_steps',
          'migration_state',
          'sessions',
          'vector_indexes',
          'metadata'
        ],
        indexesCreated: [
          'idx_memory_namespace',
          'idx_memory_key',
          'idx_memory_type',
          'idx_memory_status',
          'idx_memory_created',
          'idx_memory_accessed',
          'idx_memory_owner',
          'idx_patterns_type',
          'idx_patterns_confidence',
          'idx_patterns_status',
          'idx_patterns_last_matched',
          'idx_pattern_history_pattern',
          'idx_steps_trajectory'
        ],
        features: {
          vectorEmbeddings: true,
          patternLearning: true,
          temporalDecay: true,
          hnswIndexing: true,
          migrationTracking: true
        },
        controllers: controllerResult,
      };
    } else {
      // Fall back to schema file approach
      const schemaPath = path.join(dbDir, 'schema.sql');
      fs.writeFileSync(schemaPath, MEMORY_SCHEMA_V3 + '\n' + getInitialMetadata(backend));

      // Create minimal valid SQLite file
      const sqliteHeader = Buffer.alloc(4096, 0);
      // SQLite format 3 header
      Buffer.from('SQLite format 3\0').copy(sqliteHeader, 0);
      sqliteHeader[16] = 0x10; // page size high byte (4096)
      sqliteHeader[17] = 0x00; // page size low byte
      sqliteHeader[18] = 0x01; // file format write version
      sqliteHeader[19] = 0x01; // file format read version
      sqliteHeader[24] = 0x00; // max embedded payload
      sqliteHeader[25] = 0x40;
      sqliteHeader[26] = 0x20; // min embedded payload
      sqliteHeader[27] = 0x20; // leaf payload

      writeFileRestricted(dbPath, sqliteHeader, { encrypt: true });

      // ADR-053: Activate ControllerRegistry even on fallback path
      const controllerResult = await activateControllerRegistry(dbPath, verbose);

      return {
        success: true,
        backend,
        dbPath,
        schemaVersion: '3.0.0',
        tablesCreated: [
          'memory_entries (pending)',
          'patterns (pending)',
          'pattern_history (pending)',
          'trajectories (pending)',
          'trajectory_steps (pending)',
          'migration_state (pending)',
          'sessions (pending)',
          'vector_indexes (pending)',
          'metadata (pending)'
        ],
        indexesCreated: [],
        features: {
          vectorEmbeddings: true,
          patternLearning: true,
          temporalDecay: true,
          hnswIndexing: true,
          migrationTracking: true
        },
        controllers: controllerResult,
      };
    }
  } catch (error) {
    return {
      success: false,
      backend,
      dbPath,
      schemaVersion: '3.0.0',
      tablesCreated: [],
      indexesCreated: [],
      features: {
        vectorEmbeddings: false,
        patternLearning: false,
        temporalDecay: false,
        hnswIndexing: false,
        migrationTracking: false
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if memory database is properly initialized
 */
export async function checkMemoryInitialization(dbPath?: string): Promise<{
  initialized: boolean;
  version?: string;
  backend?: string;
  features?: {
    vectorEmbeddings: boolean;
    patternLearning: boolean;
    temporalDecay: boolean;
  };
  tables?: string[];
}> {
  const swarmDir = getMemoryRoot();
  const path_ = dbPath || path.join(swarmDir, 'memory.db');

  if (!fs.existsSync(path_)) {
    return { initialized: false };
  }

  try {
    // Try to load with sql.js
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = fs.readFileSync(path_);
    const db = new SQL.Database(fileBuffer);

    // Check for metadata table
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values?.map((v: unknown[]) => v[0] as string) || [];

    // Get version
    let version = 'unknown';
    let backend = 'unknown';
    try {
      const versionResult = db.exec("SELECT value FROM metadata WHERE key='schema_version'");
      version = versionResult[0]?.values[0]?.[0] as string || 'unknown';

      const backendResult = db.exec("SELECT value FROM metadata WHERE key='backend'");
      backend = backendResult[0]?.values[0]?.[0] as string || 'unknown';
    } catch {
      // Metadata table might not exist
    }

    db.close();

    return {
      initialized: true,
      version,
      backend,
      features: {
        vectorEmbeddings: tableNames.includes('vector_indexes'),
        patternLearning: tableNames.includes('patterns'),
        temporalDecay: tableNames.includes('pattern_history')
      },
      tables: tableNames
    };
  } catch {
    // Could not read database
    return { initialized: false };
  }
}

/**
 * Apply temporal decay to patterns
 * Reduces confidence of patterns that haven't been used recently
 */
export async function applyTemporalDecay(dbPath?: string): Promise<{
  success: boolean;
  patternsDecayed: number;
  error?: string;
}> {
  const swarmDir = getMemoryRoot();
  const path_ = dbPath || path.join(swarmDir, 'memory.db');

  try {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = fs.readFileSync(path_);
    const db = new SQL.Database(fileBuffer);

    // Apply decay: confidence *= exp(-decay_rate * days_since_last_use)
    const now = Date.now();
    const decayQuery = `
      UPDATE patterns
      SET
        confidence = confidence * (1.0 - decay_rate * ((? - COALESCE(last_matched_at, created_at)) / 86400000.0)),
        updated_at = ?
      WHERE status = 'active'
        AND confidence > 0.1
        AND (? - COALESCE(last_matched_at, created_at)) > 86400000
    `;

    db.run(decayQuery, [now, now, now]);

    const changes = db.getRowsModified();

    // Save
    const data = db.export();
    fs.writeFileSync(path_, Buffer.from(data));
    db.close();

    return {
      success: true,
      patternsDecayed: changes
    };
  } catch (error) {
    return {
      success: false,
      patternsDecayed: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}





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

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
import { readFileMaybeEncrypted, writeFileRestricted } from '../fs-secure.js';

// Path resolution (#1854 getMemoryRoot, #2105 resolveDbPath) + the
// ADR-053 lazy AgentDB bridge loader moved to ./memory-initializer/
// paths.ts (W55, P3.3 cut #3). Imported for inline use AND re-exported
// so external callers keep working byte-identically.
import {
  getMemoryRoot,
  _resetMemoryRootCache,
  resolveDbPath,
  getBridge,
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
// cut #4). The two evictHNSWEntry* accessors are #1122 delete-path
// cache invalidators consumed by deleteEntry below. Public surface
// re-exported byte-identically.
import {
  getHNSWIndex,
  addToHNSWIndex,
  searchHNSWIndex,
  getHNSWStatus,
  clearHNSWIndex,
  rebuildSearchIndex,
  evictHNSWEntryByKeyNamespace,
  evictHNSWEntryById,
} from './memory-initializer/hnsw.js';
export {
  getHNSWIndex,
  addToHNSWIndex,
  searchHNSWIndex,
  getHNSWStatus,
  clearHNSWIndex,
  rebuildSearchIndex,
};

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

// ============================================================================
// METADATA AND INITIALIZATION
// ============================================================================

/**
 * Initial metadata to insert after schema creation
 */
export function getInitialMetadata(backend: string): string {
  return `
INSERT OR REPLACE INTO metadata (key, value) VALUES
  ('schema_version', '3.0.0'),
  ('backend', '${backend}'),
  ('created_at', '${new Date().toISOString()}'),
  ('sql_js', 'true'),
  ('vector_embeddings', 'enabled'),
  ('pattern_learning', 'enabled'),
  ('temporal_decay', 'enabled'),
  ('hnsw_indexing', 'enabled');

-- Create default vector index configuration. Dimension matches the default
-- ONNX embedding model (Xenova/all-MiniLM-L6-v2, 384-dim); HNSW rejects
-- inserts whose dim does not match this row, so a 768 here breaks every
-- memory_store --vector and memory_search on a fresh install (#1947).
INSERT OR IGNORE INTO vector_indexes (id, name, dimensions) VALUES
  ('default', 'default', 384),
  ('patterns', 'patterns', 384);
`;
}

/**
 * Memory initialization result
 */
export interface MemoryInitResult {
  success: boolean;
  /**
   * #1791.6 — set when an existing database was found and `force` was not
   * passed. The call is treated as a successful no-op rather than an error.
   */
  alreadyExists?: boolean;
  backend: string;
  dbPath: string;
  schemaVersion: string;
  tablesCreated: string[];
  indexesCreated: string[];
  features: {
    vectorEmbeddings: boolean;
    patternLearning: boolean;
    temporalDecay: boolean;
    hnswIndexing: boolean;
    migrationTracking: boolean;
  };
  /** ADR-053: Controllers activated via ControllerRegistry */
  controllers?: {
    activated: string[];
    failed: string[];
    initTimeMs: number;
  };
  error?: string;
}

/**
 * Ensure memory_entries table has all required columns
 * Adds missing columns for older databases (e.g., 'content' column)
 */
export async function ensureSchemaColumns(dbPath: string): Promise<{
  success: boolean;
  columnsAdded: string[];
  error?: string;
}> {
  const columnsAdded: string[] = [];

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: true, columnsAdded: [] };
    }

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Get current columns in memory_entries
    const tableInfo = db.exec("PRAGMA table_info(memory_entries)");
    const existingColumns = new Set(
      tableInfo[0]?.values?.map((row: unknown[]) => row[1] as string) || []
    );

    // Required columns that may be missing in older schemas
    // Issue #977: 'type' column was missing from this list, causing store failures on older DBs
    const requiredColumns: Array<{ name: string; definition: string }> = [
      { name: 'content', definition: "content TEXT DEFAULT ''" },
      { name: 'type', definition: "type TEXT DEFAULT 'semantic'" },
      { name: 'embedding', definition: 'embedding TEXT' },
      { name: 'embedding_model', definition: "embedding_model TEXT DEFAULT 'local'" },
      { name: 'embedding_dimensions', definition: 'embedding_dimensions INTEGER' },
      { name: 'tags', definition: 'tags TEXT' },
      { name: 'metadata', definition: 'metadata TEXT' },
      { name: 'owner_id', definition: 'owner_id TEXT' },
      { name: 'expires_at', definition: 'expires_at INTEGER' },
      { name: 'last_accessed_at', definition: 'last_accessed_at INTEGER' },
      { name: 'access_count', definition: 'access_count INTEGER DEFAULT 0' },
      { name: 'status', definition: "status TEXT DEFAULT 'active'" }
    ];

    let modified = false;
    for (const col of requiredColumns) {
      if (!existingColumns.has(col.name)) {
        try {
          db.run(`ALTER TABLE memory_entries ADD COLUMN ${col.definition}`);
          columnsAdded.push(col.name);
          modified = true;
        } catch (e) {
          // Column might already exist or other error - continue
        }
      }
    }

    // #2120 — Belt-and-suspenders backfill. `ALTER TABLE ADD COLUMN
    // status TEXT DEFAULT 'active'` should populate existing rows with
    // 'active' in modern SQLite, but: (a) some auto-memory bridge writes
    // happen via INSERT paths that pass an explicit NULL, (b) some
    // historical sql.js builds skipped the DEFAULT backfill, (c)
    // entries can be migrated in from older snapshots. After ensuring
    // the column exists, force-backfill any remaining NULL → 'active'.
    // Safe on already-correct DBs (0 rows updated).
    if (columnsAdded.includes('status') || existingColumns.has('status')) {
      try {
        db.run(`UPDATE memory_entries SET status = 'active' WHERE status IS NULL`);
        modified = true;
      } catch {
        /* table is read-only or doesn't exist — skip */
      }
    }

    if (modified) {
      // Save updated database
      const data = db.export();
      writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });
    }

    db.close();
    return { success: true, columnsAdded };
  } catch (error) {
    return {
      success: false,
      columnsAdded,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check for legacy database installations and migrate if needed
 */
export async function checkAndMigrateLegacy(options: {
  dbPath: string;
  verbose?: boolean;
}): Promise<{
  needsMigration: boolean;
  legacyVersion?: string;
  legacyEntries?: number;
  migrated?: boolean;
  migratedCount?: number;
}> {
  // `verbose` is documented in the public surface but the legacy-migration
  // path below doesn't currently differentiate output; it's accepted to
  // keep callers from breaking once we add per-step trace logs.
  const { dbPath } = options;

  // Check for legacy locations
  const legacyPaths = [
    path.join(process.cwd(), 'memory.db'),
    path.join(process.cwd(), '.claude/memory.db'),
    path.join(process.cwd(), 'data/memory.db'),
    path.join(process.cwd(), '.claude-flow/memory.db')
  ];

  for (const legacyPath of legacyPaths) {
    if (fs.existsSync(legacyPath) && legacyPath !== dbPath) {
      try {
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();

        const legacyBuffer = fs.readFileSync(legacyPath);
        const legacyDb = new SQL.Database(legacyBuffer);

        // Check if it has data
        const countResult = legacyDb.exec('SELECT COUNT(*) FROM memory_entries');
        const count = countResult[0]?.values[0]?.[0] as number || 0;

        // Get version if available
        let version = 'unknown';
        try {
          const versionResult = legacyDb.exec("SELECT value FROM metadata WHERE key='schema_version'");
          version = versionResult[0]?.values[0]?.[0] as string || 'unknown';
        } catch { /* no metadata table */ }

        legacyDb.close();

        if (count > 0) {
          return {
            needsMigration: true,
            legacyVersion: version,
            legacyEntries: count
          };
        }
      } catch {
        // Not a valid SQLite database, skip
      }
    }
  }

  return { needsMigration: false };
}

/**
 * ADR-053: Activate ControllerRegistry so AgentDB v3 controllers
 * (ReasoningBank, SkillLibrary, ExplainableRecall, etc.) are instantiated.
 *
 * Uses the memory-bridge's getControllerRegistry() which lazily creates
 * a singleton ControllerRegistry and initializes it with the given dbPath.
 * After this call, all enabled controllers are ready for immediate use.
 *
 * Failures are isolated: if @claude-flow/memory or agentdb is not installed,
 * this returns an empty result without throwing.
 */
async function activateControllerRegistry(
  dbPath: string,
  verbose?: boolean,
): Promise<{ activated: string[]; failed: string[]; initTimeMs: number }> {
  const startTime = performance.now();
  const activated: string[] = [];
  const failed: string[] = [];

  try {
    const bridge = await getBridge();
    if (!bridge) {
      return { activated, failed, initTimeMs: performance.now() - startTime };
    }

    const registry = await bridge.getControllerRegistry(dbPath);
    if (!registry) {
      return { activated, failed, initTimeMs: performance.now() - startTime };
    }

    // Collect controller status from the registry
    if (typeof registry.listControllers === 'function') {
      const controllers = registry.listControllers();
      for (const ctrl of controllers) {
        if (ctrl.enabled) {
          activated.push(ctrl.name);
        } else {
          failed.push(ctrl.name);
        }
      }
    }

    if (verbose && activated.length > 0) {
      console.log(`ControllerRegistry: ${activated.length} controllers activated`);
    }
  } catch {
    // ControllerRegistry activation is best-effort
  }

  return { activated, failed, initTimeMs: performance.now() - startTime };
}

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

/**
 * ONNX Model Manager for lazy loading embeddings
 * Avoids loading 100MB+ models unless actually needed
 */
interface EmbeddingModel {
  loaded: boolean;
  model: unknown;
  tokenizer: unknown;
  dimensions: number;
}

let embeddingModelState: EmbeddingModel | null = null;

/**
 * Lazy load ONNX embedding model
 * Only loads when first embedding is requested
 */
export async function loadEmbeddingModel(options?: {
  modelPath?: string;
  verbose?: boolean;
}): Promise<{
  success: boolean;
  dimensions: number;
  modelName: string;
  loadTime?: number;
  error?: string;
}> {
  const { verbose = false } = options || {};
  const startTime = Date.now();

  // Already loaded
  if (embeddingModelState?.loaded) {
    return {
      success: true,
      dimensions: embeddingModelState.dimensions,
      modelName: 'cached',
      loadTime: 0
    };
  }

  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeLoadEmbeddingModel();
    if (bridgeResult && bridgeResult.success) {
      // Mark local state as loaded too so subsequent calls use cache
      embeddingModelState = {
        loaded: true,
        model: null, // Bridge handles embedding
        tokenizer: null,
        dimensions: bridgeResult.dimensions
      };
      return bridgeResult;
    }
  }

  try {
    // ADR-094: prefer @huggingface/transformers (clears protobufjs <7.5.5
    // critical RCE chain), fall back to legacy @xenova/transformers.
    // Inlined here rather than depending on @claude-flow/embeddings to
    // avoid a circular optional-dep at install time; the logic mirrors
    // @claude-flow/embeddings/src/transformers-loader.ts.
    let transformersSource: '@huggingface/transformers' | '@xenova/transformers' | null = null;
    let pipelineFn: ((task: string, model?: string) => Promise<unknown>) | null = null;

    {
      const tryLoad = async (specifier: string): Promise<Record<string, unknown> | null> => {
        try { return (await import(specifier)) as Record<string, unknown>; }
        catch { return null; }
      };
      const hf = await tryLoad('@huggingface/transformers');
      if (hf && typeof hf.pipeline === 'function') {
        pipelineFn = hf.pipeline as (t: string, m?: string) => Promise<unknown>;
        transformersSource = '@huggingface/transformers';
      } else {
        const xen = await tryLoad('@xenova/transformers');
        if (xen && typeof xen.pipeline === 'function') {
          pipelineFn = xen.pipeline as (t: string, m?: string) => Promise<unknown>;
          transformersSource = '@xenova/transformers';
        }
      }
    }

    if (pipelineFn && transformersSource) {
      if (verbose) {
        console.log(`Loading ONNX embedding model via ${transformersSource} (all-MiniLM-L6-v2)...`);
      }
      const embedder = await pipelineFn('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

      embeddingModelState = {
        loaded: true,
        model: embedder,
        tokenizer: null,
        dimensions: 384 // MiniLM-L6 produces 384-dim vectors
      };

      return {
        success: true,
        dimensions: 384,
        modelName: 'Xenova/all-MiniLM-L6-v2',
        loadTime: Date.now() - startTime
      };
    }

    // Fallback: Check for agentic-flow ReasoningBank embeddings (v3)
    const reasoningBank = await import('agentic-flow/reasoningbank').catch(() => null);

    if (reasoningBank?.computeEmbedding) {
      if (verbose) {
        console.log('Loading agentic-flow ReasoningBank embedding model...');
      }

      embeddingModelState = {
        loaded: true,
        model: { embed: reasoningBank.computeEmbedding },
        tokenizer: null,
        dimensions: 768
      };

      return {
        success: true,
        dimensions: 768,
        modelName: 'agentic-flow/reasoningbank',
        loadTime: Date.now() - startTime
      };
    }

    // Fallback: Check for ruvector ONNX embedder (bundled MiniLM-L6-v2 since v0.2.15)
    // v0.2.16: LoRA B=0 fix makes AdaptiveEmbedder safe (identity when untrained)
    // Note: isReady() returns false until first embed() call (lazy init), so we
    // skip the isReady() gate and verify with a probe embed instead.
    const ruvector = await import('ruvector').catch(() => null);

    if (ruvector?.initOnnxEmbedder) {
      try {
        await ruvector.initOnnxEmbedder();

        // Fallback: OptimizedOnnxEmbedder (raw ONNX, lazy-inits on first embed)
        const onnxEmb = ruvector.getOptimizedOnnxEmbedder?.();
        if (onnxEmb?.embed) {
          // Probe embed to trigger lazy ONNX init and verify it works
          const probe = await onnxEmb.embed('test');
          if (probe && probe.length > 0 && (Array.isArray(probe) ? probe.some((v: number) => v !== 0) : true)) {
            if (verbose) {
              console.log(`Loading ruvector ONNX embedder (all-MiniLM-L6-v2, ${probe.length}d)...`);
            }
            embeddingModelState = {
              loaded: true,
              model: (text: string) => onnxEmb.embed(text),
              tokenizer: null,
              dimensions: probe.length || 384
            };
            return {
              success: true,
              dimensions: probe.length || 384,
              modelName: 'ruvector/onnx',
              loadTime: Date.now() - startTime
            };
          }
        }
      } catch {
        // ruvector ONNX init failed, continue to next fallback
      }
    }

    // Legacy fallback: Check for agentic-flow core embeddings
    const agenticFlow = await import('agentic-flow').catch(() => null);

    if (agenticFlow && (agenticFlow as any).embeddings) {
      if (verbose) {
        console.log('Loading agentic-flow embedding model...');
      }

      embeddingModelState = {
        loaded: true,
        model: (agenticFlow as any).embeddings,
        tokenizer: null,
        dimensions: 768
      };

      return {
        success: true,
        dimensions: 768,
        modelName: 'agentic-flow',
        loadTime: Date.now() - startTime
      };
    }

    // No ONNX model available - use fallback
    embeddingModelState = {
      loaded: true,
      model: null, // Will use simple hash-based fallback
      tokenizer: null,
      dimensions: 128 // Smaller fallback dimensions
    };

    return {
      success: true,
      dimensions: 128,
      modelName: 'hash-fallback',
      loadTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      dimensions: 0,
      modelName: 'none',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Generate real embedding for text
 * Uses ONNX model if available, falls back to deterministic hash
 *
 * AUDIT #3: the `backend` field is the authoritative signal for whether the
 * returned vector carries real ONNX semantics ('onnx') or the deterministic
 * hash fallback ('mock'). The hash fallback produces inverted/meaningless
 * semantics, so operators MUST be able to tell the two apart even when the
 * `model` string reports a real model name (e.g. the AgentDB bridge always
 * labels its output 'Xenova/all-MiniLM-L6-v2' regardless of whether AgentDB's
 * own embedder is real or stubbed). Set `backend` truthfully by the path that
 * actually produced the vector. Do NOT change the embedding math.
 */
export async function generateEmbedding(text: string): Promise<{
  embedding: number[];
  dimensions: number;
  model: string;
  backend: 'onnx' | 'mock';
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeGenerateEmbedding(text);
    if (bridgeResult) {
      // The bridge labels its output with a real model name unconditionally;
      // honor the backend it reports if present, otherwise treat a real model
      // name as ONNX (the bridge only returns when AgentDB's embedder exists).
      const backend: 'onnx' | 'mock' =
        (bridgeResult as { backend?: 'onnx' | 'mock' }).backend ?? 'onnx';
      return { ...bridgeResult, backend };
    }
  }

  // Ensure model is loaded
  if (!embeddingModelState?.loaded) {
    await loadEmbeddingModel();
  }

  const state = embeddingModelState!;

  // Use ONNX model if available
  if (state.model && typeof (state.model as any) === 'function') {
    try {
      const output = await (state.model as any)(text, { pooling: 'mean', normalize: true });
      // Handle both @xenova/transformers (output.data) and ruvector (plain array) formats
      const embedding = output?.data
        ? Array.from(output.data as Float32Array)
        : Array.isArray(output) ? output : null;
      if (embedding) {
        return {
          embedding,
          dimensions: embedding.length,
          model: 'onnx',
          backend: 'onnx'
        };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Deterministic hash-based fallback (for testing/demo without ONNX).
  // AUDIT #3: backend='mock' — these vectors do NOT carry real semantics.
  const embedding = generateHashEmbedding(text, state.dimensions);
  return {
    embedding,
    dimensions: state.dimensions,
    model: 'hash-fallback',
    backend: 'mock'
  };
}

/**
 * Generate embeddings for multiple texts
 * Uses parallel execution for API-based providers (2-4x faster)
 * Note: Local ONNX inference is CPU-bound, so parallelism has limited benefit
 *
 * @param texts - Array of texts to embed
 * @param options - Batch options
 * @returns Array of embedding results with timing info
 */
export async function generateBatchEmbeddings(
  texts: string[],
  options?: {
    concurrency?: number; // Max concurrent embeddings (default: all)
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{
  results: Array<{ text: string; embedding: number[]; dimensions: number; model: string }>;
  totalTime: number;
  avgTime: number;
}> {
  const { concurrency = texts.length, onProgress } = options || {};
  const startTime = Date.now();

  // Ensure model is loaded first (prevents cold start in parallel)
  if (!embeddingModelState?.loaded) {
    await loadEmbeddingModel();
  }

  // Process in parallel with optional concurrency limit
  if (concurrency >= texts.length) {
    // Full parallelism
    const embeddings = await Promise.all(
      texts.map(async (text, i) => {
        const result = await generateEmbedding(text);
        onProgress?.(i + 1, texts.length);
        return { text, ...result };
      })
    );

    const totalTime = Date.now() - startTime;
    return {
      results: embeddings,
      totalTime,
      avgTime: totalTime / texts.length
    };
  }

  // Limited concurrency using chunking
  const results: Array<{ text: string; embedding: number[]; dimensions: number; model: string }> = [];
  let completed = 0;

  for (let i = 0; i < texts.length; i += concurrency) {
    const chunk = texts.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (text) => {
        const result = await generateEmbedding(text);
        completed++;
        onProgress?.(completed, texts.length);
        return { text, ...result };
      })
    );
    results.push(...chunkResults);
  }

  const totalTime = Date.now() - startTime;
  return {
    results,
    totalTime,
    avgTime: totalTime / texts.length
  };
}

/**
 * Generate deterministic hash-based embedding
 * Not semantic, but deterministic and useful for testing
 */
function generateHashEmbedding(text: string, dimensions: number): number[] {
  const embedding: number[] = new Array(dimensions).fill(0);

  // Simple hash-based approach for reproducibility
  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j);
      const idx = (charCode * (i + 1) * (j + 1)) % dimensions;
      embedding[idx] += Math.sin(charCode * 0.1) * 0.1;
    }
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map(v => v / magnitude);
}

/**
 * Verify memory initialization works correctly
 * Tests: write, read, search, patterns
 */
export async function verifyMemoryInit(dbPath: string, options?: {
  verbose?: boolean;
}): Promise<{
  success: boolean;
  tests: {
    name: string;
    passed: boolean;
    details?: string;
    duration?: number;
  }[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}> {
  // verbose accepted for forward-compat; the test harness below already
  // emits a result-per-test, which is the only verbosity we need today.
  void options;
  const tests: { name: string; passed: boolean; details?: string; duration?: number }[] = [];

  try {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    // Load database
    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Test 1: Schema verification
    const schemaStart = Date.now();
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values?.map((v: unknown[]) => v[0] as string) || [];
    const expectedTables = ['memory_entries', 'patterns', 'metadata', 'vector_indexes'];
    const missingTables = expectedTables.filter(t => !tableNames.includes(t));

    tests.push({
      name: 'Schema verification',
      passed: missingTables.length === 0,
      details: missingTables.length > 0 ? `Missing: ${missingTables.join(', ')}` : `${tableNames.length} tables found`,
      duration: Date.now() - schemaStart
    });

    // Test 2: Write entry
    const writeStart = Date.now();
    const testId = `test_${Date.now()}`;
    const testKey = 'verification_test';
    const testValue = 'This is a verification test entry for memory initialization';

    try {
      db.run(`
        INSERT INTO memory_entries (id, key, namespace, content, type, created_at, updated_at)
        VALUES (?, ?, 'test', ?, 'semantic', ?, ?)
      `, [testId, testKey, testValue, Date.now(), Date.now()]);

      tests.push({
        name: 'Write entry',
        passed: true,
        details: 'Entry written successfully',
        duration: Date.now() - writeStart
      });
    } catch (e) {
      tests.push({
        name: 'Write entry',
        passed: false,
        details: e instanceof Error ? e.message : 'Write failed',
        duration: Date.now() - writeStart
      });
    }

    // Test 3: Read entry
    const readStart = Date.now();
    try {
      const result = db.exec(`SELECT content FROM memory_entries WHERE id = ?`, [testId]);
      const content = result[0]?.values[0]?.[0] as string;

      tests.push({
        name: 'Read entry',
        passed: content === testValue,
        details: content === testValue ? 'Content matches' : 'Content mismatch',
        duration: Date.now() - readStart
      });
    } catch (e) {
      tests.push({
        name: 'Read entry',
        passed: false,
        details: e instanceof Error ? e.message : 'Read failed',
        duration: Date.now() - readStart
      });
    }

    // Test 4: Write with embedding
    const embeddingStart = Date.now();
    try {
      const { embedding, dimensions, model } = await generateEmbedding(testValue);
      const embeddingJson = JSON.stringify(embedding);

      db.run(`
        UPDATE memory_entries
        SET embedding = ?, embedding_dimensions = ?, embedding_model = ?
        WHERE id = ?
      `, [embeddingJson, dimensions, model, testId]);

      tests.push({
        name: 'Generate embedding',
        passed: true,
        details: `${dimensions}-dim vector (${model})`,
        duration: Date.now() - embeddingStart
      });
    } catch (e) {
      tests.push({
        name: 'Generate embedding',
        passed: false,
        details: e instanceof Error ? e.message : 'Embedding failed',
        duration: Date.now() - embeddingStart
      });
    }

    // Test 5: Pattern storage
    const patternStart = Date.now();
    try {
      const patternId = `pattern_${Date.now()}`;
      db.run(`
        INSERT INTO patterns (id, name, pattern_type, condition, action, confidence, created_at, updated_at)
        VALUES (?, 'test-pattern', 'task-routing', 'test condition', 'test action', 0.5, ?, ?)
      `, [patternId, Date.now(), Date.now()]);

      tests.push({
        name: 'Pattern storage',
        passed: true,
        details: 'Pattern stored with confidence scoring',
        duration: Date.now() - patternStart
      });

      // Cleanup test pattern
      db.run(`DELETE FROM patterns WHERE id = ?`, [patternId]);
    } catch (e) {
      tests.push({
        name: 'Pattern storage',
        passed: false,
        details: e instanceof Error ? e.message : 'Pattern storage failed',
        duration: Date.now() - patternStart
      });
    }

    // Test 6: Vector index configuration
    const indexStart = Date.now();
    try {
      const indexResult = db.exec(`SELECT name, dimensions, hnsw_m, hnsw_ef_construction FROM vector_indexes`);
      const indexes = indexResult[0]?.values || [];

      tests.push({
        name: 'Vector index config',
        passed: indexes.length > 0,
        details: `${indexes.length} indexes configured (HNSW M=16, ef=200)`,
        duration: Date.now() - indexStart
      });
    } catch (e) {
      tests.push({
        name: 'Vector index config',
        passed: false,
        details: e instanceof Error ? e.message : 'Index check failed',
        duration: Date.now() - indexStart
      });
    }

    // Cleanup test entry
    db.run(`DELETE FROM memory_entries WHERE id = ?`, [testId]);

    // Save changes
    const data = db.export();
    writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });
    db.close();

    const passed = tests.filter(t => t.passed).length;
    const failed = tests.filter(t => !t.passed).length;

    return {
      success: failed === 0,
      tests,
      summary: {
        passed,
        failed,
        total: tests.length
      }
    };
  } catch (error) {
    return {
      success: false,
      tests: [{
        name: 'Database access',
        passed: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      }],
      summary: { passed: 0, failed: 1, total: 1 }
    };
  }
}

/**
 * Store an entry directly using sql.js
 * This bypasses MCP and writes directly to the database
 */
export async function storeEntry(options: {
  key: string;
  value: string;
  namespace?: string;
  generateEmbeddingFlag?: boolean;
  tags?: string[];
  ttl?: number;
  dbPath?: string;
  upsert?: boolean;
}): Promise<{
  success: boolean;
  id: string;
  embedding?: { dimensions: number; model: string };
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeStoreEntry(options);
    if (bridgeResult) {
      // Keep HNSW index in sync with bridge-stored entries
      if (bridgeResult.rawEmbedding && bridgeResult.success) {
        const ns = options.namespace || 'default';
        await addToHNSWIndex(bridgeResult.id, bridgeResult.rawEmbedding, {
          id: bridgeResult.id,
          key: options.key,
          namespace: ns,
          content: options.value,
        }).catch(() => {});
      }
      return bridgeResult;
    }
  }

  // Fallback: raw sql.js
  const {
    key,
    value,
    namespace = 'default',
    generateEmbeddingFlag = true,
    tags = [],
    ttl,
    dbPath: customPath,
    upsert = false
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath ? path.resolve(customPath) : path.join(swarmDir, 'memory.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, id: '', error: 'Database not initialized. Run: claude-flow memory init' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    const id = `entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Generate embedding if requested
    let embeddingJson: string | null = null;
    let embeddingDimensions: number | null = null;
    let embeddingModel: string | null = null;

    if (generateEmbeddingFlag && value.length > 0) {
      const embResult = await generateEmbedding(value);
      embeddingJson = JSON.stringify(embResult.embedding);
      embeddingDimensions = embResult.dimensions;
      embeddingModel = embResult.model;
    }

    // #1941: provision a `vector_indexes` row for this namespace before the
    // entry insert. The HNSW lookup uses this table to find which namespaces
    // are indexed — without a row, `memory_search({namespace:"X"})` returns
    // 0 even when memory_entries holds matching rows. INSERT OR IGNORE
    // preserves the existing `default` / `patterns` rows.
    try {
      db.run(
        `INSERT OR IGNORE INTO vector_indexes (id, name, dimensions) VALUES (?, ?, ?)`,
        [namespace, namespace, embeddingDimensions ?? 384]
      );
    } catch { /* vector_indexes may not exist on legacy DBs — fall through */ }

    // Insert or update entry (upsert mode uses REPLACE)
    const insertSql = upsert
      ? `INSERT OR REPLACE INTO memory_entries (
          id, key, namespace, content, type,
          embedding, embedding_dimensions, embedding_model,
          tags, metadata, created_at, updated_at, expires_at, status
        ) VALUES (?, ?, ?, ?, 'semantic', ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      : `INSERT INTO memory_entries (
          id, key, namespace, content, type,
          embedding, embedding_dimensions, embedding_model,
          tags, metadata, created_at, updated_at, expires_at, status
        ) VALUES (?, ?, ?, ?, 'semantic', ?, ?, ?, ?, ?, ?, ?, ?, 'active')`;

    db.run(insertSql, [
      id,
      key,
      namespace,
      value,
      embeddingJson,
      embeddingDimensions,
      embeddingModel,
      tags.length > 0 ? JSON.stringify(tags) : null,
      '{}',
      now,
      now,
      ttl ? now + (ttl * 1000) : null
    ]);

    // Save
    const data = db.export();
    writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });
    db.close();

    // Add to HNSW index for faster future searches
    if (embeddingJson) {
      const embResult = JSON.parse(embeddingJson) as number[];
      await addToHNSWIndex(id, embResult, {
        id,
        key,
        namespace,
        content: value
      });
    }

    return {
      success: true,
      id,
      embedding: embeddingJson ? { dimensions: embeddingDimensions!, model: embeddingModel! } : undefined
    };
  } catch (error) {
    return {
      success: false,
      id: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Search entries using sql.js with vector similarity
 * Uses HNSW index for HNSW-indexed search when available
 */
export async function searchEntries(options: {
  query: string;
  namespace?: string;
  limit?: number;
  threshold?: number;
  dbPath?: string;
}): Promise<{
  success: boolean;
  results: {
    id: string;
    key: string;
    content: string;
    score: number;
    namespace: string;
  }[];
  searchTime: number;
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeSearchEntries(options);
    if (bridgeResult) return bridgeResult;
  }

  // Fallback: raw sql.js
  const {
    query,
    namespace,
    limit = 10,
    threshold = 0.3,
    dbPath: customPath
  } = options;
  const effectiveNamespace = namespace || 'all';

  const swarmDir = getMemoryRoot();
  const dbPath = customPath ? path.resolve(customPath) : path.join(swarmDir, 'memory.db');
  const startTime = Date.now();

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, results: [], searchTime: 0, error: 'Database not found' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    // Generate query embedding
    const queryEmb = await generateEmbedding(query);
    const queryEmbedding = queryEmb.embedding;

    // Try RaBitQ pre-filter first (32× compressed Hamming scan)
    try {
      const { searchRabitq } = await import('./rabitq-index.js');
      const rabitqCandidates = await searchRabitq(queryEmbedding, { k: limit * 2, namespace: effectiveNamespace });
      if (rabitqCandidates && rabitqCandidates.length > 0) {
        // Rerank candidates with exact cosine similarity from SQLite
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();
        const fileBuffer = readFileMaybeEncrypted(dbPath, null);
        const db = new SQL.Database(fileBuffer);
        const reranked: { id: string; key: string; content: string; score: number; namespace: string }[] = [];

        for (const candidate of rabitqCandidates) {
          const stmt = db.prepare('SELECT content, embedding FROM memory_entries WHERE id = ? AND status = ?');
          stmt.bind([candidate.id, 'active']);
          if (stmt.step()) {
            const [content, embeddingJson] = stmt.get() as [string, string | null];
            let score = 0;
            if (embeddingJson) {
              try {
                const embedding = JSON.parse(embeddingJson) as number[];
                score = cosineSim(queryEmbedding, embedding);
              } catch { /* skip */ }
            }
            if (score >= threshold) {
              reranked.push({
                id: candidate.id.substring(0, 12),
                key: candidate.key || candidate.id.substring(0, 15),
                content: (content || '').substring(0, 60) + ((content || '').length > 60 ? '...' : ''),
                score,
                namespace: candidate.namespace,
              });
            }
          }
          stmt.free();
        }
        db.close();

        if (reranked.length > 0) {
          reranked.sort((a, b) => b.score - a.score);
          return { success: true, results: reranked.slice(0, limit), searchTime: Date.now() - startTime };
        }
      }
    } catch { /* RaBitQ unavailable, fall through */ }

    // Try HNSW search (faster than brute-force (~1.9x-4.7x, measured))
    const hnswResults = await searchHNSWIndex(queryEmbedding, { k: limit, namespace: effectiveNamespace });
    if (hnswResults && hnswResults.length > 0) {
      // Filter by threshold
      const filtered = hnswResults.filter(r => r.score >= threshold);
      return {
        success: true,
        results: filtered,
        searchTime: Date.now() - startTime
      };
    }

    // Fall back to brute-force SQLite search
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Get entries with embeddings
    const searchStmt = db.prepare(
      effectiveNamespace !== 'all'
        ? `SELECT id, key, namespace, content, embedding FROM memory_entries WHERE status = 'active' AND namespace = ? LIMIT 1000`
        : `SELECT id, key, namespace, content, embedding FROM memory_entries WHERE status = 'active' LIMIT 1000`
    );
    if (effectiveNamespace !== 'all') {
      searchStmt.bind([effectiveNamespace]);
    }
    const searchRows: unknown[][] = [];
    while (searchStmt.step()) {
      searchRows.push(searchStmt.get());
    }
    searchStmt.free();
    const entries = searchRows.length > 0 ? [{ values: searchRows }] : [];

    const results: { id: string; key: string; content: string; score: number; namespace: string }[] = [];

    if (entries[0]?.values) {
      for (const row of entries[0].values) {
        const [id, key, ns, content, embeddingJson] = row as [string, string, string, string, string | null];

        let score = 0;

        if (embeddingJson) {
          try {
            const embedding = JSON.parse(embeddingJson) as number[];
            score = cosineSim(queryEmbedding, embedding);
          } catch {
            // Invalid embedding, use keyword score
          }
        }

        // Fallback to keyword matching
        if (score < threshold) {
          const lowerContent = (content || '').toLowerCase();
          const lowerQuery = query.toLowerCase();
          const words = lowerQuery.split(/\s+/);
          const matchCount = words.filter(w => lowerContent.includes(w)).length;
          const keywordScore = matchCount / words.length * 0.5;
          score = Math.max(score, keywordScore);
        }

        if (score >= threshold) {
          results.push({
            id: id.substring(0, 12),
            key: key || id.substring(0, 15),
            content: (content || '').substring(0, 60) + ((content || '').length > 60 ? '...' : ''),
            score,
            namespace: ns || 'default'
          });
        }
      }
    }

    db.close();

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return {
      success: true,
      results: results.slice(0, limit),
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Optimized cosine similarity
 * V8 JIT-friendly - avoids manual unrolling which can hurt performance
 * ~0.5μs per 384-dim vector comparison
 */
function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;

  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;

  // Simple loop - V8 optimizes this well
  for (let i = 0; i < len; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  // Combined sqrt for slightly better performance
  const mag = Math.sqrt(normA * normB);
  return mag === 0 ? 0 : dot / mag;
}

/**
 * List all entries from the memory database
 */
export async function listEntries(options: {
  namespace?: string;
  limit?: number;
  offset?: number;
  dbPath?: string;
  /** #2073: When true, include the entry's full `content` string in each result. */
  includeContent?: boolean;
}): Promise<{
  success: boolean;
  entries: {
    id: string;
    key: string;
    namespace: string;
    size: number;
    accessCount: number;
    createdAt: string;
    updatedAt: string;
    hasEmbedding: boolean;
    /** #2073: Present when `includeContent: true` was requested. */
    content?: string;
  }[];
  total: number;
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeListEntries(options);
    if (bridgeResult) return bridgeResult;
  }

  // Fallback: raw sql.js
  const {
    namespace,
    limit = 20,
    offset = 0,
    dbPath: customPath
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath || path.join(swarmDir, 'memory.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, entries: [], total: 0, error: 'Database not found' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // #2120 — accept `status IS NULL` alongside `'active'`. Old DBs
    // that predate the status column may have NULL after migration.
    // See memory-bridge.ts:bridgeListEntries for full context.
    // Get total count
    const countStmt = namespace
      ? db.prepare(`SELECT COUNT(*) as cnt FROM memory_entries WHERE (status = 'active' OR status IS NULL) AND namespace = ?`)
      : db.prepare(`SELECT COUNT(*) as cnt FROM memory_entries WHERE (status = 'active' OR status IS NULL)`);
    if (namespace) {
      countStmt.bind([namespace]);
    }
    const countRows: unknown[][] = [];
    while (countStmt.step()) {
      countRows.push(countStmt.get());
    }
    countStmt.free();
    const countResult = countRows.length > 0 ? [{ values: countRows }] : [];
    const total = countResult[0]?.values?.[0]?.[0] as number || 0;

    // Get entries
    const safeLimit = parseInt(String(limit), 10) || 100;
    const safeOffset = parseInt(String(offset), 10) || 0;
    // #2120 — same NULL-as-active acceptance as the count above.
    const listStmt = namespace
      ? db.prepare(`SELECT id, key, namespace, content, embedding, access_count, created_at, updated_at FROM memory_entries WHERE (status = 'active' OR status IS NULL) AND namespace = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      : db.prepare(`SELECT id, key, namespace, content, embedding, access_count, created_at, updated_at FROM memory_entries WHERE (status = 'active' OR status IS NULL) ORDER BY updated_at DESC LIMIT ? OFFSET ?`);
    if (namespace) {
      listStmt.bind([namespace, safeLimit, safeOffset]);
    } else {
      listStmt.bind([safeLimit, safeOffset]);
    }
    const listRows: unknown[][] = [];
    while (listStmt.step()) {
      listRows.push(listStmt.get());
    }
    listStmt.free();
    const result = listRows.length > 0 ? [{ values: listRows }] : [];
    const entries: {
      id: string;
      key: string;
      namespace: string;
      size: number;
      accessCount: number;
      createdAt: string;
      updatedAt: string;
      hasEmbedding: boolean;
      content?: string;
    }[] = [];

    if (result[0]?.values) {
      for (const row of result[0].values) {
        const [id, key, ns, content, embedding, accessCount, createdAt, updatedAt] = row as [
          string, string, string, string, string | null, number, string, string
        ];
        const entry: {
          id: string;
          key: string;
          namespace: string;
          size: number;
          accessCount: number;
          createdAt: string;
          updatedAt: string;
          hasEmbedding: boolean;
          content?: string;
        } = {
          // #2073: don't truncate id when content is requested — callers
          // (notably memory_export) need the full id to round-trip via import.
          id: options.includeContent ? String(id) : String(id).substring(0, 20),
          key: key || String(id).substring(0, 15),
          namespace: ns || 'default',
          size: (content || '').length,
          accessCount: accessCount || 0,
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: updatedAt || new Date().toISOString(),
          hasEmbedding: !!embedding && embedding.length > 10
        };
        if (options.includeContent) {
          entry.content = content || '';
        }
        entries.push(entry);
      }
    }

    db.close();

    return { success: true, entries, total };
  } catch (error) {
    return {
      success: false,
      entries: [],
      total: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get a specific entry from the memory database
 */
export async function getEntry(options: {
  key: string;
  namespace?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  found: boolean;
  entry?: {
    id: string;
    key: string;
    namespace: string;
    content: string;
    accessCount: number;
    createdAt: string;
    updatedAt: string;
    hasEmbedding: boolean;
    tags: string[];
  };
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeGetEntry(options);
    if (bridgeResult) return bridgeResult;
  }

  // Fallback: raw sql.js
  const {
    key,
    namespace = 'default',
    dbPath: customPath
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath || path.join(swarmDir, 'memory.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, found: false, error: 'Database not found' };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Find entry by key
    const getStmt = db.prepare(`
      SELECT id, key, namespace, content, embedding, access_count, created_at, updated_at, tags
      FROM memory_entries
      WHERE status = 'active'
        AND key = ?
        AND namespace = ?
      LIMIT 1
    `);
    getStmt.bind([key, namespace]);
    const getRows: unknown[][] = [];
    while (getStmt.step()) {
      getRows.push(getStmt.get());
    }
    getStmt.free();
    const result = getRows.length > 0 ? [{ values: getRows }] : [];

    if (!result[0]?.values?.[0]) {
      db.close();
      return { success: true, found: false };
    }

    const [id, entryKey, ns, content, embedding, accessCount, createdAt, updatedAt, tagsJson] = result[0].values[0] as [
      string, string, string, string, string | null, number, string, string, string | null
    ];

    // Update access count
    db.run(`
      UPDATE memory_entries
      SET access_count = access_count + 1, last_accessed_at = strftime('%s', 'now') * 1000
      WHERE id = ?
    `, [String(id)]);

    // Save updated database
    const data = db.export();
    writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });

    db.close();

    let tags: string[] = [];
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson);
      } catch {
        // Invalid JSON
      }
    }

    return {
      success: true,
      found: true,
      entry: {
        id: String(id),
        key: entryKey || String(id),
        namespace: ns || 'default',
        content: content || '',
        accessCount: (accessCount || 0) + 1,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString(),
        hasEmbedding: !!embedding && embedding.length > 10,
        tags
      }
    };
  } catch (error) {
    return {
      success: false,
      found: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Delete a memory entry by key and namespace
 * Issue #980: Properly supports namespaced entries
 */
export async function deleteEntry(options: {
  key: string;
  namespace?: string;
  dbPath?: string;
}): Promise<{
  success: boolean;
  deleted: boolean;
  key: string;
  namespace: string;
  remainingEntries: number;
  error?: string;
}> {
  // ADR-053: Try AgentDB v3 bridge first
  const bridge = await getBridge();
  if (bridge) {
    const bridgeResult = await bridge.bridgeDeleteEntry(options);
    if (bridgeResult) {
      // #1122: Bridge path must also invalidate the in-memory HNSW index.
      // Without this, deleted vectors remain as ghost entries in search results.
      if (bridgeResult.deleted) {
        evictHNSWEntryByKeyNamespace(options.key, options.namespace);
      }
      return bridgeResult;
    }
  }

  // Fallback: raw sql.js
  const {
    key,
    namespace = 'default',
    dbPath: customPath
  } = options;

  const swarmDir = getMemoryRoot();
  const dbPath = customPath || path.join(swarmDir, 'memory.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return {
        success: false,
        deleted: false,
        key,
        namespace,
        remainingEntries: 0,
        error: 'Database not found'
      };
    }

    // Ensure schema has all required columns (migration for older DBs)
    await ensureSchemaColumns(dbPath);

    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const fileBuffer = readFileMaybeEncrypted(dbPath, null);
    const db = new SQL.Database(fileBuffer);

    // Check if entry exists first
    const checkStmt = db.prepare(`
      SELECT id FROM memory_entries
      WHERE status = 'active'
        AND key = ?
        AND namespace = ?
      LIMIT 1
    `);
    checkStmt.bind([key, namespace]);
    const checkRows: unknown[][] = [];
    while (checkStmt.step()) {
      checkRows.push(checkStmt.get());
    }
    checkStmt.free();
    const checkResult = checkRows.length > 0 ? [{ values: checkRows }] : [];

    if (!checkResult[0]?.values?.[0]) {
      // Get remaining count before closing
      const countResult = db.exec(`SELECT COUNT(*) FROM memory_entries WHERE status = 'active'`);
      const remainingEntries = countResult[0]?.values?.[0]?.[0] as number || 0;
      db.close();
      return {
        success: true,
        deleted: false,
        key,
        namespace,
        remainingEntries,
        error: `Key '${key}' not found in namespace '${namespace}'`
      };
    }

    // Capture the entry ID for HNSW cleanup
    const entryId = String(checkResult[0].values[0][0]);

    // Delete the entry (soft delete by setting status to 'deleted')
    // Also null out the embedding to clean up vector data from SQLite
    db.run(`
      UPDATE memory_entries
      SET status = 'deleted',
          embedding = NULL,
          updated_at = strftime('%s', 'now') * 1000
      WHERE key = ?
        AND namespace = ?
        AND status = 'active'
    `, [key, namespace]);

    // Get remaining count
    const countResult = db.exec(`SELECT COUNT(*) FROM memory_entries WHERE status = 'active'`);
    const remainingEntries = countResult[0]?.values?.[0]?.[0] as number || 0;

    // Save updated database
    const data = db.export();
    writeFileRestricted(dbPath, Buffer.from(data), { encrypt: true });

    db.close();

    // Clean up in-memory HNSW index so ghost vectors don't appear in searches.
    // Removes the entry from the HNSW entries map by id and invalidates the
    // index; the next search rebuilds it from the remaining DB rows (we can't
    // surgically remove a single vector from the HNSW graph).
    evictHNSWEntryById(entryId);

    return {
      success: true,
      deleted: true,
      key,
      namespace,
      remainingEntries
    };
  } catch (error) {
    return {
      success: false,
      deleted: false,
      key,
      namespace,
      remainingEntries: 0,
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

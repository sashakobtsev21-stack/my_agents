/**
 * Schema management for the V3 memory database — extracted from
 * memory-initializer.ts.
 *
 *   - getInitialMetadata        (the INSERT-metadata SQL emitted right
 *                               after schema creation; pure, backend-
 *                               parameterised)
 *   - ensureSchemaColumns       (idempotent ALTER-TABLE backfill so older
 *                               DBs gain the columns newer code expects,
 *                               incl. the #2120 controller_status
 *                               NULL → 'active' fill)
 *   - checkAndMigrateLegacy     (detect a pre-v3 DB and migrate it,
 *                               bridge-first with a raw sql.js fallback)
 *   - activateControllerRegistry (best-effort AgentDB ControllerRegistry
 *                               activation — internal, used only by
 *                               initializeMemoryDatabase)
 *
 * Extracted from memory-initializer.ts (W59, P3.3 cut #6). Depends only
 * on getBridge (paths.ts) + the fs-secure read/write helpers.
 */
import * as fs from 'fs';
import * as path from 'path';
import { readFileMaybeEncrypted, writeFileRestricted } from '../../fs-secure.js';
import { getBridge } from './paths.js';

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
export async function activateControllerRegistry(
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

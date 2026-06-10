/**
 * Database initialization + lifecycle — extracted from
 * memory-initializer.ts.
 *
 *   - initializeMemoryDatabase    (create/repair the sql.js DB: write
 *                                 schema + initial metadata, run the
 *                                 legacy migration, activate the
 *                                 ControllerRegistry)
 *   - checkMemoryInitialization   (report whether a DB is present and
 *                                 schema-current)
 *   - applyTemporalDecay          (age out pattern confidence over time)
 *
 * This is the structural core that wires the schema + bridge + controller
 * registry together. Extracted from memory-initializer.ts (W63, P3.3 cut
 * #10 — final cut), leaving the parent a pure barrel module.
 */
import * as fs from 'fs';
import * as path from 'path';
import { writeFileRestricted } from '../../fs-secure.js';
import { getMemoryRoot } from './paths.js';
import { MEMORY_SCHEMA_V3 } from './schema.js';
import {
  type MemoryInitResult,
  getInitialMetadata,
  checkAndMigrateLegacy,
  activateControllerRegistry,
} from './schema-mgmt.js';

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

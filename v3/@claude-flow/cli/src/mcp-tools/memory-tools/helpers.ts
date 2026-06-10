/**
 * Shared helpers for the memory MCP tools — input validation + key
 * sanitization, glob→regex, project-memory-dir resolution, the legacy
 * JSON-store migration path, the lazy memory-initializer loader, and
 * one-time init. Used by every tool object in memoryTools[].
 *
 * Extracted from memory-tools.ts (W124, P3.16 cut #1).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Legacy JSON store interface (for migration)
export interface LegacyMemoryEntry {
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  storedAt: string;
  accessCount: number;
  lastAccessed: string;
}

export interface LegacyMemoryStore {
  entries: Record<string, LegacyMemoryEntry>;
  version: string;
}

// #1604: Align with memory-initializer.ts — single source of truth is .swarm/memory.db
export const MEMORY_DIR = '.swarm';
export const LEGACY_MEMORY_FILE = 'store.json';
export const LEGACY_MEMORY_DIR = '.claude-flow/memory';
export const MIGRATION_MARKER = '.migrated-to-sqlite';

// getLegacyPath() / getMemoryDir() / ensureMemoryDir() were used by the
// SQLite migration path that lives in memory-initializer.ts now — the
// MCP tool surface just reads the migration marker.
// path that lives in memory-initializer.ts now — the MCP tool surface
// just reads the migration marker.

export function getMigrationMarkerPath(): string {
  return resolve(join(MEMORY_DIR, MIGRATION_MARKER));
}

// D-2: Input bounds for memory parameters
export const MAX_KEY_LENGTH = 1024;
export const MAX_VALUE_SIZE = 1024 * 1024; // 1MB
export const MAX_QUERY_LENGTH = 4096;

// #1425 — single source of truth for the dangerous-character set rejected by
// validateMemoryInput. Imported by sanitizeMemoryKey so write-side sanitization
// and read-side rejection can never drift apart (the symmetry bug behind #1884).
export const DANGEROUS_KEY_CHARS = /[;&|`$(){}[\]<>!#\\\0]|\.\.[/\\]/g;
export const DANGEROUS_KEY_PATTERN = /[;&|`$(){}[\]<>!#\\\0]|\.\.[/\\]/;

export function validateMemoryInput(key?: string, value?: string, query?: string, namespace?: string): void {
  if (key && key.length > MAX_KEY_LENGTH) {
    throw new Error(`Key exceeds maximum length of ${MAX_KEY_LENGTH} characters`);
  }
  if (value && value.length > MAX_VALUE_SIZE) {
    throw new Error(`Value exceeds maximum size of ${MAX_VALUE_SIZE} bytes`);
  }
  if (query && query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`);
  }
  // Reject path traversal and shell metacharacters in keys/namespaces (#1425)
  if (key && DANGEROUS_KEY_PATTERN.test(key)) {
    throw new Error('Key contains disallowed characters');
  }
  if (namespace && DANGEROUS_KEY_PATTERN.test(namespace)) {
    throw new Error('Namespace contains disallowed characters');
  }
}

// #1884 — sanitize a key produced from arbitrary input (markdown headings,
// frontmatter names, file names) so it survives validateMemoryInput on the
// read/delete path. Replaces every dangerous char with `_`. Truncates to
// MAX_KEY_LENGTH so the bound check in validateMemoryInput also passes.
// Keep this in sync with DANGEROUS_KEY_PATTERN — they share DANGEROUS_KEY_CHARS.
export function sanitizeMemoryKey(key: string): string {
  const safe = key.replace(DANGEROUS_KEY_CHARS, '_');
  return safe.length > MAX_KEY_LENGTH ? safe.slice(0, MAX_KEY_LENGTH) : safe;
}

// #1937 — minimal glob → RegExp helper for memory_import_claude exclusion
// patterns. Anchored. Supports the three operators the issue's voice-fidelity
// workflow needs:
//   `**` — any chars including path separators
//   `*`  — any chars except path separators
//   `?`  — exactly one char except a path separator
// Everything else is regex-escaped. Used to match absolute file paths.
export function globToRegex(pattern: string): RegExp {
  // Tokenize so we can replace `**` before `*` without overlap.
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i++;
    } else if (c === '*') {
      out += '[^/\\\\]*';
    } else if (c === '?') {
      out += '[^/\\\\]';
    } else if (/[.+^$|(){}\[\]\\]/.test(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

// #1883 — resolve the Claude-Code project memory directory for the *current*
// project. Claude Code hashes the project path differently per host OS, and
// our previous logic only POSIX-slash-replaced cwd, which breaks for:
//   - WSL bridges where cwd is `/mnt/<drive>/...` but Claude Code is on Windows
//   - paths containing spaces (Claude Code replaces spaces with dashes)
//   - any leading slash on POSIX (Claude Code strips it)
// Strategy: try several candidate hashes and return the first one with a
// memory dir that exists. An explicit `projectPathOverride` short-circuits
// the heuristics for callers that know the canonical project path.
export function resolveProjectMemoryDir(claudeProjectsDir: string, projectPathOverride?: string): { memDir: string; projectHash: string } | null {
  const candidates = new Set<string>();
  const sources: string[] = [];

  if (projectPathOverride && projectPathOverride.length > 0) {
    sources.push(projectPathOverride);
  } else {
    sources.push(process.cwd());
  }

  for (const source of sources) {
    // Candidate 1: legacy POSIX hash — what shipped before #1883
    candidates.add(source.replace(/\//g, '-'));

    // Candidate 2: WSL `/mnt/<drive>/...` translated to Claude-Code Windows hash
    // e.g. `/mnt/c/Users/x/Project Name` → `C--Users-x-Project-Name`
    const wsl = source.match(/^\/mnt\/([a-z])(\/.*)?$/i);
    if (wsl) {
      const drive = wsl[1].toUpperCase();
      const rest = (wsl[2] ?? '').replace(/\//g, '-').replace(/ /g, '-');
      candidates.add(`${drive}-${rest}`);
    }

    // Candidate 3: POSIX hash with leading dash stripped (Claude Code on macOS/Linux)
    const stripped = source.replace(/\//g, '-').replace(/^-+/, '');
    candidates.add(stripped);

    // Candidate 4: spaces replaced with dashes (Claude Code's space rule)
    candidates.add(source.replace(/\//g, '-').replace(/ /g, '-'));

    // Candidate 5 (#1939): native Win32 path on a Win32 Claude Code install.
    // `C:\Users\tobia\OneDrive\Desktop\Claude Stuff` →
    // `C--Users-tobia-OneDrive-Desktop-Claude-Stuff`. Claude Code's on-disk
    // slug replaces drive-colon AND backslashes AND whitespace with `-`.
    // The earlier candidates only handled forward slashes, so a Win32+Win32
    // setup never matched.
    if (/^[A-Za-z]:[\\/]/.test(source)) {
      candidates.add(source.replace(/[:\\/]/g, '-').replace(/\s+/g, '-'));
    }
  }

  for (const projectHash of candidates) {
    const memDir = join(claudeProjectsDir, projectHash, 'memory');
    if (existsSync(memDir)) return { memDir, projectHash };
  }
  return null;
}

/**
 * Check if legacy JSON store exists in old .claude-flow/memory/ location
 */
export function hasLegacyStore(): boolean {
  const legacyPath = resolve(join(LEGACY_MEMORY_DIR, LEGACY_MEMORY_FILE));
  const migrationMarker = resolve(join(LEGACY_MEMORY_DIR, MIGRATION_MARKER));
  return existsSync(legacyPath) && !existsSync(migrationMarker);
}

/**
 * Load legacy JSON store for migration
 */
export function loadLegacyStore(): LegacyMemoryStore | null {
  try {
    const legacyPath = resolve(join(LEGACY_MEMORY_DIR, LEGACY_MEMORY_FILE));
    if (existsSync(legacyPath)) {
      const data = readFileSync(legacyPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Return null on error
  }
  return null;
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete(): void {
  const legacyDir = resolve(LEGACY_MEMORY_DIR);
  if (!existsSync(legacyDir)) mkdirSync(legacyDir, { recursive: true });
  writeFileSync(resolve(join(LEGACY_MEMORY_DIR, MIGRATION_MARKER)), JSON.stringify({
    migratedAt: new Date().toISOString(),
    version: '3.0.0',
  }), 'utf-8');
}

/**
 * Lazy-load memory initializer functions to avoid circular deps
 */
export async function getMemoryFunctions() {
  const {
    storeEntry,
    searchEntries,
    listEntries,
    getEntry,
    deleteEntry,
    initializeMemoryDatabase,
    checkMemoryInitialization,
  } = await import('../../memory/memory-initializer.js');

  return {
    storeEntry,
    searchEntries,
    listEntries,
    getEntry,
    deleteEntry,
    initializeMemoryDatabase,
    checkMemoryInitialization,
  };
}

/**
 * Ensure memory database is initialized and migrate legacy data if needed.
 * #1606: Wrapped in try/catch to prevent process-level crashes that kill
 * the stdio MCP transport on Windows/Codex.
 */
export async function ensureInitialized(): Promise<void> {
  try {
    const { initializeMemoryDatabase, checkMemoryInitialization, storeEntry } = await getMemoryFunctions();

    // Check if already initialized
    const status = await checkMemoryInitialization();
    if (!status.initialized) {
      await initializeMemoryDatabase({ force: false, verbose: false });
    }

    // Migrate legacy JSON data if exists (from old .claude-flow/memory/ location)
    if (hasLegacyStore()) {
      const legacyStore = loadLegacyStore();
      if (legacyStore && Object.keys(legacyStore.entries).length > 0) {
        console.error('[MCP Memory] Migrating legacy JSON store to sql.js...');
        let migrated = 0;

        for (const [key, entry] of Object.entries(legacyStore.entries)) {
          try {
            const value = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
            await storeEntry({
              key,
              value,
              namespace: 'default',
              generateEmbeddingFlag: true,
            });
            migrated++;
          } catch (e) {
            console.error(`[MCP Memory] Failed to migrate key "${key}":`, e);
          }
        }

        console.error(`[MCP Memory] Migrated ${migrated}/${Object.keys(legacyStore.entries).length} entries`);
        markMigrationComplete();
      }
    }
  } catch (error) {
    console.error('[MCP Memory] Initialization failed:', error instanceof Error ? error.message : error);
  }
}


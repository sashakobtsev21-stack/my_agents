/**
 * Shared path resolution + AgentDB bridge loader for the
 * memory-initializer cluster.
 *
 * Extracted from memory-initializer.ts (W55, P3.3 cut #3). These are the
 * foundational helpers every other function in the cluster depends on —
 * pulling them into their own module lets the HNSW / CRUD / embedding
 * sub-modules share them without a circular dependency back on the
 * monolith. Re-exported from memory-initializer.ts so external callers
 * keep working byte-identically.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * #1854: previously every site that needed the memory directory hardcoded
 * `getMemoryRoot()`, so the documented config entry
 * points (`memory.persistPath` config field, `memory configure --path`,
 * `CLAUDE_FLOW_MEMORY_PATH` env var) all silently no-op'd. This helper
 * is the single source of truth — every `.swarm/memory.db` resolution in
 * this file flows through it.
 *
 * Precedence (highest → lowest):
 *   1. CLAUDE_FLOW_MEMORY_PATH env var
 *   2. memory.persistPath / memory.path in claude-flow.config.json (cwd or
 *      the directory the CLI was invoked from)
 *   3. Default: cwd/.swarm
 *
 * Cached per-process so repeated lookups are cheap; reset only by spawning
 * a fresh process (which is how config changes already propagate).
 */
let _memoryRootCache: string | undefined;
export function getMemoryRoot(): string {
  if (_memoryRootCache !== undefined) return _memoryRootCache;

  // 1. Env var
  const envPath = process.env.CLAUDE_FLOW_MEMORY_PATH;
  if (envPath && envPath.trim().length > 0) {
    _memoryRootCache = path.resolve(envPath);
    return _memoryRootCache;
  }

  // 2. Config file (claude-flow.config.json)
  const configCandidates = [
    path.resolve(process.cwd(), 'claude-flow.config.json'),
    path.resolve(process.cwd(), '.claude-flow', 'config.json'),
  ];
  for (const configPath of configCandidates) {
    if (!fs.existsSync(configPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const fromConfig: unknown = raw?.memory?.persistPath ?? raw?.memory?.path;
      if (typeof fromConfig === 'string' && fromConfig.trim().length > 0) {
        _memoryRootCache = path.resolve(fromConfig);
        return _memoryRootCache;
      }
    } catch {
      /* malformed config — fall through to default */
    }
  }

  // 3. Default
  _memoryRootCache = path.resolve(process.cwd(), '.swarm');
  return _memoryRootCache;
}

/** For tests + the `memory configure` flow that mutates the config at runtime. */
export function _resetMemoryRootCache(): void {
  _memoryRootCache = undefined;
}

/**
 * #2105: Resolve the full path to the SQLite memory database.
 * Precedence (highest to lowest):
 *   1. cliFlag             - explicit --path flag passed by a subcommand
 *   2. CLAUDE_FLOW_DB_PATH - full file-path override (new in #2105)
 *   3. getMemoryRoot()/memory.db - directory from CLAUDE_FLOW_MEMORY_PATH /
 *                                  config / default cwd/.swarm
 */
export function resolveDbPath(cliFlag?: string): string {
  if (cliFlag && cliFlag.trim().length > 0) {
    return path.resolve(cliFlag);
  }
  const envDb = process.env.CLAUDE_FLOW_DB_PATH;
  if (envDb && envDb.trim().length > 0) {
    return path.resolve(envDb);
  }
  return path.join(getMemoryRoot(), 'memory.db');
}

// ADR-053: Lazy import of AgentDB v3 bridge
let _bridge: typeof import('../memory-bridge.js') | null | undefined;
export async function getBridge(): Promise<typeof import('../memory-bridge.js') | null> {
  // #2120 — Allow callers to force the raw sql.js fallback path. The
  // ensureSchemaColumns backfill (NULL → 'active') lives in that
  // fallback, so smokes that verify legacy-DB migration semantics need a
  // way to bypass the bridge. Also useful when the bridge would hang on
  // network-bound init (Xenova model fetch) in offline CI.
  if (process.env.CLAUDE_FLOW_DISABLE_BRIDGE === '1') return null;
  if (_bridge === null) return null;
  if (_bridge) return _bridge;
  try {
    _bridge = await import('../memory-bridge.js');
    return _bridge;
  } catch {
    _bridge = null;
    return null;
  }
}

/** Test-only: reset the cached bridge so a fresh import is attempted. */
export function _resetBridgeCache(): void {
  _bridge = undefined;
}

/**
 * Whether the AgentDB bridge has been successfully loaded this process.
 * Used by getHNSWStatus to report HNSW-equivalent availability without
 * re-triggering the lazy import. Returns false while `_bridge` is still
 * `undefined` (never tried) or `null` (disabled/failed).
 */
export function isBridgeLoaded(): boolean {
  return !!_bridge;
}

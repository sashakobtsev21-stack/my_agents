/**
 * Shared infrastructure for the AgentDB memory bridge — extracted from
 * memory-bridge.ts.
 *
 * Owns the ControllerRegistry lazy singleton plus every cross-cutting
 * helper the bridge* operations build on:
 *   - errMsg                      (safe message extraction)
 *   - registry state singletons   (registryPromise / registryInstance /
 *                                 bridgeAvailable)
 *   - getDbPath                   (#1945 path resolution via getMemoryRoot,
 *                                 with traversal protection)
 *   - generateId                  (secure random entry id)
 *   - getRegistry                 (lazy ControllerRegistry init)
 *   - cacheGet / cacheSet / cacheInvalidate   (TieredCache helpers)
 *   - guardValidate               (MutationGuard validation)
 *   - logAttestation              (AttestationLog write)
 *   - getDb                       (memory_entries table provisioning)
 *   - isBridgeAvailable / getControllerRegistry / shutdownBridge
 *                                 (registry lifecycle)
 *
 * Extracted from memory-bridge.ts (W65, P3.4 cut #2) — the foundation
 * every bridge* domain module imports, pulled out before the domain
 * groups (same play as paths.ts in P3.3).
 */
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'node:module';

/** Safely extract a message from an unknown thrown value (no `any`). */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ===== Lazy singleton =====

let registryPromise: Promise<any> | null = null;
let registryInstance: any = null;
let bridgeAvailable: boolean | null = null;

/**
 * Resolve database path with path traversal protection.
 * Only allows paths within or below the project's working directory,
 * or the special ':memory:' path.
 *
 * #1945: the previous hard-coded `<cwd>/.swarm/memory.db` default ignored
 * `CLAUDE_FLOW_MEMORY_PATH` / `claude-flow.config.json#memory.persistPath`
 * — so users with non-default memory paths had `memory init` write to e.g.
 * `data/memory/memory.db` while `bridgeStoreEntry()` wrote to
 * `.swarm/memory.db`. CLI store reported success against the wrong file and
 * a fresh process reading the configured path saw nothing.
 *
 * Use `getMemoryRoot()` (from memory-initializer) so the bridge and the
 * initializer agree on the same file. Imported via require() to avoid a
 * circular ESM dep between memory-initializer.ts and memory-bridge.ts.
 */
export function getDbPath(customPath?: string): string {
  let defaultDir = path.resolve(process.cwd(), '.swarm');
  try {
    // `getMemoryRoot()` honors $CLAUDE_FLOW_MEMORY_PATH, then the
    // claude-flow.config.json `memory.persistPath`, then defaults to `.swarm`.
    const cjsRequire = createRequire(import.meta.url);
    const mod = cjsRequire('../memory-initializer.js') as { getMemoryRoot?: () => string };
    if (typeof mod.getMemoryRoot === 'function') {
      defaultDir = mod.getMemoryRoot();
    }
  } catch {
    /* memory-initializer not resolvable in this build — keep `.swarm/` default */
  }
  if (!customPath) return path.join(defaultDir, 'memory.db');
  if (customPath === ':memory:') return ':memory:';
  const resolved = path.resolve(customPath);
  // Ensure the path doesn't escape the working directory.
  const cwd = process.cwd();
  if (!resolved.startsWith(cwd)) {
    return path.join(defaultDir, 'memory.db'); // fallback to safe default
  }
  return resolved;
}

/**
 * Generate a secure random ID for memory entries.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Lazily initialize the ControllerRegistry singleton.
 * Returns null if @claude-flow/memory is not available.
 */
export async function getRegistry(dbPath?: string): Promise<any | null> {
  if (bridgeAvailable === false) return null;

  if (registryInstance) return registryInstance;

  if (!registryPromise) {
    registryPromise = (async () => {
      try {
        const { ControllerRegistry } = await import('@claude-flow/memory');
        const registry = new ControllerRegistry();

        // Suppress noisy console.log during init
        const origLog = console.log;
        console.log = (...args: unknown[]) => {
          const msg = String(args[0] ?? '');
          if (msg.includes('Transformers.js') ||
              msg.includes('better-sqlite3') ||
              msg.includes('[AgentDB]') ||
              msg.includes('[HNSWLibBackend]') ||
              msg.includes('RuVector graph')) return;
          origLog.apply(console, args);
        };

        try {
          await (registry as any).initialize({
            dbPath: dbPath || getDbPath(),
            embeddingModel: 'Xenova/all-MiniLM-L6-v2',
            dimension: 384,
            vectorBackend: 'auto',
            controllers: {
              reasoningBank: true,
              learningBridge: false,
              tieredCache: true,
              hierarchicalMemory: true,
              memoryConsolidation: true,
              memoryGraph: true,
              vectorBackend: true,
            },
          });
        } finally {
          console.log = origLog;
        }

        // Wire intelligence module as the learning backend.
        // AgentDB's ReasoningBank/LearningSystem need a better-sqlite3 db
        // handle which ControllerRegistry doesn't expose. Instead, use the
        // local intelligence module (SONA + LocalReasoningBank + file
        // persistence) for learning.
        //
        // PERF: parallelize the two independent post-init paths
        // (intelligence module load + agentdb import). Previously these
        // ran serially, adding ~50-150ms to cold start. Both can resolve
        // concurrently because they touch disjoint controller slots.
        try {
          const reg = registry as any;

          const intelligencePromise = (async () => {
            try {
              const intelligence = await import('../intelligence.js');
              const initResult = await intelligence.initializeIntelligence();

              if (initResult.reasoningBankEnabled) {
                const rb = intelligence.getReasoningBank();
                if (rb && !reg.get('reasoningBank')) {
                  if (typeof reg.set === 'function') reg.set('reasoningBank', rb);
                  else reg._controllers = { ...(reg._controllers || {}), reasoningBank: rb };
                }
              }

              if (initResult.sonaEnabled) {
                const sona = intelligence.getSonaCoordinator();
                if (sona && !reg.get('learningSystem')) {
                  if (typeof reg.set === 'function') reg.set('learningSystem', sona);
                  else reg._controllers = { ...(reg._controllers || {}), learningSystem: sona };
                }
              }
            } catch { /* intelligence module not available — learning stays unwired */ }
          })();

          const agentdbPromise = (async () => {
            // Single import shared across SkillLibrary + SemanticRouter probe.
            let agentdb: Record<string, unknown> | null = null;
            try { agentdb = (await import('agentdb')) as unknown as Record<string, unknown>; }
            catch { return; /* AgentDB not available */ }

            // SkillLibrary (no db required)
            try {
              const SkillCtor = agentdb.SkillLibrary as (new () => unknown) | undefined;
              if (SkillCtor && !reg.get('skills')) {
                const sk = new SkillCtor();
                if (typeof reg.set === 'function') reg.set('skills', sk);
                else reg._controllers = { ...(reg._controllers || {}), skills: sk };
              }
            } catch { /* SkillLibrary optional */ }

            // ADR-093 F9: probe multiple router class names across agentdb
            // alpha versions (alpha.10 had SemanticRouter; alpha.11+ removed
            // it in favor of @ruvector/router; future versions may
            // reintroduce). Wire only if .route() is callable.
            try {
              const candidates = ['SemanticRouter', 'IntentRouter', 'TaskRouter'] as const;
              let routerInstance: { route?: (input: string) => Promise<unknown> | unknown } | null = null;
              for (const name of candidates) {
                const Ctor = agentdb[name];
                if (typeof Ctor === 'function') {
                  try {
                    const inst = (() => {
                      try { return new (Ctor as new (cfg: { dimension: number }) => unknown)({ dimension: 384 }); }
                      catch { return new (Ctor as new () => unknown)(); }
                    })() as { route?: (input: string) => Promise<unknown> | unknown };
                    if (inst && typeof inst.route === 'function') {
                      routerInstance = inst;
                      break;
                    }
                  } catch { /* try next candidate */ }
                }
              }
              if (routerInstance && !reg.get('semanticRouter')) {
                if (typeof reg.set === 'function') reg.set('semanticRouter', routerInstance);
                else reg._controllers = { ...(reg._controllers || {}), semanticRouter: routerInstance };
              }
            } catch { /* router optional */ }

            // ADR-095 G7: load disabled-by-default controllers via direct
            // file:// URLs from the bundled agentdb. agentdb's exports
            // field doesn't expose these subpaths and we can't reliably
            // patch it across pnpm-hoisted multi-version trees, so we
            // sidestep the exports field entirely and import the file
            // by absolute URL. Only loads controllers whose constructor
            // is safe with no special prerequisites — others remain off
            // pending per-controller activation ADRs.
            try {
              const { createRequire } = await import('node:module');
              const { pathToFileURL } = await import('node:url');
              const path = await import('node:path');
              const fs = await import('node:fs');
              const cjsRequire = createRequire(import.meta.url);
              let adbPkgJsonPath: string | null = null;
              try { adbPkgJsonPath = cjsRequire.resolve('agentdb/package.json'); } catch { adbPkgJsonPath = null; }
              if (adbPkgJsonPath) {
                const adbDir = path.dirname(adbPkgJsonPath);
                const candidates: Array<{ name: string; relPath: string; configurable: boolean }> = [
                  // GNNService and RVFOptimizer can construct with no args
                  // in current agentdb — safe to activate as-is.
                  { name: 'gnnService', relPath: 'dist/src/services/GNNService.js', configurable: false },
                  { name: 'rvfOptimizer', relPath: 'dist/src/optimizations/RVFOptimizer.js', configurable: false },
                  // ADR-095 G7 follow-up: MutationGuard constructs cleanly
                  // with no args and exposes WASM-backed proof generation.
                  // No external deps; safe-default activation.
                  { name: 'mutationGuard', relPath: 'dist/src/security/MutationGuard.js', configurable: false },
                  // AttestationLog needs a sqlite db handle — wired below
                  // separately because we have to construct a db too.
                  // GuardedVectorBackend needs key material — leave for
                  // follow-up ADR.
                ];
                for (const cand of candidates) {
                  if (reg.get(cand.name)) continue;
                  const abs = path.join(adbDir, cand.relPath);
                  if (!fs.existsSync(abs)) continue;
                  try {
                    const url = pathToFileURL(abs).href;
                    const mod = await import(url) as Record<string, unknown>;
                    // Look for a default export, named export matching the
                    // file basename, or any class-typed export.
                    const baseName = path.basename(cand.relPath, '.js');
                    const Ctor = (mod[baseName] || mod.default ||
                      Object.values(mod).find(v => typeof v === 'function')) as (new () => unknown) | undefined;
                    if (typeof Ctor !== 'function') continue;
                    const inst = new Ctor();
                    if (typeof reg.set === 'function') reg.set(cand.name, inst);
                    else reg._controllers = { ...(reg._controllers || {}), [cand.name]: inst };
                  } catch { /* skip controllers that fail to construct */ }
                }

                // AttestationLog activation — needs a better-sqlite3
                // database. We open a dedicated file at .swarm/attestation.db
                // (separate from the main memory.db so the audit trail
                // is isolated). Best-effort: if better-sqlite3 isn't
                // resolvable in this env, skip cleanly.
                let attestationInst: unknown = null;
                if (!reg.get('attestationLog')) {
                  try {
                    const attestationFile = path.join(adbDir, 'dist/src/security/AttestationLog.js');
                    if (fs.existsSync(attestationFile)) {
                      const Database = (cjsRequire('better-sqlite3') as unknown) as new (p: string) => unknown;
                      const swarmDir = path.resolve(process.cwd(), '.swarm');
                      if (!fs.existsSync(swarmDir)) fs.mkdirSync(swarmDir, { recursive: true });
                      const dbPath = path.join(swarmDir, 'attestation.db');
                      const db = new Database(dbPath);
                      const url = pathToFileURL(attestationFile).href;
                      const mod = await import(url) as Record<string, unknown>;
                      const Ctor = mod.AttestationLog as (new (cfg: { db: unknown }) => unknown) | undefined;
                      if (typeof Ctor === 'function') {
                        const inst = new Ctor({ db });
                        attestationInst = inst;
                        if (typeof reg.set === 'function') reg.set('attestationLog', inst);
                        else reg._controllers = { ...(reg._controllers || {}), attestationLog: inst };
                      }
                    }
                  } catch { /* better-sqlite3 missing or schema init failed — skip silently */ }
                }

                // ADR-095 G7 follow-up: GuardedVectorBackend wraps the
                // existing vectorBackend with mutationGuard + attestationLog
                // for proof-gated state mutations (ADR-060). All three
                // dependencies are reachable here — vectorBackend is in
                // the baseline init, mutationGuard was just activated, and
                // attestationLog is constructed above. Skip if any piece
                // is missing rather than constructing with undefined.
                if (!reg.get('guardedVectorBackend')) {
                  try {
                    const gvbFile = path.join(adbDir, 'dist/src/backends/ruvector/GuardedVectorBackend.js');
                    if (fs.existsSync(gvbFile)) {
                      const inner = reg.get('vectorBackend');
                      const guard = reg.get('mutationGuard');
                      const log = attestationInst ?? reg.get('attestationLog');
                      if (inner && guard) {
                        const url = pathToFileURL(gvbFile).href;
                        const mod = await import(url) as Record<string, unknown>;
                        const Ctor = mod.GuardedVectorBackend as (new (i: unknown, g: unknown, l: unknown) => unknown) | undefined;
                        if (typeof Ctor === 'function') {
                          const inst = new Ctor(inner, guard, log);
                          if (typeof reg.set === 'function') reg.set('guardedVectorBackend', inst);
                          else reg._controllers = { ...(reg._controllers || {}), guardedVectorBackend: inst };
                        }
                      }
                    }
                  } catch { /* GuardedVectorBackend optional */ }
                }
              }
            } catch { /* G7 wiring optional */ }
          })();

          // Run both in parallel; settle either way so a single failing
          // path doesn't tear down the rest of the post-init wiring.
          await Promise.allSettled([intelligencePromise, agentdbPromise]);

          // Remaining disabled controllers tracked in ADR-095 G7 for
          // per-controller activation ADRs:
          //   - graphAdapter (graph DB adapter — needs graph DB connection)
        } catch {
          // Top-level catch — registry stays usable even if post-init wiring fails wholesale.
        }

        registryInstance = registry;
        bridgeAvailable = true;
        return registry;
      } catch {
        bridgeAvailable = false;
        registryPromise = null;
        return null;
      }
    })();
  }

  return registryPromise;
}

// ===== Phase 2: TieredCache helpers =====

/**
 * Try to read from TieredCache before hitting DB.
 * Returns cached value or null if cache miss.
 */
export async function cacheGet(registry: any, cacheKey: string): Promise<any | null> {
  try {
    const cache = registry.get('tieredCache');
    if (!cache || typeof cache.get !== 'function') return null;
    return cache.get(cacheKey) ?? null;
  } catch {
    return null;
  }
}

/**
 * Write to TieredCache after DB write.
 */
export async function cacheSet(registry: any, cacheKey: string, value: any): Promise<void> {
  try {
    const cache = registry.get('tieredCache');
    if (cache && typeof cache.set === 'function') {
      cache.set(cacheKey, value);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Invalidate a cache key after mutation.
 */
export async function cacheInvalidate(registry: any, cacheKey: string): Promise<void> {
  try {
    const cache = registry.get('tieredCache');
    if (cache && typeof cache.delete === 'function') {
      cache.delete(cacheKey);
    }
  } catch {
    // Non-fatal
  }
}

// ===== Phase 2: MutationGuard helpers =====

/**
 * Validate a mutation through MutationGuard before executing.
 * Returns true if the mutation is allowed, false if rejected.
 * When guard is unavailable (not installed), mutations are allowed.
 * When guard is present but throws, mutations are DENIED (fail-closed).
 */
export async function guardValidate(
  registry: any,
  operation: string,
  params: Record<string, unknown>,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const guard = registry.get('mutationGuard');
    if (!guard || typeof guard.validate !== 'function') {
      return { allowed: true }; // No guard installed = allow (degraded mode)
    }
    const result = guard.validate({ operation, params, timestamp: Date.now() });
    return { allowed: result?.allowed === true, reason: result?.reason };
  } catch {
    return { allowed: false, reason: 'MutationGuard validation error' }; // Fail-closed
  }
}

// ===== Phase 3: AttestationLog helpers =====

/**
 * Log a write operation to AttestationLog/WitnessChain.
 */
export async function logAttestation(
  registry: any,
  operation: string,
  entryId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const attestation = registry.get('attestationLog');
    if (!attestation) return;

    if (typeof attestation.record === 'function') {
      attestation.record({ operation, entryId, timestamp: Date.now(), ...metadata });
    } else if (typeof attestation.log === 'function') {
      attestation.log(operation, entryId, metadata);
    }
  } catch {
    // Non-fatal — attestation is observability, not correctness
  }
}

/**
 * Get the AgentDB database handle and ensure memory_entries table exists.
 * Returns null if not available.
 */
export function getDb(registry: any): any | null {
  const agentdb = registry.getAgentDB();
  if (!agentdb?.database) return null;

  const db = agentdb.database;

  // Ensure memory_entries table exists (idempotent)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      namespace TEXT DEFAULT 'default',
      content TEXT NOT NULL,
      type TEXT DEFAULT 'semantic',
      embedding TEXT,
      embedding_model TEXT DEFAULT 'local',
      embedding_dimensions INTEGER,
      tags TEXT,
      metadata TEXT,
      owner_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      expires_at INTEGER,
      last_accessed_at INTEGER,
      access_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      UNIQUE(namespace, key)
    )`);
    // Ensure indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bridge_ns ON memory_entries(namespace)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bridge_key ON memory_entries(key)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bridge_status ON memory_entries(status)`);
  } catch {
    // Table already exists or db is read-only — that's fine
  }

  return { db, agentdb };
}

// ===== Registry lifecycle =====

/**
 * Check if the AgentDB v3 bridge is available.
 */
export async function isBridgeAvailable(dbPath?: string): Promise<boolean> {
  if (bridgeAvailable !== null) return bridgeAvailable;
  const registry = await getRegistry(dbPath);
  return registry !== null;
}

/**
 * Get the ControllerRegistry instance (for advanced consumers).
 */
export async function getControllerRegistry(dbPath?: string): Promise<any | null> {
  return getRegistry(dbPath);
}

/**
 * Shutdown the bridge and release resources.
 */
export async function shutdownBridge(): Promise<void> {
  if (registryInstance) {
    try {
      await registryInstance.shutdown();
    } catch {
      // Best-effort
    }
    registryInstance = null;
    registryPromise = null;
    bridgeAvailable = null;
  }
}

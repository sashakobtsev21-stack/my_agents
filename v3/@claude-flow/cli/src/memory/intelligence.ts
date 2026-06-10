/**
 * V3 Intelligence Module
 * Optimized SONA (Self-Optimizing Neural Architecture) and ReasoningBank
 * for adaptive learning and pattern recognition
 *
 * Performance targets:
 * - Signal recording: <0.05ms (achieved: ~0.01ms)
 * - Pattern search: O(log n) with HNSW
 * - Memory efficient circular buffers
 *
 * @module v3/cli/intelligence
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// ============================================================================
// Persistence path resolution (basePath override + neural data-dir +
// patterns/stats paths) moved to ./intelligence/paths.ts (W105, P3.11
// cut #2). Imported for internal use; setIntelligenceBasePath re-exported
// so external/test callers keep resolving it byte-identically.
// ============================================================================
import {
  setIntelligenceBasePath,
  getDataDir,
  ensureDataDir,
  getPatternsPath,
  getStatsPath,
} from './intelligence/paths.js';
export { setIntelligenceBasePath };

// ============================================================================
// Type definitions + DEFAULT_SONA_CONFIG moved to ./intelligence/types.ts
// (W104, P3.11 cut #1). Imported for internal use + re-exported so
// external `import { Pattern, … } from './intelligence.js'` callers keep
// working byte-identically.
// ============================================================================
import type {
  SonaConfig,
  TrajectoryStep,
  Pattern,
  IntelligenceStats,
} from './intelligence/types.js';
import { DEFAULT_SONA_CONFIG } from './intelligence/types.js';
export type {
  SonaConfig,
  TrajectoryStep,
  Pattern,
  IntelligenceStats,
} from './intelligence/types.js';

// LocalReasoningBank class moved to ./intelligence/reasoning-bank.ts
// (W106, P3.11 cut #3). Imported for `new LocalReasoningBank()` + the
// SonaCoordinator's type params; re-exported for any external consumer.
import { LocalReasoningBank } from './intelligence/reasoning-bank.js';
export { LocalReasoningBank };

// LocalSonaCoordinator class moved to ./intelligence/sona-coordinator.ts
// (W107, P3.11 cut #4). Imported for `new LocalSonaCoordinator()` + the
// module-state type; re-exported for any external consumer.
import { LocalSonaCoordinator } from './intelligence/sona-coordinator.js';
export { LocalSonaCoordinator };

// ============================================================================
// @ruvector/ruvllm SonaCoordinator Integration
// ============================================================================

let ruvllmCoordinator: any = null;
let ruvllmLoaded = false;

/**
 * Synchronously load the @ruvector/ruvllm SonaCoordinator. Used both by the
 * async init path (initializeIntelligence) and by sync stat readers like
 * getIntelligenceStats — the dashboard would otherwise report "unavailable"
 * when stats are queried before any async init has fired (#1770).
 */
function loadRuvllmCoordinatorSync(): any {
  if (ruvllmLoaded) return ruvllmCoordinator;
  ruvllmLoaded = true;
  try {
    const requireCjs = createRequire(import.meta.url);
    const ruvllm = requireCjs('@ruvector/ruvllm');
    ruvllmCoordinator = new ruvllm.SonaCoordinator(ruvllm.DEFAULT_SONA_CONFIG);
    return ruvllmCoordinator;
  } catch (err) {
    // Surface the reason on debug builds so future regressions of #1770 don't
    // disappear silently. Stays quiet by default to avoid noise on the cli's
    // hot path (e.g., npx invocations).
    if (process.env.CLAUDE_FLOW_DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[ruvllm] SonaCoordinator load failed, falling back to JS:', (err as Error).message);
    }
    ruvllmCoordinator = null;
    return null;
  }
}

async function loadRuvllmCoordinator(): Promise<any> {
  return loadRuvllmCoordinatorSync();
}

// ============================================================================
// Module State
// ============================================================================

let sonaCoordinator: LocalSonaCoordinator | null = null;
let reasoningBank: LocalReasoningBank | null = null;
let intelligenceInitialized = false;
let globalStats = {
  trajectoriesRecorded: 0,
  patternsLearned: 0,
  signalsProcessed: 0,
  lastAdaptation: null as number | null
};

// ============================================================================
// Stats Persistence
// ============================================================================

/**
 * Load persisted stats from disk
 */
function loadPersistedStats(): void {
  try {
    const path = getStatsPath();
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      if (data && typeof data === 'object') {
        // #2245: previously only restored trajectoriesRecorded — patternsLearned
        // and signalsProcessed reset to zero on every restart, masking real
        // learning progress in the dashboards.
        globalStats.trajectoriesRecorded = data.trajectoriesRecorded ?? 0;
        globalStats.patternsLearned = data.patternsLearned ?? 0;
        globalStats.signalsProcessed = data.signalsProcessed ?? 0;
        globalStats.lastAdaptation = data.lastAdaptation ?? null;
      }
    }
  } catch {
    // Ignore load errors, start fresh
  }
}

/**
 * Save stats to disk
 */
function savePersistedStats(): void {
  try {
    ensureDataDir();
    const path = getStatsPath();
    writeFileSync(path, JSON.stringify(globalStats, null, 2), 'utf-8');
  } catch {
    // Ignore save errors
  }
}

/**
 * Record a memory-bridge / hook write so `signalsProcessed` reflects real
 * activity instead of being a permanently-zero dead metric (#2245). Throttled
 * persistence: increments are batched (every Nth save) to avoid hitting disk
 * on every single bridge call.
 *
 * Returns the new count.
 */
let signalsSinceLastSave = 0;
const SIGNAL_PERSIST_EVERY = 16;
export function recordSignalProcessed(): number {
  globalStats.signalsProcessed = (globalStats.signalsProcessed ?? 0) + 1;
  signalsSinceLastSave++;
  if (signalsSinceLastSave >= SIGNAL_PERSIST_EVERY) {
    savePersistedStats();
    signalsSinceLastSave = 0;
  }
  return globalStats.signalsProcessed;
}

/** Force-persist current stats (e.g. before shutdown / for tests). */
export function flushIntelligenceStats(): void {
  savePersistedStats();
  signalsSinceLastSave = 0;
}

// ============================================================================
// Unified learning-stats aggregator (#2245 follow-up to ADR-074)
// ============================================================================

/**
 * The four historical stat sources (globalStats / memory_bridge_status /
 * hooks metrics / neural_patterns count) genuinely measure different things,
 * so we don't merge them — we expose ONE call that returns all four sub-views
 * with the *source path* of each, plus a `consistency` block that spot-checks
 * the relationships the system maintains.
 *
 * No new store; no migration; just one honest view across the four.
 */
export interface UnifiedLearningStats {
  global: {
    patternsLearned: number;
    trajectoriesRecorded: number;
    signalsProcessed: number;
    lastAdaptation: number | null;
    source: string;
  };
  sona: {
    trajectoriesTotal: number;
    patternsLearned: number;
    reasoningBankSize: number;
    avgAdaptationTimeMs: number;
    source: string;
    available: boolean;
  };
  memoryBridge: {
    totalEntries: number;
    perNamespace: Record<string, number>;
    source: string;
    reachable: boolean;
  };
  neuralPatterns: {
    patternCount: number;
    byType: Record<string, number>;
    modelCount: number;
    source: string;
  };
  consistency: {
    sonaTracksGlobal: boolean;
    sonaTracksGlobalDelta: number;
    notes: string[];
  };
  generatedAt: string;
}

export async function getUnifiedLearningStats(): Promise<UnifiedLearningStats> {
  const intel = getIntelligenceStats();
  const sonaCoord = sonaCoordinator;
  const bank = reasoningBank;

  // SONA in-memory view
  const sonaAvailable = !!sonaCoord;
  let sonaStats = { trajectoriesTotal: 0, patternsLearned: 0, reasoningBankSize: 0, avgAdaptationTimeMs: 0 };
  if (sonaCoord) {
    try {
      const s = (sonaCoord as unknown as { stats?: () => Record<string, number> }).stats?.() ?? {};
      sonaStats = {
        trajectoriesTotal: Number(s.trajectoriesTotal ?? s.trajectoriesProcessed ?? 0),
        patternsLearned: Number(s.totalPatterns ?? s.patternsLearned ?? 0),
        reasoningBankSize: (bank as unknown as { stats?: () => { patternCount?: number } })?.stats?.()?.patternCount ?? 0,
        avgAdaptationTimeMs: (sonaCoord as unknown as { getAvgAdaptationTime?: () => number }).getAvgAdaptationTime?.() ?? 0,
      };
    } catch { /* SONA not yet initialised */ }
  }

  // memory-bridge
  let bridgeStats: UnifiedLearningStats['memoryBridge'] = {
    totalEntries: 0, perNamespace: {}, source: 'memory-bridge (skipped)', reachable: false,
  };
  try {
    const mb = await import('./memory-bridge.js');
    bridgeStats = await mb.getMemoryBridgeStats();
  } catch { /* bridge module not loadable */ }

  // neural store
  let neuralStats: UnifiedLearningStats['neuralPatterns'] = {
    patternCount: 0, byType: {}, modelCount: 0, source: 'neural store (skipped)',
  };
  try {
    const nt = await import('../mcp-tools/neural-tools.js');
    neuralStats = nt.getNeuralStoreStats();
  } catch { /* neural module not loadable */ }

  // Consistency notes — describe (don't enforce) the cross-store relationships
  const sonaTracksGlobalDelta = sonaStats.trajectoriesTotal - intel.trajectoriesRecorded;
  const notes: string[] = [];
  if (sonaAvailable && Math.abs(sonaTracksGlobalDelta) > 2) {
    notes.push(`sona.trajectoriesTotal (${sonaStats.trajectoriesTotal}) drifts from globalStats.trajectoriesRecorded (${intel.trajectoriesRecorded}) by ${sonaTracksGlobalDelta} — expected to track within ±1`);
  }
  if (intel.patternsLearned > 0 && neuralStats.patternCount === 0) {
    notes.push(`globalStats reports ${intel.patternsLearned} patterns learned but neural_patterns store is empty — pretrain has not written here, or trajectory-end isn't promoting patterns to the neural store yet`);
  }
  if (!bridgeStats.reachable) {
    notes.push('memory-bridge unreachable — bridge-dependent counters (post-edit/-command persistence, pretrain bundle) will show 0');
  }

  return {
    global: {
      patternsLearned: intel.patternsLearned,
      trajectoriesRecorded: intel.trajectoriesRecorded,
      signalsProcessed: intel.signalsProcessed,
      lastAdaptation: intel.lastAdaptation,
      source: '.claude-flow/neural/stats.json (globalStats)',
    },
    sona: {
      ...sonaStats,
      source: 'sonaCoordinator (in-memory, resets per process)',
      available: sonaAvailable,
    },
    memoryBridge: bridgeStats,
    neuralPatterns: neuralStats,
    consistency: {
      sonaTracksGlobal: sonaAvailable ? Math.abs(sonaTracksGlobalDelta) <= 1 : true,
      sonaTracksGlobalDelta,
      notes,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the intelligence system (SONA + ReasoningBank)
 * Uses optimized local implementations
 */
export async function initializeIntelligence(config?: Partial<SonaConfig>): Promise<{
  success: boolean;
  sonaEnabled: boolean;
  reasoningBankEnabled: boolean;
  error?: string;
}> {
  if (intelligenceInitialized) {
    return {
      success: true,
      sonaEnabled: !!sonaCoordinator,
      reasoningBankEnabled: !!reasoningBank
    };
  }

  try {
    // Merge config with defaults
    const finalConfig: SonaConfig = {
      ...DEFAULT_SONA_CONFIG,
      ...config
    };

    // Initialize local SONA (optimized for <0.05ms)
    sonaCoordinator = new LocalSonaCoordinator(finalConfig);

    // Initialize local ReasoningBank with persistence enabled
    reasoningBank = new LocalReasoningBank({
      maxSize: finalConfig.maxPatterns,
      persistence: true
    });

    // Load persisted stats if available
    loadPersistedStats();

    // Eagerly load ruvllm coordinator so stats reflect backend status
    await loadRuvllmCoordinator();

    intelligenceInitialized = true;

    return {
      success: true,
      sonaEnabled: true,
      reasoningBankEnabled: true
    };
  } catch (error) {
    return {
      success: false,
      sonaEnabled: false,
      reasoningBankEnabled: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Record a trajectory step for learning
 * Performance: <0.05ms without embedding generation
 */
export async function recordStep(step: TrajectoryStep): Promise<boolean> {
  if (!sonaCoordinator) {
    const init = await initializeIntelligence();
    if (!init.success) return false;
  }

  try {
    // Generate embedding if not provided
    // ADR-053: Try AgentDB v3 bridge embedder first
    let embedding = step.embedding;
    if (!embedding) {
      try {
        const bridge = await import('./memory-bridge.js');
        const bridgeResult = await bridge.bridgeGenerateEmbedding(step.content);
        if (bridgeResult) {
          embedding = bridgeResult.embedding;
        }
      } catch {
        // Bridge not available
      }
      if (!embedding) {
        const { generateEmbedding } = await import('./memory-initializer.js');
        const result = await generateEmbedding(step.content);
        embedding = result.embedding;
      }
    }

    // Record in SONA - <0.05ms
    sonaCoordinator!.recordSignal({
      type: step.type,
      content: step.content,
      embedding,
      metadata: step.metadata,
      timestamp: step.timestamp || Date.now()
    });

    // Add to current trajectory for RL tracking
    const stepWithEmbedding = { ...step, embedding };
    sonaCoordinator!.addTrajectoryStep(stepWithEmbedding);

    // Store in ReasoningBank for retrieval
    if (reasoningBank) {
      reasoningBank.store({
        id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: step.type,
        embedding,
        content: step.content,
        confidence: 1.0,
        metadata: step.metadata
      });
    }

    // When a 'result' step arrives, end the trajectory and run RL loop
    if (step.type === 'result' && reasoningBank) {
      // Determine verdict from metadata or default to 'partial'
      const verdict = (step.metadata?.verdict as 'success' | 'failure' | 'partial') || 'partial';
      await sonaCoordinator!.endTrajectory(verdict, reasoningBank);

      // Distill learning from recent successful trajectories
      await sonaCoordinator!.distillLearning(reasoningBank);

      globalStats.lastAdaptation = Date.now();
    }

    globalStats.trajectoriesRecorded++;
    savePersistedStats();
    return true;
  } catch {
    return false;
  }
}

/**
 * Record a complete trajectory with verdict
 */
export async function recordTrajectory(
  steps: TrajectoryStep[],
  verdict: 'success' | 'failure' | 'partial'
): Promise<boolean> {
  if (!sonaCoordinator) {
    const init = await initializeIntelligence();
    if (!init.success) return false;
  }

  try {
    // Generate embeddings for steps that don't have them (required for distillation)
    const enrichedSteps = await Promise.all(steps.map(async (step) => {
      if (step.embedding && step.embedding.length > 0) return step;
      try {
        const { generateEmbedding } = await import('./memory-initializer.js');
        const result = await generateEmbedding(step.content);
        return { ...step, embedding: result.embedding };
      } catch {
        return step; // Skip embedding if not available
      }
    }));

    sonaCoordinator!.recordTrajectory({
      steps: enrichedSteps,
      verdict,
      timestamp: Date.now()
    });

    // Apply RL: update pattern confidences based on verdict
    if (reasoningBank) {
      for (const step of enrichedSteps) {
        sonaCoordinator!.addTrajectoryStep(step);
      }
      await sonaCoordinator!.endTrajectory(verdict, reasoningBank);
      await sonaCoordinator!.distillLearning(reasoningBank);

      // Also store successful trajectories as patterns directly
      if (verdict === 'success') {
        for (const step of enrichedSteps) {
          if (step.embedding && step.embedding.length > 0) {
            reasoningBank.store({
              id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: step.type,
              content: step.content,
              embedding: step.embedding,
              confidence: verdict === 'success' ? 0.8 : 0.4,
              metadata: step.metadata || {},
              createdAt: Date.now(),
            });
            globalStats.patternsLearned++;
          }
        }
      }
    }

    // Forward trajectory to @ruvector/ruvllm SonaCoordinator if available
    const ruvllmCoord = await loadRuvllmCoordinator();
    if (ruvllmCoord) {
      try {
        const avgQuality = verdict === 'success' ? 1.0 : verdict === 'partial' ? 0.5 : 0.0;
        ruvllmCoord.recordTrajectory({
          steps: enrichedSteps.map(s => ({
            state: s.content,
            action: s.type,
            reward: avgQuality,
            embedding: s.embedding || []
          })),
          totalReward: avgQuality,
          success: verdict === 'success'
        });
      } catch {
        // ruvllm recording failed silently
      }
    }

    globalStats.trajectoriesRecorded++;
    globalStats.lastAdaptation = Date.now();
    savePersistedStats();

    return true;
  } catch {
    return false;
  }
}

/**
 * Find similar patterns from ReasoningBank
 */
export interface PatternMatch extends Pattern {
  similarity: number;
}

export async function findSimilarPatterns(
  query: string,
  options?: { k?: number; threshold?: number; type?: string }
): Promise<PatternMatch[]> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return [];
  }

  try {
    // ADR-053: Try AgentDB v3 bridge embedder first
    let queryEmbedding: number[] | null = null;
    try {
      const bridge = await import('./memory-bridge.js');
      const bridgeResult = await bridge.bridgeGenerateEmbedding(query);
      if (bridgeResult) {
        queryEmbedding = bridgeResult.embedding;
      }
    } catch {
      // Bridge not available
    }
    if (!queryEmbedding) {
      const { generateEmbedding } = await import('./memory-initializer.js');
      const queryResult = await generateEmbedding(query);
      queryEmbedding = queryResult.embedding;
    }

    // Hash-fallback embeddings (128-dim) produce lower cosine similarities
    // than ONNX/transformer embeddings, so use a lower default threshold
    const isHashFallback = queryEmbedding.length === 128;
    const defaultThreshold = isHashFallback ? 0.1 : 0.5;

    const results = reasoningBank!.findSimilar(queryEmbedding, {
      k: options?.k ?? 5,
      threshold: options?.threshold ?? defaultThreshold,
      type: options?.type
    });

    return results.map((r) => ({
      id: r.id,
      type: r.type,
      embedding: r.embedding,
      content: r.content,
      confidence: r.confidence,
      usageCount: r.usageCount,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
      similarity: (r as unknown as { similarity?: number }).similarity ?? r.confidence ?? 0.5
    }));
  } catch {
    return [];
  }
}

/**
 * Get intelligence system statistics
 */
export function getIntelligenceStats(): IntelligenceStats & {
  _ruvllmBackend: string;
  _ruvllmTrajectories: number;
  _contrastiveTrainer?: { triplets: number; agents: number } | string;
  _trainingBackend?: string;
} {
  const sonaStats = sonaCoordinator?.stats();
  const bankStats = reasoningBank?.stats();

  // Lazy-init the ruvllm coordinator if it hasn't been loaded yet. The MCP
  // dashboard (`hooks_intelligence_stats`) hits this path before any
  // initializeIntelligence() call has fired, so the coordinator field would
  // otherwise stay null and the dashboard would report "unavailable" even
  // when @ruvector/ruvllm is fully resolvable. Sync require — cheap, idempotent.
  if (!ruvllmLoaded) {
    loadRuvllmCoordinatorSync();
  }
  const ruvllmStats = ruvllmCoordinator?.stats?.() || null;

  // Fetch cross-module stats for unified reporting
  let contrastiveTrainer: { triplets: number; agents: number } | string = 'unavailable';
  let trainingBackend = 'unavailable';
  try {
    // Synchronous check — contrastiveTrainer is module-level in sona-optimizer
    // We read it via the SONAOptimizer singleton if available
    const sonaModule = (globalThis as any).__claudeFlowSonaStats;
    if (sonaModule) {
      contrastiveTrainer = sonaModule._contrastiveTrainer || 'unavailable';
    }
  } catch { /* not available */ }

  return {
    sonaEnabled: !!sonaCoordinator,
    reasoningBankSize: bankStats?.size ?? 0,
    patternsLearned: Math.max(bankStats?.patternCount ?? 0, globalStats.patternsLearned),
    signalsProcessed: globalStats.signalsProcessed,
    trajectoriesRecorded: globalStats.trajectoriesRecorded,
    lastAdaptation: globalStats.lastAdaptation,
    avgAdaptationTime: sonaStats?.avgAdaptationMs ?? 0,
    _ruvllmBackend: ruvllmStats ? 'active' : 'unavailable',
    _ruvllmTrajectories: ruvllmStats?.trajectoriesBuffered || 0,
    _contrastiveTrainer: contrastiveTrainer,
    _trainingBackend: trainingBackend,
  };
}

/**
 * Get SONA coordinator for advanced operations
 */
export function getSonaCoordinator(): LocalSonaCoordinator | null {
  return sonaCoordinator;
}

/**
 * Get ReasoningBank for advanced operations
 */
export function getReasoningBank(): LocalReasoningBank | null {
  return reasoningBank;
}

/**
 * End the current trajectory with a verdict and apply RL updates.
 * This is the public API for the SONA RL loop.
 *
 * @param verdict - 'success' (reward=1.0), 'partial' (0.5), or 'failure' (-0.5)
 * @returns Update statistics or null if not initialized
 */
export async function endTrajectoryWithVerdict(
  verdict: 'success' | 'failure' | 'partial'
): Promise<{ reward: number; patternsUpdated: number } | null> {
  if (!sonaCoordinator || !reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return null;
  }

  try {
    const result = await sonaCoordinator!.endTrajectory(verdict, reasoningBank!);
    globalStats.lastAdaptation = Date.now();
    savePersistedStats();
    return result;
  } catch {
    return null;
  }
}

/**
 * Distill learning from recent successful trajectories.
 * Applies LoRA-style confidence updates with EWC++ consolidation protection.
 *
 * @returns Distillation statistics or null if not initialized
 */
export async function distillLearning(): Promise<{
  patternsDistilled: number;
  ewcPenalty: number;
} | null> {
  if (!sonaCoordinator || !reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return null;
  }

  try {
    const result = await sonaCoordinator!.distillLearning(reasoningBank!);
    globalStats.lastAdaptation = Date.now();
    savePersistedStats();
    return result;
  } catch {
    return null;
  }
}

/**
 * Clear intelligence state
 */
export function clearIntelligence(): void {
  sonaCoordinator = null;
  reasoningBank = null;
  intelligenceInitialized = false;
  globalStats = {
    trajectoriesRecorded: 0,
    patternsLearned: 0,
    signalsProcessed: 0,
    lastAdaptation: null
  };
}

/**
 * Benchmark SONA adaptation time
 */
export function benchmarkAdaptation(iterations: number = 1000): {
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  targetMet: boolean;
} {
  if (!sonaCoordinator) {
    initializeIntelligence();
  }

  const times: number[] = [];
  const testEmbedding = Array.from({ length: 384 }, () => Math.random());

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    sonaCoordinator!.recordSignal({
      type: 'test',
      content: `benchmark_${i}`,
      embedding: testEmbedding,
      timestamp: Date.now()
    });
    times.push(performance.now() - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return {
    totalMs,
    avgMs,
    minMs,
    maxMs,
    targetMet: avgMs < 0.05
  };
}

// ============================================================================
// Pattern Persistence API
// ============================================================================

/**
 * Get all patterns from ReasoningBank
 * Returns persisted patterns even after process restart
 */
export async function getAllPatterns(): Promise<Pattern[]> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return [];
  }

  return reasoningBank!.getAll().map(p => ({
    id: p.id,
    type: p.type,
    embedding: p.embedding,
    content: p.content,
    confidence: p.confidence,
    usageCount: p.usageCount,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt
  }));
}

/**
 * Get patterns by type from ReasoningBank
 */
export async function getPatternsByType(type: string): Promise<Pattern[]> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return [];
  }

  return reasoningBank!.getByType(type).map(p => ({
    id: p.id,
    type: p.type,
    embedding: p.embedding,
    content: p.content,
    confidence: p.confidence,
    usageCount: p.usageCount,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt
  }));
}

/**
 * Flush patterns to disk immediately
 * Call this at the end of training to ensure all patterns are saved
 */
export function flushPatterns(): void {
  if (reasoningBank) {
    reasoningBank.flushToDisk();
  }
  savePersistedStats();
}

/**
 * Compact patterns by removing duplicates/similar patterns
 * @param threshold Similarity threshold (0-1), patterns above this are considered duplicates
 */
export async function compactPatterns(threshold: number = 0.95): Promise<{
  before: number;
  after: number;
  removed: number;
}> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) {
      return { before: 0, after: 0, removed: 0 };
    }
  }

  const patterns = reasoningBank!.getAll();
  const before = patterns.length;

  // Find duplicates using cosine similarity
  const toRemove: Set<string> = new Set();

  for (let i = 0; i < patterns.length; i++) {
    if (toRemove.has(patterns[i].id)) continue;

    const embA = patterns[i].embedding;
    if (!embA || embA.length === 0) continue;

    for (let j = i + 1; j < patterns.length; j++) {
      if (toRemove.has(patterns[j].id)) continue;

      const embB = patterns[j].embedding;
      if (!embB || embB.length === 0 || embA.length !== embB.length) continue;

      // Compute cosine similarity
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let k = 0; k < embA.length; k++) {
        dotProduct += embA[k] * embB[k];
        normA += embA[k] * embA[k];
        normB += embB[k] * embB[k];
      }

      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

      if (similarity >= threshold) {
        // Remove the one with lower usage count
        const useA = patterns[i].usageCount || 0;
        const useB = patterns[j].usageCount || 0;
        toRemove.add(useA >= useB ? patterns[j].id : patterns[i].id);
      }
    }
  }

  // Remove duplicates
  for (const id of toRemove) {
    reasoningBank!.delete(id);
  }

  // Flush to disk
  flushPatterns();

  return {
    before,
    after: before - toRemove.size,
    removed: toRemove.size,
  };
}

/**
 * Delete a pattern by ID
 */
export async function deletePattern(id: string): Promise<boolean> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return false;
  }

  return reasoningBank!.delete(id);
}

/**
 * Clear all patterns (both in memory and on disk)
 */
export async function clearAllPatterns(): Promise<void> {
  if (!reasoningBank) {
    const init = await initializeIntelligence();
    if (!init.success) return;
  }

  reasoningBank!.clear();
}

/**
 * Get the neural data directory path
 */
export function getNeuralDataDir(): string {
  return getDataDir();
}

/**
 * Trigger background learning on the @ruvector/ruvllm SonaCoordinator.
 * No-op if ruvllm is not installed.
 */
export async function runBackgroundLearning(): Promise<void> {
  const coord = await loadRuvllmCoordinator();
  if (coord) coord.runBackgroundLoop();
}

/**
 * Get persistence status
 */
export function getPersistenceStatus(): {
  enabled: boolean;
  dataDir: string;
  patternsFile: string;
  statsFile: string;
  patternsExist: boolean;
  statsExist: boolean;
} {
  const dataDir = getDataDir();
  const patternsFile = getPatternsPath();
  const statsFile = getStatsPath();

  return {
    enabled: true,
    dataDir,
    patternsFile,
    statsFile,
    patternsExist: existsSync(patternsFile),
    statsExist: existsSync(statsFile)
  };
}

/**
 * Lazy singleton loaders for neural backends.
 *
 * Extracted from hooks-tools.ts as the third cluster (W33 P3.2 cut #3).
 * Each loader follows the same pattern: a module-level cached handle +
 * a `get*()` accessor that tries to import the actual implementation
 * on first call and falls back to `null` if the optional dep is
 * missing. None of these depend on each other, but grouping them in
 * one file keeps the symmetric init pattern together.
 *
 * Why they're optional: SONA / EWC++ / MoE / FlashAttention / LoRA are
 * heavy native/WASM modules that aren't always installable (Windows
 * binaries, ESM/CJS quirks). Hooks-tools degrades gracefully when any
 * loader returns null.
 */

// ── SONA Optimizer ──────────────────────────────────────────────────

let sonaOptimizer: Awaited<ReturnType<typeof import('../../memory/sona-optimizer.js').getSONAOptimizer>> | null = null;
export async function getSONAOptimizer() {
  if (!sonaOptimizer) {
    try {
      const { getSONAOptimizer: getSona } = await import('../../memory/sona-optimizer.js');
      sonaOptimizer = await getSona();
    } catch {
      sonaOptimizer = null;
    }
  }
  return sonaOptimizer;
}

// ── EWC++ Consolidator ──────────────────────────────────────────────

let ewcConsolidator: Awaited<ReturnType<typeof import('../../memory/ewc-consolidation.js').getEWCConsolidator>> | null = null;
export async function getEWCConsolidator() {
  if (!ewcConsolidator) {
    try {
      const { getEWCConsolidator: getEWC } = await import('../../memory/ewc-consolidation.js');
      ewcConsolidator = await getEWC();
    } catch {
      ewcConsolidator = null;
    }
  }
  return ewcConsolidator;
}

// ── MoE Router (migrated to @claude-flow/neural in #1773) ───────────

let moeRouter: Awaited<ReturnType<typeof import('@claude-flow/neural').getMoERouter>> | null = null;
export async function getMoERouter() {
  if (!moeRouter) {
    try {
      const { getMoERouter: getMoE } = await import('@claude-flow/neural');
      moeRouter = await getMoE();
    } catch {
      moeRouter = null;
    }
  }
  return moeRouter;
}

// ── Flash Attention (migrated to @claude-flow/neural in #1773) ──────

let flashAttention: Awaited<ReturnType<typeof import('@claude-flow/neural').getFlashAttention>> | null = null;
export async function getFlashAttention() {
  if (!flashAttention) {
    try {
      const { getFlashAttention: getFlash } = await import('@claude-flow/neural');
      flashAttention = await getFlash();
    } catch {
      flashAttention = null;
    }
  }
  return flashAttention;
}

// ── LoRA Adapter ────────────────────────────────────────────────────

let loraAdapter: Awaited<ReturnType<typeof import('../../ruvector/lora-adapter.js').getLoRAAdapter>> | null = null;
export async function getLoRAAdapter() {
  if (!loraAdapter) {
    try {
      const { getLoRAAdapter: getLora } = await import('../../ruvector/lora-adapter.js');
      loraAdapter = await getLora();
    } catch {
      loraAdapter = null;
    }
  }
  return loraAdapter;
}

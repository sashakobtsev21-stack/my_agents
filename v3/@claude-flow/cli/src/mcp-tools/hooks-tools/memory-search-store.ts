/**
 * Lazy loaders for the memory-initializer search + store APIs, plus the
 * reasoning-scrubber that runs on text before it lands in a learning
 * trajectory.
 *
 * Extracted from hooks-tools.ts (W34, P3.2 cut #4). Two reasons these
 * sit together:
 *   - they share the same dynamic-import target (../memory/memory-
 *     initializer.js) so colocating keeps the bundle-init narrative in
 *     one file
 *   - scrubReasoningBlocks is the gate that runs before storeEntryFn
 *     persists a trajectory action/result, so the scrub helper belongs
 *     with the store loader
 */

// ── Memory search ───────────────────────────────────────────────────

let searchEntriesFn: ((options: {
  query: string;
  namespace?: string;
  limit?: number;
  threshold?: number;
}) => Promise<{
  success: boolean;
  results: { id: string; key: string; content: string; score: number; namespace: string }[];
  searchTime: number;
  error?: string;
}>) | null = null;

export async function getRealSearchFunction() {
  if (!searchEntriesFn) {
    try {
      const { searchEntries } = await import('../../memory/memory-initializer.js');
      searchEntriesFn = searchEntries;
    } catch {
      searchEntriesFn = null;
    }
  }
  return searchEntriesFn;
}

// ── Memory store ────────────────────────────────────────────────────

let storeEntryFn: ((options: {
  key: string;
  value: string;
  namespace?: string;
  generateEmbeddingFlag?: boolean;
  tags?: string[];
  ttl?: number;
}) => Promise<{
  success: boolean;
  id: string;
  embedding?: { dimensions: number; model: string };
  error?: string;
}>) | null = null;

export async function getRealStoreFunction() {
  if (!storeEntryFn) {
    try {
      const { storeEntry } = await import('../../memory/memory-initializer.js');
      storeEntryFn = storeEntry;
    } catch {
      storeEntryFn = null;
    }
  }
  return storeEntryFn;
}

// ── Reasoning scrubber ──────────────────────────────────────────────

/**
 * Strip extended-thinking blocks from text before it enters a learning
 * trajectory (hermes-agent think_scrubber pattern). Claude models with extended
 * thinking emit <thinking>/<think>/<reasoning> blocks; if those land in a
 * trajectory's action/result text, the DISTILL step embeds reasoning-token
 * content that does not generalize, contaminating pattern confidence. Boundary-
 * gated: only strips well-formed paired tags, leaving prose that merely mentions
 * the tag names untouched.
 */
export function scrubReasoningBlocks(text: string): string {
  if (typeof text !== 'string' || text.indexOf('<') === -1) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<REASONING_SCRATCHPAD>[\s\S]*?<\/REASONING_SCRATCHPAD>/gi, '')
    .trim();
}

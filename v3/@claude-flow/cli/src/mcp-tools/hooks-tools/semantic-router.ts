/**
 * Semantic router init for hooks-tools — tries native VectorDb (HNSW,
 * 16k+ routes/s) first and falls back to pure-JS cosine SemanticRouter
 * (47k routes/s) if the native binary is locked / not installed.
 *
 * Extracted from hooks-tools.ts (W35, P3.2 cut #5). The semantic router
 * is consumed by exactly one caller — the route MCP tool handler — so
 * pulling its 5 module-level state vars + the 2 helper functions out
 * of hooks-tools.ts is a clean cut. The only cross-file dep is
 * getMergedTaskPatterns() from ./routing-patterns.js, which is what
 * seeds the index on init.
 */
import { getMergedTaskPatterns } from './routing-patterns.js';

// ── Module state ────────────────────────────────────────────────────

let semanticRouter: import('../../ruvector/semantic-router.js').SemanticRouter | null = null;
let nativeVectorDb: unknown = null;
let semanticRouterInitialized = false;
let routerBackend: 'native' | 'pure-js' | 'none' = 'none';

// Pre-computed embeddings for common task patterns (cached)
const TASK_PATTERN_EMBEDDINGS: Map<string, Float32Array> = new Map();

// ── Simple deterministic embedding ──────────────────────────────────

export function generateSimpleEmbedding(text: string, dimension: number = 384): Float32Array {
  // Simple deterministic embedding based on character codes
  // This is for routing purposes where we need consistent, fast embeddings
  const embedding = new Float32Array(dimension);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  // Combine word-level and character-level features
  for (let i = 0; i < dimension; i++) {
    let value = 0;

    // Word-level features
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      for (let c = 0; c < word.length; c++) {
        const charCode = word.charCodeAt(c);
        value += Math.sin((charCode * (i + 1) + w * 17 + c * 23) * 0.0137);
      }
    }

    // Character-level features
    for (let c = 0; c < text.length; c++) {
      value += Math.cos((text.charCodeAt(c) * (i + 1) + c * 7) * 0.0073);
    }

    embedding[i] = value / Math.max(1, text.length);
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < dimension; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

// ── Lazy init with native → pure-JS fallback chain ──────────────────

/**
 * Get the semantic router with environment detection.
 * Tries native VectorDb first (HNSW, 16k routes/s), falls back to pure JS (47k routes/s cosine).
 */
export async function getSemanticRouter() {
  if (semanticRouterInitialized) {
    return { router: semanticRouter, backend: routerBackend, native: nativeVectorDb };
  }
  semanticRouterInitialized = true;

  // STEP 1: Try native VectorDb from @ruvector/router (HNSW-backed)
  // Note: Native VectorDb uses a persistent database file which can have lock issues
  // in concurrent environments. We try it first but fall back gracefully to pure JS.
  try {
    // Use createRequire for ESM compatibility with native modules
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const router = require('@ruvector/router');

    if (router.VectorDb && router.DistanceMetric) {
      // Try to create VectorDb - may fail with lock error in concurrent envs
      const db = new router.VectorDb({
        dimensions: 384,
        distanceMetric: router.DistanceMetric.Cosine,
        hnswM: 16,
        hnswEfConstruction: 200,
        hnswEfSearch: 100,
      });

      // Initialize with static + runtime-learned task patterns
      for (const [patternName, { keywords }] of Object.entries(getMergedTaskPatterns())) {
        for (const keyword of keywords) {
          const embedding = generateSimpleEmbedding(keyword);
          db.insert(`${patternName}:${keyword}`, embedding);
          TASK_PATTERN_EMBEDDINGS.set(`${patternName}:${keyword}`, embedding);
        }
      }

      nativeVectorDb = db;
      routerBackend = 'native';
      console.log('[hooks] Semantic router initialized: native VectorDb (HNSW, 16k+ routes/s)');
      return { router: null, backend: routerBackend, native: nativeVectorDb };
    }
  } catch {
    // Native not available or database locked - fall back to pure JS
    // Common errors: "Database already open. Cannot acquire lock." or "MODULE_NOT_FOUND"
    // This is expected in concurrent environments or when binary isn't installed
  }

  // STEP 2: Fall back to pure JS SemanticRouter
  try {
    const { SemanticRouter } = await import('../../ruvector/semantic-router.js');
    semanticRouter = new SemanticRouter({ dimension: 384 });

    for (const [patternName, { keywords, agents }] of Object.entries(getMergedTaskPatterns())) {
      const embeddings = keywords.map(kw => generateSimpleEmbedding(kw));
      semanticRouter.addIntentWithEmbeddings(patternName, embeddings, { agents, keywords });

      // Cache embeddings for keywords
      keywords.forEach((kw, i) => {
        TASK_PATTERN_EMBEDDINGS.set(kw, embeddings[i]);
      });
    }

    routerBackend = 'pure-js';
    console.log('[hooks] Semantic router initialized: pure JS (cosine, 47k routes/s)');
  } catch {
    semanticRouter = null;
    routerBackend = 'none';
    console.log('[hooks] Semantic router initialized: none (no backend available)');
  }

  return { router: semanticRouter, backend: routerBackend, native: nativeVectorDb };
}

/**
 * ONNX / bridge-backed embedding model manager extracted from
 * memory-initializer.ts.
 *
 * Owns:
 *   - EmbeddingModel type + embeddingModelState singleton (internal)
 *   - loadEmbeddingModel       (lazy-load the real backend; avoids
 *                              pulling a 100MB+ model unless an embedding
 *                              is actually requested — routes through the
 *                              AgentDB bridge when available)
 *   - generateEmbedding        (single text → vector)
 *   - generateBatchEmbeddings  (batch text[] → vector[])
 *   - generateHashEmbedding    (deterministic hash fallback, internal)
 *
 * Only external dependency is getBridge from paths.ts — no fs / path,
 * no SQLite. Extracted from memory-initializer.ts (W58, P3.3 cut #5).
 */
import { getBridge } from './paths.js';

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

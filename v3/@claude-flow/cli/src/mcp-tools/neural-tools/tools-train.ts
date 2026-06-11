/**
 * Neural MCP tools — neural_train / predict / patterns
 *
 * Extracted verbatim from tools.ts (lines 20-511) during campaign-2
 * wave 82 (W288). tools.ts stays the barrel.
 */
import { type MCPTool } from '../types.js';
import { validateIdentifier, validateText } from '../validate-input.js';
import {
  realEmbeddings,
  embeddingServiceName,
  generateEmbedding,
  cosineSimilarity,
  loadNeuralStore,
  saveNeuralStore,
} from './helpers.js';
import type { NeuralModel, Pattern } from './helpers.js';

export const neuralTrain: MCPTool =   {
    name: 'neural_train',
    description: 'Train a neural model Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string', description: 'Model ID to train' },
        modelType: { type: 'string', enum: ['moe', 'transformer', 'classifier', 'embedding'], description: 'Model type' },
        epochs: { type: 'number', description: 'Number of training epochs' },
        learningRate: { type: 'number', description: 'Learning rate' },
        data: { type: 'object', description: 'Training data' },
      },
      required: ['modelType'],
    },
    handler: async (input) => {
      if (input.modelId) { const v = validateIdentifier(input.modelId as string, 'modelId'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();
      const modelId = (input.modelId as string) || `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const modelType = input.modelType as NeuralModel['type'];
      const epochs = (input.epochs as number) || 10;

      const model: NeuralModel = {
        id: modelId,
        name: `${modelType}-model`,
        type: modelType,
        status: 'training',
        accuracy: 0,
        epochs,
        config: {
          learningRate: input.learningRate || 0.001,
          batchSize: 32,
        },
      };

      store.models[modelId] = model;
      saveNeuralStore(store);

      // Real training: embed training data and store as searchable patterns
      const trainingData = input.data as Record<string, unknown> | Array<unknown> | undefined;
      let patternsStored = 0;

      if (trainingData) {
        const entries = Array.isArray(trainingData) ? trainingData : [trainingData];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const text = typeof entry === 'string' ? entry
            : (entry as Record<string, unknown>)?.text as string
            || (entry as Record<string, unknown>)?.content as string
            || (entry as Record<string, unknown>)?.label as string
            || JSON.stringify(entry);
          if (!text) continue;

          const embedding = await generateEmbedding(text, 384);
          const patternId = `${modelId}-train-${i}`;
          // ADR-093 F11: extract a meaningful label instead of dumping raw
          // training JSON as the pattern name. Audit reported neural_predict
          // returned `label: <raw training data JSON>` because the previous
          // fallback was `text.slice(0, 100)` where text was `JSON.stringify(entry)`.
          let label: string;
          if (typeof entry === 'string') {
            label = entry.slice(0, 80);
          } else if (entry && typeof entry === 'object') {
            const e = entry as Record<string, unknown>;
            // Prefer common semantic fields over a JSON dump
            const labelField = e.label ?? e.category ?? e.class ?? e.tag ?? e.intent ?? e.name ?? e.title;
            if (typeof labelField === 'string' && labelField.length > 0) {
              label = labelField.slice(0, 80);
            } else {
              const summaryField = e.text ?? e.input ?? e.task ?? e.description ?? e.content;
              if (typeof summaryField === 'string' && summaryField.length > 0) {
                label = `${summaryField.slice(0, 60)}${summaryField.length > 60 ? '…' : ''}`;
              } else {
                // Last resort: reduce to a stable short hash-like id
                label = `${modelType}:entry-${i}`;
              }
            }
          } else {
            label = `${modelType}:entry-${i}`;
          }
          store.patterns[patternId] = {
            id: patternId,
            name: label,
            type: modelType,
            embedding,
            metadata: { modelId, epoch: epochs, index: i, raw: entry },
            createdAt: new Date().toISOString(),
            usageCount: 0,
          };
          patternsStored++;
        }
      }

      model.status = 'ready';
      model.accuracy = patternsStored > 0 ? 1.0 : 0; // accuracy = data stored, not simulated
      model.trainedAt = new Date().toISOString();
      saveNeuralStore(store);

      return {
        success: true,
        _realEmbedding: !!realEmbeddings,
        _embeddingSource: embeddingServiceName,
        embeddingProvider: embeddingServiceName,
        modelId,
        type: modelType,
        status: model.status,
        patternsStored,
        totalPatterns: Object.keys(store.patterns).length,
        epochs,
        trainedAt: model.trainedAt,
        ...(embeddingServiceName === 'hash-fallback' || embeddingServiceName === 'none' ? {
          platformNote: 'ONNX embeddings not available — using hash-based fallback. Install @claude-flow/embeddings and run "embeddings init --download" for semantic search.',
        } : {}),
      };
    },
  };

export const neuralPredict: MCPTool =   {
    name: 'neural_predict',
    description: 'Make predictions using a neural model Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string', description: 'Model ID to use' },
        input: { type: 'string', description: 'Input text or data' },
        topK: { type: 'number', description: 'Number of top predictions' },
      },
      required: ['input'],
    },
    handler: async (input) => {
      { const v = validateText(input.input as string, 'input'); if (!v.valid) return { success: false, error: v.error }; }
      if (input.modelId) { const v = validateIdentifier(input.modelId as string, 'modelId'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();
      const modelId = input.modelId as string;
      const inputText = input.input as string;
      const topK = (input.topK as number) || 3;

      // Find model or use default
      const model = modelId ? store.models[modelId] : Object.values(store.models).find(m => m.status === 'ready');

      if (model && model.status !== 'ready') {
        return { success: false, error: 'Model not ready' };
      }

      // Generate real embedding for the input
      const startTime = performance.now();
      const embedding = await generateEmbedding(inputText, 384);
      const latency = Math.round(performance.now() - startTime);

      // ADR-093 F11: real classifier head over stored patterns. Previously
      // confidence was the raw cosine similarity (often clamped to 0 when
      // stored embeddings were stale or zero-vectored). Now we run k-NN
      // with cosine distance and apply a temperature-controlled softmax
      // over the top-K so confidence is a proper distribution that sums
      // to 1, and we surface enough metadata to trust the result.
      const storedPatterns = Object.values(store.patterns);
      let predictions: Array<{ label: string; confidence: number; patternId: string; cosineSimilarity: number }>;

      if (storedPatterns.length > 0) {
        // Step 1: k-NN with cosine
        const scored = storedPatterns
          .map(p => {
            const sim = cosineSimilarity(embedding, p.embedding);
            return {
              patternId: p.id,
              label: p.name || p.type || p.id,
              cosineSimilarity: sim,
            };
          })
          .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
          .slice(0, topK);

        // Step 2: temperature-softmax over the top-K so confidence sums to 1.
        // Temperature 0.1 sharpens differences between similar candidates.
        const tau = 0.1;
        const exps = scored.map(s => Math.exp(s.cosineSimilarity / tau));
        const z = exps.reduce((a, b) => a + b, 0) || 1;
        predictions = scored.map((s, i) => ({
          label: s.label,
          patternId: s.patternId,
          cosineSimilarity: Number(s.cosineSimilarity.toFixed(4)),
          confidence: Number((exps[i] / z).toFixed(4)),
        }));
      } else {
        // No patterns stored — no predictions possible. Be honest about it
        // instead of returning empty silently.
        predictions = [];
      }

      const topConfidence = predictions[0]?.confidence ?? 0;
      const topSimilarity = predictions[0]?.cosineSimilarity ?? 0;

      return {
        success: true,
        _realEmbedding: !!realEmbeddings,
        _embeddingSource: embeddingServiceName,
        embeddingProvider: embeddingServiceName,
        _hasStoredPatterns: storedPatterns.length > 0,
        _classifierHead: storedPatterns.length > 0 ? 'knn-cosine+softmax(tau=0.1)' : 'none',
        modelId: model?.id || 'default',
        input: inputText,
        predictions,
        // Surface cosineSimilarity separately so callers know whether the
        // softmax confidence reflects true match strength.
        topPrediction: predictions[0]?.label ?? null,
        topConfidence,
        topSimilarity,
        embedding: embedding.slice(0, 8), // Preview of embedding
        embeddingDims: embedding.length,
        latency,
        ...(storedPatterns.length === 0 ? {
          _note: 'No patterns stored. Train with neural_train(modelType, trainingData) before predicting.',
        } : {}),
      };
    },
  };

export const neuralPatterns: MCPTool =   {
    name: 'neural_patterns',
    description: 'Get or manage neural patterns Use when nothing native trains on your workflow — Claude Code has no learning loop. Use to train SONA/MoE/EWC patterns from successful task outcomes; query via neural_predict before spawning agents. Off-path for one-shot work.',
    category: 'neural',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'store', 'search', 'delete'], description: 'Action to perform' },
        patternId: { type: 'string', description: 'Pattern ID' },
        name: { type: 'string', description: 'Pattern name' },
        type: { type: 'string', description: 'Pattern type' },
        content: { type: 'string', description: 'Pattern source text (used for BM25 in hybrid search; falls back to name)' },
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Top-K results to return (default 10, max 100)' },
        mode: { type: 'string', enum: ['hybrid', 'cosine'], description: 'Search mode — hybrid (cosine+BM25+MMR, default) or cosine (pre-3.10.18 behaviour, for A/B)' },
        alpha: { type: 'number', description: 'Hybrid: cosine weight in [0,1]; (1-α) is BM25 weight (default 0.5, tuned ADR-082)' },
        mmrLambda: { type: 'number', description: 'Hybrid: MMR balance — 1.0 = pure relevance, 0.0 = pure diversity (default 0.7, tuned ADR-082)' },
        subjectWeight: { type: 'number', description: 'Hybrid: multi-field BM25 weight for subject/name (default 2.0 non-rerank, 3.0 with rerank — tuned ADR-082/083)' },
        bodyWeight: { type: 'number', description: 'Hybrid: multi-field BM25 weight for body/content (default 1.0)' },
        typePenaltyFactor: { type: 'number', description: 'Hybrid: meta-commit score multiplier — release/merge/bump commits × this factor (default 1.0 = disabled; set 0.5 for aggressive suppression)' },
        rerank: { type: 'boolean', description: 'Hybrid: opt-in cross-encoder rerank pass over the top-K (ADR-080). Adds ~20-40 ms per (query, doc) pair; first call downloads ~30MB model. Gracefully degrades to hybrid+MMR order when unavailable.' },
        hybridWeight: { type: 'number', description: 'Rerank: hybrid score weight in final combination (default 0.7, tuned ADR-083)' },
        ceWeight: { type: 'number', description: 'Rerank: cross-encoder score weight in final combination (default 0.3, tuned ADR-083)' },
        data: { type: 'object', description: 'Pattern data' },
      },
    },
    handler: async (input) => {
      if (input.patternId) { const v = validateIdentifier(input.patternId as string, 'patternId'); if (!v.valid) return { success: false, error: v.error }; }
      if (input.name) { const v = validateText(input.name as string, 'name'); if (!v.valid) return { success: false, error: v.error }; }
      if (input.type) { const v = validateIdentifier(input.type as string, 'type'); if (!v.valid) return { success: false, error: v.error }; }
      if (input.query) { const v = validateText(input.query as string, 'query'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadNeuralStore();
      const action = (input.action as string) || 'list';

      if (action === 'list') {
        const patterns = Object.values(store.patterns);
        const typeFilter = input.type as string;
        const filtered = typeFilter ? patterns.filter(p => p.type === typeFilter) : patterns;

        return {
          patterns: filtered.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            usageCount: p.usageCount,
            createdAt: p.createdAt,
          })),
          total: filtered.length,
        };
      }

      if (action === 'get') {
        const pattern = store.patterns[input.patternId as string];
        if (!pattern) {
          return { success: false, error: 'Pattern not found' };
        }
        return { success: true, pattern };
      }

      if (action === 'store') {
        const patternId = `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const patternName = (input.name as string) || 'Unnamed pattern';
        const patternContent = (input.content as string) ?? patternName;

        // Generate embedding from pattern content (falls back to name).
        const embedding = await generateEmbedding(patternContent, 384);

        const pattern: Pattern = {
          id: patternId,
          name: patternName,
          type: (input.type as string) || 'general',
          embedding,
          content: typeof patternContent === 'string' ? patternContent.slice(0, 4096) : undefined,
          metadata: (input.data as Record<string, unknown>) || {},
          createdAt: new Date().toISOString(),
          usageCount: 0,
        };

        store.patterns[patternId] = pattern;
        saveNeuralStore(store);

        return {
          success: true,
          _realEmbedding: !!realEmbeddings,
          _embeddingSource: embeddingServiceName,
          embeddingProvider: embeddingServiceName,
          patternId,
          name: pattern.name,
          type: pattern.type,
          embeddingDims: embedding.length,
          createdAt: pattern.createdAt,
        };
      }

      if (action === 'search') {
        const query = input.query as string;
        const k = Math.min(Math.max(Number(input.limit ?? input.topK ?? 10), 1), 100);
        // ADR-078 hybrid retrieval controls. Cosine-only mode preserves the
        // pre-3.10.18 behaviour for A/B tests via {mode:'cosine'}; default is
        // hybrid (cosine + BM25 + MMR).
        const mode = String(input.mode ?? 'hybrid');
        const useRerank = input.rerank === true || String(input.rerank) === 'true';
        // ADR-083 joint grid: rerank path benefits from DIFFERENT hybrid
        // sub-params than non-rerank (the cross-encoder adds semantic depth,
        // so the hybrid stage can be more keyword-focused). nDCG@3 0.900 →
        // 0.963 on rerank just by switching sw 2.0 → 3.0 in the hybrid stage.
        const alpha = Number(input.alpha ?? 0.5);
        const mmrLambda = Number(input.mmrLambda ?? 0.7);

        const { tokenize, buildCorpusStats, hybridScores, mmrRerank, multiFieldBM25, typePenalty } =
          await import('../../memory/hybrid-retrieval.js');

        const queryEmbedding = await generateEmbedding(query, 384);
        const patterns = Object.values(store.patterns);

        // Compute cosine for every pattern (this is what the old path did).
        const cosineArr = patterns.map((p) => cosineSimilarity(queryEmbedding, p.embedding));

        if (mode === 'cosine') {
          const ranked = patterns
            .map((p, i) => ({ ...p, similarity: cosineArr[i] }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, k);
          return {
            _realSimilarity: true,
            _realEmbedding: !!realEmbeddings,
            _embeddingSource: embeddingServiceName,
            embeddingProvider: embeddingServiceName,
            mode: 'cosine',
            query,
            results: ranked.map((r) => ({ id: r.id, name: r.name, type: r.type, similarity: r.similarity })),
            total: ranked.length,
          };
        }

        // Hybrid path — multi-field BM25 (subject 3×, body 1×) + type penalty
        // for meta-commits (release bumps / merges) per ADR-079. Falls back
        // to single-field BM25 when no content is stored.
        const subjectDocs = patterns.map((p) => tokenize(p.name ?? ''));
        const bodyDocs = patterns.map((p) => {
          // Body is content minus the subject — if content starts with name,
          // strip it; otherwise use full content (with name removed if duplicated).
          const c = p.content ?? '';
          const n = p.name ?? '';
          return tokenize(c.startsWith(n) ? c.slice(n.length) : c);
        });
        const subjectStats = buildCorpusStats(subjectDocs);
        const bodyStats = buildCorpusStats(bodyDocs);
        const queryTokens = tokenize(query);
        // ADR-082: subjectWeight 3.0 → 2.0 from grid (sw=2 dominates at hybrid-only).
        // ADR-083 joint grid: when rerank is on, the cross-encoder handles
        // semantic understanding, so the hybrid stage can be MORE
        // subject-focused (sw=3) — recovers nDCG@3 0.963.
        const subjectWeight = Number(input.subjectWeight ?? (useRerank ? 3.0 : 2.0));
        const bodyWeight = Number(input.bodyWeight ?? 1.0);
        const bm25Arr = patterns.map((_, i) =>
          multiFieldBM25(queryTokens, subjectDocs[i], bodyDocs[i], subjectStats, bodyStats, subjectWeight, bodyWeight),
        );
        const baseHybrid = hybridScores(cosineArr, bm25Arr, alpha);
        // Type penalty — opt-in (default 1.0 = disabled). Ablation in ADR-079
        // showed multi-field BM25 alone gives best top-1 (8/10 vs 7/10 with
        // penalty enabled) because some relevant work commits also match the
        // Merge/release regex. Callers wanting aggressive meta-commit
        // suppression can set {typePenaltyFactor: 0.5}.
        const typeFactor = Number(input.typePenaltyFactor ?? 1.0);
        const hybridArr = typeFactor === 1.0
          ? baseHybrid
          : baseHybrid.map((s, i) => s * typePenalty(patterns[i].name, typeFactor));

        // Candidate pool sizing: k*3 for MMR, k*6 for cross-encoder (it needs
        // more options to find the truly-best). ADR-080 ablation: rerank over
        // a narrow post-MMR slice degrades top-1; reranking a wider hybrid
        // top-K*6 pool restores and exceeds the no-rerank baseline.
        // useRerank declared at top of search block for conditional defaults.
        const poolSize = useRerank ? k * 6 : k * 3;
        const prelim = patterns
          .map((p, i) => ({ p, hybrid: hybridArr[i], cosine: cosineArr[i], bm25: bm25Arr[i] }))
          .sort((a, b) => b.hybrid - a.hybrid)
          .slice(0, Math.min(poolSize, patterns.length));

        const candidates = prelim.map(({ p, hybrid, cosine, bm25 }) => ({
          id: p.id, name: p.name, type: p.type,
          embedding: p.embedding,
          content: p.content,
          relevance: hybrid,
          _cosine: cosine,
          _bm25: bm25,
        }));

        let picked: Array<typeof candidates[number] & { mmrScore?: number; _crossEncoderScore?: number }>;

        if (useRerank) {
          // ADR-080: cross-encoder reranks the wider candidate pool, then
          // final score = hybridWeight * hybrid + ceWeight * crossEncoder
          // on normalised scales. Ablation showed cross-encoder alone hits
          // 100% top-3 but loses top-1 (calibration on short commit subjects
          // is noisy); linear combination preserves hybrid's top-1 strength
          // while gaining the cross-encoder's recall.
          try {
            const { crossEncoderRerank } = await import('../../memory/cross-encoder-rerank.js');
            const { normalise } = await import('../../memory/hybrid-retrieval.js');
            const docs = candidates.map((c) => c.content || c.name);
            const reranked = await crossEncoderRerank(query, docs);
            const ceScores = new Array(candidates.length).fill(0);
            for (const { index, score } of reranked) ceScores[index] = score;

            const hybridNorm = normalise(candidates.map((c) => c.relevance));
            const ceNorm = normalise(ceScores);
            // ADR-083 joint grid: hw=0.7 cw=0.3 (with α=0.5 sw=3 from above) is
            // the joint optimum at nDCG@3=0.963 (vs 0.900 at 0.5/0.5). The
            // hybrid signal carries most of the relevance; the cross-encoder
            // contributes a 30% smoothing/disambiguation kick.
            const hybridWeight = Number(input.hybridWeight ?? 0.7);
            const ceWeight = Number(input.ceWeight ?? 0.3);
            const combined = candidates.map((c, i) => ({
              ...c,
              _crossEncoderScore: ceScores[i],
              _combinedScore: hybridWeight * hybridNorm[i] + ceWeight * ceNorm[i],
            }));
            picked = combined
              .sort((a, b) => b._combinedScore - a._combinedScore)
              .slice(0, k);
          } catch {
            picked = candidates.slice(0, k);
          }
        } else {
          // Default path: MMR diversity over top-K*3 hybrid candidates.
          picked = mmrRerank(candidates, k, mmrLambda);
        }

        return {
          _realSimilarity: true,
          _realEmbedding: !!realEmbeddings,
          _embeddingSource: embeddingServiceName,
          embeddingProvider: embeddingServiceName,
          mode: 'hybrid',
          alpha,
          mmrLambda,
          rerank: useRerank,
          query,
          results: picked.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            similarity: r.relevance,   // exposed as `similarity` for back-compat
            hybridScore: r.relevance,
            cosineScore: r._cosine,
            bm25Score: r._bm25,
            mmrScore: r.mmrScore,
            ...((r as { _crossEncoderScore?: number })._crossEncoderScore !== undefined
              ? { crossEncoderScore: (r as { _crossEncoderScore?: number })._crossEncoderScore }
              : {}),
          })),
          total: picked.length,
        };
      }

      if (action === 'delete') {
        const patternId = input.patternId as string;
        if (!store.patterns[patternId]) {
          return { success: false, error: 'Pattern not found' };
        }
        delete store.patterns[patternId];
        saveNeuralStore(store);
        return { success: true, deleted: patternId };
      }

      return { success: false, error: 'Unknown action' };
    },
  };


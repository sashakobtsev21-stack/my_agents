/**
 * Core embeddings subcommands — vector generation, semantic search, and
 * pairwise similarity comparison.
 *
 *   - generateCommand  (text → embedding via the memory-initializer
 *                      embedder)
 *   - searchCommand    (semantic search over a sql.js vector DB with
 *                      cosine re-rank)
 *   - compareCommand   (cosine similarity between two inputs)
 *
 * Extracted from embeddings.ts (W89, P3.8 cut #2).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { cosineSimilarity } from './helpers.js';


// Generate subcommand - REAL implementation
export const generateCommand: Command = {
  name: 'generate',
  description: 'Generate embeddings for text',
  options: [
    { name: 'text', short: 't', type: 'string', description: 'Text to embed', required: true },
    { name: 'provider', short: 'p', type: 'string', description: 'Provider: openai, transformers, agentic-flow, local', default: 'local' },
    { name: 'model', short: 'm', type: 'string', description: 'Model to use' },
    { name: 'output', short: 'o', type: 'string', description: 'Output format: json, array, preview', default: 'preview' },
  ],
  examples: [
    { command: 'claude-flow embeddings generate -t "Hello world"', description: 'Generate embedding' },
    { command: 'claude-flow embeddings generate -t "Test" -o json', description: 'Output as JSON' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const text = ctx.flags.text as string;
    const provider = ctx.flags.provider as string || 'local';
    const outputFormat = ctx.flags.output as string || 'preview';

    if (!text) {
      output.printError('Text is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Generate Embedding'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: `Generating with ${provider}...`, spinner: 'dots' });
    spinner.start();

    try {
      // Use real embedding generator
      const { generateEmbedding, loadEmbeddingModel } = await import('../../memory/memory-initializer.js');

      const startTime = Date.now();
      const modelInfo = await loadEmbeddingModel({ verbose: false });
      const result = await generateEmbedding(text);
      const duration = Date.now() - startTime;

      spinner.succeed(`Embedding generated in ${duration}ms`);

      if (outputFormat === 'json') {
        output.printJson({
          text: text.substring(0, 100),
          embedding: result.embedding,
          dimensions: result.dimensions,
          model: result.model,
          duration
        });
        return { success: true, data: result };
      }

      if (outputFormat === 'array') {
        output.writeln(JSON.stringify(result.embedding));
        return { success: true, data: result };
      }

      // Preview format (default)
      const preview = result.embedding.slice(0, 8).map(v => v.toFixed(6));

      output.writeln();
      output.printBox([
        `Provider: ${provider}`,
        `Model: ${result.model} (${modelInfo.modelName})`,
        `Dimensions: ${result.dimensions}`,
        `Text: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
        `Generation time: ${duration}ms`,
        ``,
        `Vector preview (first 8 of ${result.dimensions}):`,
        `[${preview.join(', ')}, ...]`,
      ].join('\n'), 'Result');

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Embedding generation failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

// Search subcommand - REAL implementation using sql.js
export const searchCommand: Command = {
  name: 'search',
  description: 'Semantic similarity search',
  options: [
    { name: 'query', short: 'q', type: 'string', description: 'Search query', required: true },
    { name: 'collection', short: 'c', type: 'string', description: 'Namespace to search', default: 'default' },
    { name: 'limit', short: 'l', type: 'number', description: 'Max results', default: '10' },
    { name: 'threshold', short: 't', type: 'number', description: 'Similarity threshold (0-1)', default: '0.5' },
    { name: 'db-path', type: 'string', description: 'Database path', default: '.swarm/memory.db' },
  ],
  examples: [
    { command: 'claude-flow embeddings search -q "error handling"', description: 'Search for similar' },
    { command: 'claude-flow embeddings search -q "test" -l 5', description: 'Limit results' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = ctx.flags.query as string;
    const namespace = ctx.flags.collection as string || 'default';
    const limit = parseInt(ctx.flags.limit as string || '10', 10);
    const threshold = parseFloat(ctx.flags.threshold as string || '0.5');
    const dbPath = ctx.flags['db-path'] as string || '.swarm/memory.db';

    if (!query) {
      output.printError('Query is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Semantic Search'));
    output.writeln(output.dim('─'.repeat(60)));

    const spinner = output.createSpinner({ text: 'Searching...', spinner: 'dots' });
    spinner.start();

    try {
      const fs = await import('fs');
      const path = await import('path');
      const fullDbPath = path.resolve(process.cwd(), dbPath);

      // Check if database exists
      if (!fs.existsSync(fullDbPath)) {
        spinner.fail('Database not found');
        output.printWarning(`No database at ${fullDbPath}`);
        output.printInfo('Run: claude-flow memory init');
        return { success: false, exitCode: 1 };
      }

      // Load sql.js
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs();

      const fileBuffer = fs.readFileSync(fullDbPath);
      const db = new SQL.Database(fileBuffer);

      const startTime = Date.now();

      // Generate embedding for query
      const { generateEmbedding } = await import('../../memory/memory-initializer.js');
      const queryResult = await generateEmbedding(query);
      const queryEmbedding = queryResult.embedding;

      // Get all entries with embeddings from database
      // Parameterized query to prevent SQL injection (CRIT-01)
      const embeddingSql = namespace !== 'all'
        ? `SELECT id, key, namespace, content, embedding, embedding_dimensions
           FROM memory_entries
           WHERE status = 'active' AND embedding IS NOT NULL AND namespace = ?
           LIMIT 1000`
        : `SELECT id, key, namespace, content, embedding, embedding_dimensions
           FROM memory_entries
           WHERE status = 'active' AND embedding IS NOT NULL
           LIMIT 1000`;

      const embeddingStmt = db.prepare(embeddingSql);
      if (namespace !== 'all') {
        embeddingStmt.bind([namespace]);
      }

      const entryRows: any[][] = [];
      while (embeddingStmt.step()) {
        entryRows.push(embeddingStmt.get());
      }
      embeddingStmt.free();

      const results: { score: number; id: string; key: string; content: string; namespace: string }[] = [];

      for (const row of entryRows) {
        const [id, key, ns, content, embeddingJson] = row as [string, string, string, string, string];

        if (!embeddingJson) continue;

        try {
          const embedding = JSON.parse(embeddingJson) as number[];

          // Calculate cosine similarity
          const similarity = cosineSimilarity(queryEmbedding, embedding);

          if (similarity >= threshold) {
            results.push({
              score: similarity,
              id: id.substring(0, 10),
              key: key || id.substring(0, 15),
              content: (content || '').substring(0, 45) + ((content || '').length > 45 ? '...' : ''),
              namespace: ns || 'default'
            });
          }
        } catch {
          // Skip entries with invalid embeddings
        }
      }

      // Keyword search fallback with parameterized query (CRIT-01)
      if (results.length < limit) {
        const likePattern = `%${query}%`;
        const remainingLimit = Math.max(0, limit - results.length);
        const keywordSql = namespace !== 'all'
          ? `SELECT id, key, namespace, content
             FROM memory_entries
             WHERE status = 'active'
               AND (content LIKE ? OR key LIKE ?)
               AND namespace = ?
             LIMIT ?`
          : `SELECT id, key, namespace, content
             FROM memory_entries
             WHERE status = 'active'
               AND (content LIKE ? OR key LIKE ?)
             LIMIT ?`;

        const keywordStmt = db.prepare(keywordSql);
        if (namespace !== 'all') {
          keywordStmt.bind([likePattern, likePattern, namespace, remainingLimit]);
        } else {
          keywordStmt.bind([likePattern, likePattern, remainingLimit]);
        }

        const keywordRows: any[][] = [];
        while (keywordStmt.step()) {
          keywordRows.push(keywordStmt.get());
        }
        keywordStmt.free();

        for (const row of keywordRows) {
          const [id, key, ns, content] = row as [string, string, string, string];

          // Avoid duplicates
          if (!results.some(r => r.id === id.substring(0, 10))) {
            results.push({
              score: 0.5, // Keyword match base score
              id: id.substring(0, 10),
              key: key || id.substring(0, 15),
              content: (content || '').substring(0, 45) + ((content || '').length > 45 ? '...' : ''),
              namespace: ns || 'default'
            });
          }
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, limit);

      const searchTime = Date.now() - startTime;
      db.close();

      spinner.succeed(`Found ${topResults.length} matches (${searchTime}ms)`);

      if (topResults.length === 0) {
        output.writeln();
        output.printWarning('No matches found');
        output.printInfo(`Try: claude-flow memory store -k "key" --value "your data"`);
        return { success: true, data: [] };
      }

      output.writeln();
      output.printTable({
        columns: [
          { key: 'score', header: 'Score', width: 10 },
          { key: 'key', header: 'Key', width: 18 },
          { key: 'content', header: 'Content', width: 42 },
        ],
        data: topResults.map(r => ({
          score: r.score >= 0.8 ? output.success(r.score.toFixed(2)) :
                 r.score >= 0.6 ? output.warning(r.score.toFixed(2)) :
                 output.dim(r.score.toFixed(2)),
          key: r.key,
          content: r.content
        })),
      });

      output.writeln();
      output.writeln(output.dim(`Searched ${namespace} namespace (${queryResult.model}, ${searchTime}ms)`));

      return { success: true, data: topResults };
    } catch (error) {
      spinner.fail('Search failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

export const compareCommand: Command = {
  name: 'compare',
  description: 'Compare similarity between texts',
  options: [
    { name: 'text1', type: 'string', description: 'First text', required: true },
    { name: 'text2', type: 'string', description: 'Second text', required: true },
    { name: 'metric', short: 'm', type: 'string', description: 'Metric: cosine, euclidean, dot', default: 'cosine' },
  ],
  examples: [
    { command: 'claude-flow embeddings compare --text1 "Hello" --text2 "Hi there"', description: 'Compare texts' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const text1 = ctx.flags.text1 as string;
    const text2 = ctx.flags.text2 as string;
    const metric = ctx.flags.metric as string || 'cosine';

    if (!text1 || !text2) {
      output.printError('Both text1 and text2 are required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Text Similarity (Real)'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Generating embeddings...', spinner: 'dots' });
    spinner.start();

    try {
      const { generateEmbedding } = await import('../../memory/memory-initializer.js');

      // Generate real embeddings for both texts
      const startTime = Date.now();
      const [emb1, emb2] = await Promise.all([
        generateEmbedding(text1),
        generateEmbedding(text2),
      ]);
      const embedTime = Date.now() - startTime;

      spinner.setText('Computing similarity...');

      // Compute real similarity based on metric
      let similarity: number;

      switch (metric) {
        case 'euclidean': {
          // Euclidean distance (converted to similarity: 1 / (1 + distance))
          let sumSq = 0;
          for (let i = 0; i < emb1.embedding.length; i++) {
            const diff = emb1.embedding[i] - emb2.embedding[i];
            sumSq += diff * diff;
          }
          const distance = Math.sqrt(sumSq);
          similarity = 1 / (1 + distance);
          break;
        }
        case 'dot': {
          // Dot product
          let dot = 0;
          for (let i = 0; i < emb1.embedding.length; i++) {
            dot += emb1.embedding[i] * emb2.embedding[i];
          }
          similarity = dot;
          break;
        }
        case 'cosine':
        default: {
          // Cosine similarity
          similarity = cosineSimilarity(emb1.embedding, emb2.embedding);
        }
      }

      spinner.succeed(`Comparison complete (${embedTime}ms)`);

      output.writeln();
      output.printBox([
        `Text 1: "${text1.substring(0, 30)}${text1.length > 30 ? '...' : ''}"`,
        `Text 2: "${text2.substring(0, 30)}${text2.length > 30 ? '...' : ''}"`,
        ``,
        `Model: ${emb1.model} (${emb1.dimensions}-dim)`,
        `Metric: ${metric}`,
        `Similarity: ${similarity > 0.8 ? output.success(similarity.toFixed(4)) : similarity > 0.5 ? output.warning(similarity.toFixed(4)) : output.dim(similarity.toFixed(4))}`,
        ``,
        `Interpretation: ${similarity > 0.8 ? 'Highly similar' : similarity > 0.5 ? 'Moderately similar' : 'Dissimilar'}`,
      ].join('\n'), 'Result');

      return { success: true, data: { similarity, metric, embedTime } };
    } catch (error) {
      spinner.fail('Comparison failed');
      output.printError(error instanceof Error ? error.message : String(error));
      return { success: false, exitCode: 1 };
    }
  },
};

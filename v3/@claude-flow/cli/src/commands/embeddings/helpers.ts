/**
 * Shared helpers for the embeddings subcommands — the lazy
 * @claude-flow/embeddings loader plus pure cosine-similarity and
 * byte-formatting utilities.
 *
 * Extracted from embeddings.ts (W88, P3.8 cut #1).
 */

// Dynamic import for the embeddings package
export async function getEmbeddings() {
  try {
    return await import('@claude-flow/embeddings');
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0, normA = 0, normB = 0;

  // Simple loop - V8 optimizes this well
  for (let i = 0; i < len; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const mag = Math.sqrt(normA * normB);
  return mag === 0 ? 0 : dot / mag;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

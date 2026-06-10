/**
 * LocalReasoningBank — the lightweight pattern store: a Map for O(1)
 * storage, array scan + cosine for similarity search, and JSON
 * persistence to disk (patterns.json).
 *
 * Extracted from intelligence.ts (W106, P3.11 cut #3). Independent of the
 * SonaCoordinator (which only references it as a type param).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { StoredPattern } from './types.js';
import { ensureDataDir, getPatternsPath } from './paths.js';

/**
 * Lightweight ReasoningBank
 * Uses Map for O(1) storage and array for similarity search
 * Supports persistence to disk
 */
export class LocalReasoningBank {
  private patterns: Map<string, StoredPattern> = new Map();
  private patternList: StoredPattern[] = [];
  private maxSize: number;
  private persistenceEnabled: boolean;
  private dirty: boolean = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: { maxSize: number; persistence?: boolean }) {
    this.maxSize = options.maxSize;
    this.persistenceEnabled = options.persistence !== false;

    // Load persisted patterns
    if (this.persistenceEnabled) {
      this.loadFromDisk();
    }
  }

  /**
   * Load patterns from disk, deduplicating by content.
   * When multiple patterns share identical content, keeps the one with
   * highest confidence (ties broken by most recent lastUsedAt).
   */
  private loadFromDisk(): void {
    try {
      const path = getPatternsPath();
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        if (Array.isArray(data)) {
          const totalLoaded = data.length;

          // Group by content to deduplicate
          const byContent = new Map<string, StoredPattern>();
          for (const pattern of data) {
            const key = pattern.content;
            const existing = byContent.get(key);
            if (!existing) {
              byContent.set(key, pattern);
            } else {
              // Keep the one with higher confidence; break ties by lastUsedAt
              if (
                pattern.confidence > existing.confidence ||
                (pattern.confidence === existing.confidence &&
                  (pattern.lastUsedAt ?? 0) > (existing.lastUsedAt ?? 0))
              ) {
                // Merge: adopt the higher usageCount sum
                pattern.usageCount = (pattern.usageCount ?? 0) + (existing.usageCount ?? 0);
                byContent.set(key, pattern);
              } else {
                existing.usageCount = (existing.usageCount ?? 0) + (pattern.usageCount ?? 0);
              }
            }
          }

          // Populate the bank from deduplicated entries
          for (const pattern of byContent.values()) {
            this.patterns.set(pattern.id, pattern);
            this.patternList.push(pattern);
          }

          const removed = totalLoaded - byContent.size;
          if (removed > 0) {
            console.log(`Deduplicated ${removed} patterns (${byContent.size} unique)`);
            // Persist the compacted set immediately so the file shrinks on disk
            this.dirty = true;
            this.flushToDisk();
          }
        }
      }
    } catch {
      // Ignore load errors, start fresh
    }
  }

  /**
   * Save patterns to disk (debounced)
   */
  private saveToDisk(): void {
    if (!this.persistenceEnabled) return;

    this.dirty = true;

    // Debounce saves to avoid excessive disk I/O
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.flushToDisk();
    }, 100);
  }

  /**
   * Immediately flush patterns to disk
   */
  flushToDisk(): void {
    if (!this.persistenceEnabled || !this.dirty) return;

    try {
      ensureDataDir();
      const path = getPatternsPath();
      writeFileSync(path, JSON.stringify(this.patternList, null, 2), 'utf-8');
      this.dirty = false;
    } catch (error) {
      // Log but don't throw - persistence failures shouldn't break training
      console.error('Failed to persist patterns:', error);
    }
  }

  /**
   * Store a pattern - O(1)
   * Deduplicates by content: if a pattern with the same content already
   * exists, the existing entry is updated (bumped usageCount, higher
   * confidence wins, refreshed lastUsedAt) instead of adding a duplicate.
   */
  store(pattern: Omit<StoredPattern, 'usageCount' | 'createdAt' | 'lastUsedAt'> & Partial<StoredPattern>): void {
    const now = Date.now();
    const stored: StoredPattern = {
      ...pattern,
      usageCount: pattern.usageCount ?? 0,
      createdAt: pattern.createdAt ?? now,
      lastUsedAt: pattern.lastUsedAt ?? now
    };

    // Update or insert
    if (this.patterns.has(pattern.id)) {
      const existing = this.patterns.get(pattern.id)!;
      stored.usageCount = existing.usageCount + 1;
      stored.createdAt = existing.createdAt;

      // Update in list
      const idx = this.patternList.findIndex(p => p.id === pattern.id);
      if (idx >= 0) {
        this.patternList[idx] = stored;
      }
    } else {
      // Check for content-duplicate before inserting a new entry
      const contentDupe = this.patternList.find(p => p.content === pattern.content);
      if (contentDupe) {
        // Merge into the existing pattern instead of adding a duplicate
        contentDupe.usageCount++;
        contentDupe.lastUsedAt = now;
        if (stored.confidence > contentDupe.confidence) {
          contentDupe.confidence = stored.confidence;
        }
        // Keep the Map in sync with the mutated object
        this.patterns.set(contentDupe.id, contentDupe);
        this.saveToDisk();
        return;
      }

      // Evict oldest if at capacity
      if (this.patterns.size >= this.maxSize) {
        const oldest = this.patternList.shift();
        if (oldest) {
          this.patterns.delete(oldest.id);
        }
      }
      this.patternList.push(stored);
    }

    this.patterns.set(pattern.id, stored);

    // Trigger persistence (debounced)
    this.saveToDisk();
  }

  /**
   * Find similar patterns by embedding
   */
  findSimilar(
    queryEmbedding: number[],
    options: { k?: number; threshold?: number; type?: string }
  ): StoredPattern[] {
    const { k = 5, threshold = 0.5, type } = options;

    // Filter by type if specified
    let candidates = type
      ? this.patternList.filter(p => p.type === type)
      : this.patternList;

    // Compute similarities
    const scored = candidates.map(pattern => ({
      pattern,
      score: this.cosineSim(queryEmbedding, pattern.embedding)
    }));

    // Filter by threshold and sort
    return scored
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => {
        // Update usage
        s.pattern.usageCount++;
        s.pattern.lastUsedAt = Date.now();
        return { ...s.pattern, confidence: s.score };
      });
  }

  /**
   * Optimized cosine similarity
   */
  private cosineSim(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;

    const len = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;

    for (let i = 0; i < len; i++) {
      const ai = a[i], bi = b[i];
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    const mag = Math.sqrt(normA * normB);
    return mag === 0 ? 0 : dot / mag;
  }

  /**
   * Get statistics
   */
  stats(): { size: number; patternCount: number } {
    return {
      size: this.patterns.size,
      patternCount: this.patternList.length
    };
  }

  /**
   * Get pattern by ID
   */
  get(id: string): StoredPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAll(): StoredPattern[] {
    return [...this.patternList];
  }

  /**
   * Get patterns by type
   */
  getByType(type: string): StoredPattern[] {
    return this.patternList.filter(p => p.type === type);
  }

  /**
   * Delete a pattern by ID
   */
  delete(id: string): boolean {
    const pattern = this.patterns.get(id);
    if (!pattern) return false;

    this.patterns.delete(id);
    const idx = this.patternList.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.patternList.splice(idx, 1);
    }

    this.saveToDisk();
    return true;
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
    this.patternList = [];
    this.saveToDisk();
  }
}

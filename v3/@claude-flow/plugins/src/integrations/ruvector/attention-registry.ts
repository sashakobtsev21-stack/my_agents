/**
 * RuVector Attention — registry
 *
 * AttentionRegistry: mechanism registration and lookup by category.
 * Extracted verbatim from attention.ts (lines 106-203) during the P3.53
 * god-file decomposition (W174). attention.ts stays the barrel.
 */

import type { AttentionMechanism } from './types.js';
import type {
  AttentionCategory,
  IAttentionMechanism,
} from './attention-base.js';

// ============================================================================
// Attention Registry
// ============================================================================

/**
 * Registry for managing attention mechanism implementations.
 */
export class AttentionRegistry {
  private mechanisms: Map<AttentionMechanism, IAttentionMechanism> = new Map();
  private categoryIndex: Map<AttentionCategory, Set<AttentionMechanism>> = new Map();

  constructor() {
    // Initialize category index
    const categories: AttentionCategory[] = [
      'core', 'efficient', 'positional', 'sparse',
      'linear', 'graph', 'temporal', 'multimodal', 'retrieval'
    ];
    categories.forEach(cat => this.categoryIndex.set(cat, new Set()));
  }

  /**
   * Register an attention mechanism implementation.
   */
  register(impl: IAttentionMechanism): void {
    this.mechanisms.set(impl.type, impl);
    this.categoryIndex.get(impl.category)?.add(impl.type);
  }

  /**
   * Get an attention mechanism by type.
   */
  get(type: AttentionMechanism): IAttentionMechanism {
    const mechanism = this.mechanisms.get(type);
    if (!mechanism) {
      throw new Error(`Attention mechanism '${type}' not registered`);
    }
    return mechanism;
  }

  /**
   * Check if a mechanism is registered.
   */
  has(type: AttentionMechanism): boolean {
    return this.mechanisms.has(type);
  }

  /**
   * List all registered attention mechanisms.
   */
  listAvailable(): AttentionMechanism[] {
    return Array.from(this.mechanisms.keys());
  }

  /**
   * List mechanisms by category.
   */
  listByCategory(category: AttentionCategory): AttentionMechanism[] {
    return Array.from(this.categoryIndex.get(category) || []);
  }

  /**
   * Get all mechanisms with metadata.
   */
  getAllWithMetadata(): Array<{
    type: AttentionMechanism;
    name: string;
    description: string;
    category: AttentionCategory;
  }> {
    return Array.from(this.mechanisms.values()).map(m => ({
      type: m.type,
      name: m.name,
      description: m.description,
      category: m.category,
    }));
  }

  /**
   * Unregister a mechanism.
   */
  unregister(type: AttentionMechanism): boolean {
    const mechanism = this.mechanisms.get(type);
    if (mechanism) {
      this.categoryIndex.get(mechanism.category)?.delete(type);
      return this.mechanisms.delete(type);
    }
    return false;
  }

  /**
   * Clear all registered mechanisms.
   */
  clear(): void {
    this.mechanisms.clear();
    this.categoryIndex.forEach(set => set.clear());
  }
}


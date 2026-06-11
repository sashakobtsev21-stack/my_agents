/**
 * Agentic-QE Plugin Interfaces — model routing adapter
 *
 * Extracted verbatim from interfaces.ts (lines 932-1024) during the P3.59
 * god-file decomposition (W180). interfaces.ts stays the barrel.
 */

// Model Routing Adapter Interfaces
// =============================================================================

/**
 * QE task for model routing
 */
export interface QETask {
  /** Task category */
  category: string;

  /** Task description */
  description: string;

  /** Target file path (optional) */
  targetPath?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Model tier
 */
export type ModelTier = 1 | 2 | 3;

/**
 * Model selection
 */
export type ModelSelection = 'haiku' | 'sonnet' | 'opus';

/**
 * Route result from model routing
 */
export interface QERouteResult {
  /** Selected model tier */
  tier: ModelTier;

  /** Selected model */
  model: ModelSelection;

  /** QE category */
  qeCategory: string;

  /** QE complexity score (0-1) */
  qeComplexity: number;

  /** Recommended agents for this task */
  recommendedAgents: string[];

  /** Estimated cost */
  costEstimate: number;

  /** Whether Agent Booster can handle this */
  agentBoosterAvailable: boolean;

  /** Agent Booster intent if available */
  agentBoosterIntent?: string;

  /** Explanation of routing decision */
  explanation: string;
}

/**
 * Model routing adapter interface for TinyDancer <-> ADR-026 alignment
 */
export interface IQEModelRoutingAdapter {
  /**
   * Route a QE task to the appropriate model tier
   */
  routeQETask(task: QETask): Promise<QERouteResult>;

  /**
   * Get complexity score for a category
   */
  getCategoryComplexity(category: string): number;

  /**
   * Get recommended agents for a tier and category
   */
  getRecommendedAgents(category: string, tier: ModelTier): string[];

  /**
   * Estimate cost for a task
   */
  estimateCost(task: QETask, tier: ModelTier): number;

  /**
   * Check if Agent Booster can handle the task
   */
  canUseAgentBooster(task: QETask): { available: boolean; intent?: string };
}

// =============================================================================

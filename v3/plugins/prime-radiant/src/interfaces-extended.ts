/**
 * Prime Radiant interfaces — extended
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import type {
  CoherenceCheckResult,
  SpectralAnalysisResult,
  SpectralAnalysisType,
  CausalInferenceResult,
  CausalGraph,
  TopologyResult,
  MorphismResult,
  HottProofResult,
  ConsensusResult,
  AgentState,
  MemoryEntry,
  MemoryCoherenceValidation,
  PrimeRadiantConfig,
  CoherenceThresholds,
} from './types.js';

export interface ICoherenceGate {
  /**
   * Validate a memory entry against existing context
   * @param entry Entry to validate
   * @param existingContext Existing entries to check against
   * @returns Validation result with action recommendation
   */
  validate(entry: MemoryEntry, existingContext?: MemoryEntry[]): Promise<MemoryCoherenceValidation>;

  /**
   * Batch validate multiple entries
   * @param entries Entries to validate
   * @returns Array of validation results
   */
  validateBatch(entries: MemoryEntry[]): Promise<MemoryCoherenceValidation[]>;

  /**
   * Configure coherence thresholds
   * @param thresholds New threshold values
   */
  setThresholds(thresholds: Partial<CoherenceThresholds>): void;

  /**
   * Get current thresholds
   * @returns Current threshold configuration
   */
  getThresholds(): CoherenceThresholds;
}

/**
 * Consensus Verifier Interface
 * Mathematically validates multi-agent consensus
 */
export interface IConsensusVerifier {
  /**
   * Verify consensus among agent states
   * @param agentStates Array of agent states
   * @param threshold Agreement threshold (default: 0.8)
   * @returns Consensus verification result
   */
  verifyConsensus(agentStates: AgentState[], threshold?: number): Promise<ConsensusResult>;

  /**
   * Analyze swarm health using spectral methods
   * @returns Health analysis with recommendations
   */
  analyzeSwarmHealth(): Promise<{
    healthy: boolean;
    spectralGap: number;
    stabilityIndex: number;
    recommendations: string[];
  }>;
}

/**
 * Stability Analyzer Interface
 * Analyzes swarm and system stability
 */
export interface IStabilityAnalyzer {
  /**
   * Analyze communication network stability
   * @param communicationMatrix Adjacency matrix of communications
   * @returns Stability analysis result
   */
  analyzeNetwork(communicationMatrix: Float32Array): Promise<SpectralAnalysisResult>;

  /**
   * Detect emerging instabilities
   * @param historicalMetrics Array of historical stability metrics
   * @returns Trend analysis and warnings
   */
  detectTrends?(
    historicalMetrics: SpectralAnalysisResult[]
  ): Promise<{
    trend: 'improving' | 'stable' | 'degrading';
    warnings: string[];
  }>;
}

// ============================================================================
// Plugin System Interfaces
// ============================================================================

/**
 * Hook priority levels
 */
export enum HookPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}

/**
 * Plugin hook definition
 */
export interface PluginHook {
  /** Hook name */
  name: string;
  /** Event to hook into */
  event: string;
  /** Execution priority */
  priority: HookPriority;
  /** Human-readable description */
  description: string;
  /** Hook handler function */
  handler: (context: PluginContext, payload: unknown) => Promise<unknown>;
}

/**
 * Plugin context provided to handlers
 */
export interface PluginContext {
  /**
   * Get a service or value from context
   * @param key Service/value key
   * @returns The service or value
   */
  get<T>(key: string): T;

  /**
   * Set a service or value in context
   * @param key Service/value key
   * @param value The service or value
   */
  set(key: string, value: unknown): void;

  /**
   * Check if a key exists in context
   * @param key Service/value key
   * @returns Whether key exists
   */
  has(key: string): boolean;
}

/**
 * MCP Tool definition for the plugin
 */
export interface PluginMCPTool {
  /** Tool name (will be prefixed with 'pr_') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Tool category */
  category: string;
  /** Tool version */
  version: string;
  /** JSON Schema for input validation */
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Tool handler function */
  handler: (input: unknown, context: PluginContext) => Promise<{
    content: Array<{
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
  }>;
}

/**
 * Plugin lifecycle interface
 */
export interface IPlugin {
  /** Plugin name */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** Plugin description */
  readonly description: string;

  /**
   * Register the plugin with claude-flow
   * Called once when plugin is loaded
   */
  register(context: PluginContext): Promise<void>;

  /**
   * Initialize the plugin
   * Called after registration, before first use
   */
  initialize(context: PluginContext): Promise<{ success: boolean; error?: string }>;

  /**
   * Shutdown the plugin
   * Called when plugin is being unloaded
   */
  shutdown(context: PluginContext): Promise<{ success: boolean; error?: string }>;

  /**
   * Get plugin capabilities
   */
  getCapabilities(): string[];

  /**
   * Get plugin MCP tools
   */
  getMCPTools(): PluginMCPTool[];

  /**
   * Get plugin hooks
   */
  getHooks(): PluginHook[];
}

// ============================================================================
// Cache Interface
// ============================================================================

/**
 * LRU Cache with TTL for result caching
 */
export interface IResultCache<T> {
  /**
   * Get a cached value
   * @param key Cache key
   * @returns Cached value or undefined
   */
  get(key: string): T | undefined;

  /**
   * Set a cached value
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL override
   */
  set(key: string, value: T, ttl?: number): void;

  /**
   * Check if key exists and is not expired
   * @param key Cache key
   * @returns Whether key exists
   */
  has(key: string): boolean;

  /**
   * Delete a cached value
   * @param key Cache key
   */
  delete(key: string): void;

  /**
   * Clear all cached values
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Prime Radiant plugin events
 */
export type PrimeRadiantEvent =
  | 'pr:initialized'
  | 'pr:shutdown'
  | 'pr:coherence-check'
  | 'pr:coherence-violation'
  | 'pr:spectral-analysis'
  | 'pr:causal-inference'
  | 'pr:consensus-verified'
  | 'pr:consensus-failed'
  | 'pr:topology-computed'
  | 'pr:cache-hit'
  | 'pr:cache-miss';

/**
 * Event payload for Prime Radiant events
 */
export interface PrimeRadiantEventPayload {
  /** Event type */
  type: PrimeRadiantEvent;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data?: unknown;
}

/**
 * Event emitter interface
 */
export interface IPrimeRadiantEventEmitter {
  /**
   * Emit an event
   * @param event Event type
   * @param payload Event payload
   */
  emit(event: PrimeRadiantEvent, payload?: unknown): void;

  /**
   * Subscribe to an event
   * @param event Event type
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  on(event: PrimeRadiantEvent, handler: (payload: PrimeRadiantEventPayload) => void): () => void;

  /**
   * Subscribe to an event once
   * @param event Event type
   * @param handler Event handler
   */
  once(event: PrimeRadiantEvent, handler: (payload: PrimeRadiantEventPayload) => void): void;
}

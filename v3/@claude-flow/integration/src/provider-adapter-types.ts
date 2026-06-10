/**
 * Type definitions for the provider adapter — the Provider / ModelInfo /
 * RateLimits / CostInfo / ProviderRequirements / ProviderSelectionResult
 * shapes, the ProviderType / Capability / Status unions, and the
 * Execution{Options,Result} / ProviderMetrics / ProviderAdapterConfig
 * configs.
 *
 * Extracted from provider-adapter.ts (W152, P3.31 cut #1). Named
 * provider-adapter-types.ts (not types.ts — src/types.ts already exists);
 * provider-adapter.ts stays the barrel and re-exports these.
 */

export interface Provider {
  /** Unique provider identifier */
  id: string;
  /** Provider name */
  name: string;
  /** Provider type */
  type: ProviderType;
  /** Available models */
  models: ModelInfo[];
  /** Provider capabilities */
  capabilities: ProviderCapability[];
  /** Provider status */
  status: ProviderStatus;
  /** Rate limits */
  rateLimits: RateLimits;
  /** Cost per token (input/output) */
  costPerToken: CostInfo;
  /** Provider-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Provider types
 */
export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'azure'
  | 'aws'
  | 'ollama'
  | 'huggingface'
  | 'custom';

/**
 * Provider capabilities
 */
export type ProviderCapability =
  | 'text-completion'
  | 'chat'
  | 'embeddings'
  | 'vision'
  | 'code-generation'
  | 'function-calling'
  | 'streaming'
  | 'fine-tuning'
  | 'batch-processing'
  | 'long-context';

/**
 * Provider status
 */
export type ProviderStatus =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'rate-limited'
  | 'maintenance';

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Model display name */
  name: string;
  /** Maximum context length */
  maxContextLength: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supported capabilities */
  capabilities: ProviderCapability[];
  /** Model-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Rate limit configuration
 */
export interface RateLimits {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Tokens per minute */
  tokensPerMinute: number;
  /** Current request count */
  currentRequests: number;
  /** Current token count */
  currentTokens: number;
  /** Reset timestamp */
  resetAt: number;
}

/**
 * Cost information
 */
export interface CostInfo {
  /** Cost per 1K input tokens in USD */
  inputPer1K: number;
  /** Cost per 1K output tokens in USD */
  outputPer1K: number;
  /** Currency */
  currency: string;
}

/**
 * Provider requirements for selection
 */
export interface ProviderRequirements {
  /** Required capabilities */
  capabilities?: ProviderCapability[];
  /** Minimum context length */
  minContextLength?: number;
  /** Maximum cost per 1K tokens */
  maxCostPer1K?: number;
  /** Preferred provider types */
  preferredTypes?: ProviderType[];
  /** Excluded provider IDs */
  excludeProviders?: string[];
  /** Required model ID */
  modelId?: string;
  /** Require streaming support */
  streaming?: boolean;
  /** Require vision support */
  vision?: boolean;
  /** Custom filters */
  customFilters?: ((provider: Provider) => boolean)[];
}

/**
 * Provider selection result
 */
export interface ProviderSelectionResult {
  /** Selected provider */
  provider: Provider;
  /** Selected model */
  model: ModelInfo;
  /** Selection score */
  score: number;
  /** Selection reasoning */
  reasons: string[];
  /** Alternative providers */
  alternatives: Array<{
    provider: Provider;
    model: ModelInfo;
    score: number;
  }>;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Model to use (overrides automatic selection) */
  modelId?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Enable streaming */
  stream?: boolean;
  /** Stop sequences */
  stopSequences?: string[];
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  /** Success indicator */
  success: boolean;
  /** Output content */
  content: string;
  /** Provider used */
  providerId: string;
  /** Model used */
  modelId: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Cost in USD */
  cost: number;
  /** Execution latency in milliseconds */
  latencyMs: number;
  /** Error if failed */
  error?: Error;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider metrics
 */
export interface ProviderMetrics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Last request timestamp */
  lastRequest: number;
  /** Uptime percentage */
  uptimePercent: number;
}

/**
 * Provider adapter configuration
 */
export interface ProviderAdapterConfig {
  /** Default provider ID */
  defaultProviderId?: string;
  /** Default model ID */
  defaultModelId?: string;
  /** Enable automatic failover */
  enableFailover?: boolean;
  /** Maximum failover attempts */
  maxFailoverAttempts?: number;
  /** Enable cost tracking */
  enableCostTracking?: boolean;
  /** Cost limit per hour in USD */
  costLimitPerHour?: number;
  /** Enable provider health checks */
  enableHealthChecks?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Enable request caching */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

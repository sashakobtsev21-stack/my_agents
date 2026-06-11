/**
 * Type definitions for the multi-model router — provider/routing-mode
 * unions, model/provider/router configs, routing request/result, chat/
 * tool/completion shapes, routing rules, provider health, and cost
 * tracking.
 *
 * Extracted from multi-model-router.ts (W157, P3.36 cut #1). Named
 * multi-model-router-types.ts (src/types.ts already exists); the router
 * file stays the barrel and re-exports these.
 */

export type ProviderType =
  | 'anthropic'   // Claude models
  | 'openai'      // GPT models
  | 'openrouter'  // 100+ models, 85-99% cost savings
  | 'ollama'      // Local models
  | 'litellm'     // Unified API
  | 'onnx'        // Free local inference
  | 'gemini'      // Google Gemini
  | 'custom';     // Custom providers

/**
 * Routing mode
 */
export type RoutingMode =
  | 'manual'               // Explicit provider selection
  | 'cost-optimized'       // Minimize cost
  | 'performance-optimized' // Minimize latency
  | 'quality-optimized'    // Maximize quality
  | 'rule-based';          // Custom routing rules

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  contextWindow: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  maxOutputTokens: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  models: ModelConfig[];
  defaultModel?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  latencyMs: number;
  qualityScore: number; // 0-1
  capabilities: ModelCapabilities;
  aliases?: string[];
}

/**
 * Routing request
 */
export interface RoutingRequest {
  task: string;
  messages: ChatMessage[];
  requiredCapabilities?: Partial<ModelCapabilities>;
  maxCost?: number;
  maxLatency?: number;
  minQuality?: number;
  preferredProvider?: ProviderType;
  preferredModel?: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * Tool call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Routing result
 */
export interface RoutingResult {
  provider: ProviderType;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  qualityScore: number;
  alternatives?: Array<{
    provider: ProviderType;
    model: string;
    estimatedCost: number;
  }>;
}

/**
 * Completion request
 */
export interface CompletionRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: ProviderType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Tool[];
  responseFormat?: 'text' | 'json';
}

/**
 * Tool definition
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Completion response
 */
export interface CompletionResponse {
  id: string;
  provider: ProviderType;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls';
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  latency: number;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  mode: RoutingMode;
  providers: ProviderConfig[];
  budgetLimit?: number;
  budgetPeriod?: 'hourly' | 'daily' | 'monthly';
  cacheTTL?: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
  routing: {
    preferLocalModels?: boolean;
    costWeight?: number;
    latencyWeight?: number;
    qualityWeight?: number;
  };
  rules?: RoutingRule[];
}

/**
 * Routing rule for rule-based mode
 */
export interface RoutingRule {
  name: string;
  condition: {
    taskPattern?: RegExp | string;
    minTokens?: number;
    maxTokens?: number;
    requiresTools?: boolean;
    requiresVision?: boolean;
  };
  action: {
    provider: ProviderType;
    model?: string;
    priority?: number;
  };
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: ProviderType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastError?: string;
  failureCount: number;
  successRate: number;
  avgLatency: number;
  circuitOpen: boolean;
}

/**
 * Cost tracking
 */
export interface CostTracker {
  periodStart: Date;
  periodEnd: Date;
  totalCost: number;
  byProvider: Record<ProviderType, number>;
  byModel: Record<string, number>;
  requests: number;
  tokensUsed: {
    input: number;
    output: number;
  };
}


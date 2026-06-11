/**
 * V3 root barrel — core
 *
 * Extracted verbatim during campaign-2 wave W307. Barrel stays.
 */

// =============================================================================
// @claude-flow Module Exports (New Modular Architecture)
// =============================================================================

/**
 * Security module - CVE fixes, input validation, credential management
 * @see {@link @claude-flow/security}
 */
export * as security from './@claude-flow/security/src/index.js';

/**
 * Memory module - AgentDB, HNSW indexing, vector search
 * @see {@link @claude-flow/memory}
 */
export * as memory from './@claude-flow/memory/src/index.js';

/**
 * Swarm module - 15-agent coordination, hierarchical mesh, consensus
 * @see {@link @claude-flow/swarm}
 */
export * as swarm from './@claude-flow/swarm/src/index.js';

/**
 * Integration module - agentic-flow@alpha integration, ADR-001 compliance
 * @see {@link @claude-flow/integration}
 */
export * as integration from './@claude-flow/integration/src/index.js';

/**
 * Shared module - common types, events, utilities, core interfaces
 * @see {@link @claude-flow/shared}
 */
export * as shared from './@claude-flow/shared/src/index.js';

/**
 * CLI module - Command parsing, prompts, output formatting
 * @see {@link @claude-flow/cli}
 */
export * as cli from './@claude-flow/cli/src/index.js';

/**
 * Neural module - SONA learning, neural modes
 * @see {@link @claude-flow/neural}
 */
export * as neural from './@claude-flow/neural/src/index.js';

/**
 * Performance module - Benchmarking, Flash Attention validation
 * @see {@link @claude-flow/performance}
 */
export * as performance from './@claude-flow/performance/src/index.js';

/**
 * Testing module - TDD London School framework, test utilities
 * @see {@link @claude-flow/testing}
 */
export * as testing from './@claude-flow/testing/src/index.js';

/**
 * Deployment module - Release management, CI/CD
 * @see {@link @claude-flow/deployment}
 */
export * as deployment from './@claude-flow/deployment/src/index.js';

// =============================================================================
// Module List for Dynamic Loading
// =============================================================================

export const MODULES = [
  '@claude-flow/shared',
  '@claude-flow/security',
  '@claude-flow/memory',
  '@claude-flow/swarm',
  '@claude-flow/integration',
  '@claude-flow/cli',
  '@claude-flow/neural',
  '@claude-flow/performance',
  '@claude-flow/testing',
  '@claude-flow/deployment',
] as const;

export type ModuleName = (typeof MODULES)[number];

// =============================================================================
// Legacy Compatibility Layer (Gradual Migration Support)
// =============================================================================

// =============================================================================
// V3 Core Architecture (Decomposed Orchestrator)
// =============================================================================

// Core Interfaces
export type {
  // Task interfaces
  ITask,
  ITaskCreate,
  ITaskResult,
  ITaskManager,
  ITaskQueue,
  TaskManagerMetrics,

  // Agent interfaces
  IAgent,
  IAgentConfig,
  IAgentSession,
  IAgentPool,
  IAgentLifecycleManager,
  IAgentRegistry,
  IAgentCapability,

  // Event interfaces
  IEvent,
  IEventCreate,
  IEventBus as IEventBusCore,
  IEventHandler,
  IEventSubscription,
  IEventFilter,
  IEventStore,
  IEventCoordinator,

  // Memory interfaces
  IMemoryEntry,
  IMemoryEntryCreate,
  IMemoryBackend,
  IVectorMemoryBackend,
  IMemoryBank,
  IMemoryManager,
  IPatternStorage,
  IVectorSearchParams,
  IVectorSearchResult,

  // Coordinator interfaces
  ISwarmConfig,
  ISwarmState,
  ICoordinator,
  ICoordinationManager,
  IHealthMonitor,
  IMetricsCollector,
  IHealthStatus,
  IComponentHealth,
  IOrchestratorMetrics,
} from './core/interfaces/index.js';

export { SystemEventTypes } from './core/interfaces/event.interface.js';

// Orchestrator Components
export {
  // Task management
  TaskManager,
  TaskQueue,

  // Session management
  SessionManager,
  type ISessionManager,
  type SessionManagerConfig,
  type SessionPersistence,

  // Health monitoring
  HealthMonitor,
  type HealthMonitorConfig,
  type HealthCheckFn,

  // Lifecycle management
  LifecycleManager,
  AgentPool,
  type LifecycleManagerConfig,

  // Event coordination
  EventCoordinator,

  // Factory function
  createOrchestrator,
  defaultOrchestratorConfig,
  type OrchestratorConfig,
  type OrchestratorComponents,
} from './core/orchestrator/index.js';

// Event Bus
export { EventBus as EventBusCore, createEventBus } from './core/event-bus.js';

// Configuration
export {
  // Schemas
  AgentConfigSchema,
  TaskConfigSchema,
  SwarmConfigSchema,
  MemoryConfigSchema,
  MCPServerConfigSchema,
  OrchestratorConfigSchema,
  SystemConfigSchema,

  // Validation
  validateAgentConfig,
  validateTaskConfig,
  validateSwarmConfig,
  validateMemoryConfig,
  validateMCPServerConfig,
  validateOrchestratorConfig,
  validateSystemConfig,
  ConfigValidator,
  type ValidationResult,
  type ValidationError,

  // Defaults
  defaultAgentConfig,
  defaultTaskConfig,
  defaultSwarmConfigCore,
  defaultMemoryConfig,
  defaultMCPServerConfig,
  defaultSystemConfig,
  agentTypePresets,
  mergeWithDefaults,

  // Loader
  ConfigLoader,
  loadConfig,
  type LoadedConfig,
  type ConfigSource,
} from './core/config/index.js';

// V3 Extended Types
export type {
  // Agent types
  AgentProfile,
  AgentPermissions,
  AgentSpawnOptions,
  AgentSpawnResult,
  AgentTerminationOptions,
  AgentTerminationResult,
  AgentHealthCheckResult,
  AgentBatchResult,
  AgentEventPayloads,

  // Task types
  TaskInput,
  TaskMetadata as TaskMetadataExtended,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskArtifact,
  TaskQueueConfig,
  TaskAssignmentConfig,
  TaskRetryPolicy,
  TaskFilter,
  TaskSortOptions,
  TaskQueryOptions,
  TaskEventPayloads,

  // Swarm types
  SwarmInitOptions,
  SwarmInitResult,
  SwarmScaleOptions,
  SwarmScaleResult,
  SwarmMessage,
  ConsensusRequest,
  ConsensusResponse,
  DistributedLock,
  LockAcquisitionResult,
  DeadlockDetectionResult,
  SwarmMetrics as SwarmMetricsExtended,
  SwarmEventPayloads,

  // Memory types
  MemoryBackendConfig,
  MemoryStoreOptions,
  MemoryRetrieveOptions,
  MemoryListOptions,
  MemorySearchOptions,
  MemoryBatchOperation,
  MemoryBatchResult,
  MemoryStats,
  MemoryBankStats,
  LearnedPattern,
  PatternSearchResult,
  MemoryEventPayloads,
  CacheConfig,
  VectorIndexConfig,
  FlashAttentionConfig,

  // MCP types
  MCPTool,
  MCPToolHandler,
  MCPToolResult,
  MCPContent,
  MCPServerConfig as MCPServerConfigExtended,
  MCPTransportConfig,
  MCPResource,
  MCPPrompt,
  MCPCapabilities,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPEventPayloads,
  MCPServerStatus,
} from './types/index.js';

export {
  priorityToNumber,
  numberToPriority,
  TopologyPresets,
} from './types/index.js';

// =============================================================================
// Legacy/Shared Exports (Preserved for Backward Compatibility)
// =============================================================================

// Shared Types

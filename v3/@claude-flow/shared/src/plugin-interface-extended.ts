/**
 * Plugin interface — extended
 *
 * Extracted verbatim during campaign-2 wave W308. Barrel stays.
 */
import type { IEventBus } from './core/interfaces/event.interface.js';
import type { IAgentConfig } from './core/interfaces/agent.interface.js';
import type { MCPTool } from './types/mcp.types.js';
import type { AgentTypeDefinition, CLICommandDefinition, MCPToolDefinition, PluginContext, TaskTypeDefinition } from './plugin-interface-core.js';

export interface MemoryBackendFactory {
  /**
   * Backend name
   */
  name: string;

  /**
   * Backend description
   */
  description: string;

  /**
   * Create a new backend instance
   */
  create(config: MemoryBackendConfig): Promise<IMemoryBackend>;

  /**
   * Backend capabilities
   */
  capabilities: {
    supportsVectorSearch: boolean;
    supportsFullText: boolean;
    supportsTransactions: boolean;
    supportsPersistence: boolean;
  };

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Memory backend configuration
 */
export interface MemoryBackendConfig {
  /**
   * Storage path or connection string
   */
  path?: string;

  /**
   * Backend-specific options
   */
  options?: Record<string, unknown>;

  /**
   * Resource limits
   */
  limits?: {
    maxMemoryMb?: number;
    maxStorageMb?: number;
  };
}

/**
 * Memory backend interface
 */
export interface IMemoryBackend {
  /**
   * Initialize the backend
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the backend
   */
  shutdown(): Promise<void>;

  /**
   * Store a memory entry
   */
  store(key: string, value: unknown, metadata?: Record<string, unknown>): Promise<void>;

  /**
   * Retrieve a memory entry
   */
  retrieve(key: string): Promise<unknown | null>;

  /**
   * Delete a memory entry
   */
  delete(key: string): Promise<boolean>;

  /**
   * Search memory entries
   */
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;

  /**
   * Clear all memory entries
   */
  clear(): Promise<void>;

  /**
   * Get backend statistics
   */
  getStats(): Promise<MemoryBackendStats>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  /**
   * Maximum number of results
   */
  limit?: number;

  /**
   * Result offset for pagination
   */
  offset?: number;

  /**
   * Minimum similarity score (0-1)
   */
  minScore?: number;

  /**
   * Filter by metadata
   */
  filter?: Record<string, unknown>;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  /**
   * Memory key
   */
  key: string;

  /**
   * Memory value
   */
  value: unknown;

  /**
   * Similarity score (0-1)
   */
  score: number;

  /**
   * Associated metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Memory backend statistics
 */
export interface MemoryBackendStats {
  /**
   * Total number of entries
   */
  entryCount: number;

  /**
   * Total storage size in bytes
   */
  sizeBytes: number;

  /**
   * Memory usage in bytes
   */
  memoryUsageBytes: number;

  /**
   * Backend-specific metrics
   */
  metrics?: Record<string, number>;
}

/**
 * Core ClaudeFlowPlugin interface
 * All plugins must implement this interface
 */
export interface ClaudeFlowPlugin {
  /**
   * Unique plugin name
   */
  readonly name: string;

  /**
   * Plugin version (semver)
   */
  readonly version: string;

  /**
   * Optional plugin dependencies
   * List of plugin names that must be loaded before this plugin
   */
  readonly dependencies?: string[];

  /**
   * Plugin description
   */
  readonly description?: string;

  /**
   * Plugin author
   */
  readonly author?: string;

  /**
   * Initialize the plugin
   * Called after all dependencies are loaded
   */
  initialize(context: PluginContext): Promise<void>;

  /**
   * Shutdown the plugin
   * Called during system shutdown
   */
  shutdown(): Promise<void>;

  /**
   * Register custom agent types (optional)
   * @returns Array of agent type definitions
   */
  registerAgentTypes?(): AgentTypeDefinition[];

  /**
   * Register custom task types (optional)
   * @returns Array of task type definitions
   */
  registerTaskTypes?(): TaskTypeDefinition[];

  /**
   * Register MCP tools (optional)
   * @returns Array of MCP tool definitions
   */
  registerMCPTools?(): MCPToolDefinition[];

  /**
   * Register CLI commands (optional)
   * @returns Array of CLI command definitions
   */
  registerCLICommands?(): CLICommandDefinition[];

  /**
   * Register memory backends (optional)
   * @returns Array of memory backend factories
   */
  registerMemoryBackends?(): MemoryBackendFactory[];

  /**
   * Optional health check
   * @returns true if plugin is healthy, false otherwise
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Optional plugin metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Plugin lifecycle state
 */
export type PluginLifecycleState =
  | 'uninitialized'
  | 'initializing'
  | 'initialized'
  | 'shutting-down'
  | 'shutdown'
  | 'error';

/**
 * Plugin info for registry tracking
 */
export interface PluginInfo {
  /**
   * Plugin instance
   */
  plugin: ClaudeFlowPlugin;

  /**
   * Current lifecycle state
   */
  state: PluginLifecycleState;

  /**
   * Initialization timestamp
   */
  initializedAt?: Date;

  /**
   * Shutdown timestamp
   */
  shutdownAt?: Date;

  /**
   * Plugin context
   */
  context?: PluginContext;

  /**
   * Error if state is 'error'
   */
  error?: Error;

  /**
   * Plugin metrics
   */
  metrics?: {
    agentTypesRegistered: number;
    taskTypesRegistered: number;
    mcpToolsRegistered: number;
    cliCommandsRegistered: number;
    memoryBackendsRegistered: number;
  };
}

/**
 * Plugin error types
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly code: PluginErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export type PluginErrorCode =
  | 'INITIALIZATION_FAILED'
  | 'SHUTDOWN_FAILED'
  | 'DEPENDENCY_NOT_FOUND'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_PLUGIN'
  | 'DUPLICATE_PLUGIN'
  | 'HEALTH_CHECK_FAILED';

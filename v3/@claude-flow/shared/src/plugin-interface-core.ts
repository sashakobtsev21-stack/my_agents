/**
 * Plugin interface — core
 *
 * Extracted verbatim during campaign-2 wave W308. Barrel stays.
 */
import type { IEventBus } from './core/interfaces/event.interface.js';
import type { IAgentConfig } from './core/interfaces/agent.interface.js';
import type { MCPTool } from './types/mcp.types.js';

export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Service container for dependency injection
 */
export interface ServiceContainer {
  /**
   * Register a service in the container
   */
  register<T>(name: string, service: T): void;

  /**
   * Get a service from the container
   */
  get<T>(name: string): T | undefined;

  /**
   * Check if a service is registered
   */
  has(name: string): boolean;

  /**
   * Get all registered service names
   */
  getServiceNames(): string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /**
   * Plugin-specific configuration
   */
  [key: string]: unknown;

  /**
   * Enable/disable features
   */
  features?: Record<string, boolean>;

  /**
   * Resource limits
   */
  resources?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
  };
}

/**
 * Plugin context provided during initialization
 * Contains services and resources available to plugins
 */
export interface PluginContext {
  /**
   * Plugin-specific configuration
   */
  config: PluginConfig;

  /**
   * Event bus for pub/sub communication
   */
  eventBus: IEventBus;

  /**
   * Logger instance
   */
  logger: ILogger;

  /**
   * Service container for dependency injection
   */
  services: ServiceContainer;
}

/**
 * Agent type definition for plugin registration
 */
export interface AgentTypeDefinition {
  /**
   * Unique type identifier
   */
  type: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of agent capabilities
   */
  description: string;

  /**
   * Default configuration for this agent type
   */
  defaultConfig: Partial<IAgentConfig>;

  /**
   * Required capabilities for this agent type
   */
  requiredCapabilities?: string[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Task type definition for plugin registration
 */
export interface TaskTypeDefinition {
  /**
   * Unique type identifier
   */
  type: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of task purpose
   */
  description: string;

  /**
   * Default priority (0-100)
   */
  defaultPriority: number;

  /**
   * Default timeout in milliseconds
   */
  defaultTimeout: number;

  /**
   * Required agent capabilities to execute this task
   */
  requiredCapabilities?: string[];

  /**
   * Task input schema (JSON Schema)
   */
  inputSchema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * MCP tool definition for plugin registration
 */
export interface MCPToolDefinition extends MCPTool {
  /**
   * Plugin that registered this tool
   */
  pluginName?: string;

  /**
   * Tool version
   */
  version?: string;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * CLI command definition for plugin registration
 */
export interface CLICommandDefinition {
  /**
   * Command name
   */
  name: string;

  /**
   * Command description
   */
  description: string;

  /**
   * Command aliases
   */
  aliases?: string[];

  /**
   * Command options
   */
  options?: CLICommandOption[];

  /**
   * Command arguments
   */
  arguments?: CLICommandArgument[];

  /**
   * Command handler function
   */
  handler: (args: CLICommandArgs) => Promise<void> | void;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * CLI command option
 */
export interface CLICommandOption {
  /**
   * Option name (without dashes)
   */
  name: string;

  /**
   * Short flag (single character)
   */
  short?: string;

  /**
   * Option description
   */
  description: string;

  /**
   * Option type
   */
  type: 'string' | 'number' | 'boolean';

  /**
   * Default value
   */
  default?: string | number | boolean;

  /**
   * Is this option required?
   */
  required?: boolean;
}

/**
 * CLI command argument
 */
export interface CLICommandArgument {
  /**
   * Argument name
   */
  name: string;

  /**
   * Argument description
   */
  description: string;

  /**
   * Is this argument required?
   */
  required?: boolean;

  /**
   * Default value
   */
  default?: string;

  /**
   * Allowed values (for validation)
   */
  choices?: string[];
}

/**
 * CLI command parsed arguments
 */
export interface CLICommandArgs {
  /**
   * Positional arguments
   */
  _: string[];

  /**
   * Named options
   */
  [key: string]: unknown;
}

/**
 * Memory backend factory for plugin registration
 */

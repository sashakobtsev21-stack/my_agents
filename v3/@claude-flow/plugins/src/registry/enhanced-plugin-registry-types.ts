/**
 * Enhanced Plugin Registry — public types
 *
 * Strategy/conflict/config/entry/stats shapes. Extracted verbatim from
 * enhanced-plugin-registry.ts (lines 40-110) during the P3.52 god-file
 * decomposition (W173). The parent re-exports all nine names so deep
 * importers resolve byte-identically (note: the package index.ts
 * deliberately sources PluginEntry/RegistryStats from plugin-registry.js
 * — that pre-existing duality is unchanged by this split).
 */

import type { IEventBus, ILogger, PluginConfig } from '../types/index.js';
import type { IPlugin } from '../core/plugin-interface.js';

// ============================================================================
// Types
// ============================================================================

export type InitializationStrategy = 'sequential' | 'parallel' | 'parallel-safe';

export type ConflictStrategy = 'first' | 'last' | 'error' | 'namespace';

export interface ConflictResolution {
  strategy: ConflictStrategy;
  namespaceTemplate?: string;  // e.g., "{plugin}:{name}"
}

export interface EnhancedPluginRegistryConfig {
  coreVersion: string;
  dataDir: string;
  logger?: ILogger;
  eventBus?: IEventBus;
  defaultConfig?: Partial<PluginConfig>;
  maxPlugins?: number;
  loadTimeout?: number;
  initializationStrategy?: InitializationStrategy;
  maxParallelInit?: number;
  conflictResolution?: {
    mcpTools?: ConflictResolution;
    cliCommands?: ConflictResolution;
    agentTypes?: ConflictResolution;
    taskTypes?: ConflictResolution;
  };
}

export interface PluginEntry {
  plugin: IPlugin;
  config: PluginConfig;
  loadTime: Date;
  initTime?: Date;
  error?: string;
}

export interface UnregisterOptions {
  cascade?: boolean;  // Unload dependents first
  force?: boolean;    // Ignore dependency errors
}

export interface HotReloadOptions {
  preserveState?: boolean;
  migrateState?: (oldState: unknown, newVersion: string) => unknown;
  timeout?: number;
}

export interface RegistryStats {
  total: number;
  initialized: number;
  failed: number;
  agentTypes: number;
  taskTypes: number;
  mcpTools: number;
  cliCommands: number;
  hooks: number;
  workers: number;
  providers: number;
}

export interface ServiceMetadata {
  description?: string;
  provider: string;
  version?: string;
  deprecated?: boolean;
  replacement?: string;
}


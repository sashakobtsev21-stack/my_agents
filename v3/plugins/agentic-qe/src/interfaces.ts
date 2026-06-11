/**
 * Agentic-QE Plugin Interfaces
 *
 * Public interfaces for the Quality Engineering plugin's anti-corruption layer.
 * These interfaces define contracts between agentic-qe and Claude Flow V3 domains.
 *
 * Based on ADR-030: Agentic-QE Plugin Integration
 *
 * @module v3/plugins/agentic-qe/interfaces
 */


// This file is now a thin barrel + the plugin-context interface: the five
// bridge-interface sections were split into the modules below during the
// P3.59 god-file decomposition (W180), mirroring the src/bridges/
// implementations. Kept as interfaces.ts so './interfaces.js' importers
// (the bridges + index) keep resolving byte-identically.
export * from './interfaces-memory.js';
export * from './interfaces-security.js';
export * from './interfaces-core-bridge.js';
export * from './interfaces-hive.js';
export * from './interfaces-routing.js';

import type { IQEMemoryBridge } from './interfaces-memory.js';
import type { IQESecurityBridge } from './interfaces-security.js';
import type { IQECoreBridge } from './interfaces-core-bridge.js';
import type { IQEHiveBridge } from './interfaces-hive.js';
import type { IQEModelRoutingAdapter } from './interfaces-routing.js';

// Plugin Context Interface
// =============================================================================

/**
 * QE Plugin context for dependency injection
 */
export interface QEPluginContext {
  /** Memory bridge */
  memory: IQEMemoryBridge;

  /** Security bridge */
  security: IQESecurityBridge;

  /** Core bridge */
  core: IQECoreBridge;

  /** Hive bridge */
  hive: IQEHiveBridge;

  /** Model routing adapter */
  modelRouter: IQEModelRoutingAdapter;

  /** Logger */
  logger: QELogger;

  /** Configuration */
  config: QEPluginConfig;
}

/**
 * QE logger interface
 */
export interface QELogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * QE plugin configuration
 */
export interface QEPluginConfig {
  /** Plugin namespace */
  namespace: string;

  /** Default timeout */
  defaultTimeout: number;

  /** Enable learning */
  enableLearning: boolean;

  /** Max concurrent tests */
  maxConcurrentTests: number;

  /** Coverage target */
  coverageTarget: number;

  /** Security level */
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
}

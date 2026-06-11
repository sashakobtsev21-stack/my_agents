/**
 * Enhanced Plugin Registry — default service implementations
 *
 * EnhancedServiceContainer, DefaultEventBus, and DefaultLogger. These
 * were module-private in the original enhanced-plugin-registry.ts
 * (P3.52, W173) and are deliberately NOT re-exported by the barrel —
 * public API unchanged.
 */

import { EventEmitter } from 'events';
import type {
  IEventBus,
  ILogger,
  ServiceContainer,
} from '../types/index.js';
import type { ServiceMetadata } from './enhanced-plugin-registry-types.js';

// ============================================================================
// Enhanced Service Container
// ============================================================================

export class EnhancedServiceContainer implements ServiceContainer {
  private services = new Map<string, unknown>();
  private metadata = new Map<string, ServiceMetadata>();

  get<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.services.set(key, value);
  }

  setWithMetadata<T>(key: string, value: T, metadata: ServiceMetadata): void {
    this.services.set(key, value);
    this.metadata.set(key, metadata);
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  delete(key: string): boolean {
    this.metadata.delete(key);
    return this.services.delete(key);
  }

  list(): string[] {
    return Array.from(this.services.keys());
  }

  listByPrefix(prefix: string): string[] {
    return this.list().filter(key => key.startsWith(prefix));
  }

  getMetadata(key: string): ServiceMetadata | undefined {
    return this.metadata.get(key);
  }
}

// ============================================================================
// Default Implementations
// ============================================================================

export class DefaultEventBus implements IEventBus {
  private emitter = new EventEmitter();

  emit(event: string, data?: unknown): void {
    this.emitter.emit(event, data);
  }

  on(event: string, handler: (data?: unknown) => void | Promise<void>): () => void {
    this.emitter.on(event, handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: (data?: unknown) => void | Promise<void>): void {
    this.emitter.off(event, handler);
  }

  once(event: string, handler: (data?: unknown) => void | Promise<void>): () => void {
    this.emitter.once(event, handler);
    return () => this.off(event, handler);
  }
}

export class DefaultLogger implements ILogger {
  private context: Record<string, unknown> = {};

  constructor(context?: Record<string, unknown>) {
    if (context) this.context = context;
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[DEBUG]`, message, ...args, this.context);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(`[INFO]`, message, ...args, this.context);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN]`, message, ...args, this.context);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR]`, message, ...args, this.context);
  }

  child(context: Record<string, unknown>): ILogger {
    return new DefaultLogger({ ...this.context, ...context });
  }
}


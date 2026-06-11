/**
 * RuVector Streaming — pool events
 *
 * PoolEventEmitter: typed pool lifecycle event fan-out.
 * Extracted verbatim from streaming.ts (lines 1567-1675) during the
 * P3.45 god-file decomposition (W166). streaming.ts stays the barrel.
 */

import { EventEmitter } from 'events';
import type { Pool, PoolClient, PoolEvents } from './streaming-types.js';

// ============================================================================
// PoolEventEmitter Class
// ============================================================================

/**
 * Event emitter for connection pool lifecycle events.
 *
 * Provides typed event handling for pool operations.
 *
 * @example
 * ```typescript
 * const poolEvents = new PoolEventEmitter(pool);
 *
 * poolEvents.on('pool:connect', (client) => {
 *   console.log('Client connected');
 * });
 *
 * poolEvents.on('pool:error', (error, client) => {
 *   console.error('Pool error:', error);
 * });
 * ```
 */
export class PoolEventEmitter extends EventEmitter {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
    this.setupListeners();
  }

  /**
   * Add typed event listener.
   */
  on<K extends keyof PoolEvents>(event: K, listener: PoolEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Add one-time typed event listener.
   */
  once<K extends keyof PoolEvents>(event: K, listener: PoolEvents[K]): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove typed event listener.
   */
  off<K extends keyof PoolEvents>(event: K, listener: PoolEvents[K]): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Emit typed event.
   */
  emit<K extends keyof PoolEvents>(
    event: K,
    ...args: Parameters<PoolEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Get current pool statistics.
   */
  getStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Setup pool event listeners.
   */
  private setupListeners(): void {
    this.pool.on('connect', (...args: unknown[]) => {
      const client = args[0] as PoolClient;
      this.emit('pool:connect', client);
    });

    this.pool.on('acquire', (...args: unknown[]) => {
      const client = args[0] as PoolClient;
      this.emit('pool:acquire', client);
    });

    this.pool.on('release', (...args: unknown[]) => {
      const client = args[0] as PoolClient;
      this.emit('pool:release', client);
    });

    this.pool.on('remove', (...args: unknown[]) => {
      const client = args[0] as PoolClient;
      this.emit('pool:remove', client);
    });

    this.pool.on('error', (...args: unknown[]) => {
      const error = args[0] as Error;
      const client = args[1] as PoolClient | undefined;
      this.emit('pool:error', error, client);
    });
  }
}


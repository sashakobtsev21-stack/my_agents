/**
 * RuVector Bridge — connection manager
 *
 * ConnectionManager: pg pool lifecycle, retries, and timed queries.
 * Extracted verbatim from ruvector-bridge.ts (lines 159-484) during the
 * P3.46 god-file decomposition (W167); was module-private and is NOT
 * re-exported by the barrel.
 */

import { EventEmitter } from 'events';
import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_POOL_MAX,
  DEFAULT_POOL_MIN,
  DEFAULT_QUERY_TIMEOUT_MS,
  SLOW_QUERY_THRESHOLD_MS,
} from './ruvector-bridge-internal.js';
import type {
  PgPoolConfig,
  PgQueryResult,
  Pool,
  PoolClient,
  PoolFactory,
} from './ruvector-bridge-internal.js';
import type {
  ConnectionResult,
  PoolConfig,
  QueryResult,
  RetryConfig,
  RuVectorConfig,
} from './types.js';

// ============================================================================
// Connection Manager
// ============================================================================

/**
 * Manages PostgreSQL connection pooling with automatic retry and health monitoring.
 */
export class ConnectionManager extends EventEmitter {
  private pool: Pool | null = null;
  private readonly config: RuVectorConfig;
  private readonly retryConfig: RetryConfig;
  private connectionId = 0;
  private isConnected = false;
  private lastHealthCheck: Date | null = null;

  constructor(config: RuVectorConfig) {
    super();
    this.config = config;
    this.retryConfig = config.retry ?? {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
    };
  }

  /**
   * Initialize the connection pool.
   */
  async initialize(): Promise<ConnectionResult> {
    if (this.pool) {
      throw new Error('Connection pool already initialized');
    }

    const poolConfig = this.buildPoolConfig();

    try {
      // Dynamically import pg to avoid bundling issues
      const pg = await this.loadPg();
      this.pool = new pg.Pool(poolConfig);

      // Set up event handlers
      this.pool.on('connect', () => {
        this.connectionId++;
        this.emit('connection:open', {
          connectionId: `conn-${this.connectionId}`,
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
        });
      });

      this.pool.on('error', (...args: unknown[]) => {
        const err = args[0] as Error;
        this.emit('connection:error', {
          error: err,
          code: (err as { code?: string }).code,
        });
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query<{ version: string; ruvector_version?: string }>(
        "SELECT version() as version, COALESCE(ruvector.version(), 'N/A') as ruvector_version"
      );
      client.release();

      this.isConnected = true;
      this.lastHealthCheck = new Date();

      const connectionResult: ConnectionResult = {
        connectionId: `conn-${this.connectionId}`,
        ready: true,
        serverVersion: result.rows[0]?.version ?? 'unknown',
        ruVectorVersion: result.rows[0]?.ruvector_version ?? 'N/A',
        parameters: {
          host: this.config.host,
          port: String(this.config.port),
          database: this.config.database,
          ssl: String(!!this.config.ssl),
        },
      };

      return connectionResult;
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to initialize connection pool: ${(error as Error).message}`);
    }
  }

  /**
   * Load pg module dynamically.
   */
  private async loadPg(): Promise<PoolFactory> {
    try {
      // Try to import pg
      const pg: any = await import('pg');
      return pg.default ?? pg;
    } catch {
      throw new Error(
        'pg (node-postgres) package not found. Install it with: npm install pg'
      );
    }
  }

  /**
   * Build pool configuration from RuVector config.
   */
  private buildPoolConfig(): PgPoolConfig {
    const poolSettings = (this.config.pool ?? {}) as Partial<PoolConfig>;

    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl
        ? typeof this.config.ssl === 'boolean'
          ? { rejectUnauthorized: false }
          : { rejectUnauthorized: this.config.ssl.rejectUnauthorized ?? true }
        : undefined,
      min: poolSettings.min ?? DEFAULT_POOL_MIN,
      max: poolSettings.max ?? this.config.poolSize ?? DEFAULT_POOL_MAX,
      idleTimeoutMillis: poolSettings.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: this.config.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS,
      application_name: this.config.applicationName ?? 'claude-flow-ruvector',
    };
  }

  /**
   * Execute a query with timeout and retry logic.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
    timeoutMs?: number
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const startTime = Date.now();
    const queryId = `query-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timeout = timeoutMs ?? this.config.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;

    this.emit('query:start', { queryId, sql, params });

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.retryConfig.maxAttempts) {
      attempt++;

      try {
        const result = await this.executeWithTimeout<T>(sql, params, timeout);
        const durationMs = Date.now() - startTime;

        const queryResult: QueryResult<T> = {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          affectedRows: result.rowCount ?? undefined,
          durationMs,
          command: result.command,
        };

        this.emit('query:complete', {
          queryId,
          durationMs,
          rowCount: queryResult.rowCount,
        });

        if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
          this.emit('query:slow', {
            queryId,
            durationMs,
            rowCount: queryResult.rowCount,
            threshold: SLOW_QUERY_THRESHOLD_MS,
          });
        }

        return queryResult;
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt >= this.retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff and optional jitter
        let delay = this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        delay = Math.min(delay, this.retryConfig.maxDelayMs);

        if (this.retryConfig.jitter) {
          delay = delay * (0.5 + Math.random());
        }

        await this.sleep(delay);
      }
    }

    const durationMs = Date.now() - startTime;
    this.emit('query:error', {
      queryId,
      sql,
      params,
      error: lastError!,
      durationMs,
    });

    throw lastError!;
  }

  /**
   * Execute query with timeout.
   */
  private async executeWithTimeout<T>(
    sql: string,
    params: unknown[] | undefined,
    timeoutMs: number
  ): Promise<PgQueryResult<T>> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await this.pool!.query<T>(sql, params);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Check if error is retryable.
   */
  private isRetryableError(error: Error): boolean {
    const code = (error as { code?: string }).code;
    const retryableCodes = this.retryConfig.retryableErrors ?? [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      '40001', // serialization_failure
      '40P01', // deadlock_detected
    ];
    return code !== undefined && retryableCodes.includes(code);
  }

  /**
   * Get a client from the pool.
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    this.emit('connection:pool_acquired', this.getPoolStats());
    return this.pool.connect();
  }

  /**
   * Release a client back to the pool.
   */
  releaseClient(client: PoolClient, error?: Error): void {
    client.release(error);
    this.emit('connection:pool_released', this.getPoolStats());
  }

  /**
   * Get pool statistics.
   */
  getPoolStats(): {
    connectionId: string;
    poolSize: number;
    availableConnections: number;
    waitingClients: number;
  } {
    return {
      connectionId: `pool-${this.connectionId}`,
      poolSize: this.pool?.totalCount ?? 0,
      availableConnections: this.pool?.idleCount ?? 0,
      waitingClients: this.pool?.waitingCount ?? 0,
    };
  }

  /**
   * Check if connected.
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Shutdown the connection pool.
   */
  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      this.emit('connection:close', {
        connectionId: `conn-${this.connectionId}`,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      });
    }
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


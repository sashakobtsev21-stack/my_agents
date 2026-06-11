/**
 * Beads CLI Bridge
 *
 * Provides a secure wrapper around the `bd` (Beads) CLI tool.
 * Implements command execution with proper input sanitization,
 * argument validation, JSONL parsing, and error handling.
 *
 * Security Features:
 * - All inputs validated with Zod schemas
 * - No shell execution (uses execFile)
 * - Command allowlist enforcement
 * - Argument sanitization
 * - JSONL streaming support
 *
 * @module v3/plugins/gastown-bridge/bridges/bd-bridge
 */

import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

import {
  LRUCache,
  BatchDeduplicator,
  Lazy,
} from '../cache.js';

const execFileAsync = promisify(execFile);

// ============================================================================

// The caches/schemas/types/errors/logger/allowed-commands were extracted
// into ./bd-bridge-defs.ts during the P3.76 god-file decomposition
// (W197). Re-export the original public surface; private pieces are
// imported back without re-export.
export { BeadSchema, BdBridgeError } from './bd-bridge-defs.js';
export type { BdErrorCode } from './bd-bridge-defs.js';
export type {
  Bead,
  BeadType,
  BdBridgeConfig,
  BeadQuery,
  CreateBeadParams,
  BdResult,
  BdStreamResult,
  BdLogger,
} from './bd-bridge-defs.js';
import {
  ALLOWED_BD_COMMANDS,
  BdArgumentSchema,
  BdBridgeError,
  BeadIdSchema,
  BeadSchema,
  BeadTypeSchema,
  IdentifierSchema,
  SafeStringSchema,
  beadQueryCache,
  defaultLogger,
  execDedup,
  hashArgs,
  parsedCache,
  singleBeadCache,
  staticCache,
} from './bd-bridge-defs.js';
import type {
  Bead,
  BeadType,
  BdBridgeConfig,
  BeadQuery,
  CreateBeadParams,
  BdResult,
  BdStreamResult,
  BdLogger,
} from './bd-bridge-defs.js';

// Beads Bridge Implementation
// ============================================================================

/**
 * Beads CLI Bridge
 *
 * Secure wrapper around the `bd` CLI tool for bead management.
 * Supports JSONL output parsing for streaming large datasets.
 *
 * @example
 * ```typescript
 * const bdBridge = new BdBridge({ bdPath: '/usr/local/bin/bd' });
 * await bdBridge.initialize();
 *
 * const beads = await bdBridge.listBeads({ type: 'prompt', limit: 100 });
 * ```
 */
export class BdBridge {
  private config: Required<BdBridgeConfig>;
  private logger: BdLogger;
  private initialized = false;

  /** Commands that can be cached (read-only, no side effects) */
  private static readonly CACHEABLE_COMMANDS = new Set([
    'list',
    'get',
    'search',
    'stats',
    'version',
    'help',
    'config',
  ]);

  /** Commands that should use longer cache (static data) */
  private static readonly STATIC_COMMANDS = new Set([
    'version',
    'help',
    'stats',
    'config',
  ]);

  constructor(config?: BdBridgeConfig, logger?: BdLogger) {
    this.config = {
      bdPath: config?.bdPath ?? 'bd',
      cwd: config?.cwd ?? process.cwd(),
      timeout: config?.timeout ?? 60000,
      maxBuffer: config?.maxBuffer ?? 50 * 1024 * 1024,
      env: config?.env ?? process.env,
      storagePath: config?.storagePath ?? '',
    };
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Initialize the bridge and verify bd is available
   */
  async initialize(): Promise<void> {
    try {
      const result = await this.execBd(['version']);
      if (!result.success) {
        throw new BdBridgeError(
          'Failed to verify bd installation',
          'COMMAND_NOT_FOUND',
          'bd',
          ['version']
        );
      }
      this.initialized = true;
      this.logger.info('Beads bridge initialized', {
        bdPath: this.config.bdPath,
        version: result.data,
      });
    } catch (error) {
      if (error instanceof BdBridgeError) throw error;
      throw new BdBridgeError(
        'Failed to initialize Beads bridge',
        'COMMAND_NOT_FOUND',
        'bd',
        ['version'],
        error as Error
      );
    }
  }

  /**
   * Execute a bd command with validated arguments
   *
   * @param args - Command arguments (validated and sanitized)
   * @returns Command output
   */
  async execBd(args: string[], skipCache = false): Promise<BdResult<string>> {
    const startTime = Date.now();

    // Validate all arguments
    const validatedArgs = this.validateAndSanitizeArgs(args);

    // Validate subcommand is allowed
    const subcommand = validatedArgs[0];
    if (subcommand && !ALLOWED_BD_COMMANDS.has(subcommand)) {
      throw new BdBridgeError(
        `Command not allowed: ${subcommand}`,
        'INVALID_ARGUMENT',
        'bd',
        validatedArgs
      );
    }

    // Check cache for cacheable commands
    const cacheKey = hashArgs(validatedArgs);
    const isCacheable = !skipCache && subcommand && BdBridge.CACHEABLE_COMMANDS.has(subcommand);
    const isStatic = subcommand && BdBridge.STATIC_COMMANDS.has(subcommand);

    if (isCacheable) {
      const cached = staticCache.get(cacheKey) as BdResult<string> | undefined;
      if (cached) {
        this.logger.debug('Cache hit for bd command', { command: subcommand });
        return {
          ...cached,
          durationMs: 0, // Cached result
        };
      }
    }

    // Use deduplication for concurrent identical calls
    return execDedup.dedupe(cacheKey, async () => {
      try {
        this.logger.debug('Executing bd command', {
          command: 'bd',
          args: validatedArgs,
        });

        const { stdout, stderr } = await execFileAsync(
          this.config.bdPath,
          validatedArgs,
          {
            cwd: this.config.cwd,
            env: this.config.env,
            timeout: this.config.timeout,
            maxBuffer: this.config.maxBuffer,
            shell: false, // CRITICAL: Never use shell
            windowsHide: true,
          }
        );

        const durationMs = Date.now() - startTime;

        if (stderr && stderr.trim()) {
          this.logger.warn('bd stderr output', { stderr });
        }

        const result: BdResult<string> = {
          success: true,
          data: stdout.trim(),
          command: 'bd',
          args: validatedArgs,
          durationMs,
        };

        // Cache successful results
        if (isCacheable && result.success) {
          staticCache.set(cacheKey, result);
        }

        return result;
      } catch (error: unknown) {
        const durationMs = Date.now() - startTime;
        const err = error as NodeJS.ErrnoException & {
          killed?: boolean;
          stdout?: string;
          stderr?: string;
        };

        if (err.killed) {
          throw new BdBridgeError(
            'Command execution timed out',
            'TIMEOUT',
            'bd',
            validatedArgs
          );
        }

        if (err.code === 'ENOENT') {
          throw new BdBridgeError(
            `bd executable not found at: ${this.config.bdPath}`,
            'COMMAND_NOT_FOUND',
            'bd',
            validatedArgs
          );
        }

        return {
          success: false,
          error: err.stderr || err.message,
          command: 'bd',
          args: validatedArgs,
          durationMs,
        };
      }
    });
  }

  /**
   * Execute bd command with streaming output
   */
  execBdStreaming(args: string[]): BdStreamResult {
    const startTime = Date.now();

    // Validate all arguments
    const validatedArgs = this.validateAndSanitizeArgs(args);

    // Validate subcommand is allowed
    const subcommand = validatedArgs[0];
    if (subcommand && !ALLOWED_BD_COMMANDS.has(subcommand)) {
      throw new BdBridgeError(
        `Command not allowed: ${subcommand}`,
        'INVALID_ARGUMENT',
        'bd',
        validatedArgs
      );
    }

    this.logger.debug('Executing bd command (streaming)', {
      command: 'bd',
      args: validatedArgs,
    });

    const childProcess = spawn(this.config.bdPath, validatedArgs, {
      cwd: this.config.cwd,
      env: this.config.env,
      timeout: this.config.timeout,
      shell: false, // CRITICAL: Never use shell
      windowsHide: true,
    });

    const promise = new Promise<BdResult<string>>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        const durationMs = Date.now() - startTime;
        if (code === 0) {
          resolve({
            success: true,
            data: stdout.trim(),
            command: 'bd',
            args: validatedArgs,
            durationMs,
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
            command: 'bd',
            args: validatedArgs,
            durationMs,
          });
        }
      });

      childProcess.on('error', (error) => {
        reject(new BdBridgeError(
          error.message,
          'EXECUTION_FAILED',
          'bd',
          validatedArgs
        ));
      });
    });

    return {
      process: childProcess,
      stdout: childProcess.stdout,
      stderr: childProcess.stderr,
      promise,
    };
  }

  /**
   * Parse JSONL output from bd command into Bead array
   *
   * @param output - JSONL formatted output
   * @returns Array of parsed and validated beads
   */
  parseBdOutput(output: string): Bead[] {
    if (!output || output.trim() === '') {
      return [];
    }

    // Check parsed cache first
    const cacheKey = hashArgs([output]);
    const cached = parsedCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const lines = output.trim().split('\n');
    const beads: Bead[] = [];
    const errors: Array<{ line: number; error: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        const validated = BeadSchema.parse(parsed);
        beads.push(validated);

        // Also cache individual beads
        singleBeadCache.set(validated.id, validated);
      } catch (error) {
        errors.push({
          line: i + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length > 0) {
      this.logger.warn('Some beads failed to parse', {
        totalLines: lines.length,
        parsed: beads.length,
        errors: errors.length,
        firstErrors: errors.slice(0, 3),
      });
    }

    // Cache the parsed result
    parsedCache.set(cacheKey, beads);

    return beads;
  }

  /**
   * Parse single bead from JSON output
   */
  parseSingleBead(output: string): Bead {
    if (!output || output.trim() === '') {
      throw new BdBridgeError(
        'Empty output from bd command',
        'INVALID_OUTPUT'
      );
    }

    try {
      const parsed = JSON.parse(output);
      return BeadSchema.parse(parsed);
    } catch (error) {
      throw new BdBridgeError(
        'Failed to parse bead output',
        'PARSE_ERROR',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * List beads with optional query parameters
   */
  async listBeads(query?: BeadQuery): Promise<Bead[]> {
    this.ensureInitialized();

    const args = ['list', '--format', 'jsonl'];

    if (query?.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      for (const type of types) {
        args.push('--type', type);
      }
    }

    if (query?.threadId) {
      args.push('--thread', SafeStringSchema.parse(query.threadId));
    }

    if (query?.agentId) {
      args.push('--agent', SafeStringSchema.parse(query.agentId));
    }

    if (query?.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        args.push('--tag', SafeStringSchema.parse(tag));
      }
    }

    if (query?.after) {
      args.push('--after', query.after);
    }

    if (query?.before) {
      args.push('--before', query.before);
    }

    if (query?.limit !== undefined) {
      args.push('--limit', String(Math.min(query.limit, 10000)));
    }

    if (query?.offset !== undefined) {
      args.push('--offset', String(query.offset));
    }

    if (query?.sortBy) {
      args.push('--sort', query.sortBy);
    }

    if (query?.sortOrder) {
      args.push('--order', query.sortOrder);
    }

    const result = await this.execBd(args);
    if (!result.success) {
      throw new BdBridgeError(
        result.error ?? 'Failed to list beads',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    return this.parseBdOutput(result.data ?? '');
  }

  /**
   * Get a single bead by ID
   */
  async getBead(beadId: string): Promise<Bead> {
    this.ensureInitialized();

    const validatedId = BeadIdSchema.parse(beadId);

    // Check single bead cache first
    const cached = singleBeadCache.get(validatedId);
    if (cached) {
      this.logger.debug('Bead cache hit', { beadId: validatedId });
      return cached;
    }

    const args = ['get', validatedId, '--format', 'json'];

    const result = await this.execBd(args);
    if (!result.success) {
      if (result.error?.includes('not found')) {
        throw new BdBridgeError(
          `Bead not found: ${beadId}`,
          'BEAD_NOT_FOUND',
          'bd',
          args
        );
      }
      throw new BdBridgeError(
        result.error ?? 'Failed to get bead',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    const bead = this.parseSingleBead(result.data ?? '');

    // Cache the result
    singleBeadCache.set(bead.id, bead);

    return bead;
  }

  /**
   * Create a new bead
   */
  async createBead(params: CreateBeadParams): Promise<Bead> {
    this.ensureInitialized();

    const args = [
      'create',
      '--type', params.type,
      '--content', SafeStringSchema.parse(params.content),
      '--format', 'json',
    ];

    if (params.parentId) {
      args.push('--parent', BeadIdSchema.parse(params.parentId));
    }

    if (params.threadId) {
      args.push('--thread', SafeStringSchema.parse(params.threadId));
    }

    if (params.agentId) {
      args.push('--agent', SafeStringSchema.parse(params.agentId));
    }

    if (params.tags && params.tags.length > 0) {
      for (const tag of params.tags) {
        args.push('--tag', SafeStringSchema.parse(tag));
      }
    }

    if (params.metadata) {
      args.push('--metadata', JSON.stringify(params.metadata));
    }

    const result = await this.execBd(args);
    if (!result.success) {
      throw new BdBridgeError(
        result.error ?? 'Failed to create bead',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    return this.parseSingleBead(result.data ?? '');
  }

  /**
   * Search beads with semantic query
   */
  async searchBeads(query: string, options?: {
    limit?: number;
    threshold?: number;
    type?: BeadType | BeadType[];
  }): Promise<Bead[]> {
    this.ensureInitialized();

    const args = [
      'search',
      SafeStringSchema.parse(query),
      '--format', 'jsonl',
    ];

    if (options?.limit !== undefined) {
      args.push('--limit', String(Math.min(options.limit, 1000)));
    }

    if (options?.threshold !== undefined) {
      args.push('--threshold', String(options.threshold));
    }

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      for (const type of types) {
        args.push('--type', type);
      }
    }

    const result = await this.execBd(args);
    if (!result.success) {
      throw new BdBridgeError(
        result.error ?? 'Bead search failed',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    return this.parseBdOutput(result.data ?? '');
  }

  /**
   * Export beads to JSONL format
   */
  async exportBeads(query?: BeadQuery): Promise<string> {
    this.ensureInitialized();

    const args = ['export', '--format', 'jsonl'];

    if (query?.threadId) {
      args.push('--thread', SafeStringSchema.parse(query.threadId));
    }

    if (query?.after) {
      args.push('--after', query.after);
    }

    if (query?.before) {
      args.push('--before', query.before);
    }

    const result = await this.execBd(args);
    if (!result.success) {
      throw new BdBridgeError(
        result.error ?? 'Export failed',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    return result.data ?? '';
  }

  /**
   * Get bead statistics
   */
  async getStats(): Promise<{
    totalBeads: number;
    beadsByType: Record<string, number>;
    totalThreads: number;
    oldestBead?: string;
    newestBead?: string;
    storageSize?: number;
  }> {
    this.ensureInitialized();

    const args = ['stats', '--format', 'json'];

    const result = await this.execBd(args);
    if (!result.success) {
      throw new BdBridgeError(
        result.error ?? 'Failed to get stats',
        'EXECUTION_FAILED',
        'bd',
        args
      );
    }

    try {
      return JSON.parse(result.data ?? '{}');
    } catch {
      throw new BdBridgeError(
        'Failed to parse stats output',
        'PARSE_ERROR',
        'bd',
        args
      );
    }
  }

  /**
   * Validate and sanitize command arguments
   */
  private validateAndSanitizeArgs(args: string[]): string[] {
    return args.map((arg, index) => {
      try {
        return BdArgumentSchema.parse(arg);
      } catch (error) {
        throw new BdBridgeError(
          `Invalid argument at index ${index}: ${arg}`,
          'VALIDATION_ERROR',
          'bd',
          args,
          error as Error
        );
      }
    });
  }

  /**
   * Ensure bridge is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new BdBridgeError(
        'Beads bridge not initialized. Call initialize() first.',
        'EXECUTION_FAILED'
      );
    }
  }

  /**
   * Check if bridge is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<BdBridgeConfig>> {
    return { ...this.config };
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats(): {
    beadQueryCache: { entries: number; sizeBytes: number };
    singleBeadCache: { entries: number; sizeBytes: number };
    staticCache: { entries: number; sizeBytes: number };
    parsedCache: { entries: number; sizeBytes: number };
  } {
    return {
      beadQueryCache: beadQueryCache.stats(),
      singleBeadCache: singleBeadCache.stats(),
      staticCache: staticCache.stats(),
      parsedCache: parsedCache.stats(),
    };
  }

  /**
   * Clear all caches (useful for testing or memory pressure)
   */
  clearCaches(): void {
    beadQueryCache.clear();
    singleBeadCache.clear();
    staticCache.clear();
    parsedCache.clear();
  }

  /**
   * Invalidate cache for a specific bead (after create/update/delete)
   */
  invalidateBeadCache(beadId: string): void {
    singleBeadCache.delete(beadId);
    // Also clear query caches since they may contain stale data
    beadQueryCache.clear();
    parsedCache.clear();
  }
}

/**
 * Create a new Beads bridge instance
 */
export function createBdBridge(config?: BdBridgeConfig, logger?: BdLogger): BdBridge {
  return new BdBridge(config, logger);
}

// Export schemas for external use
export {
  SafeStringSchema,
  IdentifierSchema,
  BeadIdSchema,
  BeadTypeSchema,
  BdArgumentSchema,
};

export default BdBridge;

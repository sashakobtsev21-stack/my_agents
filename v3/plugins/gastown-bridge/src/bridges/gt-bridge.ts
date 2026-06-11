/**
 * Gas Town CLI Bridge
 *
 * Provides a secure wrapper around the `gt` (Gas Town) CLI tool.
 * Implements command execution with proper input sanitization,
 * argument validation, and error handling.
 *
 * Security Features:
 * - All inputs validated with Zod schemas
 * - No shell execution (uses execFile)
 * - Command allowlist enforcement
 * - Argument sanitization
 *
 * @module v3/plugins/gastown-bridge/bridges/gt-bridge
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';


// Defs extracted into ./gt-bridge-defs.ts during campaign-2 wave 32
// (W238). Re-export the original public surface; internals private.
export { GtBridgeError } from './gt-bridge-defs.js';
export type {
  GtBridgeConfig,
  GasEstimate,
  TxStatus,
  NetworkStatus,
  GtResult,
  GtLogger,
  GtErrorCode,
} from './gt-bridge-defs.js';
import {
  ALLOWED_GT_COMMANDS,
  AddressSchema,
  GasLimitSchema,
  GasPriceSchema,
  GtArgumentSchema,
  GtBridgeError,
  IdentifierSchema,
  NetworkSchema,
  SafeStringSchema,
  TxHashSchema,
  defaultLogger,
  execDedup,
  execFileAsync,
  hashArgs,
  parsedCache,
  resultCache,
  staticCache,
} from './gt-bridge-defs.js';
import type {
  GasEstimate,
  GtBridgeConfig,
  GtLogger,
  GtResult,
  NetworkStatus,
  TxStatus,
} from './gt-bridge-defs.js';

export class GtBridge {
  private config: Required<GtBridgeConfig>;
  private logger: GtLogger;
  private initialized = false;

  /** Commands that can be cached (read-only, no side effects) */
  private static readonly CACHEABLE_COMMANDS = new Set([
    'version',
    'status',
    'price',
    'decode',
    'help',
    'config',
  ]);

  /** Commands that should use longer cache (static data) */
  private static readonly STATIC_COMMANDS = new Set([
    'version',
    'help',
    'decode',
  ]);

  constructor(config?: GtBridgeConfig, logger?: GtLogger) {
    this.config = {
      gtPath: config?.gtPath ?? 'gt',
      cwd: config?.cwd ?? process.cwd(),
      timeout: config?.timeout ?? 30000,
      maxBuffer: config?.maxBuffer ?? 10 * 1024 * 1024,
      env: config?.env ?? process.env,
      defaultNetwork: config?.defaultNetwork ?? 'mainnet',
    };
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Initialize the bridge and verify gt is available
   */
  async initialize(): Promise<void> {
    try {
      const result = await this.execGt(['version']);
      if (!result.success) {
        throw new GtBridgeError(
          'Failed to verify gt installation',
          'COMMAND_NOT_FOUND',
          'gt',
          ['version']
        );
      }
      this.initialized = true;
      this.logger.info('Gas Town bridge initialized', {
        gtPath: this.config.gtPath,
        version: result.data,
      });
    } catch (error) {
      if (error instanceof GtBridgeError) throw error;
      throw new GtBridgeError(
        'Failed to initialize Gas Town bridge',
        'COMMAND_NOT_FOUND',
        'gt',
        ['version'],
        error as Error
      );
    }
  }

  /**
   * Execute a gt command with validated arguments
   *
   * @param args - Command arguments (validated and sanitized)
   * @returns Command output
   */
  async execGt(args: string[], skipCache = false): Promise<GtResult<string>> {
    const startTime = Date.now();

    // Validate all arguments
    const validatedArgs = this.validateAndSanitizeArgs(args);

    // Validate subcommand is allowed
    const subcommand = validatedArgs[0];
    if (subcommand && !ALLOWED_GT_COMMANDS.has(subcommand)) {
      throw new GtBridgeError(
        `Command not allowed: ${subcommand}`,
        'INVALID_ARGUMENT',
        'gt',
        validatedArgs
      );
    }

    // Check cache for cacheable commands
    const cacheKey = hashArgs(validatedArgs);
    const isCacheable = !skipCache && subcommand && GtBridge.CACHEABLE_COMMANDS.has(subcommand);
    const isStatic = subcommand && GtBridge.STATIC_COMMANDS.has(subcommand);

    if (isCacheable) {
      const cached = isStatic
        ? staticCache.get(cacheKey) as GtResult<string> | undefined
        : resultCache.get(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for gt command', { command: subcommand });
        return {
          ...cached,
          durationMs: 0, // Cached result
        };
      }
    }

    // Use deduplication for concurrent identical calls
    return execDedup.dedupe(cacheKey, async () => {
      try {
        this.logger.debug('Executing gt command', {
          command: 'gt',
          args: validatedArgs,
        });

        const { stdout, stderr } = await execFileAsync(
          this.config.gtPath,
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
          this.logger.warn('gt stderr output', { stderr });
        }

        const result: GtResult<string> = {
          success: true,
          data: stdout.trim(),
          command: 'gt',
          args: validatedArgs,
          durationMs,
        };

        // Cache successful results
        if (isCacheable && result.success) {
          if (isStatic) {
            staticCache.set(cacheKey, result);
          } else {
            resultCache.set(cacheKey, result);
          }
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
          throw new GtBridgeError(
            'Command execution timed out',
            'TIMEOUT',
            'gt',
            validatedArgs
          );
        }

        if (err.code === 'ENOENT') {
          throw new GtBridgeError(
            `gt executable not found at: ${this.config.gtPath}`,
            'COMMAND_NOT_FOUND',
            'gt',
            validatedArgs
          );
        }

        return {
          success: false,
          error: err.stderr || err.message,
          command: 'gt',
          args: validatedArgs,
          durationMs,
        };
      }
    });
  }

  /**
   * Parse JSON output from gt command
   *
   * @param output - Raw command output
   * @returns Parsed JSON object
   */
  parseGtOutput<T>(output: string): T {
    if (!output || output.trim() === '') {
      throw new GtBridgeError(
        'Empty output from gt command',
        'INVALID_OUTPUT'
      );
    }

    // Check parsed cache first
    const cacheKey = hashArgs([output]);
    const cached = parsedCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as T;
    }

    try {
      // Try to parse as JSON
      const parsed = JSON.parse(output) as T;
      parsedCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      // If not JSON, try to extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as T;
          parsedCache.set(cacheKey, parsed);
          return parsed;
        } catch {
          throw new GtBridgeError(
            'Failed to parse gt output as JSON',
            'INVALID_OUTPUT'
          );
        }
      }

      throw new GtBridgeError(
        'Output is not valid JSON',
        'INVALID_OUTPUT'
      );
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: {
    to: string;
    data?: string;
    value?: string;
    from?: string;
    network?: z.infer<typeof NetworkSchema>;
  }): Promise<GasEstimate> {
    this.ensureInitialized();

    // Validate parameters
    const validatedTo = AddressSchema.parse(params.to);
    const network = params.network ?? this.config.defaultNetwork;

    const args = ['estimate', '--to', validatedTo, '--network', network, '--json'];

    if (params.data) {
      const validatedData = SafeStringSchema.parse(params.data);
      args.push('--data', validatedData);
    }

    if (params.value) {
      const validatedValue = SafeStringSchema.parse(params.value);
      args.push('--value', validatedValue);
    }

    if (params.from) {
      const validatedFrom = AddressSchema.parse(params.from);
      args.push('--from', validatedFrom);
    }

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Gas estimation failed',
        'EXECUTION_FAILED',
        'gt',
        args
      );
    }

    return this.parseGtOutput<GasEstimate>(result.data);
  }

  /**
   * Get transaction status
   */
  async getTxStatus(txHash: string, network?: z.infer<typeof NetworkSchema>): Promise<TxStatus> {
    this.ensureInitialized();

    const validatedHash = TxHashSchema.parse(txHash);
    const args = [
      'tx',
      'status',
      validatedHash,
      '--network',
      network ?? this.config.defaultNetwork,
      '--json',
    ];

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Failed to get transaction status',
        'EXECUTION_FAILED',
        'gt',
        args
      );
    }

    return this.parseGtOutput<TxStatus>(result.data);
  }

  /**
   * Get network status
   */
  async getNetworkStatus(network?: z.infer<typeof NetworkSchema>): Promise<NetworkStatus> {
    this.ensureInitialized();

    const args = [
      'network',
      'status',
      '--network',
      network ?? this.config.defaultNetwork,
      '--json',
    ];

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Failed to get network status',
        'NETWORK_ERROR',
        'gt',
        args
      );
    }

    return this.parseGtOutput<NetworkStatus>(result.data);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(network?: z.infer<typeof NetworkSchema>): Promise<{
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    baseFee?: string;
  }> {
    this.ensureInitialized();

    const args = [
      'price',
      '--network',
      network ?? this.config.defaultNetwork,
      '--json',
    ];

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Failed to get gas price',
        'EXECUTION_FAILED',
        'gt',
        args
      );
    }

    return this.parseGtOutput(result.data);
  }

  /**
   * Simulate a transaction
   */
  async simulate(params: {
    to: string;
    data: string;
    value?: string;
    from?: string;
    network?: z.infer<typeof NetworkSchema>;
    blockNumber?: number;
  }): Promise<{
    success: boolean;
    returnData?: string;
    gasUsed?: number;
    logs?: unknown[];
    error?: string;
  }> {
    this.ensureInitialized();

    const validatedTo = AddressSchema.parse(params.to);
    const validatedData = SafeStringSchema.parse(params.data);
    const network = params.network ?? this.config.defaultNetwork;

    const args = [
      'simulate',
      '--to', validatedTo,
      '--data', validatedData,
      '--network', network,
      '--json',
    ];

    if (params.value) {
      args.push('--value', SafeStringSchema.parse(params.value));
    }

    if (params.from) {
      args.push('--from', AddressSchema.parse(params.from));
    }

    if (params.blockNumber !== undefined) {
      args.push('--block', String(params.blockNumber));
    }

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Transaction simulation failed',
        'EXECUTION_FAILED',
        'gt',
        args
      );
    }

    return this.parseGtOutput(result.data);
  }

  /**
   * Decode transaction data
   */
  async decode(data: string, abi?: string): Promise<{
    method: string;
    args: unknown[];
    signature: string;
  }> {
    this.ensureInitialized();

    const validatedData = SafeStringSchema.parse(data);
    const args = ['decode', validatedData, '--json'];

    if (abi) {
      const validatedAbi = SafeStringSchema.parse(abi);
      args.push('--abi', validatedAbi);
    }

    const result = await this.execGt(args);
    if (!result.success || !result.data) {
      throw new GtBridgeError(
        result.error ?? 'Failed to decode transaction data',
        'EXECUTION_FAILED',
        'gt',
        args
      );
    }

    return this.parseGtOutput(result.data);
  }

  /**
   * Validate and sanitize command arguments
   */
  private validateAndSanitizeArgs(args: string[]): string[] {
    return args.map((arg, index) => {
      try {
        return GtArgumentSchema.parse(arg);
      } catch (error) {
        throw new GtBridgeError(
          `Invalid argument at index ${index}: ${arg}`,
          'VALIDATION_ERROR',
          'gt',
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
      throw new GtBridgeError(
        'Gas Town bridge not initialized. Call initialize() first.',
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
  getConfig(): Readonly<Required<GtBridgeConfig>> {
    return { ...this.config };
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats(): {
    resultCache: { entries: number; sizeBytes: number };
    staticCache: { entries: number; sizeBytes: number };
    parsedCache: { entries: number; sizeBytes: number };
  } {
    return {
      resultCache: resultCache.stats(),
      staticCache: staticCache.stats(),
      parsedCache: parsedCache.stats(),
    };
  }

  /**
   * Clear all caches (useful for testing or memory pressure)
   */
  clearCaches(): void {
    resultCache.clear();
    staticCache.clear();
    parsedCache.clear();
  }
}

/**
 * Create a new Gas Town bridge instance
 */
export function createGtBridge(config?: GtBridgeConfig, logger?: GtLogger): GtBridge {
  return new GtBridge(config, logger);
}

// Export schemas for external use
export {
  SafeStringSchema,
  IdentifierSchema,
  GasPriceSchema,
  GasLimitSchema,
  TxHashSchema,
  AddressSchema,
  NetworkSchema,
  GtArgumentSchema,
};

export default GtBridge;

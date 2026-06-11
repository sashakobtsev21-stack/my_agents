/**
 * Gas Town Bridge Plugin - Typed Error Classes
 *
 * Provides a hierarchy of typed error classes for the Gas Town Bridge Plugin:
 * - GasTownError: Base error class for all Gas Town errors
 * - BeadsError: Errors related to bead operations
 * - ValidationError: Input validation failures
 * - CLIExecutionError: CLI command execution failures
 *
 * All errors include:
 * - Typed error codes for programmatic handling
 * - Stack traces for debugging
 * - Contextual information about the failure
 *
 * @module gastown-bridge/errors
 * @version 0.1.0
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Gas Town error codes enumeration
 */
export const GasTownErrorCode = {
  // General errors
  UNKNOWN: 'GT_UNKNOWN',
  INITIALIZATION_FAILED: 'GT_INITIALIZATION_FAILED',
  NOT_INITIALIZED: 'GT_NOT_INITIALIZED',
  CONFIGURATION_ERROR: 'GT_CONFIGURATION_ERROR',

  // Validation errors
  VALIDATION_FAILED: 'GT_VALIDATION_FAILED',
  INVALID_INPUT: 'GT_INVALID_INPUT',
  INVALID_BEAD_ID: 'GT_INVALID_BEAD_ID',
  INVALID_FORMULA_NAME: 'GT_INVALID_FORMULA_NAME',
  INVALID_CONVOY_ID: 'GT_INVALID_CONVOY_ID',
  INVALID_ARGUMENTS: 'GT_INVALID_ARGUMENTS',
  COMMAND_INJECTION_DETECTED: 'GT_COMMAND_INJECTION_DETECTED',
  PATH_TRAVERSAL_DETECTED: 'GT_PATH_TRAVERSAL_DETECTED',

  // Beads errors
  BEAD_NOT_FOUND: 'GT_BEAD_NOT_FOUND',
  BEAD_CREATE_FAILED: 'GT_BEAD_CREATE_FAILED',
  BEAD_UPDATE_FAILED: 'GT_BEAD_UPDATE_FAILED',
  BEAD_DELETE_FAILED: 'GT_BEAD_DELETE_FAILED',
  BEAD_PARSE_FAILED: 'GT_BEAD_PARSE_FAILED',

  // Formula errors
  FORMULA_NOT_FOUND: 'GT_FORMULA_NOT_FOUND',
  FORMULA_PARSE_FAILED: 'GT_FORMULA_PARSE_FAILED',
  FORMULA_COOK_FAILED: 'GT_FORMULA_COOK_FAILED',
  FORMULA_INVALID_TYPE: 'GT_FORMULA_INVALID_TYPE',

  // Convoy errors
  CONVOY_NOT_FOUND: 'GT_CONVOY_NOT_FOUND',
  CONVOY_CREATE_FAILED: 'GT_CONVOY_CREATE_FAILED',

  // CLI errors
  CLI_NOT_FOUND: 'GT_CLI_NOT_FOUND',
  CLI_TIMEOUT: 'GT_CLI_TIMEOUT',
  CLI_EXECUTION_FAILED: 'GT_CLI_EXECUTION_FAILED',
  CLI_INVALID_OUTPUT: 'GT_CLI_INVALID_OUTPUT',

  // WASM errors
  WASM_NOT_AVAILABLE: 'GT_WASM_NOT_AVAILABLE',
  WASM_EXECUTION_FAILED: 'GT_WASM_EXECUTION_FAILED',

  // Sync errors
  SYNC_FAILED: 'GT_SYNC_FAILED',
  SYNC_CONFLICT: 'GT_SYNC_CONFLICT',

  // Graph errors
  DEPENDENCY_CYCLE: 'GT_DEPENDENCY_CYCLE',
  GRAPH_ERROR: 'GT_GRAPH_ERROR',
} as const;

export type GasTownErrorCodeType = (typeof GasTownErrorCode)[keyof typeof GasTownErrorCode];

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all Gas Town Bridge errors
 *
 * @example
 * ```typescript
 * throw new GasTownError(
 *   'Failed to initialize plugin',
 *   GasTownErrorCode.INITIALIZATION_FAILED,
 *   { configPath: '/path/to/config' }
 * );
 * ```
 */
export class GasTownError extends Error {
  /** Error code for programmatic handling */
  readonly code: GasTownErrorCodeType;

  /** Timestamp when error occurred */
  readonly timestamp: Date;

  /** Additional context about the error */
  readonly context?: Record<string, unknown>;

  /** Original error if this wraps another error */
  readonly cause?: Error;

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.UNKNOWN,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'GasTownError';
    this.code = code;
    this.timestamp = new Date();
    this.context = context;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GasTownError);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  /**
   * Create a human-readable string representation
   */
  toString(): string {
    let str = `[${this.code}] ${this.message}`;
    if (this.context) {
      str += ` | Context: ${JSON.stringify(this.context)}`;
    }
    if (this.cause) {
      str += ` | Caused by: ${this.cause.message}`;
    }
    return str;
  }
}


// The specific error subclasses were extracted into
// ./errors-subclasses.ts during campaign-2 wave 91 (W297). 'export *'
// keeps the surface byte-identical; the type guards below reference the
// subclasses.
export * from './errors-subclasses.js';
import {
  BeadsError,
  CLIExecutionError,
  ValidationError,
} from './errors-subclasses.js';

export function isGasTownError(error: unknown): error is GasTownError {
  return error instanceof GasTownError;
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for CLIExecutionError
 */
export function isCLIExecutionError(error: unknown): error is CLIExecutionError {
  return error instanceof CLIExecutionError;
}

/**
 * Type guard for BeadsError
 */
export function isBeadsError(error: unknown): error is BeadsError {
  return error instanceof BeadsError;
}

/**
 * Wrap an unknown error as a GasTownError
 */
export function wrapError(error: unknown, code?: GasTownErrorCodeType): GasTownError {
  if (error instanceof GasTownError) {
    return error;
  }

  if (error instanceof Error) {
    return new GasTownError(
      error.message,
      code ?? GasTownErrorCode.UNKNOWN,
      undefined,
      error
    );
  }

  return new GasTownError(
    String(error),
    code ?? GasTownErrorCode.UNKNOWN
  );
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

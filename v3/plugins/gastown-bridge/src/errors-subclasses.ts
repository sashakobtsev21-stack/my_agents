/**
 * Gas Town Bridge — specific error subclasses
 *
 * BeadsError/ValidationError/CLIExecutionError/FormulaError/ConvoyError
 * + ValidationConstraint. Extracted verbatim from errors.ts (lines
 * 159-643) during campaign-2 wave 91 (W297). errors.ts stays the barrel
 * (class-decl back-import of GasTownError — W208 static-cycle shape).
 */

import { GasTownError, GasTownErrorCode } from './errors.js';
import type { GasTownErrorCodeType } from './errors.js';

// ============================================================================
// Beads Error Class
// ============================================================================

/**
 * Error class for bead-related operations
 *
 * @example
 * ```typescript
 * throw new BeadsError(
 *   'Bead not found',
 *   GasTownErrorCode.BEAD_NOT_FOUND,
 *   { beadId: 'gt-abc12' }
 * );
 * ```
 */
export class BeadsError extends GasTownError {
  /** Bead ID if applicable */
  readonly beadId?: string;

  /** Operation being performed */
  readonly operation?: string;

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.BEAD_NOT_FOUND,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, context, cause);
    this.name = 'BeadsError';

    // Extract beadId from context if present
    if (context?.beadId && typeof context.beadId === 'string') {
      this.beadId = context.beadId;
    }
    if (context?.operation && typeof context.operation === 'string') {
      this.operation = context.operation;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BeadsError);
    }
  }

  /**
   * Create a BeadsError for a not found scenario
   */
  static notFound(beadId: string): BeadsError {
    return new BeadsError(
      `Bead not found: ${beadId}`,
      GasTownErrorCode.BEAD_NOT_FOUND,
      { beadId, operation: 'get' }
    );
  }

  /**
   * Create a BeadsError for a create failure
   */
  static createFailed(reason: string, cause?: Error): BeadsError {
    return new BeadsError(
      `Failed to create bead: ${reason}`,
      GasTownErrorCode.BEAD_CREATE_FAILED,
      { operation: 'create' },
      cause
    );
  }

  /**
   * Create a BeadsError for a parse failure
   */
  static parseFailed(rawOutput: string, cause?: Error): BeadsError {
    // Truncate raw output for safety
    const truncated = rawOutput.length > 200 ? rawOutput.slice(0, 200) + '...' : rawOutput;
    return new BeadsError(
      'Failed to parse bead output',
      GasTownErrorCode.BEAD_PARSE_FAILED,
      { operation: 'parse', outputLength: rawOutput.length, outputPreview: truncated },
      cause
    );
  }
}

// ============================================================================
// Validation Error Class
// ============================================================================

/**
 * Validation constraint that was violated
 */
export interface ValidationConstraint {
  /** Field or parameter that failed validation */
  field: string;
  /** Expected constraint (e.g., "alphanumeric", "max-length:64") */
  constraint: string;
  /** Actual value (sanitized for logging) */
  actual?: string;
  /** Expected value or pattern */
  expected?: string;
}

/**
 * Error class for input validation failures
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'Invalid bead ID format',
 *   GasTownErrorCode.INVALID_BEAD_ID,
 *   [{ field: 'beadId', constraint: 'alphanumeric', actual: 'abc;rm -rf' }]
 * );
 * ```
 */
export class ValidationError extends GasTownError {
  /** Validation constraints that were violated */
  readonly constraints: ValidationConstraint[];

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.VALIDATION_FAILED,
    constraints: ValidationConstraint[] = [],
    cause?: Error
  ) {
    super(message, code, { constraints }, cause);
    this.name = 'ValidationError';
    this.constraints = constraints;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Create a ValidationError for an invalid bead ID
   */
  static invalidBeadId(beadId: string): ValidationError {
    // Sanitize the bead ID for safe logging
    const sanitized = beadId.replace(/[^\w\s-]/g, '?').slice(0, 32);
    return new ValidationError(
      'Invalid bead ID format',
      GasTownErrorCode.INVALID_BEAD_ID,
      [{
        field: 'beadId',
        constraint: 'alphanumeric with gt- prefix',
        actual: sanitized,
        expected: 'gt-{4-16 alphanumeric} or numeric',
      }]
    );
  }

  /**
   * Create a ValidationError for an invalid formula name
   */
  static invalidFormulaName(name: string): ValidationError {
    const sanitized = name.replace(/[^\w\s-]/g, '?').slice(0, 32);
    return new ValidationError(
      'Invalid formula name format',
      GasTownErrorCode.INVALID_FORMULA_NAME,
      [{
        field: 'formulaName',
        constraint: 'alphanumeric with dash/underscore, starting with letter',
        actual: sanitized,
        expected: '[a-zA-Z][a-zA-Z0-9_-]{0,63}',
      }]
    );
  }

  /**
   * Create a ValidationError for an invalid convoy ID
   */
  static invalidConvoyId(convoyId: string): ValidationError {
    const sanitized = convoyId.replace(/[^\w\s-]/g, '?').slice(0, 32);
    return new ValidationError(
      'Invalid convoy ID format',
      GasTownErrorCode.INVALID_CONVOY_ID,
      [{
        field: 'convoyId',
        constraint: 'UUID format',
        actual: sanitized,
        expected: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      }]
    );
  }

  /**
   * Create a ValidationError for command injection attempt
   */
  static commandInjection(field: string, detected: string): ValidationError {
    // Never include the actual malicious content
    return new ValidationError(
      `Command injection detected in ${field}`,
      GasTownErrorCode.COMMAND_INJECTION_DETECTED,
      [{
        field,
        constraint: 'no shell metacharacters',
        actual: '[REDACTED]',
        expected: 'safe characters only',
      }]
    );
  }

  /**
   * Create a ValidationError for path traversal attempt
   */
  static pathTraversal(field: string): ValidationError {
    return new ValidationError(
      `Path traversal detected in ${field}`,
      GasTownErrorCode.PATH_TRAVERSAL_DETECTED,
      [{
        field,
        constraint: 'no parent directory references',
        actual: '[REDACTED]',
        expected: 'safe path characters only',
      }]
    );
  }

  /**
   * Combine multiple validation errors
   */
  static combine(errors: ValidationError[]): ValidationError {
    const allConstraints = errors.flatMap(e => e.constraints);
    return new ValidationError(
      `Multiple validation errors: ${errors.map(e => e.message).join('; ')}`,
      GasTownErrorCode.VALIDATION_FAILED,
      allConstraints
    );
  }
}

// ============================================================================
// CLI Execution Error Class
// ============================================================================

/**
 * Error class for CLI command execution failures
 *
 * @example
 * ```typescript
 * throw new CLIExecutionError(
 *   'gt command failed',
 *   GasTownErrorCode.CLI_EXECUTION_FAILED,
 *   { command: 'gt', args: ['beads', 'list'], exitCode: 1, stderr: 'error message' }
 * );
 * ```
 */
export class CLIExecutionError extends GasTownError {
  /** CLI command that was executed */
  readonly command: string;

  /** Arguments passed to the command (sanitized) */
  readonly args: string[];

  /** Exit code from the process */
  readonly exitCode?: number;

  /** Standard error output (truncated) */
  readonly stderr?: string;

  /** Execution duration in milliseconds */
  readonly durationMs?: number;

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.CLI_EXECUTION_FAILED,
    details: {
      command: string;
      args?: string[];
      exitCode?: number;
      stderr?: string;
      durationMs?: number;
    },
    cause?: Error
  ) {
    // Sanitize args for context
    const sanitizedArgs = (details.args ?? []).map(arg =>
      arg.length > 50 ? arg.slice(0, 50) + '...' : arg
    );

    // Truncate stderr for safety
    const truncatedStderr = details.stderr && details.stderr.length > 500
      ? details.stderr.slice(0, 500) + '...'
      : details.stderr;

    super(message, code, {
      command: details.command,
      args: sanitizedArgs,
      exitCode: details.exitCode,
      durationMs: details.durationMs,
    }, cause);

    this.name = 'CLIExecutionError';
    this.command = details.command;
    this.args = sanitizedArgs;
    this.exitCode = details.exitCode;
    this.stderr = truncatedStderr;
    this.durationMs = details.durationMs;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CLIExecutionError);
    }
  }

  /**
   * Create a CLIExecutionError for command not found
   */
  static notFound(command: string): CLIExecutionError {
    return new CLIExecutionError(
      `CLI command not found: ${command}`,
      GasTownErrorCode.CLI_NOT_FOUND,
      { command }
    );
  }

  /**
   * Create a CLIExecutionError for timeout
   */
  static timeout(command: string, args: string[], timeoutMs: number): CLIExecutionError {
    return new CLIExecutionError(
      `CLI command timed out after ${timeoutMs}ms`,
      GasTownErrorCode.CLI_TIMEOUT,
      { command, args, durationMs: timeoutMs }
    );
  }

  /**
   * Create a CLIExecutionError for execution failure
   */
  static failed(
    command: string,
    args: string[],
    exitCode: number,
    stderr: string,
    durationMs?: number
  ): CLIExecutionError {
    return new CLIExecutionError(
      `CLI command failed with exit code ${exitCode}`,
      GasTownErrorCode.CLI_EXECUTION_FAILED,
      { command, args, exitCode, stderr, durationMs }
    );
  }

  /**
   * Create a CLIExecutionError for invalid output
   */
  static invalidOutput(command: string, reason: string): CLIExecutionError {
    return new CLIExecutionError(
      `CLI command produced invalid output: ${reason}`,
      GasTownErrorCode.CLI_INVALID_OUTPUT,
      { command }
    );
  }
}

// ============================================================================
// Formula Error Class
// ============================================================================

/**
 * Error class for formula-related operations
 */
export class FormulaError extends GasTownError {
  /** Formula name if applicable */
  readonly formulaName?: string;

  /** Formula type if applicable */
  readonly formulaType?: string;

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.FORMULA_PARSE_FAILED,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, context, cause);
    this.name = 'FormulaError';

    if (context?.formulaName && typeof context.formulaName === 'string') {
      this.formulaName = context.formulaName;
    }
    if (context?.formulaType && typeof context.formulaType === 'string') {
      this.formulaType = context.formulaType;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FormulaError);
    }
  }

  /**
   * Create a FormulaError for not found
   */
  static notFound(formulaName: string): FormulaError {
    return new FormulaError(
      `Formula not found: ${formulaName}`,
      GasTownErrorCode.FORMULA_NOT_FOUND,
      { formulaName }
    );
  }

  /**
   * Create a FormulaError for parse failure
   */
  static parseFailed(formulaName: string, reason: string, cause?: Error): FormulaError {
    return new FormulaError(
      `Failed to parse formula ${formulaName}: ${reason}`,
      GasTownErrorCode.FORMULA_PARSE_FAILED,
      { formulaName, parseError: reason },
      cause
    );
  }

  /**
   * Create a FormulaError for cook failure
   */
  static cookFailed(formulaName: string, reason: string, cause?: Error): FormulaError {
    return new FormulaError(
      `Failed to cook formula ${formulaName}: ${reason}`,
      GasTownErrorCode.FORMULA_COOK_FAILED,
      { formulaName, cookError: reason },
      cause
    );
  }
}

// ============================================================================
// Convoy Error Class
// ============================================================================

/**
 * Error class for convoy-related operations
 */
export class ConvoyError extends GasTownError {
  /** Convoy ID if applicable */
  readonly convoyId?: string;

  constructor(
    message: string,
    code: GasTownErrorCodeType = GasTownErrorCode.CONVOY_NOT_FOUND,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, context, cause);
    this.name = 'ConvoyError';

    if (context?.convoyId && typeof context.convoyId === 'string') {
      this.convoyId = context.convoyId;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConvoyError);
    }
  }

  /**
   * Create a ConvoyError for not found
   */
  static notFound(convoyId: string): ConvoyError {
    return new ConvoyError(
      `Convoy not found: ${convoyId}`,
      GasTownErrorCode.CONVOY_NOT_FOUND,
      { convoyId }
    );
  }

  /**
   * Create a ConvoyError for create failure
   */
  static createFailed(reason: string, cause?: Error): ConvoyError {
    return new ConvoyError(
      `Failed to create convoy: ${reason}`,
      GasTownErrorCode.CONVOY_CREATE_FAILED,
      { operation: 'create' },
      cause
    );
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Type guard for GasTownError
 */

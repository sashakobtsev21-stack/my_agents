/**
 * V3 Hooks System Types
 *
 * Core type definitions for the hooks system including:
 * - Hook events and priorities
 * - Hook handlers and context
 * - Execution results
 * - Daemon configuration
 * - Statusline data
 */

/**
 * Hook event types
 */

// Split into ./types-core.ts + ./types-extended.ts during campaign-2 wave W301.
export * from './types-core.js';
export * from './types-extended.js';

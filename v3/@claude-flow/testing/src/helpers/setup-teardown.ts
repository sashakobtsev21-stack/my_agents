/**
 * @claude-flow/testing - Setup & Teardown Helpers
 *
 * Global setup and teardown utilities for V3 module testing.
 * Provides test isolation, resource cleanup, and environment management.
 */

/**
 * Setup context for managing test resources
 */

// Split into ./setup-teardown-core.ts + ./setup-teardown-extended.ts during campaign-2 wave W307.
export * from './setup-teardown-core.js';
export * from './setup-teardown-extended.js';

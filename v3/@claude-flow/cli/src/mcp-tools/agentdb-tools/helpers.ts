/**
 * Shared validation helpers + size caps + the lazy memory-bridge loader
 * for the AgentDB MCP tools. Used by every tool object in the suite.
 *
 * Extracted from agentdb-tools.ts (W120, P3.15 cut #1).
 */

export const MAX_STRING_LENGTH = 100_000; // 100KB max for any string input
export const MAX_BATCH_SIZE = 500;        // Max entries per batch operation
export const MAX_TOP_K = 100;             // Max results per query

export function validateString(value: unknown, name: string, maxLen = MAX_STRING_LENGTH): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.length > maxLen) return null;
  return value;
}

export function validatePositiveInt(value: unknown, defaultVal: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultVal;
  const n = Math.floor(value);
  return n > 0 ? Math.min(n, max) : defaultVal;
}

export function validateScore(value: unknown, defaultVal: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultVal;
  return Math.max(0, Math.min(1, value));
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Strip filesystem paths from error messages
    return error.message.replace(/\/[^\s:]+\//g, '<path>/').substring(0, 500);
  }
  return 'Internal error';
}

// Lazy-cached bridge module
let bridgeModule: typeof import('../../memory/memory-bridge.js') | null = null;
export async function getBridge() {
  if (!bridgeModule) {
    bridgeModule = await import('../../memory/memory-bridge.js');
  }
  return bridgeModule;
}

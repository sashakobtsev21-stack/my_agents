/**
 * chaos-inject.ts - Chaos failure injection MCP tool handler
 *
 * Injects controlled failures for resilience testing including network
 * latency, process termination, resource exhaustion, and more.
 * Includes dryRun safety mode.
 */

import { z } from 'zod';

// Input schema for chaos-inject tool

// Split into ./chaos-inject-defs.ts + ./chaos-inject-handler.ts during campaign-2 wave W306.
export * from './chaos-inject-defs.js';
export * from './chaos-inject-handler.js';

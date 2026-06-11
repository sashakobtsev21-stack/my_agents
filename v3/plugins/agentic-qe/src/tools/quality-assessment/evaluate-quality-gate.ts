/**
 * evaluate-quality-gate.ts - Quality gate evaluation MCP tool handler
 *
 * Evaluates quality gates against defined thresholds to determine
 * release readiness. Supports multiple metrics and custom gate configurations.
 */

import { z } from 'zod';

// Input schema for evaluate-quality-gate tool

// Split into ./evaluate-quality-gate-defs.ts + ./evaluate-quality-gate-handler.ts during campaign-2 wave W306.
export * from './evaluate-quality-gate-defs.js';
export * from './evaluate-quality-gate-handler.js';

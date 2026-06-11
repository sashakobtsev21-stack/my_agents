/**
 * calculate-risk.ts - Quality risk calculation MCP tool handler
 *
 * Calculates quality risk scores based on code complexity, test coverage,
 * change frequency, defect history, and other factors.
 */

import { z } from 'zod';

// Input schema for calculate-risk tool

// Split into ./calculate-risk-defs.ts + ./calculate-risk-handler.ts during campaign-2 wave W306.
export * from './calculate-risk-defs.js';
export * from './calculate-risk-handler.js';

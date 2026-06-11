/**
 * suggest-tests.ts - Coverage gap test suggestions MCP tool handler
 *
 * Analyzes existing code and coverage data to suggest tests that would
 * improve coverage in areas that matter most based on risk and complexity.
 */

import { z } from 'zod';

// Input schema for suggest-tests tool

// Split into ./suggest-tests-defs.ts + ./suggest-tests-handler.ts during campaign-2 wave W306.
export * from './suggest-tests-defs.js';
export * from './suggest-tests-handler.js';

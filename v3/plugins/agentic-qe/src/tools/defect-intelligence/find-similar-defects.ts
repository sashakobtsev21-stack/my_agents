/**
 * find-similar-defects.ts - Similar defect search MCP tool handler
 *
 * Searches for similar defects using semantic similarity, pattern matching,
 * and code structure analysis to help identify recurring issues.
 */

import { z } from 'zod';

// Input schema for find-similar-defects tool

// Split into ./find-similar-defects-defs.ts + ./find-similar-defects-handler.ts during campaign-2 wave W306.
export * from './find-similar-defects-defs.js';
export * from './find-similar-defects-handler.js';

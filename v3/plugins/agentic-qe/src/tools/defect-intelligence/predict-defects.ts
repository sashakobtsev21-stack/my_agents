/**
 * predict-defects.ts - ML-based defect prediction MCP tool handler
 *
 * Predicts potential defects using machine learning analysis of code
 * complexity, historical patterns, and semantic similarity to known defects.
 */

import { z } from 'zod';

// Input schema for predict-defects tool

// Split into ./predict-defects-defs.ts + ./predict-defects-handler.ts during campaign-2 wave W306.
export * from './predict-defects-defs.js';
export * from './predict-defects-handler.js';

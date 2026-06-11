/**
 * analyze-coverage.ts - O(log n) Johnson-Lindenstrauss coverage analysis
 *
 * Performs efficient coverage analysis using Johnson-Lindenstrauss random
 * projection for O(log n) gap detection instead of O(n) full scan.
 */

import { z } from 'zod';

// Input schema for analyze-coverage tool

// Split into ./analyze-coverage-defs.ts + ./analyze-coverage-handler.ts during campaign-2 wave W306.
export * from './analyze-coverage-defs.js';
export * from './analyze-coverage-handler.js';

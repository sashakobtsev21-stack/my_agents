/**
 * prioritize-gaps.ts - Risk-based gap prioritization MCP tool handler
 *
 * Prioritizes coverage gaps based on multiple risk factors including
 * code complexity, change frequency, business criticality, and defect history.
 */

import { z } from 'zod';

// Input schema for prioritize-gaps tool

// Split into ./prioritize-gaps-defs.ts + ./prioritize-gaps-handler.ts during campaign-2 wave W306.
export * from './prioritize-gaps-defs.js';
export * from './prioritize-gaps-handler.js';

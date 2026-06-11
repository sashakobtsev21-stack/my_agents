/**
 * track-trends.ts - Coverage trend tracking MCP tool handler
 *
 * Tracks coverage trends over time, detecting patterns, regressions,
 * and improvements to provide actionable insights.
 */

import { z } from 'zod';

// Input schema for track-trends tool

// Split into ./track-trends-defs.ts + ./track-trends-handler.ts during campaign-2 wave W306.
export * from './track-trends-defs.js';
export * from './track-trends-handler.js';

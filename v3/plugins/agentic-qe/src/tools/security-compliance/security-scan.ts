/**
 * security-scan.ts - SAST/DAST security scanning MCP tool handler
 *
 * Performs static (SAST) and dynamic (DAST) security analysis to identify
 * vulnerabilities, security weaknesses, and compliance issues.
 */

import { z } from 'zod';

// Input schema for security-scan tool

// Split into ./security-scan-defs.ts + ./security-scan-handler.ts during campaign-2 wave W306.
export * from './security-scan-defs.js';
export * from './security-scan-handler.js';

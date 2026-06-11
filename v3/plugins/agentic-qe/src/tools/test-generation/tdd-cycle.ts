/**
 * tdd-cycle.ts - TDD red-green-refactor orchestration MCP tool handler
 *
 * Executes TDD cycles with 7 specialized subagents:
 * 1. requirement-analyzer - Analyzes requirements
 * 2. test-designer - Designs test cases
 * 3. red-phase-executor - Writes failing tests
 * 4. green-phase-implementer - Implements to pass tests
 * 5. refactor-advisor - Suggests refactoring improvements
 * 6. coverage-verifier - Verifies coverage targets
 * 7. cycle-coordinator - Orchestrates the cycle
 */

import { z } from 'zod';

// Input schema for tdd-cycle tool

// Split into ./tdd-cycle-defs.ts + ./tdd-cycle-handler.ts during campaign-2 wave W306.
export * from './tdd-cycle-defs.js';
export * from './tdd-cycle-handler.js';

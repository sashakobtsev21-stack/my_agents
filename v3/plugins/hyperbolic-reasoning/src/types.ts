/**
 * Hyperbolic Reasoning Plugin - Type Definitions
 *
 * Types for hyperbolic geometry operations including Poincare ball embeddings,
 * taxonomic reasoning, hierarchy comparison, and entailment graphs.
 */

import { z } from 'zod';

// Split into ./types-core.ts + ./types-extended.ts during campaign-2 wave W304.
export * from './types-core.js';
export * from './types-extended.js';

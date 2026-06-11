/**
 * Gas Town Bridge Plugin - Type Definitions
 *
 * Core types for Gas Town integration including:
 * - Beads: Git-backed issue tracking with graph semantics
 * - Formulas: TOML-defined workflows (convoy, workflow, expansion, aspect)
 * - Convoys: Work-order tracking for slung work
 * - Steps/Legs: Workflow components
 * - Variables: Template substitution
 *
 * @module gastown-bridge/types
 * @version 0.1.0
 */


// ============================================================================

// Split into the two modules below during campaign-2 wave 33 (W239).
export * from './types-domain.js';
export * from './types-schemas.js';

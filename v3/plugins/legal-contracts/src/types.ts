/**
 * Legal Contracts Plugin - Type Definitions
 *
 * Core types for legal contract analysis including clause extraction,
 * risk assessment, contract comparison, obligation tracking, and playbook matching.
 *
 * Based on ADR-034: Legal Contract Analysis Plugin
 *
 * @module v3/plugins/legal-contracts/types
 */


// ============================================================================

// Split into the two modules below during campaign-2 wave 17 (W223).
export * from './types-domain.js';
export * from './types-runtime.js';

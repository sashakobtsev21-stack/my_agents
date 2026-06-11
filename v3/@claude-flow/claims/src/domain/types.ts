/**
 * Claims Domain Types
 *
 * Core type definitions for the issue claiming system.
 * Supports both human and agent claimants with handoff capabilities.
 *
 * @module v3/claims/domain/types
 */

// =============================================================================

// Split into the two modules below during campaign-2 wave 45 (W251).
export * from './types-core.js';
export * from './types-stealing.js';

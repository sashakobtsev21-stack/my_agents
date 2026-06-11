/**
 * RuVector PostgreSQL Bridge - Attention Mechanisms Module
 *
 * Comprehensive implementation of all 39 attention mechanisms for the
 * RuVector PostgreSQL vector database integration.
 *
 * @module @claude-flow/plugins/integrations/ruvector/attention
 * @version 1.0.0
 */


// This file is now a thin barrel: the attention module was split into
// the four sub-modules below during the P3.53 god-file decomposition
// (W174). Kept as attention.ts so the './attention.js' importers
// (attention-advanced / attention-executor / attention-mechanisms /
// index) keep resolving byte-identically. Everything here was public.
export * from './attention-base.js';
export * from './attention-registry.js';
export * from './attention-standard.js';
export * from './attention-efficient.js';

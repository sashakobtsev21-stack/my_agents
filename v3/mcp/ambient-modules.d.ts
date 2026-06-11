/**
 * Ambient declarations for optional/cross-workspace integrations that this
 * package imports dynamically with graceful fallbacks (try/await import).
 * They resolve at runtime inside the monorepo; for the per-package type
 * check (added in the W198 follow-up) they are deliberately `any` so the
 * gate focuses on THIS package's code.
 */
declare module '@claude-flow/swarm';
declare module '@claude-flow/memory';
declare module 'agentic-flow/core';
declare module 'ajv';

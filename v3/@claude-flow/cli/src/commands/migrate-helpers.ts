/**
 * Migrate Command — target table & status formatter
 *
 * Module-private in the original migrate.ts (campaign-2 W272); NOT
 * re-exported.
 */

import { output } from '../output.js';

export const MIGRATION_TARGETS = [
  { value: 'config', label: 'Configuration', hint: 'Migrate configuration files' },
  { value: 'memory', label: 'Memory Data', hint: 'Migrate memory/database content' },
  { value: 'agents', label: 'Agent Configs', hint: 'Migrate agent configurations' },
  { value: 'hooks', label: 'Hooks', hint: 'Migrate hook definitions' },
  { value: 'workflows', label: 'Workflows', hint: 'Migrate workflow definitions' },
  { value: 'embeddings', label: 'Embeddings', hint: 'Migrate to ONNX with hyperbolic support' },
  { value: 'all', label: 'All', hint: 'Full migration' }
];

// Status command

export function formatMigrationStatus(status: string): string {
  if (status === 'migrated' || status === 'passed' || status === 'completed') {
    return output.success(status);
  }
  if (status === 'pending' || status === 'partial') {
    return output.warning(status);
  }
  if (status === 'failed') {
    return output.error(status);
  }
  if (status === 'not-required' || status.startsWith('skipped') || status === 'v3' || status === 'missing') {
    return output.dim(status);
  }
  if (status === 'v2') {
    return output.warning(status);
  }
  if (status === 'v2 + v3') {
    return output.success(status);
  }
  return status;
}

// getMigrationSteps() returned a plan for the dry-run renderer; the
// renderer now derives steps from the live status payload instead.


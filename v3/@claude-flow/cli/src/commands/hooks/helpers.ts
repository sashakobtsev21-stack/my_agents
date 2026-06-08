/**
 * Small pure helpers extracted from `commands/hooks.ts` (#code-quality: keep
 * files under 500 lines). No side effects beyond colorizing via `output`.
 */

import { output } from '../../output.js';

/**
 * #1686 — `?? 0` only defaults null/undefined; NaN slips through and
 * surfaces as `"NaN"` (or earlier crashed `.toFixed`) in the metrics
 * dashboard and pretrain output. Coerce to a finite number, fall back
 * to `fallback` when the input is null/undefined/non-numeric/NaN/Infinity.
 */
export function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Colorize an intelligence-system status label for the dashboard. */
export function formatIntelligenceStatus(status: string): string {
  switch (status) {
    case 'active':
    case 'ready':
      return output.success(status);
    case 'training':
      return output.highlight(status);
    case 'idle':
      return output.dim(status);
    case 'disabled':
    case 'error':
      return output.error(status);
    default:
      return status;
  }
}

/** Colorize a background-worker status label for the dashboard. */
export function formatWorkerStatus(status: string): string {
  switch (status) {
    case 'running':
      return output.highlight(status);
    case 'completed':
      return output.success(status);
    case 'failed':
      return output.error(status);
    case 'pending':
      return output.dim(status);
    default:
      return status;
  }
}

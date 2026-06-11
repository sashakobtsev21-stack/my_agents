/**
 * Claims CLI — formatting helpers
 *
 * Status/type/progress/time formatters and parseTarget. Module-private
 * in the original cli-commands.ts (P3.77, W200) and NOT re-exported by
 * the barrel. Extraction became possible once output.success/error/info
 * were aligned with the authoritative string-returning cli-core
 * signatures (the former 'void quirk' blocker).
 */

import { output } from './cli-types.js';
import type { ClaimStatus, ClaimantType } from './cli-commands-types.js';

// Formatting Helpers
// ============================================

export function formatClaimStatus(status: ClaimStatus): string {
  switch (status) {
    case 'active':
      return output.success(status);
    case 'blocked':
      return output.error(status);
    case 'review-requested':
      return output.warning(status);
    case 'stealable':
      return output.warning(status);
    case 'completed':
      return output.dim(status);
    default:
      return status;
  }
}

export function formatClaimantType(type: ClaimantType): string {
  switch (type) {
    case 'agent':
      return output.info(type);
    case 'human':
      return output.highlight(type);
    default:
      return type;
  }
}

export function formatAgentStatus(status: 'healthy' | 'overloaded' | 'idle'): string {
  switch (status) {
    case 'healthy':
      return output.success(status);
    case 'overloaded':
      return output.error(status);
    case 'idle':
      return output.dim(status);
    default:
      return status;
  }
}

export function formatProgress(progress: number): string {
  if (progress >= 75) {
    return output.success(`${progress}%`);
  } else if (progress >= 25) {
    return output.warning(`${progress}%`);
  }
  return output.dim(`${progress}%`);
}

export function formatTimeRemaining(expiresAt?: string): string {
  if (!expiresAt) return output.dim('N/A');

  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return output.error('EXPIRED');
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 1) {
    return output.warning(`${minutes}m`);
  } else if (hours < 4) {
    return output.warning(`${hours}h ${minutes}m`);
  }

  return output.dim(`${hours}h ${minutes}m`);
}

export function parseTarget(target: string): { id: string; type: ClaimantType } {
  // Format: agent:coder-1 or human:alice
  const [type, id] = target.split(':');
  if (!type || !id || (type !== 'agent' && type !== 'human')) {
    throw new Error(`Invalid target format: ${target}. Use agent:<id> or human:<id>`);
  }
  return { id, type: type as ClaimantType };
}

// ============================================

/**
 * Claims MCP Tools — store types & IO helpers
 *
 * The claimant/claim/store shapes and the .claude-flow/claims
 * persistence + formatting helpers. Module-private in the original
 * claims-tools.ts (campaign-2 W226); NOT re-exported by the barrel.
 */

export interface Claimant {
  type: 'human' | 'agent';
  userId?: string;
  name?: string;
  agentId?: string;
  agentType?: string;
}

export type ClaimStatus = 'active' | 'paused' | 'handoff-pending' | 'review-requested' | 'blocked' | 'stealable' | 'completed';
export type StealReason = 'overloaded' | 'stale' | 'blocked-timeout' | 'voluntary';

export interface IssueClaim {
  issueId: string;
  claimant: Claimant;
  claimedAt: string;
  status: ClaimStatus;
  statusChangedAt: string;
  expiresAt?: string;
  handoffTo?: Claimant;
  handoffReason?: string;
  blockReason?: string;
  progress: number;
  context?: string;
}

export interface ClaimsStore {
  claims: Record<string, IssueClaim>;
  stealable: Record<string, { reason: StealReason; stealableAt: string; preferredTypes?: string[]; progress: number; context?: string }>;
  contests: Record<string, { originalClaimant: Claimant; contestedAt: string; reason: string }>;
}

// File-based persistence
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

export const CLAIMS_DIR = '.claude-flow/claims';
export const CLAIMS_FILE = 'claims.json';

export function getClaimsPath(): string {
  return resolve(join(CLAIMS_DIR, CLAIMS_FILE));
}

export function ensureClaimsDir(): void {
  const dir = resolve(CLAIMS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadClaims(): ClaimsStore {
  try {
    const path = getClaimsPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // Return empty store on error
  }
  return { claims: {}, stealable: {}, contests: {} };
}

export function saveClaims(store: ClaimsStore): void {
  ensureClaimsDir();
  writeFileSync(getClaimsPath(), JSON.stringify(store, null, 2), 'utf-8');
}

export function formatClaimant(claimant: Claimant): string {
  return claimant.type === 'human'
    ? `human:${claimant.userId}:${claimant.name}`
    : `agent:${claimant.agentId}:${claimant.agentType}`;
}

export function parseClaimant(str: string): Claimant | null {
  const parts = str.split(':');
  if (parts[0] === 'human' && parts.length >= 3) {
    return { type: 'human', userId: parts[1], name: parts.slice(2).join(':') };
  } else if (parts[0] === 'agent' && parts.length >= 3) {
    return { type: 'agent', agentId: parts[1], agentType: parts[2] };
  }
  return null;
}


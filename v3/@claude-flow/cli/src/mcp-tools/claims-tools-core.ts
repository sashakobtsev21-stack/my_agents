/**
 * Claims MCP Tools — claim lifecycle group
 *
 * Extracted verbatim from claims-tools.ts (lines 97-559) during
 * campaign-2 wave 20 (W226); module-private group const.
 */

import type { MCPTool } from './types.js';
import { validateIdentifier, validateText } from './validate-input.js';
import {
  formatClaimant,
  loadClaims,
  parseClaimant,
  saveClaims,
} from './claims-tools-store.js';
import type {
  ClaimStatus,
  IssueClaim,
  StealReason,
} from './claims-tools-store.js';

export const claimsCoreTools: MCPTool[] = [
  {
    name: 'claims_claim',
    description: 'Claim an issue for work (human or agent) Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID or GitHub issue number',
        },
        claimant: {
          type: 'string',
          description: 'Claimant identifier (e.g., "human:user-1:Alice" or "agent:coder-1:coder")',
        },
        context: {
          type: 'string',
          description: 'Optional context about the work approach',
        },
      },
      required: ['issueId', 'claimant'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const claimantStr = input.claimant as string;
      const context = input.context as string | undefined;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(claimantStr, 'claimant'); if (!v.valid) return { success: false, error: v.error }; }
      if (context) { const v = validateText(context, 'context'); if (!v.valid) return { success: false, error: v.error }; }

      const claimant = parseClaimant(claimantStr);
      if (!claimant) {
        return { success: false, error: 'Invalid claimant format. Use "human:userId:name" or "agent:agentId:agentType"' };
      }

      const store = loadClaims();

      // Check if already claimed
      if (store.claims[issueId]) {
        const existing = store.claims[issueId];
        return {
          success: false,
          error: `Issue already claimed by ${formatClaimant(existing.claimant)}`,
          existingClaim: existing,
        };
      }

      const now = new Date().toISOString();
      const claim: IssueClaim = {
        issueId,
        claimant,
        claimedAt: now,
        status: 'active',
        statusChangedAt: now,
        progress: 0,
        context,
      };

      store.claims[issueId] = claim;
      saveClaims(store);

      return {
        success: true,
        claim,
        message: `Issue ${issueId} claimed by ${formatClaimant(claimant)}`,
      };
    },
  },

  {
    name: 'claims_release',
    description: 'Release a claim on an issue Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID to release',
        },
        claimant: {
          type: 'string',
          description: 'Claimant identifier (must match current owner)',
        },
        reason: {
          type: 'string',
          description: 'Reason for releasing',
        },
      },
      required: ['issueId', 'claimant'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const claimantStr = input.claimant as string;
      const reason = input.reason as string | undefined;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(claimantStr, 'claimant'); if (!v.valid) return { success: false, error: v.error }; }
      if (reason) { const v = validateText(reason, 'reason'); if (!v.valid) return { success: false, error: v.error }; }

      const claimant = parseClaimant(claimantStr);
      if (!claimant) {
        return { success: false, error: 'Invalid claimant format' };
      }

      const store = loadClaims();
      const claim = store.claims[issueId];

      if (!claim) {
        return { success: false, error: 'Issue is not claimed' };
      }

      // Verify ownership
      if (formatClaimant(claim.claimant) !== formatClaimant(claimant)) {
        return { success: false, error: 'Only the current claimant can release' };
      }

      delete store.claims[issueId];
      delete store.stealable[issueId];
      saveClaims(store);

      return {
        success: true,
        message: `Issue ${issueId} released`,
        reason,
        previousClaim: claim,
      };
    },
  },

  {
    name: 'claims_handoff',
    description: 'Request handoff of an issue to another claimant Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID to handoff',
        },
        from: {
          type: 'string',
          description: 'Current claimant identifier',
        },
        to: {
          type: 'string',
          description: 'Target claimant identifier',
        },
        reason: {
          type: 'string',
          description: 'Reason for handoff',
        },
        progress: {
          type: 'number',
          description: 'Current progress percentage (0-100)',
        },
      },
      required: ['issueId', 'from', 'to'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const fromStr = input.from as string;
      const toStr = input.to as string;
      const reason = input.reason as string | undefined;
      const progress = (input.progress as number) || 0;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(fromStr, 'from'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(toStr, 'to'); if (!v.valid) return { success: false, error: v.error }; }
      if (reason) { const v = validateText(reason, 'reason'); if (!v.valid) return { success: false, error: v.error }; }

      const from = parseClaimant(fromStr);
      const to = parseClaimant(toStr);

      if (!from || !to) {
        return { success: false, error: 'Invalid claimant format' };
      }

      const store = loadClaims();
      const claim = store.claims[issueId];

      if (!claim) {
        return { success: false, error: 'Issue is not claimed' };
      }

      if (formatClaimant(claim.claimant) !== formatClaimant(from)) {
        return { success: false, error: 'Only the current claimant can request handoff' };
      }

      const now = new Date().toISOString();
      claim.status = 'handoff-pending';
      claim.statusChangedAt = now;
      claim.handoffTo = to;
      claim.handoffReason = reason;
      claim.progress = progress;

      store.claims[issueId] = claim;
      saveClaims(store);

      return {
        success: true,
        claim,
        message: `Handoff requested from ${formatClaimant(from)} to ${formatClaimant(to)}`,
      };
    },
  },

  {
    name: 'claims_accept-handoff',
    description: 'Accept a pending handoff Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID with pending handoff',
        },
        claimant: {
          type: 'string',
          description: 'Claimant accepting the handoff',
        },
      },
      required: ['issueId', 'claimant'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const claimantStr = input.claimant as string;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      { const v = validateText(claimantStr, 'claimant'); if (!v.valid) return { success: false, error: v.error }; }

      const claimant = parseClaimant(claimantStr);
      if (!claimant) {
        return { success: false, error: 'Invalid claimant format' };
      }

      const store = loadClaims();
      const claim = store.claims[issueId];

      if (!claim) {
        return { success: false, error: 'Issue is not claimed' };
      }

      if (claim.status !== 'handoff-pending') {
        return { success: false, error: 'No pending handoff for this issue' };
      }

      if (!claim.handoffTo || formatClaimant(claim.handoffTo) !== formatClaimant(claimant)) {
        return { success: false, error: 'You are not the target of this handoff' };
      }

      const previousOwner = claim.claimant;
      const now = new Date().toISOString();

      claim.claimant = claimant;
      claim.status = 'active';
      claim.statusChangedAt = now;
      claim.handoffTo = undefined;
      claim.handoffReason = undefined;

      store.claims[issueId] = claim;
      saveClaims(store);

      return {
        success: true,
        claim,
        previousOwner,
        message: `Handoff accepted. ${formatClaimant(claimant)} now owns issue ${issueId}`,
      };
    },
  },

  {
    name: 'claims_status',
    description: 'Update claim status Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID',
        },
        status: {
          type: 'string',
          description: 'New status',
          enum: ['active', 'paused', 'blocked', 'review-requested', 'completed'],
        },
        note: {
          type: 'string',
          description: 'Status note or reason',
        },
        progress: {
          type: 'number',
          description: 'Current progress percentage',
        },
      },
      required: ['issueId', 'status'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const status = input.status as ClaimStatus;
      const note = input.note as string | undefined;
      const progress = input.progress as number | undefined;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      if (note) { const v = validateText(note, 'note'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadClaims();
      const claim = store.claims[issueId];

      if (!claim) {
        return { success: false, error: 'Issue is not claimed' };
      }

      const now = new Date().toISOString();
      claim.status = status;
      claim.statusChangedAt = now;
      if (status === 'blocked') {
        claim.blockReason = note;
      }
      if (progress !== undefined) {
        claim.progress = Math.min(100, Math.max(0, progress));
      }

      store.claims[issueId] = claim;
      saveClaims(store);

      return {
        success: true,
        claim,
        message: `Issue ${issueId} status updated to ${status}`,
      };
    },
  },

  {
    name: 'claims_list',
    description: 'List all claims or filter by criteria Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['active', 'paused', 'blocked', 'stealable', 'completed', 'all'],
        },
        claimant: {
          type: 'string',
          description: 'Filter by claimant',
        },
        agentType: {
          type: 'string',
          description: 'Filter by agent type',
        },
      },
    },
    handler: async (input) => {
      const status = input.status as string | undefined;
      const claimantFilter = input.claimant as string | undefined;
      const agentType = input.agentType as string | undefined;

      if (claimantFilter) { const v = validateText(claimantFilter, 'claimant'); if (!v.valid) return { success: false, error: v.error }; }
      if (agentType) { const v = validateIdentifier(agentType, 'agentType'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadClaims();
      let claims = Object.values(store.claims);

      if (status && status !== 'all') {
        claims = claims.filter(c => c.status === status);
      }

      if (claimantFilter) {
        claims = claims.filter(c => formatClaimant(c.claimant).includes(claimantFilter));
      }

      if (agentType) {
        claims = claims.filter(c =>
          c.claimant.type === 'agent' && c.claimant.agentType === agentType
        );
      }

      return {
        success: true,
        claims,
        count: claims.length,
        stealableCount: Object.keys(store.stealable).length,
      };
    },
  },

  {
    name: 'claims_mark-stealable',
    description: 'Mark an issue as stealable by other agents Use when nothing native covers per-agent capability gating — Claude Code agents have file-system access by default. Pair claims_grant + claims_check before letting an agent run privileged ops. For trusted in-session work, no claims call is needed.',
    category: 'claims',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: {
          type: 'string',
          description: 'Issue ID to mark stealable',
        },
        reason: {
          type: 'string',
          description: 'Reason for marking stealable',
          enum: ['overloaded', 'stale', 'blocked-timeout', 'voluntary'],
        },
        preferredTypes: {
          type: 'array',
          description: 'Preferred agent types to steal',
          items: { type: 'string' },
        },
        context: {
          type: 'string',
          description: 'Handoff context for the stealer',
        },
      },
      required: ['issueId', 'reason'],
    },
    handler: async (input) => {
      const issueId = input.issueId as string;
      const reason = input.reason as StealReason;
      const preferredTypes = input.preferredTypes as string[] | undefined;
      const context = input.context as string | undefined;

      { const v = validateIdentifier(issueId, 'issueId'); if (!v.valid) return { success: false, error: v.error }; }
      if (context) { const v = validateText(context, 'context'); if (!v.valid) return { success: false, error: v.error }; }

      const store = loadClaims();
      const claim = store.claims[issueId];

      if (!claim) {
        return { success: false, error: 'Issue is not claimed' };
      }

      const now = new Date().toISOString();
      claim.status = 'stealable';
      claim.statusChangedAt = now;

      store.stealable[issueId] = {
        reason,
        stealableAt: now,
        preferredTypes,
        progress: claim.progress,
        context,
      };

      store.claims[issueId] = claim;
      saveClaims(store);

      return {
        success: true,
        claim,
        stealableInfo: store.stealable[issueId],
        message: `Issue ${issueId} marked as stealable (${reason})`,
      };
    },
  },

];

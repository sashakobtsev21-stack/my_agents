/**
 * Claim Domain Events — event shapes & unions
 *
 * Extracted verbatim from events.ts (lines 18-212) during campaign-2
 * wave 64 (W270). events.ts stays the barrel.
 */

import type {
  ClaimId,
  IssueId,
  Claimant,
  ClaimStatus,
} from './types.js';

// Base Claim Event
// =============================================================================

/**
 * Base interface for all claim domain events
 */
export interface ClaimDomainEvent {
  /** Unique event identifier */
  id: string;

  /** Event type discriminator */
  type: ClaimEventType;

  /** Aggregate ID (claim ID) */
  aggregateId: string;

  /** Aggregate type - always 'claim' for this domain */
  aggregateType: 'claim';

  /** Event version for ordering */
  version: number;

  /** Timestamp when event occurred */
  timestamp: number;

  /** Event source */
  source: string;

  /** Event payload data */
  payload: Record<string, unknown>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Optional causation ID (event that caused this event) */
  causationId?: string;

  /** Optional correlation ID (groups related events) */
  correlationId?: string;
}

// =============================================================================
// Event Types
// =============================================================================

export type ClaimEventType =
  | 'claim:created'
  | 'claim:released'
  | 'claim:expired'
  | 'claim:status-changed'
  | 'claim:note-added'
  | 'handoff:requested'
  | 'handoff:accepted'
  | 'handoff:rejected'
  | 'review:requested'
  | 'review:completed';

// =============================================================================
// Specific Event Interfaces
// =============================================================================

export interface ClaimCreatedEvent extends ClaimDomainEvent {
  type: 'claim:created';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    claimant: Claimant;
    claimedAt: number;
    expiresAt?: number;
  };
}

export interface ClaimReleasedEvent extends ClaimDomainEvent {
  type: 'claim:released';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    claimant: Claimant;
    releasedAt: number;
    reason?: string;
  };
}

export interface ClaimExpiredEvent extends ClaimDomainEvent {
  type: 'claim:expired';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    claimant: Claimant;
    expiredAt: number;
    lastActivityAt: number;
  };
}

export interface ClaimStatusChangedEvent extends ClaimDomainEvent {
  type: 'claim:status-changed';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    previousStatus: ClaimStatus;
    newStatus: ClaimStatus;
    changedAt: number;
    note?: string;
  };
}

export interface ClaimNoteAddedEvent extends ClaimDomainEvent {
  type: 'claim:note-added';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    note: string;
    addedAt: number;
    addedBy: Claimant;
  };
}

export interface HandoffRequestedEvent extends ClaimDomainEvent {
  type: 'handoff:requested';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    handoffId: string;
    from: Claimant;
    to: Claimant;
    reason: string;
    requestedAt: number;
  };
}

export interface HandoffAcceptedEvent extends ClaimDomainEvent {
  type: 'handoff:accepted';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    handoffId: string;
    from: Claimant;
    to: Claimant;
    acceptedAt: number;
  };
}

export interface HandoffRejectedEvent extends ClaimDomainEvent {
  type: 'handoff:rejected';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    handoffId: string;
    from: Claimant;
    to: Claimant;
    rejectedAt: number;
    reason: string;
  };
}

export interface ReviewRequestedEvent extends ClaimDomainEvent {
  type: 'review:requested';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    reviewers: Claimant[];
    requestedAt: number;
    requestedBy: Claimant;
  };
}

export interface ReviewCompletedEvent extends ClaimDomainEvent {
  type: 'review:completed';
  payload: {
    claimId: ClaimId;
    issueId: IssueId;
    reviewer: Claimant;
    approved: boolean;
    completedAt: number;
    comments?: string;
  };
}

// =============================================================================
// Event Type Union
// =============================================================================

export type AllClaimEvents =
  | ClaimCreatedEvent
  | ClaimReleasedEvent
  | ClaimExpiredEvent
  | ClaimStatusChangedEvent
  | ClaimNoteAddedEvent
  | HandoffRequestedEvent
  | HandoffAcceptedEvent
  | HandoffRejectedEvent
  | ReviewRequestedEvent
  | ReviewCompletedEvent;

// =============================================================================

/**
 * Work Stealing — service interface & in-memory event bus
 *
 * Extracted verbatim from work-stealing-service.ts (lines 34-161)
 * during campaign-2 wave 46 (W252). work-stealing-service.ts stays the
 * barrel.
 */

import type {
  AgentType,
  Claimant,
  IssueClaimWithStealing,
  WorkStealingConfig,
  IWorkStealingEventBus,
  IssueId,
  StealResult,
  StealableInfo,
  StealableReason,
  WorkStealingEvent,
  WorkStealingEventType,
} from '../domain/types.js';

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Work Stealing Service Interface
 */
export interface IWorkStealingService {
  /** Mark work as stealable */
  markStealable(issueId: IssueId, info: StealableInfo): Promise<void>;

  /** Steal work from another agent */
  steal(issueId: IssueId, stealer: Claimant): Promise<StealResult>;

  /** Get list of stealable issues */
  getStealable(agentType?: AgentType): Promise<IssueClaimWithStealing[]>;

  /** Contest a steal (original owner wants it back) */
  contestSteal(issueId: IssueId, originalClaimant: Claimant, reason: string): Promise<void>;

  /** Resolve contest (queen/human decides) */
  resolveContest(issueId: IssueId, winner: Claimant, reason: string): Promise<void>;

  /** Auto-detect stealable work based on config thresholds */
  detectStaleWork(config: WorkStealingConfig): Promise<IssueClaimWithStealing[]>;

  /** Auto-mark stealable work based on config thresholds */
  autoMarkStealable(config: WorkStealingConfig): Promise<number>;
}

// =============================================================================
// Default Event Bus Implementation
// =============================================================================

/**
 * Simple in-memory event bus for work stealing events
 */
export class InMemoryWorkStealingEventBus implements IWorkStealingEventBus {
  private handlers: Map<WorkStealingEventType | '*', Set<(event: WorkStealingEvent) => void | Promise<void>>> = new Map();
  private history: WorkStealingEvent[] = [];
  private maxHistorySize: number;

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 1000;
  }

  async emit(event: WorkStealingEvent): Promise<void> {
    this.addToHistory(event);

    const typeHandlers = this.handlers.get(event.type) ?? new Set();
    const allHandlers = this.handlers.get('*') ?? new Set();

    const promises: Promise<void>[] = [];

    for (const handler of typeHandlers) {
      promises.push(this.safeExecute(handler, event));
    }

    for (const handler of allHandlers) {
      promises.push(this.safeExecute(handler, event));
    }

    await Promise.all(promises);
  }

  subscribe(
    eventType: WorkStealingEventType,
    handler: (event: WorkStealingEvent) => void | Promise<void>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  subscribeAll(handler: (event: WorkStealingEvent) => void | Promise<void>): () => void {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', new Set());
    }

    const handlers = this.handlers.get('*')!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  getHistory(filter?: { types?: WorkStealingEventType[]; limit?: number }): WorkStealingEvent[] {
    let events = [...this.history];

    if (filter?.types?.length) {
      events = events.filter(e => filter.types!.includes(e.type));
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  private addToHistory(event: WorkStealingEvent): void {
    this.history.push(event);

    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-Math.floor(this.maxHistorySize / 2));
    }
  }

  private async safeExecute(
    handler: (event: WorkStealingEvent) => void | Promise<void>,
    event: WorkStealingEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (err) {
      console.error(`Work stealing event handler error for ${event.type}:`, err);
    }
  }
}


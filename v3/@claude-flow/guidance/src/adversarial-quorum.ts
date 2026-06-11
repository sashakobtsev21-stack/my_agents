/**
 * Adversarial — MemoryQuorum
 *
 * Extracted verbatim from adversarial.ts (lines 644-784) during
 * campaign-2 wave 39 (W245). adversarial.ts stays the barrel.
 */

import { randomUUID } from 'node:crypto';
import type {
  MemoryProposal,
  MemoryQuorumConfig,
  QuorumResult,
} from './adversarial.js';

export class MemoryQuorum {
  private proposals = new Map<string, MemoryProposal>();
  private threshold: number;
  private maxProposals: number;

  constructor(config: MemoryQuorumConfig = {}) {
    this.threshold = config.threshold ?? 0.67;
    this.maxProposals = config.maxProposals ?? 1000;
  }

  /**
   * Propose a memory write
   */
  propose(key: string, value: string, proposerId: string): string {
    const proposalId = randomUUID();

    const proposal: MemoryProposal = {
      id: proposalId,
      key,
      value,
      proposerId,
      timestamp: Date.now(),
      votes: new Map([[proposerId, true]]), // Proposer auto-votes yes
      resolved: false,
    };

    this.proposals.set(proposalId, proposal);

    // Evict oldest proposal if at capacity (O(n) min-find, not O(n log n) sort)
    if (this.proposals.size > this.maxProposals) {
      let oldestId: string | undefined;
      let oldestTimestamp = Infinity;
      for (const [id, proposal] of this.proposals) {
        if (proposal.timestamp < oldestTimestamp) {
          oldestTimestamp = proposal.timestamp;
          oldestId = id;
        }
      }
      if (oldestId) {
        this.proposals.delete(oldestId);
      }
    }

    return proposalId;
  }

  /**
   * Vote on a proposal
   */
  vote(proposalId: string, voterId: string, approve: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    if (proposal.resolved) {
      throw new Error(`Proposal ${proposalId} already resolved`);
    }

    proposal.votes.set(voterId, approve);
  }

  /**
   * Resolve a proposal (check if quorum reached)
   */
  resolve(proposalId: string): QuorumResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Single pass over votes instead of two filter calls
    let forCount = 0;
    let againstCount = 0;
    for (const v of proposal.votes.values()) {
      if (v) forCount++;
      else againstCount++;
    }
    const total = forCount + againstCount;

    const approvalRatio = total > 0 ? forCount / total : 0;
    const approved = approvalRatio >= this.threshold;

    const result: QuorumResult = {
      approved,
      votes: {
        for: forCount,
        against: againstCount,
        total,
      },
      threshold: this.threshold,
    };

    proposal.resolved = true;
    proposal.result = result;

    return result;
  }

  /**
   * Get proposal by ID
   */
  getProposal(id: string): MemoryProposal | undefined {
    const proposal = this.proposals.get(id);
    if (!proposal) return undefined;

    // Return a deep copy to prevent external mutation
    return {
      ...proposal,
      votes: new Map(proposal.votes),
      result: proposal.result ? { ...proposal.result, votes: { ...proposal.result.votes } } : undefined,
    };
  }

  /**
   * Get all active proposals
   */
  getAllProposals(): MemoryProposal[] {
    return Array.from(this.proposals.values()).map(p => this.getProposal(p.id)!);
  }

  /**
   * Clear resolved proposals older than specified age
   */
  clearResolvedProposals(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, proposal] of this.proposals) {
      if (proposal.resolved && now - proposal.timestamp > maxAgeMs) {
        this.proposals.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}

/**
 * Create a threat detector instance
 */

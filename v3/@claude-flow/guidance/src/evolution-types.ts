/**
 * Evolution — proposal/rollout/simulation types & default stages
 *
 * Extracted verbatim from evolution.ts (lines 20-235) during campaign-2
 * wave 55 (W261). evolution.ts re-exports the 11 public names; the two
 * DEFAULT_* values stay unexported from it.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * The kind of change being proposed.
 */
export type ChangeProposalKind =
  | 'rule-modify'
  | 'rule-add'
  | 'rule-remove'
  | 'rule-promote'
  | 'policy-update'
  | 'tool-config'
  | 'budget-adjust';

/**
 * Lifecycle status of a change proposal.
 */
export type ProposalStatus =
  | 'draft'
  | 'signed'
  | 'simulating'
  | 'compared'
  | 'staged'
  | 'promoted'
  | 'rolled-back'
  | 'rejected';

/**
 * Risk assessment attached to a proposal.
 */
export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

/**
 * A signed change proposal describing a modification to the guidance system.
 */
export interface ChangeProposal {
  /** Unique identifier (UUID) */
  proposalId: string;
  /** What kind of change this is */
  kind: ChangeProposalKind;
  /** Short human-readable title */
  title: string;
  /** Longer description of the change */
  description: string;
  /** Agent or human ID that authored the proposal */
  author: string;
  /** Dot-path or identifier of what is being changed */
  targetPath: string;
  /** Before/after snapshot of the change */
  diff: { before: unknown; after: unknown };
  /** Why this change is being proposed */
  rationale: string;
  /** Risk assessment for the change */
  riskAssessment: RiskAssessment;
  /** HMAC-SHA256 signature of the proposal content */
  signature: string;
  /** Epoch ms when the proposal was created */
  createdAt: number;
  /** Current lifecycle status */
  status: ProposalStatus;
}

/**
 * A single decision point where baseline and candidate diverged.
 */
export interface DecisionDiff {
  /** Sequence number in the trace */
  seq: number;
  /** What the baseline decided */
  baseline: unknown;
  /** What the candidate decided */
  candidate: unknown;
  /** How severe the divergence is */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Result of simulating a proposal against golden traces.
 */
export interface SimulationResult {
  /** Proposal that was simulated */
  proposalId: string;
  /** Hash of the trace produced by baseline config */
  baselineTraceHash: string;
  /** Hash of the trace produced by candidate config */
  candidateTraceHash: string;
  /** 0-1 score: 0 = identical, 1 = completely different */
  divergenceScore: number;
  /** Individual decision points where behaviour diverged */
  decisionDiffs: DecisionDiff[];
  /** Side-by-side metric comparison */
  metricsComparison: {
    baseline: Record<string, number>;
    candidate: Record<string, number>;
  };
  /** Whether the simulation passed acceptance criteria */
  passed: boolean;
  /** Human-readable reason for the verdict */
  reason: string;
}

/**
 * A single stage in a staged rollout.
 */
export interface RolloutStage {
  /** Stage name (e.g. 'canary', 'partial', 'full') */
  name: string;
  /** Percentage of traffic/agents this stage covers (0-100) */
  percentage: number;
  /** How long this stage should run before advancing (ms) */
  durationMs: number;
  /** Observed metrics during this stage */
  metrics: Record<string, number>;
  /** Maximum acceptable divergence before auto-rollback */
  divergenceThreshold: number;
  /** null = not evaluated yet, true = passed, false = failed */
  passed: boolean | null;
  /** Epoch ms when the stage started (null if not started) */
  startedAt: number | null;
  /** Epoch ms when the stage completed (null if not completed) */
  completedAt: number | null;
}

/**
 * A staged rollout plan for a change proposal.
 */
export interface StagedRollout {
  /** Unique rollout identifier */
  rolloutId: string;
  /** The proposal being rolled out */
  proposalId: string;
  /** Ordered stages (canary -> partial -> full) */
  stages: RolloutStage[];
  /** Index of the current stage (0-based) */
  currentStage: number;
  /** Overall rollout status */
  status: 'in-progress' | 'completed' | 'rolled-back';
  /** Epoch ms when the rollout started */
  startedAt: number;
  /** Epoch ms when the rollout completed (null if still running) */
  completedAt: number | null;
}

/**
 * History entry combining proposal, optional simulation, optional rollout,
 * and final outcome.
 */
export interface EvolutionHistoryEntry {
  proposal: ChangeProposal;
  simulation?: SimulationResult;
  rollout?: StagedRollout;
  outcome: ProposalStatus;
}

/**
 * Evaluator function for simulation: given a golden trace and a config variant,
 * produce a trace hash and metrics.
 */
export type TraceEvaluator = (
  trace: unknown,
  config: 'baseline' | 'candidate',
) => { traceHash: string; metrics: Record<string, number>; decisions: unknown[] };

// ============================================================================
// Configuration
// ============================================================================

export interface EvolutionPipelineConfig {
  /** HMAC signing key for proposals */
  signingKey?: string;
  /** Maximum divergence score (0-1) to approve a change */
  maxDivergence?: number;
  /** Default rollout stages */
  stages?: RolloutStage[];
}

export const DEFAULT_MAX_DIVERGENCE = 0.3;

export const DEFAULT_STAGES: RolloutStage[] = [
  {
    name: 'canary',
    percentage: 5,
    durationMs: 60_000,
    metrics: {},
    divergenceThreshold: 0.2,
    passed: null,
    startedAt: null,
    completedAt: null,
  },
  {
    name: 'partial',
    percentage: 50,
    durationMs: 300_000,
    metrics: {},
    divergenceThreshold: 0.25,
    passed: null,
    startedAt: null,
    completedAt: null,
  },
  {
    name: 'full',
    percentage: 100,
    durationMs: 600_000,
    metrics: {},
    divergenceThreshold: 0.3,
    passed: null,
    startedAt: null,
    completedAt: null,
  },
];


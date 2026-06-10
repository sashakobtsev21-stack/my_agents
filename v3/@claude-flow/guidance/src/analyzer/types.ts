/**
 * Type definitions + size budgets for the guidance analyzer — the
 * dimension-score / analysis-result / metrics / suggestion / benchmark
 * shapes, the context-size budgets, and the headless-benchmark result
 * types.
 *
 * Extracted from analyzer.ts (W111, P3.13 cut #1). Lives in analyzer/ to
 * avoid clashing with the package's existing src/types.ts.
 */
import type { ProofEnvelope } from '../proof.js';

export interface DimensionScore {
  /** Dimension name */
  name: string;
  /** Score 0-100 */
  score: number;
  /** Maximum possible score */
  max: number;
  /** Weight in composite calculation */
  weight: number;
  /** Human-readable findings */
  findings: string[];
}

/** Complete analysis result */
export interface AnalysisResult {
  /** Composite score 0-100 */
  compositeScore: number;
  /** Letter grade A-F */
  grade: string;
  /** Per-dimension scores */
  dimensions: DimensionScore[];
  /** Structural metrics */
  metrics: AnalysisMetrics;
  /** Actionable improvement suggestions */
  suggestions: Suggestion[];
  /** Timestamp */
  analyzedAt: number;
}

/** Raw metrics extracted from the file */
export interface AnalysisMetrics {
  /** Total lines */
  totalLines: number;
  /** Non-blank, non-comment lines */
  contentLines: number;
  /** Number of markdown headings */
  headingCount: number;
  /** Number of H2 sections */
  sectionCount: number;
  /** Estimated constitution lines (first section block) */
  constitutionLines: number;
  /** Number of rule-like statements (imperative sentences) */
  ruleCount: number;
  /** Number of code blocks */
  codeBlockCount: number;
  /** Number of NEVER/ALWAYS/MUST statements */
  enforcementStatements: number;
  /** Number of framework/tool mentions */
  toolMentions: number;
  /** Estimated shard count after compilation */
  estimatedShards: number;
  /** Has build command */
  hasBuildCommand: boolean;
  /** Has test command */
  hasTestCommand: boolean;
  /** Has security section */
  hasSecuritySection: boolean;
  /** Has architecture section */
  hasArchitectureSection: boolean;
  /** Lines in longest section */
  longestSectionLines: number;
  /** Has @import directives */
  hasImports: boolean;
  /** Number of domain-specific rules */
  domainRuleCount: number;
}

/** A concrete improvement suggestion */
export interface Suggestion {
  /** What to change */
  action: 'add' | 'remove' | 'restructure' | 'split' | 'strengthen';
  /** Priority */
  priority: 'high' | 'medium' | 'low';
  /** Which dimension this improves */
  dimension: string;
  /** Human-readable description */
  description: string;
  /** Estimated score improvement */
  estimatedImprovement: number;
  /** Concrete text to add/modify (if applicable) */
  patch?: string;
}

/** Before/after benchmark result */
export interface BenchmarkResult {
  before: AnalysisResult;
  after: AnalysisResult;
  delta: number;
  improvements: DimensionDelta[];
  regressions: DimensionDelta[];
}

export interface DimensionDelta {
  dimension: string;
  before: number;
  after: number;
  delta: number;
}

/** Context size preset for optimization */
export type ContextSize = 'compact' | 'standard' | 'full';

/** Configuration for size-aware optimization */
export interface OptimizeOptions {
  /** Target context size */
  contextSize?: ContextSize;
  /** Optional local overlay content */
  localContent?: string;
  /** Maximum optimization iterations */
  maxIterations?: number;
  /** Target score (stop when reached) */
  targetScore?: number;
  /** HMAC key for proof chain (enables cryptographic proof of optimization) */
  proofKey?: string;
}

/** Size budget for context presets */
export interface SizeBudget {
  maxLines: number;
  maxConstitutionLines: number;
  maxSectionLines: number;
  maxCodeBlocks: number;
  minSections: number;
  maxSections: number;
}

/** Result of headless benchmark via claude -p */
export interface HeadlessBenchmarkResult {
  /** Before optimization metrics */
  before: {
    analysis: AnalysisResult;
    suitePassRate: number;
    violationCount: number;
    taskResults: HeadlessTaskResult[];
  };
  /** After optimization metrics */
  after: {
    analysis: AnalysisResult;
    suitePassRate: number;
    violationCount: number;
    taskResults: HeadlessTaskResult[];
  };
  /** Score delta */
  delta: number;
  /** Proof chain with cryptographic verification */
  proofChain: ProofEnvelope[];
  /** Formatted report */
  report: string;
}

/** Result of a single headless task run */
export interface HeadlessTaskResult {
  taskId: string;
  prompt: string;
  passed: boolean;
  violations: string[];
  durationMs: number;
}

export const SIZE_BUDGETS: Record<ContextSize, SizeBudget> = {
  compact: {
    maxLines: 80,
    maxConstitutionLines: 20,
    maxSectionLines: 15,
    maxCodeBlocks: 2,
    minSections: 3,
    maxSections: 6,
  },
  standard: {
    maxLines: 200,
    maxConstitutionLines: 40,
    maxSectionLines: 35,
    maxCodeBlocks: 5,
    minSections: 5,
    maxSections: 12,
  },
  full: {
    maxLines: 500,
    maxConstitutionLines: 60,
    maxSectionLines: 50,
    maxCodeBlocks: 16,
    minSections: 5,
    maxSections: 25,
  },
};

// ============================================================================
// Analyzer
// ============================================================================

/**
 * Analyze a CLAUDE.md file and produce quantifiable scores.
 *
 * Scores 6 dimensions (0-100 each), weighted into a composite:
 * - Structure (20%): headings, sections, length, organization
 * - Coverage (20%): build/test/security/architecture/domain
 * - Enforceability (25%): NEVER/ALWAYS statements, concrete rules
 * - Compilability (15%): how well it compiles to constitution + shards
 * - Clarity (10%): code blocks, examples, specificity
 * - Completeness (10%): missing common sections
 */

/** Executor interface for headless claude commands */
export interface IHeadlessExecutor {
  execute(prompt: string, workDir: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

/**
 * Content-aware executor that adapts behavior based on CLAUDE.md content.
 *
 * When `validateEffect()` detects this interface, it calls `setContext()`
 * before each phase (before/after) so the executor can vary its responses
 * based on the quality of the loaded CLAUDE.md. This is the key mechanism
 * that makes the empirical validation meaningful — without it, the same
 * executor produces identical adherence for both phases.
 */
export interface IContentAwareExecutor extends IHeadlessExecutor {
  /** Set the CLAUDE.md content that the executor should use as behavioral context */
  setContext(claudeMdContent: string): void;
}

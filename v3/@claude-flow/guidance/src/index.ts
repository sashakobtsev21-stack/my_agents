/**
 * @claude-flow/guidance - Guidance Control Plane
 *
 * Sits beside Claude Code (not inside it) to:
 * 1. Compile CLAUDE.md into constitution + shards + manifest
 * 2. Retrieve task-relevant shards at runtime via intent classification
 * 3. Enforce non-negotiables through hook gates
 * 4. Log every run to a ledger with evaluators
 * 5. Evolve the rule set through an optimizer loop
 *
 * Architecture:
 * - Root CLAUDE.md → Repo constitution (rare changes)
 * - CLAUDE.local.md → Overlay / experiment sandbox (frequent changes)
 * - Optimizer → Promotes winning local rules to root
 *
 * Integration with Claude Code:
 * - Headless mode (claude -p --output-format json) for automated testing
 * - Hook system for enforcement gates
 * - RuVector/HNSW for semantic shard retrieval
 *
 * @module @claude-flow/guidance
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Core components
import { GuidanceCompiler, createCompiler } from './compiler.js';
import { ShardRetriever, createRetriever, HashEmbeddingProvider } from './retriever.js';
import { EnforcementGates, createGates } from './gates.js';
import { RunLedger, createLedger } from './ledger.js';
import { OptimizerLoop, createOptimizer } from './optimizer.js';
import { HeadlessRunner, createHeadlessRunner } from './headless.js';
import { DeterministicToolGateway, createToolGateway } from './gateway.js';

// Re-export all types
export type {
  // Core types
  RiskClass,
  ToolClass,
  TaskIntent,
  GuidanceRule,
  RuleShard,
  Constitution,
  RuleManifest,
  PolicyBundle,
  // Retrieval
  RetrievalRequest,
  RetrievalResult,
  // Gates
  GateDecision,
  GateResult,
  GateConfig,
  // Ledger
  RunEvent,
  Violation,
  EvaluatorResult,
  // Optimizer
  ViolationRanking,
  RuleChange,
  ABTestResult,
  OptimizationMetrics,
  RuleADR,
  // Control Plane
  GuidanceControlPlaneConfig,
  ControlPlaneStatus,
} from './types.js';

// Re-export components
export { GuidanceCompiler, createCompiler } from './compiler.js';
export type { CompilerConfig } from './compiler.js';
export { ShardRetriever, createRetriever, HashEmbeddingProvider } from './retriever.js';
export type { IEmbeddingProvider } from './retriever.js';
export { EnforcementGates, createGates } from './gates.js';
export {
  GuidanceHookProvider,
  createGuidanceHooks,
  gateResultsToHookResult,
} from './hooks.js';
export {
  RunLedger,
  createLedger,
  TestsPassEvaluator,
  ForbiddenCommandEvaluator,
  ForbiddenDependencyEvaluator,
  ViolationRateEvaluator,
  DiffQualityEvaluator,
} from './ledger.js';
export type { IEvaluator } from './ledger.js';
export { OptimizerLoop, createOptimizer } from './optimizer.js';
export type { OptimizerConfig } from './optimizer.js';
export {
  PersistentLedger,
  EventStore,
  createPersistentLedger,
  createEventStore,
} from './persistence.js';
export type { PersistenceConfig, StorageStats } from './persistence.js';
export {
  HeadlessRunner,
  createHeadlessRunner,
  ProcessExecutor,
  createComplianceSuite,
} from './headless.js';
export type {
  TestTask,
  TaskAssertion,
  TaskRunResult,
  HeadlessOutput,
  SuiteRunSummary,
  ICommandExecutor,
} from './headless.js';
export { DeterministicToolGateway, createToolGateway } from './gateway.js';
export type {
  ToolSchema,
  Budget,
  IdempotencyRecord,
  GatewayDecision,
  ToolGatewayConfig,
} from './gateway.js';
export { ArtifactLedger, createArtifactLedger } from './artifacts.js';
export type {
  ArtifactKind,
  Artifact,
  ArtifactLineage,
  ArtifactVerification,
  ArtifactSearchQuery,
  ArtifactStats,
  ArtifactLedgerConfig,
  RecordArtifactParams,
  SerializedArtifactLedger,
} from './artifacts.js';
export { EvolutionPipeline, createEvolutionPipeline } from './evolution.js';
export type {
  ChangeProposalKind,
  ProposalStatus,
  RiskAssessment,
  ChangeProposal,
  DecisionDiff,
  SimulationResult,
  RolloutStage,
  StagedRollout,
  EvolutionHistoryEntry,
  TraceEvaluator,
  EvolutionPipelineConfig,
} from './evolution.js';
export {
  ManifestValidator,
  ConformanceSuite,
  createManifestValidator,
  createConformanceSuite,
} from './manifest-validator.js';
export type {
  AgentCellManifest,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GoldenTrace,
  GoldenTraceEvent,
  ConformanceResult,
} from './manifest-validator.js';
export { ProofChain, createProofChain } from './proof.js';
export type {
  ToolCallRecord,
  MemoryOperation,
  MemoryLineageEntry,
  ProofEnvelopeMetadata,
  ProofEnvelope,
  SerializedProofChain,
} from './proof.js';
export {
  MemoryWriteGate,
  createMemoryWriteGate,
  createMemoryEntry,
} from './memory-gate.js';
export type {
  MemoryAuthority,
  MemoryEntry,
  WriteDecision,
  MemoryWriteGateConfig,
} from './memory-gate.js';
export {
  CoherenceScheduler,
  EconomicGovernor,
  createCoherenceScheduler,
  createEconomicGovernor,
} from './coherence.js';
export type {
  CoherenceScore,
  CoherenceThresholds,
  PrivilegeLevel,
  BudgetUsage,
  CoherenceSchedulerConfig,
  EconomicGovernorConfig,
} from './coherence.js';
export { CapabilityAlgebra, createCapabilityAlgebra } from './capabilities.js';
export type {
  CapabilityScope,
  CapabilityConstraint,
  Attestation,
  Capability,
  CapabilityCheckResult,
} from './capabilities.js';
export {
  SimulatedRuntime,
  MemoryClerkCell,
  ConformanceRunner,
  createMemoryClerkCell,
  createConformanceRunner,
} from './conformance-kit.js';
export type {
  TraceEvent as CellTraceEvent,
  CellRunResult,
  CellRuntime,
  AgentCell,
  SimulatedRuntimeConfig,
  ConformanceTestResult,
  ReplayTestResult,
} from './conformance-kit.js';
export {
  RuvBotGuidanceBridge,
  AIDefenceGate,
  RuvBotMemoryAdapter,
  createRuvBotBridge,
  createAIDefenceGate,
  createRuvBotMemoryAdapter,
} from './ruvbot-integration.js';
export type {
  RuvBotInstance,
  RuvBotAIDefenceGuard,
  RuvBotMemory,
  AIDefenceThreat,
  AIDefenceResult,
  AIDefenceGateConfig,
  RuvBotBridgeConfig,
  RuvBotEvent,
} from './ruvbot-integration.js';
export { MetaGovernor, createMetaGovernor } from './meta-governance.js';
export type {
  InvariantCheckResult,
  GovernanceState,
  ConstitutionalInvariant,
  AmendmentChange,
  Amendment,
  OptimizerConstraint,
  OptimizerAction,
  OptimizerValidation,
  InvariantReport,
  MetaGovernanceConfig,
} from './meta-governance.js';
export {
  ThreatDetector,
  CollusionDetector,
  MemoryQuorum,
  createThreatDetector,
  createCollusionDetector,
  createMemoryQuorum,
} from './adversarial.js';
export type {
  ThreatCategory,
  ThreatSignal,
  DetectionPattern,
  CollusionReport,
  MemoryProposal,
  QuorumResult,
  ThreatDetectorConfig,
  CollusionDetectorConfig,
  MemoryQuorumConfig,
} from './adversarial.js';
export { ContinueGate, createContinueGate } from './continue-gate.js';
export type {
  ContinueGateConfig,
  StepContext,
  ContinueDecision,
} from './continue-gate.js';

// WASM Kernel exports
export {
  getKernel,
  isWasmAvailable,
  resetKernel,
} from './wasm-kernel.js';
export type {
  WasmKernel,
  BatchOp,
  BatchResult,
} from './wasm-kernel.js';
export {
  generateClaudeMd,
  generateClaudeLocalMd,
  generateSkillMd,
  generateAgentMd,
  generateAgentIndex,
  scaffold,
} from './generators.js';
export type {
  ProjectProfile,
  LocalProfile,
  SkillDefinition,
  AgentDefinition,
  ScaffoldOptions,
  ScaffoldResult,
} from './generators.js';
export {
  analyze,
  benchmark,
  autoOptimize,
  optimizeForSize,
  headlessBenchmark,
  validateEffect,
  abBenchmark,
  getDefaultABTasks,
  formatReport,
  formatBenchmark,
} from './analyzer.js';
export type {
  AnalysisResult,
  AnalysisMetrics,
  DimensionScore,
  Suggestion,
  BenchmarkResult,
  ContextSize,
  OptimizeOptions,
  HeadlessBenchmarkResult,
  HeadlessTaskResult,
  IHeadlessExecutor,
  IContentAwareExecutor,
  ValidationAssertion,
  ValidationTask,
  ValidationTaskResult,
  ValidationRun,
  CorrelationResult,
  ValidationReport,
  ABTaskClass,
  ABTask,
  ABGatePattern,
  ABTaskResult,
  ABMetrics,
  ABReport,
} from './analyzer.js';

export {
  TrustAccumulator,
  TrustLedger as TrustScoreLedger,
  TrustSystem,
  getTrustBasedRateLimit,
  createTrustAccumulator,
  createTrustSystem,
} from './trust.js';
export type {
  TrustTier,
  GateOutcome,
  TrustConfig,
  TrustRecord,
  TrustSnapshot,
} from './trust.js';
export {
  TruthAnchorStore,
  TruthResolver,
  createTruthAnchorStore,
  createTruthResolver,
} from './truth-anchors.js';
export type {
  TruthSourceKind,
  TruthAnchor,
  TruthAnchorConfig,
  AnchorParams,
  TruthAnchorQuery,
  VerifyAllResult,
  ConflictResolution,
} from './truth-anchors.js';
export {
  UncertaintyLedger,
  UncertaintyAggregator,
  createUncertaintyLedger,
  createUncertaintyAggregator,
} from './uncertainty.js';
export type {
  BeliefStatus,
  ConfidenceInterval,
  Belief,
  UncertaintyConfig,
} from './uncertainty.js';
export {
  TemporalStore,
  TemporalReasoner,
  createTemporalStore,
  createTemporalReasoner,
} from './temporal.js';
export type {
  TemporalStatus,
  ValidityWindow,
  TemporalAssertion,
  TemporalTimeline,
  TemporalChange,
  TemporalConfig,
} from './temporal.js';
export {
  AuthorityGate,
  IrreversibilityClassifier,
  createAuthorityGate,
  createIrreversibilityClassifier,
  isHigherAuthority,
  getAuthorityHierarchy,
} from './authority.js';
export type {
  AuthorityLevel,
  IrreversibilityClass,
  ProofLevel,
  AuthorityScope,
  HumanIntervention,
  AuthorityCheckResult,
  IrreversibilityResult,
  AuthorityGateConfig,
  IrreversibilityClassifierConfig,
} from './authority.js';

import type {
  PolicyBundle,
  GuidanceControlPlaneConfig,
  ControlPlaneStatus,
  RetrievalRequest,
  RetrievalResult,
  GateResult,
  RunEvent,
  EvaluatorResult,
  TaskIntent,
  Violation,
} from './types.js';


// The GuidanceControlPlane facade + factory were extracted into
// ./control-plane.ts during campaign-2 wave 92 (W298). Re-export them so
// the package surface is unchanged.
export { GuidanceControlPlane, createGuidanceControlPlane } from './control-plane.js';

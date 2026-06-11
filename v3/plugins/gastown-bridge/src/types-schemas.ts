/**
 * Gas Town Bridge — zod schemas & validation functions
 *
 * Extracted verbatim from types.ts (lines 480-878) during campaign-2
 * wave 33 (W239). types.ts stays the barrel.
 */

import { z } from 'zod';
import type {
  Bead,
  Convoy,
  CookedFormula,
  CreateBeadOptions,
  CreateConvoyOptions,
  Formula,
  FormulaType,
  GasTownAgent,
  GasTownAgentRole,
  GasTownConfig,
  GasTownMail,
  SlingOptions,
  SlingTarget,
  Step,
} from './types-domain.js';

// Zod Schemas
// ============================================================================

/**
 * Bead status schema
 */
export const BeadStatusSchema = z.enum(['open', 'in_progress', 'closed']);

/**
 * Bead schema
 */
export const BeadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: BeadStatusSchema,
  priority: z.number().int().min(0),
  labels: z.array(z.string()),
  parentId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  assignee: z.string().optional(),
  rig: z.string().optional(),
  blockedBy: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
});

/**
 * Create bead options schema
 */
export const CreateBeadOptionsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  labels: z.array(z.string()).optional(),
  parent: z.string().optional(),
  rig: z.string().optional(),
  assignee: z.string().optional(),
});

/**
 * Formula type schema
 */
export const FormulaTypeSchema = z.enum(['convoy', 'workflow', 'expansion', 'aspect']);

/**
 * Step schema
 */
export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  needs: z.array(z.string()).optional(),
  duration: z.number().optional(),
  requires: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Leg schema
 */
export const LegSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  focus: z.string(),
  description: z.string(),
  agent: z.string().optional(),
  order: z.number().optional(),
});

/**
 * Variable schema
 */
export const VarSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  default: z.string().optional(),
  required: z.boolean().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
});

/**
 * Synthesis schema
 */
export const SynthesisSchema = z.object({
  strategy: z.enum(['merge', 'sequential', 'parallel']),
  format: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Template schema
 */
export const TemplateSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
  outputPath: z.string().optional(),
});

/**
 * Aspect schema
 */
export const AspectSchema = z.object({
  name: z.string().min(1),
  pointcut: z.string(),
  advice: z.string(),
  type: z.enum(['before', 'after', 'around']),
});

/**
 * Formula schema
 */
export const FormulaSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  type: FormulaTypeSchema,
  version: z.number().int().min(1),
  legs: z.array(LegSchema).optional(),
  synthesis: SynthesisSchema.optional(),
  steps: z.array(StepSchema).optional(),
  vars: z.record(VarSchema).optional(),
  templates: z.array(TemplateSchema).optional(),
  aspects: z.array(AspectSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Convoy status schema
 */
export const ConvoyStatusSchema = z.enum(['active', 'landed', 'failed', 'paused']);

/**
 * Convoy progress schema
 */
export const ConvoyProgressSchema = z.object({
  total: z.number().int().min(0),
  closed: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  blocked: z.number().int().min(0),
});

/**
 * Convoy schema
 */
export const ConvoySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trackedIssues: z.array(z.string()),
  status: ConvoyStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  progress: ConvoyProgressSchema,
  formula: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Create convoy options schema
 */
export const CreateConvoyOptionsSchema = z.object({
  name: z.string().min(1),
  issues: z.array(z.string()).min(1),
  description: z.string().optional(),
  formula: z.string().optional(),
});

/**
 * Gas Town agent role schema
 */
export const GasTownAgentRoleSchema = z.enum([
  'mayor',
  'polecat',
  'refinery',
  'witness',
  'deacon',
  'dog',
  'crew',
]);

/**
 * Sling target schema
 */
export const SlingTargetSchema = z.enum(['polecat', 'crew', 'mayor']);

/**
 * Sling options schema
 */
export const SlingOptionsSchema = z.object({
  beadId: z.string().min(1),
  target: SlingTargetSchema,
  formula: z.string().optional(),
  priority: z.number().int().min(0).optional(),
});

/**
 * Sync direction schema
 */
export const SyncDirectionSchema = z.enum(['pull', 'push', 'both']);

/**
 * Configuration schema
 */
export const GasTownConfigSchema = z.object({
  townRoot: z.string().default('~/gt'),
  enableBeadsSync: z.boolean().default(true),
  syncInterval: z.number().int().positive().default(60000),
  nativeFormulas: z.boolean().default(true),
  enableConvoys: z.boolean().default(true),
  autoCreateBeads: z.boolean().default(false),
  enableGUPP: z.boolean().default(false),
  guppCheckInterval: z.number().int().positive().default(5000),
  cliTimeout: z.number().int().positive().default(30000),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate bead
 */
export function validateBead(input: unknown): Bead {
  return BeadSchema.parse(input) as Bead;
}

/**
 * Validate create bead options
 */
export function validateCreateBeadOptions(input: unknown): CreateBeadOptions {
  return CreateBeadOptionsSchema.parse(input);
}

/**
 * Validate formula
 */
export function validateFormula(input: unknown): Formula {
  return FormulaSchema.parse(input) as Formula;
}

/**
 * Validate convoy
 */
export function validateConvoy(input: unknown): Convoy {
  return ConvoySchema.parse(input) as Convoy;
}

/**
 * Validate create convoy options
 */
export function validateCreateConvoyOptions(input: unknown): CreateConvoyOptions {
  return CreateConvoyOptionsSchema.parse(input);
}

/**
 * Validate sling options
 */
export function validateSlingOptions(input: unknown): SlingOptions {
  return SlingOptionsSchema.parse(input);
}

/**
 * Validate configuration
 */
export function validateConfig(input: unknown): GasTownConfig {
  return GasTownConfigSchema.parse(input);
}

// ============================================================================
// Additional Types for MCP Tools
// ============================================================================

/**
 * Dependency action type
 */
export type DepAction = 'add' | 'remove';

/**
 * Convoy action type
 */
export type ConvoyAction = 'create' | 'track' | 'land' | 'pause' | 'resume';

/**
 * Mail action type
 */
export type MailAction = 'send' | 'read' | 'list';

/**
 * Agent role type (alias for GasTownAgentRole)
 */
export type AgentRole = GasTownAgentRole;

/**
 * Target agent type (alias for SlingTarget)
 */
export type TargetAgent = SlingTarget;

/**
 * Convoy strategy type
 */
export type ConvoyStrategy = 'parallel' | 'serial' | 'hybrid' | 'fastest' | 'balanced' | 'throughput' | 'minimal_context_switches';

/**
 * Dependency action type (for graph operations)
 */
export type DependencyAction = 'topo_sort' | 'cycle_detect' | 'critical_path';

/**
 * Formula AST (Abstract Syntax Tree) - alias for Formula
 */
export type FormulaAST = Formula;

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  readonly action: DependencyAction;
  readonly sorted?: string[];
  readonly hasCycle?: boolean;
  readonly cycleNodes?: string[];
  readonly criticalPath?: string[];
  readonly totalDuration?: number;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  readonly index: number;
  readonly candidate: string;
  readonly similarity: number;
}

/**
 * Convoy optimization result
 */
export interface ConvoyOptimization {
  readonly convoyId: string;
  readonly strategy: string;
  readonly executionOrder: string[];
  readonly parallelGroups: string[][];
  readonly estimatedDuration: number;
}

// ============================================================================
// Interface Types for MCP Tools
// ============================================================================

/**
 * Gas Town Bridge interface
 */
export interface IGasTownBridge {
  createBead(opts: CreateBeadOptions): Promise<Bead>;
  getReady(limit?: number, rig?: string, labels?: string[]): Promise<Bead[]>;
  showBead(beadId: string): Promise<{ bead: Bead; dependencies: string[]; dependents: string[] }>;
  manageDependency(action: DepAction, child: string, parent: string): Promise<void>;
  createConvoy(opts: CreateConvoyOptions): Promise<Convoy>;
  getConvoyStatus(convoyId?: string, detailed?: boolean): Promise<Convoy[]>;
  trackConvoy(convoyId: string, action: 'add' | 'remove', issues: string[]): Promise<void>;
  listFormulas(type?: FormulaType, includeBuiltin?: boolean): Promise<Array<{ name: string; type: FormulaType; description: string; builtin: boolean }>>;
  cookFormula(formula: Formula | string, vars: Record<string, string>): Promise<CookedFormula>;
  executeFormula(formula: Formula | string, vars: Record<string, string>, targetAgent?: string, dryRun?: boolean): Promise<{ beads_created: string[] }>;
  createFormula(opts: { name: string; type: FormulaType; steps?: Step[]; vars?: Record<string, unknown>; description?: string }): Promise<{ path: string }>;
  sling(beadId: string, target: SlingTarget, formula?: string, priority?: number): Promise<void>;
  listAgents(rig?: string, role?: AgentRole, includeInactive?: boolean): Promise<GasTownAgent[]>;
  sendMail(to: string, subject: string, body: string): Promise<string>;
  readMail(mailId: string): Promise<GasTownMail>;
  listMail(limit?: number): Promise<GasTownMail[]>;
}

/**
 * Beads sync service interface
 */
export interface IBeadsSyncService {
  pullBeads(rig?: string, namespace?: string): Promise<{ synced: number; conflicts: number }>;
  pushTasks(namespace?: string): Promise<{ pushed: number; conflicts: number }>;
}

/**
 * Formula WASM interface
 */
export interface IFormulaWasm {
  isInitialized(): boolean;
  initialize(): Promise<void>;
  parseFormula(content: string, validate?: boolean): Promise<Formula>;
  cookFormula(formula: Formula | string, vars: Record<string, string>, isContent?: boolean): Promise<CookedFormula>;
  cookBatch(formulas: Array<{ name: string; content: string }>, vars: Record<string, string>[], continueOnError?: boolean): Promise<{ cooked: CookedFormula[]; errors: Array<{ index: number; error: string }> }>;
}

/**
 * Dependency WASM interface
 */
export interface IDependencyWasm {
  isInitialized(): boolean;
  initialize(): Promise<void>;
  resolveDependencies(beads: Array<{ id: string; dependencies?: string[] }>, action: DependencyAction): Promise<DependencyResolution>;
  matchPatterns(query: string, candidates: string[], k: number, threshold: number): Promise<PatternMatch[]>;
  optimizeConvoy(convoy: { id: string; trackedIssues: string[] }, strategy: ConvoyStrategy, constraints?: unknown): Promise<ConvoyOptimization>;
}

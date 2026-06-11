/**
 * GUPP State — constants, types & zod schemas
 *
 * Extracted verbatim from state.ts (lines 21-273) during campaign-2
 * wave 78 (W284). state.ts stays the barrel.
 */

import { z } from 'zod';
import type { Convoy, Formula } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default state file path
 */
export const DEFAULT_STATE_PATH = '.gupp/state.json';

/**
 * AgentDB namespace for GUPP state
 */
export const AGENTDB_NAMESPACE = 'gupp:state';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Work item status
 */
export type WorkItemStatus = 'pending' | 'active' | 'paused' | 'blocked' | 'completed' | 'failed';

/**
 * Work item on the hook
 */
export interface HookedWorkItem {
  /** Unique work item ID */
  readonly id: string;
  /** Associated bead ID (if any) */
  readonly beadId?: string;
  /** Associated convoy ID (if any) */
  readonly convoyId?: string;
  /** Work item title/description */
  readonly title: string;
  /** Current status */
  readonly status: WorkItemStatus;
  /** Priority (0 = highest) */
  readonly priority: number;
  /** When the work was hooked */
  readonly hookedAt: Date;
  /** When the work was last updated */
  readonly updatedAt: Date;
  /** Assigned agent */
  readonly assignee?: string;
  /** Formula applied to this work */
  readonly formula?: string;
  /** Progress percentage (0-100) */
  readonly progress: number;
  /** Error message if failed */
  readonly error?: string;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Session information
 */
export interface SessionInfo {
  /** Session ID */
  readonly id: string;
  /** When the session started */
  readonly startedAt: Date;
  /** When the session was last active */
  readonly lastActiveAt: Date;
  /** Whether the session is currently active */
  readonly active: boolean;
  /** Session owner/initiator */
  readonly owner?: string;
}

/**
 * GUPP State - Complete state for crash recovery
 */
export interface GuppState {
  /** State schema version */
  readonly version: number;
  /** Current session information */
  readonly session?: SessionInfo;
  /** Active convoys */
  readonly convoys: Convoy[];
  /** Active formulas (being executed) */
  readonly formulas: Array<{
    readonly name: string;
    readonly formula: Formula;
    readonly vars: Record<string, string>;
    readonly startedAt: Date;
    readonly status: 'cooking' | 'cooked' | 'executing' | 'completed' | 'failed';
  }>;
  /** Work items on the hook (GUPP principle) */
  readonly hookedWork: HookedWorkItem[];
  /** Last state update timestamp */
  readonly updatedAt: Date;
  /** State checksum for integrity verification */
  readonly checksum?: string;
  /** Recovery metadata */
  readonly recovery?: {
    readonly lastCrash?: Date;
    readonly crashCount: number;
    readonly autoRecoverEnabled: boolean;
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Work item status schema
 */
export const WorkItemStatusSchema = z.enum([
  'pending',
  'active',
  'paused',
  'blocked',
  'completed',
  'failed',
]);

/**
 * Hooked work item schema
 */
export const HookedWorkItemSchema = z.object({
  id: z.string().min(1),
  beadId: z.string().optional(),
  convoyId: z.string().optional(),
  title: z.string().min(1),
  status: WorkItemStatusSchema,
  priority: z.number().int().min(0),
  hookedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  assignee: z.string().optional(),
  formula: z.string().optional(),
  progress: z.number().min(0).max(100),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Session info schema
 */
export const SessionInfoSchema = z.object({
  id: z.string().min(1),
  startedAt: z.coerce.date(),
  lastActiveAt: z.coerce.date(),
  active: z.boolean(),
  owner: z.string().optional(),
});

/**
 * Leg schema (for formula legs)
 */
export const LegSchema = z.object({
  id: z.string(),
  title: z.string(),
  focus: z.string(),
  description: z.string(),
  agent: z.string().optional(),
  order: z.number().optional(),
});

/**
 * Step schema (for formula steps)
 */
export const StepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  needs: z.array(z.string()).optional(),
  duration: z.number().optional(),
  requires: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Var schema (for formula variables)
 */
export const VarSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  default: z.string().optional(),
  required: z.boolean().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
});

/**
 * Formula state schema
 */
export const FormulaStateSchema = z.object({
  name: z.string(),
  formula: z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['convoy', 'workflow', 'expansion', 'aspect']),
    version: z.number(),
    legs: z.array(LegSchema).optional(),
    steps: z.array(StepSchema).optional(),
    vars: z.record(VarSchema).optional(),
  }),
  vars: z.record(z.string()),
  startedAt: z.coerce.date(),
  status: z.enum(['cooking', 'cooked', 'executing', 'completed', 'failed']),
});

/**
 * Recovery metadata schema
 */
export const RecoveryMetadataSchema = z.object({
  lastCrash: z.coerce.date().optional(),
  crashCount: z.number().int().min(0),
  autoRecoverEnabled: z.boolean(),
});

/**
 * Convoy progress schema (for validation)
 */
export const ConvoyProgressSchema = z.object({
  total: z.number().int().min(0),
  closed: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  blocked: z.number().int().min(0),
});

/**
 * Convoy schema (for validation)
 */
export const ConvoySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trackedIssues: z.array(z.string()),
  status: z.enum(['active', 'landed', 'failed', 'paused']),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  progress: ConvoyProgressSchema,
  formula: z.string().optional(),
  description: z.string().optional(),
});

/**
 * GUPP state schema
 */
export const GuppStateSchema = z.object({
  version: z.number().int().min(1),
  session: SessionInfoSchema.optional(),
  convoys: z.array(ConvoySchema),
  formulas: z.array(FormulaStateSchema),
  hookedWork: z.array(HookedWorkItemSchema),
  updatedAt: z.coerce.date(),
  checksum: z.string().optional(),
  recovery: RecoveryMetadataSchema.optional(),
});


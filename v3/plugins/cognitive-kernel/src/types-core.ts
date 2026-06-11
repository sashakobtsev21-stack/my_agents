/**
 * Cognitive Kernel types — core
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import { z } from 'zod';
import type {
  CognitiveBridgeInterface,
  CognitiveKernelConfig,
  SonaBridgeInterface,
} from './types-extended.js';

// ============================================================================
// Common Types
// ============================================================================

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  category?: string;
  tags?: string[];
  version?: string;
  cacheable?: boolean;
  cacheTTL?: number;
  handler: (input: Record<string, unknown>, context?: ToolContext) => Promise<MCPToolResult>;
}

// ============================================================================
// Tool Context
// ============================================================================

export interface ToolContext {
  cognitiveBridge?: CognitiveBridgeInterface;
  sonaBridge?: SonaBridgeInterface;
  config?: CognitiveKernelConfig;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// Working Memory Types
// ============================================================================

export const WorkingMemoryActionSchema = z.enum([
  'allocate',
  'update',
  'retrieve',
  'clear',
  'consolidate',
]);

export type WorkingMemoryAction = z.infer<typeof WorkingMemoryActionSchema>;

export const ConsolidationTargetSchema = z.enum([
  'episodic',
  'semantic',
  'procedural',
]);

export type ConsolidationTarget = z.infer<typeof ConsolidationTargetSchema>;

export const MemorySlotSchema = z.object({
  id: z.string().max(100).optional(),
  content: z.unknown().optional(),
  priority: z.number().min(0).max(1).default(0.5),
  decay: z.number().min(0).max(1).default(0.1),
});

export type MemorySlot = z.infer<typeof MemorySlotSchema>;

export const WorkingMemoryInputSchema = z.object({
  action: WorkingMemoryActionSchema.describe('Memory action to perform'),
  slot: MemorySlotSchema.optional().describe('Memory slot data'),
  capacity: z.number().int().min(1).max(20).default(7)
    .describe('Working memory capacity (Miller number)'),
  consolidationTarget: ConsolidationTargetSchema.optional()
    .describe('Target memory system for consolidation'),
});

export type WorkingMemoryInput = z.infer<typeof WorkingMemoryInputSchema>;

export interface WorkingMemorySlot {
  id: string;
  content: unknown;
  priority: number;
  decay: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface WorkingMemoryState {
  slots: WorkingMemorySlot[];
  capacity: number;
  utilization: number;
  avgPriority: number;
}

export interface WorkingMemoryOutput {
  action: WorkingMemoryAction;
  success: boolean;
  state: {
    slotsUsed: number;
    capacity: number;
    utilization: number;
  };
  details: {
    slotId?: string;
    content?: unknown;
    avgPriority: number;
    interpretation: string;
  };
}

// ============================================================================
// Attention Control Types
// ============================================================================

export const AttentionModeSchema = z.enum([
  'focus',
  'diffuse',
  'selective',
  'divided',
  'sustained',
]);

export type AttentionMode = z.infer<typeof AttentionModeSchema>;

export const AttentionTargetSchema = z.object({
  entity: z.string().max(500),
  weight: z.number().min(0).max(1),
  duration: z.number().min(0).max(3600),
});

export type AttentionTarget = z.infer<typeof AttentionTargetSchema>;

export const AttentionFiltersSchema = z.object({
  includePatterns: z.array(z.string().max(200)).max(50).optional(),
  excludePatterns: z.array(z.string().max(200)).max(50).optional(),
  noveltyBias: z.number().min(0).max(1).default(0.5),
});

export type AttentionFilters = z.infer<typeof AttentionFiltersSchema>;

export const AttentionControlInputSchema = z.object({
  mode: AttentionModeSchema.describe('Attention mode'),
  targets: z.array(AttentionTargetSchema).max(50).optional()
    .describe('Attention targets with weights'),
  filters: AttentionFiltersSchema.optional()
    .describe('Attention filters'),
});

export type AttentionControlInput = z.infer<typeof AttentionControlInputSchema>;

export interface AttentionState {
  mode: AttentionMode;
  focus: string[];
  breadth: number;
  intensity: number;
  filters: AttentionFilters;
  distractors: string[];
}

export interface AttentionControlOutput {
  mode: AttentionMode;
  state: {
    focus: string[];
    breadth: number;
    intensity: number;
  };
  details: {
    targetsActive: number;
    filterPatterns: number;
    interpretation: string;
  };
}

// ============================================================================
// Meta-Cognition Types
// ============================================================================

export const MonitoringTypeSchema = z.enum([
  'confidence_calibration',
  'reasoning_coherence',
  'goal_tracking',
  'cognitive_load',
  'error_detection',
  'uncertainty_estimation',
]);

export type MonitoringType = z.infer<typeof MonitoringTypeSchema>;

export const ReflectionTriggerSchema = z.enum([
  'periodic',
  'on_error',
  'on_uncertainty',
]);

export type ReflectionTrigger = z.infer<typeof ReflectionTriggerSchema>;

export const ReflectionDepthSchema = z.enum([
  'shallow',
  'medium',
  'deep',
]);

export type ReflectionDepth = z.infer<typeof ReflectionDepthSchema>;

export const ReflectionSchema = z.object({
  trigger: ReflectionTriggerSchema.optional(),
  depth: ReflectionDepthSchema.optional(),
});

export type Reflection = z.infer<typeof ReflectionSchema>;

export const MetaMonitorInputSchema = z.object({
  monitoring: z.array(MonitoringTypeSchema).optional()
    .describe('Types of monitoring to perform'),
  reflection: ReflectionSchema.optional()
    .describe('Reflection configuration'),
  interventions: z.boolean().default(true)
    .describe('Allow automatic corrective interventions'),
});

export type MetaMonitorInput = z.infer<typeof MetaMonitorInputSchema>;

export interface MetaCognitiveAssessment {
  confidence: number;
  uncertainty: number;
  coherence: number;
  cognitiveLoad: number;
  errorsDetected: number;
  knowledgeGaps: string[];
  suggestedStrategies: string[];
}

export interface MetaMonitorOutput {
  assessment: {
    confidence: number;
    uncertainty: number;
    coherence: number;
    cognitiveLoad: number;
  };
  interventions: string[];
  details: {
    monitoringTypes: MonitoringType[];
    reflectionDepth: ReflectionDepth | null;
    errorsDetected: number;
    interpretation: string;
  };
}

// ============================================================================
// Scaffolding Types
// ============================================================================

export const TaskComplexitySchema = z.enum([
  'simple',
  'moderate',
  'complex',
  'expert',
]);


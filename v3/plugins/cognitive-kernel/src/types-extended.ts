/**
 * Cognitive Kernel types — extended
 *
 * Extracted verbatim during campaign-2 wave W305. Barrel stays.
 */
import { z } from 'zod';
import {
  TaskComplexitySchema,
} from './types-core.js';
import type {
  AttentionMode,
  MCPToolResult,
  MetaCognitiveAssessment,
} from './types-core.js';

export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

export const ScaffoldTypeSchema = z.enum([
  'decomposition',
  'analogy',
  'worked_example',
  'socratic',
  'metacognitive_prompting',
  'chain_of_thought',
]);

export type ScaffoldType = z.infer<typeof ScaffoldTypeSchema>;

export const TaskSchema = z.object({
  description: z.string().max(5000),
  complexity: TaskComplexitySchema,
  domain: z.string().max(200).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const AdaptivitySchema = z.object({
  fading: z.boolean().default(true),
  monitoring: z.boolean().default(true),
});

export type Adaptivity = z.infer<typeof AdaptivitySchema>;

export const ScaffoldInputSchema = z.object({
  task: TaskSchema.describe('Task to scaffold'),
  scaffoldType: ScaffoldTypeSchema.describe('Type of scaffolding'),
  adaptivity: AdaptivitySchema.optional()
    .describe('Adaptivity settings'),
});

export type ScaffoldInput = z.infer<typeof ScaffoldInputSchema>;

export interface ScaffoldStep {
  step: number;
  instruction: string;
  hints: string[];
  checkpoints: string[];
}

export interface ScaffoldOutput {
  scaffoldType: ScaffoldType;
  steps: ScaffoldStep[];
  details: {
    taskComplexity: TaskComplexity;
    stepCount: number;
    fadingEnabled: boolean;
    interpretation: string;
  };
}

// ============================================================================
// Cognitive Load Types
// ============================================================================

export const LoadOptimizationSchema = z.enum([
  'reduce_extraneous',
  'chunk_intrinsic',
  'maximize_germane',
  'balanced',
]);

export type LoadOptimization = z.infer<typeof LoadOptimizationSchema>;

export const LoadAssessmentSchema = z.object({
  intrinsic: z.number().min(0).max(1).optional()
    .describe('Task complexity load'),
  extraneous: z.number().min(0).max(1).optional()
    .describe('Presentation complexity load'),
  germane: z.number().min(0).max(1).optional()
    .describe('Learning investment load'),
});

export type LoadAssessment = z.infer<typeof LoadAssessmentSchema>;

export const CognitiveLoadInputSchema = z.object({
  assessment: LoadAssessmentSchema.optional()
    .describe('Current load assessment'),
  optimization: LoadOptimizationSchema.default('balanced')
    .describe('Optimization strategy'),
  threshold: z.number().min(0).max(1).default(0.8)
    .describe('Maximum total load threshold'),
});

export type CognitiveLoadInput = z.infer<typeof CognitiveLoadInputSchema>;

export interface CognitiveLoadState {
  intrinsic: number;
  extraneous: number;
  germane: number;
  total: number;
  overloaded: boolean;
}

export interface CognitiveLoadOutput {
  currentLoad: {
    intrinsic: number;
    extraneous: number;
    germane: number;
    total: number;
  };
  overloaded: boolean;
  recommendations: string[];
  details: {
    optimization: LoadOptimization;
    threshold: number;
    interpretation: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CognitiveKernelConfig {
  workingMemory: {
    defaultCapacity: number;
    decayRate: number;
    consolidationInterval: number;
  };
  attention: {
    defaultMode: AttentionMode;
    sustainedDuration: number;
    noveltyBias: number;
  };
  metaCognition: {
    reflectionInterval: number;
    confidenceThreshold: number;
    interventionEnabled: boolean;
  };
  scaffolding: {
    fadingRate: number;
    adaptationEnabled: boolean;
  };
  cognitiveLoad: {
    maxLoad: number;
    warningThreshold: number;
  };
}

export const DEFAULT_CONFIG: CognitiveKernelConfig = {
  workingMemory: {
    defaultCapacity: 7,
    decayRate: 0.1,
    consolidationInterval: 60000,
  },
  attention: {
    defaultMode: 'focus',
    sustainedDuration: 300,
    noveltyBias: 0.5,
  },
  metaCognition: {
    reflectionInterval: 30000,
    confidenceThreshold: 0.7,
    interventionEnabled: true,
  },
  scaffolding: {
    fadingRate: 0.1,
    adaptationEnabled: true,
  },
  cognitiveLoad: {
    maxLoad: 0.8,
    warningThreshold: 0.6,
  },
};

// ============================================================================
// Bridge Interfaces
// ============================================================================

export interface CognitiveItem {
  id: string;
  content: Float32Array;
  salience: number;
  decay: number;
  associations: string[];
  metadata?: Record<string, unknown>;
}

export interface CognitiveBridgeInterface {
  initialized: boolean;
  store(item: CognitiveItem): boolean;
  retrieve(id: string): CognitiveItem | null;
  search(query: Float32Array, k: number): CognitiveItem[];
  decay(deltaTime: number): void;
  consolidate(): void;
  focus(ids: string[]): { focus: string[]; breadth: number; intensity: number };
  assess(): MetaCognitiveAssessment;
  scaffold(task: string, difficulty: number): string[];
}

export interface SonaPattern {
  id: string;
  embedding: Float32Array;
  successRate: number;
  usageCount: number;
  domain: string;
}

export interface SonaBridgeInterface {
  initialized: boolean;
  learn(trajectories: unknown[], config: unknown): number;
  predict(state: Float32Array): { action: string; confidence: number };
  storePattern(pattern: SonaPattern): void;
  findPatterns(query: Float32Array, k: number): SonaPattern[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful MCP tool result
 */
export function successResult(data: unknown): MCPToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Create an error MCP tool result
 */
export function errorResult(error: Error | string): MCPToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: true,
        message,
        timestamp: new Date().toISOString(),
      }, null, 2),
    }],
    isError: true,
  };
}

/**
 * Calculate cognitive load from components
 */
export function calculateTotalLoad(
  intrinsic: number,
  extraneous: number,
  germane: number
): number {
  // Cognitive load theory: total = intrinsic + extraneous + germane
  // But they compete for limited resources
  return Math.min(1, (intrinsic + extraneous + germane) / 2);
}

/**
 * Generate scaffolding steps based on complexity
 */
export function generateScaffoldSteps(
  complexity: TaskComplexity,
  scaffoldType: ScaffoldType
): number {
  const complexityMultiplier: Record<TaskComplexity, number> = {
    simple: 2,
    moderate: 4,
    complex: 6,
    expert: 8,
  };

  return complexityMultiplier[complexity];
}

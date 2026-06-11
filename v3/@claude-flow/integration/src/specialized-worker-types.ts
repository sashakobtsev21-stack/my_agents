/**
 * Specialized Worker — domain types & embedding table
 *
 * Extracted verbatim from specialized-worker.ts (lines 30-160) during
 * campaign-2 wave 38 (W244). The 4 shapes are re-exported by the
 * barrel; DOMAIN_EMBEDDINGS stays unexported from it.
 */

import type { AgentOutput, WorkerArtifact, WorkerConfig } from './worker-base.js';
import type { Task } from './agentic-flow-agent.js';
// Type-only back-import (W208/W234 static-cycle shape): DomainHandlers
// references the worker class in its callback signatures.
import type { SpecializedWorker } from './specialized-worker.js';

export type DomainSpecialization =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'devops'
  | 'security'
  | 'performance'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'machine-learning'
  | 'data-engineering'
  | 'mobile'
  | 'infrastructure'
  | 'api-design'
  | 'code-review'
  | 'custom';

/**
 * Specialized worker configuration
 */
export interface SpecializedWorkerConfig extends WorkerConfig {
  /** Primary domain specialization */
  domain: DomainSpecialization;
  /** Secondary domains (ordered by proficiency) */
  secondaryDomains?: DomainSpecialization[];
  /** Domain-specific skills with proficiency levels (0.0-1.0) */
  skills?: Map<string, number> | Record<string, number>;
  /** Preferred programming languages */
  languages?: string[];
  /** Preferred frameworks */
  frameworks?: string[];
  /** Preferred tools */
  tools?: string[];
  /** Domain expertise level (0.0-1.0) */
  expertiseLevel?: number;
  /** Enable domain-specific preprocessing */
  enablePreprocessing?: boolean;
  /** Enable domain-specific postprocessing */
  enablePostprocessing?: boolean;
  /** Custom domain handlers */
  handlers?: DomainHandlers;
}

/**
 * Domain-specific handlers for specialized processing
 */
export interface DomainHandlers {
  /** Preprocess task before execution */
  preprocess?: (task: Task, worker: SpecializedWorker) => Promise<Task>;
  /** Postprocess output after execution */
  postprocess?: (output: AgentOutput, task: Task, worker: SpecializedWorker) => Promise<AgentOutput>;
  /** Validate task for domain compatibility */
  validate?: (task: Task, worker: SpecializedWorker) => Promise<boolean>;
  /** Generate domain-specific artifacts */
  generateArtifacts?: (output: AgentOutput, task: Task, worker: SpecializedWorker) => Promise<WorkerArtifact[]>;
}

/**
 * Task matching result with detailed scoring
 */
export interface TaskMatchResult {
  /** Overall match score (0.0-1.0) */
  score: number;
  /** Breakdown of scoring components */
  breakdown: {
    /** Capability match score */
    capabilityScore: number;
    /** Domain match score */
    domainScore: number;
    /** Embedding similarity score */
    embeddingScore: number;
    /** Skill match score */
    skillScore: number;
  };
  /** Whether worker meets minimum requirements */
  meetsRequirements: boolean;
  /** Missing capabilities */
  missingCapabilities: string[];
  /** Matched capabilities */
  matchedCapabilities: string[];
  /** Recommendations for better matching */
  recommendations?: string[];
}

/**
 * Domain embedding configurations
 */
export const DOMAIN_EMBEDDINGS: Record<DomainSpecialization, number[]> = {
  frontend: [1, 0, 0, 0, 0, 0.2, 0.3, 0.5, 0.2, 0, 0, 0.4, 0, 0.3, 0.2, 0],
  backend: [0, 1, 0.3, 0, 0, 0.3, 0.2, 0.3, 0.5, 0, 0.3, 0, 0.2, 0.5, 0.2, 0],
  database: [0, 0.3, 1, 0, 0, 0.4, 0.2, 0.2, 0.3, 0, 0.5, 0, 0.3, 0.4, 0.1, 0],
  devops: [0, 0.2, 0.2, 1, 0.3, 0.3, 0.2, 0.4, 0.3, 0, 0.2, 0, 0.8, 0.2, 0.1, 0],
  security: [0, 0.3, 0.3, 0.4, 1, 0.4, 0.5, 0.3, 0.3, 0, 0, 0, 0.3, 0.4, 0.6, 0],
  performance: [0.3, 0.4, 0.4, 0.3, 0.2, 1, 0.3, 0.2, 0.3, 0, 0, 0, 0.2, 0.2, 0.2, 0],
  testing: [0.3, 0.3, 0.2, 0.3, 0.4, 0.3, 1, 0.4, 0.2, 0, 0, 0.3, 0.2, 0.2, 0.3, 0],
  documentation: [0.4, 0.3, 0.2, 0.2, 0.2, 0.1, 0.3, 1, 0.3, 0, 0, 0.3, 0.1, 0.5, 0.2, 0],
  architecture: [0.3, 0.4, 0.4, 0.4, 0.4, 0.4, 0.3, 0.5, 1, 0.2, 0.3, 0.2, 0.4, 0.6, 0.4, 0],
  'machine-learning': [0.2, 0.3, 0.3, 0.2, 0.2, 0.5, 0.3, 0.3, 0.3, 1, 0.6, 0.2, 0.3, 0.3, 0.2, 0],
  'data-engineering': [0, 0.3, 0.6, 0.3, 0.2, 0.4, 0.2, 0.2, 0.4, 0.5, 1, 0, 0.4, 0.4, 0.2, 0],
  mobile: [0.5, 0.3, 0.2, 0.3, 0.3, 0.4, 0.4, 0.3, 0.3, 0.2, 0, 1, 0.2, 0.3, 0.2, 0],
  infrastructure: [0, 0.2, 0.3, 0.7, 0.4, 0.3, 0.2, 0.3, 0.5, 0, 0.3, 0, 1, 0.2, 0.3, 0],
  'api-design': [0.2, 0.6, 0.3, 0.2, 0.3, 0.3, 0.2, 0.6, 0.5, 0, 0.2, 0.2, 0.2, 1, 0.3, 0],
  'code-review': [0.4, 0.4, 0.3, 0.3, 0.5, 0.4, 0.5, 0.4, 0.4, 0.2, 0.2, 0.3, 0.2, 0.4, 1, 0],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
};

/**
 * SpecializedWorker - Domain-focused worker with intelligent matching
 *
 * Usage:
 * ```typescript
 * const worker = new SpecializedWorker({
 *   id: 'frontend-1',
 *   type: 'specialized',
 *   domain: 'frontend',
 *   capabilities: ['react', 'typescript', 'css'],
 *   skills: { react: 0.9, typescript: 0.85, css: 0.8 },
 *   languages: ['typescript', 'javascript'],
 *   frameworks: ['react', 'next.js'],
 * });
 *
 * await worker.initialize();
 *
 * // Match a task
 * const match = worker.matchTask(task);
 * if (match.score > 0.7) {
 *   const result = await worker.execute(task);
 * }
 * ```
 */

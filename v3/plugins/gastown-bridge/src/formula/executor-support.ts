/**
 * Formula Executor — private support pieces
 *
 * The LRU step/cook caches + dedup instances, WorkStealingQueue,
 * hashKey, the default logger, and the JsFallbackWasmLoader. These were
 * module-private in the original executor.ts (P3.72, W193) and are
 * deliberately NOT re-exported by the executor.ts barrel.
 */

import type {
  CookedFormula,
  Formula,
  FormulaType,
  Step,
  Var,
} from '../types.js';
import { FormulaError, GasTownError, GasTownErrorCode } from '../errors.js';
import { LRUCache, BatchDeduplicator } from '../cache.js';
import type {
  ExecuteOptions,
  ExecutorLogger,
  IWasmLoader,
  StepContext,
  StepResult,
} from './executor-types.js';

// Performance Caches & Deduplication
// ============================================================================

/** Step result cache for memoization */
export const stepResultCache = new LRUCache<string, StepResult>({
  maxEntries: 500,
  ttlMs: 5 * 60 * 1000, // 5 min TTL
});

/** Formula cook cache */
export const cookCache = new LRUCache<string, CookedFormula>({
  maxEntries: 200,
  ttlMs: 10 * 60 * 1000, // 10 min TTL
});

/** Deduplicator for concurrent cook requests */
export const cookDedup = new BatchDeduplicator<CookedFormula>();

/** Deduplicator for concurrent formula fetch requests */
export const fetchDedup = new BatchDeduplicator<Formula>();

/**
 * Work stealing queue for parallel execution
 */
export interface WorkItem {
  step: Step;
  context: StepContext;
  options: ExecuteOptions;
  priority: number;
}

/**
 * Work stealing queue for load balancing across parallel workers
 */
export class WorkStealingQueue {
  private queues: WorkItem[][] = [];
  private nextQueueId = 0;

  constructor(private readonly numWorkers: number) {
    for (let i = 0; i < numWorkers; i++) {
      this.queues.push([]);
    }
  }

  /** Enqueue work to least-loaded queue */
  enqueue(item: WorkItem): void {
    // Find queue with least items
    let minQueue = 0;
    let minLen = this.queues[0]?.length ?? 0;
    for (let i = 1; i < this.queues.length; i++) {
      const len = this.queues[i]?.length ?? 0;
      if (len < minLen) {
        minLen = len;
        minQueue = i;
      }
    }
    this.queues[minQueue]?.push(item);
  }

  /** Dequeue from own queue or steal from others */
  dequeue(workerId: number): WorkItem | undefined {
    // Try own queue first
    const ownQueue = this.queues[workerId];
    if (ownQueue && ownQueue.length > 0) {
      return ownQueue.shift();
    }

    // Try to steal from other queues (round-robin)
    for (let i = 1; i < this.queues.length; i++) {
      const victimId = (workerId + i) % this.queues.length;
      const victimQueue = this.queues[victimId];
      if (victimQueue && victimQueue.length > 1) {
        // Steal from the back (LIFO stealing)
        return victimQueue.pop();
      }
    }

    return undefined;
  }

  /** Check if all queues are empty */
  isEmpty(): boolean {
    return this.queues.every(q => q.length === 0);
  }

  /** Get total pending items */
  get size(): number {
    return this.queues.reduce((sum, q) => sum + q.length, 0);
  }
}

/**
 * Hash function for cache keys (FNV-1a)
 */
export function hashKey(parts: string[]): string {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    hash ^= 0xff; // separator
  }
  return hash.toString(36);
}

// ============================================================================

// Default Logger
// ============================================================================

export const defaultLogger: ExecutorLogger = {
  debug: (msg, meta) => console.debug(`[formula-executor] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.info(`[formula-executor] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[formula-executor] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[formula-executor] ${msg}`, meta ?? ''),
};

// ============================================================================
// JavaScript Fallback Implementation
// ============================================================================

/**
 * JavaScript fallback for WASM operations
 * Used when WASM is not available
 */
export class JsFallbackWasmLoader implements IWasmLoader {
  isInitialized(): boolean {
    return true; // JS fallback is always available
  }

  parseFormula(content: string): Formula {
    // Basic TOML parsing simulation
    // In production, use a proper TOML parser
    try {
      const lines = content.split('\n');

      // Use mutable objects during parsing, then cast to readonly
      let name = 'parsed-formula';
      let description = '';
      let type: FormulaType = 'workflow';
      let version = 1;
      const steps: Array<{ id: string; title: string; description: string; needs?: string[] }> = [];
      const vars: Record<string, Var> = {};

      let currentSection = '';
      let currentStep: { id: string; title: string; description: string; needs?: string[] } | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Section headers
        if (trimmed.startsWith('[')) {
          if (currentStep && currentStep.id) {
            steps.push(currentStep);
          }

          const sectionMatch = trimmed.match(/\[(\w+)(?:\.(\w+))?\]/);
          if (sectionMatch) {
            currentSection = sectionMatch[1];
            if (sectionMatch[2]) {
              currentStep = { id: sectionMatch[2], title: '', description: '' };
            } else {
              currentStep = null;
            }
          }
          continue;
        }

        // Key-value pairs
        const kvMatch = trimmed.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
        if (kvMatch) {
          const [, key, value] = kvMatch;

          if (currentSection === 'formula') {
            if (key === 'name') name = value;
            else if (key === 'description') description = value;
            else if (key === 'type') type = value as FormulaType;
            else if (key === 'version') version = parseInt(value, 10);
          } else if (currentStep) {
            if (key === 'title') currentStep.title = value;
            else if (key === 'description') currentStep.description = value;
            else if (key === 'needs') {
              currentStep.needs = value.split(',').map(s => s.trim());
            }
          }
        }
      }

      // Add last step
      if (currentStep && currentStep.id) {
        steps.push(currentStep);
      }

      // Return immutable formula
      const formula: Formula = {
        name,
        description,
        type,
        version,
        steps: steps as Step[],
        vars,
      };
      return formula;
    } catch (error) {
      throw FormulaError.parseFailed('js-parse', 'Failed to parse formula content', error as Error);
    }
  }

  cookFormula(formula: Formula, vars: Record<string, string>): CookedFormula {
    const substituteVars = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return vars[varName] ?? match;
      });
    };

    const cookedSteps = formula.steps?.map(step => ({
      ...step,
      title: substituteVars(step.title),
      description: substituteVars(step.description),
    }));

    const cookedLegs = formula.legs?.map(leg => ({
      ...leg,
      title: substituteVars(leg.title),
      description: substituteVars(leg.description),
      focus: substituteVars(leg.focus),
    }));

    return {
      ...formula,
      steps: cookedSteps,
      legs: cookedLegs,
      cookedAt: new Date(),
      cookedVars: { ...vars },
      originalName: formula.name,
    };
  }

  batchCook(formulas: Formula[], varsArray: Record<string, string>[]): CookedFormula[] {
    return formulas.map((formula, index) => {
      const vars = varsArray[index] ?? {};
      return this.cookFormula(formula, vars);
    });
  }

  resolveStepDependencies(steps: Step[]): Step[] {
    // Topological sort using Kahn's algorithm
    const stepMap = new Map<string, Step>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const step of steps) {
      stepMap.set(step.id, step);
      inDegree.set(step.id, 0);
      adjacency.set(step.id, []);
    }

    // Build graph
    for (const step of steps) {
      if (step.needs) {
        for (const dep of step.needs) {
          if (stepMap.has(dep)) {
            const adj = adjacency.get(dep);
            if (adj) adj.push(step.id);
            inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
          }
        }
      }
    }

    // Find all nodes with no incoming edges
    const queue: string[] = [];
    inDegree.forEach((degree, stepId) => {
      if (degree === 0) {
        queue.push(stepId);
      }
    });

    const sorted: Step[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const step = stepMap.get(current);
      if (step) {
        sorted.push(step);
      }

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycle (not all nodes processed)
    if (sorted.length !== steps.length) {
      throw new GasTownError(
        'Cycle detected in step dependencies',
        GasTownErrorCode.DEPENDENCY_CYCLE,
        { sortedCount: sorted.length, totalCount: steps.length }
      );
    }

    return sorted;
  }

  detectCycle(steps: Step[]): { hasCycle: boolean; cycleSteps?: string[] } {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const stepMap = new Map<string, Step>();

    for (const step of steps) {
      stepMap.set(step.id, step);
    }

    const dfs = (stepId: string, path: string[]): string[] | null => {
      visited.add(stepId);
      recStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step?.needs) {
        for (const dep of step.needs) {
          if (!visited.has(dep)) {
            const cycle = dfs(dep, [...path, dep]);
            if (cycle) return cycle;
          } else if (recStack.has(dep)) {
            return [...path, dep];
          }
        }
      }

      recStack.delete(stepId);
      return null;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        const cycle = dfs(step.id, [step.id]);
        if (cycle) {
          return { hasCycle: true, cycleSteps: cycle };
        }
      }
    }

    return { hasCycle: false };
  }
}

// ============================================================================

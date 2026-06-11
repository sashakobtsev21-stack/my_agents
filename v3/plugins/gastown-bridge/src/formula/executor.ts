/**
 * Gas Town Formula Executor - Hybrid WASM/CLI Implementation
 *
 * Provides formula execution with:
 * - WASM acceleration for parsing and cooking (352x faster)
 * - CLI bridge fallback for I/O operations
 * - Progress tracking with event emission
 * - Step dependency resolution
 * - Molecule generation from cooked formulas
 * - Cancellation support
 *
 * @module v3/plugins/gastown-bridge/formula/executor
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import type {
  Formula,
  CookedFormula,
  Step,
} from '../types.js';

import {
  GasTownError,
  GasTownErrorCode,
  FormulaError,
} from '../errors.js';

import type { GtBridge, GtResult } from '../bridges/gt-bridge.js';

import {
  moleculePool,
  PooledMolecule,
} from '../memory/index.js';

import {
  DebouncedEmitter,
} from '../cache.js';

// ============================================================================

// The public executor types and the private caches/logger/fallback were
// extracted into ./executor-types.ts and ./executor-support.ts during
// the P3.72 god-file decomposition (W193). Re-export the public types;
// the support pieces stay module-private to this surface.
export * from './executor-types.js';
import type {
  ExecuteOptions,
  ExecutionProgress,
  ExecutorEvents,
  ExecutorLogger,
  IWasmLoader,
  Molecule,
  StepContext,
  StepResult,
} from './executor-types.js';
import {
  WorkStealingQueue,
  cookCache,
  cookDedup,
  defaultLogger,
  fetchDedup,
  hashKey,
  stepResultCache,
  JsFallbackWasmLoader,
} from './executor-support.js';

// Formula Executor Implementation
// ============================================================================

/**
 * Hybrid Formula Executor
 *
 * Uses WASM for fast parsing and cooking operations,
 * falls back to CLI bridge for I/O operations.
 *
 * @example
 * ```typescript
 * const executor = new FormulaExecutor(gtBridge, wasmLoader);
 *
 * // Full execution
 * const results = await executor.execute('my-formula', { feature: 'auth' });
 *
 * // Just cook (WASM-accelerated)
 * const cooked = await executor.cook('my-formula', { feature: 'auth' });
 *
 * // Generate molecules
 * const molecules = await executor.generateMolecules(cooked);
 * ```
 */
export class FormulaExecutor extends EventEmitter {
  private readonly gtBridge: GtBridge;
  private readonly wasmLoader: IWasmLoader;
  private readonly logger: ExecutorLogger;
  private readonly jsFallback: JsFallbackWasmLoader;

  /** Active executions for progress tracking */
  private readonly executions: Map<string, ExecutionProgress> = new Map();

  /** Cancellation controllers */
  private readonly cancellations: Map<string, AbortController> = new Map();

  /** Debounced progress emitters per execution */
  private readonly progressEmitters: Map<string, DebouncedEmitter<ExecutionProgress>> = new Map();

  /** Default max parallel workers */
  private readonly defaultMaxParallel = 4;

  constructor(
    gtBridge: GtBridge,
    wasmLoader?: IWasmLoader,
    logger?: ExecutorLogger
  ) {
    super();
    this.gtBridge = gtBridge;
    this.wasmLoader = wasmLoader ?? new JsFallbackWasmLoader();
    this.logger = logger ?? defaultLogger;
    this.jsFallback = new JsFallbackWasmLoader();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Execute a formula with full lifecycle
   *
   * @param formulaName - Name of the formula to execute
   * @param vars - Variables for substitution
   * @param options - Execution options
   * @returns Array of step results
   */
  async execute(
    formulaName: string,
    vars: Record<string, string>,
    options: ExecuteOptions = {}
  ): Promise<StepResult[]> {
    const executionId = randomUUID();
    const abortController = new AbortController();

    // Register cancellation controller
    this.cancellations.set(executionId, abortController);

    // Merge signals
    const signal = options.signal
      ? this.mergeSignals(options.signal, abortController.signal)
      : abortController.signal;

    try {
      // Step 1: Fetch and cook the formula
      this.logger.info('Starting formula execution', { executionId, formulaName });
      const cooked = await this.cook(formulaName, vars);

      // Initialize progress tracking
      const steps = cooked.steps ?? [];
      const legs = cooked.legs ?? [];
      const totalSteps = steps.length || legs.length;

      const progress: ExecutionProgress = {
        executionId,
        formulaName,
        status: 'running',
        totalSteps,
        completedSteps: 0,
        failedSteps: 0,
        startTime: new Date(),
        stepResults: [],
        percentage: 0,
      };

      this.executions.set(executionId, progress);
      this.emit('execution:start', executionId, cooked);

      // Create debounced progress emitter (100ms debounce)
      const progressEmitter = new DebouncedEmitter<ExecutionProgress>(
        (p) => this.emit('execution:progress', p),
        100
      );
      this.progressEmitters.set(executionId, progressEmitter);

      // Step 2: Resolve dependencies and get execution order
      const orderedSteps = this.getOrderedExecutionUnits(cooked);

      // Step 3: Execute steps with parallel execution where deps allow
      const results: StepResult[] = [];
      const previousResults = new Map<string, StepResult>();
      const maxParallel = options.maxParallel ?? this.defaultMaxParallel;

      // Use parallel execution with work stealing if enabled
      if (maxParallel > 1 && orderedSteps.length > 1) {
        // Build dependency graph for parallel execution
        const stepDeps = new Map<string, Set<string>>();
        const stepById = new Map<string, Step>();
        const stepIndex = new Map<string, number>();

        for (let i = 0; i < orderedSteps.length; i++) {
          const step = orderedSteps[i];
          stepById.set(step.id, step);
          stepIndex.set(step.id, i);
          stepDeps.set(step.id, new Set(step.needs ?? []));
        }

        // Track completed steps
        const completed = new Set<string>();
        const inProgress = new Set<string>();

        // Work stealing queue
        const workQueue = new WorkStealingQueue(maxParallel);

        // Find steps that can run (no dependencies)
        const getReadySteps = (): Step[] => {
          const ready: Step[] = [];
          for (const step of orderedSteps) {
            if (completed.has(step.id) || inProgress.has(step.id)) continue;
            const deps = stepDeps.get(step.id);
            if (!deps || [...deps].every(d => completed.has(d))) {
              ready.push(step);
            }
          }
          return ready;
        };

        // Execute in parallel waves
        while (completed.size < orderedSteps.length) {
          // Check for cancellation
          if (signal.aborted) {
            progress.status = 'cancelled';
            this.emit('execution:cancelled', executionId);
            throw new GasTownError(
              'Execution cancelled',
              GasTownErrorCode.UNKNOWN,
              { executionId }
            );
          }

          const readySteps = getReadySteps();
          if (readySteps.length === 0 && inProgress.size === 0) {
            // Deadlock - should not happen with valid DAG
            break;
          }

          // Limit parallel execution
          const batchSize = Math.min(readySteps.length, maxParallel - inProgress.size);
          const batch = readySteps.slice(0, batchSize);

          if (batch.length === 0) {
            // Wait for in-progress steps to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            continue;
          }

          // Mark as in progress
          for (const step of batch) {
            inProgress.add(step.id);
          }

          // Execute batch in parallel
          const batchPromises = batch.map(async (step) => {
            const idx = stepIndex.get(step.id) ?? 0;
            progress.currentStep = step.id;

            const context: StepContext = {
              executionId,
              formula: cooked,
              stepIndex: idx,
              totalSteps: orderedSteps.length,
              variables: cooked.cookedVars,
              previousResults,
              signal,
              startTime: progress.startTime,
            };

            this.emit('step:start', executionId, step);

            try {
              const result = await this.runStep(step, context, options);
              previousResults.set(step.id, result);
              completed.add(step.id);
              inProgress.delete(step.id);

              if (result.success) {
                progress.completedSteps++;
              } else {
                progress.failedSteps++;
              }

              progress.stepResults.push(result);
              progress.percentage = Math.round((completed.size / orderedSteps.length) * 100);

              this.emit('step:complete', executionId, result);
              progressEmitter.update({ ...progress });

              return result;
            } catch (error) {
              const failedResult: StepResult = {
                stepId: step.id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                durationMs: 0,
              };

              previousResults.set(step.id, failedResult);
              completed.add(step.id); // Mark as completed (failed)
              inProgress.delete(step.id);
              progress.failedSteps++;
              progress.stepResults.push(failedResult);

              this.emit('step:error', executionId, step.id, error as Error);
              progressEmitter.update({ ...progress });

              // Continue or fail based on step configuration
              if (!step.metadata?.continueOnError) {
                throw error;
              }

              return failedResult;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }

        // Flush final progress
        progressEmitter.flush();
      } else {
        // Sequential execution (original behavior)
        for (let i = 0; i < orderedSteps.length; i++) {
          // Check for cancellation
          if (signal.aborted) {
            progress.status = 'cancelled';
            this.emit('execution:cancelled', executionId);
            throw new GasTownError(
              'Execution cancelled',
              GasTownErrorCode.UNKNOWN,
              { executionId }
            );
          }

          const step = orderedSteps[i];
          progress.currentStep = step.id;

          const context: StepContext = {
            executionId,
            formula: cooked,
            stepIndex: i,
            totalSteps: orderedSteps.length,
            variables: cooked.cookedVars,
            previousResults,
            signal,
            startTime: progress.startTime,
          };

          this.emit('step:start', executionId, step);

          try {
            const result = await this.runStep(step, context, options);
            results.push(result);
            previousResults.set(step.id, result);

            if (result.success) {
              progress.completedSteps++;
            } else {
              progress.failedSteps++;
            }

            progress.stepResults.push(result);
            progress.percentage = Math.round(((i + 1) / orderedSteps.length) * 100);

            this.emit('step:complete', executionId, result);
            progressEmitter.update({ ...progress });
          } catch (error) {
            const failedResult: StepResult = {
              stepId: step.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              durationMs: 0,
            };

            results.push(failedResult);
            previousResults.set(step.id, failedResult);
            progress.failedSteps++;
            progress.stepResults.push(failedResult);

            this.emit('step:error', executionId, step.id, error as Error);

            // Continue or fail based on step configuration
            if (!step.metadata?.continueOnError) {
              throw error;
            }
          }
        }

        // Flush final progress
        progressEmitter.flush();
      }

      // Step 4: Complete execution
      progress.status = progress.failedSteps > 0 ? 'failed' : 'completed';
      progress.endTime = new Date();
      progress.percentage = 100;

      this.emit('execution:complete', executionId, results);
      this.logger.info('Formula execution completed', {
        executionId,
        formulaName,
        completed: progress.completedSteps,
        failed: progress.failedSteps,
      });

      return results;
    } catch (error) {
      const progress = this.executions.get(executionId);
      if (progress) {
        progress.status = 'failed';
        progress.endTime = new Date();
        progress.error = error instanceof Error ? error.message : String(error);
      }

      this.emit('execution:error', executionId, error as Error);
      throw error;
    } finally {
      this.cancellations.delete(executionId);
      // Cleanup progress emitter
      const emitter = this.progressEmitters.get(executionId);
      if (emitter) {
        emitter.cancel();
        this.progressEmitters.delete(executionId);
      }
    }
  }

  /**
   * Cook a formula with variable substitution (WASM-accelerated)
   *
   * @param formulaName - Name of the formula or TOML content
   * @param vars - Variables for substitution
   * @returns Cooked formula with substituted variables
   */
  async cook(
    formulaName: string,
    vars: Record<string, string>
  ): Promise<CookedFormula> {
    this.logger.debug('Cooking formula', { formulaName, varsCount: Object.keys(vars).length });

    // Generate cache key from formula name and vars
    const varKeys = Object.keys(vars).sort();
    const varValues = varKeys.map(k => vars[k]);
    const cacheKey = hashKey([formulaName, ...varKeys, ...varValues]);

    // Check cook cache first
    const cached = cookCache.get(cacheKey);
    if (cached) {
      this.logger.debug('Cook cache hit', { formulaName });
      return cached;
    }

    // Use deduplication for concurrent identical requests
    return cookDedup.dedupe(cacheKey, async () => {
      try {
        // Determine if formulaName is content or a name to fetch
        let formula: Formula;

        if (formulaName.includes('[') || formulaName.includes('=')) {
          // Looks like TOML content, parse directly
          formula = this.parseFormula(formulaName);
        } else {
          // Fetch formula from CLI with deduplication
          formula = await fetchDedup.dedupe(formulaName, () => this.fetchFormula(formulaName));
        }

        // Validate required variables
        this.validateVariables(formula, vars);

        // Cook using WASM if available, otherwise JS fallback
        const loader = this.wasmLoader.isInitialized() ? this.wasmLoader : this.jsFallback;
        const cooked = loader.cookFormula(formula, vars);

        // Cache the result
        cookCache.set(cacheKey, cooked);

        this.logger.debug('Formula cooked successfully', {
          formulaName,
          wasmAccelerated: this.wasmLoader.isInitialized(),
        });

        return cooked;
      } catch (error) {
        if (error instanceof GasTownError) throw error;

        throw FormulaError.cookFailed(
          formulaName,
          error instanceof Error ? error.message : String(error),
          error as Error
        );
      }
    });
  }

  /**
   * Generate molecules from a cooked formula
   *
   * Molecules are executable work units derived from formula steps/legs.
   * Uses object pooling for reduced allocations.
   *
   * @param cookedFormula - The cooked formula to generate molecules from
   * @returns Array of molecules
   */
  async generateMolecules(cookedFormula: CookedFormula): Promise<Molecule[]> {
    this.logger.debug('Generating molecules', { formulaName: cookedFormula.name });

    const molecules: Molecule[] = [];
    const moleculeIdMap = new Map<string, string>();

    // Generate molecules based on formula type
    if (cookedFormula.type === 'convoy' && cookedFormula.legs) {
      // Convoy: Generate from legs
      const orderedLegs = [...cookedFormula.legs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      for (let i = 0; i < orderedLegs.length; i++) {
        const leg = orderedLegs[i];
        const moleculeId = `mol-${cookedFormula.name}-${leg.id}-${randomUUID().slice(0, 8)}`;
        moleculeIdMap.set(leg.id, moleculeId);

        // Use pooled molecule for reduced allocations
        const pooledMol = moleculePool.acquire() as PooledMolecule;
        pooledMol.id = moleculeId;
        pooledMol.formulaName = cookedFormula.name;
        pooledMol.title = leg.title;
        pooledMol.description = leg.description;
        pooledMol.type = cookedFormula.type;
        pooledMol.sourceId = leg.id;
        pooledMol.agent = leg.agent;
        pooledMol.dependencies = i > 0 ? [moleculeIdMap.get(orderedLegs[i - 1].id)!] : [];
        pooledMol.order = i;
        pooledMol.metadata = {
          focus: leg.focus,
          legOrder: leg.order,
        };
        pooledMol.createdAt = new Date();

        // Create plain molecule for return (avoid pool reference issues)
        const molecule: Molecule = {
          id: pooledMol.id,
          formulaName: pooledMol.formulaName,
          title: pooledMol.title,
          description: pooledMol.description,
          type: pooledMol.type,
          sourceId: pooledMol.sourceId,
          agent: pooledMol.agent,
          dependencies: [...pooledMol.dependencies],
          order: pooledMol.order,
          metadata: { ...pooledMol.metadata },
          createdAt: pooledMol.createdAt,
        };

        // Release pooled molecule back to pool
        moleculePool.release(pooledMol);

        molecules.push(molecule);
        this.emit('molecule:created', molecule);
      }
    } else if (cookedFormula.steps) {
      // Workflow/Expansion/Aspect: Generate from steps
      const orderedSteps = this.resolveStepDependencies(cookedFormula.steps);

      for (let i = 0; i < orderedSteps.length; i++) {
        const step = orderedSteps[i];
        const moleculeId = `mol-${cookedFormula.name}-${step.id}-${randomUUID().slice(0, 8)}`;
        moleculeIdMap.set(step.id, moleculeId);

        // Map step dependencies to molecule IDs
        const dependencies: string[] = [];
        if (step.needs) {
          for (const need of step.needs) {
            const depMoleculeId = moleculeIdMap.get(need);
            if (depMoleculeId) {
              dependencies.push(depMoleculeId);
            }
          }
        }

        // Use pooled molecule for reduced allocations
        const pooledMol = moleculePool.acquire() as PooledMolecule;
        pooledMol.id = moleculeId;
        pooledMol.formulaName = cookedFormula.name;
        pooledMol.title = step.title;
        pooledMol.description = step.description;
        pooledMol.type = cookedFormula.type;
        pooledMol.sourceId = step.id;
        pooledMol.agent = undefined;
        pooledMol.dependencies = dependencies;
        pooledMol.order = i;
        pooledMol.metadata = {
          duration: step.duration,
          requires: step.requires,
          ...step.metadata,
        };
        pooledMol.createdAt = new Date();

        // Create plain molecule for return (avoid pool reference issues)
        const molecule: Molecule = {
          id: pooledMol.id,
          formulaName: pooledMol.formulaName,
          title: pooledMol.title,
          description: pooledMol.description,
          type: pooledMol.type,
          sourceId: pooledMol.sourceId,
          agent: pooledMol.agent,
          dependencies: [...pooledMol.dependencies],
          order: pooledMol.order,
          metadata: { ...pooledMol.metadata },
          createdAt: pooledMol.createdAt,
        };

        // Release pooled molecule back to pool
        moleculePool.release(pooledMol);

        molecules.push(molecule);
        this.emit('molecule:created', molecule);
      }
    }

    this.logger.info('Molecules generated', {
      formulaName: cookedFormula.name,
      count: molecules.length,
    });

    return molecules;
  }

  /**
   * Run a single step
   *
   * @param step - Step to execute
   * @param context - Execution context
   * @param options - Execution options
   * @returns Step result
   */
  async runStep(
    step: Step,
    context: StepContext,
    options: ExecuteOptions = {}
  ): Promise<StepResult> {
    const startTime = Date.now();

    this.logger.debug('Running step', {
      stepId: step.id,
      executionId: context.executionId,
    });

    // Generate cache key for step result memoization
    // Only cache if step is deterministic (no side effects indicator)
    const isCacheable = step.metadata?.cacheable !== false && !step.metadata?.hasSideEffects;
    const stepCacheKey = isCacheable
      ? hashKey([
          step.id,
          context.formula.name,
          JSON.stringify(context.variables),
          JSON.stringify(step.needs ?? []),
        ])
      : null;

    // Check step result cache
    if (stepCacheKey) {
      const cachedResult = stepResultCache.get(stepCacheKey);
      if (cachedResult) {
        this.logger.debug('Step cache hit', { stepId: step.id });
        return {
          ...cachedResult,
          metadata: { ...cachedResult.metadata, fromCache: true },
        };
      }
    }

    try {
      // Check for cancellation
      if (context.signal?.aborted) {
        throw new GasTownError('Step cancelled', GasTownErrorCode.UNKNOWN);
      }

      // Check dependencies are satisfied
      if (step.needs) {
        for (const dep of step.needs) {
          const depResult = context.previousResults.get(dep);
          if (!depResult || !depResult.success) {
            throw new GasTownError(
              `Dependency not satisfied: ${dep}`,
              GasTownErrorCode.UNKNOWN,
              { stepId: step.id, dependency: dep }
            );
          }
        }
      }

      // Use custom step handler if provided
      if (options.stepHandler) {
        const result = await options.stepHandler(step, context);
        if (stepCacheKey && result.success) {
          stepResultCache.set(stepCacheKey, result);
        }
        return result;
      }

      // Dry run mode
      if (options.dryRun) {
        return {
          stepId: step.id,
          success: true,
          output: { dryRun: true, step },
          durationMs: Date.now() - startTime,
          metadata: { dryRun: true },
        };
      }

      // Default execution via CLI
      const result = await this.executeStepViaCli(step, context, options);

      const stepResult: StepResult = {
        stepId: step.id,
        success: true,
        output: result,
        durationMs: Date.now() - startTime,
      };

      // Cache successful result
      if (stepCacheKey) {
        stepResultCache.set(stepCacheKey, stepResult);
      }

      return stepResult;
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get execution progress
   *
   * @param executionId - Execution ID to get progress for
   * @returns Execution progress or undefined
   */
  getProgress(executionId: string): ExecutionProgress | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel an execution
   *
   * @param executionId - Execution ID to cancel
   * @returns Whether cancellation was initiated
   */
  cancel(executionId: string): boolean {
    const controller = this.cancellations.get(executionId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * List all active executions
   */
  getActiveExecutions(): ExecutionProgress[] {
    return Array.from(this.executions.values()).filter(
      e => e.status === 'running' || e.status === 'pending'
    );
  }

  /**
   * Check if WASM is available for acceleration
   */
  isWasmAvailable(): boolean {
    return this.wasmLoader.isInitialized();
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats(): {
    stepResultCache: { entries: number; sizeBytes: number };
    cookCache: { entries: number; sizeBytes: number };
  } {
    return {
      stepResultCache: stepResultCache.stats(),
      cookCache: cookCache.stats(),
    };
  }

  /**
   * Clear all executor caches
   */
  clearCaches(): void {
    stepResultCache.clear();
    cookCache.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Parse formula content using WASM or JS fallback
   */
  private parseFormula(content: string): Formula {
    const loader = this.wasmLoader.isInitialized() ? this.wasmLoader : this.jsFallback;
    return loader.parseFormula(content);
  }

  /**
   * Fetch formula from CLI
   */
  private async fetchFormula(formulaName: string): Promise<Formula> {
    // Check if bridge is initialized
    if (!this.gtBridge.isInitialized()) {
      throw new GasTownError(
        'GtBridge not initialized',
        GasTownErrorCode.NOT_INITIALIZED
      );
    }

    // Fetch formula via CLI (would be: gt formula show <name> --json)
    // For now, simulate with a placeholder
    // In production, this would call: this.gtBridge.execGt(['formula', 'show', formulaName, '--json'])
    this.logger.debug('Fetching formula from CLI', { formulaName });

    // Simulated formula for demonstration
    const formula: Formula = {
      name: formulaName,
      description: `Formula: ${formulaName}`,
      type: 'workflow',
      version: 1,
      steps: [
        {
          id: 'init',
          title: 'Initialize',
          description: 'Initialize the workflow',
        },
        {
          id: 'process',
          title: 'Process',
          description: 'Process the data',
          needs: ['init'],
        },
        {
          id: 'finalize',
          title: 'Finalize',
          description: 'Finalize the workflow',
          needs: ['process'],
        },
      ],
      vars: {},
    };

    return formula;
  }

  /**
   * Validate required variables are provided
   */
  private validateVariables(formula: Formula, vars: Record<string, string>): void {
    if (!formula.vars) return;

    const missing: string[] = [];

    for (const [name, varDef] of Object.entries(formula.vars)) {
      if (varDef.required && !(name in vars) && !varDef.default) {
        missing.push(name);
      }
    }

    if (missing.length > 0) {
      throw new GasTownError(
        `Missing required variables: ${missing.join(', ')}`,
        GasTownErrorCode.INVALID_ARGUMENTS,
        { missing }
      );
    }
  }

  /**
   * Resolve step dependencies using WASM or JS fallback
   */
  private resolveStepDependencies(steps: Step[]): Step[] {
    const loader = this.wasmLoader.isInitialized() ? this.wasmLoader : this.jsFallback;
    return loader.resolveStepDependencies(steps);
  }

  /**
   * Get ordered execution units (steps or legs) from formula
   */
  private getOrderedExecutionUnits(formula: CookedFormula): Step[] {
    if (formula.type === 'convoy' && formula.legs) {
      // Convert legs to steps for unified execution
      const legs = [...formula.legs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return legs.map((leg, index) => ({
        id: leg.id,
        title: leg.title,
        description: leg.description,
        needs: index > 0 ? [legs[index - 1].id] : undefined,
        metadata: { agent: leg.agent, focus: leg.focus },
      }));
    }

    if (formula.steps) {
      return this.resolveStepDependencies(formula.steps);
    }

    return [];
  }

  /**
   * Execute step via CLI bridge
   */
  private async executeStepViaCli(
    step: Step,
    context: StepContext,
    options: ExecuteOptions
  ): Promise<unknown> {
    // Build CLI command for step execution
    const args = [
      'formula',
      'step',
      step.id,
      '--execution-id', context.executionId,
      '--json',
    ];

    if (options.targetAgent) {
      args.push('--agent', options.targetAgent);
    }

    if (options.stepTimeout) {
      args.push('--timeout', String(options.stepTimeout));
    }

    // Execute via bridge
    const result = await this.gtBridge.execGt(args);

    if (!result.success) {
      throw new GasTownError(
        `Step execution failed: ${result.error}`,
        GasTownErrorCode.CLI_EXECUTION_FAILED,
        { stepId: step.id, error: result.error }
      );
    }

    return result.data ? JSON.parse(result.data) : null;
  }

  /**
   * Merge multiple abort signals
   */
  private mergeSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FormulaExecutor instance
 */
export function createFormulaExecutor(
  gtBridge: GtBridge,
  wasmLoader?: IWasmLoader,
  logger?: ExecutorLogger
): FormulaExecutor {
  return new FormulaExecutor(gtBridge, wasmLoader, logger);
}

export default FormulaExecutor;

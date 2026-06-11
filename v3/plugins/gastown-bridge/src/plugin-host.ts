/**
 * GasTown Bridge — plugin host pieces
 *
 * The plugin-system interfaces, bridge interfaces, configuration +
 * DEFAULT_PLUGIN_CONFIG, the GUPP adapter stub, the plugin logger, and
 * the WasmLoaderAdapter. Extracted verbatim from index.ts (lines 90-670)
 * during the P3.70 god-file decomposition (W191) — cut #1; the
 * GasTownBridgePlugin class stays in index.ts. index.ts re-exports the
 * eleven public types; the five private implementations are imported
 * back without re-export.
 */

import { EventEmitter } from 'events';

import type {
  Bead,
  Formula,
  Convoy,
  GasTownConfig,
  CreateBeadOptions,
  CreateConvoyOptions,
  SlingOptions,
  SyncResult,
  TopoSortResult,
  CriticalPathResult,
  BeadGraph,
  FormulaType,
  CookedFormula,
  Step,
} from './types.js';

import {
  DEFAULT_CONFIG,
  GasTownErrorCodes,
  validateConfig,
} from './types.js';

// Bridge imports
import { GtBridge, createGtBridge } from './bridges/gt-bridge.js';
import { BdBridge, createBdBridge } from './bridges/bd-bridge.js';
import { SyncBridge, createSyncBridge, type IAgentDBService, type AgentDBEntry } from './bridges/sync-bridge.js';

// Formula executor
import { FormulaExecutor, createFormulaExecutor, type IWasmLoader } from './formula/executor.js';

// Convoy management
import { ConvoyTracker, createConvoyTracker } from './convoy/tracker.js';
import { ConvoyObserver, createConvoyObserver, type WasmGraphModule } from './convoy/observer.js';

// WASM loader
import {
  isWasmAvailable,
  loadFormulaWasm,
  loadGnnWasm,
  parseFormula as wasmParseFormula,
  cookFormula as wasmCookFormula,
  cookBatch as wasmCookBatch,
  topoSort as wasmTopoSort,
  detectCycles as wasmDetectCycles,
  criticalPath as wasmCriticalPath,
  preloadWasmModules,
  getWasmVersions,
} from './wasm-loader.js';
import { GasTownError, GasTownErrorCode } from './errors.js';

// Plugin Interfaces (matching claude-flow plugin system)
// ============================================================================

/**
 * Plugin context interface
 */
export interface PluginContext {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
}

/**
 * MCP Tool definition for plugin interface
 */
export interface PluginMCPTool {
  name: string;
  description: string;
  category: string;
  version: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (
    input: unknown,
    context: PluginContext
  ) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

/**
 * Hook priority type
 */
export type HookPriority = number;

/**
 * Plugin hook definition
 */
export interface PluginHook {
  name: string;
  event: string;
  priority: HookPriority;
  description: string;
  handler: (context: PluginContext, payload: unknown) => Promise<unknown>;
}

/**
 * Plugin interface
 */
export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  register(context: PluginContext): Promise<void>;
  initialize(context: PluginContext): Promise<{ success: boolean; error?: string }>;
  shutdown(context: PluginContext): Promise<{ success: boolean; error?: string }>;
  getCapabilities(): string[];
  getMCPTools(): PluginMCPTool[];
  getHooks(): PluginHook[];
}

// ============================================================================
// Bridge Interfaces
// ============================================================================

/**
 * Gas Town CLI bridge interface
 */
export interface IGasTownBridge {
  gt(args: string[]): Promise<string>;
  bd(args: string[]): Promise<string>;
  createBead(opts: CreateBeadOptions): Promise<Bead>;
  getReady(limit?: number, rig?: string): Promise<Bead[]>;
  showBead(beadId: string): Promise<Bead>;
  addDep(child: string, parent: string): Promise<void>;
  removeDep(child: string, parent: string): Promise<void>;
  sling(opts: SlingOptions): Promise<void>;
}

/**
 * Formula engine interface
 */
export interface IFormulaEngine {
  parse(content: string): Formula;
  cook(formula: Formula, vars: Record<string, string>): Formula;
  toMolecule(formula: Formula, bridge: IGasTownBridge): Promise<string[]>;
}

/**
 * WASM bridge interface
 */
export interface IWasmBridge {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  dispose(): Promise<void>;
  parseFormula(content: string): Formula;
  cookFormula(formula: Formula, vars: Record<string, string>): Formula;
  resolveDeps(beads: Bead[]): TopoSortResult;
  detectCycle(graph: BeadGraph): boolean;
  criticalPath(beads: Bead[], durations: Map<string, number>): CriticalPathResult;
  batchCook(formulas: Formula[], vars: Record<string, string>[]): Formula[];
}

/**
 * Sync service interface
 */
export interface ISyncService {
  pullBeads(rig?: string): Promise<number>;
  pushTasks(namespace: string): Promise<number>;
  sync(direction: 'pull' | 'push' | 'both', rig?: string): Promise<SyncResult>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Gas Town Bridge Plugin configuration
 */
export interface GasTownBridgeConfig {
  /** Base Gas Town configuration */
  gastown: Partial<GasTownConfig>;

  /** GtBridge configuration */
  gtBridge?: {
    /** Path to gt CLI binary */
    gtPath?: string;
    /** CLI execution timeout in ms */
    timeout?: number;
    /** Working directory */
    cwd?: string;
  };

  /** BdBridge configuration */
  bdBridge?: {
    /** Path to bd CLI binary */
    bdPath?: string;
    /** CLI execution timeout in ms */
    timeout?: number;
    /** Working directory */
    cwd?: string;
  };

  /** SyncBridge configuration */
  syncBridge?: {
    /** AgentDB namespace for beads */
    namespace?: string;
    /** Sync interval in ms */
    syncInterval?: number;
    /** Enable auto-sync */
    autoSync?: boolean;
  };

  /** FormulaExecutor configuration */
  formulaExecutor?: {
    /** Enable WASM acceleration */
    useWasm?: boolean;
    /** Step execution timeout in ms */
    stepTimeout?: number;
    /** Maximum parallel steps */
    maxParallel?: number;
  };

  /** ConvoyTracker configuration */
  convoyTracker?: {
    /** Auto-update progress on issue changes */
    autoUpdateProgress?: boolean;
    /** Progress update interval in ms */
    progressUpdateInterval?: number;
    /** Enable persistent storage */
    persistConvoys?: boolean;
    /** Storage path for convoy data */
    storagePath?: string;
  };

  /** ConvoyObserver configuration */
  convoyObserver?: {
    /** Polling interval in ms */
    pollInterval?: number;
    /** Maximum poll attempts (0 = unlimited) */
    maxPollAttempts?: number;
    /** Enable WASM for graph analysis */
    useWasm?: boolean;
  };

  /** WASM configuration */
  wasm?: {
    /** Enable WASM acceleration */
    enabled?: boolean;
    /** Preload WASM modules on init */
    preload?: boolean;
  };

  /** GUPP (Git Universal Pull/Push) adapter configuration */
  gupp?: {
    /** Enable GUPP adapter */
    enabled?: boolean;
    /** GUPP endpoint URL */
    endpoint?: string;
    /** Authentication token */
    authToken?: string;
  };

  /** Logger configuration */
  logger?: {
    /** Log level */
    level?: 'debug' | 'info' | 'warn' | 'error';
    /** Enable structured logging */
    structured?: boolean;
  };
}

/**
 * Default plugin configuration
 */
export const DEFAULT_PLUGIN_CONFIG: GasTownBridgeConfig = {
  gastown: DEFAULT_CONFIG,
  gtBridge: {
    timeout: 30000,
  },
  bdBridge: {
    timeout: 30000,
  },
  syncBridge: {
    namespace: 'gastown:beads',
    syncInterval: 60000,
    autoSync: false,
  },
  formulaExecutor: {
    useWasm: true,
    stepTimeout: 60000,
    maxParallel: 4,
  },
  convoyTracker: {
    autoUpdateProgress: true,
    progressUpdateInterval: 30000,
    persistConvoys: false,
    storagePath: './data/convoys',
  },
  convoyObserver: {
    pollInterval: 10000,
    maxPollAttempts: 0,
    useWasm: true,
  },
  wasm: {
    enabled: true,
    preload: true,
  },
  gupp: {
    enabled: false,
  },
  logger: {
    level: 'info',
    structured: false,
  },
};

// ============================================================================
// GUPP Adapter (Stub)
// ============================================================================

/**
 * GUPP (Git Universal Pull/Push) Adapter
 *
 * Provides integration with external Git services for cross-repository
 * bead synchronization. This is a stub implementation - full implementation
 * would connect to GUPP services.
 */
export interface IGuppAdapter {
  /** Check if GUPP is available */
  isAvailable(): boolean;
  /** Pull beads from remote */
  pull(options?: { rig?: string; since?: Date }): Promise<Bead[]>;
  /** Push beads to remote */
  push(beads: Bead[]): Promise<{ pushed: number; errors: string[] }>;
  /** Sync with remote */
  sync(): Promise<{ pulled: number; pushed: number; conflicts: string[] }>;
}

/**
 * GUPP Adapter stub implementation
 */
export class GuppAdapterStub implements IGuppAdapter {
  private enabled: boolean;
  private endpoint?: string;

  constructor(config?: GasTownBridgeConfig['gupp']) {
    this.enabled = config?.enabled ?? false;
    this.endpoint = config?.endpoint;
  }

  isAvailable(): boolean {
    return this.enabled && !!this.endpoint;
  }

  async pull(_options?: { rig?: string; since?: Date }): Promise<Bead[]> {
    if (!this.isAvailable()) {
      return [];
    }
    // Stub: Would connect to GUPP endpoint
    console.warn('[GUPP] Pull not implemented - stub adapter');
    return [];
  }

  async push(_beads: Bead[]): Promise<{ pushed: number; errors: string[] }> {
    if (!this.isAvailable()) {
      return { pushed: 0, errors: ['GUPP not configured'] };
    }
    // Stub: Would connect to GUPP endpoint
    console.warn('[GUPP] Push not implemented - stub adapter');
    return { pushed: 0, errors: ['Not implemented'] };
  }

  async sync(): Promise<{ pulled: number; pushed: number; conflicts: string[] }> {
    if (!this.isAvailable()) {
      return { pulled: 0, pushed: 0, conflicts: [] };
    }
    // Stub: Would connect to GUPP endpoint
    console.warn('[GUPP] Sync not implemented - stub adapter');
    return { pulled: 0, pushed: 0, conflicts: [] };
  }
}

// ============================================================================
// Logger
// ============================================================================

export interface PluginLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createPluginLogger(config?: GasTownBridgeConfig['logger']): PluginLogger {
  const level = config?.level ?? 'info';
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[level];

  const log = (msgLevel: keyof typeof levels, msg: string, meta?: Record<string, unknown>) => {
    if (levels[msgLevel] >= currentLevel) {
      const prefix = `[gastown-bridge:${msgLevel}]`;
      if (config?.structured) {
        console.log(JSON.stringify({ level: msgLevel, msg, ...meta, timestamp: new Date().toISOString() }));
      } else {
        console.log(`${prefix} ${msg}`, meta ?? '');
      }
    }
  };

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}

// ============================================================================
// WASM Loader Adapter
// ============================================================================

/**
 * Adapter to make wasm-loader work with FormulaExecutor's IWasmLoader interface.
 *
 * Since the WASM functions are async but IWasmLoader expects sync methods,
 * we use synchronous JavaScript fallback implementations. The WASM modules
 * are still loaded for caching/preloading purposes but the actual operations
 * use sync fallbacks to satisfy the interface contract.
 */
export class WasmLoaderAdapter implements IWasmLoader {
  private initialized = false;

  async initialize(): Promise<void> {
    try {
      // Preload WASM modules for caching (they will be used async elsewhere)
      await loadFormulaWasm();
      await loadGnnWasm();
      this.initialized = true;
    } catch {
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized && isWasmAvailable();
  }

  /**
   * Synchronous TOML parsing fallback (basic implementation)
   */
  parseFormula(content: string): Formula {
    // Basic TOML parsing - for full TOML support, the async WASM version is preferred
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        if (!result[currentSection]) result[currentSection] = {};
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        let value: unknown = kvMatch[2].trim();

        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
        else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string);
        else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
          value = (value as string).slice(1, -1);
        }

        if (currentSection) {
          (result[currentSection] as Record<string, unknown>)[key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    return {
      name: (result['name'] as string) || 'unknown',
      description: (result['description'] as string) || '',
      type: (result['type'] as Formula['type']) || 'workflow',
      version: (result['version'] as number) || 1,
      steps: result['steps'] as Formula['steps'],
      legs: result['legs'] as Formula['legs'],
      vars: result['vars'] as Formula['vars'],
      metadata: result['metadata'] as Formula['metadata'],
    };
  }

  /**
   * Synchronous variable substitution
   */
  cookFormula(formula: Formula, vars: Record<string, string>): CookedFormula {
    const substituteVars = (text: string): string => {
      let result = text;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }
      return result;
    };

    const substituteObject = <T>(obj: T): T => {
      if (typeof obj === 'string') return substituteVars(obj) as T;
      if (Array.isArray(obj)) return obj.map(substituteObject) as T;
      if (obj !== null && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substituteObject(value);
        }
        return result as T;
      }
      return obj;
    };

    const cooked = substituteObject(formula);
    return {
      ...cooked,
      cookedAt: new Date(),
      cookedVars: vars,
      originalName: formula.name,
    };
  }

  /**
   * Synchronous batch cooking
   */
  batchCook(formulas: Formula[], varsArray: Record<string, string>[]): CookedFormula[] {
    return formulas.map((formula, i) => this.cookFormula(formula, varsArray[i] ?? {}));
  }

  /**
   * Synchronous topological sort using Kahn's algorithm
   */
  resolveStepDependencies(steps: Step[]): Step[] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    for (const step of steps) {
      inDegree.set(step.id, 0);
      graph.set(step.id, []);
    }

    for (const step of steps) {
      for (const dep of step.needs ?? []) {
        graph.get(dep)?.push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(id);
      for (const neighbor of graph.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== steps.length) {
      const cycleNodes = steps.filter(s => !sorted.includes(s.id)).map(s => s.id);
      throw new GasTownError(
        'Cycle detected in step dependencies',
        GasTownErrorCode.DEPENDENCY_CYCLE,
        { cycleNodes }
      );
    }

    const stepMap = new Map(steps.map(s => [s.id, s]));
    return sorted.map(id => stepMap.get(id)).filter((s): s is Step => s !== undefined);
  }

  /**
   * Synchronous cycle detection using DFS
   */
  detectCycle(steps: Step[]): { hasCycle: boolean; cycleSteps?: string[] } {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const graph = new Map<string, string[]>();
    const colors = new Map<string, number>();

    for (const step of steps) {
      graph.set(step.id, step.needs ?? []);
      colors.set(step.id, WHITE);
    }

    const cycleNodes: string[] = [];

    const dfs = (id: string, path: string[]): boolean => {
      colors.set(id, GRAY);
      path.push(id);

      for (const dep of graph.get(id) || []) {
        if (colors.get(dep) === GRAY) {
          const cycleStart = path.indexOf(dep);
          cycleNodes.push(...path.slice(cycleStart));
          return true;
        }
        if (colors.get(dep) === WHITE && dfs(dep, path)) {
          return true;
        }
      }

      colors.set(id, BLACK);
      path.pop();
      return false;
    };

    for (const step of steps) {
      if (colors.get(step.id) === WHITE && dfs(step.id, [])) {
        break;
      }
    }

    return {
      hasCycle: cycleNodes.length > 0,
      cycleSteps: cycleNodes.length > 0 ? [...new Set(cycleNodes)] : undefined,
    };
  }
}

// ============================================================================

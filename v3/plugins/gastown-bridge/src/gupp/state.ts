/**
 * GUPP State Persistence
 *
 * State management for the Gastown Universal Propulsion Principle (GUPP).
 * GUPP principle: "If work is on your hook, YOU MUST RUN IT"
 *
 * This module provides:
 * - State interfaces for tracking active work
 * - Disk/AgentDB persistence for crash recovery
 * - State merging for conflict resolution
 *
 * @module gastown-bridge/gupp/state
 * @version 0.1.0
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Convoy, Formula, ConvoyProgress, ConvoyStatus } from '../types.js';


// Constants/types/schemas extracted into ./state-defs.ts during
// campaign-2 wave 78 (W284). 'export *' keeps the surface
// byte-identical.
export * from './state-defs.js';
import {
  AGENTDB_NAMESPACE,
  DEFAULT_STATE_PATH,
  GuppStateSchema,
  HookedWorkItemSchema,
  SessionInfoSchema,
  WorkItemStatusSchema,
} from './state-defs.js';
import type {
  GuppState,
  HookedWorkItem,
  SessionInfo,
} from './state-defs.js';

// ============================================================================
// State Factory
// ============================================================================

/**
 * Create an empty GUPP state
 */
export function createEmptyState(): GuppState {
  return {
    version: 1,
    session: undefined,
    convoys: [],
    formulas: [],
    hookedWork: [],
    updatedAt: new Date(),
    recovery: {
      crashCount: 0,
      autoRecoverEnabled: true,
    },
  };
}

/**
 * Create a new session
 */
export function createSession(id: string, owner?: string): SessionInfo {
  const now = new Date();
  return {
    id,
    startedAt: now,
    lastActiveAt: now,
    active: true,
    owner,
  };
}

/**
 * Create a hooked work item
 */
export function createHookedWorkItem(
  id: string,
  title: string,
  options?: Partial<Omit<HookedWorkItem, 'id' | 'title' | 'hookedAt' | 'updatedAt'>>
): HookedWorkItem {
  const now = new Date();
  return {
    id,
    title,
    status: options?.status ?? 'pending',
    priority: options?.priority ?? 5,
    hookedAt: now,
    updatedAt: now,
    progress: options?.progress ?? 0,
    beadId: options?.beadId,
    convoyId: options?.convoyId,
    assignee: options?.assignee,
    formula: options?.formula,
    metadata: options?.metadata,
  };
}

// ============================================================================
// State Persistence - Disk
// ============================================================================

/**
 * Save state to disk
 *
 * @param state - State to save
 * @param statePath - Path to state file (default: .gupp/state.json)
 */
export async function saveState(
  state: GuppState,
  statePath: string = DEFAULT_STATE_PATH
): Promise<void> {
  // Update timestamp and calculate checksum
  const stateToSave: GuppState = {
    ...state,
    updatedAt: new Date(),
    checksum: calculateChecksum(state),
  };

  // Ensure directory exists
  const dir = path.dirname(statePath);
  await fs.mkdir(dir, { recursive: true });

  // Write state atomically (write to temp, then rename)
  const tempPath = `${statePath}.tmp`;
  const jsonContent = JSON.stringify(stateToSave, null, 2);

  await fs.writeFile(tempPath, jsonContent, 'utf-8');
  await fs.rename(tempPath, statePath);
}

/**
 * Load state from disk
 *
 * @param statePath - Path to state file (default: .gupp/state.json)
 * @returns Loaded state or empty state if not found
 */
export async function loadState(
  statePath: string = DEFAULT_STATE_PATH
): Promise<GuppState> {
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate state structure
    const validated = GuppStateSchema.parse(parsed);

    // Verify checksum if present
    if (validated.checksum) {
      // Destructure to omit checksum for verification
      const { checksum: _, ...stateWithoutChecksum } = validated;
      const expectedChecksum = calculateChecksum(stateWithoutChecksum);
      if (validated.checksum !== expectedChecksum) {
        console.warn(
          '[GUPP] State checksum mismatch - possible corruption. Proceeding with caution.'
        );
      }
    }

    return validated as GuppState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return empty state
      return createEmptyState();
    }

    // Log error and return empty state
    console.error('[GUPP] Failed to load state:', error);
    return createEmptyState();
  }
}

/**
 * Delete state file
 *
 * @param statePath - Path to state file
 */
export async function deleteState(
  statePath: string = DEFAULT_STATE_PATH
): Promise<void> {
  try {
    await fs.unlink(statePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

// ============================================================================
// State Persistence - AgentDB
// ============================================================================

/**
 * AgentDB interface for state storage
 */
export interface AgentDBInterface {
  store(namespace: string, key: string, value: unknown): Promise<void>;
  retrieve(namespace: string, key: string): Promise<unknown | null>;
  delete(namespace: string, key: string): Promise<void>;
}

/**
 * Save state to AgentDB
 *
 * @param state - State to save
 * @param agentDB - AgentDB interface
 * @param key - Storage key (default: 'current')
 */
export async function saveStateToAgentDB(
  state: GuppState,
  agentDB: AgentDBInterface,
  key: string = 'current'
): Promise<void> {
  const stateToSave: GuppState = {
    ...state,
    updatedAt: new Date(),
    checksum: calculateChecksum(state),
  };

  await agentDB.store(AGENTDB_NAMESPACE, key, stateToSave);
}

/**
 * Load state from AgentDB
 *
 * @param agentDB - AgentDB interface
 * @param key - Storage key (default: 'current')
 * @returns Loaded state or empty state if not found
 */
export async function loadStateFromAgentDB(
  agentDB: AgentDBInterface,
  key: string = 'current'
): Promise<GuppState> {
  try {
    const state = await agentDB.retrieve(AGENTDB_NAMESPACE, key);

    if (!state) {
      return createEmptyState();
    }

    const validated = GuppStateSchema.parse(state);
    return validated as GuppState;
  } catch (error) {
    console.error('[GUPP] Failed to load state from AgentDB:', error);
    return createEmptyState();
  }
}

// ============================================================================
// State Merging
// ============================================================================

/**
 * Merge strategy for state conflicts
 */
export type MergeStrategy = 'local' | 'remote' | 'latest' | 'union';

/**
 * Merge two states on conflict
 *
 * Uses the following strategies:
 * - session: Keep the most recently active
 * - convoys: Union with latest status
 * - formulas: Union with latest status
 * - hookedWork: Union, prefer latest status for duplicates
 *
 * @param local - Local state
 * @param remote - Remote state
 * @param strategy - Merge strategy (default: 'latest')
 * @returns Merged state
 */
export function mergeStates(
  local: GuppState,
  remote: GuppState,
  strategy: MergeStrategy = 'latest'
): GuppState {
  // Determine base state based on strategy
  const useLocal =
    strategy === 'local' ||
    (strategy === 'latest' && local.updatedAt >= remote.updatedAt);

  // Merge session - keep the most recently active
  let session: SessionInfo | undefined;
  if (local.session && remote.session) {
    session =
      local.session.lastActiveAt >= remote.session.lastActiveAt
        ? local.session
        : remote.session;
  } else {
    session = local.session ?? remote.session;
  }

  // Merge convoys - union with latest status
  const mergedConvoys = mergeConvoys(local.convoys, remote.convoys);

  // Merge formulas - union with latest status
  const mergedFormulas = mergeFormulas(local.formulas, remote.formulas);

  // Merge hooked work - union with latest status
  const mergedHookedWork = mergeHookedWork(
    local.hookedWork,
    remote.hookedWork
  );

  // Merge recovery metadata
  const recovery = {
    lastCrash: local.recovery?.lastCrash ?? remote.recovery?.lastCrash,
    crashCount:
      (local.recovery?.crashCount ?? 0) + (remote.recovery?.crashCount ?? 0),
    autoRecoverEnabled:
      local.recovery?.autoRecoverEnabled ??
      remote.recovery?.autoRecoverEnabled ??
      true,
  };

  return {
    version: Math.max(local.version, remote.version),
    session,
    convoys: mergedConvoys,
    formulas: mergedFormulas,
    hookedWork: mergedHookedWork,
    updatedAt: new Date(),
    recovery,
  };
}

/**
 * Merge convoy lists
 */
function mergeConvoys(local: Convoy[], remote: Convoy[]): Convoy[] {
  const merged = new Map<string, Convoy>();

  // Add all local convoys
  for (const convoy of local) {
    merged.set(convoy.id, convoy);
  }

  // Merge with remote, prefer latest update
  for (const convoy of remote) {
    const existing = merged.get(convoy.id);
    if (!existing) {
      merged.set(convoy.id, convoy);
    } else {
      // Prefer the more recent update (compare completedAt or startedAt)
      const existingTime =
        existing.completedAt?.getTime() ?? existing.startedAt.getTime();
      const remoteTime =
        convoy.completedAt?.getTime() ?? convoy.startedAt.getTime();

      if (remoteTime > existingTime) {
        merged.set(convoy.id, convoy);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Merge formula lists
 */
function mergeFormulas(
  local: GuppState['formulas'],
  remote: GuppState['formulas']
): GuppState['formulas'] {
  const merged = new Map<string, (typeof local)[0]>();

  // Add all local formulas
  for (const formula of local) {
    merged.set(formula.name, formula);
  }

  // Merge with remote, prefer latest
  for (const formula of remote) {
    const existing = merged.get(formula.name);
    if (!existing) {
      merged.set(formula.name, formula);
    } else if (formula.startedAt > existing.startedAt) {
      merged.set(formula.name, formula);
    }
  }

  return Array.from(merged.values());
}

/**
 * Merge hooked work lists
 */
function mergeHookedWork(
  local: HookedWorkItem[],
  remote: HookedWorkItem[]
): HookedWorkItem[] {
  const merged = new Map<string, HookedWorkItem>();

  // Add all local work items
  for (const work of local) {
    merged.set(work.id, work);
  }

  // Merge with remote, prefer latest update
  for (const work of remote) {
    const existing = merged.get(work.id);
    if (!existing) {
      merged.set(work.id, work);
    } else if (work.updatedAt > existing.updatedAt) {
      merged.set(work.id, work);
    }
  }

  return Array.from(merged.values());
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate a simple checksum for state integrity verification
 */
function calculateChecksum(state: Omit<GuppState, 'checksum'>): string {
  const content = JSON.stringify({
    version: state.version,
    convoyCount: state.convoys.length,
    formulaCount: state.formulas.length,
    workCount: state.hookedWork.length,
    timestamp: state.updatedAt.getTime(),
  });

  // Simple hash function (not cryptographic, just for integrity check)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Validate state structure
 */
export function validateState(state: unknown): state is GuppState {
  try {
    GuppStateSchema.parse(state);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get pending work items (GUPP principle: must run these)
 */
export function getPendingWork(state: GuppState): HookedWorkItem[] {
  return state.hookedWork.filter(
    (work) => work.status === 'pending' || work.status === 'active'
  );
}

/**
 * Get work items that need resumption after crash
 */
export function getWorkNeedingResumption(state: GuppState): HookedWorkItem[] {
  return state.hookedWork.filter(
    (work) =>
      work.status === 'active' ||
      work.status === 'pending' ||
      work.status === 'paused'
  );
}

/**
 * Update session activity timestamp
 */
export function touchSession(state: GuppState): GuppState {
  if (!state.session) {
    return state;
  }

  return {
    ...state,
    session: {
      ...state.session,
      lastActiveAt: new Date(),
    },
    updatedAt: new Date(),
  };
}

/**
 * Mark session as ended
 */
export function endSession(state: GuppState): GuppState {
  if (!state.session) {
    return state;
  }

  return {
    ...state,
    session: {
      ...state.session,
      active: false,
      lastActiveAt: new Date(),
    },
    updatedAt: new Date(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  GuppStateSchema,
  HookedWorkItemSchema,
  SessionInfoSchema,
  WorkItemStatusSchema,
};

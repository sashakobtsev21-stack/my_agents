/**
 * Coordination MCP Tools — store types & IO helpers
 *
 * Module-private in the original coordination-tools.ts (campaign-2
 * W254); NOT re-exported by the barrel.
 */

import { getProjectCwd } from './types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const STORAGE_DIR = '.claude-flow';
export const COORD_DIR = 'coordination';
export const COORD_FILE = 'store.json';

export interface TopologyConfig {
  type: 'mesh' | 'hierarchical' | 'ring' | 'star' | 'hybrid' | 'hierarchical-mesh';
  maxNodes: number;
  redundancy: number;
  consensusAlgorithm: string;
}

export interface LoadBalanceConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'adaptive';
  weights: Record<string, number>;
  healthCheck: boolean;
}

export interface SyncState {
  lastSync: string;
  syncCount: number;
  conflicts: number;
  pendingChanges: number;
}

export interface CoordConsensusProposal {
  proposalId: string;
  type: string;
  proposal: unknown;
  proposedBy: string;
  proposedAt: string;
  votes: Record<string, boolean>;
  status: string;
  strategy: string;
  term?: number;
  quorumPreset?: string;
  byzantineVoters?: string[];
}

export interface CoordConsensusResult {
  proposalId: string;
  result: string;
  votes: { for: number; against: number };
  decidedAt: string;
  strategy: string;
  term?: number;
  byzantineDetected?: string[];
}

export interface CoordConsensusState {
  pending: CoordConsensusProposal[];
  history: CoordConsensusResult[];
}

export interface CoordinationStore {
  topology: TopologyConfig;
  loadBalance: LoadBalanceConfig;
  sync: SyncState;
  nodes: Record<string, { id: string; status: string; load: number; lastHeartbeat: string }>;
  version: string;
  consensus?: CoordConsensusState;
}

export function getCoordDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, COORD_DIR);
}

export function getCoordPath(): string {
  return join(getCoordDir(), COORD_FILE);
}

export function ensureCoordDir(): void {
  const dir = getCoordDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadCoordStore(): CoordinationStore {
  try {
    const path = getCoordPath();
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // Return default store
  }
  return {
    topology: {
      type: 'hierarchical',
      maxNodes: 15,
      redundancy: 2,
      consensusAlgorithm: 'raft',
    },
    loadBalance: {
      algorithm: 'adaptive',
      weights: {},
      healthCheck: true,
    },
    sync: {
      lastSync: new Date().toISOString(),
      syncCount: 0,
      conflicts: 0,
      pendingChanges: 0,
    },
    nodes: {},
    version: '3.0.0',
  };
}

export function saveCoordStore(store: CoordinationStore): void {
  ensureCoordDir();
  writeFileSync(getCoordPath(), JSON.stringify(store, null, 2), 'utf-8');
}


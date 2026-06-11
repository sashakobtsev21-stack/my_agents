/**
 * Deployment Command — state shapes & persistence helpers
 *
 * Module-private in the original deployment.ts (campaign-2 W273); NOT
 * re-exported.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DeploymentEnv {
  name: string;
  type: string; // 'local' | 'staging' | 'production'
  url?: string;
  createdAt: string;
}

export interface DeploymentRecord {
  id: string;
  environment: string;
  version: string;
  status: 'deployed' | 'rolled-back' | 'failed';
  timestamp: string;
  description?: string;
}

export interface DeploymentState {
  environments: Record<string, DeploymentEnv>;
  history: DeploymentRecord[];
  activeDeployment?: string;
}

// ============================================
// State Helpers
// ============================================

export function getStateDir(cwd: string): string {
  return path.join(cwd, '.claude-flow');
}

export function getStatePath(cwd: string): string {
  return path.join(getStateDir(cwd), 'deployments.json');
}

export function emptyState(): DeploymentState {
  return { environments: {}, history: [], activeDeployment: undefined };
}

export function loadDeploymentState(cwd: string): DeploymentState {
  const filePath = getStatePath(cwd);
  if (!fs.existsSync(filePath)) {
    return emptyState();
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as DeploymentState;
  } catch {
    return emptyState();
  }
}

export function saveDeploymentState(cwd: string, state: DeploymentState): void {
  const dir = getStateDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getStatePath(cwd);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `dep-${ts}-${rand}`;
}

export function readProjectVersion(cwd: string): string | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

// ============================================
// Deploy subcommand
// ============================================


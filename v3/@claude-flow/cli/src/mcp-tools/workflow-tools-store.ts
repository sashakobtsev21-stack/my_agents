/**
 * Workflow MCP Tools — store types & IO helpers
 *
 * The workflow record/step/store shapes and the .claude-flow/workflows
 * persistence helpers. Module-private in the original workflow-tools.ts
 * (campaign-2 W217); NOT re-exported by the barrel.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectCwd } from './types.js';

export const STORAGE_DIR = '.claude-flow';
export const WORKFLOW_DIR = 'workflows';
export const WORKFLOW_FILE = 'store.json';

export interface WorkflowStep {
  stepId: string;
  name: string;
  type: 'task' | 'condition' | 'parallel' | 'loop' | 'wait';
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowRecord {
  workflowId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  variables: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowStore {
  workflows: Record<string, WorkflowRecord>;
  templates: Record<string, WorkflowRecord>;
  version: string;
}

export function getWorkflowDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, WORKFLOW_DIR);
}

export function getWorkflowPath(): string {
  return join(getWorkflowDir(), WORKFLOW_FILE);
}

export function ensureWorkflowDir(): void {
  const dir = getWorkflowDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadWorkflowStore(): WorkflowStore {
  try {
    const path = getWorkflowPath();
    if (existsSync(path)) {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Return default store on error
  }
  return { workflows: {}, templates: {}, version: '3.0.0' };
}

export function saveWorkflowStore(store: WorkflowStore): void {
  ensureWorkflowDir();
  writeFileSync(getWorkflowPath(), JSON.stringify(store, null, 2), 'utf-8');
}


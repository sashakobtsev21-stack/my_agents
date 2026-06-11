/**
 * Agent MCP Tools — store, hive registry, model defaults & router cache
 *
 * Module-private in the original agent-tools.ts (campaign-2 W256); NOT
 * re-exported by the barrel. The mutable router-cache let stays with
 * its writer (the lazy loader below).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectCwd } from './types.js';

export const STORAGE_DIR = '.claude-flow';
export const AGENT_DIR = 'agents';
export const AGENT_FILE = 'store.json';
// #1916: hive-mind_spawn writes its workers to `.claude-flow/agents.json`
// (a *different* file from the canonical `.claude-flow/agents/store.json`
// used here). agent_status / agent_list / agent_logs merge that store so a
// hive-spawned worker is resolvable instead of returning `not_found`.
export const HIVE_AGENT_FILE = 'agents.json';

// Model types matching Claude Agent SDK
type ClaudeModel = 'haiku' | 'sonnet' | 'opus' | 'opus-4.7' | 'inherit';

export interface AgentRecord {
  agentId: string;
  agentType: string;
  status: 'idle' | 'busy' | 'terminated';
  health: number;
  taskCount: number;
  config: Record<string, unknown>;
  createdAt: string;
  domain?: string;
  model?: ClaudeModel;  // Model assigned to this agent
  modelRoutedBy?: 'explicit' | 'router' | 'codemod' | 'default';  // How model was determined (ADR-026, ADR-143)
  lastResult?: Record<string, unknown>;  // Output from last completed task
}

export interface AgentStore {
  agents: Record<string, AgentRecord>;
  version: string;
}

export function getAgentDir(): string {
  return join(getProjectCwd(), STORAGE_DIR, AGENT_DIR);
}

export function getAgentPath(): string {
  return join(getAgentDir(), AGENT_FILE);
}

export function ensureAgentDir(): void {
  const dir = getAgentDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadAgentStore(): AgentStore {
  try {
    const path = getAgentPath();
    if (existsSync(path)) {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Return empty store on error
  }
  return { agents: {}, version: '3.0.0' };
}

export function saveAgentStore(store: AgentStore): void {
  ensureAgentDir();
  writeFileSync(getAgentPath(), JSON.stringify(store, null, 2), 'utf-8');
}

// #1916: read hive-mind-spawned workers from `.claude-flow/agents.json`.
export function getHiveAgentPath(): string {
  return join(getProjectCwd(), STORAGE_DIR, HIVE_AGENT_FILE);
}

export function loadHiveAgents(): Record<string, AgentRecord> {
  try {
    const path = getHiveAgentPath();
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      if (data && typeof data.agents === 'object' && data.agents) {
        return data.agents as Record<string, AgentRecord>;
      }
    }
  } catch {
    // Ignore — hive store is optional/best-effort.
  }
  return {};
}

/**
 * #1916: merged view of every tracked agent — the canonical agent store
 * plus hive-mind-spawned workers. On an id collision the canonical record
 * wins (it carries model-routing + lastResult that the hive store omits).
 */
export function loadAllAgents(): Record<string, AgentRecord> {
  return { ...loadHiveAgents(), ...loadAgentStore().agents };
}

// Default model mappings for agent types (can be overridden)
export const AGENT_TYPE_MODEL_DEFAULTS: Record<string, ClaudeModel> = {
  // Complex agents → opus
  'architect': 'opus',
  'security-architect': 'opus',
  'system-architect': 'opus',
  'core-architect': 'opus',
  // Medium complexity → sonnet
  'coder': 'sonnet',
  'reviewer': 'sonnet',
  'researcher': 'sonnet',
  'tester': 'sonnet',
  'analyst': 'sonnet',
  // Simple/fast agents → haiku
  'formatter': 'haiku',
  'linter': 'haiku',
  'documenter': 'haiku',
};

// Lazy-loaded model router
export let modelRouterInstance: Awaited<ReturnType<typeof import('../ruvector/model-router.js').getModelRouter>> | null = null;

export async function getModelRouter() {
  if (!modelRouterInstance) {
    try {
      const { getModelRouter } = await import('../ruvector/model-router.js');
      modelRouterInstance = getModelRouter();
    } catch (e) {
      // Log but don't fail - model router is optional
      console.error('[agent-tools] Model router load failed:', (e as Error).message);
    }
  }
  return modelRouterInstance;
}

/**
 * Determine model for agent based on (ADR-026 3-tier routing):
 * 1. Explicit model in config
 * 2. Enhanced task-based routing with deterministic Tier-1 codemods (if task provided)
 * 3. Agent type defaults
 * 4. Fallback to sonnet
 */
export async function determineAgentModel(
  agentType: string,
  config: Record<string, unknown>,
  task?: string
): Promise<{
  model: ClaudeModel;
  routedBy: 'explicit' | 'router' | 'codemod' | 'default';
  canSkipLLM?: boolean;
  codemodIntent?: string;
  tier?: 1 | 2 | 3;
}> {
  // 1. Explicit model in config
  if (config.model && ['haiku', 'sonnet', 'opus', 'opus-4.7', 'inherit'].includes(config.model as string)) {
    return { model: config.model as ClaudeModel, routedBy: 'explicit' };
  }

  // 2. Enhanced task-based routing with deterministic Tier-1 codemods
  if (task) {
    try {
      // Try enhanced router first (includes codemod-intent detection)
      const { getEnhancedModelRouter } = await import('../ruvector/enhanced-model-router.js');
      const enhancedRouter = getEnhancedModelRouter();
      const routeResult = await enhancedRouter.route(task, { filePath: config.filePath as string });

      if (routeResult.tier === 1 && routeResult.canSkipLLM) {
        // Deterministic codemod can apply this edit ($0, no LLM)
        return {
          model: 'haiku', // fallback model if the codemod can't apply
          routedBy: 'codemod',
          canSkipLLM: true,
          codemodIntent: (routeResult.codemodIntent ?? routeResult.agentBoosterIntent)?.type,
          tier: 1,
        };
      }

      return {
        model: routeResult.model!,
        routedBy: 'router',
        tier: routeResult.tier,
      };
    } catch {
      // Enhanced router not available, try basic router
      const router = await getModelRouter();
      if (router) {
        try {
          const result = await router.route(task);
          return { model: result.model, routedBy: 'router' };
        } catch {
          // Fall through to defaults on router error
        }
      }
    }
  }

  // 3. Agent type defaults
  const defaultModel = AGENT_TYPE_MODEL_DEFAULTS[agentType];
  if (defaultModel) {
    return { model: defaultModel, routedBy: 'default' };
  }

  // 4. Fallback to sonnet (balanced)
  return { model: 'sonnet', routedBy: 'default' };
}


/**
 * Autopilot MCP Tools
 *
 * 10 MCP tools for persistent swarm completion management.
 * Allows programmatic control of the autopilot loop via MCP.
 *
 * ADR-072: Autopilot Integration
 * @module @claude-flow/cli/mcp-tools/autopilot
 */

import type { MCPTool } from './types.js';
import { autopilotCheck } from '../commands/autopilot.js';

// ── State Helpers (shared with CLI command) ───────────────────

const STATE_DIR = '.claude-flow/data';
const STATE_FILE = `${STATE_DIR}/autopilot-state.json`;
const LOG_FILE = `${STATE_DIR}/autopilot-log.json`;

interface AutopilotState {
  sessionId: string;
  enabled: boolean;
  startTime: number;
  iterations: number;
  maxIterations: number;
  timeoutMinutes: number;
  taskSources: string[];
  lastCheck: number | null;
  history: Array<{ ts: number; iteration: number; completed: number; total: number }>;
}

function loadState(): AutopilotState {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const crypto = require('crypto') as typeof import('crypto');
  const filePath = path.resolve(STATE_FILE);
  const defaults: AutopilotState = {
    sessionId: crypto.randomUUID(),
    enabled: false,
    startTime: Date.now(),
    iterations: 0,
    maxIterations: 50,
    timeoutMinutes: 240,
    taskSources: ['team-tasks', 'swarm-tasks', 'file-checklist'],
    lastCheck: null,
    history: [],
  };
  try {
    if (fs.existsSync(filePath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return defaults;
}

function saveState(state: AutopilotState): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dir = path.resolve(STATE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.resolve(STATE_FILE), JSON.stringify(state, null, 2));
}

function appendLog(entry: Record<string, unknown>): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.resolve(LOG_FILE);
  const dir = path.resolve(STATE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let log: Record<string, unknown>[] = [];
  try {
    if (fs.existsSync(filePath)) log = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  log.push(entry);
  if (log.length > 1000) log = log.slice(-1000);
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
}

function loadLog(): Record<string, unknown>[] {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.resolve(LOG_FILE);
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  return [];
}

// Reuse the same task discovery from CLI
function discoverTasks(sources: string[]): Array<{ id: string; subject: string; status: string; source: string }> {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');
  const tasks: Array<{ id: string; subject: string; status: string; source: string }> = [];
  const TERMINAL = new Set(['completed', 'done', 'cancelled', 'skipped', 'failed']);

  for (const source of sources) {
    if (source === 'team-tasks') {
      const dir = path.join(os.homedir(), '.claude', 'tasks');
      try {
        if (fs.existsSync(dir)) {
          for (const team of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!team.isDirectory()) continue;
            for (const f of fs.readdirSync(path.join(dir, team.name)).filter((n: string) => n.endsWith('.json'))) {
              try {
                const d = JSON.parse(fs.readFileSync(path.join(dir, team.name, f), 'utf-8'));
                tasks.push({ id: d.id || f, subject: d.subject || f, status: d.status || 'unknown', source: 'team-tasks' });
              } catch { /* skip */ }
            }
          }
        }
      } catch { /* ignore */ }
    }
    if (source === 'swarm-tasks') {
      try {
        const f = path.resolve('.claude-flow/swarm-tasks.json');
        if (fs.existsSync(f)) {
          const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
          for (const t of (Array.isArray(d) ? d : d.tasks || [])) {
            tasks.push({ id: t.id || `swarm-${tasks.length}`, subject: t.subject || t.description || 'Unnamed', status: t.status || 'unknown', source: 'swarm-tasks' });
          }
        }
      } catch { /* ignore */ }
    }
    if (source === 'file-checklist') {
      try {
        const f = path.resolve('.claude-flow/data/checklist.json');
        if (fs.existsSync(f)) {
          const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
          for (const item of (Array.isArray(d) ? d : d.items || [])) {
            tasks.push({ id: item.id || `check-${tasks.length}`, subject: item.subject || item.text || 'Unnamed', status: item.status || (item.done ? 'completed' : 'pending'), source: 'file-checklist' });
          }
        }
      } catch { /* ignore */ }
    }
  }
  return tasks;
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ── MCP Tool Definitions ──────────────────────────────────────

const autopilotStatus: MCPTool = {
  name: 'autopilot_status',
  description: 'Get autopilot state including enabled status, iteration count, task progress, and learning metrics.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    const tasks = discoverTasks(state.taskSources);
    const completed = tasks.filter(t => ['completed', 'done', 'cancelled', 'skipped', 'failed'].includes(t.status.toLowerCase())).length;
    return ok({
      enabled: state.enabled,
      sessionId: state.sessionId,
      iterations: state.iterations,
      maxIterations: state.maxIterations,
      timeoutMinutes: state.timeoutMinutes,
      elapsedMs: state.enabled ? Date.now() - state.startTime : 0,
      tasks: { completed, total: tasks.length, percent: tasks.length === 0 ? 100 : Math.round((completed / tasks.length) * 100) },
      taskSources: state.taskSources,
    });
  },
};

const autopilotEnable: MCPTool = {
  name: 'autopilot_enable',
  description: 'Enable autopilot persistent completion. Agents will be re-engaged when tasks remain incomplete.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    state.enabled = true;
    state.startTime = Date.now();
    state.iterations = 0;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'enabled', sessionId: state.sessionId });
    return ok({ enabled: true, maxIterations: state.maxIterations, timeoutMinutes: state.timeoutMinutes });
  },
};

const autopilotDisable: MCPTool = {
  name: 'autopilot_disable',
  description: 'Disable autopilot. Agents will be allowed to stop even if tasks remain.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    state.enabled = false;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'disabled', iterations: state.iterations });
    return ok({ enabled: false });
  },
};

const autopilotConfig: MCPTool = {
  name: 'autopilot_config',
  description: 'Configure autopilot limits: max iterations (1-1000), timeout in minutes (1-1440), and task sources.',
  category: 'autopilot',
  inputSchema: {
    type: 'object',
    properties: {
      maxIterations: { type: 'number', description: 'Max re-engagement iterations (1-1000)' },
      timeoutMinutes: { type: 'number', description: 'Timeout in minutes (1-1440)' },
      taskSources: { type: 'array', items: { type: 'string' }, description: 'Task sources: team-tasks, swarm-tasks, file-checklist' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const state = loadState();
    if (params.maxIterations !== undefined) state.maxIterations = Math.min(Math.max(1, params.maxIterations as number), 1000);
    if (params.timeoutMinutes !== undefined) state.timeoutMinutes = Math.min(Math.max(1, params.timeoutMinutes as number), 1440);
    if (params.taskSources) state.taskSources = params.taskSources as string[];
    saveState(state);
    return ok({ maxIterations: state.maxIterations, timeoutMinutes: state.timeoutMinutes, taskSources: state.taskSources });
  },
};

const autopilotReset: MCPTool = {
  name: 'autopilot_reset',
  description: 'Reset autopilot iteration counter and restart the timer.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    state.iterations = 0;
    state.startTime = Date.now();
    state.history = [];
    state.lastCheck = null;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'reset' });
    return ok({ reset: true, iterations: 0 });
  },
};

const autopilotLog: MCPTool = {
  name: 'autopilot_log',
  description: 'Retrieve the autopilot event log. Shows enable/disable events, re-engagements, completions.',
  category: 'autopilot',
  inputSchema: {
    type: 'object',
    properties: {
      last: { type: 'number', description: 'Return only the last N entries' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const log = loadLog();
    const last = params.last as number | undefined;
    return ok(last ? log.slice(-last) : log);
  },
};

const autopilotProgress: MCPTool = {
  name: 'autopilot_progress',
  description: 'Detailed task progress broken down by source (team-tasks, swarm-tasks, file-checklist).',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    const tasks = discoverTasks(state.taskSources);
    const bySource: Record<string, { completed: number; total: number; tasks: unknown[] }> = {};

    for (const t of tasks) {
      if (!bySource[t.source]) bySource[t.source] = { completed: 0, total: 0, tasks: [] };
      bySource[t.source].total++;
      if (['completed', 'done', 'cancelled', 'skipped', 'failed'].includes(t.status.toLowerCase())) {
        bySource[t.source].completed++;
      }
      bySource[t.source].tasks.push(t);
    }

    const completed = tasks.filter(t => ['completed', 'done', 'cancelled', 'skipped', 'failed'].includes(t.status.toLowerCase())).length;
    return ok({
      overall: { completed, total: tasks.length, percent: tasks.length === 0 ? 100 : Math.round((completed / tasks.length) * 100) },
      bySource,
    });
  },
};

const autopilotLearn: MCPTool = {
  name: 'autopilot_learn',
  description: 'Discover success patterns from past task completions. Requires AgentDB for full functionality.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    try {
      const modPath = 'agentic-flow/dist/coordination/autopilot-learning.js';
      const mod = await import(/* webpackIgnore: true */ modPath).catch(() => null);
      if (mod?.AutopilotLearning) {
        const learning = new mod.AutopilotLearning();
        if (await learning.initialize()) {
          const [metrics, patterns] = await Promise.all([learning.getMetrics(), learning.discoverSuccessPatterns()]);
          return ok({ metrics, patterns });
        }
      }
    } catch { /* not available */ }
    return ok({ available: false, reason: 'AgentDB/AutopilotLearning not initialized', patterns: [] });
  },
};

const autopilotHistory: MCPTool = {
  name: 'autopilot_history',
  description: 'Search past completion episodes by keyword. Requires AgentDB.',
  category: 'autopilot',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    required: ['query'],
  },
  handler: async (params: Record<string, unknown>) => {
    const query = params.query as string;
    const limit = (params.limit as number) || 10;
    try {
      const modPath = 'agentic-flow/dist/coordination/autopilot-learning.js';
      const mod = await import(/* webpackIgnore: true */ modPath).catch(() => null);
      if (mod?.AutopilotLearning) {
        const learning = new mod.AutopilotLearning();
        if (await learning.initialize()) {
          const results = await learning.recallSimilarTasks(query, limit);
          return ok({ query, results });
        }
      }
    } catch { /* not available */ }
    return ok({ query, results: [], available: false });
  },
};

const autopilotPredict: MCPTool = {
  name: 'autopilot_predict',
  description: 'Predict the optimal next action based on current state and learned patterns.',
  category: 'autopilot',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const state = loadState();
    try {
      const modPath = 'agentic-flow/dist/coordination/autopilot-learning.js';
      const mod = await import(/* webpackIgnore: true */ modPath).catch(() => null);
      if (mod?.AutopilotLearning) {
        const learning = new mod.AutopilotLearning();
        if (await learning.initialize()) {
          const prediction = await learning.predictNextAction(state);
          return ok(prediction);
        }
      }
    } catch { /* not available */ }

    // Heuristic fallback
    const tasks = discoverTasks(state.taskSources);
    const incomplete = tasks.filter(t => !['completed', 'done', 'cancelled', 'skipped', 'failed'].includes(t.status.toLowerCase()));
    if (incomplete.length === 0) {
      return ok({ action: 'none', confidence: 1.0, reason: 'All tasks complete' });
    }
    return ok({
      action: `Work on: ${incomplete[0].subject}`,
      confidence: 0.5,
      reason: 'Heuristic (learning not available)',
      remaining: incomplete.length,
    });
  },
};

// ── Export ─────────────────────────────────────────────────────

export const autopilotTools: MCPTool[] = [
  autopilotStatus,
  autopilotEnable,
  autopilotDisable,
  autopilotConfig,
  autopilotReset,
  autopilotLog,
  autopilotProgress,
  autopilotLearn,
  autopilotHistory,
  autopilotPredict,
];

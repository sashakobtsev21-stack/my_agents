/**
 * V3 CLI Autopilot Command
 * Persistent swarm completion — keeps agents working until ALL tasks are done.
 *
 * ADR-072: Autopilot Integration
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

// ── State Management ──────────────────────────────────────────

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

interface AutopilotLogEntry {
  ts: number;
  event: string;
  [key: string]: unknown;
}

interface TaskInfo {
  id: string;
  subject: string;
  status: string;
  source: string;
}

function getDefaultState(): AutopilotState {
  const crypto = require('crypto') as typeof import('crypto');
  return {
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
}

function loadState(): AutopilotState {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.resolve(STATE_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return { ...getDefaultState(), ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return getDefaultState();
}

function saveState(state: AutopilotState): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dir = path.resolve(STATE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.resolve(STATE_FILE), JSON.stringify(state, null, 2));
}

function appendLog(entry: AutopilotLogEntry): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.resolve(LOG_FILE);
  const dir = path.resolve(STATE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let log: AutopilotLogEntry[] = [];
  try {
    if (fs.existsSync(filePath)) {
      log = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  log.push(entry);
  if (log.length > 1000) log = log.slice(-1000);
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
}

function loadLog(): AutopilotLogEntry[] {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.resolve(LOG_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

// ── Task Discovery ────────────────────────────────────────────

export function discoverTasks(sources: string[]): TaskInfo[] {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');
  const tasks: TaskInfo[] = [];

  for (const source of sources) {
    if (source === 'team-tasks') {
      const tasksDir = path.join(os.homedir(), '.claude', 'tasks');
      try {
        if (fs.existsSync(tasksDir)) {
          const teams = fs.readdirSync(tasksDir, { withFileTypes: true });
          for (const team of teams) {
            if (!team.isDirectory()) continue;
            const teamDir = path.join(tasksDir, team.name);
            const files = fs.readdirSync(teamDir).filter((f: string) => f.endsWith('.json'));
            for (const file of files) {
              try {
                const data = JSON.parse(fs.readFileSync(path.join(teamDir, file), 'utf-8'));
                tasks.push({
                  id: data.id || file.replace('.json', ''),
                  subject: data.subject || data.title || file,
                  status: data.status || 'unknown',
                  source: 'team-tasks',
                });
              } catch { /* skip */ }
            }
          }
        }
      } catch { /* ignore */ }
    }

    if (source === 'swarm-tasks') {
      const swarmFile = path.resolve('.claude-flow/swarm-tasks.json');
      try {
        if (fs.existsSync(swarmFile)) {
          const data = JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
          const swarmTasks = Array.isArray(data) ? data : (data.tasks || []);
          for (const t of swarmTasks) {
            tasks.push({
              id: t.id || t.taskId || `swarm-${tasks.length}`,
              subject: t.subject || t.description || t.name || 'Unnamed task',
              status: t.status || 'unknown',
              source: 'swarm-tasks',
            });
          }
        }
      } catch { /* ignore */ }
    }

    if (source === 'file-checklist') {
      const checklistFile = path.resolve('.claude-flow/data/checklist.json');
      try {
        if (fs.existsSync(checklistFile)) {
          const data = JSON.parse(fs.readFileSync(checklistFile, 'utf-8'));
          const items = Array.isArray(data) ? data : (data.items || []);
          for (const item of items) {
            tasks.push({
              id: item.id || `check-${tasks.length}`,
              subject: item.subject || item.text || item.description || 'Unnamed item',
              status: item.status || (item.done ? 'completed' : 'pending'),
              source: 'file-checklist',
            });
          }
        }
      } catch { /* ignore */ }
    }
  }

  return tasks;
}

const TERMINAL_STATUSES = new Set(['completed', 'done', 'cancelled', 'skipped', 'failed']);

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toLowerCase());
}

function getProgress(tasks: TaskInfo[]): { completed: number; total: number; percent: number; incomplete: TaskInfo[] } {
  const completed = tasks.filter(t => isTerminal(t.status)).length;
  const total = tasks.length;
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
  const incomplete = tasks.filter(t => !isTerminal(t.status));
  return { completed, total, percent, incomplete };
}

// ── Reward Calculation ────────────────────────────────────────

function calculateReward(iterations: number, durationMs: number): number {
  const iterFactor = (1 - iterations / (iterations + 10)) * 0.6;
  const timeFactor = (1 - Math.min(durationMs / 3600000, 1)) * 0.4;
  return Math.round((iterFactor + timeFactor) * 100) / 100;
}

// ── Learning Integration (graceful degradation) ───────────────

async function tryLoadLearning(): Promise<{ initialize: () => Promise<boolean>; [key: string]: unknown } | null> {
  try {
    // Dynamic import — won't fail at compile time
    const modPath = 'agentic-flow/dist/coordination/autopilot-learning.js';
    const mod = await import(/* webpackIgnore: true */ modPath).catch(() => null);
    if (mod?.AutopilotLearning) {
      const instance = new mod.AutopilotLearning();
      if (await instance.initialize()) return instance;
    }
  } catch { /* not available */ }
  return null;
}

// ── Check Handler (for Stop hook) ─────────────────────────────

export async function autopilotCheck(): Promise<{ allowStop: boolean; reason: string; continueWith?: string }> {
  const state = loadState();

  if (!state.enabled) {
    return { allowStop: true, reason: 'Autopilot disabled' };
  }

  // Safety: max iterations
  if (state.iterations >= state.maxIterations) {
    state.enabled = false;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'max-iterations-reached', iterations: state.iterations });
    return { allowStop: true, reason: `Max iterations (${state.maxIterations}) reached` };
  }

  // Safety: timeout
  const elapsed = Date.now() - state.startTime;
  if (elapsed > state.timeoutMinutes * 60000) {
    state.enabled = false;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'timeout-reached', elapsed: Math.round(elapsed / 60000) });
    return { allowStop: true, reason: `Timeout (${state.timeoutMinutes} min) reached` };
  }

  // Discover tasks
  const tasks = discoverTasks(state.taskSources);
  if (tasks.length === 0) {
    return { allowStop: true, reason: 'No tasks discovered from any source' };
  }

  const progress = getProgress(tasks);

  if (progress.incomplete.length === 0) {
    const reward = calculateReward(state.iterations, elapsed);
    state.enabled = false;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'all-tasks-complete', total: progress.total, iterations: state.iterations, durationMs: elapsed, reward });
    return { allowStop: true, reason: `All ${progress.total} tasks complete (${state.iterations} iterations, reward: ${reward})` };
  }

  // Stall detection
  const recentHistory = state.history.slice(-5);
  const isStalled = recentHistory.length >= 5 && recentHistory.every(h => h.completed === progress.completed);

  if (isStalled && state.history.length >= 10) {
    state.enabled = false;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'stall-auto-disable', iterations: state.iterations, completed: progress.completed });
    return { allowStop: true, reason: `Stalled: no progress in 10 iterations (${progress.completed}/${progress.total} complete)` };
  }

  // Re-engage
  state.iterations++;
  state.lastCheck = Date.now();
  state.history.push({ ts: Date.now(), iteration: state.iterations, completed: progress.completed, total: progress.total });
  saveState(state);

  const stallWarning = isStalled
    ? '\nWARNING: No progress in 5 iterations. Consider breaking tasks into smaller subtasks or trying a different approach.'
    : '';

  const taskList = progress.incomplete.slice(0, 5).map(t => `- ${t.subject} (${t.status})`).join('\n');
  const moreCount = progress.incomplete.length > 5 ? `\n... and ${progress.incomplete.length - 5} more` : '';

  const continuePrompt = [
    `AUTOPILOT: ${progress.completed}/${progress.total} tasks complete (${progress.percent}%).`,
    `Iteration ${state.iterations}/${state.maxIterations}.`,
    `Remaining tasks:\n${taskList}${moreCount}`,
    stallWarning,
    `Continue working on the remaining tasks. Do not stop until all are complete.`,
  ].join('\n');

  appendLog({ ts: Date.now(), event: 're-engaging', iteration: state.iterations, completed: progress.completed, remaining: progress.incomplete.length });

  return { allowStop: false, reason: `${progress.incomplete.length}/${progress.total} tasks remaining (iteration ${state.iterations}/${state.maxIterations})`, continueWith: continuePrompt };
}

// ── Subcommands ───────────────────────────────────────────────

const statusCommand: Command = {
  name: 'status',
  description: 'Show autopilot state, iterations, and task progress',
  options: [{ name: 'json', type: 'boolean', description: 'Output as JSON' }],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const state = loadState();
    const tasks = discoverTasks(state.taskSources);
    const progress = getProgress(tasks);
    const elapsed = state.enabled ? Date.now() - state.startTime : 0;

    if (ctx.flags?.json) {
      output.printJson({
        enabled: state.enabled, sessionId: state.sessionId, iterations: state.iterations,
        maxIterations: state.maxIterations, timeoutMinutes: state.timeoutMinutes, elapsedMs: elapsed,
        tasks: { completed: progress.completed, total: progress.total, percent: progress.percent },
        taskSources: state.taskSources,
      });
      return { success: true };
    }

    output.writeln(`Autopilot: ${state.enabled ? '✓ ENABLED' : '✗ DISABLED'}`);
    output.writeln(`Session: ${state.sessionId.slice(0, 8)}...`);
    output.writeln(`Iterations: ${state.iterations}/${state.maxIterations}`);
    output.writeln(`Timeout: ${state.timeoutMinutes} min`);
    output.writeln(`Elapsed: ${Math.round(elapsed / 60000)} min`);
    output.writeln(`Tasks: ${progress.completed}/${progress.total} (${progress.percent}%)`);
    output.writeln(`Sources: ${state.taskSources.join(', ')}`);

    if (progress.incomplete.length > 0 && progress.incomplete.length <= 10) {
      output.writeln('\nRemaining tasks:');
      for (const t of progress.incomplete) {
        output.writeln(`  - [${t.source}] ${t.subject} (${t.status})`);
      }
    }
    return { success: true };
  },
};

const enableCommand: Command = {
  name: 'enable',
  description: 'Enable persistent completion',
  action: async (): Promise<CommandResult> => {
    const state = loadState();
    state.enabled = true;
    state.startTime = Date.now();
    state.iterations = 0;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'enabled', sessionId: state.sessionId, maxIterations: state.maxIterations });
    output.writeln(output.success(`Autopilot enabled (max ${state.maxIterations} iterations, ${state.timeoutMinutes} min timeout)`));
    return { success: true };
  },
};

const disableCommand: Command = {
  name: 'disable',
  description: 'Disable re-engagement loop',
  action: async (): Promise<CommandResult> => {
    const state = loadState();
    const wasEnabled = state.enabled;
    state.enabled = false;
    saveState(state);
    if (wasEnabled) appendLog({ ts: Date.now(), event: 'disabled', iterations: state.iterations });
    output.writeln('Autopilot disabled');
    return { success: true };
  },
};

const configCommand: Command = {
  name: 'config',
  description: 'Configure max iterations, timeout, and task sources',
  options: [
    { name: 'max-iterations', type: 'string', description: 'Max re-engagement iterations (1-1000)' },
    { name: 'timeout', type: 'string', description: 'Timeout in minutes (1-1440)' },
    { name: 'task-sources', type: 'string', description: 'Comma-separated task sources' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const state = loadState();
    const maxIter = ctx.flags?.['max-iterations'] as string | undefined;
    const timeout = ctx.flags?.timeout as string | undefined;
    const sources = ctx.flags?.['task-sources'] as string | undefined;

    if (maxIter) state.maxIterations = Math.min(Math.max(1, parseInt(maxIter, 10) || 50), 1000);
    if (timeout) state.timeoutMinutes = Math.min(Math.max(1, parseInt(timeout, 10) || 240), 1440);
    if (sources) state.taskSources = sources.split(',').map(s => s.trim()).filter(Boolean);

    saveState(state);
    appendLog({ ts: Date.now(), event: 'config-updated', maxIterations: state.maxIterations, timeoutMinutes: state.timeoutMinutes, taskSources: state.taskSources });
    output.writeln(`Config updated: maxIterations=${state.maxIterations}, timeout=${state.timeoutMinutes}min, sources=${state.taskSources.join(',')}`);
    return { success: true };
  },
};

const resetCommand: Command = {
  name: 'reset',
  description: 'Reset iteration counter and timer',
  action: async (): Promise<CommandResult> => {
    const state = loadState();
    state.iterations = 0;
    state.startTime = Date.now();
    state.history = [];
    state.lastCheck = null;
    saveState(state);
    appendLog({ ts: Date.now(), event: 'reset' });
    output.writeln('Autopilot state reset (iterations=0, timer restarted)');
    return { success: true };
  },
};

const logCommand: Command = {
  name: 'log',
  description: 'View autopilot event log',
  options: [
    { name: 'last', type: 'string', description: 'Show last N entries' },
    { name: 'json', type: 'boolean', description: 'Output as JSON' },
    { name: 'clear', type: 'boolean', description: 'Clear the log' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    if (ctx.flags?.clear) {
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      try { fs.writeFileSync(path.resolve(LOG_FILE), '[]'); } catch { /* ignore */ }
      output.writeln('Autopilot log cleared');
      return { success: true };
    }

    const log = loadLog();
    const last = ctx.flags?.last ? parseInt(ctx.flags.last as string, 10) : undefined;
    const entries = last ? log.slice(-last) : log;

    if (ctx.flags?.json) {
      output.printJson(entries);
      return { success: true };
    }

    if (entries.length === 0) {
      output.writeln('No autopilot events logged');
      return { success: true };
    }

    for (const e of entries) {
      const time = new Date(e.ts).toISOString().slice(11, 19);
      const details = Object.entries(e).filter(([k]) => k !== 'ts' && k !== 'event').map(([k, v]) => `${k}=${v}`).join(' ');
      output.writeln(`[${time}] ${e.event} ${details}`);
    }
    return { success: true };
  },
};

const learnCommand: Command = {
  name: 'learn',
  description: 'Discover success patterns from past completions',
  options: [{ name: 'json', type: 'boolean', description: 'Output as JSON' }],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const learning = await tryLoadLearning();
    if (!learning) {
      output.writeln('Learning not available (AgentDB not initialized). Autopilot still works for task completion tracking.');
      return { success: true };
    }

    const metrics = await (learning as any).getMetrics();
    const patterns = await (learning as any).discoverSuccessPatterns();

    if (ctx.flags?.json) {
      output.printJson({ metrics, patterns });
      return { success: true };
    }

    output.writeln(`Episodes: ${metrics.episodes}`);
    output.writeln(`Patterns: ${metrics.patterns}`);
    output.writeln(`Trajectories: ${metrics.trajectories}`);

    if (patterns.length > 0) {
      output.writeln('\nDiscovered patterns:');
      for (const p of patterns) {
        output.writeln(`  - ${p.pattern} (freq: ${p.frequency}, reward: ${p.avgReward.toFixed(2)})`);
      }
    }
    return { success: true };
  },
};

const historyCommand: Command = {
  name: 'history',
  description: 'Search past completion episodes',
  options: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'limit', type: 'string', description: 'Max results (default 10)' },
    { name: 'json', type: 'boolean', description: 'Output as JSON' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = (ctx.flags?.query || '') as string;
    const limit = parseInt((ctx.flags?.limit || '10') as string, 10);

    if (!query) {
      output.writeln('Usage: autopilot history --query "search terms" [--limit N]');
      return { success: false, message: 'Missing --query' };
    }

    const learning = await tryLoadLearning();
    if (!learning) {
      output.writeln('Learning not available. No history to search.');
      return { success: true };
    }

    const results = await (learning as any).recallSimilarTasks(query, limit);
    if (ctx.flags?.json) {
      output.printJson(results);
    } else if (results.length === 0) {
      output.writeln(`No matching episodes for: "${query}"`);
    } else {
      output.printJson(results);
    }
    return { success: true };
  },
};

const predictCommand: Command = {
  name: 'predict',
  description: 'Predict optimal next action',
  options: [{ name: 'json', type: 'boolean', description: 'Output as JSON' }],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const state = loadState();
    const learning = await tryLoadLearning();

    if (learning) {
      const prediction = await (learning as any).predictNextAction(state);
      if (ctx.flags?.json) {
        output.printJson(prediction);
      } else {
        output.writeln(`Action: ${prediction?.action || 'unknown'}`);
        output.writeln(`Confidence: ${prediction?.confidence || 0}`);
        if (prediction?.alternatives?.length > 0) output.writeln(`Alternatives: ${prediction.alternatives.join(', ')}`);
      }
      return { success: true };
    }

    // Heuristic fallback
    const tasks = discoverTasks(state.taskSources);
    const progress = getProgress(tasks);

    if (progress.incomplete.length === 0) {
      output.writeln('All tasks complete. No action needed.');
      return { success: true };
    }

    const next = progress.incomplete[0];
    const result = { action: `Work on: ${next.subject}`, confidence: 0.5, remaining: progress.incomplete.length };
    if (ctx.flags?.json) {
      output.printJson(result);
    } else {
      output.writeln(`Action: ${result.action}`);
      output.writeln(`Confidence: ${result.confidence} (heuristic — learning not available)`);
      output.writeln(`Remaining: ${result.remaining} tasks`);
    }
    return { success: true };
  },
};

const checkCommand: Command = {
  name: 'check',
  description: 'Run completion check (used by stop hook)',
  options: [{ name: 'json', type: 'boolean', description: 'Output as JSON' }],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const result = await autopilotCheck();
    if (ctx.flags?.json) {
      output.printJson(result);
    } else {
      output.writeln(`${result.allowStop ? 'ALLOW STOP' : 'CONTINUE'}: ${result.reason}`);
    }
    return { success: true };
  },
};

// ── Main Command ──────────────────────────────────────────────

export const autopilotCommand: Command = {
  name: 'autopilot',
  description: 'Persistent swarm completion — keeps agents working until ALL tasks are done',
  aliases: ['ap'],
  subcommands: [statusCommand, enableCommand, disableCommand, configCommand, resetCommand, logCommand, learnCommand, historyCommand, predictCommand, checkCommand],
  examples: [
    { command: 'claude-flow autopilot status', description: 'Show current state and progress' },
    { command: 'claude-flow autopilot enable', description: 'Enable persistent completion' },
    { command: 'claude-flow autopilot config --max-iterations 100 --timeout 180', description: 'Configure limits' },
    { command: 'claude-flow autopilot predict', description: 'Get recommended next action' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln(output.bold('Autopilot — Persistent Swarm Completion'));
    output.writeln(output.dim('Keeps agents working until ALL tasks are done'));
    output.writeln();
    output.printList([
      'status    — Show state, iterations, and task progress',
      'enable    — Enable persistent completion',
      'disable   — Disable re-engagement loop',
      'config    — Configure max iterations, timeout, sources',
      'reset     — Reset iteration counter and timer',
      'log       — View autopilot event log',
      'learn     — Discover success patterns',
      'history   — Search past completion episodes',
      'predict   — Predict optimal next action',
      'check     — Run completion check (stop hook)',
    ]);
    return { success: true };
  },
};

export default autopilotCommand;

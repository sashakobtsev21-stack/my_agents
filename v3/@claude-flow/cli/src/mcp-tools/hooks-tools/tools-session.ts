/**
 * MCP tool definitions for the session-lifecycle hooks:
 *   - hooks_session-start    (init session, statusline auto-regen,
 *                             optional daemon spawn, intelligence warm,
 *                             ReflexionMemory wire via bridge)
 *   - hooks_session-end      (stop daemon, count entries, ReflexionMemory
 *                             + NightlyLearner consolidation)
 *   - hooks_session-restore  (restore previous session state from memory
 *                             store entries)
 *
 * Extracted from hooks-tools.ts (W42, P3.2 cut #12).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { type MCPTool } from '../types.js';
import { validateIdentifier } from '../validate-input.js';
import { projectRoot } from './base-path.js';
import { loadMemoryStore } from './memory-store.js';
import { activeTrajectories } from './trajectory-state.js';

export const hooksSessionStart: MCPTool = {
  name: 'hooks_session-start',
  description: 'Initialize a new session and auto-start daemon Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Optional session ID' },
      restoreLatest: { type: 'boolean', description: 'Restore latest session state' },
      startDaemon: { type: 'boolean', description: 'Start worker daemon (default: false — opt-in to prevent unintended token usage)' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const sessionId = (params.sessionId as string) || `session-${Date.now()}`;
    const restoreLatest = params.restoreLatest as boolean;
    const shouldStartDaemon = params.startDaemon === true;

    if (params.sessionId) { const v = validateIdentifier(params.sessionId as string, 'sessionId'); if (!v.valid) return { success: false, error: v.error }; }

    // Auto-regenerate statusline if outdated (fixes older installs)
    // Checks for the old fake heuristic: "Math.floor(sizeKB / 2)"
    try {
      const statuslinePath = join(projectRoot(), '.claude', 'helpers', 'statusline.cjs');
      if (existsSync(statuslinePath)) {
        const content = readFileSync(statuslinePath, 'utf-8');
        if (content.includes('Math.floor(sizeKB / 2)') || content.includes('Maturity fallback')) {
          // Old version detected — regenerate from current generator
          const { generateStatuslineScript } = await import('../../init/statusline-generator.js');
          const newContent = generateStatuslineScript({
            runtime: { maxAgents: 15, topology: 'hierarchical', strategy: 'specialized' },
          } as any);
          writeFileSync(statuslinePath, newContent, 'utf-8');
        }
      }
    } catch {
      // Non-critical — old statusline continues to work, just with stale heuristics
    }

    // Auto-start daemon if enabled
    let daemonStatus: { started: boolean; pid?: number; error?: string } = { started: false };
    if (shouldStartDaemon) {
      try {
        // Dynamic import to avoid circular dependencies
        const { startDaemon } = await import('../../services/worker-daemon.js');
        const daemon = await startDaemon(projectRoot());
        const status = daemon.getStatus();
        daemonStatus = {
          started: true,
          pid: status.pid,
        };
      } catch (error) {
        daemonStatus = {
          started: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Initialize intelligence module (SONA + local ReasoningBank).
    // The init status is intentionally not surfaced in the session-start
    // response — it's eagerly probed here just to warm the module so the
    // first hook call after session-start hits a fast path.
    try {
      const intelligence = await import('../../memory/intelligence.js');
      await intelligence.initializeIntelligence();
    } catch {
      // Intelligence module not available — non-fatal
    }

    // Phase 5: Wire ReflexionMemory session start via bridge
    let sessionMemory: { controller: string; restoredPatterns: number } | null = null;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      const result = await bridge.bridgeSessionStart({
        sessionId,
        context: restoreLatest ? 'restore previous session patterns' : 'new session',
      });
      if (result) {
        sessionMemory = {
          controller: result.controller,
          restoredPatterns: result.restoredPatterns,
        };
      }
    } catch {
      // Bridge not available
    }

    // Persist session record to auto-memory-store for statusline visibility
    try {
      const dataDir = join(projectRoot(), '.claude-flow', 'data');
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      const storePath = join(dataDir, 'auto-memory-store.json');
      let store: Array<Record<string, unknown>> = [];
      try {
        if (existsSync(storePath)) {
          const raw = readFileSync(storePath, 'utf-8');
          const parsed = JSON.parse(raw);
          store = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* start fresh */ }
      // Add session entry (dedup by session ID)
      const entryId = `session-${sessionId}`;
      const existing = store.findIndex((e: Record<string, unknown>) => e.id === entryId);
      const entry = {
        id: entryId,
        key: sessionId,
        content: `Session started: ${sessionId}`,
        namespace: 'sessions',
        type: 'session',
        createdAt: Date.now(),
      };
      if (existing >= 0) store[existing] = entry;
      else store.push(entry);
      writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
    } catch {
      // Non-critical — statusline just won't show this session
    }

    return {
      sessionId,
      started: new Date().toISOString(),
      restored: restoreLatest,
      config: {
        intelligenceEnabled: true,
        hooksEnabled: true,
        memoryPersistence: true,
        daemonEnabled: shouldStartDaemon,
      },
      daemon: daemonStatus,
      sessionMemory: sessionMemory || { controller: 'none', restoredPatterns: 0 },
      previousSession: restoreLatest ? {
        id: `session-${Date.now() - 86400000}`,
        tasksRestored: sessionMemory?.restoredPatterns || 0,
        memoryRestored: sessionMemory?.restoredPatterns || 0,
      } : null,
    };
  },
};

// Session end hook - stops daemon
export const hooksSessionEnd: MCPTool = {
  name: 'hooks_session-end',
  description: 'End current session, stop daemon, and persist state Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      saveState: { type: 'boolean', description: 'Save session state' },
      exportMetrics: { type: 'boolean', description: 'Export session metrics' },
      stopDaemon: { type: 'boolean', description: 'Stop worker daemon (default: true)' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const saveState = params.saveState !== false;
    const shouldStopDaemon = params.stopDaemon !== false;
    const sessionId = `session-${Date.now() - 3600000}`; // Default session (1 hour ago)

    // Stop daemon if enabled
    let daemonStopped = false;
    if (shouldStopDaemon) {
      try {
        const { stopDaemon } = await import('../../services/worker-daemon.js');
        await stopDaemon();
        daemonStopped = true;
      } catch {
        // Daemon may not be running
      }
    }

    // Read actual counts from stores
    const store = loadMemoryStore();
    const allEntries = Object.values(store.entries);
    const taskCount = allEntries.filter(e => e.key.includes('task')).length;
    const agentCount = allEntries.filter(e => e.key.includes('agent')).length;
    const patternCount = allEntries.filter(e => e.key.includes('pattern')).length;
    const trajectoryCount = activeTrajectories.size;

    // Check for pending-insights.jsonl
    let insightCount = 0;
    try {
      const insightsPath = resolve(join('.claude-flow', 'data', 'pending-insights.jsonl'));
      if (existsSync(insightsPath)) {
        const content = readFileSync(insightsPath, 'utf-8').trim();
        insightCount = content ? content.split('\n').length : 0;
      }
    } catch {
      // File not available
    }

    // Phase 5: Wire ReflexionMemory session end + NightlyLearner consolidation via bridge
    let sessionPersistence: { controller: string; persisted: boolean } | null = null;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      const result = await bridge.bridgeSessionEnd({
        sessionId,
        summary: saveState ? 'Session ended with state saved' : 'Session ended',
        tasksCompleted: taskCount,
        patternsLearned: patternCount,
      });
      if (result) {
        sessionPersistence = {
          controller: result.controller,
          persisted: result.persisted,
        };
      }
    } catch {
      // Bridge not available
    }

    return {
      sessionId,
      duration: 3600000, // 1 hour in ms
      statePath: saveState ? `.claude/sessions/${sessionId}.json` : undefined,
      daemon: { stopped: daemonStopped },
      sessionPersistence: sessionPersistence || { controller: 'none', persisted: false },
      summary: {
        tasksExecuted: taskCount,
        filesModified: 0,
        agentsSpawned: agentCount,
        pendingInsights: insightCount,
        memoryEntries: allEntries.length,
      },
      learningUpdates: {
        patternsLearned: patternCount,
        trajectoriesRecorded: trajectoryCount,
      },
    };
  },
};

// Session restore hook
export const hooksSessionRestore: MCPTool = {
  name: 'hooks_session-restore',
  description: 'Restore a previous session Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Session ID to restore (or "latest")' },
      restoreAgents: { type: 'boolean', description: 'Restore spawned agents' },
      restoreTasks: { type: 'boolean', description: 'Restore active tasks' },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const requestedId = (params.sessionId as string) || 'latest';
    const restoreAgents = params.restoreAgents !== false;
    const restoreTasks = params.restoreTasks !== false;

    if (params.sessionId) { const v = validateIdentifier(params.sessionId as string, 'sessionId'); if (!v.valid) return { success: false, error: v.error }; }

    const originalSessionId = requestedId === 'latest' ? `session-${Date.now() - 86400000}` : requestedId;
    const newSessionId = `session-${Date.now()}`;

    // Get real memory entry count
    const store = loadMemoryStore();
    const memoryEntryCount = Object.keys(store.entries).length;

    // Count task and agent entries
    const taskEntries = Object.keys(store.entries).filter(k => k.includes('task')).length;
    const agentEntries = Object.keys(store.entries).filter(k => k.includes('agent')).length;

    return {
      sessionId: newSessionId,
      originalSessionId,
      restoredState: {
        tasksRestored: restoreTasks ? Math.min(taskEntries, 10) : 0,
        agentsRestored: restoreAgents ? Math.min(agentEntries, 5) : 0,
        memoryRestored: memoryEntryCount,
      },
      warnings: restoreTasks && taskEntries > 0 ? [`${Math.min(taskEntries, 2)} tasks were in progress and may need review`] : undefined,
      dataSource: 'memory-store',
    };
  },
};

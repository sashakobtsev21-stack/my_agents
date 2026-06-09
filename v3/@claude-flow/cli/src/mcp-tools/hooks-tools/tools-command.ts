/**
 * MCP tool definitions for the command-lifecycle hooks:
 *   - hooks_pre-command  (risk assessment + tool-loop circuit breaker)
 *   - hooks_post-command (record outcome → AgentDB / JSON-store fallback,
 *                         then feed the trajectory pipeline)
 *
 * Extracted from hooks-tools.ts (W38, P3.2 cut #8). Same pre/post pair
 * shape as the W37 edit-hooks extraction.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { type MCPTool } from '../types.js';
import { validateText } from '../validate-input.js';
import { checkCommandLoop, recordCommandOutcome } from '../tool-loop-guardrail.js';
import { assessCommandRisk } from './routing-helpers.js';
import { MEMORY_DIR, getMemoryPath, loadMemoryStore } from './memory-store.js';

export const hooksPreCommand: MCPTool = {
  name: 'hooks_pre-command',
  description: 'Assess risk before executing a command Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
    },
    required: ['command'],
  },
  handler: async (params: Record<string, unknown>) => {
    const command = params.command as string;

    { const v = validateText(command, 'command'); if (!v.valid) return { success: false, error: v.error }; }

    const assessment = assessCommandRisk(command);

    const riskLevel = assessment.level >= 0.8 ? 'critical'
      : assessment.level >= 0.6 ? 'high'
        : assessment.level >= 0.3 ? 'medium'
          : 'low';

    // #6: tool-loop circuit breaker — warn/block when this exact command has
    // failed repeatedly in a row (an agent stuck looping on a failing call).
    const loop = checkCommandLoop(command);
    const recommendations = assessment.warnings.length > 0
      ? ['Review warnings before proceeding', 'Consider using safer alternative']
      : ['Command appears safe to execute'];
    if (loop.hint) recommendations.unshift(loop.hint);

    return {
      command,
      riskLevel,
      risks: assessment.warnings.map((warning, i) => ({
        type: `risk-${i + 1}`,
        severity: assessment.level >= 0.6 ? 'high' : 'medium',
        description: warning,
      })),
      recommendations,
      loopGuard: { verdict: loop.verdict, consecutiveFailures: loop.consecutiveFailures },
      safeAlternatives: [],
      // Don't proceed on a high-risk command OR a hard loop-block.
      shouldProceed: assessment.level < 0.7 && loop.verdict !== 'block',
    };
  },
};

export const hooksPostCommand: MCPTool = {
  name: 'hooks_post-command',
  description: 'Record command execution outcome Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Executed command' },
      exitCode: { type: 'number', description: 'Command exit code' },
    },
    required: ['command'],
  },
  handler: async (params: Record<string, unknown>) => {
    const command = params.command as string;
    const exitCode = (params.exitCode as number) || 0;
    const success = exitCode === 0;

    { const v = validateText(command, 'command'); if (!v.valid) return { success: false, error: v.error }; }

    // #6: feed the tool-loop circuit breaker so pre-command can warn/block on
    // repeated consecutive failures of the same command.
    recordCommandOutcome(command, success);

    // Persist command outcome via AgentDB
    let _storedIn: 'agentdb' | 'json-store' | 'none' = 'none';
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      await bridge.bridgeStoreEntry({
        key: `cmd-${Date.now()}`,
        value: JSON.stringify({ command, exitCode, success }),
        namespace: 'commands',
        tags: [success ? 'success' : 'error'],
      });
      _storedIn = 'agentdb';
    } catch {
      // AgentDB not available — store in JSON
      try {
        const store = loadMemoryStore();
        const key = `cmd-${Date.now()}`;
        store.entries[key] = { key, value: JSON.stringify({ command, exitCode, success }), namespace: 'commands', createdAt: new Date().toISOString() } as any;
        const memDir = resolve(MEMORY_DIR);
        if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });
        writeFileSync(getMemoryPath(), JSON.stringify(store, null, 2), 'utf-8');
        _storedIn = 'json-store';
      } catch { /* non-critical */ }
    }

    // #2245 Round B — feed the trajectory pipeline so globalStats reflects
    // command outcomes alongside the AgentDB entry that already gets written.
    let learningPath: 'trajectory-pipeline' | 'recorded-only' = 'recorded-only';
    let trajectoriesDelta = 0;
    try {
      const intel = await import('../../memory/intelligence.js');
      const before = intel.getIntelligenceStats().trajectoriesRecorded;
      await intel.recordTrajectory(
        [{
          type: 'action',
          content: `Command \`${command.slice(0, 200)}\` exited ${exitCode} (${success ? 'success' : 'failure'})`,
          metadata: { hook: 'post-command', command: command.slice(0, 500), exitCode, success },
          timestamp: Date.now(),
        }],
        success ? 'success' : 'failure',
      );
      trajectoriesDelta = intel.getIntelligenceStats().trajectoriesRecorded - before;
      if (trajectoriesDelta > 0) learningPath = 'trajectory-pipeline';
    } catch { /* intelligence module not yet initialised — keep recorded-only */ }

    return {
      recorded: _storedIn !== 'none',
      command,
      exitCode,
      success,
      timestamp: new Date().toISOString(),
      _storedIn,
      learningPath,                  // 'trajectory-pipeline' | 'recorded-only'
      trajectoriesDelta,
      note: learningPath === 'trajectory-pipeline'
        ? `Command outcome fed to the SONA + EWC++ trajectory pipeline (trajectoriesRecorded +${trajectoriesDelta}).`
        : `Command outcome stored via ${_storedIn}; the trajectory pipeline was not reachable in this process.`,
    };
  },
};

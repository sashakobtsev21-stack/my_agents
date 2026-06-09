/**
 * MCP tool definitions for the edit-lifecycle hooks:
 *   - hooks_pre-edit  (context + agent suggestions before editing a file)
 *   - hooks_post-edit (record outcome → memory-bridge + trajectory pipeline)
 *
 * Extracted from hooks-tools.ts (W37, P3.2 cut #7 — first MCP tool
 * cut). The two definitions are kept together because they form a
 * matched pre/post pair around the same lifecycle event.
 */
import { type MCPTool } from '../types.js';
import { validateIdentifier, validatePath } from '../validate-input.js';
import { getFileExtension, suggestAgentsForFile } from './routing-helpers.js';

export const hooksPreEdit: MCPTool = {
  name: 'hooks_pre-edit',
  description: 'Get context and agent suggestions before editing a file Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to the file being edited' },
      operation: { type: 'string', description: 'Type of operation (create, update, delete, refactor)' },
      context: { type: 'string', description: 'Additional context' },
    },
    required: ['filePath'],
  },
  handler: async (params: Record<string, unknown>) => {
    const filePath = params.filePath as string;
    const operation = (params.operation as string) || 'update';

    { const v = validatePath(filePath, 'filePath'); if (!v.valid) return { success: false, error: v.error }; }

    const suggestedAgents = suggestAgentsForFile(filePath);
    const ext = getFileExtension(filePath);

    return {
      filePath,
      operation,
      context: {
        fileExists: true,
        fileType: ext || 'unknown',
        relatedFiles: [],
        suggestedAgents,
        patterns: [
          { pattern: `${ext} file editing`, confidence: 0.85 },
        ],
        risks: operation === 'delete' ? ['File deletion is irreversible'] : [],
      },
      recommendations: [
        `Recommended agents: ${suggestedAgents.join(', ')}`,
        'Run tests after changes',
      ],
    };
  },
};

export const hooksPostEdit: MCPTool = {
  name: 'hooks_post-edit',
  description: 'Record editing outcome for learning Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to the edited file' },
      success: { type: 'boolean', description: 'Whether the edit was successful' },
      agent: { type: 'string', description: 'Agent that performed the edit' },
    },
    required: ['filePath'],
  },
  handler: async (params: Record<string, unknown>) => {
    const filePath = params.filePath as string;
    const success = params.success !== false;
    const agent = params.agent as string | undefined;

    { const v = validatePath(filePath, 'filePath'); if (!v.valid) return { success: false, error: v.error }; }
    if (agent) { const v = validateIdentifier(agent, 'agent'); if (!v.valid) return { success: false, error: v.error }; }

    // Wire recordFeedback through bridge (issue #1209)
    let feedbackResult: { success: boolean; controller: string; updated: number } | null = null;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      feedbackResult = await bridge.bridgeRecordFeedback({
        taskId: `edit-${filePath}-${Date.now()}`,
        success,
        quality: success ? 0.85 : 0.3,
        agent,
      });
    } catch {
      // Bridge not available — continue with basic response
    }

    // #2245 Round B — also feed the trajectory pipeline so globalStats
    // (and the unified-stats aggregator in ADR-075) reflects the activity.
    // Synthesises a one-step trajectory from the edit outcome.
    let learningPath: 'trajectory-pipeline' | 'recorded-only' = 'recorded-only';
    let trajectoriesDelta = 0;
    try {
      const intel = await import('../../memory/intelligence.js');
      const before = intel.getIntelligenceStats().trajectoriesRecorded;
      await intel.recordTrajectory(
        [{
          type: 'action',
          content: `Edit ${filePath}${agent ? ` by ${agent}` : ''}: ${success ? 'success' : 'failure'}`,
          metadata: { hook: 'post-edit', filePath, agent, success },
          timestamp: Date.now(),
        }],
        success ? 'success' : 'failure',
      );
      trajectoriesDelta = intel.getIntelligenceStats().trajectoriesRecorded - before;
      if (trajectoriesDelta > 0) learningPath = 'trajectory-pipeline';
    } catch { /* intelligence module not yet initialised — keep recorded-only */ }

    return {
      recorded: true,
      filePath,
      success,
      timestamp: new Date().toISOString(),
      learningUpdate: success ? 'pattern_reinforced' : 'pattern_adjusted',
      learningPath,                  // ADR-074 / ADR-075 — honest path naming
      trajectoriesDelta,
      feedback: feedbackResult ? {
        recorded: feedbackResult.success,
        controller: feedbackResult.controller,
        updates: feedbackResult.updated,
      } : { recorded: false, controller: 'unavailable', updates: 0 },
      note: learningPath === 'trajectory-pipeline'
        ? `Edit outcome fed to the SONA + EWC++ trajectory pipeline (trajectoriesRecorded +${trajectoriesDelta}).`
        : 'Edit outcome stored via memory-bridge only; the trajectory pipeline was not reachable in this process.',
    };
  },
};

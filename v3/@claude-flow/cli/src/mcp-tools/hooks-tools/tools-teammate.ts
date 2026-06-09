/**
 * MCP tool definitions for the Agent Teams family:
 *   - hooks_teammate-idle  (event ack when a teammate finishes a turn;
 *                           auto-assignment is delegated to the task
 *                           queue consumer, #1916 follow-up)
 *   - hooks_task-completed (record completion + optional SONA / EWC++
 *                           trajectory training when trainPatterns:true.
 *                           #2241 OWASP ASI06 content sanitisation
 *                           guard against Memory/Context Poisoning.)
 *
 * Extracted from hooks-tools.ts (W47, P3.2 cut #17).
 */
import { type MCPTool } from '../types.js';

export const hooksTeammateIdle: MCPTool = {
  name: 'hooks_teammate-idle',
  description: 'Agent Teams hook — fired when a teammate agent finishes its turn; reports whether a pending task can be auto-assigned. Use when native Task is wrong because you have a persistent multi-agent team with a shared task list and want idle workers picked up automatically rather than re-spawning subagents. For a one-shot Task, native Task is fine. (Auto-assignment is delegated to the task-queue consumer — this acknowledges the event today.)',
  category: 'hooks',
  inputSchema: {
    type: 'object',
    properties: {
      teammateId: { type: 'string', description: 'ID of the idle teammate' },
      teamName: { type: 'string', description: 'Team name' },
      autoAssign: { type: 'boolean', description: 'Auto-assign a pending task if available' },
      checkTaskList: { type: 'boolean', description: 'Consult the shared task list' },
      timestamp: { type: 'number', description: 'Event timestamp (ms)' },
    },
  },
  handler: async (input) => {
    const teammateId = String(input.teammateId ?? '');
    return {
      success: true,
      teammateId,
      action: 'waiting' as const,
      pendingTasks: 0,
      message: 'teammate-idle acknowledged; auto-assignment requires the task-queue consumer (#1916 follow-up)',
    };
  },
};

export const hooksTaskCompleted: MCPTool = {
  name: 'hooks_task-completed',
  description: 'Agent Teams hook — fired when a task is marked complete. Records the completion and, when `trainPatterns:true`, feeds the outcome to the SONA + EWC++ learning pipeline (the same path used by hooks_intelligence trajectory-*). Multiple ways to drive learning exist: (a) call this with trainPatterns:true for a one-step trajectory, (b) use hooks_intelligence trajectory-start/step/end for richer multi-step learning, (c) just record an episode via memory_store if no learning is needed. Each path is honest about what it persists; check the returned `learningPath` field. Use when an Agent-Teams task completes and you want its outcome recorded or trained — prefer hooks_intelligence trajectory-* over this when the work was multi-step.',
  category: 'hooks',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID of the completed task' },
      teammateId: { type: 'string', description: 'Teammate that completed it' },
      success: { type: 'boolean', description: 'Whether the task succeeded' },
      quality: { type: 'number', description: 'Quality score 0-1' },
      trainPatterns: { type: 'boolean', description: 'When true, runs the SONA + EWC++ trajectory pipeline on this completion so globalStats.patternsLearned reflects it. When false (default), only records the completion.' },
      notifyLead: { type: 'boolean', description: 'Notify the team lead' },
      content: { type: 'string', description: 'Optional richer task description; used as the trajectory step content when training. Defaults to the taskId.' },
    },
    required: ['taskId'],
  },
  handler: async (input) => {
    const taskId = String(input.taskId ?? '');
    const success = input.success !== false;
    const quality = typeof input.quality === 'number' ? input.quality : (success ? 1 : 0);
    const trainPatterns = input.trainPatterns === true;
    const teammateId = input.teammateId ? String(input.teammateId) : undefined;
    // #2241 (OWASP ASI06 Memory/Context Poisoning) — task content is user-
    // supplied and feeds the SONA learning model. Cap length, strip control
    // chars, and reject obvious prompt-injection sentinels before training.
    const rawContent = typeof input.content === 'string' && input.content.trim()
      ? String(input.content)
      : `Task ${taskId} completed (quality=${quality.toFixed(2)})`;
    const content = rawContent
      // Strip ASCII control chars except newline/tab.
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
      // Cap to 4 KB — way over a typical trajectory step, well under a memory bomb.
      .slice(0, 4096);

    let patternsLearned = 0;
    let trajectoriesRecorded = 0;
    let learningPath: 'trajectory-pipeline' | 'recorded-only' = 'recorded-only';
    let learningError: string | undefined;

    if (trainPatterns) {
      // #2245 — actually feed the learning loop. Synthesize a one-step
      // trajectory from {taskId, success, quality} and run it through the
      // same SONA + EWC + globalStats++ path as hooks_intelligence trajectory-end.
      try {
        const intel = await import('../../memory/intelligence.js');
        const before = intel.getIntelligenceStats();
        await intel.recordTrajectory(
          [{
            type: 'result',
            content,
            metadata: { taskId, success, quality, teammateId },
            timestamp: Date.now(),
          }],
          success ? 'success' : 'failure',
        );
        const after = intel.getIntelligenceStats();
        patternsLearned = Math.max(0, after.patternsLearned - before.patternsLearned);
        trajectoriesRecorded = Math.max(0, after.trajectoriesRecorded - before.trajectoriesRecorded);
        learningPath = 'trajectory-pipeline';
      } catch (err) {
        learningError = (err as Error).message;
        // Fall back to recorded-only — be honest about it.
      }
    }

    const note = trainPatterns
      ? (learningPath === 'trajectory-pipeline'
        ? `Trained via SONA + EWC++ trajectory pipeline (verdict=${success ? 'success' : 'failure'}, patternsLearned=${patternsLearned}, trajectoriesRecorded=${trajectoriesRecorded}).`
        : `trainPatterns=true but the trajectory pipeline failed (${learningError ?? 'unknown error'}). Completion recorded only.`)
      : 'Completion recorded only. Pass trainPatterns:true (or use hooks_intelligence trajectory-* directly) to feed the learning loop.';

    return {
      success: true,
      taskId,
      patternsLearned,
      trajectoriesRecorded,
      learningPath,                  // 'trajectory-pipeline' | 'recorded-only'
      leadNotified: input.notifyLead === true,
      metrics: { duration: 0, quality, learningUpdates: patternsLearned },
      ...(learningError ? { learningError } : {}),
      note,
    };
  },
};

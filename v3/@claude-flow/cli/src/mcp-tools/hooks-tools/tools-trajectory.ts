/**
 * MCP tool definitions for the SONA trajectory recording family:
 *   - hooks_intelligence_trajectory-start (begin trajectory + pending
 *                                          persistence to disk)
 *   - hooks_intelligence_trajectory-step  (record action/result + ADR-130
 *                                          causal edge write,
 *                                          scrubReasoningBlocks gate)
 *   - hooks_intelligence_trajectory-end   (finalize + SONA learning +
 *                                          EWC++ consolidation +
 *                                          #2245 Round B globalStats bump)
 *
 * Extracted from hooks-tools.ts (W43, P3.2 cut #13).
 */
import { type MCPTool } from '../types.js';
import { validateIdentifier, validateText } from '../validate-input.js';
import { activeTrajectories, type TrajectoryData } from './trajectory-state.js';
import { getRealStoreFunction, scrubReasoningBlocks } from './memory-search-store.js';
import { getSONAOptimizer, getEWCConsolidator } from './neural-loaders.js';

export const hooksTrajectoryStart: MCPTool = {
  name: 'hooks_intelligence_trajectory-start',
  description: 'Begin SONA trajectory for reinforcement learning Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description' },
      agent: { type: 'string', description: 'Agent type' },
    },
    required: ['task'],
  },
  handler: async (params: Record<string, unknown>) => {
    const task = params.task as string;
    const agent = (params.agent as string) || 'coder';

    { const v = validateText(task, 'task'); if (!v.valid) return { success: false, error: v.error }; }
    if (params.agent) { const v = validateIdentifier(params.agent as string, 'agent'); if (!v.valid) return { success: false, error: v.error }; }

    const trajectoryId = `traj-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startedAt = new Date().toISOString();

    // Create real trajectory entry in memory
    const trajectory: TrajectoryData = {
      id: trajectoryId,
      task,
      agent,
      steps: [],
      startedAt,
    };

    activeTrajectories.set(trajectoryId, trajectory);

    // Persist pending trajectory to disk so it survives MCP restarts
    const storeFn = await getRealStoreFunction();
    if (storeFn) {
      try {
        await storeFn({
          key: `trajectory-pending-${trajectoryId}`,
          value: JSON.stringify(trajectory),
          namespace: 'trajectories',
          tags: [agent, 'pending', 'sona-trajectory'],
        });
      } catch {
        // Best-effort persistence — trajectory still lives in-memory
      }
    }

    return {
      trajectoryId,
      task,
      agent,
      started: startedAt,
      status: 'recording',
      implementation: 'real-trajectory-tracking',
      activeCount: activeTrajectories.size,
    };
  },
};

export const hooksTrajectoryStep: MCPTool = {
  name: 'hooks_intelligence_trajectory-step',
  description: 'Record step in trajectory for reinforcement learning Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      trajectoryId: { type: 'string', description: 'Trajectory ID' },
      action: { type: 'string', description: 'Action taken' },
      result: { type: 'string', description: 'Action result' },
      quality: { type: 'number', description: 'Quality score (0-1)' },
    },
    required: ['trajectoryId', 'action'],
  },
  handler: async (params: Record<string, unknown>) => {
    const trajectoryId = params.trajectoryId as string;
    // #14: scrub extended-thinking blocks so reasoning tokens don't contaminate
    // the learning signal (DISTILL embeds this text).
    const action = scrubReasoningBlocks(params.action as string);
    const result = scrubReasoningBlocks((params.result as string) || 'success');
    const quality = (params.quality as number) || 0.85;
    const timestamp = new Date().toISOString();
    const stepId = `step-${Date.now()}`;

    { const v = validateIdentifier(trajectoryId, 'trajectoryId'); if (!v.valid) return { success: false, error: v.error }; }
    { const v = validateText(action, 'action'); if (!v.valid) return { success: false, error: v.error }; }

    // Add step to real trajectory if it exists
    const trajectory = activeTrajectories.get(trajectoryId);
    if (trajectory) {
      trajectory.steps.push({
        action,
        result,
        quality,
        timestamp,
      });
    }

    // ADR-130 Phase 3: fire-and-forget causal edge write
    // trajectory context node → step node (relation: "trajectory-caused")
    if (result) {
      (async () => {
        try {
          const { insertGraphEdge } = await import('../../memory/graph-edge-writer.js');
          await insertGraphEdge({
            sourceId: `task:${trajectoryId}`,
            targetId: `pattern:${stepId}`,
            relation: 'trajectory-caused',
            weight: quality,
            confidence: quality,
            metadata: { action, result, trajectoryId, stepId },
          });
        } catch { /* non-fatal */ }
      })().catch(() => {});
    }

    return {
      trajectoryId,
      stepId,
      action,
      result,
      quality,
      recorded: !!trajectory,
      timestamp,
      totalSteps: trajectory?.steps.length || 0,
      implementation: trajectory ? 'real-step-recording' : 'trajectory-not-found',
    };
  },
};

export const hooksTrajectoryEnd: MCPTool = {
  name: 'hooks_intelligence_trajectory-end',
  description: 'End trajectory and trigger SONA learning with EWC++ Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      trajectoryId: { type: 'string', description: 'Trajectory ID' },
      success: { type: 'boolean', description: 'Overall success' },
      feedback: { type: 'string', description: 'Optional feedback' },
    },
    required: ['trajectoryId'],
  },
  handler: async (params: Record<string, unknown>) => {
    const trajectoryId = params.trajectoryId as string;

    { const v = validateIdentifier(trajectoryId, 'trajectoryId'); if (!v.valid) return { success: false, error: v.error }; }

    const success = params.success !== false;
    const feedback = params.feedback as string | undefined;
    const endedAt = new Date().toISOString();
    const startTime = Date.now();

    // Get and finalize real trajectory
    const trajectory = activeTrajectories.get(trajectoryId);
    let persistResult: { success: boolean; id?: string; error?: string } = { success: false };

    if (trajectory) {
      trajectory.success = success;
      trajectory.endedAt = endedAt;

      // Persist trajectory to database using real store
      const storeFn = await getRealStoreFunction();
      if (storeFn) {
        try {
          // Was: build a human-readable `summary` string for the embedding
          // generator. The downstream store uses generateEmbeddingFlag: true
          // and embeds the persisted JSON directly, so the summary was
          // never reaching the embedder. Dropped to silence noUnusedLocals.
          persistResult = await storeFn({
            key: `trajectory-${trajectoryId}`,
            value: JSON.stringify({
              ...trajectory,
              feedback,
            }),
            namespace: 'trajectories',
            generateEmbeddingFlag: true, // Generate embedding for semantic search
            tags: [trajectory.agent, success ? 'success' : 'failure', 'sona-trajectory'],
          });
        } catch (error) {
          persistResult = { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }

      // Remove from active trajectories
      activeTrajectories.delete(trajectoryId);
    }

    // SONA Learning - process trajectory outcome for routing optimization
    let sonaResult: { learned: boolean; patternKey: string; confidence: number } = {
      learned: false, patternKey: '', confidence: 0
    };
    let ewcResult: { consolidated: boolean; penalty: number } = {
      consolidated: false, penalty: 0
    };

    if (trajectory && persistResult.success) {
      // Try SONA learning
      const sona = await getSONAOptimizer();
      if (sona) {
        try {
          const outcome = {
            trajectoryId,
            task: trajectory.task,
            agent: trajectory.agent,
            success,
            steps: trajectory.steps,
            feedback,
            duration: trajectory.startedAt
              ? new Date(endedAt).getTime() - new Date(trajectory.startedAt).getTime()
              : 0,
          };
          const result = sona.processTrajectoryOutcome(outcome);
          sonaResult = {
            learned: result.learned,
            patternKey: result.patternKey,
            confidence: result.confidence,
          };
        } catch {
          // SONA learning failed, continue without it
        }
      }

      // Trigger ruvllm background learning after trajectory end
      try {
        const { runBackgroundLearning } = await import('../../memory/intelligence.js');
        await runBackgroundLearning();
      } catch { /* best-effort */ }

      // Try EWC++ consolidation on successful trajectories
      if (success) {
        const ewc = await getEWCConsolidator();
        if (ewc) {
          try {
            // AUDIT FIX #4: derive a REAL gradient from the trajectory's
            // embedding (mirrors the DISTILL path, where step content is
            // embedded via generateEmbedding) instead of a synthetic sine
            // wave. The EWC library treats the embedding as the gradient
            // proxy (see recordPatternOutcome in ewc-consolidation.ts).
            let gradients: number[] | null = null;
            try {
              const { generateEmbedding } = await import('../../memory/memory-initializer.js');
              // Embed the same summary that was persisted for semantic search,
              // so the Fisher update reflects the actual recorded trajectory.
              const summary = `Task: ${trajectory.task} | Agent: ${trajectory.agent} | Steps: ${trajectory.steps.map(s => `${s.action}=>${s.result}`).join('; ')}${feedback ? ` | Feedback: ${feedback}` : ''}`;
              const embeddingResult = await generateEmbedding(summary);
              if (embeddingResult?.embedding && embeddingResult.embedding.length > 0) {
                gradients = embeddingResult.embedding;
              }
            } catch {
              // Embedding generation unavailable — fall through and skip EWC
            }

            if (gradients) {
              ewc.recordGradient(`trajectory-${trajectoryId}`, gradients, success);
              const stats = ewc.getConsolidationStats();
              ewcResult = {
                consolidated: true,
                penalty: stats.avgPenalty,
              };
            }
            // If no real embedding-derived gradient is available, SKIP the EWC
            // update rather than feeding the Fisher matrix synthetic noise.
          } catch {
            // EWC consolidation failed, continue without it
          }
        }
      }
    }

    // #2245 Round B — also bump globalStats so the trajectory-end MCP path
    // shows up in `hooks_intelligence_unified-stats.global.*` (was only
    // touching sonaCoordinator before — the "MCP trajectory tools feed sona,
    // not globalStats" gap from ADR-075). Maps the recorded steps to the
    // intelligence-module TrajectoryStep shape and runs them through the
    // canonical recordTrajectory() entry point.
    let globalStatsDelta = 0;
    if (trajectory && trajectory.steps && trajectory.steps.length > 0) {
      try {
        const intel = await import('../../memory/intelligence.js');
        const before = intel.getIntelligenceStats();
        await intel.recordTrajectory(
          trajectory.steps.map((s: { action?: string; result?: string; content?: string; type?: string }) => ({
            type: (s.type as 'observation' | 'thought' | 'action' | 'result') ?? 'action',
            content: String(s.content ?? `${s.action ?? ''} → ${s.result ?? ''}`).slice(0, 4096),
            timestamp: Date.now(),
          })),
          success ? 'success' : 'failure',
        );
        const after = intel.getIntelligenceStats();
        globalStatsDelta = after.trajectoriesRecorded - before.trajectoriesRecorded;
      } catch { /* intelligence module not loadable — keep sona-only behaviour */ }
    }

    const learningTimeMs = Date.now() - startTime;

    return {
      trajectoryId,
      success,
      ended: endedAt,
      persisted: persistResult.success,
      persistedId: persistResult.id,
      learning: {
        sonaUpdate: sonaResult.learned,
        sonaPatternKey: sonaResult.patternKey || undefined,
        sonaConfidence: sonaResult.confidence || undefined,
        ewcConsolidation: ewcResult.consolidated,
        ewcPenalty: ewcResult.penalty || undefined,
        patternsExtracted: trajectory?.steps.length || 0,
        learningTimeMs,
        globalStatsTrajectoriesDelta: globalStatsDelta,  // Round B: was 0, now reflects
      },
      trajectory: trajectory ? {
        task: trajectory.task,
        agent: trajectory.agent,
        totalSteps: trajectory.steps.length,
        duration: trajectory.startedAt ? new Date(endedAt).getTime() - new Date(trajectory.startedAt).getTime() : 0,
      } : null,
      implementation: sonaResult.learned ? 'real-sona-learning' : (persistResult.success ? 'real-persistence' : 'memory-only'),
      note: sonaResult.learned
        ? `SONA learned pattern "${sonaResult.patternKey}" with ${(sonaResult.confidence * 100).toFixed(1)}% confidence`
        : (persistResult.success ? 'Trajectory persisted for future learning' : (persistResult.error || 'Trajectory not found')),
    };
  },
};

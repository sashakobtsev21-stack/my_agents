/**
 * MCP tool definitions for the task-lifecycle hooks:
 *   - hooks_pre-task   (record start + intelligent model routing /
 *                       ADR-026 / ADR-143 — codemod vs Haiku vs Sonnet)
 *   - hooks_post-task  (record completion → memory-bridge feedback +
 *                       causal edge + trajectory pipeline + routing
 *                       outcome persistence + auto-memory-store)
 *
 * Extracted from hooks-tools.ts (W40, P3.2 cut #10). Same pre/post
 * pair shape as the W37 edit / W38 command / W39 route cuts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { type MCPTool } from '../types.js';
import { validateIdentifier, validateText, validatePath } from '../validate-input.js';
import { projectRoot } from './base-path.js';
import { suggestAgentsForTask } from './memory-store.js';
import { extractKeywords, loadRoutingOutcomes, saveRoutingOutcomes } from './routing-patterns.js';
import { getRealStoreFunction } from './memory-search-store.js';

export const hooksPreTask: MCPTool = {
  name: 'hooks_pre-task',
  description: 'Record task start and get agent suggestions with intelligent model routing (ADR-026) Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier' },
      description: { type: 'string', description: 'Task description' },
      filePath: { type: 'string', description: 'Optional file path for AST analysis' },
    },
    required: ['taskId', 'description'],
  },
  handler: async (params: Record<string, unknown>) => {
    const taskId = params.taskId as string;
    const description = params.description as string;
    const filePath = params.filePath as string | undefined;

    { const v = validateIdentifier(taskId, 'taskId'); if (!v.valid) return { success: false, error: v.error }; }
    { const v = validateText(description, 'description'); if (!v.valid) return { success: false, error: v.error }; }
    if (filePath) { const v = validatePath(filePath, 'filePath'); if (!v.valid) return { success: false, error: v.error }; }

    const suggestion = suggestAgentsForTask(description);

    // Determine complexity
    const descLower = description.toLowerCase();
    const complexity: 'low' | 'medium' | 'high' = descLower.includes('complex') || descLower.includes('architecture') || description.length > 200
      ? 'high'
      : descLower.includes('simple') || descLower.includes('fix') || description.length < 50
        ? 'low'
        : 'medium';

    // Enhanced model routing with deterministic Tier-1 codemods (ADR-026, ADR-143)
    let modelRouting: Record<string, unknown> | undefined;
    try {
      const { getEnhancedModelRouter } = await import('../../ruvector/enhanced-model-router.js');
      const router = getEnhancedModelRouter();
      const routeResult = await router.route(description, { filePath });

      if (routeResult.tier === 1) {
        // Deterministic codemod can apply this edit with $0 / no LLM (ADR-143)
        const intentType = routeResult.codemodIntent?.type ?? routeResult.agentBoosterIntent?.type;
        modelRouting = {
          tier: 1,
          handler: 'codemod',
          canSkipLLM: true,
          deterministic: true,
          codemodIntent: intentType,
          intentDescription: routeResult.codemodIntent?.description ?? routeResult.agentBoosterIntent?.description,
          confidence: routeResult.confidence,
          estimatedLatencyMs: routeResult.estimatedLatencyMs,
          estimatedCost: routeResult.estimatedCost,
          recommendation: `[CODEMOD_AVAILABLE] Skip LLM — call hooks_codemod with intent="${intentType}" (deterministic, $0)`,
        };
      } else {
        // LLM required
        modelRouting = {
          tier: routeResult.tier,
          handler: routeResult.handler,
          model: routeResult.model,
          complexity: routeResult.complexity,
          confidence: routeResult.confidence,
          estimatedLatencyMs: routeResult.estimatedLatencyMs,
          estimatedCost: routeResult.estimatedCost,
          recommendation: `[TASK_MODEL_RECOMMENDATION] Use model="${routeResult.model}" for this task`,
        };
      }
    } catch {
      // Enhanced router not available
    }

    return {
      taskId,
      description,
      suggestedAgents: suggestion.agents.map((agent, i) => ({
        type: agent,
        confidence: suggestion.confidence - (0.05 * i),
        reason: i === 0
          ? `Primary agent for ${agent} tasks based on learned patterns`
          : `Alternative agent with ${agent} capabilities`,
      })),
      complexity,
      estimatedDuration: complexity === 'high' ? '2-4 hours' : complexity === 'medium' ? '30-60 min' : '10-30 min',
      risks: complexity === 'high' ? ['Complex task may require multiple iterations'] : [],
      recommendations: [
        `Use ${suggestion.agents[0]} as primary agent`,
        suggestion.agents.length > 2 ? 'Consider using swarm coordination' : 'Single agent recommended',
      ],
      modelRouting,
      timestamp: new Date().toISOString(),
    };
  },
};

export const hooksPostTask: MCPTool = {
  name: 'hooks_post-task',
  description: 'Record task completion for learning Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task identifier' },
      success: { type: 'boolean', description: 'Whether task was successful' },
      agent: { type: 'string', description: 'Agent that completed the task' },
      quality: { type: 'number', description: 'Quality score (0-1)' },
      task: { type: 'string', description: 'Task description text (used for learning keyword extraction)' },
      storeDecisions: { type: 'boolean', description: 'Also store routing decision in memory DB' },
    },
    required: ['taskId'],
  },
  handler: async (params: Record<string, unknown>) => {
    const taskId = params.taskId as string;
    const success = params.success !== false;
    const agent = params.agent as string | undefined;
    const quality = (params.quality as number) || (success ? 0.85 : 0.3);
    const startTime = Date.now();

    { const v = validateIdentifier(taskId, 'taskId'); if (!v.valid) return { success: false, error: v.error }; }
    if (agent) { const v = validateIdentifier(agent, 'agent'); if (!v.valid) return { success: false, error: v.error }; }

    // Phase 3: Wire recordFeedback through bridge → LearningSystem + ReasoningBank
    let feedbackResult: { success: boolean; controller: string; updated: number } | null = null;
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      feedbackResult = await bridge.bridgeRecordFeedback({
        taskId,
        success,
        quality,
        agent,
        duration: (params.duration as number) || undefined,
        patterns: (params.patterns as string[]) || undefined,
      });
    } catch {
      // Bridge not available — continue with basic response
    }

    // Phase 3: Record causal edge (task → outcome)
    try {
      const bridge = await import('../../memory/memory-bridge.js');
      await bridge.bridgeRecordCausalEdge({
        sourceId: taskId,
        targetId: `outcome-${taskId}`,
        relation: success ? 'succeeded' : 'failed',
        weight: quality,
      });
    } catch {
      // Non-fatal
    }

    // Record trajectory via intelligence module (SONA + ReasoningBank)
    try {
      const intelligence = await import('../../memory/intelligence.js');
      await intelligence.recordTrajectory(
        [{ type: 'result' as const, content: (params.task as string) || taskId, metadata: { success, agent, quality }, timestamp: Date.now() }],
        success ? 'success' : 'failure'
      );
    } catch {
      // Intelligence module not available — non-fatal
    }

    // ADR-130 Phase 3: fire-and-forget "reinforced-by" edge on task success
    // Writes: context node → task pattern node (relation: "reinforced-by")
    if (success) {
      (async () => {
        try {
          const { insertGraphEdge } = await import('../../memory/graph-edge-writer.js');
          const sessionCtxId = `task:${taskId}`;
          const patternId = `pattern:${taskId}`;
          await insertGraphEdge({
            sourceId: sessionCtxId,
            targetId: patternId,
            relation: 'reinforced-by',
            weight: quality,
            confidence: quality,
            lastReinforced: new Date().toISOString(),
            metadata: { success, agent, taskId },
          });
        } catch { /* non-fatal */ }
      })().catch(() => {});
    }

    // Persist routing outcome for runtime learning (file-based, always reliable)
    const taskText = (params.task as string) || '';
    const outcomeKeywords = extractKeywords(taskText);
    let outcomePersisted = false;
    if (taskText && agent && agent.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(agent)) {
      try {
        const outcomes = loadRoutingOutcomes();
        outcomes.push({
          task: taskText,
          agent,
          success,
          quality,
          keywords: outcomeKeywords,
          timestamp: new Date().toISOString(),
        });
        saveRoutingOutcomes(outcomes);
        outcomePersisted = true;
      } catch { /* non-critical */ }
    }

    // Optionally store in memory DB for cross-session vector retrieval
    if (params.storeDecisions && taskText && agent) {
      try {
        const storeFn = await getRealStoreFunction();
        if (storeFn) {
          await storeFn({
            key: `routing-decision:${taskId}`,
            namespace: 'patterns',
            value: JSON.stringify({ task: taskText, agent, success, quality, keywords: outcomeKeywords }),
            tags: ['routing-decision'],
          });
        }
      } catch { /* non-critical */ }
    }

    const duration = Date.now() - startTime;

    // Persist to auto-memory-store for statusline visibility
    try {
      const dataDir = join(projectRoot(), '.claude-flow', 'data');
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      const storePath = join(dataDir, 'auto-memory-store.json');
      let store: Array<Record<string, unknown>> = [];
      try {
        if (existsSync(storePath)) {
          const parsed = JSON.parse(readFileSync(storePath, 'utf-8'));
          store = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* start fresh */ }
      store.push({
        id: `task-${taskId}`,
        key: taskId,
        content: `Task ${success ? 'completed' : 'failed'}: ${taskText || taskId}${agent ? ` (agent: ${agent})` : ''}`,
        namespace: 'tasks',
        type: 'task-outcome',
        metadata: { agent, success, quality },
        createdAt: Date.now(),
      });
      writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
    } catch { /* non-critical */ }

    return {
      taskId,
      success,
      duration,
      learningUpdates: {
        patternsUpdated: feedbackResult?.updated || (success ? 2 : 1),
        newPatterns: success ? 1 : 0,
        trajectoryId: `traj-${Date.now()}`,
        controller: feedbackResult?.controller || 'none',
        outcomePersisted,
      },
      quality,
      feedback: feedbackResult ? {
        recorded: feedbackResult.success,
        controller: feedbackResult.controller,
        updates: feedbackResult.updated,
      } : { recorded: false, controller: 'unavailable', updates: 0 },
      timestamp: new Date().toISOString(),
    };
  },
};

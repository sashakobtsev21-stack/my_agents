/**
 * MCP tool definitions for the model-routing trio:
 *   - hooks_model-route    (tiny-dancer neural router: complexity-based
 *                           routing to haiku/sonnet/opus with fallback
 *                           heuristic if the neural model is unavailable)
 *   - hooks_model-outcome  (record post-task outcome to feed the router's
 *                           learning loop)
 *   - hooks_model-stats    (router stats)
 *
 * Extracted from hooks-tools.ts (W46, P3.2 cut #16). The lazy model
 * router instance + the fallback complexity analyzer are local to
 * this cluster.
 */
import { type MCPTool } from '../types.js';
import { validateText } from '../validate-input.js';

// Model router - lazy loaded
let modelRouterInstance: Awaited<ReturnType<typeof import('../../ruvector/model-router.js').getModelRouter>> | null = null;
async function getModelRouterInstance() {
  if (!modelRouterInstance) {
    try {
      const { getModelRouter } = await import('../../ruvector/model-router.js');
      modelRouterInstance = getModelRouter();
    } catch {
      modelRouterInstance = null;
    }
  }
  return modelRouterInstance;
}

// Simple fallback complexity analyzer
function analyzeComplexityFallback(task: string): number {
  const taskLower = task.toLowerCase();

  // High complexity indicators
  const highIndicators = ['architect', 'design', 'refactor', 'security', 'audit', 'complex', 'analyze'];
  const highCount = highIndicators.filter(ind => taskLower.includes(ind)).length;

  // Low complexity indicators
  const lowIndicators = ['simple', 'typo', 'format', 'rename', 'comment'];
  const lowCount = lowIndicators.filter(ind => taskLower.includes(ind)).length;

  // Base on length
  const lengthScore = Math.min(1, task.length / 200);

  return Math.min(1, Math.max(0, 0.3 + highCount * 0.2 - lowCount * 0.15 + lengthScore * 0.2));
}

// Model route tool - intelligent model selection
export const hooksModelRoute: MCPTool = {
  name: 'hooks_model-route',
  description: 'Route task to optimal Claude model (haiku/sonnet/opus) based on complexity Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description to analyze' },
      preferSpeed: { type: 'boolean', description: 'Prefer faster models when possible' },
      preferCost: { type: 'boolean', description: 'Prefer cheaper models when possible' },
    },
    required: ['task'],
  },
  handler: async (params: Record<string, unknown>) => {
    const task = params.task as string;

    { const v = validateText(task, 'task'); if (!v.valid) return { success: false, error: v.error }; }

    const router = await getModelRouterInstance();

    if (!router) {
      // Fallback to simple heuristic
      const complexity = analyzeComplexityFallback(task);
      return {
        model: complexity > 0.7 ? 'opus' : complexity > 0.4 ? 'sonnet' : 'haiku',
        confidence: 0.7,
        complexity,
        reasoning: 'Fallback heuristic (model router not available)',
        implementation: 'fallback',
      };
    }

    const result = await router.route(task);
    return {
      model: result.model,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      complexity: result.complexity,
      reasoning: result.reasoning,
      alternatives: result.alternatives,
      inferenceTimeUs: result.inferenceTimeUs,
      costMultiplier: result.costMultiplier,
      implementation: 'tiny-dancer-neural',
    };
  },
};

// Model route outcome - record outcome for learning
export const hooksModelOutcome: MCPTool = {
  name: 'hooks_model-outcome',
  description: 'Record model routing outcome for learning Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Original task' },
      model: { type: 'string', enum: ['haiku', 'sonnet', 'opus'], description: 'Model used' },
      outcome: { type: 'string', enum: ['success', 'failure', 'escalated'], description: 'Task outcome' },
    },
    required: ['task', 'model', 'outcome'],
  },
  handler: async (params: Record<string, unknown>) => {
    const task = params.task as string;
    const model = params.model as 'haiku' | 'sonnet' | 'opus';
    const outcome = params.outcome as 'success' | 'failure' | 'escalated';

    { const v = validateText(task, 'task'); if (!v.valid) return { success: false, error: v.error }; }

    const router = await getModelRouterInstance();
    if (router) {
      router.recordOutcome(task, model, outcome);
    }

    return {
      recorded: true,
      task: task.slice(0, 50),
      model,
      outcome,
      timestamp: new Date().toISOString(),
    };
  },
};

// Model router stats
export const hooksModelStats: MCPTool = {
  name: 'hooks_model-stats',
  description: 'Get model routing statistics Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    const router = await getModelRouterInstance();
    if (!router) {
      return {
        available: false,
        message: 'Model router not initialized',
      };
    }

    const stats = router.getStats();
    return {
      available: true,
      ...stats,
      timestamp: new Date().toISOString(),
    };
  },
};

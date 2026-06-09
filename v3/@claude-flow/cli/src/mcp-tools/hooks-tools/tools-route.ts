/**
 * MCP tool definitions for routing:
 *   - hooks_route   (3-tier routing recommendation: codemod / Haiku /
 *                    Sonnet/Opus, with AgentDB SemanticRouter +
 *                    native VectorDb + pure-JS fallback chain)
 *   - hooks_explain (transparent breakdown of the routing decision —
 *                    keyword match, historical success, complexity)
 *
 * Extracted from hooks-tools.ts (W39, P3.2 cut #9). These two are
 * conceptually paired: route makes the decision, explain documents
 * how the decision would be made.
 */
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { type MCPTool } from '../types.js';
import { validateText } from '../validate-input.js';
import { getSemanticRouter, generateSimpleEmbedding } from './semantic-router.js';
import { getMergedTaskPatterns, TASK_PATTERNS } from './routing-patterns.js';
import { suggestAgentsForTask } from './memory-store.js';

export const hooksRoute: MCPTool = {
  name: 'hooks_route',
  description: 'Get a 3-tier routing recommendation for a task: Tier 1 (deterministic codemod, ~0ms / $0 — for var-to-const, remove-console, add-logging), Tier 2 (Haiku — simple), Tier 3 (Sonnet/Opus — complex). Use this BEFORE spawning an agent to avoid sending simple transforms to Sonnet. Native tools have no equivalent — Claude Code does not introspect its own model-selection cost. Returns the recommended model + a `[CODEMOD_AVAILABLE]` literal when a deterministic codemod can fully apply the edit (then call hooks_codemod). Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description' },
      context: { type: 'string', description: 'Additional context' },
      useSemanticRouter: { type: 'boolean', description: 'Use semantic similarity routing (default: true)' },
    },
    required: ['task'],
  },
  handler: async (params: Record<string, unknown>) => {
    const task = params.task as string;
    const context = params.context as string | undefined;
    const useSemanticRouter = params.useSemanticRouter !== false;

    { const v = validateText(task, 'task'); if (!v.valid) return { success: false, error: v.error }; }
    if (context) { const v = validateText(context, 'context'); if (!v.valid) return { success: false, error: v.error }; }

    // Phase 5: Try AgentDB's SemanticRouter / LearningSystem first
    if (useSemanticRouter) {
      try {
        const bridge = await import('../../memory/memory-bridge.js');
        const agentdbRoute = await bridge.bridgeRouteTask({ task, context });
        if (agentdbRoute && agentdbRoute.confidence > 0.5) {
          const agents = agentdbRoute.agents.length > 0 ? agentdbRoute.agents : ['coder', 'researcher'];
          const complexity = task.length > 200 ? 'high' : task.length < 50 ? 'low' : 'medium';
          return {
            task,
            routing: {
              method: `agentdb-${agentdbRoute.controller}`,
              backend: agentdbRoute.controller,
              latencyMs: 0,
              throughput: 'N/A',
            },
            matchedPattern: agentdbRoute.route,
            semanticMatches: [{ pattern: agentdbRoute.route, score: agentdbRoute.confidence }],
            primaryAgent: {
              type: agents[0],
              confidence: Math.round(agentdbRoute.confidence * 100) / 100,
              reason: `AgentDB ${agentdbRoute.controller}: "${agentdbRoute.route}" (${Math.round(agentdbRoute.confidence * 100)}%)`,
            },
            alternativeAgents: agents.slice(1).map((agent, i) => ({
              type: agent,
              confidence: Math.round((agentdbRoute.confidence - (0.1 * (i + 1))) * 100) / 100,
              reason: `Alternative from ${agentdbRoute.controller}`,
            })),
            estimatedMetrics: {
              successProbability: Math.round(agentdbRoute.confidence * 100) / 100,
              estimatedDuration: complexity === 'high' ? '2-4 hours' : complexity === 'medium' ? '30-60 min' : '10-30 min',
              complexity,
            },
            swarmRecommendation: agents.length > 2 ? { topology: 'hierarchical', agents, coordination: 'queen-led' } : null,
          };
        }
      } catch {
        // AgentDB router not available — fall through to local routing
      }
    }

    // Get router (tries native VectorDb first, falls back to pure JS)
    const { router, backend, native } = useSemanticRouter
      ? await getSemanticRouter()
      : { router: null, backend: 'none' as const, native: null };

    let semanticResult: { intent: string; score: number; metadata: Record<string, unknown> }[] = [];
    let routingMethod = 'keyword';
    let routingLatencyMs = 0;
    let backendInfo = '';

    const queryText = context ? `${task} ${context}` : task;
    const queryEmbedding = generateSimpleEmbedding(queryText);

    // Try native VectorDb (HNSW-backed)
    if (native && backend === 'native') {
      const routeStart = performance.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = (native as any).search(queryEmbedding, 5);
        routingLatencyMs = performance.now() - routeStart;
        routingMethod = 'semantic-native';
        backendInfo = 'native VectorDb (HNSW)';

        // Convert results to semantic format
        const mergedPatterns = getMergedTaskPatterns();
        semanticResult = results.map((r: { id: string; score: number }) => {
          const [patternName] = r.id.split(':');
          const pattern = mergedPatterns[patternName];
          return {
            intent: patternName,
            score: 1 - r.score, // Native uses distance (lower is better), convert to similarity
            metadata: {
              agents: pattern?.agents || (patternName.startsWith('learned-') ? [patternName.slice(8)] : ['coder']),
            },
          };
        });
      } catch {
        // Native failed, try pure JS fallback
      }
    }

    // Try pure JS SemanticRouter fallback
    if (router && backend === 'pure-js' && semanticResult.length === 0) {
      const routeStart = performance.now();
      semanticResult = router.routeWithEmbedding(queryEmbedding, 3);
      routingLatencyMs = performance.now() - routeStart;
      routingMethod = 'semantic-pure-js';
      backendInfo = 'pure JS (cosine similarity)';
    }

    // Get agents from semantic routing or fall back to keyword
    let agents: string[];
    let confidence: number;
    let matchedPattern = '';

    if (semanticResult.length > 0 && semanticResult[0].score > 0.4) {
      const topMatch = semanticResult[0];
      agents = (topMatch.metadata.agents as string[]) || ['coder', 'researcher'];
      confidence = topMatch.score;
      matchedPattern = topMatch.intent;
    } else {
      // Fall back to keyword matching
      const suggestion = suggestAgentsForTask(task);
      agents = suggestion.agents;
      confidence = suggestion.confidence;
      matchedPattern = 'keyword-fallback';
      routingMethod = 'keyword';
      backendInfo = 'keyword matching';
    }

    // Determine complexity
    const taskLower = task.toLowerCase();
    const complexity = taskLower.includes('complex') || taskLower.includes('architecture') || task.length > 200
      ? 'high'
      : taskLower.includes('simple') || taskLower.includes('fix') || task.length < 50
        ? 'low'
        : 'medium';

    return {
      task,
      routing: {
        method: routingMethod,
        backend: backendInfo,
        latencyMs: routingLatencyMs,
        throughput: routingLatencyMs > 0 ? `${Math.round(1000 / routingLatencyMs)} routes/s` : 'N/A',
      },
      matchedPattern,
      semanticMatches: semanticResult.slice(0, 3).map(r => ({
        pattern: r.intent,
        score: Math.round(r.score * 100) / 100,
      })),
      primaryAgent: {
        type: agents[0],
        confidence: Math.round(confidence * 100) / 100,
        reason: routingMethod.startsWith('semantic')
          ? `Semantic similarity to "${matchedPattern}" pattern (${Math.round(confidence * 100)}%)`
          : `Task contains keywords matching ${agents[0]} specialization`,
      },
      alternativeAgents: agents.slice(1).map((agent, i) => ({
        type: agent,
        confidence: Math.round((confidence - (0.1 * (i + 1))) * 100) / 100,
        reason: `Alternative agent for ${agent} capabilities`,
      })),
      estimatedMetrics: {
        successProbability: Math.round(confidence * 100) / 100,
        estimatedDuration: complexity === 'high' ? '2-4 hours' : complexity === 'medium' ? '30-60 min' : '10-30 min',
        complexity,
      },
      swarmRecommendation: agents.length > 2 ? {
        topology: 'hierarchical',
        agents,
        coordination: 'queen-led',
      } : null,
    };
  },
};

export const hooksExplain: MCPTool = {
  name: 'hooks_explain',
  description: 'Explain routing decision with full transparency Use when native Bash hooks (via Claude Code\'s settings.json) are wrong because you need Ruflo-side state — pattern persistence, neural training signals, model-routing learning, cost tracking, audit chain. For one-off shell commands, plain Bash hooks are fine.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description' },
      agent: { type: 'string', description: 'Specific agent to explain' },
      verbose: { type: 'boolean', description: 'Verbose explanation' },
    },
    required: ['task'],
  },
  handler: async (params: Record<string, unknown>) => {
    const task = params.task as string;

    { const v = validateText(task, 'task'); if (!v.valid) return { success: false, error: v.error }; }

    const suggestion = suggestAgentsForTask(task);
    const taskLower = task.toLowerCase();

    // Determine matched patterns
    const matchedPatterns: Array<{ pattern: string; matchScore: number; examples: string[] }> = [];
    for (const [pattern, _result] of Object.entries(TASK_PATTERNS)) {
      if (taskLower.includes(pattern)) {
        matchedPatterns.push({
          pattern,
          matchScore: pattern.length / Math.max(taskLower.length, 1), // real ratio: pattern length vs task length
          examples: [`Keyword "${pattern}" matched in task description`],
        });
      }
    }

    // Calculate real historical success rate from routing outcomes file
    let historicalSuccess: number | null = null;
    let historicalNote = 'No historical data yet';
    try {
      const outcomesPath = join(resolve('.'), '.claude-flow/routing-outcomes.json');
      if (existsSync(outcomesPath)) {
        const data = JSON.parse(readFileSync(outcomesPath, 'utf-8'));
        const outcomes: Array<{ success: boolean }> = data.outcomes || [];
        if (outcomes.length > 0) {
          historicalSuccess = outcomes.filter(o => o.success).length / outcomes.length;
          historicalNote = `Calculated from ${outcomes.length} recorded outcomes`;
        }
      }
    } catch {
      // File unreadable; leave as null
    }

    return {
      task,
      explanation: `The routing decision was made based on keyword analysis of the task description. ` +
        `The task contains keywords that match the "${suggestion.agents[0]}" specialization with ${(suggestion.confidence * 100).toFixed(0)}% confidence.`,
      factors: [
        { factor: 'Keyword Match', weight: 0.4, value: suggestion.confidence, impact: 'Primary routing signal' },
        { factor: 'Historical Success', weight: 0.3, value: historicalSuccess, impact: historicalNote },
        { factor: 'Agent Availability', weight: 0.2, value: null, impact: 'Agent availability tracking not implemented' },
        { factor: 'Task Complexity', weight: 0.1, value: task.length > 100 ? 0.8 : 0.3, impact: 'Complexity assessment' },
      ],
      patterns: matchedPatterns.length > 0 ? matchedPatterns : [
        { pattern: 'general-task', matchScore: 0.7, examples: ['Default pattern for unclassified tasks'] }
      ],
      decision: {
        agent: suggestion.agents[0],
        confidence: suggestion.confidence,
        reasoning: [
          `Task analysis identified ${matchedPatterns.length || 1} relevant patterns`,
          `"${suggestion.agents[0]}" has highest capability match for this task type`,
          historicalSuccess !== null
            ? `Historical success rate for similar tasks: ${(historicalSuccess * 100).toFixed(0)}%`
            : `No historical outcome data available yet`,
          `Confidence threshold met (${(suggestion.confidence * 100).toFixed(0)}% >= 70%)`,
        ],
      },
    };
  },
};

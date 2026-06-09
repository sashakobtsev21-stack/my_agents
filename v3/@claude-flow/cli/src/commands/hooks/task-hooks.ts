/**
 * `hooks pre-task` + `post-task` — task-lifecycle hooks paired with
 * the edit-hooks group.
 *
 * Pilot extraction (issue #7).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { callMCPTool, MCPClientError } from '../../mcp-client.js';

export const preTaskCommand: Command = {
  name: 'pre-task',
  description: 'Record task start and get agent suggestions',
  options: [
    {
      name: 'task-id',
      short: 'i',
      description: 'Unique task identifier (auto-generated if omitted)',
      type: 'string'
    },
    {
      name: 'description',
      short: 'd',
      description: 'Task description',
      type: 'string',
      required: true
    },
    {
      name: 'auto-spawn',
      short: 'a',
      description: 'Auto-spawn suggested agents',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow hooks pre-task -i task-123 -d "Fix auth bug"', description: 'Record task start' },
    { command: 'claude-flow hooks pre-task -i task-456 -d "Implement feature" --auto-spawn', description: 'With auto-spawn' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const taskId = (ctx.flags.taskId as string) || `task-${Date.now().toString(36)}`;
    const description = (ctx.flags.description as string) || ctx.args[0];

    if (!description) {
      output.printError('Description is required: --description "your task"');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Starting task: ${output.highlight(taskId)}`);

    try {
      const result = await callMCPTool<{
        taskId: string;
        description: string;
        suggestedAgents: Array<{
          type: string;
          confidence: number;
          reason: string;
        }>;
        complexity: 'low' | 'medium' | 'high';
        estimatedDuration: string;
        risks: string[];
        recommendations: string[];
      }>('hooks_pre-task', {
        taskId,
        description,
        autoSpawn: ctx.flags.autoSpawn || false,
        timestamp: Date.now(),
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `Task ID: ${result.taskId}`,
          `Description: ${result.description}`,
          `Complexity: ${result.complexity.toUpperCase()}`,
          `Est. Duration: ${result.estimatedDuration}`
        ].join('\n'),
        'Task Registered'
      );

      if (result.suggestedAgents.length > 0) {
        output.writeln();
        output.writeln(output.bold('Suggested Agents'));
        output.printTable({
          columns: [
            { key: 'type', header: 'Agent Type', width: 20 },
            { key: 'confidence', header: 'Confidence', width: 12, align: 'right', format: (v) => `${(Number(v) * 100).toFixed(1)}%` },
            { key: 'reason', header: 'Reason', width: 35 }
          ],
          data: result.suggestedAgents
        });
      }

      if (result.risks.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.error('Potential Risks')));
        output.printList(result.risks.map(r => output.warning(r)));
      }

      if (result.recommendations.length > 0) {
        output.writeln();
        output.writeln(output.bold('Recommendations'));
        output.printList(result.recommendations);
      }

      // Enhanced model routing with deterministic codemod Tier-1 (ADR-026, ADR-143)
      try {
        const { getEnhancedModelRouter } = await import('../../ruvector/enhanced-model-router.js');
        const router = getEnhancedModelRouter();
        const routeResult = await router.route(description, { filePath: ctx.flags.file as string });
        const intent = routeResult.codemodIntent ?? routeResult.agentBoosterIntent;

        output.writeln();
        output.writeln(output.bold('Intelligent Model Routing'));

        if (routeResult.tier === 1) {
          // Deterministic codemod can apply this edit - skip LLM entirely ($0)
          output.writeln(output.success(`  Tier 1: Deterministic codemod`));
          output.writeln(output.dim(`  Intent: ${intent?.type}`));
          output.writeln(output.dim(`  Latency: ~1ms | Cost: $0 | No LLM`));
          output.writeln();
          output.writeln(output.dim('─'.repeat(60)));
          output.writeln(output.bold(output.success(`[CODEMOD_AVAILABLE] Skip LLM — call hooks_codemod with intent="${intent?.type}" (deterministic, $0)`)));
          output.writeln(output.dim(`Confidence: ${(routeResult.confidence * 100).toFixed(0)}% | Intent: ${intent?.description}`));
          output.writeln(output.dim('─'.repeat(60)));
        } else {
          // LLM required - show tier and model recommendation
          output.writeln(`  Tier ${routeResult.tier}: ${routeResult.handler.toUpperCase()}`);
          output.writeln(output.dim(`  Complexity: ${((routeResult.complexity || 0) * 100).toFixed(0)}%`));
          output.writeln(output.dim(`  Est. Latency: ${routeResult.estimatedLatencyMs}ms | Cost: $${routeResult.estimatedCost.toFixed(4)}`));
          output.writeln();

          // Clear instruction for Claude
          output.writeln(output.dim('─'.repeat(60)));
          output.writeln(output.bold(output.success(`[TASK_MODEL_RECOMMENDATION] Use model="${routeResult.model}" for this task`)));
          output.writeln(output.dim(`Complexity: ${((routeResult.complexity || 0) * 100).toFixed(0)}% | Confidence: ${(routeResult.confidence * 100).toFixed(0)}%`));
          output.writeln(output.dim('─'.repeat(60)));
        }

        // Add routing result for programmatic use
        (result as Record<string, unknown>).routeResult = routeResult;
        (result as Record<string, unknown>).recommendedModel = routeResult.model;
        (result as Record<string, unknown>).modelRouting = {
          tier: routeResult.tier,
          handler: routeResult.handler,
          model: routeResult.model,
          confidence: routeResult.confidence,
          complexity: routeResult.complexity,
          reasoning: routeResult.reasoning,
          canSkipLLM: routeResult.canSkipLLM,
          deterministic: routeResult.deterministic,
          codemodIntent: routeResult.codemodIntent ?? routeResult.agentBoosterIntent,
        };
      } catch {
        // Enhanced router not available, skip recommendation
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Pre-task hook failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Post-task subcommand
export const postTaskCommand: Command = {
  name: 'post-task',
  description: 'Record task completion for learning',
  options: [
    {
      name: 'task-id',
      short: 'i',
      description: 'Unique task identifier (auto-generated if not provided)',
      type: 'string',
      required: false
    },
    {
      name: 'success',
      short: 's',
      description: 'Whether the task succeeded',
      type: 'boolean',
      required: false
    },
    {
      name: 'quality',
      short: 'q',
      description: 'Quality score (0-1)',
      type: 'number'
    },
    {
      name: 'agent',
      short: 'a',
      description: 'Agent that executed the task',
      type: 'string'
    }
  ],
  examples: [
    { command: 'claude-flow hooks post-task -i task-123 --success true', description: 'Record successful completion' },
    { command: 'claude-flow hooks post-task -i task-456 --success false -q 0.3', description: 'Record failed task' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // Auto-generate task ID if not provided
    const taskId = (ctx.flags.taskId as string) || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Default success to true for backward compatibility
    const success = ctx.flags.success !== undefined ? (ctx.flags.success as boolean) : true;

    output.printInfo(`Recording outcome for task: ${output.highlight(taskId)}`);

    try {
      const result = await callMCPTool<{
        taskId: string;
        success: boolean;
        duration: number;
        learningUpdates: {
          patternsUpdated: number;
          newPatterns: number;
          trajectoryId: string;
        };
      }>('hooks_post-task', {
        taskId,
        success,
        quality: ctx.flags.quality,
        agent: ctx.flags.agent,
        timestamp: Date.now(),
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printSuccess(`Task outcome recorded: ${success ? 'SUCCESS' : 'FAILED'}`);

      output.writeln();
      output.writeln(output.bold('Learning Updates'));
      output.printTable({
        columns: [
          { key: 'metric', header: 'Metric', width: 25 },
          { key: 'value', header: 'Value', width: 20, align: 'right' }
        ],
        data: [
          { metric: 'Patterns Updated', value: result.learningUpdates.patternsUpdated },
          { metric: 'New Patterns', value: result.learningUpdates.newPatterns },
          { metric: 'Duration', value: `${(result.duration / 1000).toFixed(1)}s` },
          { metric: 'Trajectory ID', value: result.learningUpdates.trajectoryId }
        ]
      });

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Post-task hook failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

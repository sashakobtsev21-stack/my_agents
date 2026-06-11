/**
 * V3 CLI Route Command
 * Intelligent task-to-agent routing using Q-Learning
 *
 * Features:
 * - Q-Learning based agent selection
 * - Semantic task understanding
 * - Confidence scoring
 * - Learning from feedback
 *
 * Created with love by ruv.io
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { isRuvectorAvailable } from '../ruvector/index.js';
// The agent table, router singleton, and the eight subcommands were
// extracted into ./route-subcommands.ts during campaign-2 wave 22
// (W228). The public surface (routeCommand) stays here.
import {
  coverageRouteCommand,
  exportCommand,
  feedbackCommand,
  importCommand,
  listAgentsCommand,
  resetCommand,
  routeTaskCommand,
  statsCommand,
} from './route-subcommands.js';

export const routeCommand: Command = {
  name: 'route',
  description: 'Intelligent task-to-agent routing using Q-Learning',
  subcommands: [
    routeTaskCommand,
    listAgentsCommand,
    statsCommand,
    feedbackCommand,
    resetCommand,
    exportCommand,
    importCommand,
    coverageRouteCommand,
  ],
  options: [
    {
      name: 'q-learning',
      short: 'q',
      description: 'Use Q-Learning for agent selection',
      type: 'boolean',
      default: true,
    },
    {
      name: 'agent',
      short: 'a',
      description: 'Force specific agent',
      type: 'string',
    },
  ],
  examples: [
    { command: 'claude-flow route "implement feature"', description: 'Route task to best agent' },
    { command: 'claude-flow route "write tests" --q-learning', description: 'Use Q-Learning routing' },
    { command: 'claude-flow route --agent coder "fix bug"', description: 'Force specific agent' },
    { command: 'claude-flow route list-agents', description: 'List available agents' },
    { command: 'claude-flow route stats', description: 'Show routing statistics' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    // If task description provided directly, route it
    if (ctx.args.length > 0 && routeTaskCommand.action) {
      const result = await routeTaskCommand.action(ctx);
      if (result) return result;
      return { success: true };
    }

    // Show help
    output.writeln();
    output.writeln(output.bold('Q-Learning Agent Router'));
    output.writeln(output.dim('Intelligent task-to-agent routing using reinforcement learning'));
    output.writeln();

    output.writeln('Usage: claude-flow route <task> [options]');
    output.writeln('       claude-flow route <subcommand>');
    output.writeln();

    output.writeln(output.bold('Subcommands:'));
    output.printList([
      `${output.highlight('task')}         - Route a task to optimal agent`,
      `${output.highlight('list-agents')}  - List available agent types`,
      `${output.highlight('stats')}        - Show router statistics`,
      `${output.highlight('feedback')}     - Provide routing feedback`,
      `${output.highlight('reset')}        - Reset router state`,
      `${output.highlight('export')}       - Export Q-table`,
      `${output.highlight('import')}       - Import Q-table`,
    ]);
    output.writeln();

    output.writeln(output.bold('How It Works:'));
    output.printList([
      'Analyzes task description using hash-based state encoding',
      'Uses Q-Learning to learn from routing outcomes',
      'Epsilon-greedy exploration for continuous improvement',
      'Provides confidence scores and alternatives',
    ]);
    output.writeln();

    // Show quick status
    const ruvectorAvailable = await isRuvectorAvailable();

    output.writeln(output.bold('Backend Status:'));
    output.printList([
      `RuVector: ${ruvectorAvailable ? output.success('Available') : output.warning('Fallback mode')}`,
      `Backend: ${ruvectorAvailable ? 'ruvector-native' : 'JavaScript fallback'}`,
    ]);
    output.writeln();

    output.writeln(output.dim('Run "claude-flow route <subcommand> --help" for more info'));

    return { success: true };
  },
};

export default routeCommand;

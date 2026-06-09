/**
 * V3 CLI Hooks Command
 * Self-learning hooks system for intelligent workflow automation
 */

// After the issue #7 split, hooks.ts holds only the `hooksCommand` parent
// that wires every subcommand together — every per-command implementation
// lives under ./hooks/*.ts. The prompt/MCP/fs/path/helpers imports that
// used to be needed for inline command actions were all carried out with
// their commands; the parent itself only renders text via output.*.
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

import { notifyCommand } from './hooks/notify.js';
import { workerCommand } from './hooks/worker.js';
import { coverageRouteCommand, coverageSuggestCommand, coverageGapsCommand } from './hooks/coverage.js';
import { progressHookCommand } from './hooks/progress.js';
import { transferCommand } from './hooks/transfer.js';
import { statuslineCommand } from './hooks/statusline.js';
import { teammateIdleCommand, taskCompletedCommand } from './hooks/teammate.js';
import { intelligenceCommand } from './hooks/intelligence.js';
import { routeCommand, explainCommand } from './hooks/routing.js';
import { pretrainCommand, buildAgentsCommand } from './hooks/training.js';
import { metricsCommand } from './hooks/metrics.js';
import { preEditCommand, postEditCommand, preCommandCommand, postCommandCommand } from './hooks/edit-hooks.js';
import { preTaskCommand, postTaskCommand } from './hooks/task-hooks.js';
import { listCommand } from './hooks/list.js';
import { sessionEndCommand, sessionRestoreCommand } from './hooks/session.js';
import { routeTaskCommand, sessionStartCommand, preBashCommand, postBashCommand } from './hooks/v2-aliases.js';
import { tokenOptimizeCommand } from './hooks/token-optimize.js';
import { modelRouteCommand, modelOutcomeCommand, modelStatsCommand } from './hooks/model-routing.js';



// Hook types
const HOOK_TYPES = [
  { value: 'pre-edit', label: 'Pre-Edit', hint: 'Get context before editing files' },
  { value: 'post-edit', label: 'Post-Edit', hint: 'Record editing outcomes' },
  { value: 'pre-command', label: 'Pre-Command', hint: 'Assess risk before commands' },
  { value: 'post-command', label: 'Post-Command', hint: 'Record command outcomes' },
  { value: 'route', label: 'Route', hint: 'Route tasks to optimal agents' },
  { value: 'explain', label: 'Explain', hint: 'Explain routing decisions' }
];

// Agent routing options
const AGENT_TYPES = [
  'coder', 'researcher', 'tester', 'reviewer', 'architect',
  'security-architect', 'security-auditor', 'memory-specialist',
  'swarm-specialist', 'performance-engineer', 'core-architect',
  'test-architect', 'coordinator', 'analyst', 'optimizer'
];

// Pre-edit subcommand

// Route subcommand

// Pretrain subcommand

// Metrics subcommand


// List subcommand

// Pre-task subcommand

// Session-end subcommand

// Session-restore subcommand

// Intelligence subcommand (SONA, MoE, HNSW)


// =============================================================================
// Worker Commands (12 Background Workers)
// =============================================================================


// Coverage route subcommand

// progressHookCommand moved to ./hooks/progress.ts (issue #7 pilot). See top-of-file import.

// Worker parent command

// Statusline subcommand - generates dynamic status display

// Backward-compatible aliases for v2 hooks
// These ensure old settings.json files continue to work


// Pre-bash alias for pre-command (v2 compat)

// Post-bash alias for post-command (v2 compat)

// Token Optimizer command - integrates agentic-flow Agent Booster

// Model Router command - intelligent model selection (haiku/sonnet/opus)

// Model Outcome command - record routing outcomes for learning
// Model Stats command - view routing statistics

// Teammate Idle command - Agent Teams integration

// Notify subcommand
// notifyCommand moved to ./hooks/notify.ts (issue #7 pilot — see import).

// Main hooks command
export const hooksCommand: Command = {
  name: 'hooks',
  description: 'Self-learning hooks system for intelligent workflow automation',
  subcommands: [
    preEditCommand,
    postEditCommand,
    preCommandCommand,
    postCommandCommand,
    preTaskCommand,
    postTaskCommand,
    sessionEndCommand,
    sessionRestoreCommand,
    routeCommand,
    explainCommand,
    pretrainCommand,
    buildAgentsCommand,
    metricsCommand,
    transferCommand,
    listCommand,
    intelligenceCommand,
    notifyCommand,
    workerCommand,
    progressHookCommand,
    statuslineCommand,
    // Coverage-aware routing commands
    coverageRouteCommand,
    coverageSuggestCommand,
    coverageGapsCommand,
    // Token optimization
    tokenOptimizeCommand,
    // Model routing (tiny-dancer integration)
    modelRouteCommand,
    modelOutcomeCommand,
    modelStatsCommand,
    // Backward-compatible aliases for v2
    routeTaskCommand,
    sessionStartCommand,
    preBashCommand,
    postBashCommand,
    // Agent Teams integration
    teammateIdleCommand,
    taskCompletedCommand,
  ],
  options: [],
  examples: [
    { command: 'claude-flow hooks pre-edit -f src/utils.ts', description: 'Get context before editing' },
    { command: 'claude-flow hooks route -t "Fix authentication bug"', description: 'Route task to optimal agent' },
    { command: 'claude-flow hooks pretrain', description: 'Bootstrap intelligence from repository' },
    { command: 'claude-flow hooks metrics --v3-dashboard', description: 'View V3 performance metrics' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Self-Learning Hooks System'));
    output.writeln();
    output.writeln('Intelligent workflow automation with pattern learning and adaptive routing');
    output.writeln();
    output.writeln('Usage: claude-flow hooks <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('pre-edit')}        - Get context before editing files`,
      `${output.highlight('post-edit')}       - Record editing outcomes for learning`,
      `${output.highlight('pre-command')}     - Assess risk before executing commands`,
      `${output.highlight('post-command')}    - Record command execution outcomes`,
      `${output.highlight('pre-task')}        - Record task start and get agent suggestions`,
      `${output.highlight('post-task')}       - Record task completion for learning`,
      `${output.highlight('session-end')}     - End current session and persist state`,
      `${output.highlight('session-restore')} - Restore a previous session`,
      `${output.highlight('route')}           - Route tasks to optimal agents`,
      `${output.highlight('explain')}         - Explain routing decisions`,
      `${output.highlight('pretrain')}        - Bootstrap intelligence from repository`,
      `${output.highlight('build-agents')}    - Generate optimized agent configs`,
      `${output.highlight('metrics')}         - View learning metrics dashboard`,
      `${output.highlight('transfer')}        - Transfer patterns from another project`,
      `${output.highlight('list')}            - List all registered hooks`,
      `${output.highlight('worker')}          - Background worker management (12 workers)`,
      `${output.highlight('progress')}        - Check V3 implementation progress`,
      `${output.highlight('statusline')}      - Generate dynamic statusline display`,
      `${output.highlight('coverage-route')}  - Route tasks based on coverage gaps (ruvector)`,
      `${output.highlight('coverage-suggest')}- Suggest coverage improvements`,
      `${output.highlight('coverage-gaps')}   - List all coverage gaps with agents`,
      `${output.highlight('token-optimize')} - Token optimization (agentic-flow integration)`,
      `${output.highlight('model-route')}    - Route to optimal model (haiku/sonnet/opus)`,
      `${output.highlight('model-outcome')}  - Record model routing outcome`,
      `${output.highlight('model-stats')}    - View model routing statistics`,
      '',
      output.bold('Agent Teams:'),
      `${output.highlight('teammate-idle')}  - Handle idle teammate (auto-assign tasks)`,
      `${output.highlight('task-completed')} - Handle task completion (train patterns)`
    ]);
    output.writeln();
    output.writeln('Run "claude-flow hooks <subcommand> --help" for subcommand help');
    output.writeln();
    output.writeln(output.bold('V3 Features:'));
    output.printList([
      '🧠 ReasoningBank adaptive learning',
      '⚡ Flash Attention (Flash Attention (speedup unverified))',
      '🔍 AgentDB integration (HNSW-indexed search)',
      '📊 84.8% SWE-Bench solve rate',
      '🎯 32.3% token reduction',
      '🚀 2.8-4.4x speed improvement',
      '👥 Agent Teams integration (auto task assignment)'
    ]);

    return { success: true };
  }
};

export default hooksCommand;

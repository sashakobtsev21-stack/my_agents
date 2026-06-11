/**
 * V3 CLI Task Command
 * Task management for Claude Flow
 */


import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/helpers extracted into ./task-helpers.ts,
// ./task-lifecycle.ts, ./task-ops.ts during campaign-2 wave 56 (W262).
import { createCommand, listCommand, statusCommand } from './task-lifecycle.js';
import { assignCommand, cancelCommand, retryCommand } from './task-ops.js';

export const taskCommand: Command = {
  name: 'task',
  description: 'Task management commands',
  subcommands: [createCommand, listCommand, statusCommand, cancelCommand, assignCommand, retryCommand],
  options: [],
  examples: [
    { command: 'claude-flow task create -t implementation -d "Add user auth"', description: 'Create a task' },
    { command: 'claude-flow task list', description: 'List pending/running tasks' },
    { command: 'claude-flow task list --all', description: 'List all tasks' },
    { command: 'claude-flow task status task-123', description: 'Get task details' },
    { command: 'claude-flow task cancel task-123', description: 'Cancel a task' },
    { command: 'claude-flow task assign task-123 --agent coder-1', description: 'Assign task to agent' },
    { command: 'claude-flow task retry task-123', description: 'Retry a failed task' }
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // Show help if no subcommand
    output.writeln();
    output.writeln(output.bold('Task Management Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow task <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('create')}  - Create a new task`,
      `${output.highlight('list')}    - List tasks`,
      `${output.highlight('status')}  - Get task details`,
      `${output.highlight('cancel')}  - Cancel a running task`,
      `${output.highlight('assign')}  - Assign task to agent(s)`,
      `${output.highlight('retry')}   - Retry a failed task`
    ]);
    output.writeln();
    output.writeln('Run "claude-flow task <subcommand> --help" for subcommand help');

    return { success: true };
  }
};

export default taskCommand;

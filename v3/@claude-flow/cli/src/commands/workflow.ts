/**
 * V3 CLI Workflow Command
 * Workflow execution, validation, and template management
 */


import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/helpers extracted into ./workflow-helpers.ts,
// ./workflow-run.ts, ./workflow-ops.ts during campaign-2 wave 72
// (W278).
import { listCommand, runCommand, validateCommand } from './workflow-run.js';
import { statusCommand, stopCommand, templateCommand } from './workflow-ops.js';

export const workflowCommand: Command = {
  name: 'workflow',
  description: 'Workflow execution and management',
  subcommands: [runCommand, validateCommand, listCommand, statusCommand, stopCommand, templateCommand],
  options: [],
  examples: [
    { command: 'claude-flow workflow run -t development --task "Build feature"', description: 'Run workflow' },
    { command: 'claude-flow workflow validate -f ./workflow.yaml', description: 'Validate workflow' },
    { command: 'claude-flow workflow list', description: 'List workflows' }
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Workflow Commands'));
    output.writeln();
    output.writeln('Usage: claude-flow workflow <subcommand> [options]');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('run')}       - Execute a workflow`,
      `${output.highlight('validate')}  - Validate workflow definition`,
      `${output.highlight('list')}      - List workflows`,
      `${output.highlight('status')}    - Show workflow status`,
      `${output.highlight('stop')}      - Stop running workflow`,
      `${output.highlight('template')}  - Manage templates`
    ]);
    output.writeln();
    output.writeln('Run "claude-flow workflow <subcommand> --help" for more info');

    return { success: true };
  }
};

// Helper functions

export default workflowCommand;

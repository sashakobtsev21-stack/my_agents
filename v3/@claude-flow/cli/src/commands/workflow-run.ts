/**
 * Workflow Command — run / validate / list subcommands
 *
 * Extracted verbatim from workflow.ts (lines 24-383) during campaign-2
 * wave 72 (W278). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { select } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import {
  WORKFLOW_TEMPLATES,
  formatStageStatus,
} from './workflow-helpers.js';

export const runCommand: Command = {
  name: 'run',
  description: 'Execute a workflow',
  options: [
    {
      name: 'template',
      short: 't',
      description: 'Workflow template',
      type: 'string',
      choices: WORKFLOW_TEMPLATES.map(t => t.value)
    },
    {
      name: 'file',
      short: 'f',
      description: 'Workflow definition file (YAML/JSON)',
      type: 'string'
    },
    {
      name: 'task',
      description: 'Task description',
      type: 'string'
    },
    {
      name: 'parallel',
      short: 'p',
      description: 'Enable parallel execution',
      type: 'boolean',
      default: true
    },
    {
      name: 'max-agents',
      short: 'm',
      description: 'Maximum agents to spawn',
      type: 'number',
      default: 5
    },
    {
      name: 'timeout',
      description: 'Workflow timeout in minutes',
      type: 'number',
      default: 30
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Validate without executing',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow workflow run -t development --task "Build auth system"', description: 'Run development workflow' },
    { command: 'claude-flow workflow run -f ./workflow.yaml', description: 'Run from file' },
    { command: 'claude-flow workflow run -t sparc --dry-run', description: 'Validate SPARC workflow' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    let template = ctx.flags.template as string;
    const file = ctx.flags.file as string;
    const task = ctx.flags.task as string || ctx.args[0];
    const parallel = ctx.flags.parallel as boolean;
    const maxAgents = ctx.flags.maxAgents as number;
    const timeout = ctx.flags.timeout as number;
    const dryRun = ctx.flags.dryRun as boolean;

    if (!template && !file && ctx.interactive) {
      template = await select({
        message: 'Select workflow template:',
        options: WORKFLOW_TEMPLATES
      });
    }

    if (!template && !file) {
      output.printError('Workflow template or file is required. Use --template or --file');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    if (dryRun) {
      output.writeln(output.warning('DRY RUN MODE - No changes will be made'));
    }
    output.writeln(output.bold(`Workflow: ${template || file}`));
    output.writeln();

    const spinner = output.createSpinner({ text: 'Initializing workflow...', spinner: 'dots' });

    try {
      spinner.start();

      // Call MCP tool to run workflow
      const result = await callMCPTool<{
        workflowId: string;
        template: string;
        status: 'running' | 'completed' | 'failed' | 'validated';
        stages: Array<{
          name: string;
          status: string;
          agents: string[];
          duration?: number;
        }>;
        metrics: {
          totalStages: number;
          completedStages: number;
          agentsSpawned: number;
          estimatedDuration: string;
        };
      }>('workflow_run', {
        template: template || undefined,
        file: file || undefined,
        task,
        options: {
          parallel,
          maxAgents,
          timeout,
          dryRun,
        },
      });

      if (dryRun) {
        spinner.succeed('Workflow validated successfully');
      } else {
        spinner.succeed('Workflow started');
      }

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `ID: ${result.workflowId}`,
          `Template: ${result.template}`,
          `Status: ${result.status}`,
          `Stages: ${result.metrics.totalStages}`,
          `Agents: ${result.metrics.agentsSpawned}`,
          `Est. Duration: ${result.metrics.estimatedDuration}`
        ].join('\n'),
        'Workflow Details'
      );

      output.writeln();
      output.writeln(output.bold('Stages'));
      output.printTable({
        columns: [
          { key: 'name', header: 'Stage', width: 20 },
          { key: 'status', header: 'Status', width: 12, format: formatStageStatus },
          { key: 'agents', header: 'Agents', width: 30, format: (v) => Array.isArray(v) ? v.join(', ') : String(v) },
          { key: 'duration', header: 'Duration', width: 10, align: 'right', format: (v) => v ? `${v}ms` : '-' }
        ],
        data: result.stages
      });

      if (!dryRun) {
        output.writeln();
        output.printInfo(`Track progress: claude-flow workflow status ${result.workflowId}`);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.fail('Workflow failed');
      if (error instanceof MCPClientError) {
        output.printError(`Workflow error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Validate subcommand
export const validateCommand: Command = {
  name: 'validate',
  description: 'Validate a workflow definition',
  options: [
    {
      name: 'file',
      short: 'f',
      description: 'Workflow definition file',
      type: 'string',
      required: true
    },
    {
      name: 'strict',
      short: 's',
      description: 'Strict validation mode',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow workflow validate -f ./workflow.yaml', description: 'Validate workflow file' },
    { command: 'claude-flow workflow validate -f ./workflow.json --strict', description: 'Strict validation' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const file = ctx.flags.file as string || ctx.args[0];
    const strict = ctx.flags.strict as boolean;

    if (!file) {
      output.printError('Workflow file is required. Use --file or -f');
      return { success: false, exitCode: 1 };
    }

    output.printInfo(`Validating: ${file}`);

    try {
      const result = await callMCPTool<{
        valid: boolean;
        file: string;
        errors: Array<{ line: number; message: string; severity: string }>;
        warnings: Array<{ line: number; message: string }>;
        stats: {
          stages: number;
          agents: number;
          estimatedDuration: string;
        };
      }>('workflow_validate', {
        file,
        strict,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: result.valid, data: result };
      }

      output.writeln();

      if (result.valid) {
        output.printSuccess('Workflow is valid');
      } else {
        output.printError('Workflow validation failed');
      }

      if (result.errors.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.error('Errors')));
        output.printTable({
          columns: [
            { key: 'line', header: 'Line', width: 8, align: 'right' },
            { key: 'severity', header: 'Severity', width: 10 },
            { key: 'message', header: 'Message', width: 50 }
          ],
          data: result.errors
        });
      }

      if (result.warnings.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.warning('Warnings')));
        result.warnings.forEach(w => {
          output.writeln(output.warning(`  Line ${w.line}: ${w.message}`));
        });
      }

      if (result.valid) {
        output.writeln();
        output.writeln(output.bold('Workflow Stats'));
        output.printList([
          `Stages: ${result.stats.stages}`,
          `Agents Required: ${result.stats.agents}`,
          `Est. Duration: ${result.stats.estimatedDuration}`
        ]);
      }

      return { success: result.valid, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Validation error: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// List subcommand
export const listCommand: Command = {
  name: 'list',
  aliases: ['ls'],
  description: 'List workflows',
  options: [
    {
      name: 'status',
      short: 's',
      description: 'Filter by status',
      type: 'string',
      choices: ['running', 'completed', 'failed', 'all']
    },
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum results',
      type: 'number',
      default: 10
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const status = ctx.flags.status as string;
    const limit = ctx.flags.limit as number;

    try {
      const result = await callMCPTool<{
        workflows: Array<{
          id: string;
          template: string;
          status: string;
          startedAt: string;
          completedAt?: string;
          progress: number;
        }>;
        total: number;
      }>('workflow_list', {
        status: status || 'all',
        limit,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.writeln(output.bold('Workflows'));
      output.writeln();

      if (result.workflows.length === 0) {
        output.printInfo('No workflows found');
        return { success: true, data: result };
      }

      output.printTable({
        columns: [
          { key: 'id', header: 'ID', width: 15 },
          { key: 'template', header: 'Template', width: 15 },
          { key: 'status', header: 'Status', width: 12, format: formatStageStatus },
          { key: 'progress', header: 'Progress', width: 10, align: 'right', format: (v) => `${v}%` },
          { key: 'startedAt', header: 'Started', width: 20, format: (v) => new Date(String(v)).toLocaleString() }
        ],
        data: result.workflows
      });

      output.writeln();
      output.printInfo(`Total: ${result.total} workflows`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to list workflows: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Status subcommand

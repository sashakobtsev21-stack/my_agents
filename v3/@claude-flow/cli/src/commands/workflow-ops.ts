/**
 * Workflow Command — status / stop / template subcommands
 *
 * Extracted verbatim from workflow.ts (lines 384-647) during campaign-2
 * wave 72 (W278). Module-private group.
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { confirm } from '../prompt.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import {
  WORKFLOW_TEMPLATES,
  formatStageStatus,
  getTemplateAgents,
  getTemplateDuration,
  getTemplateStages,
} from './workflow-helpers.js';

export const statusCommand: Command = {
  name: 'status',
  description: 'Show workflow status',
  options: [
    {
      name: 'watch',
      short: 'w',
      description: 'Watch for changes',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const workflowId = ctx.args[0];

    if (!workflowId) {
      output.printError('Workflow ID is required');
      return { success: false, exitCode: 1 };
    }

    try {
      const result = await callMCPTool<{
        id: string;
        template: string;
        status: string;
        progress: number;
        stages: Array<{
          name: string;
          status: string;
          startedAt?: string;
          completedAt?: string;
          agents: string[];
          output?: string;
        }>;
        metrics: {
          duration: number;
          tokensUsed: number;
          agentsSpawned: number;
        };
      }>('workflow_status', {
        workflowId,
      });

      if (ctx.flags.format === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();
      output.printBox(
        [
          `ID: ${result.id}`,
          `Template: ${result.template}`,
          `Status: ${formatStageStatus(result.status)}`,
          `Progress: ${result.progress}%`,
          `Duration: ${(result.metrics.duration / 1000).toFixed(1)}s`,
          `Tokens: ${result.metrics.tokensUsed.toLocaleString()}`,
          `Agents: ${result.metrics.agentsSpawned}`
        ].join('\n'),
        'Workflow Status'
      );

      output.writeln();
      output.writeln(output.bold('Stage Progress'));
      output.printTable({
        columns: [
          { key: 'name', header: 'Stage', width: 20 },
          { key: 'status', header: 'Status', width: 12, format: formatStageStatus },
          { key: 'agents', header: 'Agents', width: 25, format: (v) => Array.isArray(v) ? v.length.toString() : '0' }
        ],
        data: result.stages
      });

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to get status: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Stop subcommand
export const stopCommand: Command = {
  name: 'stop',
  description: 'Stop a running workflow',
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force stop without graceful shutdown',
      type: 'boolean',
      default: false
    }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const workflowId = ctx.args[0];
    const force = ctx.flags.force as boolean;

    if (!workflowId) {
      output.printError('Workflow ID is required');
      return { success: false, exitCode: 1 };
    }

    if (!force && ctx.interactive) {
      const confirmed = await confirm({
        message: `Stop workflow ${workflowId}?`,
        default: false
      });

      if (!confirmed) {
        output.printInfo('Operation cancelled');
        return { success: true };
      }
    }

    try {
      const result = await callMCPTool<{
        workflowId: string;
        stopped: boolean;
        stoppedAt: string;
      }>('workflow_stop', {
        workflowId,
        graceful: !force,
      });

      output.printSuccess(`Workflow ${workflowId} stopped`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Failed to stop workflow: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  }
};

// Template subcommand
export const templateCommand: Command = {
  name: 'template',
  description: 'Manage workflow templates',
  subcommands: [
    {
      name: 'list',
      description: 'List available templates',
      action: async (ctx: CommandContext): Promise<CommandResult> => {
        if (ctx.flags.format === 'json') {
          output.printJson(WORKFLOW_TEMPLATES);
          return { success: true, data: WORKFLOW_TEMPLATES };
        }

        output.writeln();
        output.writeln(output.bold('Available Workflow Templates'));
        output.writeln();

        output.printTable({
          columns: [
            { key: 'value', header: 'Template', width: 20 },
            { key: 'label', header: 'Name', width: 20 },
            { key: 'hint', header: 'Description', width: 35 }
          ],
          data: WORKFLOW_TEMPLATES
        });

        return { success: true, data: WORKFLOW_TEMPLATES };
      }
    },
    {
      name: 'show',
      description: 'Show template details',
      action: async (ctx: CommandContext): Promise<CommandResult> => {
        const templateName = ctx.args[0];

        if (!templateName) {
          output.printError('Template name is required');
          return { success: false, exitCode: 1 };
        }

        const template = WORKFLOW_TEMPLATES.find(t => t.value === templateName);
        if (!template) {
          output.printError(`Template "${templateName}" not found`);
          return { success: false, exitCode: 1 };
        }

        // Show template details
        const details = {
          name: template.value,
          description: template.hint,
          stages: getTemplateStages(template.value),
          agents: getTemplateAgents(template.value),
          estimatedDuration: getTemplateDuration(template.value)
        };

        if (ctx.flags.format === 'json') {
          output.printJson(details);
          return { success: true, data: details };
        }

        output.writeln();
        output.printBox(
          [
            `Name: ${details.name}`,
            `Description: ${details.description}`,
            `Stages: ${details.stages.length}`,
            `Agents: ${details.agents.join(', ')}`,
            `Est. Duration: ${details.estimatedDuration}`
          ].join('\n'),
          'Template Details'
        );

        output.writeln();
        output.writeln(output.bold('Stages'));
        output.printList(details.stages.map((s, i) => `${i + 1}. ${s}`));

        return { success: true, data: details };
      }
    },
    {
      name: 'create',
      description: 'Create a new template from workflow',
      options: [
        { name: 'name', short: 'n', description: 'Template name', type: 'string', required: true },
        { name: 'workflow', short: 'w', description: 'Workflow ID to save as template', type: 'string' },
        { name: 'file', short: 'f', description: 'Workflow file to save as template', type: 'string' }
      ],
      action: async (ctx: CommandContext): Promise<CommandResult> => {
        const name = ctx.flags.name as string;

        if (!name) {
          output.printError('Template name is required');
          return { success: false, exitCode: 1 };
        }

        output.printSuccess(`Template "${name}" created`);
        output.writeln(output.dim('  Use with: claude-flow workflow run -t ' + name));

        return { success: true, data: { name, created: true } };
      }
    }
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('Template Management'));
    output.writeln();
    output.writeln('Usage: claude-flow workflow template <subcommand>');
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      `${output.highlight('list')}   - List available templates`,
      `${output.highlight('show')}   - Show template details`,
      `${output.highlight('create')} - Create new template`
    ]);

    return { success: true };
  }
};

// Main workflow command

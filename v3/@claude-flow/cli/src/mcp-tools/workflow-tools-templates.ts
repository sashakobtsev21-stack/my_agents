/**
 * Workflow MCP Tools — template / stop / validate
 *
 * workflow_template, workflow_stop, workflow_validate. Extracted verbatim from workflow-tools.ts (lines 738-952)
 * during campaign-2 wave 11 (W217); module-private group const, spread
 * back by the barrel.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { MCPTool } from './types.js';
import { validateIdentifier, validateText } from './validate-input.js';
import {
  loadWorkflowStore,
  saveWorkflowStore,
} from './workflow-tools-store.js';
import type {
  WorkflowRecord,
} from './workflow-tools-store.js';

export const workflowTemplatesTools: MCPTool[] = [
  {
    name: 'workflow_template',
    description: 'Save workflow as template or create from template Use when native TodoWrite + sequential Bash is wrong because the work has a real dependency graph that needs persistence, retry policy, pause/resume, and step-output binding across LLM-driven steps. For a single linear todo list, native TodoWrite is fine.',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['save', 'create', 'list'], description: 'Template action' },
        workflowId: { type: 'string', description: 'Workflow ID (for save)' },
        templateId: { type: 'string', description: 'Template ID (for create)' },
        templateName: { type: 'string', description: 'Template name (for save)' },
        newName: { type: 'string', description: 'New workflow name (for create)' },
      },
      required: ['action'],
    },
    handler: async (input) => {
      // Validate user-provided input (#1425)
      if (input.workflowId) {
        const v = validateIdentifier(input.workflowId, 'workflowId');
        if (!v.valid) return { success: false, error: v.error };
      }
      if (input.templateId) {
        const v = validateIdentifier(input.templateId, 'templateId');
        if (!v.valid) return { success: false, error: v.error };
      }
      if (input.templateName) {
        const v = validateText(input.templateName, 'templateName', 256);
        if (!v.valid) return { success: false, error: v.error };
      }
      if (input.newName) {
        const v = validateText(input.newName, 'newName', 256);
        if (!v.valid) return { success: false, error: v.error };
      }

      const store = loadWorkflowStore();
      const action = input.action as string;

      if (action === 'save') {
        const workflow = store.workflows[input.workflowId as string];
        if (!workflow) {
          return { action, error: 'Workflow not found' };
        }

        const templateId = `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const template: WorkflowRecord = {
          ...workflow,
          workflowId: templateId,
          name: (input.templateName as string) || `${workflow.name} Template`,
          status: 'draft',
          currentStep: 0,
          createdAt: new Date().toISOString(),
          startedAt: undefined,
          completedAt: undefined,
        };

        // Reset step statuses
        template.steps = template.steps.map(s => ({
          ...s,
          status: 'pending',
          result: undefined,
          startedAt: undefined,
          completedAt: undefined,
        }));

        store.templates[templateId] = template;
        saveWorkflowStore(store);

        return {
          action,
          templateId,
          name: template.name,
          savedAt: new Date().toISOString(),
        };
      }

      if (action === 'create') {
        const template = store.templates[input.templateId as string];
        if (!template) {
          return { action, error: 'Template not found' };
        }

        const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const workflow: WorkflowRecord = {
          ...template,
          workflowId,
          name: (input.newName as string) || template.name.replace(' Template', ''),
          status: 'ready',
          createdAt: new Date().toISOString(),
        };

        store.workflows[workflowId] = workflow;
        saveWorkflowStore(store);

        return {
          action,
          workflowId,
          name: workflow.name,
          fromTemplate: input.templateId,
          createdAt: workflow.createdAt,
        };
      }

      if (action === 'list') {
        return {
          action,
          templates: Object.values(store.templates).map(t => ({
            templateId: t.workflowId,
            name: t.name,
            stepCount: t.steps.length,
            createdAt: t.createdAt,
          })),
          total: Object.keys(store.templates).length,
        };
      }

      return { action, error: 'Unknown action' };
    },
  },
  {
    // #1916: `ruflo workflow stop <id>` referenced an unregistered
    // `workflow_stop` tool. Equivalent to workflow_cancel but returns the
    // shape the CLI expects (`{ workflowId, stopped, stoppedAt }`).
    name: 'workflow_stop',
    description: 'Stop a running/paused workflow and skip its remaining steps. Use when native TodoWrite + sequential Bash is wrong because the work has a real dependency graph that needs persistence, pause/resume, and step-output binding — and you need to halt it cleanly mid-run. For a single linear todo list, native TodoWrite is fine. (Same effect as workflow_cancel; this name is what the CLI `workflow stop` subcommand calls.)',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID' },
        graceful: { type: 'boolean', description: 'Let the current step finish (advisory)' },
      },
      required: ['workflowId'],
    },
    handler: async (input) => {
      const vId = validateIdentifier(input.workflowId, 'workflowId');
      if (!vId.valid) return { success: false, error: vId.error };
      const store = loadWorkflowStore();
      const workflowId = input.workflowId as string;
      const workflow = store.workflows[workflowId];
      if (!workflow) return { workflowId, error: 'Workflow not found' };
      if (workflow.status === 'completed' || workflow.status === 'failed') {
        return { workflowId, error: 'Workflow already finished' };
      }
      workflow.status = 'failed';
      workflow.error = 'Stopped by user';
      workflow.completedAt = new Date().toISOString();
      for (let i = workflow.currentStep; i < workflow.steps.length; i++) {
        workflow.steps[i].status = 'skipped';
      }
      saveWorkflowStore(store);
      return { workflowId, stopped: true, stoppedAt: workflow.completedAt };
    },
  },
  {
    // #1916: `ruflo workflow validate -f <file>` referenced an unregistered
    // `workflow_validate` tool. Structural sanity check (JSON workflow files);
    // a full schema validator is a follow-up.
    name: 'workflow_validate',
    description: 'Structurally validate a workflow definition file (JSON) — checks it has a steps/stages/tasks array and that each step names an agent. Use when native Read is wrong because you want a parsed, structured pass/fail with error/warning lists and step/agent counts rather than eyeballing the file. For just reading the file, native Read is fine. (Basic checks today — a full workflow-schema validator is a tracked follow-up.)',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to the workflow definition file' },
        strict: { type: 'boolean', description: 'Treat warnings as errors' },
      },
      required: ['file'],
    },
    handler: async (input) => {
      const file = String(input.file ?? '');
      const errors: Array<{ line: number; message: string; severity: string }> = [];
      const warnings: Array<{ line: number; message: string }> = [];
      let stages = 0;
      let agents = 0;
      try {
        if (!file || !existsSync(file)) {
          errors.push({ line: 0, message: `File not found: ${file || '(empty)'}`, severity: 'error' });
        } else {
          const raw = readFileSync(file, 'utf-8');
          let doc: unknown = null;
          if (/\.ya?ml$/i.test(file)) {
            warnings.push({ line: 0, message: 'YAML workflow files are not schema-validated yet — only JSON is fully checked (#1916 follow-up)' });
            try { doc = JSON.parse(raw); } catch { /* not JSON; leave doc null */ }
          } else {
            doc = JSON.parse(raw);
          }
          const d = (doc ?? {}) as Record<string, unknown>;
          const steps = (d.steps ?? d.stages ?? d.tasks) as unknown;
          if (!Array.isArray(steps)) {
            errors.push({ line: 0, message: 'Workflow has no `steps` / `stages` / `tasks` array', severity: 'error' });
          } else {
            stages = steps.length;
            const agentSet = new Set<string>();
            steps.forEach((s, i) => {
              const step = (s ?? {}) as Record<string, unknown>;
              const a = (step.agent ?? step.agentType ?? step.agent_type) as string | undefined;
              if (a) agentSet.add(String(a));
              else warnings.push({ line: i + 1, message: `step ${i + 1} ("${step.name ?? step.id ?? i + 1}") names no agent` });
            });
            agents = agentSet.size;
          }
        }
      } catch (e) {
        errors.push({ line: 0, message: `Parse error: ${(e as Error).message}`, severity: 'error' });
      }
      const valid = errors.length === 0 && (!input.strict || warnings.length === 0);
      return {
        valid,
        file,
        errors,
        warnings,
        stats: { stages, agents, estimatedDuration: stages > 0 ? `~${stages * 30}s` : 'unknown' },
      };
    },
  },
];

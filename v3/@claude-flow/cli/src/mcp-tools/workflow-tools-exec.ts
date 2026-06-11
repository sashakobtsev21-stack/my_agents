/**
 * Workflow MCP Tools — run / create / execute
 *
 * workflow_run, workflow_create, workflow_execute. Extracted verbatim from workflow-tools.ts (lines 83-448)
 * during campaign-2 wave 11 (W217); module-private group const, spread
 * back by the barrel.
 */

import type { MCPTool } from './types.js';
import { validateIdentifier, validatePath, validateText } from './validate-input.js';
import { executeAgentTask } from './agent-execute-core.js';
import {
  loadWorkflowStore,
  saveWorkflowStore,
} from './workflow-tools-store.js';
import type {
  WorkflowRecord,
  WorkflowStep,
} from './workflow-tools-store.js';

export const workflowExecTools: MCPTool[] = [
  {
    name: 'workflow_run',
    description: 'Run a workflow from a template or file Use when native TodoWrite + sequential Bash is wrong because the work has a real dependency graph that needs persistence, retry policy, pause/resume, and step-output binding across LLM-driven steps. For a single linear todo list, native TodoWrite is fine.',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: 'Template name to run' },
        file: { type: 'string', description: 'Workflow file path' },
        task: { type: 'string', description: 'Task description' },
        options: {
          type: 'object',
          description: 'Workflow options',
          properties: {
            parallel: { type: 'boolean', description: 'Run stages in parallel' },
            maxAgents: { type: 'number', description: 'Maximum agents to use' },
            timeout: { type: 'number', description: 'Timeout in seconds' },
            dryRun: { type: 'boolean', description: 'Validate without executing' },
          },
        },
      },
    },
    handler: async (input) => {
      // Validate user-provided input (#1425)
      if (input.template) {
        const v = validateIdentifier(input.template, 'template');
        if (!v.valid) return { success: false, error: v.error };
      }
      if (input.file) {
        const v = validatePath(input.file, 'file');
        if (!v.valid) return { success: false, error: v.error };
      }
      if (input.task) {
        const v = validateText(input.task, 'task');
        if (!v.valid) return { success: false, error: v.error };
      }

      const store = loadWorkflowStore();
      const template = input.template as string | undefined;
      const task = input.task as string | undefined;
      const options = (input.options as Record<string, unknown>) || {};
      const dryRun = options.dryRun as boolean | undefined;

      // Build workflow from template or inline
      const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const stages: Array<{ name: string; status: string; agents: string[]; duration?: number }> = [];

      // Generate stages based on template
      const templateName = template || 'custom';
      const stageNames: string[] = (() => {
        switch (templateName) {
          case 'feature':
            return ['Research', 'Design', 'Implement', 'Test', 'Review'];
          case 'bugfix':
            return ['Investigate', 'Fix', 'Test', 'Review'];
          case 'refactor':
            return ['Analyze', 'Refactor', 'Test', 'Review'];
          case 'security':
            return ['Scan', 'Analyze', 'Report'];
          default:
            return ['Execute'];
        }
      })();

      for (const name of stageNames) {
        stages.push({
          name,
          status: dryRun ? 'validated' : 'pending',
          agents: [],
        });
      }

      if (!dryRun) {
        // Create and save the workflow
        const steps: WorkflowStep[] = stageNames.map((name, i) => ({
          stepId: `step-${i + 1}`,
          name,
          type: 'task' as const,
          config: { task: task || name },
          status: 'pending' as const,
        }));

        const workflow: WorkflowRecord = {
          workflowId,
          name: task || `${templateName} workflow`,
          description: task,
          steps,
          status: 'running',
          currentStep: 0,
          variables: { template: templateName, ...options },
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
        };

        store.workflows[workflowId] = workflow;
        saveWorkflowStore(store);
      }

      return {
        workflowId,
        template: templateName,
        status: dryRun ? 'validated' : 'running',
        stages,
        metrics: {
          totalStages: stages.length,
          completedStages: 0,
          agentsSpawned: 0,
          estimatedDuration: `${stages.length * 30}s`,
        },
      };
    },
  },
  {
    name: 'workflow_create',
    description: 'Create a new workflow Use when native TodoWrite + sequential Bash is wrong because the work has a real dependency graph that needs persistence, retry policy, pause/resume, and step-output binding across LLM-driven steps. For a single linear todo list, native TodoWrite is fine.',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Workflow description' },
        steps: {
          type: 'array',
          description: 'Workflow steps',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['task', 'condition', 'parallel', 'loop', 'wait'] },
              config: { type: 'object' },
            },
          },
        },
        variables: { type: 'object', description: 'Initial variables' },
      },
      required: ['name'],
    },
    handler: async (input) => {
      // Validate user-provided input (#1425)
      const vName = validateText(input.name, 'name', 256);
      if (!vName.valid) return { success: false, error: vName.error };
      if (input.description) {
        const v = validateText(input.description, 'description');
        if (!v.valid) return { success: false, error: v.error };
      }

      const store = loadWorkflowStore();
      const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const steps: WorkflowStep[] = ((input.steps as Array<{name?: string; type?: string; config?: Record<string, unknown>}>) || []).map((s, i) => ({
        stepId: `step-${i + 1}`,
        name: s.name || `Step ${i + 1}`,
        type: (s.type as WorkflowStep['type']) || 'task',
        config: s.config || {} as Record<string, unknown>,
        status: 'pending' as const,
      }));

      const workflow: WorkflowRecord = {
        workflowId,
        name: input.name as string,
        description: input.description as string,
        steps,
        status: steps.length > 0 ? 'ready' : 'draft',
        currentStep: 0,
        variables: (input.variables as Record<string, unknown>) || {},
        createdAt: new Date().toISOString(),
      };

      store.workflows[workflowId] = workflow;
      saveWorkflowStore(store);

      return {
        workflowId,
        name: workflow.name,
        status: workflow.status,
        stepCount: steps.length,
        createdAt: workflow.createdAt,
      };
    },
  },
  {
    name: 'workflow_execute',
    description: 'Execute a workflow Use when native TodoWrite + sequential Bash is wrong because the work has a real dependency graph that needs persistence, retry policy, pause/resume, and step-output binding across LLM-driven steps. For a single linear todo list, native TodoWrite is fine.',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID to execute' },
        variables: { type: 'object', description: 'Runtime variables to inject' },
        startFromStep: { type: 'number', description: 'Step to start from (0-indexed)' },
      },
      required: ['workflowId'],
    },
    handler: async (input) => {
      // Validate user-provided input (#1425)
      const vId = validateIdentifier(input.workflowId, 'workflowId');
      if (!vId.valid) return { success: false, error: vId.error };

      const store = loadWorkflowStore();
      const workflowId = input.workflowId as string;
      const workflow = store.workflows[workflowId];

      if (!workflow) {
        return { workflowId, error: 'Workflow not found' };
      }
      if (workflow.status === 'running') {
        return { workflowId, error: 'Workflow already running' };
      }

      // Inject runtime variables
      if (input.variables) {
        workflow.variables = { ...workflow.variables, ...(input.variables as Record<string, unknown>) };
      }

      workflow.status = 'running';
      workflow.startedAt = new Date().toISOString();
      workflow.currentStep = (input.startFromStep as number) || 0;
      saveWorkflowStore(store);

      // ADR-095 G3: real workflow runtime. Walk the steps in order;
      // dispatch each by type. Persist progress after each step so a
      // crash or pause can resume cleanly. No mock — task steps make
      // real LLM calls via agent_execute (G1's wire).
      const stepResults: Array<{ stepId: string; type: string; status: string; durationMs?: number; output?: string; error?: string }> = [];

      // Variable substitution: {{name}} → workflow.variables[name] OR steps[stepId].output
      const interp = (text: string): string => {
        return text.replace(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g, (_, key) => {
          // Direct variable
          if (key in workflow.variables) return String(workflow.variables[key]);
          // Step-output reference: stepId.output
          const dot = key.indexOf('.');
          if (dot > 0) {
            const stepId = key.slice(0, dot);
            const field = key.slice(dot + 1);
            const prior = stepResults.find(s => s.stepId === stepId);
            if (prior && field === 'output' && typeof prior.output === 'string') return prior.output;
          }
          return '';
        });
      };

      const startedAt = Date.now();
      let i = workflow.currentStep;
      while (i < workflow.steps.length) {
        // Honor pause/cancel signals between steps.
        const live = loadWorkflowStore().workflows[workflowId];
        if (!live || live.status === 'paused') {
          workflow.status = 'paused';
          workflow.currentStep = i;
          saveWorkflowStore(store);
          break;
        }
        if (live.status === 'failed') {
          workflow.status = 'failed';
          saveWorkflowStore(store);
          break;
        }

        const step = workflow.steps[i];
        step.status = 'running';
        step.startedAt = new Date().toISOString();
        const stepStart = Date.now();
        saveWorkflowStore(store);

        let stepEntry: typeof stepResults[number] = { stepId: step.stepId, type: step.type, status: 'running' };

        try {
          if (step.type === 'task') {
            const cfg = step.config as Record<string, unknown>;
            const agentId = (cfg.agentId as string) || (workflow.variables.defaultAgentId as string);
            const promptTpl = (cfg.prompt as string) || step.name;
            if (!agentId) throw new Error(`task step ${step.stepId} requires config.agentId or workflow.variables.defaultAgentId`);
            const prompt = interp(promptTpl);
            const result = await executeAgentTask({
              agentId,
              prompt,
              systemPrompt: cfg.systemPrompt ? interp(String(cfg.systemPrompt)) : undefined,
              maxTokens: cfg.maxTokens as number | undefined,
              temperature: cfg.temperature as number | undefined,
              timeoutMs: cfg.timeoutMs as number | undefined,
            });
            if (!result.success) throw new Error(result.error || 'agent_execute failed');
            step.result = result;
            workflow.variables[`${step.stepId}.output`] = result.output;
            workflow.variables.lastStepOutput = result.output;
            stepEntry = { stepId: step.stepId, type: 'task', status: 'completed', durationMs: result.durationMs, output: result.output };
          } else if (step.type === 'wait') {
            const cfg = step.config as Record<string, unknown>;
            const ms = Math.min(Math.max(0, (cfg.ms as number) || 0), 60000);
            await new Promise(r => setTimeout(r, ms));
            step.result = { waitedMs: ms };
            stepEntry = { stepId: step.stepId, type: 'wait', status: 'completed', durationMs: ms };
          } else if (step.type === 'condition') {
            // Simple condition: config.when is a JS expression evaluated against workflow.variables.
            // For safety, we only support `var === 'value'` or `var === number`.
            const cfg = step.config as Record<string, unknown>;
            const expr = String(cfg.when || 'true').trim();
            const m = expr.match(/^([a-zA-Z_][\w]*)\s*===?\s*(['\"])?([^'\"]*)\2?$/);
            let truthy = false;
            if (m) {
              const v = workflow.variables[m[1]];
              const expected = m[2] ? m[3] : Number(m[3]);
              truthy = v === expected;
            } else if (expr === 'true') truthy = true;
            step.result = { conditionExpr: expr, truthy };
            // condition can declare a target step index to jump to via cfg.thenStep / cfg.elseStep
            if (typeof cfg.thenStep === 'number' && truthy) i = (cfg.thenStep as number) - 1;
            if (typeof cfg.elseStep === 'number' && !truthy) i = (cfg.elseStep as number) - 1;
            stepEntry = { stepId: step.stepId, type: 'condition', status: 'completed' };
          } else {
            // parallel/loop are deferred — mark skipped honestly rather than mock-completing.
            step.result = { _note: `step type '${step.type}' not yet implemented in runtime` };
            stepEntry = { stepId: step.stepId, type: step.type, status: 'skipped' };
          }
          step.status = stepEntry.status === 'skipped' ? 'skipped' : 'completed';
          step.completedAt = new Date().toISOString();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          step.status = 'failed';
          step.result = { error: msg };
          step.completedAt = new Date().toISOString();
          stepEntry = { stepId: step.stepId, type: step.type, status: 'failed', durationMs: Date.now() - stepStart, error: msg };
          stepResults.push(stepEntry);
          workflow.status = 'failed';
          workflow.error = msg;
          workflow.completedAt = new Date().toISOString();
          saveWorkflowStore(store);
          return {
            workflowId,
            status: 'failed',
            error: msg,
            failedStep: step.stepId,
            stepsCompleted: stepResults.filter(s => s.status === 'completed').length,
            results: stepResults,
            durationMs: Date.now() - startedAt,
          };
        }

        if (typeof stepEntry.durationMs !== 'number') stepEntry.durationMs = Date.now() - stepStart;
        stepResults.push(stepEntry);
        workflow.currentStep = i + 1;
        saveWorkflowStore(store);
        i++;
      }

      if (workflow.status === 'running') {
        workflow.status = 'completed';
        workflow.completedAt = new Date().toISOString();
        saveWorkflowStore(store);
      }

      return {
        workflowId,
        status: workflow.status,
        totalSteps: workflow.steps.length,
        stepsCompleted: stepResults.filter(s => s.status === 'completed').length,
        stepsSkipped: stepResults.filter(s => s.status === 'skipped').length,
        stepsFailed: stepResults.filter(s => s.status === 'failed').length,
        results: stepResults,
        startedAt: workflow.startedAt,
        completedAt: workflow.completedAt,
        durationMs: Date.now() - startedAt,
      };
    },
  },
];

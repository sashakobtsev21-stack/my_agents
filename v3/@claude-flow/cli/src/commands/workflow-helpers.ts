/**
 * Workflow Command — template table & stage/agent/duration helpers
 *
 * Module-private in the original workflow.ts (campaign-2 W278); NOT
 * re-exported.
 */

import { output } from '../output.js';

export const WORKFLOW_TEMPLATES = [
  { value: 'development', label: 'Development', hint: 'Standard development workflow' },
  { value: 'research', label: 'Research', hint: 'Research and analysis workflow' },
  { value: 'testing', label: 'Testing', hint: 'Comprehensive testing workflow' },
  { value: 'security-audit', label: 'Security Audit', hint: 'Security review workflow' },
  { value: 'code-review', label: 'Code Review', hint: 'Multi-agent code review' },
  { value: 'refactoring', label: 'Refactoring', hint: 'Code refactoring workflow' },
  { value: 'sparc', label: 'SPARC', hint: 'SPARC methodology workflow' },
  { value: 'custom', label: 'Custom', hint: 'Define custom workflow' }
];

// Run subcommand

export function formatStageStatus(status: unknown): string {
  const statusStr = String(status);
  switch (statusStr) {
    case 'completed':
    case 'success':
      return output.success(statusStr);
    case 'running':
    case 'in_progress':
      return output.highlight(statusStr);
    case 'pending':
    case 'waiting':
      return output.dim(statusStr);
    case 'failed':
    case 'error':
      return output.error(statusStr);
    case 'validated':
      return output.success(statusStr);
    default:
      return statusStr;
  }
}

export function getTemplateStages(template: string): string[] {
  const stages: Record<string, string[]> = {
    development: ['Planning', 'Implementation', 'Testing', 'Review', 'Integration'],
    research: ['Discovery', 'Analysis', 'Synthesis', 'Documentation'],
    testing: ['Unit Tests', 'Integration Tests', 'E2E Tests', 'Performance Tests'],
    'security-audit': ['Threat Model', 'Static Analysis', 'Dynamic Analysis', 'Report'],
    'code-review': ['Initial Review', 'Security Check', 'Quality Analysis', 'Feedback'],
    refactoring: ['Analysis', 'Planning', 'Refactor', 'Validation'],
    sparc: ['Specification', 'Pseudocode', 'Architecture', 'Refinement', 'Completion']
  };
  return stages[template] || ['Initialize', 'Execute', 'Complete'];
}

export function getTemplateAgents(template: string): string[] {
  const agents: Record<string, string[]> = {
    development: ['coder', 'tester', 'reviewer'],
    research: ['researcher', 'analyst'],
    testing: ['tester', 'coder'],
    'security-audit': ['security-architect', 'security-auditor'],
    'code-review': ['reviewer', 'security-auditor', 'analyst'],
    refactoring: ['architect', 'coder', 'reviewer'],
    sparc: ['architect', 'coder', 'tester', 'reviewer']
  };
  return agents[template] || ['coder'];
}

export function getTemplateDuration(template: string): string {
  const durations: Record<string, string> = {
    development: '15-30 min',
    research: '10-20 min',
    testing: '5-15 min',
    'security-audit': '20-40 min',
    'code-review': '10-25 min',
    refactoring: '15-35 min',
    sparc: '25-45 min'
  };
  return durations[template] || '10-20 min';
}


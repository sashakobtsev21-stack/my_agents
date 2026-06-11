/**
 * Task Command — type/priority tables & format helpers
 *
 * Module-private in the original task.ts (campaign-2 W262); NOT
 * re-exported.
 */

import { output } from '../output.js';

export const TASK_TYPES = [
  { value: 'implementation', label: 'Implementation', hint: 'Feature implementation' },
  { value: 'bug-fix', label: 'Bug Fix', hint: 'Fix a bug or issue' },
  { value: 'refactoring', label: 'Refactoring', hint: 'Code refactoring' },
  { value: 'testing', label: 'Testing', hint: 'Write or update tests' },
  { value: 'documentation', label: 'Documentation', hint: 'Documentation updates' },
  { value: 'research', label: 'Research', hint: 'Research and analysis' },
  { value: 'review', label: 'Review', hint: 'Code review' },
  { value: 'optimization', label: 'Optimization', hint: 'Performance optimization' },
  { value: 'security', label: 'Security', hint: 'Security audit or fix' },
  { value: 'custom', label: 'Custom', hint: 'Custom task type' }
];

// Task priorities
export const TASK_PRIORITIES = [
  { value: 'critical', label: 'Critical', hint: 'Highest priority' },
  { value: 'high', label: 'High', hint: 'Important task' },
  { value: 'normal', label: 'Normal', hint: 'Standard priority' },
  { value: 'low', label: 'Low', hint: 'Lower priority' }
];

// Format task status with color
export function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return output.success(status);
    case 'running':
    case 'in_progress':
      return output.info(status);
    case 'pending':
    case 'queued':
      return output.warning(status);
    case 'failed':
    case 'cancelled':
      return output.error(status);
    default:
      return status;
  }
}

// Format priority with color
export function formatPriority(priority: string): string {
  switch (priority) {
    case 'critical':
      return output.error(priority);
    case 'high':
      return output.warning(priority);
    case 'normal':
      return priority;
    case 'low':
      return output.dim(priority);
    default:
      return priority;
  }
}

// Create subcommand

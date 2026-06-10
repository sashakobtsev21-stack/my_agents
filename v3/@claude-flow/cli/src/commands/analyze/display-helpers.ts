/**
 * Pure display/formatting helpers for the analyze subcommands — path
 * truncation, complexity colour-coding, symbol type markers, and the
 * git-status / risk badges. Each depends only on the shared `output`
 * renderer; no analysis logic, no I/O.
 *
 * Extracted from analyze.ts (W72, P3.5 cut #1).
 */
import { output } from '../../output.js';

/**
 * Helper: Truncate file path for display
 */
export function truncatePathAst(filePath: string, maxLen: number = 45): string {
  if (filePath.length <= maxLen) return filePath;
  return '...' + filePath.slice(-(maxLen - 3));
}

/**
 * Helper: Format complexity value with color coding
 */
export function formatComplexityValueAst(value: number): string {
  if (value <= 5) return output.success(String(value));
  if (value <= 10) return output.warning(String(value));
  return output.error(String(value));
}

/**
 * Helper: Get type marker for symbols
 */
export function getTypeMarkerAst(type: string): string {
  switch (type) {
    case 'function': return output.success('fn');
    case 'class': return output.info('class');
    case 'variable': return output.dim('var');
    case 'type': return output.highlight('type');
    case 'interface': return output.highlight('iface');
    default: return output.dim(type.slice(0, 5));
  }
}

/**
 * Helper: Get complexity rating text
 */
export function getComplexityRatingAst(value: number): string {
  if (value <= 5) return output.success('Simple');
  if (value <= 10) return output.warning('Moderate');
  if (value <= 20) return output.error('Complex');
  return output.error(output.bold('Very Complex'));
}

export function getRiskDisplay(risk: string): string {
  switch (risk) {
    case 'critical':
      return output.color(output.bold('CRITICAL'), 'bgRed' as never, 'white' as never);
    case 'high-risk':
      return output.error('HIGH');
    case 'medium-risk':
      return output.warning('MEDIUM');
    case 'low-risk':
      return output.success('LOW');
    default:
      return risk;
  }
}

export function getStatusDisplay(status: string): string {
  switch (status) {
    case 'added':
      return output.success('A');
    case 'modified':
      return output.warning('M');
    case 'deleted':
      return output.error('D');
    case 'renamed':
      return output.info('R');
    default:
      return status;
  }
}

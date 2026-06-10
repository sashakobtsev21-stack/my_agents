/**
 * Shared helpers for the agent subcommands — swarm-activity metrics
 * writer, the AGENT_TYPES catalogue, status/health/log formatters, and
 * the per-type capability lookup.
 *
 * Extracted from agent.ts (W135, P3.20 cut #1).
 */
import { output } from '../../output.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Update swarm-activity.json metrics after agent count changes.
 * The statusline reads this file to display the swarm agent count.
 */
export function updateSwarmActivityMetrics(agentCountDelta: number): void {
  try {
    const metricsDir = path.join(process.cwd(), '.claude-flow', 'metrics');
    const activityPath = path.join(metricsDir, 'swarm-activity.json');

    let data: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      swarm: { active: false, agent_count: 0, coordination_active: false },
    };

    if (fs.existsSync(activityPath)) {
      data = JSON.parse(fs.readFileSync(activityPath, 'utf-8'));
    } else {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    const swarm = (data.swarm as Record<string, unknown>) ?? {};
    const currentCount = Math.max(0, (swarm.agent_count as number) || 0);
    const newCount = Math.max(0, currentCount + agentCountDelta);

    swarm.agent_count = newCount;
    swarm.active = newCount > 0;
    swarm.coordination_active = newCount > 0;
    data.swarm = swarm;
    data.timestamp = new Date().toISOString();

    fs.writeFileSync(activityPath, JSON.stringify(data, null, 2));
  } catch {
    // Non-critical — don't fail the command if metrics update fails
  }
}

// Available agent types with descriptions
export const AGENT_TYPES = [
  { value: 'coder', label: 'Coder', hint: 'Code development with neural patterns' },
  { value: 'researcher', label: 'Researcher', hint: 'Research with web access and data analysis' },
  { value: 'tester', label: 'Tester', hint: 'Comprehensive testing with automation' },
  { value: 'reviewer', label: 'Reviewer', hint: 'Code review with security and quality checks' },
  { value: 'architect', label: 'Architect', hint: 'System design with enterprise patterns' },
  { value: 'coordinator', label: 'Coordinator', hint: 'Multi-agent orchestration and workflow' },
  { value: 'analyst', label: 'Analyst', hint: 'Performance analysis and optimization' },
  { value: 'optimizer', label: 'Optimizer', hint: 'Performance optimization and bottleneck analysis' },
  { value: 'security-architect', label: 'Security Architect', hint: 'Security architecture and threat modeling' },
  { value: 'security-auditor', label: 'Security Auditor', hint: 'CVE remediation and security testing' },
  { value: 'memory-specialist', label: 'Memory Specialist', hint: 'AgentDB unification (~1.9x-4.7x (measured))' },
  { value: 'swarm-specialist', label: 'Swarm Specialist', hint: 'Unified coordination engine' },
  { value: 'performance-engineer', label: 'Performance Engineer', hint: 'attention optimization (unverified)' },
  { value: 'core-architect', label: 'Core Architect', hint: 'Domain-driven design restructure' },
  { value: 'test-architect', label: 'Test Architect', hint: 'TDD London School methodology' }
];

// Agent spawn subcommand
export function formatHealthStatus(health: unknown): string {
  const h = String(health);
  switch (h) {
    case 'healthy':
      return output.success(h);
    case 'degraded':
      return output.warning(h);
    case 'unhealthy':
      return output.error(h);
    default:
      return h;
  }
}

export function formatLogLevel(level: string): string {
  switch (level) {
    case 'debug':
      return output.dim('[DEBUG]');
    case 'info':
      return '[INFO] ';
    case 'warn':
      return output.warning('[WARN] ');
    case 'error':
      return output.error('[ERROR]');
    default:
      return `[${level.toUpperCase()}]`;
  }
}
export function getAgentCapabilities(type: string): string[] {
  const capabilities: Record<string, string[]> = {
    coder: ['code-generation', 'refactoring', 'debugging', 'testing'],
    researcher: ['web-search', 'data-analysis', 'summarization', 'citation'],
    tester: ['unit-testing', 'integration-testing', 'coverage-analysis', 'automation'],
    reviewer: ['code-review', 'security-audit', 'quality-check', 'documentation'],
    architect: ['system-design', 'pattern-analysis', 'scalability', 'documentation'],
    coordinator: ['task-orchestration', 'agent-management', 'workflow-control'],
    'security-architect': ['threat-modeling', 'security-patterns', 'compliance', 'audit'],
    'memory-specialist': ['vector-search', 'agentdb', 'caching', 'optimization'],
    'performance-engineer': ['benchmarking', 'profiling', 'optimization', 'monitoring']
  };

  return capabilities[type] || ['general'];
}

export function formatStatus(status: unknown): string {
  const statusStr = String(status);
  switch (statusStr) {
    case 'active':
      return output.success(statusStr);
    case 'idle':
      return output.warning(statusStr);
    case 'inactive':
    case 'stopped':
      return output.dim(statusStr);
    case 'error':
      return output.error(statusStr);
    default:
      return statusStr;
  }
}

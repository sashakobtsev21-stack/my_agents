/**
 * Swarm Command — status helper, topology/strategy tables & agent plans
 *
 * getSwarmStatus, TOPOLOGIES/STRATEGIES, getAgentPlan. Module-private in
 * the original swarm.ts (campaign-2 W221); NOT re-exported.
 */

import * as fs from 'fs';
import * as path from 'path';

export function getSwarmStatus(swarmId?: string) {
  const swarmDir = path.join(process.cwd(), '.swarm');
  const memoryPaths = [
    path.join(process.cwd(), '.swarm', 'memory.db'),
    path.join(process.cwd(), '.claude', 'memory.db'),
  ];

  // Check for active swarm state file
  const swarmStateFile = path.join(swarmDir, 'state.json');
  let swarmState: Record<string, unknown> | null = null;

  if (fs.existsSync(swarmStateFile)) {
    try {
      swarmState = JSON.parse(fs.readFileSync(swarmStateFile, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  // Count active agents from process files
  let activeAgents = 0;
  let totalAgents = 0;
  const agentsDir = path.join(swarmDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    try {
      const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
      totalAgents = agentFiles.length;
      for (const file of agentFiles) {
        try {
          const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, file), 'utf-8'));
          if (agent.status === 'active' || agent.status === 'running') {
            activeAgents++;
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore
    }
  }

  // Dead-code from an earlier swarm-status surface (#TBD): we read
  // session count + memory DB size off disk but never reported them.
  // The renderer below only uses the task counts, so we don't bother
  // reading either back.

  // Probe the memory DB for activity — the assignment is the side
  // effect we care about (warming the FS cache); the size value
  // itself is intentionally ignored.
  for (const dbPath of memoryPaths) {
    if (fs.existsSync(dbPath)) {
      try {
        fs.statSync(dbPath).size;
        break;
      } catch {
        // Ignore
      }
    }
  }

  // Count task files if they exist
  let completedTasks = 0;
  let inProgressTasks = 0;
  let pendingTasks = 0;
  const tasksDir = path.join(swarmDir, 'tasks');
  if (fs.existsSync(tasksDir)) {
    try {
      const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
      for (const file of taskFiles) {
        try {
          const task = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf-8'));
          if (task.status === 'completed' || task.status === 'done') {
            completedTasks++;
          } else if (task.status === 'in_progress' || task.status === 'running') {
            inProgressTasks++;
          } else {
            pendingTasks++;
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore
    }
  }

  // Calculate dynamic progress based on actual state
  // If no swarm state, show 0%. Otherwise calculate from completed tasks
  const totalTasks = completedTasks + inProgressTasks + pendingTasks;
  let progress = 0;
  if (totalTasks > 0) {
    progress = Math.round((completedTasks / totalTasks) * 100);
  } else if (swarmState) {
    // Swarm initialized but no tasks yet
    progress = 5;
  }

  // Determine status
  let status = 'idle';
  if (inProgressTasks > 0 || activeAgents > 0) {
    status = 'running';
  } else if (completedTasks > 0 && pendingTasks === 0 && inProgressTasks === 0) {
    status = 'completed';
  } else if (swarmState) {
    status = 'ready';
  }

  return {
    id: swarmId || (swarmState as Record<string, string>)?.id || 'no-active-swarm',
    topology: (swarmState as Record<string, string>)?.topology || 'none',
    status,
    objective: (swarmState as Record<string, string>)?.objective || 'No active objective',
    strategy: (swarmState as Record<string, string>)?.strategy || 'none',
    agents: {
      total: totalAgents,
      active: activeAgents,
      idle: Math.max(0, totalAgents - activeAgents),
      completed: 0
    },
    progress,
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      pending: pendingTasks
    },
    metrics: {
      tokensUsed: (swarmState as Record<string, unknown>)?.tokensUsed as number | null ?? null,
      avgResponseTime: (() => {
        // Calculate average response time from task files with startedAt/completedAt
        const taskTimesMs: number[] = [];
        if (fs.existsSync(tasksDir)) {
          try {
            const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
            for (const file of taskFiles) {
              try {
                const task = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf-8'));
                if (task.startedAt && task.completedAt) {
                  const elapsed = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
                  if (elapsed > 0) taskTimesMs.push(elapsed);
                }
              } catch { /* skip malformed task files */ }
            }
          } catch { /* skip if dir unreadable */ }
        }
        if (taskTimesMs.length === 0) return null;
        const avgMs = Math.round(taskTimesMs.reduce((a, b) => a + b, 0) / taskTimesMs.length);
        return avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`;
      })(),
      successRate: totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : null,
      elapsedTime: (() => {
        // Calculate from swarm startedAt in state.json
        const startedAt = (swarmState as Record<string, unknown>)?.startedAt as string | undefined
          || (swarmState as Record<string, unknown>)?.initializedAt as string | undefined;
        if (!startedAt) return null;
        const elapsedMs = Date.now() - new Date(startedAt).getTime();
        if (elapsedMs < 0) return null;
        const secs = Math.floor(elapsedMs / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        if (mins < 60) return `${mins}m ${remSecs}s`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m`;
      })()
    },
    coordination: (() => {
      // Read real coordination counts from .swarm/coordination/ directory
      const coordDir = path.join(swarmDir, 'coordination');
      let consensusRounds = 0;
      let messagesSent = 0;
      let conflictsResolved = 0;
      if (fs.existsSync(coordDir)) {
        try {
          const coordFiles = fs.readdirSync(coordDir).filter(f => f.endsWith('.json'));
          for (const file of coordFiles) {
            try {
              const entry = JSON.parse(fs.readFileSync(path.join(coordDir, file), 'utf-8'));
              if (entry.type === 'consensus') consensusRounds++;
              else if (entry.type === 'message') messagesSent++;
              else if (entry.type === 'conflict' || entry.type === 'conflict-resolution') conflictsResolved++;
              // Also aggregate pre-counted fields if present
              if (typeof entry.consensusRounds === 'number') consensusRounds += entry.consensusRounds;
              if (typeof entry.messagesSent === 'number') messagesSent += entry.messagesSent;
              if (typeof entry.conflictsResolved === 'number') conflictsResolved += entry.conflictsResolved;
            } catch { /* skip malformed coordination files */ }
          }
        } catch { /* skip if dir unreadable */ }
      }
      // Also check state.json for aggregate coordination stats
      if (swarmState) {
        const coord = (swarmState as Record<string, unknown>).coordination as Record<string, number> | undefined;
        if (coord) {
          if (typeof coord.consensusRounds === 'number') consensusRounds += coord.consensusRounds;
          if (typeof coord.messagesSent === 'number') messagesSent += coord.messagesSent;
          if (typeof coord.conflictsResolved === 'number') conflictsResolved += coord.conflictsResolved;
        }
      }
      return { consensusRounds, messagesSent, conflictsResolved };
    })(),
    hasActiveSwarm: !!swarmState || totalAgents > 0
  };
}

// Swarm topologies
export const TOPOLOGIES = [
  { value: 'hierarchical', label: 'Hierarchical', hint: 'Queen-led coordination with worker agents' },
  { value: 'mesh', label: 'Mesh', hint: 'Fully connected peer-to-peer network' },
  { value: 'ring', label: 'Ring', hint: 'Circular communication pattern' },
  { value: 'star', label: 'Star', hint: 'Central coordinator with spoke agents' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Hierarchical mesh for maximum flexibility' },
  { value: 'hierarchical-mesh', label: 'Hierarchical Mesh', hint: 'V3 15-agent queen + peer communication (recommended)' }
];

// Swarm strategies
export const STRATEGIES = [
  { value: 'specialized', label: 'Specialized', hint: 'Clear roles, no overlap (anti-drift)' },
  { value: 'balanced', label: 'Balanced', hint: 'Even distribution of work' },
  { value: 'adaptive', label: 'Adaptive', hint: 'Dynamic strategy based on task' },
  { value: 'research', label: 'Research', hint: 'Distributed research and analysis' },
  { value: 'development', label: 'Development', hint: 'Collaborative code development' },
  { value: 'testing', label: 'Testing', hint: 'Comprehensive test coverage' },
  { value: 'optimization', label: 'Optimization', hint: 'Performance optimization' },
  { value: 'maintenance', label: 'Maintenance', hint: 'Codebase maintenance and refactoring' },
  { value: 'analysis', label: 'Analysis', hint: 'Code analysis and documentation' }
];

// Initialize swarm

export function getAgentPlan(strategy: string): Array<{ role: string; type: string; count: number; purpose: string }> {
  const plans: Record<string, Array<{ role: string; type: string; count: number; purpose: string }>> = {
    specialized: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Central orchestration (anti-drift)' },
      { role: 'Researcher', type: 'researcher', count: 1, purpose: 'Requirements analysis' },
      { role: 'Architect', type: 'architect', count: 1, purpose: 'System design' },
      { role: 'Coder', type: 'coder', count: 2, purpose: 'Implementation' },
      { role: 'Tester', type: 'tester', count: 1, purpose: 'Quality assurance' },
      { role: 'Reviewer', type: 'reviewer', count: 1, purpose: 'Code review' }
    ],
    balanced: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Orchestrate workflow' },
      { role: 'Worker', type: 'coder', count: 4, purpose: 'General implementation' },
      { role: 'Reviewer', type: 'reviewer', count: 1, purpose: 'Quality review' }
    ],
    adaptive: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Dynamic orchestration' },
      { role: 'Scout', type: 'researcher', count: 1, purpose: 'Task analysis' },
      { role: 'Worker', type: 'coder', count: 3, purpose: 'Adaptive execution' }
    ],
    development: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Orchestrate workflow' },
      { role: 'Architect', type: 'architect', count: 1, purpose: 'System design' },
      { role: 'Coder', type: 'coder', count: 3, purpose: 'Implementation' },
      { role: 'Tester', type: 'tester', count: 2, purpose: 'Quality assurance' },
      { role: 'Reviewer', type: 'reviewer', count: 1, purpose: 'Code review' }
    ],
    research: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Research coordination' },
      { role: 'Researcher', type: 'researcher', count: 4, purpose: 'Data gathering' },
      { role: 'Analyst', type: 'analyst', count: 2, purpose: 'Analysis and synthesis' }
    ],
    testing: [
      { role: 'Test Lead', type: 'tester', count: 1, purpose: 'Test strategy' },
      { role: 'Unit Tester', type: 'tester', count: 2, purpose: 'Unit tests' },
      { role: 'Integration Tester', type: 'tester', count: 2, purpose: 'Integration tests' },
      { role: 'QA Reviewer', type: 'reviewer', count: 1, purpose: 'Quality review' }
    ],
    optimization: [
      { role: 'Performance Lead', type: 'optimizer', count: 1, purpose: 'Performance strategy' },
      { role: 'Profiler', type: 'analyst', count: 2, purpose: 'Profiling' },
      { role: 'Optimizer', type: 'coder', count: 2, purpose: 'Optimization' }
    ],
    maintenance: [
      { role: 'Coordinator', type: 'coordinator', count: 1, purpose: 'Maintenance planning' },
      { role: 'Refactorer', type: 'coder', count: 2, purpose: 'Code cleanup' },
      { role: 'Documenter', type: 'researcher', count: 1, purpose: 'Documentation' }
    ],
    analysis: [
      { role: 'Analyst Lead', type: 'analyst', count: 1, purpose: 'Analysis coordination' },
      { role: 'Code Analyst', type: 'analyst', count: 2, purpose: 'Code analysis' },
      { role: 'Security Analyst', type: 'reviewer', count: 1, purpose: 'Security review' }
    ]
  };

  return plans[strategy] || plans.development;
}


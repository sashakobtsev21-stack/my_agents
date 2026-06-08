/**
 * Unit tests for AgentStateProjection — the read-model that folds the
 * agent-event stream into queryable per-agent state. Previously untested.
 * handle() doesn't touch the EventStore (only initialize() replays), so a stub
 * store is sufficient to exercise the projection logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentStateProjection } from '../src/events/projections.js';
import type { DomainEvent } from '../src/events/domain-events.js';
import type { EventStore } from '../src/events/event-store.js';

const stubStore = {} as unknown as EventStore;

let seq = 0;
function evt(type: string, payload: Record<string, unknown>, timestamp = 1000): DomainEvent {
  return {
    id: `e${++seq}`,
    type,
    aggregateId: (payload.agentId as string) ?? 'agg',
    aggregateType: 'agent',
    version: ++seq,
    timestamp,
    source: 'swarm',
    payload,
  };
}

let proj: AgentStateProjection;
beforeEach(() => {
  proj = new AgentStateProjection(stubStore);
});

describe('spawn + queries', () => {
  it('agent:spawned creates an idle agent', async () => {
    await proj.handle(evt('agent:spawned', { agentId: 'a1', role: 'coder', domain: 'core' }));
    const a = proj.getAgent('a1');
    expect(a).not.toBeNull();
    expect(a!.status).toBe('idle');
    expect(a!.role).toBe('coder');
    expect(a!.domain).toBe('core');
    expect(a!.completedTasks).toEqual([]);
  });

  it('getAgent returns null for an unknown id', () => {
    expect(proj.getAgent('missing')).toBeNull();
  });

  it('events for an unspawned agent are no-ops', async () => {
    await proj.handle(evt('agent:started', { agentId: 'ghost' }));
    expect(proj.getAgent('ghost')).toBeNull();
  });

  it('ignores unknown event types', async () => {
    await proj.handle(evt('agent:unknown', { agentId: 'a1' }));
    expect(proj.getAllAgents()).toHaveLength(0);
  });
});

describe('lifecycle transitions', () => {
  beforeEach(async () => {
    await proj.handle(evt('agent:spawned', { agentId: 'a1', role: 'coder', domain: 'core' }));
  });

  it('started -> active with startedAt', async () => {
    await proj.handle(evt('agent:started', { agentId: 'a1' }, 2000));
    const a = proj.getAgent('a1')!;
    expect(a.status).toBe('active');
    expect(a.startedAt).toBe(2000);
  });

  it('task-assigned sets currentTask + active', async () => {
    await proj.handle(evt('agent:task-assigned', { agentId: 'a1', taskId: 't1' }));
    const a = proj.getAgent('a1')!;
    expect(a.currentTask).toBe('t1');
    expect(a.status).toBe('active');
  });

  it('task-completed records the task, accumulates duration, returns to idle', async () => {
    await proj.handle(evt('agent:task-assigned', { agentId: 'a1', taskId: 't1' }));
    await proj.handle(evt('agent:task-completed', { agentId: 'a1', taskId: 't1', duration: 120 }));
    const a = proj.getAgent('a1')!;
    expect(a.completedTasks).toEqual(['t1']);
    expect(a.currentTask).toBeNull();
    expect(a.taskCount).toBe(1);
    expect(a.totalTaskDuration).toBe(120);
    expect(a.status).toBe('idle');
  });

  it('failed -> error and increments errorCount', async () => {
    await proj.handle(evt('agent:failed', { agentId: 'a1' }));
    const a = proj.getAgent('a1')!;
    expect(a.status).toBe('error');
    expect(a.errorCount).toBe(1);
  });

  it('stopped -> completed with stoppedAt', async () => {
    await proj.handle(evt('agent:stopped', { agentId: 'a1' }, 3000));
    const a = proj.getAgent('a1')!;
    expect(a.status).toBe('completed');
    expect(a.stoppedAt).toBe(3000);
  });

  it('status-changed applies the new status', async () => {
    await proj.handle(evt('agent:status-changed', { agentId: 'a1', newStatus: 'paused' }));
    expect(proj.getAgent('a1')!.status).toBe('paused');
  });
});

describe('aggregate queries', () => {
  beforeEach(async () => {
    await proj.handle(evt('agent:spawned', { agentId: 'a1', role: 'coder', domain: 'core' }));
    await proj.handle(evt('agent:spawned', { agentId: 'a2', role: 'tester', domain: 'qa' }));
    await proj.handle(evt('agent:spawned', { agentId: 'a3', role: 'coder', domain: 'core' }));
    await proj.handle(evt('agent:started', { agentId: 'a1' }));
    await proj.handle(evt('agent:started', { agentId: 'a2' }));
  });

  it('getAllAgents returns every projected agent', () => {
    expect(proj.getAllAgents()).toHaveLength(3);
  });

  it('getAgentsByStatus filters by status', () => {
    expect(proj.getAgentsByStatus('active').map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    expect(proj.getAgentsByStatus('idle').map((a) => a.id)).toEqual(['a3']);
  });

  it('getActiveAgentCount counts active agents', () => {
    expect(proj.getActiveAgentCount()).toBe(2);
  });

  it('getAgentsByDomain filters by domain', () => {
    expect(proj.getAgentsByDomain('core').map((a) => a.id).sort()).toEqual(['a1', 'a3']);
  });

  it('reset clears all projected state', () => {
    proj.reset();
    expect(proj.getAllAgents()).toHaveLength(0);
  });
});

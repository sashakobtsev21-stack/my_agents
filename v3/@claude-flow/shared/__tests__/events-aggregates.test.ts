/**
 * Unit tests for the event-sourcing aggregates (AgentAggregate / TaskAggregate)
 * in state-reconstructor. These are the pure reducers that rebuild entity state
 * from a domain-event stream — core to the repo's "event sourcing for state
 * changes" rule — and were previously untested.
 */
import { describe, it, expect } from 'vitest';
import { AgentAggregate, TaskAggregate } from '../src/events/state-reconstructor.js';
import type { DomainEvent } from '../src/events/domain-events.js';

let seq = 0;
function evt(
  type: string,
  version: number,
  payload: Record<string, unknown> = {},
  timestamp = 1_700_000_000_000,
): DomainEvent {
  return {
    id: `e${++seq}`,
    type,
    aggregateId: 'agg-1',
    aggregateType: type.startsWith('agent') ? 'agent' : 'task',
    version,
    timestamp,
    source: 'swarm',
    payload,
  };
}

describe('AgentAggregate', () => {
  it('agent:spawned sets identity + idle status + createdAt', () => {
    const a = new AgentAggregate('agg-1');
    a.apply(evt('agent:spawned', 1, { name: 'A', role: 'coder', capabilities: ['ts'] }));
    expect(a.name).toBe('A');
    expect(a.role).toBe('coder');
    expect(a.capabilities).toEqual(['ts']);
    expect(a.status).toBe('idle');
    expect(a.version).toBe(1);
    expect((a.getState().createdAt as Date) instanceof Date).toBe(true);
  });

  it('drives the full lifecycle to the right end state', () => {
    const a = new AgentAggregate('agg-1');
    a.apply(evt('agent:spawned', 1, { name: 'A', role: 'coder' }));
    a.apply(evt('agent:started', 2));
    expect(a.status).toBe('active');
    a.apply(evt('agent:task-assigned', 3, { taskId: 't1' }));
    expect(a.status).toBe('busy');
    expect(a.currentTask).toBe('t1');
    a.apply(evt('agent:task-completed', 4, { taskId: 't1' }));
    expect(a.status).toBe('active');
    expect(a.currentTask).toBeNull();
    expect(a.completedTasks).toEqual(['t1']);
    a.apply(evt('agent:terminated', 5));
    expect(a.status).toBe('terminated');
    expect(a.version).toBe(5);
  });

  it('defaults capabilities to [] when omitted', () => {
    const a = new AgentAggregate('agg-1');
    a.apply(evt('agent:spawned', 1, { name: 'A', role: 'coder' }));
    expect(a.capabilities).toEqual([]);
  });

  it('getters return defensive copies', () => {
    const a = new AgentAggregate('agg-1');
    a.apply(evt('agent:spawned', 1, { name: 'A', role: 'coder', capabilities: ['ts'] }));
    a.capabilities.push('mutated');
    expect(a.capabilities).toEqual(['ts']);
  });

  it('ignores unknown event types but still advances version', () => {
    const a = new AgentAggregate('agg-1');
    a.apply(evt('agent:unknown', 7));
    expect(a.version).toBe(7);
    expect(a.status).toBe('idle');
  });

  it('restoreFromSnapshot rehydrates dates', () => {
    const a = new AgentAggregate('agg-1');
    a.restoreFromSnapshot({
      name: 'B',
      role: 'tester',
      status: 'active',
      currentTask: null,
      completedTasks: ['x'],
      capabilities: [],
      createdAt: '2020-01-01T00:00:00.000Z',
      lastActiveAt: null,
    });
    expect(a.name).toBe('B');
    expect(a.completedTasks).toEqual(['x']);
    expect((a.getState().createdAt as Date) instanceof Date).toBe(true);
  });
});

describe('TaskAggregate', () => {
  it('task:created sets fields + pending status', () => {
    const t = new TaskAggregate('agg-1');
    t.apply(evt('task:created', 1, { title: 'T', description: 'd', taskType: 'build', priority: 'high' }));
    expect(t.title).toBe('T');
    expect(t.status).toBe('pending');
    expect(t.getState().priority).toBe('high');
  });

  it('created -> started -> completed carries assignment + result', () => {
    const t = new TaskAggregate('agg-1');
    t.apply(evt('task:created', 1, { title: 'T', description: 'd', taskType: 'build' }));
    t.apply(evt('task:started', 2, { agentId: 'a1' }));
    expect(t.status).toBe('running');
    expect(t.assignedAgent).toBe('a1');
    t.apply(evt('task:completed', 3, { result: { ok: true } }));
    expect(t.status).toBe('completed');
    expect(t.result).toEqual({ ok: true });
    expect(t.version).toBe(3);
  });

  it('task:failed and task:cancelled set terminal status', () => {
    const failed = new TaskAggregate('agg-1');
    failed.apply(evt('task:created', 1, { title: 'T', description: 'd', taskType: 'x' }));
    failed.apply(evt('task:failed', 2));
    expect(failed.status).toBe('failed');

    const cancelled = new TaskAggregate('agg-2');
    cancelled.apply(evt('task:created', 1, { title: 'T', description: 'd', taskType: 'x' }));
    cancelled.apply(evt('task:cancelled', 2));
    expect(cancelled.status).toBe('cancelled');
  });

  it('defaults priority to normal when omitted', () => {
    const t = new TaskAggregate('agg-1');
    t.apply(evt('task:created', 1, { title: 'T', description: 'd', taskType: 'x' }));
    expect(t.getState().priority).toBe('normal');
  });
});

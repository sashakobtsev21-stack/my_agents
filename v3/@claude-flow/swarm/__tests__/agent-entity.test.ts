/**
 * Unit tests for the Agent domain entity (DDD aggregate root).
 *
 * This is core swarm state-machine logic (lifecycle transitions, task
 * capacity, capabilities, utilization) that was previously uncovered.
 */
import { describe, it, expect } from 'vitest';
import { Agent, type AgentProps } from '../src/domain/entities/agent.js';

function makeAgent(overrides: Partial<AgentProps> = {}): Agent {
  return Agent.create({
    name: 'a1',
    role: 'coder',
    domain: 'core',
    capabilities: ['ts'],
    ...overrides,
  });
}

describe('Agent.create / defaults', () => {
  it('applies sensible defaults', () => {
    const a = makeAgent();
    expect(a.id).toBeTruthy();
    expect(a.status).toBe('idle');
    expect(a.maxConcurrentTasks).toBe(3);
    expect(a.currentTaskCount).toBe(0);
    expect(a.completedTaskCount).toBe(0);
    expect(a.capabilities).toEqual(['ts']);
  });

  it('honors provided id and status', () => {
    const a = makeAgent({ id: 'fixed-id', status: 'active', maxConcurrentTasks: 1 });
    expect(a.id).toBe('fixed-id');
    expect(a.status).toBe('active');
    expect(a.maxConcurrentTasks).toBe(1);
  });

  it('returns defensive copies from getters', () => {
    const a = makeAgent();
    a.capabilities.push('mutated');
    expect(a.capabilities).toEqual(['ts']); // internal Set unaffected
    const md = a.metadata;
    md.x = 1;
    expect(a.metadata).toEqual({});
  });
});

describe('lifecycle transitions', () => {
  it('start: idle -> active', () => {
    const a = makeAgent();
    a.start();
    expect(a.status).toBe('active');
  });

  it('start throws on terminated', () => {
    const a = makeAgent();
    a.terminate();
    expect(() => a.start()).toThrow(/terminated/i);
  });

  it('pause only from active/busy', () => {
    const a = makeAgent();
    expect(() => a.pause()).toThrow(/active or busy/i);
    a.start();
    a.pause();
    expect(a.status).toBe('paused');
  });

  it('resume restores active (no tasks) or busy (with tasks)', () => {
    const a = makeAgent();
    a.start();
    a.pause();
    a.resume();
    expect(a.status).toBe('active');

    const b = makeAgent();
    b.start();
    b.assignTask('t1');
    b.pause();
    b.resume();
    expect(b.status).toBe('busy');
  });

  it('resume throws when not paused', () => {
    const a = makeAgent();
    expect(() => a.resume()).toThrow(/paused/i);
  });

  it('terminate clears current tasks', () => {
    const a = makeAgent();
    a.start();
    a.assignTask('t1');
    a.terminate();
    expect(a.status).toBe('terminated');
    expect(a.currentTaskCount).toBe(0);
  });

  it('setError records message; recover only from error', () => {
    const a = makeAgent();
    a.setError('boom');
    expect(a.status).toBe('error');
    expect(a.metadata.lastError).toBe('boom');
    a.recover();
    expect(a.status).toBe('idle');
    expect(a.metadata.lastError).toBeUndefined();
    expect(() => a.recover()).toThrow(/error state/i);
  });
});

describe('task management', () => {
  it('assignTask adds a task and flips to busy', () => {
    const a = makeAgent();
    a.assignTask('t1');
    expect(a.status).toBe('busy');
    expect(a.currentTaskIds).toEqual(['t1']);
  });

  it('enforces max concurrent capacity', () => {
    const a = makeAgent({ maxConcurrentTasks: 2 });
    a.assignTask('t1');
    a.assignTask('t2');
    expect(() => a.assignTask('t3')).toThrow(/maximum concurrent/i);
  });

  it('cannot assign to terminated', () => {
    const a = makeAgent();
    a.terminate();
    expect(() => a.assignTask('t1')).toThrow(/terminated/i);
  });

  it('completeTask increments count and returns to active when empty', () => {
    const a = makeAgent();
    a.assignTask('t1');
    a.assignTask('t2');
    a.completeTask('t1');
    expect(a.status).toBe('busy');
    expect(a.completedTaskCount).toBe(1);
    a.completeTask('t2');
    expect(a.status).toBe('active');
    expect(a.completedTaskCount).toBe(2);
  });

  it('completeTask throws for an unassigned task', () => {
    const a = makeAgent();
    expect(() => a.completeTask('nope')).toThrow(/not assigned/i);
  });
});

describe('queries', () => {
  it('canAcceptTask reflects state + capacity', () => {
    const a = makeAgent({ maxConcurrentTasks: 1 });
    expect(a.canAcceptTask()).toBe(true);
    a.assignTask('t1');
    expect(a.canAcceptTask()).toBe(false); // at capacity
    const b = makeAgent();
    b.setError();
    expect(b.canAcceptTask()).toBe(false);
  });

  it('getUtilization = current / max', () => {
    const a = makeAgent({ maxConcurrentTasks: 4 });
    a.assignTask('t1');
    a.assignTask('t2');
    expect(a.getUtilization()).toBe(0.5);
  });

  it('isAvailable: idle, or active with spare capacity', () => {
    const idle = makeAgent();
    expect(idle.isAvailable()).toBe(true);
    const active = makeAgent({ status: 'active' });
    expect(active.isAvailable()).toBe(true);
    const paused = makeAgent({ status: 'paused' });
    expect(paused.isAvailable()).toBe(false);
  });

  it('capability add/remove/has', () => {
    const a = makeAgent({ capabilities: [] });
    expect(a.hasCapability('go')).toBe(false);
    a.addCapability('go');
    expect(a.hasCapability('go')).toBe(true);
    a.removeCapability('go');
    expect(a.hasCapability('go')).toBe(false);
  });

  it('isChildOf', () => {
    const a = makeAgent({ parentId: 'queen-1' });
    expect(a.isChildOf('queen-1')).toBe(true);
    expect(a.isChildOf('other')).toBe(false);
  });
});

describe('serialization', () => {
  it('toPersistence round-trips the data fields via fromPersistence', () => {
    const a = makeAgent({ id: 'x1', parentId: 'p1', capabilities: ['ts', 'go'] });
    a.assignTask('t1');
    a.completeTask('t1');
    const snap = a.toPersistence();
    expect(snap).toMatchObject({
      id: 'x1',
      name: 'a1',
      role: 'coder',
      domain: 'core',
      parentId: 'p1',
      completedTaskCount: 1,
    });

    const restored = Agent.fromPersistence({
      ...(snap as unknown as AgentProps),
      capabilities: snap.capabilities as string[],
    });
    expect(restored.id).toBe('x1');
    expect(restored.capabilities.sort()).toEqual(['go', 'ts']);
    expect(restored.completedTaskCount).toBe(1);
  });

  it('toJSON equals toPersistence', () => {
    const a = makeAgent();
    expect(a.toJSON()).toEqual(a.toPersistence());
  });
});

/**
 * Unit tests for TaskHistoryProjection and MemoryIndexProjection read-models.
 * Previously untested. handle() doesn't touch the EventStore, so a stub store
 * is enough to exercise the projection logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskHistoryProjection, MemoryIndexProjection } from '../src/events/projections.js';
import type { DomainEvent } from '../src/events/domain-events.js';
import type { EventStore } from '../src/events/event-store.js';

const stubStore = {} as unknown as EventStore;
let seq = 0;
function evt(type: string, payload: Record<string, unknown>, timestamp = 1000): DomainEvent {
  return {
    id: `e${++seq}`,
    type,
    aggregateId: (payload.taskId ?? payload.memoryId ?? 'agg') as string,
    aggregateType: type.startsWith('task') ? 'task' : 'memory',
    version: ++seq,
    timestamp,
    source: 'swarm',
    payload,
  };
}

describe('TaskHistoryProjection', () => {
  let proj: TaskHistoryProjection;
  beforeEach(() => {
    proj = new TaskHistoryProjection(stubStore);
  });

  it('created -> started -> completed carries agent, duration and result', async () => {
    await proj.handle(evt('task:created', { taskId: 't1', taskType: 'build', title: 'T', priority: 'high' }, 100));
    expect(proj.getTask('t1')!.status).toBe('pending');
    await proj.handle(evt('task:started', { taskId: 't1', agentId: 'a1' }, 200));
    expect(proj.getTask('t1')!.status).toBe('in-progress');
    expect(proj.getTask('t1')!.assignedAgent).toBe('a1');
    await proj.handle(evt('task:completed', { taskId: 't1', result: { ok: 1 }, duration: 50 }, 300));
    const t = proj.getTask('t1')!;
    expect(t.status).toBe('completed');
    expect(t.duration).toBe(50);
    expect(t.result).toEqual({ ok: 1 });
  });

  it('failed sets error + retryCount; blocked sets blockedBy', async () => {
    await proj.handle(evt('task:created', { taskId: 't1', taskType: 'x', title: 'T', priority: 'low' }));
    await proj.handle(evt('task:failed', { taskId: 't1', error: 'boom', retryCount: 2 }));
    expect(proj.getTask('t1')!.status).toBe('failed');
    expect(proj.getTask('t1')!.error).toBe('boom');
    expect(proj.getTask('t1')!.retryCount).toBe(2);

    await proj.handle(evt('task:created', { taskId: 't2', taskType: 'x', title: 'T2', priority: 'low' }));
    await proj.handle(evt('task:blocked', { taskId: 't2', blockedBy: ['t1'] }));
    expect(proj.getTask('t2')!.status).toBe('blocked');
    expect(proj.getTask('t2')!.blockedBy).toEqual(['t1']);
  });

  it('queues, queries, and averages durations', async () => {
    await proj.handle(evt('task:created', { taskId: 't1', taskType: 'x', title: 'A', priority: 'low' }));
    await proj.handle(evt('task:queued', { taskId: 't1' }));
    expect(proj.getTask('t1')!.status).toBe('queued');

    await proj.handle(evt('task:created', { taskId: 't2', taskType: 'x', title: 'B', priority: 'low' }));
    await proj.handle(evt('task:started', { taskId: 't2', agentId: 'a1' }));
    await proj.handle(evt('task:completed', { taskId: 't2', duration: 100 }));
    await proj.handle(evt('task:created', { taskId: 't3', taskType: 'x', title: 'C', priority: 'low' }));
    await proj.handle(evt('task:started', { taskId: 't3', agentId: 'a1' }));
    await proj.handle(evt('task:completed', { taskId: 't3', duration: 200 }));

    expect(proj.getAllTasks()).toHaveLength(3);
    expect(proj.getCompletedTaskCount()).toBe(2);
    expect(proj.getTasksByStatus('queued').map((t) => t.id)).toEqual(['t1']);
    expect(proj.getTasksByAgent('a1').map((t) => t.id).sort()).toEqual(['t2', 't3']);
    expect(proj.getAverageTaskDuration()).toBe(150);
  });

  it('events for an unknown task are no-ops; reset clears', async () => {
    await proj.handle(evt('task:started', { taskId: 'ghost', agentId: 'a1' }));
    expect(proj.getTask('ghost')).toBeNull();
    await proj.handle(evt('task:created', { taskId: 't1', taskType: 'x', title: 'A', priority: 'low' }));
    proj.reset();
    expect(proj.getAllTasks()).toHaveLength(0);
  });
});

describe('MemoryIndexProjection', () => {
  let proj: MemoryIndexProjection;
  beforeEach(() => {
    proj = new MemoryIndexProjection(stubStore);
  });

  async function store(id: string, ns: string, size: number) {
    await proj.handle(evt('memory:stored', { memoryId: id, namespace: ns, key: id, memoryType: 'kv', size }));
  }

  it('stored registers an active memory', async () => {
    await store('m1', 'ns1', 10);
    const m = proj.getMemory('m1')!;
    expect(m.isDeleted).toBe(false);
    expect(m.namespace).toBe('ns1');
    expect(m.size).toBe(10);
    expect(proj.getActiveMemories()).toHaveLength(1);
  });

  it('retrieved updates access count (only while active)', async () => {
    await store('m1', 'ns1', 10);
    await proj.handle(evt('memory:retrieved', { memoryId: 'm1', accessCount: 7 }));
    expect(proj.getMemory('m1')!.accessCount).toBe(7);
  });

  it('deleted and expired flag the memory inactive', async () => {
    await store('m1', 'ns1', 10);
    await store('m2', 'ns1', 20);
    await proj.handle(evt('memory:deleted', { memoryId: 'm1' }));
    await proj.handle(evt('memory:expired', { memoryId: 'm2' }));
    expect(proj.getMemory('m1')!.isDeleted).toBe(true);
    expect(proj.getActiveMemories()).toHaveLength(0);
  });

  it('namespace queries, size totals, and most-accessed ranking', async () => {
    await store('m1', 'ns1', 10);
    await store('m2', 'ns1', 30);
    await store('m3', 'ns2', 5);
    await proj.handle(evt('memory:retrieved', { memoryId: 'm2', accessCount: 9 }));
    await proj.handle(evt('memory:retrieved', { memoryId: 'm1', accessCount: 3 }));

    expect(proj.getMemoriesByNamespace('ns1').map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect(proj.getTotalSizeByNamespace('ns1')).toBe(40);
    expect(proj.getMostAccessedMemories(2).map((m) => m.id)).toEqual(['m2', 'm1']);
  });
});

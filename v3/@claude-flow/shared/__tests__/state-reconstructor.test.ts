/**
 * Unit tests for StateReconstructor — the event-sourcing read path that replays
 * a DomainEvent stream into an aggregate. Previously untested. The EventStore is
 * stubbed (reconstruct only calls getSnapshot + getEvents), so the replay logic
 * is exercised deterministically without sql.js.
 */
import { describe, it, expect } from 'vitest';
import {
  StateReconstructor,
  AgentAggregate,
  TaskAggregate,
} from '../src/events/state-reconstructor.js';
import type { DomainEvent } from '../src/events/domain-events.js';
import type { EventStore } from '../src/events/event-store.js';

function evt(
  type: string,
  version: number,
  payload: Record<string, unknown> = {},
  timestamp = version * 1000,
): DomainEvent {
  return {
    id: `e${version}`,
    type,
    aggregateId: 'agent-1',
    aggregateType: type.startsWith('agent') ? 'agent' : 'task',
    version,
    timestamp,
    source: 'swarm',
    payload,
  };
}

function makeStore(events: DomainEvent[]): EventStore {
  return {
    getSnapshot: async () => null,
    getEvents: async (id: string, fromVersion?: number) =>
      events.filter((e) => e.aggregateId === id && (fromVersion === undefined || e.version >= fromVersion)),
  } as unknown as EventStore;
}

const agentStream = [
  evt('agent:spawned', 1, { name: 'A', role: 'coder', capabilities: ['ts'] }),
  evt('agent:started', 2),
  evt('agent:task-assigned', 3, { taskId: 't1' }),
  evt('agent:task-completed', 4, { taskId: 't1' }),
];

describe('reconstruct', () => {
  it('folds the full event stream into the aggregate', async () => {
    const r = new StateReconstructor(makeStore(agentStream), { useSnapshots: false });
    const agent = await r.reconstruct('agent-1', (id) => new AgentAggregate(id));
    expect(agent.name).toBe('A');
    expect(agent.role).toBe('coder');
    expect(agent.status).toBe('active'); // after task-completed
    expect(agent.completedTasks).toEqual(['t1']);
    expect(agent.version).toBe(4);
  });

  it('returns a fresh aggregate when there are no events', async () => {
    const r = new StateReconstructor(makeStore([]), { useSnapshots: false });
    const agent = await r.reconstruct('agent-1', (id) => new AgentAggregate(id));
    expect(agent.version).toBe(0);
    expect(agent.name).toBe('');
  });

  it('throws when the stream exceeds maxEventsToReplay', async () => {
    const r = new StateReconstructor(makeStore(agentStream), {
      useSnapshots: false,
      maxEventsToReplay: 2,
    });
    await expect(r.reconstruct('agent-1', (id) => new AgentAggregate(id))).rejects.toThrow(
      /Too many events to replay/i,
    );
  });
});

describe('reconstructAtVersion', () => {
  it('stops folding at the target version', async () => {
    const r = new StateReconstructor(makeStore(agentStream));
    const agent = await r.reconstructAtVersion('agent-1', (id) => new AgentAggregate(id), 2);
    expect(agent.version).toBe(2);
    expect(agent.status).toBe('active'); // started, but no task yet
    expect(agent.currentTask).toBeNull();
    expect(agent.completedTasks).toEqual([]);
  });
});

describe('reconstructAtTime', () => {
  it('only applies events up to the given timestamp', async () => {
    const r = new StateReconstructor(makeStore(agentStream));
    // timestamps are version*1000; cut after the task-assigned event (3000)
    const agent = await r.reconstructAtTime('agent-1', (id) => new AgentAggregate(id), new Date(3000));
    expect(agent.version).toBe(3);
    expect(agent.status).toBe('busy'); // task-assigned, not yet completed
    expect(agent.currentTask).toBe('t1');
  });
});

describe('TaskAggregate reconstruction', () => {
  it('rebuilds a task from its event stream', async () => {
    const taskStream = [
      evt('task:created', 1, { title: 'T', description: 'd', taskType: 'build' }),
      evt('task:started', 2, { agentId: 'a1' }),
      evt('task:completed', 3, { result: { ok: true } }),
    ].map((e) => ({ ...e, aggregateType: 'task' as const }));
    const r = new StateReconstructor(makeStore(taskStream), { useSnapshots: false });
    const task = await r.reconstruct('agent-1', (id) => new TaskAggregate(id));
    expect(task.status).toBe('completed');
    expect(task.result).toEqual({ ok: true });
    expect(task.version).toBe(3);
  });
});

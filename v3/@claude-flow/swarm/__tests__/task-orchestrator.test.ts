/**
 * Unit tests for TaskOrchestrator — the dependency-graph + priority scheduler.
 * Previously untested. EventBus and AgentRegistry are stubbed (the orchestrator
 * only fires events and delegates agent bookkeeping), so the pure orchestration
 * logic is fully deterministic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskOrchestrator, type TaskSpec } from '../src/coordination/task-orchestrator.js';
import type { TaskResult } from '../src/shared/types.js';

type Ctor = ConstructorParameters<typeof TaskOrchestrator>;
function makeOrch(): TaskOrchestrator {
  const eventBus = { subscribe() {}, emitSync() {} } as unknown as Ctor[0];
  const registry = {
    assignTask() {},
    completeTask() {},
    updateStatus() {},
    getState: () => undefined,
    getDefinition: () => undefined,
  } as unknown as Ctor[1];
  return new TaskOrchestrator(eventBus, registry);
}

function spec(overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    type: 'implementation',
    title: 't',
    description: 'd',
    domain: 'core',
    phase: 'phase-1-foundation',
    ...overrides,
  };
}

const result = (taskId: string): TaskResult =>
  ({ taskId, success: true, output: null, error: null, duration: 100, metrics: {} } as unknown as TaskResult);

let orch: TaskOrchestrator;
beforeEach(() => {
  orch = makeOrch();
});

// Run a no-dependency task through its full lifecycle to 'completed'.
function complete(id: string, agent = 'agent-1') {
  orch.queueTask(id);
  orch.assignTask(id, agent);
  orch.startTask(id);
  orch.completeTask(id, result(id));
}

describe('createTask', () => {
  it('creates a pending task with defaults', () => {
    const t = orch.createTask(spec());
    expect(t.status).toBe('pending');
    expect(t.priority).toBe('medium');
    expect(t.dependencies).toEqual([]);
    expect(orch.getTask(t.id)?.id).toBe(t.id);
  });

  it('a task with an incomplete dependency starts blocked', () => {
    const a = orch.createTask(spec());
    const b = orch.createTask(spec({ dependencies: [a.id] }));
    expect(b.status).toBe('blocked');
    expect(orch.isBlocked(b.id)).toBe(true);
    expect(orch.getBlockingTasks(b.id)).toEqual([a.id]);
    expect(orch.getDependencies(b.id)).toEqual([a.id]);
    expect(orch.getDependents(a.id)).toEqual([b.id]);
  });
});

describe('dependency unblocking', () => {
  it('completing the dependency moves the dependent to queued', () => {
    const a = orch.createTask(spec());
    const b = orch.createTask(spec({ dependencies: [a.id] }));
    expect(b.status).toBe('blocked');
    complete(a.id);
    expect(orch.isBlocked(b.id)).toBe(false);
    expect(orch.getTask(b.id)?.status).toBe('queued');
    expect(orch.getBlockingTasks(b.id)).toEqual([]);
  });

  it('addDependency rejects a cycle', () => {
    const a = orch.createTask(spec());
    const b = orch.createTask(spec());
    orch.addDependency(a.id, b.id);
    expect(() => orch.addDependency(b.id, a.id)).toThrow(/cycle/i);
  });

  it('removeDependency clears the edge', () => {
    const a = orch.createTask(spec());
    const b = orch.createTask(spec({ dependencies: [a.id] }));
    orch.removeDependency(b.id, a.id);
    expect(orch.getDependencies(b.id)).toEqual([]);
    expect(orch.getTask(b.id)?.status).toBe('queued'); // no longer blocked
  });
});

describe('lifecycle guards', () => {
  it('full happy path: queue -> assign -> start -> complete', () => {
    const a = orch.createTask(spec());
    orch.queueTask(a.id);
    expect(orch.getTask(a.id)?.status).toBe('queued');
    orch.assignTask(a.id, 'agent-1');
    expect(orch.getTask(a.id)?.status).toBe('assigned');
    expect(orch.getTask(a.id)?.assignedAgent).toBe('agent-1');
    orch.startTask(a.id);
    expect(orch.getTask(a.id)?.status).toBe('in-progress');
    orch.completeTask(a.id, result(a.id));
    expect(orch.getTask(a.id)?.status).toBe('completed');
  });

  it('assignTask requires a queued task', () => {
    const a = orch.createTask(spec()); // pending
    expect(() => orch.assignTask(a.id, 'agent-1')).toThrow(/not queued/i);
  });

  it('startTask requires an assigned task', () => {
    const a = orch.createTask(spec());
    orch.queueTask(a.id);
    expect(() => orch.startTask(a.id)).toThrow(/not assigned/i);
  });

  it('cannot cancel a completed task', () => {
    const a = orch.createTask(spec());
    complete(a.id);
    expect(() => orch.cancelTask(a.id)).toThrow(/Cannot cancel completed/i);
  });

  it('failTask re-queues until maxRetries', () => {
    const a = orch.createTask(spec());
    orch.queueTask(a.id);
    orch.assignTask(a.id, 'agent-1');
    orch.startTask(a.id);
    orch.failTask(a.id, new Error('x'));
    expect(orch.getTask(a.id)?.status).toBe('queued'); // retry 1 < 3
    expect(orch.getTask(a.id)?.metadata.retryCount).toBe(1);
  });
});

describe('priority scheduling', () => {
  it('getNextTask / getPriorityQueue order unblocked queued tasks by priority', () => {
    const low = orch.createTask(spec({ priority: 'low' }));
    const crit = orch.createTask(spec({ priority: 'critical' }));
    const high = orch.createTask(spec({ priority: 'high' }));
    orch.queueTask(low.id);
    orch.queueTask(crit.id);
    orch.queueTask(high.id);

    expect(orch.getNextTask()?.id).toBe(crit.id);
    expect(orch.getPriorityQueue().map((t) => t.priority)).toEqual(['critical', 'high', 'low']);
  });

  it('blocked tasks are excluded from the queue', () => {
    const a = orch.createTask(spec());
    const b = orch.createTask(spec({ dependencies: [a.id] }));
    // b is blocked; only a (once queued) is schedulable
    orch.queueTask(a.id);
    orch.queueTask(b.id); // stays blocked
    expect(orch.getPriorityQueue().map((t) => t.id)).toEqual([a.id]);
    expect(orch.getNextTask()?.id).toBe(a.id);
  });
});

describe('queries', () => {
  it('filters by status, domain and phase', () => {
    const a = orch.createTask(spec({ domain: 'core', phase: 'phase-1-foundation' }));
    orch.createTask(spec({ domain: 'security', phase: 'phase-2-core' }));
    orch.queueTask(a.id);
    expect(orch.getAllTasks()).toHaveLength(2);
    expect(orch.getTasksByStatus('queued').map((t) => t.id)).toEqual([a.id]);
    expect(orch.getTasksByDomain('security')).toHaveLength(1);
    expect(orch.getTasksByPhase('phase-1-foundation').map((t) => t.id)).toEqual([a.id]);
  });
});

/**
 * Unit tests for CoordinationService.assignTask — the task→agent assignment
 * service with its load-balancing selection strategies. Previously untested.
 * Repositories are stubbed; real Agent/Task domain entities are used.
 */
import { describe, it, expect, vi } from 'vitest';
import { CoordinationService } from '../src/domain/services/coordination-service.js';
import { Agent } from '../src/domain/entities/agent.js';
import { Task } from '../src/domain/entities/task.js';

type Ctor = ConstructorParameters<typeof CoordinationService>;

function makeTask(overrides: Partial<Parameters<typeof Task.create>[0]> = {}) {
  return Task.create({ title: 't', description: 'd', type: 'testing', ...overrides });
}
function makeAgent(opts: { name: string; capabilities?: string[]; currentTaskIds?: string[]; lastActiveAt?: Date }) {
  return Agent.create({
    name: opts.name,
    role: 'coder',
    domain: 'core',
    capabilities: opts.capabilities ?? [],
    maxConcurrentTasks: 3,
    currentTaskIds: opts.currentTaskIds,
    lastActiveAt: opts.lastActiveAt,
  });
}

function makeService(agents: Agent[], task: Task | null, completed: Task[] = []) {
  const agentSave = vi.fn(async () => {});
  const taskSave = vi.fn(async () => {});
  const agentRepo = {
    findAvailable: async () => agents,
    findById: async (id: string) => agents.find((a) => a.id === id) ?? null,
    save: agentSave,
  } as unknown as Ctor[0];
  const taskRepo = {
    findById: async () => task,
    findByStatus: async (s: string) => (s === 'completed' ? completed : []),
    save: taskSave,
  } as unknown as Ctor[1];
  return { svc: new CoordinationService(agentRepo, taskRepo), agentSave, taskSave };
}

describe('assignTask guards', () => {
  it('fails when the task is not found', async () => {
    const { svc } = makeService([], null);
    expect(await svc.assignTask('missing')).toEqual({ success: false, taskId: 'missing', reason: 'Task not found' });
  });

  it('fails when dependencies are not satisfied', async () => {
    const task = makeTask({ id: 'tk', dependencies: ['dep-1'] });
    const { svc } = makeService([makeAgent({ name: 'a' })], task, []); // dep-1 not completed
    const r = await svc.assignTask('tk');
    expect(r).toMatchObject({ success: false, reason: 'Dependencies not satisfied' });
  });

  it('fails when there are no available agents', async () => {
    const task = makeTask({ id: 'tk' });
    const { svc } = makeService([], task);
    expect(await svc.assignTask('tk')).toMatchObject({ success: false, reason: 'No available agents' });
  });
});

describe('assignTask selection strategies', () => {
  it('least-loaded picks the agent with the lowest utilization', async () => {
    const busy = makeAgent({ name: 'busy', currentTaskIds: ['x'] }); // util 1/3
    const idle = makeAgent({ name: 'idle' }); // util 0
    const task = makeTask({ id: 'tk' });
    const { svc } = makeService([busy, idle], task);
    const r = await svc.assignTask('tk', 'least-loaded');
    expect(r.success).toBe(true);
    expect(r.agentId).toBe(idle.id);
  });

  it('capability-match prefers an agent with matching capabilities', async () => {
    const tester = makeAgent({ name: 'tester', capabilities: ['testing', 'qa'] });
    const other = makeAgent({ name: 'other', capabilities: [] });
    const task = makeTask({ id: 'tk', type: 'testing' });
    const { svc } = makeService([other, tester], task);
    const r = await svc.assignTask('tk', 'capability-match');
    expect(r.agentId).toBe(tester.id);
  });

  it('round-robin picks the least-recently-active agent', async () => {
    const old = makeAgent({ name: 'old', lastActiveAt: new Date('2020-01-01') });
    const recent = makeAgent({ name: 'recent', lastActiveAt: new Date('2024-01-01') });
    const task = makeTask({ id: 'tk' });
    const { svc } = makeService([recent, old], task);
    const r = await svc.assignTask('tk', 'round-robin');
    expect(r.agentId).toBe(old.id);
  });
});

describe('assignTask success effects', () => {
  it('assigns the task to the agent and persists both', async () => {
    const agent = makeAgent({ name: 'a', capabilities: ['testing'] });
    const task = makeTask({ id: 'tk' });
    const { svc, agentSave, taskSave } = makeService([agent], task);
    const r = await svc.assignTask('tk');
    expect(r.success).toBe(true);
    expect(task.assignedAgentId).toBe(agent.id);
    expect(agent.currentTaskIds).toContain('tk');
    expect(taskSave).toHaveBeenCalledTimes(1);
    expect(agentSave).toHaveBeenCalledTimes(1);
  });
});

/**
 * Unit tests for AgentPool (acquire/release/remove/scale + counts + events).
 * Previously uncovered. Auto-scaling is disabled via thresholds and cooldown
 * so the pooling invariants are deterministic; initialize() is skipped so the
 * health-check interval never starts.
 */
import { describe, it, expect, vi } from 'vitest';
import { AgentPool } from '../src/agent-pool.js';
import type { AgentState } from '../src/types.js';

// minSize 0 = no auto-spawn; thresholds out of [0,1] = checkScaling never
// fires; cooldownMs 0 = scale() isn't throttled in tests.
function makePool(maxSize = 3) {
  return new AgentPool({
    name: 'test',
    minSize: 0,
    maxSize,
    scaleUpThreshold: 2,
    scaleDownThreshold: -1,
    cooldownMs: 0,
  });
}

describe('acquire / release', () => {
  it('auto-creates an agent on acquire and marks it busy', async () => {
    const pool = makePool();
    const a = await pool.acquire();
    expect(a).toBeDefined();
    expect(a!.status).toBe('busy');
    expect(pool.getBusyCount()).toBe(1);
    expect(pool.getAvailableCount()).toBe(0);
    expect(pool.getTotalCount()).toBe(1);
  });

  it('release returns the agent to the available set as idle', async () => {
    const pool = makePool();
    const a = await pool.acquire();
    await pool.release(a!.id.id);
    expect(pool.getBusyCount()).toBe(0);
    expect(pool.getAvailableCount()).toBe(1);
    expect(pool.getAgent(a!.id.id)?.status).toBe('idle');
  });

  it('reuses a released agent instead of creating a new one', async () => {
    const pool = makePool();
    const a = await pool.acquire();
    await pool.release(a!.id.id);
    const b = await pool.acquire();
    expect(b!.id.id).toBe(a!.id.id);
    expect(pool.getTotalCount()).toBe(1);
  });

  it('returns undefined and emits pool.exhausted when at capacity', async () => {
    const pool = makePool(1);
    const exhausted = vi.fn();
    pool.on('pool.exhausted', exhausted);
    await pool.acquire(); // fills the single slot
    const second = await pool.acquire();
    expect(second).toBeUndefined();
    expect(exhausted).toHaveBeenCalledTimes(1);
  });

  it('release of an unknown id is a no-op', async () => {
    const pool = makePool();
    await expect(pool.release('nope')).resolves.toBeUndefined();
    expect(pool.getTotalCount()).toBe(0);
  });
});

describe('add / remove', () => {
  it('add registers an external agent; over capacity it throws', async () => {
    // Mint two real AgentState objects from a throwaway pool.
    const src = makePool(2);
    const a1 = (await src.acquire())!;
    const a2 = (await src.acquire())!;

    const pool = makePool(1);
    await pool.add(a1);
    expect(pool.getTotalCount()).toBe(1);
    expect(pool.getAvailableCount()).toBe(1);
    await expect(pool.add(a2)).rejects.toThrow(/maximum capacity/i);
  });

  it('remove deletes the agent and terminates it', async () => {
    const pool = makePool();
    const a = await pool.acquire();
    await pool.remove(a!.id.id);
    expect(pool.getTotalCount()).toBe(0);
    expect(pool.getBusyCount()).toBe(0);
    expect(a!.status).toBe('terminated');
  });
});

describe('counts / utilization / queries', () => {
  it('tracks utilization as busy / total', async () => {
    const pool = makePool(3);
    const a = await pool.acquire();
    await pool.acquire();
    expect(pool.getUtilization()).toBe(1); // 2 busy / 2 total
    await pool.release(a!.id.id);
    expect(pool.getUtilization()).toBe(0.5); // 1 busy / 2 total
  });

  it('utilization is 0 for an empty pool', () => {
    expect(makePool().getUtilization()).toBe(0);
  });

  it('exposes agent views', async () => {
    const pool = makePool(3);
    const a = await pool.acquire();
    await pool.acquire();
    await pool.release(a!.id.id);
    expect(pool.getAllAgents()).toHaveLength(2);
    expect(pool.getBusyAgents()).toHaveLength(1);
    expect(pool.getAvailableAgents()).toHaveLength(1);
  });
});

describe('scale', () => {
  it('scales up to create agents (bounded by maxSize)', async () => {
    const pool = makePool(5);
    await pool.scale(3);
    expect(pool.getTotalCount()).toBe(3);
    await pool.scale(10); // capped at maxSize
    expect(pool.getTotalCount()).toBe(5);
  });

  it('scales down by removing least-recently-used available agents', async () => {
    const pool = makePool(5);
    await pool.scale(3);
    await pool.scale(-2);
    expect(pool.getTotalCount()).toBe(1);
  });
});

describe('events', () => {
  it('emits acquired / released around the lifecycle', async () => {
    const pool = makePool();
    const acquired = vi.fn();
    const released = vi.fn();
    pool.on('agent.acquired', acquired);
    pool.on('agent.released', released);
    const a = await pool.acquire();
    await pool.release(a!.id.id);
    expect(acquired).toHaveBeenCalledTimes(1);
    expect(released).toHaveBeenCalledTimes(1);
  });
});

// Type sanity: the minted agents really are AgentState (id.id present).
it('minted agents have the AgentState id shape', async () => {
  const pool = makePool();
  const a: AgentState | undefined = await pool.acquire();
  expect(typeof a?.id.id).toBe('string');
});

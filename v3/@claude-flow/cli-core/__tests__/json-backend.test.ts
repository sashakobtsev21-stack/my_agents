/**
 * Unit tests for JsonMemoryBackend — the lite memory backend shipped in
 * cli-core (previously 0% covered). Exercises CRUD, the upsert constraint,
 * namespace isolation, substring search, tag filtering, stats and TTL expiry
 * against a real temp-file store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonMemoryBackend } from '../src/memory/json-backend.js';

let dir: string;
let backend: JsonMemoryBackend;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cli-core-mem-'));
  backend = new JsonMemoryBackend({ path: join(dir, 'memory.json') });
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

describe('store / retrieve', () => {
  it('stores and retrieves a value', async () => {
    await backend.store('k1', { hello: 'world' });
    const e = await backend.retrieve('k1');
    expect(e?.value).toEqual({ hello: 'world' });
    expect(e?.namespace).toBe('default');
  });

  it('returns null for a missing key', async () => {
    expect(await backend.retrieve('nope')).toBeNull();
  });

  it('increments accessCount on retrieve', async () => {
    await backend.store('k', 'v');
    await backend.retrieve('k');
    const e = await backend.retrieve('k');
    expect(e?.accessCount).toBe(2);
  });

  it('persists across backend instances (same file)', async () => {
    await backend.store('k', 'v');
    const reopened = new JsonMemoryBackend({ path: join(dir, 'memory.json') });
    expect((await reopened.retrieve('k'))?.value).toBe('v');
  });
});

describe('upsert constraint', () => {
  it('throws on duplicate key without upsert', async () => {
    await backend.store('dup', 'a');
    await expect(backend.store('dup', 'b')).rejects.toThrow(/UNIQUE constraint/);
  });

  it('overwrites with upsert', async () => {
    await backend.store('dup', 'a');
    await backend.store('dup', 'b', { upsert: true });
    expect((await backend.retrieve('dup'))?.value).toBe('b');
  });
});

describe('namespaces', () => {
  it('isolates the same key across namespaces', async () => {
    await backend.store('k', 'default-val');
    await backend.store('k', 'ns-val', { namespace: 'other' });
    expect((await backend.retrieve('k'))?.value).toBe('default-val');
    expect((await backend.retrieve('k', { namespace: 'other' }))?.value).toBe('ns-val');
  });
});

describe('search', () => {
  beforeEach(async () => {
    await backend.store('alpha', 'the quick brown fox');
    await backend.store('beta', 'lazy dog');
    await backend.store('gamma', 'fox trot', { namespace: 'animals' });
  });

  it('scores substring matches 1 and non-matches 0 (case-insensitive)', async () => {
    // Default threshold is 0, so every non-expired entry comes back scored;
    // a positive threshold keeps only the matches.
    const all = await backend.search('FOX');
    const score = (k: string) => all.find((x) => x.key === k)?.score;
    expect(score('alpha')).toBe(1);
    expect(score('beta')).toBe(0);

    const matches = (await backend.search('FOX', { threshold: 1 })).map((x) => x.key).sort();
    expect(matches).toContain('alpha');
    expect(matches).toContain('gamma');
    expect(matches).not.toContain('beta');
  });

  it('respects the namespace filter', async () => {
    const r = await backend.search('fox', { namespace: 'animals' });
    expect(r.map((x) => x.key)).toEqual(['gamma']);
  });

  it('respects the limit', async () => {
    const r = await backend.search('fox', { limit: 1 });
    expect(r).toHaveLength(1);
  });

  it('drops results below threshold', async () => {
    const r = await backend.search('no-such-token', { threshold: 0.5 });
    expect(r).toHaveLength(0);
  });
});

describe('list', () => {
  beforeEach(async () => {
    await backend.store('a', '1', { tags: ['x', 'y'] });
    await backend.store('b', '2', { tags: ['x'] });
    await backend.store('c', '3', { namespace: 'other' });
  });

  it('lists entries in a namespace', async () => {
    const r = await backend.list({ namespace: 'default' });
    expect(r.map((e) => e.key).sort()).toEqual(['a', 'b']);
  });

  it('filters by ALL given tags', async () => {
    const r = await backend.list({ tags: ['x', 'y'] });
    expect(r.map((e) => e.key)).toEqual(['a']);
  });

  it('respects the limit', async () => {
    const r = await backend.list({ limit: 1 });
    expect(r).toHaveLength(1);
  });
});

describe('delete', () => {
  it('deletes an existing key and returns true', async () => {
    await backend.store('k', 'v');
    expect(await backend.delete('k')).toBe(true);
    expect(await backend.retrieve('k')).toBeNull();
  });

  it('returns false for a missing key', async () => {
    expect(await backend.delete('missing')).toBe(false);
  });
});

describe('stats', () => {
  it('reports totals and sorted namespaces', async () => {
    await backend.store('a', '1');
    await backend.store('b', '2', { namespace: 'zeta' });
    await backend.store('c', '3', { namespace: 'alpha' });
    const s = await backend.stats();
    expect(s.totalEntries).toBe(3);
    expect(s.namespaces).toEqual(['alpha', 'default', 'zeta']);
    expect(s.backend).toBe('json');
    expect(s.sizeBytes).toBeGreaterThan(0);
  });
});

describe('TTL expiry', () => {
  it('expires entries past their ttl on retrieve', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    await backend.store('temp', 'v', { ttl: 1 }); // 1 second
    vi.setSystemTime(new Date('2020-01-01T00:00:02Z')); // +2s
    expect(await backend.retrieve('temp')).toBeNull();
  });

  it('keeps entries within their ttl', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    await backend.store('temp', 'v', { ttl: 100 });
    vi.setSystemTime(new Date('2020-01-01T00:00:02Z'));
    expect((await backend.retrieve('temp'))?.value).toBe('v');
  });

  it('hides expired entries from search and list', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    await backend.store('temp', 'findme', { ttl: 1 });
    await backend.store('keep', 'findme', { ttl: 100 });
    vi.setSystemTime(new Date('2020-01-01T00:00:05Z'));
    expect((await backend.search('findme')).map((e) => e.key)).toEqual(['keep']);
    expect((await backend.list()).map((e) => e.key)).toEqual(['keep']);
  });
});

describe('persistence file', () => {
  it('creates the backing file on first write', async () => {
    expect(existsSync(join(dir, 'memory.json'))).toBe(false);
    await backend.store('k', 'v');
    expect(existsSync(join(dir, 'memory.json'))).toBe(true);
  });
});

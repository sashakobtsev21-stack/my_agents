/**
 * Unit tests for MessageBus pull-mode queuing (send/broadcast/subscribe +
 * getMessages/getQueueDepth/hasPendingMessages/getMessage), TTL expiry, and the
 * max-queue-size cap. Previously untested.
 *
 * initialize() is never called, so the processing/stats setInterval timers are
 * never started and the bus is fully deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus } from '../src/message-bus.js';
import type { Message, MessageType } from '../src/types.js';

type SendInput = Omit<Message, 'id' | 'timestamp'>;
function msg(overrides: Partial<SendInput> = {}): SendInput {
  return {
    type: 'status_update' as MessageType,
    from: 'a',
    to: 'b',
    payload: { x: 1 },
    priority: 'normal',
    requiresAck: false,
    ttlMs: 60_000,
    ...overrides,
  };
}

let bus: MessageBus;
beforeEach(() => {
  bus = new MessageBus();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('send + pull-mode queries', () => {
  it('send returns an id and enqueues to the recipient', async () => {
    const id = await bus.send(msg());
    expect(id).toMatch(/^msg_/);
    expect(bus.getQueueDepth()).toBe(1);
    expect(bus.hasPendingMessages('b')).toBe(true);
    expect(bus.getMessage(id)?.from).toBe('a');
  });

  it('getMessages drains the recipient queue', async () => {
    await bus.send(msg());
    await bus.send(msg({ payload: { x: 2 } }));
    const got = bus.getMessages('b');
    expect(got).toHaveLength(2);
    expect(bus.getQueueDepth()).toBe(0);
    expect(bus.hasPendingMessages('b')).toBe(false);
  });

  it('getMessages for an unknown agent is empty', () => {
    expect(bus.getMessages('nobody')).toEqual([]);
  });
});

describe('broadcast', () => {
  it('delivers to every subscriber except the sender', async () => {
    bus.subscribe('a', () => {});
    bus.subscribe('b', () => {});
    bus.subscribe('c', () => {});
    await bus.broadcast({
      type: 'status_update' as MessageType,
      from: 'a',
      payload: { ping: true },
      priority: 'normal',
      requiresAck: false,
      ttlMs: 60_000,
    });
    expect(bus.hasPendingMessages('a')).toBe(false); // sender excluded
    expect(bus.hasPendingMessages('b')).toBe(true);
    expect(bus.hasPendingMessages('c')).toBe(true);
    expect(bus.getQueueDepth()).toBe(2);
  });
});

describe('subscribe / unsubscribe', () => {
  it('subscribe creates an (empty) queue; unsubscribe removes it', async () => {
    bus.subscribe('b', () => {});
    expect(bus.hasPendingMessages('b')).toBe(false);
    await bus.send(msg());
    expect(bus.hasPendingMessages('b')).toBe(true);
    bus.unsubscribe('b');
    expect(bus.hasPendingMessages('b')).toBe(false);
    expect(bus.getQueueDepth()).toBe(0);
  });
});

describe('TTL expiry', () => {
  it('drops messages older than their ttl on read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    void bus.send(msg({ ttlMs: 1000 }));
    void bus.send(msg({ ttlMs: 1000, to: 'keep' }));
    // advance past the ttl for 'b', then read each queue
    vi.setSystemTime(new Date('2020-01-01T00:00:02Z')); // +2s
    expect(bus.getMessages('b')).toHaveLength(0); // expired
  });

  it('keeps messages within their ttl', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    void bus.send(msg({ ttlMs: 10_000 }));
    vi.setSystemTime(new Date('2020-01-01T00:00:02Z'));
    expect(bus.getMessages('b')).toHaveLength(1);
  });
});

describe('max queue size', () => {
  it('caps a recipient queue at maxQueueSize', async () => {
    const small = new MessageBus({ maxQueueSize: 2 });
    await small.send(msg());
    await small.send(msg());
    await small.send(msg()); // evicts lowest priority to stay at cap
    expect(small.getQueueDepth()).toBe(2);
  });
});

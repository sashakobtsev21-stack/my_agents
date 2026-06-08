/**
 * Unit tests for the core EventBus (subscribe/on/once/off/emit/emitAsync +
 * wildcard delivery, listener bookkeeping, and handler-error isolation).
 * Previously untested.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, createEventBus } from '../src/core/event-bus.js';

let bus: EventBus;
beforeEach(() => {
  bus = new EventBus();
});

describe('on / emit', () => {
  it('delivers an event with type + payload to a handler', () => {
    const h = vi.fn();
    bus.on('greet', h);
    bus.emit('greet', { hi: 1 });
    expect(h).toHaveBeenCalledTimes(1);
    const event = h.mock.calls[0][0];
    expect(event.type).toBe('greet');
    expect(event.payload).toEqual({ hi: 1 });
    expect(typeof event.id).toBe('string');
  });

  it('emitting a type with no handlers is a no-op', () => {
    expect(() => bus.emit('nobody', {})).not.toThrow();
  });

  it('calls every handler registered for a type', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('x', b);
    bus.emit('x', 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('wildcard handlers receive every event', () => {
    const star = vi.fn();
    bus.on('*', star);
    bus.emit('a', 1);
    bus.emit('b', 2);
    expect(star).toHaveBeenCalledTimes(2);
  });
});

describe('off / once / unsubscribe', () => {
  it('off stops delivery and prunes empty types', () => {
    const h = vi.fn();
    bus.on('x', h);
    expect(bus.eventNames()).toContain('x');
    bus.off('x', h);
    bus.emit('x', 1);
    expect(h).not.toHaveBeenCalled();
    expect(bus.eventNames()).not.toContain('x');
  });

  it('once fires exactly once', () => {
    const h = vi.fn();
    bus.once('x', h);
    bus.emit('x', 1);
    bus.emit('x', 2);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('subscription.unsubscribe removes the handler', () => {
    const h = vi.fn();
    const sub = bus.subscribe({ types: ['x'] }, h);
    sub.unsubscribe();
    bus.emit('x', 1);
    expect(h).not.toHaveBeenCalled();
    expect(bus.listenerCount('x')).toBe(0);
  });
});

describe('bookkeeping', () => {
  it('listenerCount and eventNames reflect registrations', () => {
    bus.on('a', vi.fn());
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    expect(bus.listenerCount('a')).toBe(2);
    expect(bus.listenerCount('b')).toBe(1);
    expect(bus.eventNames().sort()).toEqual(['a', 'b']);
  });

  it('removeAllListeners clears one type or all', () => {
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    bus.removeAllListeners('a');
    expect(bus.eventNames()).toEqual(['b']);
    bus.removeAllListeners();
    expect(bus.eventNames()).toEqual([]);
  });
});

describe('emitAsync + error isolation', () => {
  it('awaits async handlers', async () => {
    let done = false;
    bus.on('x', async () => {
      await Promise.resolve();
      done = true;
    });
    await bus.emitAsync('x', 1);
    expect(done).toBe(true);
  });

  it('a throwing handler does not stop the others (sync emit)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', good);
    expect(() => bus.emit('x', 1)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('factory', () => {
  it('createEventBus returns a working bus', () => {
    const b = createEventBus();
    const h = vi.fn();
    b.on('x', h);
    b.emit('x', 1);
    expect(h).toHaveBeenCalledTimes(1);
  });
});

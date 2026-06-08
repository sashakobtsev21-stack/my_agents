/**
 * Unit tests for the Pattern domain entity (neural). Previously untested.
 * Covers success-rate math, the confidence-weighting rule (only updates once
 * there are >=5 samples), regex matching with substring fallback, reliability,
 * and persistence.
 */
import { describe, it, expect } from 'vitest';
import { Pattern, type PatternProps } from '../src/domain/entities/pattern.js';

function make(overrides: Partial<PatternProps> = {}): Pattern {
  return Pattern.create({
    type: 'task-routing',
    name: 'p',
    description: 'd',
    condition: 'spawn.*agent',
    action: 'route',
    confidence: 0.5,
    ...overrides,
  });
}

describe('create / defaults', () => {
  it('applies defaults', () => {
    const p = make();
    expect(p.id).toBeTruthy();
    expect(p.successCount).toBe(0);
    expect(p.failureCount).toBe(0);
    expect(p.metadata).toEqual({});
    expect(p.confidence).toBe(0.5);
  });

  it('metadata getter is a defensive copy', () => {
    const p = make({ metadata: { a: 1 } });
    p.metadata.a = 999;
    expect(p.metadata).toEqual({ a: 1 });
  });
});

describe('successRate', () => {
  it('is 0 with no data', () => {
    expect(make().successRate).toBe(0);
  });
  it('is success / (success + failure)', () => {
    const p = make({ successCount: 3, failureCount: 1 });
    expect(p.successRate).toBe(0.75);
  });
});

describe('confidence weighting', () => {
  it('does NOT change confidence until there are >=5 samples', () => {
    const p = make({ confidence: 0.5 });
    p.recordSuccess(); // total 1
    expect(p.confidence).toBe(0.5);
    expect(p.successCount).toBe(1);
  });

  it('blends 0.3*old + 0.7*successRate once >=5 samples', () => {
    const p = make({ confidence: 0.5, successCount: 4, failureCount: 0 });
    p.recordSuccess(); // total 5, successRate 5/5 = 1
    expect(p.confidence).toBeCloseTo(0.5 * 0.3 + 1 * 0.7, 10); // 0.85
  });

  it('recordFailure lowers confidence accordingly', () => {
    const p = make({ confidence: 0.6, successCount: 3, failureCount: 2 });
    p.recordFailure(); // total 6, successRate 3/6 = 0.5
    expect(p.failureCount).toBe(3);
    expect(p.confidence).toBeCloseTo(0.6 * 0.3 + 0.5 * 0.7, 10); // 0.53
  });
});

describe('matches', () => {
  it('matches via case-insensitive regex', () => {
    const p = make({ condition: 'spawn.*agent' });
    expect(p.matches('Please SPAWN the Agent now')).toBe(true);
    expect(p.matches('delete the room')).toBe(false);
  });

  it('falls back to substring on an invalid regex', () => {
    const p = make({ condition: '(' }); // invalid regex
    expect(p.matches('a(b')).toBe(true);
    expect(p.matches('xyz')).toBe(false);
  });
});

describe('isReliable', () => {
  it('requires >=10 samples AND confidence >=0.7', () => {
    expect(make({ successCount: 8, failureCount: 2, confidence: 0.8 }).isReliable()).toBe(true);
    expect(make({ successCount: 5, failureCount: 4, confidence: 0.9 }).isReliable()).toBe(false); // 9 samples
    expect(make({ successCount: 8, failureCount: 2, confidence: 0.6 }).isReliable()).toBe(false); // low conf
  });
});

describe('persistence', () => {
  it('serializes fields with ISO dates and undefined lastMatchedAt before any match', () => {
    const p = make({ id: 'p1', successCount: 2, failureCount: 1 });
    const snap = p.toPersistence();
    expect(snap).toMatchObject({ id: 'p1', type: 'task-routing', successCount: 2, failureCount: 1 });
    expect(typeof snap.createdAt).toBe('string');
    expect(snap.lastMatchedAt).toBeUndefined();
  });

  it('records lastMatchedAt after a recordSuccess', () => {
    const p = make();
    p.recordSuccess();
    expect(p.lastMatchedAt).toBeInstanceOf(Date);
  });
});

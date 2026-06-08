/**
 * Unit tests for the pure helpers extracted from commands/hooks.ts.
 */
import { describe, it, expect } from 'vitest';
import { safeNum, formatIntelligenceStatus, formatWorkerStatus } from '../src/commands/hooks/helpers.js';

describe('safeNum (#1686)', () => {
  it('passes finite numbers through', () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(0)).toBe(0);
    expect(safeNum(-3.5)).toBe(-3.5);
  });
  it('coerces numeric strings', () => {
    expect(safeNum('7')).toBe(7);
  });
  it('falls back on null/undefined/NaN/Infinity/non-numeric', () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum(NaN)).toBe(0);
    expect(safeNum(Infinity)).toBe(0);
    expect(safeNum('abc')).toBe(0);
  });
  it('uses the provided fallback', () => {
    expect(safeNum(undefined, 5)).toBe(5);
    expect(safeNum('x', -1)).toBe(-1);
  });
});

describe('status formatters', () => {
  it('return the raw label for unknown statuses', () => {
    expect(formatIntelligenceStatus('weird')).toBe('weird');
    expect(formatWorkerStatus('weird')).toBe('weird');
  });
  it('return a non-empty string containing known statuses', () => {
    for (const s of ['active', 'training', 'idle', 'error']) {
      expect(formatIntelligenceStatus(s)).toContain(s);
    }
    for (const s of ['running', 'completed', 'failed', 'pending']) {
      expect(formatWorkerStatus(s)).toContain(s);
    }
  });
});

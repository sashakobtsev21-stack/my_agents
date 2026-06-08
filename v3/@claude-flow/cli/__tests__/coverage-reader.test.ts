/**
 * Unit tests for the coverage-reader module extracted from commands/hooks.ts.
 *
 * Covers the previously-untested disk coverage parsing logic that powers
 * `hooks coverage-gaps` / `coverage-route` / `coverage-suggest`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readCoverageFromDisk,
  parseCoverageSummaryJson,
  parseLcovInfo,
  classifyCoverageGap,
  suggestAgentsForFile,
} from '../src/commands/hooks/coverage-reader.js';

describe('parseCoverageSummaryJson', () => {
  it('parses Istanbul/Jest summary into entries + overall summary', () => {
    const data = {
      total: {
        lines: { pct: 80 },
        branches: { pct: 70 },
        functions: { pct: 90 },
        statements: { pct: 85 },
      },
      'src/a.ts': {
        lines: { total: 100, covered: 50, pct: 50 },
        branches: { total: 10, covered: 5, pct: 50 },
        functions: { total: 4, covered: 4, pct: 100 },
        statements: { total: 100, covered: 50, pct: 50 },
      },
      'src/b.ts': {
        lines: { total: 100, covered: 95, pct: 95 },
        branches: { total: 10, covered: 9, pct: 90 },
        functions: { total: 4, covered: 4, pct: 100 },
        statements: { total: 100, covered: 95, pct: 95 },
      },
    };
    const res = parseCoverageSummaryJson(data, 'coverage/coverage-summary.json');
    expect(res.found).toBe(true);
    expect(res.source).toBe('coverage/coverage-summary.json');
    expect(res.summary.totalFiles).toBe(2); // 'total' excluded from entries
    // overall taken from the `total` key
    expect(res.summary.overallLineCoverage).toBe(80);
    expect(res.summary.overallFunctionCoverage).toBe(90);
  });

  it('sorts entries by lowest line coverage first', () => {
    const data = {
      'high.ts': { lines: { total: 100, covered: 95, pct: 95 } },
      'low.ts': { lines: { total: 100, covered: 10, pct: 10 } },
      'mid.ts': { lines: { total: 100, covered: 60, pct: 60 } },
    };
    const res = parseCoverageSummaryJson(data, 's');
    expect(res.entries.map((e) => e.filePath)).toEqual(['low.ts', 'mid.ts', 'high.ts']);
  });

  it('derives overall from per-file totals when no `total` key is present', () => {
    const data = {
      'a.ts': { lines: { total: 100, covered: 40, pct: 40 } },
      'b.ts': { lines: { total: 100, covered: 60, pct: 60 } },
    };
    const res = parseCoverageSummaryJson(data, 's');
    // (40 + 60) / (100 + 100) = 50%
    expect(res.summary.overallLineCoverage).toBe(50);
  });
});

describe('parseLcovInfo', () => {
  it('parses an lcov record into a coverage entry', () => {
    const lcov = [
      'SF:src/foo.ts',
      'FNF:4',
      'FNH:2',
      'LF:100',
      'LH:75',
      'BRF:10',
      'BRH:5',
      'end_of_record',
    ].join('\n');
    const res = parseLcovInfo(lcov, 'coverage/lcov.info');
    expect(res.found).toBe(true);
    expect(res.entries).toHaveLength(1);
    const e = res.entries[0];
    expect(e.filePath).toBe('src/foo.ts');
    expect(e.lines).toBe(75); // 75/100
    expect(e.branches).toBe(50); // 5/10
    expect(e.functions).toBe(50); // 2/4
  });

  it('handles multiple records and sorts by lowest line coverage', () => {
    const lcov = [
      'SF:good.ts', 'LF:100', 'LH:90', 'end_of_record',
      'SF:bad.ts', 'LF:100', 'LH:20', 'end_of_record',
    ].join('\n');
    const res = parseLcovInfo(lcov, 's');
    expect(res.entries.map((e) => e.filePath)).toEqual(['bad.ts', 'good.ts']);
  });

  it('treats a file with no lines found as 0% lines', () => {
    const lcov = ['SF:empty.ts', 'LF:0', 'LH:0', 'end_of_record'].join('\n');
    const res = parseLcovInfo(lcov, 's');
    expect(res.entries[0].lines).toBe(0);
  });
});

describe('classifyCoverageGap', () => {
  const threshold = 80;
  it('flags critical below 25% of threshold', () => {
    expect(classifyCoverageGap(10, threshold)).toEqual({ gapType: 'critical', priority: 10 });
  });
  it('flags high below 50% of threshold', () => {
    expect(classifyCoverageGap(30, threshold)).toEqual({ gapType: 'high', priority: 7 });
  });
  it('flags medium below 75% of threshold', () => {
    expect(classifyCoverageGap(50, threshold)).toEqual({ gapType: 'medium', priority: 5 });
  });
  it('flags low below threshold', () => {
    expect(classifyCoverageGap(75, threshold)).toEqual({ gapType: 'low', priority: 3 });
  });
  it('flags ok at/above threshold', () => {
    expect(classifyCoverageGap(80, threshold)).toEqual({ gapType: 'ok', priority: 0 });
    expect(classifyCoverageGap(95, threshold)).toEqual({ gapType: 'ok', priority: 0 });
  });
});

describe('suggestAgentsForFile', () => {
  it('routes test/spec files to the tester', () => {
    expect(suggestAgentsForFile('src/foo.test.ts')).toEqual(['tester']);
    expect(suggestAgentsForFile('src/foo.spec.ts')).toEqual(['tester']);
  });
  it('routes security/auth files to the security auditor', () => {
    expect(suggestAgentsForFile('src/auth/login.ts')).toEqual(['security-auditor', 'tester']);
  });
  it('routes api/route/controller files to coder + tester', () => {
    expect(suggestAgentsForFile('src/api/users.ts')).toEqual(['coder', 'tester']);
  });
  it('falls back to tester + coder for generic files', () => {
    expect(suggestAgentsForFile('src/util/strings.ts')).toEqual(['tester', 'coder']);
  });
});

describe('readCoverageFromDisk', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cov-reader-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns found:false when no coverage artifacts exist', () => {
    const res = readCoverageFromDisk(dir);
    expect(res.found).toBe(false);
    expect(res.source).toBe('none');
    expect(res.entries).toEqual([]);
  });

  it('reads coverage/coverage-summary.json when present', () => {
    mkdirSync(join(dir, 'coverage'), { recursive: true });
    writeFileSync(
      join(dir, 'coverage', 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { pct: 42 } },
        'src/x.ts': { lines: { total: 100, covered: 42, pct: 42 } },
      }),
    );
    const res = readCoverageFromDisk(dir);
    expect(res.found).toBe(true);
    expect(res.source).toBe('coverage/coverage-summary.json');
    expect(res.summary.overallLineCoverage).toBe(42);
  });

  it('falls back to lcov.info when no summary json exists', () => {
    mkdirSync(join(dir, 'coverage'), { recursive: true });
    writeFileSync(
      join(dir, 'coverage', 'lcov.info'),
      ['SF:src/y.ts', 'LF:100', 'LH:33', 'end_of_record'].join('\n'),
    );
    const res = readCoverageFromDisk(dir);
    expect(res.found).toBe(true);
    expect(res.source).toBe('coverage/lcov.info');
    expect(res.entries[0].filePath).toBe('src/y.ts');
    expect(res.entries[0].lines).toBe(33);
  });

  it('ignores malformed summary json and returns found:false', () => {
    mkdirSync(join(dir, 'coverage'), { recursive: true });
    writeFileSync(join(dir, 'coverage', 'coverage-summary.json'), '{ not valid json');
    const res = readCoverageFromDisk(dir);
    expect(res.found).toBe(false);
  });
});

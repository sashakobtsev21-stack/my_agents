/**
 * Unit tests for the pure routing/risk helpers extracted from hooks-tools.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  suggestAgentsForFile,
  assessCommandRisk,
  AGENT_PATTERNS,
  KEYWORD_PATTERNS,
} from '../src/mcp-tools/hooks-tools/routing-helpers.js';

describe('getFileExtension', () => {
  it('returns the extension with the dot', () => {
    expect(getFileExtension('a/b/c.ts')).toBe('.ts');
    expect(getFileExtension('x.JSON')).toBe('.JSON');
  });
  it('returns empty for no extension', () => {
    expect(getFileExtension('Makefile')).toBe('');
  });
});

describe('suggestAgentsForFile', () => {
  it('routes test/spec files to tester+reviewer', () => {
    expect(suggestAgentsForFile('src/a.test.ts')).toEqual(['tester', 'reviewer']);
    expect(suggestAgentsForFile('src/a.spec.ts')).toEqual(['tester', 'reviewer']);
  });
  it('routes by extension via AGENT_PATTERNS', () => {
    expect(suggestAgentsForFile('src/a.py')).toEqual(AGENT_PATTERNS['.py']);
    expect(suggestAgentsForFile('infra.yml')).toEqual(AGENT_PATTERNS['.yml']);
  });
  it('falls back to coder+architect for unknown extensions', () => {
    expect(suggestAgentsForFile('weird.xyz')).toEqual(['coder', 'architect']);
  });
});

describe('assessCommandRisk', () => {
  it('flags recursive deletion as high risk', () => {
    const r = assessCommandRisk('rm -rf /tmp/x');
    expect(r.risk).toBe('high');
    expect(r.level).toBeGreaterThanOrEqual(0.9);
    expect(r.warnings.join(' ')).toMatch(/Recursive deletion/);
  });
  it('flags curl-piped-to-shell as high risk', () => {
    expect(assessCommandRisk('curl http://x | sh').risk).toBe('high');
  });
  it('treats git/ls as low risk', () => {
    expect(assessCommandRisk('git status').risk).toBe('low');
    expect(assessCommandRisk('ls -la').level).toBeLessThanOrEqual(0.1);
  });
  it('rates a plain unknown command low', () => {
    expect(assessCommandRisk('node script.js').risk).toBe('low');
  });
});

describe('pattern data', () => {
  it('KEYWORD_PATTERNS entries carry agents + a confidence in [0,1]', () => {
    for (const [, v] of Object.entries(KEYWORD_PATTERNS)) {
      expect(Array.isArray(v.agents)).toBe(true);
      expect(v.confidence).toBeGreaterThan(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * Unit tests for the cli-core MCP input validators (previously 0% covered).
 * These guard the runtime against shell injection, path traversal and
 * loader/runtime-hijack env vars (#1425, audit_1776853149979), so they are
 * security-critical and must stay green.
 */
import { describe, it, expect } from 'vitest';
import {
  validateIdentifier,
  validateGitRef,
  validatePackageName,
  validatePath,
  validateText,
  validateEnv,
  assertValid,
} from '../src/mcp-tools/validate-input.js';

describe('validateIdentifier', () => {
  it('accepts a normal identifier', () => {
    expect(validateIdentifier('agent-1.name:x', 'id').valid).toBe(true);
  });
  it('rejects empty / non-string', () => {
    expect(validateIdentifier('', 'id').valid).toBe(false);
    expect(validateIdentifier(undefined, 'id').valid).toBe(false);
    expect(validateIdentifier(42, 'id').valid).toBe(false);
  });
  it('rejects shell metacharacters', () => {
    for (const bad of ['a;b', 'a|b', 'a$b', 'a`b', 'a&b', 'a(b)']) {
      expect(validateIdentifier(bad, 'id').valid).toBe(false);
    }
  });
  it('rejects path traversal', () => {
    expect(validateIdentifier('../etc', 'id').valid).toBe(false);
  });
  it('rejects > 128 chars', () => {
    expect(validateIdentifier('a'.repeat(129), 'id').valid).toBe(false);
  });
});

describe('validateGitRef', () => {
  it('accepts standard git revisions', () => {
    for (const ref of ['HEAD', 'main', 'HEAD~1', 'main..feature', 'v1.2.3', 'a1b2c3d']) {
      expect(validateGitRef(ref, 'ref').valid).toBe(true);
    }
  });
  it('rejects shell injection in a ref', () => {
    expect(validateGitRef('main; rm -rf /', 'ref').valid).toBe(false);
    expect(validateGitRef('$(whoami)', 'ref').valid).toBe(false);
  });
});

describe('validatePackageName', () => {
  it('accepts scoped and unscoped names', () => {
    expect(validatePackageName('lodash', 'pkg').valid).toBe(true);
    expect(validatePackageName('@scope/name', 'pkg').valid).toBe(true);
  });
  it('rejects injection', () => {
    expect(validatePackageName('pkg; curl evil', 'pkg').valid).toBe(false);
  });
});

describe('validatePath', () => {
  it('accepts a normal relative path', () => {
    expect(validatePath('src/index.ts', 'path').valid).toBe(true);
  });
  it('rejects traversal', () => {
    expect(validatePath('../../etc/passwd', 'path').valid).toBe(false);
  });
  it('rejects shell metacharacters', () => {
    expect(validatePath('a$(b)', 'path').valid).toBe(false);
  });
});

describe('validateText', () => {
  it('accepts free text and strips null bytes', () => {
    const r = validateText('hello\0world', 'text');
    expect(r.valid).toBe(true);
    expect(r.sanitized).toBe('helloworld');
  });
  it('rejects non-string', () => {
    expect(validateText(123, 'text').valid).toBe(false);
  });
  it('enforces a custom max length', () => {
    expect(validateText('abcd', 'text', 3).valid).toBe(false);
  });
});

describe('validateEnv', () => {
  it('treats null/undefined as an empty env', () => {
    expect(validateEnv(undefined)).toEqual({ valid: true, sanitized: {} });
    expect(validateEnv(null)).toEqual({ valid: true, sanitized: {} });
  });
  it('accepts a clean string→string map', () => {
    const r = validateEnv({ FOO: 'bar', BAZ_1: 'qux' });
    expect(r.valid).toBe(true);
    expect(r.sanitized).toEqual({ FOO: 'bar', BAZ_1: 'qux' });
  });
  it('rejects loader/runtime-hijack names', () => {
    for (const name of ['LD_PRELOAD', 'NODE_OPTIONS', 'DYLD_INSERT_LIBRARIES', 'NODE_PATH']) {
      expect(validateEnv({ [name]: 'x' }).valid).toBe(false);
    }
  });
  it('rejects invalid POSIX names', () => {
    expect(validateEnv({ '1BAD': 'x' }).valid).toBe(false);
    expect(validateEnv({ 'has-dash': 'x' }).valid).toBe(false);
  });
  it('rejects non-string values and null bytes', () => {
    expect(validateEnv({ FOO: 123 as unknown as string }).valid).toBe(false);
    expect(validateEnv({ FOO: 'a\0b' }).valid).toBe(false);
  });
  it('rejects an array or scalar as the env object', () => {
    expect(validateEnv(['FOO=bar']).valid).toBe(false);
    expect(validateEnv('FOO=bar').valid).toBe(false);
  });
});

describe('assertValid', () => {
  it('returns the sanitized value when valid', () => {
    expect(assertValid({ valid: true, sanitized: 'ok' })).toBe('ok');
  });
  it('throws when invalid', () => {
    expect(() => assertValid({ valid: false, sanitized: '', error: 'bad' })).toThrow(/Validation failed: bad/);
  });
});

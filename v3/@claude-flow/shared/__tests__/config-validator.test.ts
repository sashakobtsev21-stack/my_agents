/**
 * Unit tests for the V3 config validator (Zod-backed). Previously uncovered.
 * Validates the config surface every swarm/agent/memory subsystem is built on,
 * so a regression here mis-validates user config silently.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAgentConfig,
  validateTaskConfig,
  validateSwarmConfig,
  validateMemoryConfig,
  ConfigValidator,
} from '../src/core/config/validator.js';
import { AgentConfigSchema } from '../src/core/config/schema.js';

describe('validateAgentConfig', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const r = validateAgentConfig({ id: 'a1', name: 'A', type: 'coder' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      id: 'a1',
      capabilities: [],
      maxConcurrentTasks: 5,
      priority: 50,
    });
  });

  it('rejects a missing required field with a pathed error', () => {
    const r = validateAgentConfig({ name: 'A', type: 'coder' }); // no id
    expect(r.success).toBe(false);
    expect(r.data).toBeUndefined();
    expect(r.errors?.some((e) => e.path === 'id')).toBe(true);
    expect(r.errors?.[0]).toHaveProperty('message');
    expect(r.errors?.[0]).toHaveProperty('code');
  });

  it('rejects an out-of-range priority', () => {
    const r = validateAgentConfig({ id: 'a1', name: 'A', type: 'coder', priority: 200 });
    expect(r.success).toBe(false);
    expect(r.errors?.some((e) => e.path === 'priority')).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(validateAgentConfig(null).success).toBe(false);
    expect(validateAgentConfig('nope').success).toBe(false);
  });
});

describe('validateTaskConfig', () => {
  it('accepts type+description and defaults priority', () => {
    const r = validateTaskConfig({ type: 'build', description: 'do it' });
    expect(r.success).toBe(true);
    expect(r.data?.priority).toBe(50);
  });
  it('rejects missing description', () => {
    const r = validateTaskConfig({ type: 'build' });
    expect(r.success).toBe(false);
    expect(r.errors?.some((e) => e.path === 'description')).toBe(true);
  });
});

describe('validateSwarmConfig', () => {
  it('accepts a known topology and defaults maxAgents', () => {
    const r = validateSwarmConfig({ topology: 'hierarchical' });
    expect(r.success).toBe(true);
    expect(r.data?.maxAgents).toBe(20);
  });
  it('rejects an unknown topology', () => {
    const r = validateSwarmConfig({ topology: 'banana' });
    expect(r.success).toBe(false);
    expect(r.errors?.some((e) => e.path === 'topology')).toBe(true);
  });
});

describe('validateMemoryConfig', () => {
  it('defaults type to hybrid for an empty object', () => {
    const r = validateMemoryConfig({});
    expect(r.success).toBe(true);
    expect(r.data?.type).toBe('hybrid');
  });
});

describe('ConfigValidator.*OrThrow', () => {
  it('returns the parsed config on success', () => {
    const cfg = ConfigValidator.validateAgentOrThrow({ id: 'a1', name: 'A', type: 'coder' });
    expect(cfg.id).toBe('a1');
  });

  it('throws with a formatted, pathed message on failure', () => {
    expect(() => ConfigValidator.validateAgentOrThrow({ name: 'A', type: 'coder' })).toThrow(
      /Invalid agent configuration[\s\S]*id/i,
    );
  });

  it('validateSwarmOrThrow throws on a bad topology', () => {
    expect(() => ConfigValidator.validateSwarmOrThrow({ topology: 'nope' })).toThrow(/swarm/i);
  });
});

describe('ConfigValidator.isValid', () => {
  it('returns true/false without throwing', () => {
    expect(ConfigValidator.isValid(AgentConfigSchema, { id: 'a1', name: 'A', type: 'coder' })).toBe(true);
    expect(ConfigValidator.isValid(AgentConfigSchema, { name: 'A' })).toBe(false);
  });
});

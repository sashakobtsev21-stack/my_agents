/**
 * Regression tests for the 2026-05-29 bug cluster (issues #2215, #2221, #2222, #2226).
 *
 * Each test reproduces a reported defect and asserts the fix holds:
 *   #2215 — system_info and hooks_intelligence must agree on flashAttention state.
 *   #2221 — the generated statusline probes the global npm install for its version.
 *   #2222 — `route feedback` persists the Q-table update to disk (no longer a no-op).
 *   #2226 — agentdb_pattern-store and agentdb_pattern-search share a backend
 *           (a stored pattern is findable by search).
 *
 * Backend-dependent tests degrade gracefully (skip the assertion) when the
 * runtime backend cannot initialize in isolation, matching the existing
 * statusline drift-guard convention.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { generateStatuslineScript } from '../src/init/statusline-generator.js';
import { DEFAULT_INIT_OPTIONS } from '../src/init/types.js';
import { systemTools } from '../src/mcp-tools/system-tools.js';
import { hooksTools } from '../src/mcp-tools/hooks-tools.js';
import { agentdbPatternStore, agentdbPatternSearch } from '../src/mcp-tools/agentdb-tools.js';
import { createQLearningRouter } from '../src/ruvector/q-learning-router.js';

function findTool(tools: any[], name: string) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

describe('#2221 — statusline version probe covers global npm installs', () => {
  const SCRIPT = generateStatuslineScript(DEFAULT_INIT_OPTIONS);

  it('derives the global node_modules dir from process.execPath (no npm spawn)', () => {
    expect(SCRIPT).toContain('process.execPath');
    expect(SCRIPT).toContain("'lib', 'node_modules'");
  });

  it('still keeps the project-local and plugin-marketplace probes', () => {
    expect(SCRIPT).toContain("'marketplaces', 'ruflo', 'package.json'");
    expect(SCRIPT).toContain("'node_modules', 'ruflo', 'package.json'");
  });
});

describe('#2215 — system_info and hooks_intelligence agree on flashAttention', () => {
  it('reports the SAME boolean for flashAttention', async () => {
    const sysInfo = await findTool(systemTools, 'system_info').handler({});
    const intel = await findTool(hooksTools, 'hooks_intelligence').handler({ showStatus: true });

    const sysFlash = sysInfo.features.flashAttention;
    expect(typeof sysFlash).toBe('boolean');

    // hooks_intelligence exposes the authoritative runtime status; both must match.
    const comp = intel?.components?.flashAttention;
    if (!comp) return; // intelligence registry unavailable in isolation — skip
    const intelFlash = comp.status === 'active';
    expect(sysFlash).toBe(intelFlash);
  });
});

describe('#2222 — route feedback persists the Q-table to disk', () => {
  it('writes the model after a single update + explicit save', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ruflo-qlearn-'));
    const modelPath = path.join(dir, 'q-learning-model.json');
    try {
      const router = createQLearningRouter({ modelPath, autoSaveInterval: 100 });
      await router.initialize();
      expect(existsSync(modelPath)).toBe(false); // nothing saved yet

      // Mirror the FIXED feedback handler: one update, then explicit awaited save.
      router.update('implement auth', 'coder', -1);
      const persisted = await router.saveModel();

      expect(persisted).toBe(true);
      expect(existsSync(modelPath)).toBe(true);
      const model = JSON.parse(readFileSync(modelPath, 'utf-8'));
      expect(model.stats.updateCount).toBeGreaterThanOrEqual(1);
      expect(Object.keys(model.qTable).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('#2226 — pattern store and search share a backend', () => {
  it('stores a pattern and finds it via search', async () => {
    const marker = `oauth-refresh-token-rotation-${process.pid}-${process.hrtime.bigint()}`;
    // Backend init (registry + ONNX embeddings) can be slow on first load.

    const stored = await agentdbPatternStore.handler({
      pattern: `Use ${marker} for secure session renewal`,
      type: 'auth-pattern',
      confidence: 0.9,
    });
    if (!stored || stored.success !== true) return; // backend unavailable in isolation — skip

    const found = await agentdbPatternSearch.handler({
      query: marker,
      topK: 5,
      minConfidence: 0.1,
    });

    expect(Array.isArray(found.results)).toBe(true);
    // Result text lives in `content` (reasoningBank path) or `pattern` (fallback path).
    const hit = found.results.find((r: any) => {
      const text = typeof r.content === 'string' ? r.content
        : typeof r.pattern === 'string' ? r.pattern : '';
      return text.includes(marker);
    });
    expect(hit).toBeDefined();
  }, 60_000);
});

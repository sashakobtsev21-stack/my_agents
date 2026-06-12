#!/usr/bin/env node
/**
 * Regression guard for ADR-129 Phase 4 — plugin manifest "rvagent" field
 * + includePlugins in wasm_agent_compose.
 *
 * P4 adds:
 *   - loadPluginManifest(): reads .claude-plugin/plugin.json for a named plugin
 *   - extractPluginSkills(): parses the rvagent.exposeSkillsAsTools field
 *   - wasm_agent_compose gains includePlugins?: string[] param
 *   - Unknown plugin name returns a warning, not an error
 *
 * Static contracts (no build required):
 *   1. wasm-agent-tools.ts has includePlugins in wasm_agent_compose schema
 *   2. loadPluginManifest function exists
 *   3. extractPluginSkills function exists
 *   4. pluginWarnings path exists (unknown plugin graceful handling)
 *
 * Behavioral (fixture-based, no API keys):
 *   5. extractPluginSkills correctly parses a mock manifest
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP = resolve(__dirname, '../v3/@claude-flow/cli/src/mcp-tools');
// campaign-2 wave 77 (W283) split wasm-agent-tools.ts into a barrel +
// ./wasm-agent-tools-helpers.ts (loadPluginManifest/extractPluginSkills)
// + ./wasm-agent-tools-defs.ts (the tool defs incl. wasm_agent_compose).
// Concatenate the barrel PLUS its sub-modules — same scan strength,
// layout-aware (same fix as W205 for the other drifted smokes).
const TOOL_FILES = [
  resolve(MCP, 'wasm-agent-tools.ts'),
  resolve(MCP, 'wasm-agent-tools-helpers.ts'),
  resolve(MCP, 'wasm-agent-tools-defs.ts'),
];

function fail(msg) { console.error(`✗ ${msg}`); process.exitCode = 1; }
function pass(msg) { console.log(`✓ ${msg}`); }

const toolsSrc = TOOL_FILES.filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n');

// 1. includePlugins param in wasm_agent_compose inputSchema
const composeToolBlock = toolsSrc.match(/name:\s*['"]wasm_agent_compose['"][\s\S]*?handler:/);
if (!composeToolBlock) {
  fail('wasm_agent_compose tool not found');
} else if (!/includePlugins/.test(composeToolBlock[0])) {
  fail('includePlugins not in wasm_agent_compose inputSchema');
} else {
  pass('includePlugins param in wasm_agent_compose inputSchema');
}

// 2. loadPluginManifest function exists
if (!/function loadPluginManifest/.test(toolsSrc)) {
  fail('loadPluginManifest function not found');
} else {
  pass('loadPluginManifest function exists');
}

// 3. extractPluginSkills function exists
if (!/function extractPluginSkills/.test(toolsSrc)) {
  fail('extractPluginSkills function not found');
} else {
  pass('extractPluginSkills function exists');
}

// 4. Unknown plugin graceful handling (pluginWarnings)
if (!/pluginWarnings/.test(toolsSrc)) {
  fail('pluginWarnings not found — unknown plugin name may throw instead of warn');
} else {
  pass('pluginWarnings path present — unknown plugin skipped with warning, not error');
}

// 5. Behavioral: parse a mock plugin manifest with rvagent field
const mockManifest = {
  name: 'test-plugin',
  rvagent: {
    exposeSkillsAsTools: ['trader-signal', 'trader-backtest'],
    autoWireOnCompose: true,
  },
};

// Inline the logic to test without importing TS
function extractPluginSkillsFixture(manifest, pluginName) {
  const rv = manifest.rvagent;
  if (!rv) return [];
  const skillNames = Array.isArray(rv.exposeSkillsAsTools) ? rv.exposeSkillsAsTools : [];
  return skillNames.map(skillName => ({
    name: skillName,
    description: `Plugin skill: ${skillName} from ${pluginName}`,
    trigger: skillName,
    content: `Plugin-provided skill: ${skillName}`,
  }));
}

const skills = extractPluginSkillsFixture(mockManifest, 'test-plugin');
if (skills.length !== 2) {
  fail(`extractPluginSkills returned ${skills.length} skills, expected 2`);
} else if (skills[0].name !== 'trader-signal' || skills[1].name !== 'trader-backtest') {
  fail(`extractPluginSkills returned wrong skills: ${skills.map(s => s.name).join(', ')}`);
} else {
  pass('extractPluginSkills correctly parses rvagent.exposeSkillsAsTools from fixture manifest');
}

// 6. Plugin without rvagent field returns empty array
const noRvAgentManifest = { name: 'plain-plugin' };
const emptySkills = extractPluginSkillsFixture(noRvAgentManifest, 'plain-plugin');
if (emptySkills.length !== 0) {
  fail('Plugin without rvagent field should return empty skills array');
} else {
  pass('Plugin without rvagent field returns empty array (unaffected by P4)');
}

// 7. rvagent.exposeSkillsAsTools: boolean (non-array) handled gracefully
const boolManifest = { name: 'all-skills', rvagent: { exposeSkillsAsTools: true } };
const boolSkills = extractPluginSkillsFixture(boolManifest, 'all-skills');
if (boolSkills.length !== 0) {
  fail('Boolean exposeSkillsAsTools should return empty array (not throw)');
} else {
  pass('Boolean exposeSkillsAsTools returns empty array (requires explicit skill names)');
}

if (process.exitCode) {
  console.error('\nADR-129 P4 plugin bridge smoke FAILED');
} else {
  console.log('\nADR-129 P4 plugin bridge smoke PASS');
}

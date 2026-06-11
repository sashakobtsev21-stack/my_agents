/**
 * WASM Agent MCP Tools — safety filters & plugin manifest helpers
 *
 * Module-private in the original wasm-agent-tools.ts (campaign-2 W283);
 * NOT re-exported by the barrel.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DESTRUCTIVE_TOOL_PATTERNS = [
  /^memory_delete$/,
  /^federation_/,
  /^swarm_shutdown$/,
  /^agent_terminate$/,
  /_delete$/,
  /_remove$/,
  /_drop$/,
  /_shutdown$/,
];

export function isDestructiveTool(name: string): boolean {
  return DESTRUCTIVE_TOOL_PATTERNS.some(p => p.test(name));
}

/** Safe-by-default MCP tool allowlist for wasm_agent_compose. */
export const SAFE_MCP_TOOLS = new Set([
  'memory_search', 'memory_retrieve', 'memory_list', 'memory_stats',
  'memory_store', 'memory_compress', 'memory_export',
  'embeddings_search', 'embeddings_search_text', 'embeddings_generate',
  'embeddings_status', 'embeddings_compare',
  'hooks_post_task', 'hooks_pre_task', 'hooks_route', 'hooks_metrics',
  'wasm_agent_list', 'wasm_agent_status', 'wasm_agent_files',
  'wasm_gallery_list', 'wasm_gallery_search', 'wasm_gallery_categories',
  'agentdb_pattern_search', 'agentdb_hierarchical_recall',
  'neural_predict', 'neural_patterns', 'neural_status',
  'task_list', 'task_status', 'task_summary',
]);

// ── ADR-129 P4 — Plugin manifest reader ─────────────────────────────────────

export interface PluginRvagentConfig {
  exposeSkillsAsTools?: string[] | boolean;
  autoWireOnCompose?: boolean;
}

export interface PluginManifest {
  name?: string;
  rvagent?: PluginRvagentConfig;
}

/**
 * Load and parse a plugin's plugin.json, extracting the optional rvagent field.
 * Returns null silently if the plugin or its manifest is missing.
 */
export function loadPluginManifest(pluginName: string): PluginManifest | null {
  const candidateDirs = [
    resolve(process.cwd(), 'plugins', pluginName, '.claude-plugin', 'plugin.json'),
    resolve(process.cwd(), 'plugins', `ruflo-${pluginName}`, '.claude-plugin', 'plugin.json'),
    resolve(process.cwd(), 'v3', 'plugins', pluginName, '.claude-plugin', 'plugin.json'),
  ];
  for (const p of candidateDirs) {
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')) as PluginManifest; } catch { /* skip */ }
    }
  }
  return null;
}

/**
 * Extract skills declared for WASM agent exposure from a plugin manifest.
 * Handles both string[] and boolean forms of exposeSkillsAsTools.
 */
export function extractPluginSkills(manifest: PluginManifest, pluginName: string): Array<{ name: string; description: string; trigger: string; content: string }> {
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


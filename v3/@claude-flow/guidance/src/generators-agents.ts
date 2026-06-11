/**
 * Generators — SKILL.md / agent .md templates
 *
 * generateSkillMd + generateAgentMd. Extracted verbatim from
 * generators.ts (lines 398-506) during campaign-2 wave 30 (W236).
 * generators.ts stays the barrel.
 */

import type { AgentDefinition, SkillDefinition } from './generators.js';

function formatTitle(kebab: string): string {
  return kebab
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// Skills Generator
// ============================================================================

export function generateSkillMd(skill: SkillDefinition): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`name: ${skill.name}`);
  lines.push(`version: ${skill.version || '1.0.0'}`);
  lines.push(`description: ${skill.description}`);
  lines.push(`category: ${skill.category}`);
  if (skill.tags && skill.tags.length > 0) {
    lines.push(`tags: [${skill.tags.join(', ')}]`);
  }
  if (skill.requires && skill.requires.length > 0) {
    lines.push('requires:');
    for (const r of skill.requires) {
      lines.push(`  - ${r}`);
    }
  }
  if (skill.capabilities && skill.capabilities.length > 0) {
    lines.push('capabilities:');
    for (const c of skill.capabilities) {
      lines.push(`  - ${c}`);
    }
  }
  lines.push('---');
  lines.push('');

  // Skill title and instructions
  lines.push(`# ${formatTitle(skill.name)} Skill`);
  lines.push('');
  lines.push(skill.instructions);

  return lines.join('\n');
}

// ============================================================================
// Agent Definition Generator
// ============================================================================

export function generateAgentMd(agent: AgentDefinition): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`name: ${agent.name}`);
  lines.push(`type: ${agent.type}`);
  if (agent.color) {
    lines.push(`color: "${agent.color}"`);
  }
  lines.push(`description: ${agent.description}`);
  if (agent.capabilities && agent.capabilities.length > 0) {
    lines.push('capabilities:');
    for (const c of agent.capabilities) {
      lines.push(`  - ${c}`);
    }
  }
  if (agent.focus && agent.focus.length > 0) {
    lines.push('focus:');
    for (const f of agent.focus) {
      lines.push(`  - ${f}`);
    }
  }
  lines.push(`temperature: ${agent.temperature ?? 0.2}`);
  if (agent.priority) {
    lines.push(`priority: ${agent.priority}`);
  }
  if (agent.preHook || agent.postHook) {
    lines.push('hooks:');
    if (agent.preHook) {
      lines.push('  pre: |');
      lines.push(`    ${agent.preHook}`);
    }
    if (agent.postHook) {
      lines.push('  post: |');
      lines.push(`    ${agent.postHook}`);
    }
  }
  lines.push('---');
  lines.push('');

  // Agent title
  lines.push(`# ${formatTitle(agent.name)} Agent`);
  lines.push('');
  lines.push(agent.description);
  lines.push('');

  // System prompt
  if (agent.systemPrompt) {
    lines.push('## System Prompt');
    lines.push('');
    lines.push(agent.systemPrompt);
    lines.push('');
  }

  // Instructions
  if (agent.instructions) {
    lines.push('## Instructions');
    lines.push('');
    lines.push(agent.instructions);
    lines.push('');
  }

  return lines.join('\n');
}


/**
 * @claude-flow/codex - SKILL.md Generator
 *
 * Generates SKILL.md files for OpenAI Codex CLI skills
 * Uses YAML frontmatter for metadata
 */

import type { SkillMdOptions, SkillCommand } from '../types.js';

/**
 * Generate a SKILL.md file based on the provided options
 */
export async function generateSkillMd(options: SkillMdOptions): Promise<string> {
  const {
    name,
    description,
    version = '1.0.0',
    author = 'rUv',
    tags,
    triggers = [],
    skipWhen = [],
    scripts = [],
    references = [],
    commands = [],
  } = options;

  // Derive discovery tags from the skill name when not supplied explicitly.
  const tagList = tags && tags.length > 0 ? tags : name.split('-').filter(Boolean);

  // Build YAML frontmatter
  const triggerText = triggers.length > 0
    ? `Use when: ${triggers.join(', ')}.`
    : '';
  const skipText = skipWhen.length > 0
    ? `Skip when: ${skipWhen.join(', ')}.`
    : '';

  const frontmatter = `---
name: ${name}
version: "${version}"
author: ${author}
tags: [${tagList.join(', ')}]
description: >
  ${description}
  ${triggerText}
  ${skipText}
---`;

  // Build commands section
  const commandsSection = commands.length > 0
    ? buildCommandsSection(commands)
    : '';

  // Build scripts section
  const scriptsSection = scripts.length > 0
    ? buildScriptsSection(scripts)
    : '';

  // Build references section
  const referencesSection = references.length > 0
    ? buildReferencesSection(references)
    : '';

  // Combine all sections
  return `${frontmatter}

# ${formatSkillName(name)} Skill

## Purpose
${description}

## When to Trigger
${triggers.length > 0 ? triggers.map(t => `- ${t}`).join('\n') : '- Define triggers for this skill'}

## When to Skip
${skipWhen.length > 0 ? skipWhen.map(s => `- ${s}`).join('\n') : '- Define skip conditions for this skill'}
${commandsSection}
${scriptsSection}
${referencesSection}
## Best Practices
1. Check memory for existing patterns before starting
2. Use hierarchical topology for coordination
3. Store successful patterns after completion
4. Document any new learnings
`;
}

/**
 * Build the commands section of the SKILL.md
 */
function buildCommandsSection(commands: SkillCommand[]): string {
  const lines = commands.map(cmd => {
    let block = `### ${cmd.name}\n${cmd.description}\n\n\`\`\`bash\n${cmd.command}\n\`\`\``;
    if (cmd.example) {
      block += `\n\n**Example:**\n\`\`\`bash\n${cmd.example}\n\`\`\``;
    }
    return block;
  });

  return `
## Commands

${lines.join('\n\n')}
`;
}

/**
 * Build the scripts section
 */
function buildScriptsSection(scripts: { name: string; path: string; description: string }[]): string {
  const lines = scripts.map(s => `| \`${s.name}\` | \`${s.path}\` | ${s.description} |`);

  return `
## Scripts

| Script | Path | Description |
|--------|------|-------------|
${lines.join('\n')}
`;
}

/**
 * Build the references section
 */
function buildReferencesSection(references: { name: string; path: string; description?: string }[]): string {
  const lines = references.map(r =>
    `| \`${r.name}\` | \`${r.path}\` | ${r.description ?? ''} |`
  );

  return `
## References

| Document | Path | Description |
|----------|------|-------------|
${lines.join('\n')}
`;
}

/**
 * Format skill name for display (kebab-case to Title Case)
 */
function formatSkillName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate a skill from a built-in template
 */

// generateBuiltInSkill (the bundled-skill catalog) and the private
// generateHelperScript templates were extracted into
// ./skill-md-builtin.ts and ./skill-md-scripts.ts during campaign-2
// wave 2 (W208). Re-export the public name so src/index.ts and
// initializer.ts resolve byte-identically. (skill-md <-> skill-md-builtin
// is an intentional static cycle: builtin imports generateSkillMd back;
// both are function declarations, so evaluation order is safe.)
export { generateBuiltInSkill } from './skill-md-builtin.js';

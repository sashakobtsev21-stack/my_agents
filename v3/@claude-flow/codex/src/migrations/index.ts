/**
 * @claude-flow/codex - Migrations
 *
 * Migration utilities for converting Claude Code configurations to Codex format
 * Supports full CLAUDE.md parsing with section extraction, skill conversion,
 * and proper AGENTS.md/config.toml generation.
 */

import type {
  MigrationOptions,
  MigrationResult,
  FeatureMapping,
  AgentsMdOptions,
  ConfigTomlOptions,
  McpServerConfig,
  ApprovalPolicy,
  SandboxMode,
} from '../types.js';
// Parsed-CLAUDE.md structure types moved to ./types.ts (W151, P3.30 cut #1).
import type {
  ParsedClaudeMd, ParsedSection, SkillReference, CodeBlock, ParsedSettings,
} from './types.js';
export type {
  ParsedClaudeMd, ParsedSection, SkillReference, CodeBlock, ParsedSettings,
} from './types.js';


/**
 * Feature mappings between Claude Code and Codex
 */
export const FEATURE_MAPPINGS: FeatureMapping[] = [
  {
    claudeCode: 'CLAUDE.md',
    codex: 'AGENTS.md',
    status: 'mapped',
    notes: 'Main instruction file - content is portable',
  },
  {
    claudeCode: 'CLAUDE.local.md',
    codex: '.codex/AGENTS.override.md',
    status: 'mapped',
    notes: 'Local overrides - gitignored in both',
  },
  {
    claudeCode: 'settings.json',
    codex: 'config.toml',
    status: 'mapped',
    notes: 'Format conversion required (JSON to TOML)',
  },
  {
    claudeCode: '/skill-name',
    codex: '$skill-name',
    status: 'mapped',
    notes: 'Skill invocation syntax - search and replace',
  },
  {
    claudeCode: 'TodoWrite',
    codex: 'Task tracking',
    status: 'mapped',
    notes: 'Similar functionality with different API',
  },
  {
    claudeCode: 'Task tool agents',
    codex: 'Sub-agent collaboration',
    status: 'partial',
    notes: 'Codex sub-agents via CODEX_HANDOFF_TARGET env var',
  },
  {
    claudeCode: 'MCP servers',
    codex: '[mcp_servers]',
    status: 'mapped',
    notes: 'Configuration format differs but same functionality',
  },
  {
    claudeCode: 'hooks system',
    codex: 'Automations',
    status: 'partial',
    notes: 'Codex automations are scheduled, not event-driven',
  },
  {
    claudeCode: 'EnterPlanMode',
    codex: 'No direct equivalent',
    status: 'unsupported',
    notes: 'Codex uses different planning paradigm',
  },
  {
    claudeCode: 'Permission modes',
    codex: 'approval_policy + sandbox_mode',
    status: 'mapped',
    notes: 'Codex provides more granular control',
  },
];

/**
 * Hook keywords recognized in CLAUDE.md
 */

// The parser (with its private extractors/tables) and the generators
// were extracted into ./parser.ts and ./generators.ts during campaign-2
// wave 6 (W212). 'export *' keeps the public surface byte-identical;
// the migrate orchestrators stay here.
export * from './parser.js';
export * from './generators.js';
import { analyzeClaudeMd, parseClaudeMd } from './parser.js';
import {
  convertSettingsToToml,
  convertSkillSyntax,
  generateAgentsMdFromParsed,
  generateConfigTomlFromParsed,
} from './generators.js';

export async function migrateFromClaudeCode(options: MigrationOptions): Promise<MigrationResult> {
  const { sourcePath, targetPath, preserveComments = true, generateSkills = true } = options;

  try {
    // In actual implementation, this would read the file
    // For now, we provide the structure for the migration

    const result: MigrationResult = {
      success: true,
      agentsMdPath: `${targetPath}/AGENTS.md`,
      skillsCreated: generateSkills
        ? ['swarm-orchestration', 'memory-management', 'security-audit']
        : [],
      configTomlPath: `${targetPath}/.agents/config.toml`,
      mappings: FEATURE_MAPPINGS,
      warnings: [
        'Review skill invocation syntax (changed from / to $)',
        'Check hook configurations for Automation compatibility',
        'Verify MCP server configurations in config.toml',
      ],
    };

    return result;
  } catch (error) {
    return {
      success: false,
      warnings: [`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Perform full migration with content
 */
export async function performFullMigration(
  claudeMdContent: string,
  settingsJson?: Record<string, unknown>
): Promise<{
  agentsMd: string;
  configToml: string;
  warnings: string[];
  skillsToCreate: string[];
}> {
  // Parse CLAUDE.md
  const parsed = await parseClaudeMd(claudeMdContent);

  // Generate AGENTS.md
  let agentsMd = generateAgentsMdFromParsed(parsed);

  // Convert skill syntax in the generated content
  agentsMd = convertSkillSyntax(agentsMd);

  // Generate config.toml
  let configToml: string;
  if (settingsJson) {
    configToml = convertSettingsToToml(settingsJson);
  } else {
    configToml = generateConfigTomlFromParsed(parsed);
  }

  // Collect skills to create
  const skillsToCreate = [...new Set(parsed.skills.map((s) => s.name))];

  return {
    agentsMd,
    configToml,
    warnings: parsed.warnings,
    skillsToCreate,
  };
}

/**
 * Generate migration report
 */
export function generateMigrationReport(result: MigrationResult): string {
  const lines: string[] = [];

  lines.push('# Migration Report');
  lines.push('');
  lines.push(`**Status**: ${result.success ? 'Success' : 'Failed'}`);
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push('');

  if (result.agentsMdPath) {
    lines.push('## Generated Files');
    lines.push('');
    lines.push(`- AGENTS.md: \`${result.agentsMdPath}\``);
    if (result.configTomlPath) {
      lines.push(`- config.toml: \`${result.configTomlPath}\``);
    }
    lines.push('');
  }

  if (result.skillsCreated && result.skillsCreated.length > 0) {
    lines.push('## Skills Created');
    lines.push('');
    for (const skill of result.skillsCreated) {
      lines.push(`- \`$${skill}\``);
    }
    lines.push('');
  }

  if (result.mappings) {
    lines.push('## Feature Mappings');
    lines.push('');
    lines.push('| Claude Code | Codex | Status | Notes |');
    lines.push('|-------------|-------|--------|-------|');
    for (const mapping of result.mappings) {
      const notes = mapping.notes || '';
      lines.push(`| \`${mapping.claudeCode}\` | \`${mapping.codex}\` | ${mapping.status} | ${notes} |`);
    }
    lines.push('');
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Review generated AGENTS.md for accuracy');
  lines.push('2. Update skill references from `/skill-name` to `$skill-name`');
  lines.push('3. Configure MCP servers in config.toml');
  lines.push('4. Create skill definitions in `.agents/skills/`');
  lines.push('5. Test with `codex` CLI');
  lines.push('');

  return lines.join('\n');
}

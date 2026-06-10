/**
 * @claude-flow/codex - Validators
 *
 * Comprehensive validation functions for AGENTS.md, SKILL.md, and config.toml
 * Provides detailed error messages and suggestions for fixes.
 */

import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js';


// Validation constants moved to ./patterns.ts (W149, P3.29 cut #1).
import {
  SECRET_PATTERNS,
  AGENTS_MD_REQUIRED_SECTIONS,
  AGENTS_MD_RECOMMENDED_SECTIONS,
  VALID_APPROVAL_POLICIES,
  VALID_SANDBOX_MODES,
  VALID_WEB_SEARCH_MODES,
  CONFIG_TOML_REQUIRED_FIELDS,
} from './patterns.js';
// Parsing + sub-validation helpers moved to ./parsers.ts (W150).
import {
  extractSections, parseYamlFrontmatter, parseToml, findFieldLine,
  checkCommonIssues, validateMarkdownStructure, validateMcpServers, validateProfiles,
} from './parsers.js';

/**
 * Validate an AGENTS.md file
 */
export async function validateAgentsMd(content: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  // Check for title (H1 heading)
  if (!content.startsWith('# ')) {
    const firstHeadingMatch = content.match(/^(#{1,6})\s+/m);
    if (firstHeadingMatch && firstHeadingMatch[1]) {
      if (firstHeadingMatch[1].length > 1) {
        errors.push({
          path: 'AGENTS.md',
          message: 'AGENTS.md should start with a level-1 heading (# Title)',
          line: 1,
        });
      }
    } else {
      errors.push({
        path: 'AGENTS.md',
        message: 'AGENTS.md must start with a title heading',
        line: 1,
      });
    }
  }

  // Check for empty content
  if (content.trim().length < 50) {
    errors.push({
      path: 'AGENTS.md',
      message: 'AGENTS.md content is too short - add meaningful instructions',
      line: 1,
    });
  }

  // Extract sections
  const sections = extractSections(content);
  const sectionTitles = sections.map((s) => s.title.toLowerCase());

  // Check for required sections
  for (const required of AGENTS_MD_REQUIRED_SECTIONS) {
    const found = sectionTitles.some(
      (t) => t.includes(required.toLowerCase()) || t === required.toLowerCase()
    );
    if (!found) {
      warnings.push({
        path: 'AGENTS.md',
        message: `Missing recommended section: ## ${required}`,
        suggestion: `Add a "## ${required}" section for better agent guidance`,
      });
    }
  }

  // Check for recommended sections
  for (const recommended of AGENTS_MD_RECOMMENDED_SECTIONS) {
    const found = sectionTitles.some(
      (t) => t.includes(recommended.toLowerCase()) || t === recommended.toLowerCase()
    );
    if (!found) {
      warnings.push({
        path: 'AGENTS.md',
        message: `Consider adding section: ## ${recommended}`,
        suggestion: `A "${recommended}" section would improve agent understanding`,
      });
    }
  }

  // Check for hardcoded secrets
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { pattern, name } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        errors.push({
          path: 'AGENTS.md',
          message: `Potential ${name} detected - never commit secrets`,
          line: i + 1,
        });
      }
    }
  }

  // Check for skill references
  const dollarSkillPattern = /\$([a-z][a-z0-9-]+)/g;
  const slashSkillPattern = /\/([a-z][a-z0-9-]+)/g;
  const dollarSkills = content.match(dollarSkillPattern) || [];
  const slashSkills = content.match(slashSkillPattern) || [];

  if (dollarSkills.length === 0 && slashSkills.length === 0) {
    warnings.push({
      path: 'AGENTS.md',
      message: 'No skill references found',
      suggestion: 'Add skill references using $skill-name syntax (Codex) or /skill-name (Claude Code)',
    });
  }

  // Warn about slash syntax (Claude Code style)
  if (slashSkills.length > 0 && dollarSkills.length === 0) {
    warnings.push({
      path: 'AGENTS.md',
      message: 'Using Claude Code skill syntax (/skill-name)',
      suggestion: 'Codex uses $skill-name syntax. Consider migrating for full compatibility.',
    });
  }

  // Check for code blocks
  const codeBlockCount = (content.match(/```/g) || []).length / 2;
  if (codeBlockCount < 1) {
    warnings.push({
      path: 'AGENTS.md',
      message: 'No code examples found',
      suggestion: 'Add code examples in fenced code blocks (```) to guide agent behavior',
    });
  }

  // Check for common issues
  checkCommonIssues(content, lines, errors, warnings);

  // Check structure
  validateMarkdownStructure(content, lines, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a SKILL.md file
 */
export async function validateSkillMd(content: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  // Check for YAML frontmatter
  if (!content.startsWith('---')) {
    errors.push({
      path: 'SKILL.md',
      message: 'SKILL.md must start with YAML frontmatter (---)',
      line: 1,
    });
    return { valid: false, errors, warnings };
  }

  // Parse YAML frontmatter
  const frontmatterResult = parseYamlFrontmatter(content);

  if (!frontmatterResult.valid) {
    for (const err of frontmatterResult.errors) {
      errors.push({
        path: 'SKILL.md',
        message: err.message,
        line: err.line,
      });
    }
    return { valid: false, errors, warnings };
  }

  const frontmatter = frontmatterResult.data;

  // Check required frontmatter fields
  const requiredFields = ['name', 'description'];
  for (const field of requiredFields) {
    if (!(field in frontmatter)) {
      errors.push({
        path: 'SKILL.md',
        message: `Missing required frontmatter field: ${field}`,
        line: 2,
      });
    } else if (typeof frontmatter[field] !== 'string' || (frontmatter[field] as string).trim() === '') {
      errors.push({
        path: 'SKILL.md',
        message: `Field "${field}" must be a non-empty string`,
        line: 2,
      });
    }
  }

  // Validate name format
  if (frontmatter.name && typeof frontmatter.name === 'string') {
    const name = frontmatter.name as string;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      errors.push({
        path: 'SKILL.md',
        message: `Skill name "${name}" must be lowercase with hyphens only (e.g., my-skill)`,
        line: 2,
      });
    }
    if (name.length > 50) {
      warnings.push({
        path: 'SKILL.md',
        message: 'Skill name is very long',
        suggestion: 'Keep skill names under 50 characters for readability',
      });
    }
  }

  // Check optional but recommended fields
  const recommendedFields = ['version', 'author', 'tags'];
  for (const field of recommendedFields) {
    if (!(field in frontmatter)) {
      warnings.push({
        path: 'SKILL.md',
        message: `Consider adding field: ${field}`,
        suggestion: `Adding "${field}" improves skill discoverability`,
      });
    }
  }

  // Check for model field (should specify min requirements)
  if (frontmatter.model) {
    warnings.push({
      path: 'SKILL.md',
      message: 'Model specification found in frontmatter',
      suggestion: 'Model requirements are informational - skills work with any capable model',
    });
  }

  // Get body content (after frontmatter)
  const bodyStartLine = frontmatterResult.endLine + 1;
  const body = lines.slice(bodyStartLine).join('\n');

  // Check for Purpose section
  if (!body.includes('## Purpose') && !body.includes('## Overview')) {
    warnings.push({
      path: 'SKILL.md',
      message: 'Missing Purpose or Overview section',
      suggestion: 'Add a "## Purpose" section to describe what the skill does',
    });
  }

  // Check for trigger conditions
  const hasTriggers =
    body.includes('When to Trigger') ||
    body.includes('When to Use') ||
    body.includes('Triggers') ||
    (frontmatter.triggers && Array.isArray(frontmatter.triggers));

  if (!hasTriggers) {
    warnings.push({
      path: 'SKILL.md',
      message: 'Missing trigger conditions',
      suggestion: 'Add a section or frontmatter field describing when to trigger this skill',
    });
  }

  // Check for skip conditions
  const hasSkipWhen =
    body.includes('Skip When') ||
    body.includes('When to Skip') ||
    (frontmatter.skip_when && Array.isArray(frontmatter.skip_when));

  if (!hasSkipWhen) {
    warnings.push({
      path: 'SKILL.md',
      message: 'No skip conditions defined',
      suggestion: 'Consider adding skip conditions to prevent unnecessary skill invocation',
    });
  }

  // Check for examples
  const hasExamples = body.includes('## Example') || body.includes('```');
  if (!hasExamples) {
    warnings.push({
      path: 'SKILL.md',
      message: 'No examples provided',
      suggestion: 'Add usage examples to help agents understand skill application',
    });
  }

  // Check for secrets in content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { pattern, name } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        errors.push({
          path: 'SKILL.md',
          message: `Potential ${name} detected - never commit secrets`,
          line: i + 1,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a config.toml file
 */
export async function validateConfigToml(content: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  // Parse TOML
  const parseResult = parseToml(content);

  if (!parseResult.valid) {
    for (const err of parseResult.errors) {
      errors.push({
        path: 'config.toml',
        message: err.message,
        line: err.line,
      });
    }
    return { valid: false, errors, warnings };
  }

  const config = parseResult.data;

  // Check for required fields
  for (const field of CONFIG_TOML_REQUIRED_FIELDS) {
    const fieldLine = findFieldLine(lines, field);
    if (!content.includes(`${field} =`) && !content.includes(`${field}=`)) {
      errors.push({
        path: 'config.toml',
        message: `Missing required field: ${field}`,
        line: fieldLine,
      });
    }
  }

  // Validate model field
  if (config.model) {
    const model = config.model as string;
    if (typeof model !== 'string') {
      errors.push({
        path: 'config.toml',
        message: 'model must be a string',
        line: findFieldLine(lines, 'model'),
      });
    }
  }

  // Validate approval_policy value
  const approvalMatch = content.match(/approval_policy\s*=\s*"([^"]+)"/);
  if (approvalMatch) {
    const policy = approvalMatch[1]!;
    if (!VALID_APPROVAL_POLICIES.includes(policy)) {
      errors.push({
        path: 'config.toml',
        message: `Invalid approval_policy: "${policy}". Valid values: ${VALID_APPROVAL_POLICIES.join(', ')}`,
        line: findFieldLine(lines, 'approval_policy'),
      });
    }
  }

  // Validate sandbox_mode value
  const sandboxMatch = content.match(/sandbox_mode\s*=\s*"([^"]+)"/);
  if (sandboxMatch) {
    const mode = sandboxMatch[1]!;
    if (!VALID_SANDBOX_MODES.includes(mode)) {
      errors.push({
        path: 'config.toml',
        message: `Invalid sandbox_mode: "${mode}". Valid values: ${VALID_SANDBOX_MODES.join(', ')}`,
        line: findFieldLine(lines, 'sandbox_mode'),
      });
    }
  }

  // Validate web_search value
  const webSearchMatch = content.match(/web_search\s*=\s*"([^"]+)"/);
  if (webSearchMatch) {
    const mode = webSearchMatch[1]!;
    if (!VALID_WEB_SEARCH_MODES.includes(mode)) {
      errors.push({
        path: 'config.toml',
        message: `Invalid web_search: "${mode}". Valid values: ${VALID_WEB_SEARCH_MODES.join(', ')}`,
        line: findFieldLine(lines, 'web_search'),
      });
    }
  }

  // Check for MCP servers section
  if (!content.includes('[mcp_servers')) {
    warnings.push({
      path: 'config.toml',
      message: 'No MCP servers configured',
      suggestion: 'Add [mcp_servers.ruflo] for Claude Flow integration',
    });
  } else {
    // Validate MCP server configurations
    validateMcpServers(content, lines, errors, warnings);
  }

  // Check for features section
  if (!content.includes('[features]')) {
    warnings.push({
      path: 'config.toml',
      message: 'No [features] section found',
      suggestion: 'Add [features] section to configure Codex behavior',
    });
  }

  // Security warnings for dangerous settings
  if (content.includes('approval_policy = "never"')) {
    if (!content.includes('[profiles.')) {
      warnings.push({
        path: 'config.toml',
        message: 'Using "never" approval policy globally',
        suggestion: 'Consider restricting to dev profile: [profiles.dev] approval_policy = "never"',
      });
    }
  }

  if (content.includes('sandbox_mode = "danger-full-access"')) {
    warnings.push({
      path: 'config.toml',
      message: 'Using "danger-full-access" sandbox mode',
      suggestion: 'This gives unrestricted file system access. Use only in trusted environments.',
    });
  }

  // Check for secrets
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip comment lines
    if (line.trim().startsWith('#')) continue;

    for (const { pattern, name } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        errors.push({
          path: 'config.toml',
          message: `Potential ${name} detected - use environment variables instead`,
          line: i + 1,
        });
      }
    }

    // Check for inline secrets in env sections
    if (line.includes('_KEY =') || line.includes('_SECRET =') || line.includes('_TOKEN =')) {
      const valueMatch = line.match(/=\s*"([^"]+)"/);
      if (valueMatch && valueMatch[1] && !valueMatch[1].startsWith('$')) {
        warnings.push({
          path: 'config.toml',
          message: 'Hardcoded credential detected',
          suggestion: `Use environment variable reference: $ENV_VAR_NAME instead of "${valueMatch[1]}"`,
        });
      }
    }
  }

  // Validate project_doc_max_bytes if present
  const maxBytesMatch = content.match(/project_doc_max_bytes\s*=\s*(\d+)/);
  if (maxBytesMatch) {
    const bytes = parseInt(maxBytesMatch[1]!, 10);
    if (bytes < 1024) {
      warnings.push({
        path: 'config.toml',
        message: `project_doc_max_bytes is very low (${bytes} bytes)`,
        suggestion: 'Consider increasing to at least 65536 for reasonable AGENTS.md support',
      });
    } else if (bytes > 1048576) {
      warnings.push({
        path: 'config.toml',
        message: `project_doc_max_bytes is very high (${bytes} bytes = ${(bytes / 1024 / 1024).toFixed(1)} MB)`,
        suggestion: 'Large values may impact performance. Default is 65536.',
      });
    }
  }

  // Check profiles
  validateProfiles(content, lines, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all files in a project
 */
export async function validateProject(files: {
  agentsMd?: string;
  skillMds?: Array<{ name: string; content: string }>;
  configToml?: string;
}): Promise<{
  valid: boolean;
  results: Record<string, ValidationResult>;
  summary: { errors: number; warnings: number };
}> {
  const results: Record<string, ValidationResult> = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  if (files.agentsMd) {
    results['AGENTS.md'] = await validateAgentsMd(files.agentsMd);
    totalErrors += results['AGENTS.md'].errors.length;
    totalWarnings += results['AGENTS.md'].warnings.length;
  }

  if (files.skillMds) {
    for (const skill of files.skillMds) {
      const key = `skills/${skill.name}`;
      results[key] = await validateSkillMd(skill.content);
      totalErrors += results[key].errors.length;
      totalWarnings += results[key].warnings.length;
    }
  }

  if (files.configToml) {
    results['config.toml'] = await validateConfigToml(files.configToml);
    totalErrors += results['config.toml'].errors.length;
    totalWarnings += results['config.toml'].warnings.length;
  }

  return {
    valid: totalErrors === 0,
    results,
    summary: { errors: totalErrors, warnings: totalWarnings },
  };
}

/**
 * Generate a validation report
 */
export function generateValidationReport(
  results: Record<string, ValidationResult>
): string {
  const lines: string[] = [];
  lines.push('# Validation Report');
  lines.push('');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [file, result] of Object.entries(results)) {
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    lines.push(`## ${file}`);
    lines.push('');
    lines.push(`**Status**: ${result.valid ? 'Valid' : 'Invalid'}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('### Errors');
      lines.push('');
      for (const error of result.errors) {
        const lineInfo = error.line ? ` (line ${error.line})` : '';
        lines.push(`- ${error.message}${lineInfo}`);
      }
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      for (const warning of result.warnings) {
        lines.push(`- ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`  - Suggestion: ${warning.suggestion}`);
        }
      }
      lines.push('');
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      lines.push('No issues found.');
      lines.push('');
    }
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Errors: ${totalErrors}`);
  lines.push(`- Total Warnings: ${totalWarnings}`);
  lines.push(`- Overall Status: ${totalErrors === 0 ? 'PASS' : 'FAIL'}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract sections from markdown content
 */

/**
 * Parsing + structural sub-validation helpers for the codex validators —
 * markdown section/structure extraction, YAML-frontmatter + TOML parsers,
 * common-issue + MCP-server + profile checks, and line/field locators.
 *
 * Extracted from validators/index.ts (W150, P3.29 cut #2). index.ts stays
 * the public barrel and imports the helpers its validators call.
 */
import type { ValidationError, ValidationWarning } from '../types.js';

export interface TomlParseResult {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
  data: Record<string, unknown>;
}

/**
 * YAML frontmatter parsing result
 */
export interface YamlFrontmatterResult {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
  data: Record<string, unknown>;
  endLine: number;
}
export function extractSections(content: string): Array<{ level: number; title: string; line: number }> {
  const sections: Array<{ level: number; title: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      sections.push({
        level: match[1].length,
        title: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return sections;
}

/**
 * Parse YAML frontmatter
 */
export function parseYamlFrontmatter(content: string): YamlFrontmatterResult {
  const result: YamlFrontmatterResult = {
    valid: false,
    errors: [],
    data: {},
    endLine: 0,
  };

  if (!content.startsWith('---')) {
    result.errors.push({ line: 1, message: 'Missing opening ---' });
    return result;
  }

  const lines = content.split('\n');
  let endLineIndex = -1;

  // Find closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      endLineIndex = i;
      break;
    }
  }

  if (endLineIndex === -1) {
    result.errors.push({ line: 1, message: 'YAML frontmatter not properly closed (missing closing ---)' });
    return result;
  }

  result.endLine = endLineIndex;

  // Parse YAML content (simple key: value parsing)
  const yamlLines = lines.slice(1, endLineIndex);

  for (let i = 0; i < yamlLines.length; i++) {
    const line = yamlLines[i]!.trim();
    if (line === '' || line.startsWith('#')) continue;

    // Simple key: value parsing
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // Could be a list item or continuation
      continue;
    }

    const key = line.substring(0, colonIndex).trim();
    let value: unknown = line.substring(colonIndex + 1).trim();

    // Parse value type
    if (value === '') {
      value = null;
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (/^-?\d+$/.test(value as string)) {
      value = parseInt(value as string, 10);
    } else if (/^-?\d+\.\d+$/.test(value as string)) {
      value = parseFloat(value as string);
    } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1);
    } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
      value = (value as string).slice(1, -1);
    } else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      // Simple inline array
      try {
        value = JSON.parse((value as string).replace(/'/g, '"'));
      } catch {
        // Keep as string if not valid JSON
      }
    }

    if (key) {
      result.data[key] = value;
    }
  }

  result.valid = true;
  return result;
}

/**
 * Parse TOML content (simplified parser)
 */
export function parseToml(content: string): TomlParseResult {
  const result: TomlParseResult = {
    valid: true,
    errors: [],
    data: {},
  };

  const lines = content.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) continue;

    // Section header
    if (line.startsWith('[')) {
      if (!line.endsWith(']')) {
        result.errors.push({
          line: i + 1,
          message: `Invalid section header: ${line} (missing closing bracket)`,
        });
        result.valid = false;
        continue;
      }
      currentSection = line.slice(1, -1);
      continue;
    }

    // Key = value
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      // Could be array continuation or error
      if (!line.startsWith('"') && !line.startsWith("'") && !line.startsWith(']')) {
        result.errors.push({
          line: i + 1,
          message: `Invalid line: ${line} (expected key = value)`,
        });
        result.valid = false;
      }
      continue;
    }

    const key = line.substring(0, eqIndex).trim();
    const valueStr = line.substring(eqIndex + 1).trim();

    // Validate key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      result.errors.push({
        line: i + 1,
        message: `Invalid key format: ${key}`,
      });
      result.valid = false;
      continue;
    }

    // Parse value
    let value: unknown = valueStr;

    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      value = valueStr.slice(1, -1);
    } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      value = valueStr.slice(1, -1);
    } else if (valueStr === 'true') {
      value = true;
    } else if (valueStr === 'false') {
      value = false;
    } else if (/^-?\d+$/.test(valueStr)) {
      value = parseInt(valueStr, 10);
    } else if (/^-?\d+\.\d+$/.test(valueStr)) {
      value = parseFloat(valueStr);
    } else if (valueStr.startsWith('[')) {
      // Array - simplified handling
      value = valueStr;
    }

    // Store in nested structure
    if (currentSection) {
      if (!result.data[currentSection]) {
        result.data[currentSection] = {};
      }
      (result.data[currentSection] as Record<string, unknown>)[key] = value;
    } else {
      result.data[key] = value;
    }
  }

  return result;
}

/**
 * Find the line number for a field
 */
export function findFieldLine(lines: string[], field: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(`${field} =`) || lines[i]!.includes(`${field}=`)) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Check for common issues in content
 */
export function checkCommonIssues(
  content: string,
  lines: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check for broken links
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const url = match[2]!;
    if (url.startsWith('http') && !url.startsWith('https://')) {
      const line = findLineNumber(content, match.index);
      warnings.push({
        path: 'AGENTS.md',
        message: `Non-HTTPS URL found: ${url}`,
        suggestion: 'Use HTTPS URLs for security',
      });
    }
  }

  // Check for TODO/FIXME comments
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/\b(TODO|FIXME|XXX|HACK)\b/i.test(line)) {
      warnings.push({
        path: 'AGENTS.md',
        message: `Incomplete item found: ${line.trim().substring(0, 50)}...`,
        suggestion: 'Complete or remove TODO/FIXME items before deployment',
      });
    }
  }

  // Check for placeholder content
  const placeholderPatterns = [
    /\[your[- ].*\]/i,
    /\[insert[- ].*\]/i,
    /\[add[- ].*\]/i,
    /\{your[- ].*\}/i,
    /<your[- ].*>/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(content)) {
      warnings.push({
        path: 'AGENTS.md',
        message: 'Placeholder content detected',
        suggestion: 'Replace placeholder text with actual content',
      });
      break;
    }
  }
}

/**
 * Validate markdown structure
 */
export function validateMarkdownStructure(
  content: string,
  lines: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check heading hierarchy
  const headings = extractSections(content);
  let prevLevel = 0;

  for (const heading of headings) {
    if (heading.level > prevLevel + 1 && prevLevel > 0) {
      warnings.push({
        path: 'AGENTS.md',
        message: `Heading level jumps from H${prevLevel} to H${heading.level}`,
        suggestion: `Use H${prevLevel + 1} instead of H${heading.level} for proper hierarchy`,
      });
    }
    prevLevel = heading.level;
  }

  // Check for unclosed code blocks
  // Count all triple backticks - they should come in pairs
  const tripleBackticks = (content.match(/```/g) || []).length;
  if (tripleBackticks % 2 !== 0) {
    errors.push({
      path: 'AGENTS.md',
      message: 'Unclosed code block detected (odd number of ``` markers)',
      line: 1,
    });
  }

  // Check for very long lines
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.length > 500) {
      warnings.push({
        path: 'AGENTS.md',
        message: `Very long line (${lines[i]!.length} chars) at line ${i + 1}`,
        suggestion: 'Consider breaking into multiple lines for readability',
      });
    }
  }
}

/**
 * Find line number for a character index
 */
export function findLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Validate MCP server configurations
 */
export function validateMcpServers(
  content: string,
  lines: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Find all MCP server sections
  const serverRegex = /\[mcp_servers\.([^\]]+)\]/g;
  const servers: string[] = [];
  let match;

  while ((match = serverRegex.exec(content)) !== null) {
    servers.push(match[1]!);
  }

  for (const serverName of servers) {
    // Check if server has command
    const serverSection = content.match(
      new RegExp(`\\[mcp_servers\\.${serverName.replace('.', '\\.')}\\][\\s\\S]*?(?=\\[|$)`)
    );

    if (serverSection) {
      const section = serverSection[0];

      if (!section.includes('command =')) {
        errors.push({
          path: 'config.toml',
          message: `MCP server "${serverName}" missing required "command" field`,
          line: findFieldLine(lines, `[mcp_servers.${serverName}]`),
        });
      }

      // Check for enabled = false (info)
      if (section.includes('enabled = false')) {
        warnings.push({
          path: 'config.toml',
          message: `MCP server "${serverName}" is disabled`,
          suggestion: 'Set enabled = true to activate this server',
        });
      }
    }
  }
}

/**
 * Validate profiles
 */
export function validateProfiles(
  content: string,
  lines: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const profileRegex = /\[profiles\.([^\]]+)\]/g;
  const profiles: string[] = [];
  let match;

  while ((match = profileRegex.exec(content)) !== null) {
    profiles.push(match[1]!);
  }

  // Suggest common profiles if missing
  const recommendedProfiles = ['dev', 'safe', 'ci'];
  for (const profile of recommendedProfiles) {
    if (!profiles.includes(profile)) {
      warnings.push({
        path: 'config.toml',
        message: `Consider adding "${profile}" profile`,
        suggestion: `Add [profiles.${profile}] for ${profile === 'dev' ? 'development' : profile === 'safe' ? 'restricted' : 'CI/CD'} environment`,
      });
    }
  }

  // Check profile settings
  for (const profile of profiles) {
    const profileSection = content.match(
      new RegExp(`\\[profiles\\.${profile}\\][\\s\\S]*?(?=\\[profiles|$)`)
    );

    if (profileSection) {
      const section = profileSection[0];

      // Check if profile has any settings
      if (!section.includes('=')) {
        warnings.push({
          path: 'config.toml',
          message: `Profile "${profile}" has no settings`,
          suggestion: 'Add approval_policy, sandbox_mode, or web_search settings',
        });
      }
    }
  }
}

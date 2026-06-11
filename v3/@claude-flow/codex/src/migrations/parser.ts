/**
 * Migrations — CLAUDE.md parser
 *
 * parseClaudeMd/analyzeClaudeMd plus the private section/skill/hook/
 * code-block/settings extractors and the HOOK_KEYWORDS/WARNING_PATTERNS
 * tables. Extracted verbatim from migrations/index.ts (lines 97-517)
 * during campaign-2 wave 6 (W212). index.ts stays the barrel.
 */

import type { McpServerConfig } from '../types.js';
import type {
  ParsedClaudeMd, ParsedSection, SkillReference, CodeBlock, ParsedSettings,
} from './types.js';

const HOOK_KEYWORDS = [
  'pre-task',
  'post-task',
  'pre-edit',
  'post-edit',
  'pre-command',
  'post-command',
  'session-start',
  'session-end',
  'session-restore',
  'route',
  'explain',
  'pretrain',
  'notify',
];

/**
 * Patterns that need migration warnings
 */
const WARNING_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: 'EnterPlanMode', message: 'EnterPlanMode has no direct Codex equivalent - review planning workflow' },
  { pattern: 'claude -p', message: 'claude -p headless mode - use Codex sub-agent patterns instead' },
  { pattern: 'TodoWrite', message: 'TodoWrite - Codex uses different task tracking approach' },
  { pattern: /--dangerously-skip-permissions/g, message: 'Dangerous permission skip detected - use Codex approval_policy instead' },
  { pattern: /mcp__claude-flow__/g, message: 'MCP tool calls need migration to Codex MCP configuration' },
  { pattern: /mcp__ruv-swarm__/g, message: 'Swarm MCP calls - ensure ruv-swarm MCP server is configured in config.toml' },
];

/**
 * Parse a CLAUDE.md file completely
 */
export async function parseClaudeMd(content: string): Promise<ParsedClaudeMd> {
  const lines = content.split('\n');
  const result: ParsedClaudeMd = {
    title: '',
    sections: [],
    skills: [],
    hooks: [],
    customInstructions: [],
    codeBlocks: [],
    mcpServers: [],
    settings: {},
    warnings: [],
  };

  // Extract title (first H1)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    result.title = titleMatch[1].trim();
    result.settings.projectName = result.title;
  }

  // Parse sections
  result.sections = parseSections(content, lines);

  // Extract skills (both /skill-name and $skill-name syntax)
  result.skills = extractSkills(content, lines);

  // Extract hooks
  result.hooks = extractHooks(content);

  // Extract code blocks
  result.codeBlocks = extractCodeBlocks(content, lines);

  // Extract MCP server configurations from code blocks
  result.mcpServers = extractMcpServers(result.codeBlocks);

  // Extract settings from content
  result.settings = {
    ...result.settings,
    ...extractSettings(content, result.sections),
  };

  // Extract custom instructions (behavioral rules)
  result.customInstructions = extractBehavioralRules(content);

  // Check for patterns that need warnings
  for (const { pattern, message } of WARNING_PATTERNS) {
    if (typeof pattern === 'string') {
      if (content.includes(pattern)) {
        result.warnings.push(message);
      }
    } else {
      if (pattern.test(content)) {
        result.warnings.push(message);
      }
    }
  }

  return result;
}

/**
 * Parse sections from markdown content
 */
function parseSections(content: string, lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const sectionRegex = /^(#{1,6})\s+(.+)$/;

  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = sectionRegex.exec(line);

    if (match && match[1] && match[2]) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        currentSection.endLine = i;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        level: match[1].length,
        title: match[2].trim(),
        content: '',
        startLine: i + 1,
        endLine: i + 1,
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    currentSection.endLine = lines.length;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract skill references from content
 */
function extractSkills(content: string, lines: string[]): SkillReference[] {
  const skills: SkillReference[] = [];
  const seenSkills = new Set<string>();

  // Slash syntax: /skill-name
  const slashRegex = /\/([a-z][a-z0-9-]*)/g;
  let match;

  while ((match = slashRegex.exec(content)) !== null) {
    const name = match[1]!;
    // Skip common false positives
    if (['src', 'dist', 'docs', 'tests', 'config', 'scripts', 'examples', 'node_modules', 'workspaces'].includes(name)) {
      continue;
    }
    if (!seenSkills.has(`slash:${name}`)) {
      seenSkills.add(`slash:${name}`);
      const lineNum = findLineNumber(content, match.index);
      skills.push({
        name,
        syntax: 'slash',
        context: getContextAroundMatch(lines, lineNum),
        line: lineNum,
      });
    }
  }

  // Dollar syntax: $skill-name
  const dollarRegex = /\$([a-z][a-z0-9-]+)/g;
  while ((match = dollarRegex.exec(content)) !== null) {
    const name = match[1]!;
    if (!seenSkills.has(`dollar:${name}`)) {
      seenSkills.add(`dollar:${name}`);
      const lineNum = findLineNumber(content, match.index);
      skills.push({
        name,
        syntax: 'dollar',
        context: getContextAroundMatch(lines, lineNum),
        line: lineNum,
      });
    }
  }

  return skills;
}

/**
 * Extract hooks referenced in content
 */
function extractHooks(content: string): string[] {
  const hooks: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const hook of HOOK_KEYWORDS) {
    if (lowerContent.includes(hook)) {
      hooks.push(hook);
    }
  }

  return hooks;
}

/**
 * Extract code blocks from markdown
 */
function extractCodeBlocks(content: string, lines: string[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      content: match[2]!.trim(),
      line: findLineNumber(content, match.index),
    });
  }

  return blocks;
}

/**
 * Extract MCP server configurations from code blocks
 */
function extractMcpServers(codeBlocks: CodeBlock[]): McpServerConfig[] {
  const servers: McpServerConfig[] = [];

  for (const block of codeBlocks) {
    // Look for MCP server configurations in bash/shell blocks
    if (['bash', 'shell', 'sh', 'zsh'].includes(block.language)) {
      // Pattern: claude mcp add <name> <command> [args...]
      const mcpAddRegex = /claude\s+mcp\s+add\s+(\S+)\s+(.+)/g;
      let match;
      while ((match = mcpAddRegex.exec(block.content)) !== null) {
        const name = match[1]!;
        const parts = match[2]!.trim().split(/\s+/);
        servers.push({
          name,
          command: parts[0] || 'npx',
          args: parts.slice(1),
          enabled: true,
        });
      }
    }

    // Look for JSON MCP configurations
    if (['json', 'jsonc'].includes(block.language)) {
      try {
        const parsed = JSON.parse(block.content);
        if (parsed.mcpServers) {
          for (const [name, config] of Object.entries(parsed.mcpServers as Record<string, unknown>)) {
            const mcpConfig = config as { command?: string; args?: string[] };
            servers.push({
              name,
              command: mcpConfig.command || 'npx',
              args: mcpConfig.args || [],
              enabled: true,
            });
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    // Look for JavaScript/TypeScript MCP tool calls
    if (['javascript', 'typescript', 'js', 'ts'].includes(block.language)) {
      // Pattern: mcp__<server>__<tool>
      const mcpCallRegex = /mcp__([a-z-]+)__/g;
      const seenServers = new Set<string>();
      let match;
      while ((match = mcpCallRegex.exec(block.content)) !== null) {
        const serverName = match[1]!.replace(/-/g, '_');
        if (!seenServers.has(serverName)) {
          seenServers.add(serverName);
          // Don't add as full config, just note it exists
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return servers.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/**
 * Extract settings from content and sections
 */
function extractSettings(content: string, sections: ParsedSection[]): ParsedSettings {
  const settings: ParsedSettings = {};

  // Look for tech stack
  const techMatch = content.match(/(?:Tech\s*Stack|Technology|Stack)[:\s]+([^\n]+)/i);
  if (techMatch && techMatch[1]) {
    settings.techStack = techMatch[1].replace(/\*\*/g, '').trim();
  }

  // Look for build command
  const buildMatch = content.match(/(?:Build|Compile)[:\s]*\n?```(?:bash|sh)?\n([^\n]+)/i);
  if (buildMatch && buildMatch[1]) {
    settings.buildCommand = buildMatch[1].trim();
  } else {
    // Check for npm run build pattern
    if (content.includes('npm run build')) {
      settings.buildCommand = 'npm run build';
    }
  }

  // Look for test command
  const testMatch = content.match(/(?:Test)[:\s]*\n?```(?:bash|sh)?\n([^\n]+)/i);
  if (testMatch && testMatch[1]) {
    settings.testCommand = testMatch[1].trim();
  } else {
    if (content.includes('npm test')) {
      settings.testCommand = 'npm test';
    }
  }

  // Look for dev command
  if (content.includes('npm run dev')) {
    settings.devCommand = 'npm run dev';
  }

  // Look for approval/permission settings
  if (content.includes('auto-approve') || content.includes('autoApprove')) {
    settings.approvalPolicy = 'never';
  } else if (content.includes('read-only')) {
    settings.sandboxMode = 'read-only';
  }

  // Look for model specification
  const modelMatch = content.match(/model[:\s]+["']?([^"'\n]+)["']?/i);
  if (modelMatch && modelMatch[1]) {
    settings.model = modelMatch[1].trim();
  }

  return settings;
}

/**
 * Extract behavioral rules from content
 */
function extractBehavioralRules(content: string): string[] {
  const rules: string[] = [];

  // Look for Behavioral Rules section
  const behavioralMatch = content.match(/##\s*Behavioral\s*Rules[^\n]*\n([\s\S]*?)(?=\n##|\n#\s|$)/i);
  if (behavioralMatch && behavioralMatch[1]) {
    const ruleLines = behavioralMatch[1].split('\n');
    for (const line of ruleLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        rules.push(trimmed.substring(2));
      } else if (trimmed.startsWith('* ')) {
        rules.push(trimmed.substring(2));
      }
    }
  }

  // Also look for Security Rules
  const securityMatch = content.match(/##\s*Security\s*Rules?[^\n]*\n([\s\S]*?)(?=\n##|\n#\s|$)/i);
  if (securityMatch && securityMatch[1]) {
    const securityLines = securityMatch[1].split('\n');
    for (const line of securityLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        rules.push(trimmed.substring(2));
      } else if (trimmed.startsWith('* ')) {
        rules.push(trimmed.substring(2));
      }
    }
  }

  return rules;
}

/**
 * Find line number for a character index
 */
function findLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Get context around a match
 */
function getContextAroundMatch(lines: string[], lineNum: number): string {
  const start = Math.max(0, lineNum - 2);
  const end = Math.min(lines.length, lineNum + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Analyze a CLAUDE.md file for migration (simplified interface)
 */
export async function analyzeClaudeMd(content: string): Promise<{
  sections: string[];
  skills: string[];
  hooks: string[];
  customInstructions: string[];
  warnings: string[];
}> {
  const parsed = await parseClaudeMd(content);

  return {
    sections: parsed.sections.map((s) => s.title),
    skills: [...new Set(parsed.skills.map((s) => s.name))],
    hooks: parsed.hooks,
    customInstructions: parsed.customInstructions,
    warnings: parsed.warnings,
  };
}

/**
 * Convert skill invocation syntax from slash to dollar
 */

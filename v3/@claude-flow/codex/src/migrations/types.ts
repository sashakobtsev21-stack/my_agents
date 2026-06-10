/**
 * Parsed-CLAUDE.md structure types for the codex migration pipeline —
 * ParsedClaudeMd / ParsedSection / SkillReference / CodeBlock /
 * ParsedSettings.
 *
 * Extracted from migrations/index.ts (W151, P3.30 cut #1). index.ts stays
 * the barrel and re-exports these.
 */
import type { McpServerConfig, ApprovalPolicy, SandboxMode } from '../types.js';

/**
 * Parsed CLAUDE.md structure
 */
export interface ParsedClaudeMd {
  title: string;
  sections: ParsedSection[];
  skills: SkillReference[];
  hooks: string[];
  customInstructions: string[];
  codeBlocks: CodeBlock[];
  mcpServers: McpServerConfig[];
  settings: ParsedSettings;
  warnings: string[];
}

/**
 * Parsed section from markdown
 */
export interface ParsedSection {
  level: number;
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Skill reference found in content
 */
export interface SkillReference {
  name: string;
  syntax: 'slash' | 'dollar';
  context: string;
  line: number;
}

/**
 * Code block from markdown
 */
export interface CodeBlock {
  language: string;
  content: string;
  line: number;
}

/**
 * Parsed settings from CLAUDE.md content
 */
export interface ParsedSettings {
  model?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  projectName?: string;
  techStack?: string;
  buildCommand?: string;
  testCommand?: string;
  devCommand?: string;
}

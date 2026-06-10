/**
 * Init command helpers — the Codex (.codex/) initialization action and the
 * isInitialized probe (detects existing .claude / .claude-flow setups).
 *
 * Extracted from init.ts (W131, P3.18 cut #1).
 */
import type { CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import * as fs from 'fs';
import * as path from 'path';

export async function initCodexAction(
  ctx: CommandContext,
  options: { codexMode: boolean; dualMode: boolean; force: boolean; minimal: boolean; full: boolean }
): Promise<CommandResult> {
  const { force, minimal, full, dualMode } = options;

  output.writeln();
  output.writeln(output.bold('Initializing AlexKo V3 for OpenAI Codex'));
  output.writeln();

  // Determine template
  const template = minimal ? 'minimal' : full ? 'full' : 'default';

  const spinner = output.createSpinner({ text: 'Initializing Codex project...' });
  spinner.start();

  try {
    // Dynamic import of the Codex initializer with lazy loading fallback
    interface CodexInitResult {
      success: boolean;
      errors?: string[];
      filesCreated: string[];
      skillsGenerated: string[];
      warnings?: string[];
    }
    let CodexInitializer: (new () => { initialize: (options: Record<string, unknown>) => Promise<CodexInitResult> }) | undefined;

    // Try multiple resolution strategies for the @claude-flow/codex package
    // Use a variable to prevent TypeScript from statically resolving the optional module
    const codexModuleId = '@claude-flow/codex';
    const resolutionStrategies = [
      // Strategy 1: Direct import (works if installed as CLI dependency)
      async () => (await import(codexModuleId)).CodexInitializer,
      // Strategy 2: Project node_modules (works if installed in user's project)
      async () => {
        const projectPath = path.join(ctx.cwd, 'node_modules', '@claude-flow', 'codex', 'dist', 'index.js');
        if (fs.existsSync(projectPath)) {
          const mod = await import(`file://${projectPath}`);
          return mod.CodexInitializer;
        }
        throw new Error('Not found in project');
      },
      // Strategy 3: Global node_modules
      async () => {
        const { execSync } = await import('child_process');
        const globalPath = execSync('npm root -g', { encoding: 'utf-8' }).trim();
        const codexPath = path.join(globalPath, '@claude-flow', 'codex', 'dist', 'index.js');
        if (fs.existsSync(codexPath)) {
          const mod = await import(`file://${codexPath}`);
          return mod.CodexInitializer;
        }
        throw new Error('Not found globally');
      },
    ];

    for (const strategy of resolutionStrategies) {
      try {
        CodexInitializer = await strategy();
        if (CodexInitializer) break;
      } catch {
        // Try next strategy
      }
    }

    if (!CodexInitializer) {
      throw new Error('Cannot find module @claude-flow/codex');
    }

    const initializer = new CodexInitializer();

    const result = await initializer.initialize({
      projectPath: ctx.cwd,
      template: template as 'minimal' | 'default' | 'full' | 'enterprise',
      force,
      dual: dualMode,
    });

    if (!result.success) {
      spinner.fail('Codex initialization failed');
      if (result.errors) {
        for (const error of result.errors) {
          output.printError(error);
        }
      }
      return { success: false, exitCode: 1 };
    }

    spinner.succeed('Codex project initialized successfully!');
    output.writeln();

    // Display summary
    const summary: string[] = [];
    summary.push(`Files: ${result.filesCreated.length} created`);
    summary.push(`Skills: ${result.skillsGenerated.length} installed`);

    output.printBox(summary.join('\n'), 'Summary');
    output.writeln();

    // Show what was created
    output.printBox(
      [
        `AGENTS.md:     Main project instructions`,
        `.agents/config.toml: Project configuration`,
        `.agents/skills/: ${result.skillsGenerated.length} skills`,
        `.codex/: Local overrides (gitignored)`,
        dualMode ? `CLAUDE.md: Claude Code compatibility` : '',
      ].filter(Boolean).join('\n'),
      'OpenAI Codex Integration'
    );
    output.writeln();

    // Warnings
    if (result.warnings && result.warnings.length > 0) {
      output.printWarning('Warnings:');
      for (const warning of result.warnings.slice(0, 5)) {
        output.printInfo(`  • ${warning}`);
      }
      if (result.warnings.length > 5) {
        output.printInfo(`  ... and ${result.warnings.length - 5} more`);
      }
      output.writeln();
    }

    // Next steps
    output.writeln(output.bold('Next steps:'));
    output.printList([
      `Review ${output.highlight('AGENTS.md')} for project instructions`,
      `Add skills with ${output.highlight('$skill-name')} syntax`,
      `Configure ${output.highlight('.agents/config.toml')} for your project`,
      dualMode ? `Claude Code users can use ${output.highlight('CLAUDE.md')}` : '',
    ].filter(Boolean));

    return { success: true, data: result };
  } catch (error) {
    spinner.fail('Codex initialization failed');
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle module not found error gracefully
    if (errorMessage.includes('Cannot find module') || errorMessage.includes('@claude-flow/codex')) {
      output.printError('The @claude-flow/codex package is not installed.');
      output.printInfo('Install it with: npm install @claude-flow/codex');
      output.writeln();
      output.printInfo('Alternatively, copy skills manually from .claude/skills/ to .agents/skills/');
    } else {
      output.printError(`Failed to initialize: ${errorMessage}`);
    }

    return { success: false, exitCode: 1 };
  }
}

// Check if project is already initialized with ruflo.
// #2207: .claude/settings.json alone is NOT a ruflo marker — it's created by
// Claude Code itself and exists in every Claude Code project. We require a
// ruflo-specific signal: either a claudeFlow section in settings.json, OR a
// .mcp.json with a 'claude-flow' or 'ruflo' server key, OR the ruflo-only
// .claude-flow/config.yaml. Using the bare file-existence check was causing
// false-positives for new users whose only existing file was Claude Code's own
// settings.json.
export function isInitialized(cwd: string): { claude: boolean; claudeFlow: boolean } {
  const claudeFlowPath = path.join(cwd, '.claude-flow', 'config.yaml');
  const mcpJsonPath = path.join(cwd, '.mcp.json');
  const settingsPath = path.join(cwd, '.claude', 'settings.json');

  // Check .claude-flow/config.yaml — ruflo-specific, always reliable
  const hasClaudeFlow = fs.existsSync(claudeFlowPath);

  // Check .claude/settings.json for ruflo-specific content (claudeFlow section)
  let hasRufloSettings = false;
  if (fs.existsSync(settingsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      hasRufloSettings =
        parsed != null &&
        typeof parsed === 'object' &&
        'claudeFlow' in parsed;
    } catch { /* malformed — ignore */ }
  }

  // Check .mcp.json for ruflo/claude-flow server key
  let hasRufloMcp = false;
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
      hasRufloMcp =
        parsed != null &&
        typeof parsed === 'object' &&
        parsed.mcpServers != null &&
        typeof parsed.mcpServers === 'object' &&
        ('claude-flow' in (parsed.mcpServers as Record<string, unknown>) ||
         'ruflo' in (parsed.mcpServers as Record<string, unknown>));
    } catch { /* malformed — ignore */ }
  }

  return {
    claude: hasRufloSettings || hasRufloMcp,
    claudeFlow: hasClaudeFlow,
  };
}

// Init subcommand (default)

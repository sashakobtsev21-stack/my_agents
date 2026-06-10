/**
 * The main `init` action — detects existing setup, prompts (or applies a
 * preset), runs executeInit, and optionally chains the Codex init.
 *
 * Extracted from init.ts (W132, P3.18 cut #2).
 */
import type { CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { confirm } from '../../prompt.js';
import {
  executeInit,
  DEFAULT_INIT_OPTIONS,
  MINIMAL_INIT_OPTIONS,
  FULL_INIT_OPTIONS,
  type InitOptions,
} from '../../init/index.js';
import { initCodexAction, isInitialized } from './helpers.js';

export const initAction = async (ctx: CommandContext): Promise<CommandResult> => {
  const force = ctx.flags.force as boolean;
  const minimal = ctx.flags.minimal as boolean;
  const full = ctx.flags.full as boolean;
  const skipClaude = ctx.flags['skip-claude'] as boolean;
  const onlyClaude = ctx.flags['only-claude'] as boolean;
  // #2098A — the parser handles `--no-foo` by stripping the prefix and
  // storing `flags.foo = false` (parser.ts:291-294), not by storing
  // `flags['no-foo'] = true`. So `--no-global` lands as
  // `ctx.flags.global === false`. The old read of `flags['no-global']`
  // was always undefined and silently no-op'd — every user with the flag
  // set still got `~/.claude/CLAUDE.md` modified. Read the real key.
  const noGlobal = ctx.flags['no-global'] === true || ctx.flags['global'] === false;
  const allAgents = ctx.flags['all-agents'] as boolean;
  const codexMode = ctx.flags.codex as boolean;
  const dualMode = ctx.flags.dual as boolean;
  const cwd = ctx.cwd;

  // If codex mode, use the Codex initializer
  if (codexMode || dualMode) {
    return initCodexAction(ctx, { codexMode, dualMode, force, minimal, full });
  }

  // Check if already initialized
  const initialized = isInitialized(cwd);
  const hasExisting = initialized.claude || initialized.claudeFlow;

  if (hasExisting && !force) {
    output.printWarning('AlexKo appears to be already initialized');
    if (initialized.claude) output.printInfo('  Found: .claude/settings.json');
    if (initialized.claudeFlow) output.printInfo('  Found: .claude-flow/config.yaml');
    output.printInfo('Use --force to reinitialize');

    if (ctx.interactive) {
      const proceed = await confirm({
        message: 'Do you want to reinitialize? This will overwrite existing configuration.',
        default: false,
      });

      if (!proceed) {
        return { success: true, message: 'Initialization cancelled' };
      }
    } else {
      return { success: false, exitCode: 1, message: 'Already initialized' };
    }
  }

  output.writeln();
  output.writeln(output.bold('Initializing AlexKo V3'));
  output.writeln();

  // Build init options based on flags
  let options: InitOptions;

  if (minimal) {
    options = { ...MINIMAL_INIT_OPTIONS, targetDir: cwd, force };
  } else if (full) {
    options = { ...FULL_INIT_OPTIONS, targetDir: cwd, force };
  } else {
    options = { ...DEFAULT_INIT_OPTIONS, targetDir: cwd, force };
  }

  // Handle --skip-claude and --only-claude flags
  if (skipClaude) {
    options.components.settings = false;
    options.components.skills = false;
    options.components.commands = false;
    options.components.agents = false;
    options.components.helpers = false;
    options.components.statusline = false;
    options.components.mcp = false;
    options.components.claudeMd = false;
  }

  if (onlyClaude) {
    options.components.runtime = false;
  }

  // ADR-128 Phase 3 — restore full agent set (98 agents) when user explicitly
  // requests it. Default is the ~24-agent substrate (core, consensus, swarm,
  // sparc, testing). Pass --all-agents to get the old behavior.
  if (allAgents) {
    options.agents.all = true;
  }

  // #1744 — opt-out of the user-global ~/.claude/CLAUDE.md "Ruflo Integration"
  // pointer block. Default behavior (off) preserves current install for users
  // who rely on it; opting in via --no-global keeps the global file pristine.
  if (noGlobal) {
    options.skipGlobalClaudeMd = true;
  }

  // Create spinner
  const spinner = output.createSpinner({ text: 'Initializing...' });
  spinner.start();

  try {
    // Execute initialization
    const result = await executeInit(options);

    if (!result.success) {
      spinner.fail('Initialization failed');
      for (const error of result.errors) {
        output.printError(error);
      }
      return { success: false, exitCode: 1 };
    }

    spinner.succeed('AlexKo V3 initialized successfully!');
    output.writeln();

    // Display summary
    const summary: string[] = [];

    if (result.created.directories.length > 0) {
      summary.push(`Directories: ${result.created.directories.length} created`);
    }

    if (result.created.files.length > 0) {
      summary.push(`Files: ${result.created.files.length} created`);
    }

    if (result.skipped.length > 0) {
      summary.push(`Skipped: ${result.skipped.length} (already exist)`);
    }

    output.printBox(summary.join('\n'), 'Summary');
    output.writeln();

    // Show what was created
    if (options.components.claudeMd || options.components.settings || options.components.skills || options.components.commands || options.components.agents) {
      output.printBox(
        [
          options.components.claudeMd ? `CLAUDE.md:   Swarm guidance & configuration` : '',
          options.components.settings ? `Settings:    .claude/settings.json` : '',
          options.components.skills ? `Skills:      .claude/skills/ (${result.summary.skillsCount} skills)` : '',
          options.components.commands ? `Commands:    .claude/commands/ (${result.summary.commandsCount} commands)` : '',
          options.components.agents ? `Agents:      .claude/agents/ (${result.summary.agentsCount} agents)` : '',
          options.components.helpers ? `Helpers:     .claude/helpers/` : '',
          options.components.mcp ? `MCP:         .mcp.json` : '',
        ].filter(Boolean).join('\n'),
        'Claude Code Integration'
      );
      output.writeln();
    }

    if (options.components.runtime) {
      output.printBox(
        [
          `Config:      .claude-flow/config.yaml`,
          `Data:        .claude-flow/data/`,
          `Logs:        .claude-flow/logs/`,
          `Sessions:    .claude-flow/sessions/`,
        ].join('\n'),
        'V3 Runtime'
      );
      output.writeln();
    }

    // Hooks summary
    if (result.summary.hooksEnabled > 0) {
      output.printInfo(`Hooks: ${result.summary.hooksEnabled} hook types enabled in settings.json`);
      output.writeln();
    }

    // Handle --start-all or --start-daemon
    const startAll = ctx.flags['start-all'] || ctx.flags.startAll;
    const startDaemon = ctx.flags['start-daemon'] || ctx.flags.startDaemon || startAll;

    if (startDaemon || startAll) {
      output.writeln();
      output.printInfo('Starting services...');

      const { execSync } = await import('child_process');

      // Initialize memory database
      if (startAll) {
        try {
          output.writeln(output.dim('  Initializing memory database...'));
          execSync('npx @claude-flow/cli@latest memory init 2>/dev/null', {
            stdio: 'pipe',
            cwd: ctx.cwd,
            timeout: 30000
          });
          output.writeln(output.success('  ✓ Memory initialized'));
        } catch {
          output.writeln(output.dim('  Memory database already exists'));
        }
      }

      // Start daemon
      if (startDaemon) {
        try {
          output.writeln(output.dim('  Starting daemon...'));
          execSync('npx @claude-flow/cli@latest daemon start 2>/dev/null &', {
            stdio: 'pipe',
            cwd: ctx.cwd,
            timeout: 10000
          });
          output.writeln(output.success('  ✓ Daemon started'));
        } catch {
          output.writeln(output.warning('  Daemon may already be running'));
        }
      }

      // Initialize swarm
      if (startAll) {
        try {
          output.writeln(output.dim('  Initializing swarm...'));
          execSync('npx @claude-flow/cli@latest swarm init --topology hierarchical 2>/dev/null', {
            stdio: 'pipe',
            cwd: ctx.cwd,
            timeout: 30000
          });
          output.writeln(output.success('  ✓ Swarm initialized'));
        } catch {
          output.writeln(output.dim('  Swarm initialization skipped'));
        }
      }

      output.writeln();
      output.printSuccess('All services started');
    }

    // Handle --with-embeddings
    const withEmbeddings = ctx.flags['with-embeddings'] || ctx.flags.withEmbeddings;
    const embeddingModel = (ctx.flags['embedding-model'] || ctx.flags.embeddingModel || 'Xenova/all-MiniLM-L6-v2') as string;

    if (withEmbeddings) {
      output.writeln();
      output.printInfo('Initializing ONNX embedding subsystem...');

      const { execFileSync: execFileInit } = await import('child_process');

      // Validate embeddingModel: must match pattern org/model-name (CRIT-02)
      if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(embeddingModel)) {
        throw new Error(`Invalid embedding model name: ${embeddingModel}`);
      }

      try {
        output.writeln(output.dim(`  Model: ${embeddingModel}`));
        output.writeln(output.dim('  Hyperbolic: Enabled (Poincaré ball)'));
        execFileInit('npx', [
          '@claude-flow/cli@latest', 'embeddings', 'init',
          '--model', embeddingModel,
          '--no-download', '--force',
        ], {
          stdio: 'pipe',
          cwd: ctx.cwd,
          timeout: 30000,
        });
        output.writeln(output.success('  ✓ Embeddings initialized'));
        output.writeln(output.dim('    Run "embeddings init --download" to download model'));
      } catch (err) {
        output.writeln(output.warning('  Embedding initialization skipped (run manually)'));
      }
    }

    if (!startDaemon && !startAll) {
      const bin = (process.argv[1] || '').includes('ruflo') ? 'ruflo' : 'claude-flow';
      output.writeln(output.bold('Next steps:'));
      output.printList([
        `Run ${output.highlight(`${bin} daemon start`)} to start background workers`,
        `Run ${output.highlight(`${bin} memory init`)} to initialize memory database`,
        `Run ${output.highlight(`${bin} swarm init`)} to initialize a swarm`,
        `Or use ${output.highlight(`${bin} init --start-all`)} to do all of the above`,
        options.components.settings ? `Review ${output.highlight('.claude/settings.json')} for hook configurations` : '',
      ].filter(Boolean));
    }

    if (ctx.flags.format === 'json') {
      output.printJson(result);
    }

    return { success: true, data: result };
  } catch (error) {
    spinner.fail('Initialization failed');
    output.printError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, exitCode: 1 };
  }
};

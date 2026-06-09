/**
 * V3 CLI Doctor Command
 * System diagnostics, dependency checks, config validation
 *
 * Created with ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
// Shared utilities + pilot extractions live under ./doctor/ (issue #7).
// All node:fs/path/url/crypto/child_process + encryption/vault imports were
// only used by the check functions, which all moved to ./doctor/checks/*.
import { type HealthCheck } from './doctor/utils.js';
import { checkNodeVersion, checkNpmVersion } from './doctor/checks/node.js';
import { checkGit, checkGitRepo } from './doctor/checks/git.js';
import { checkConfigFile, checkDaemonStatus, checkMemoryDatabase, checkApiKeys } from './doctor/checks/config.js';
import { checkDiskSpace, checkBuildTools, checkVersionFreshness } from './doctor/checks/build.js';
import { checkClaudeCode, checkAgenticFlow, installClaudeCode } from './doctor/checks/cli-tools.js';
import { checkAIDefence, checkFederationBreaker, checkMcpServers } from './doctor/checks/services.js';
import { checkEncryptionAtRest } from './doctor/checks/encryption.js';

function formatCheck(check: HealthCheck): string {
  const icon = check.status === 'pass' ? output.success('✓') :
               check.status === 'warn' ? output.warning('⚠') :
               output.error('✗');
  return `${icon} ${check.name}: ${check.message}`;
}
export const doctorCommand: Command = {
  name: 'doctor',
  description: 'System diagnostics and health checks',
  options: [
    {
      name: 'fix',
      short: 'f',
      // #1791.5 — flag name was misleading: it does NOT auto-apply fixes,
      // it only prints the suggested commands so the user can run them
      // themselves. Make that explicit in the help output.
      description: 'Print suggested fix commands (does not auto-apply — copy/paste them yourself)',
      type: 'boolean',
      default: false
    },
    {
      name: 'install',
      short: 'i',
      description: 'Auto-install missing dependencies (Claude Code CLI)',
      type: 'boolean',
      default: false
    },
    {
      name: 'component',
      short: 'c',
      description: 'Check specific component (version, node, npm, config, daemon, memory, api, git, mcp, claude, disk, typescript)',
      type: 'string'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow doctor', description: 'Run full health check' },
    { command: 'claude-flow doctor --fix', description: 'Print suggested fix commands (does not auto-apply)' },
    { command: 'claude-flow doctor --install', description: 'Auto-install missing dependencies' },
    { command: 'claude-flow doctor -c version', description: 'Check for stale npx cache' },
    { command: 'claude-flow doctor -c claude', description: 'Check Claude Code CLI only' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const showFix = ctx.flags.fix as boolean;
    const autoInstall = ctx.flags.install as boolean;
    const component = ctx.flags.component as string;
    const verbose = ctx.flags.verbose as boolean;

    output.writeln();
    output.writeln(output.bold('AlexKo Doctor'));
    output.writeln(output.dim('System diagnostics and health check'));
    output.writeln(output.dim('─'.repeat(50)));
    output.writeln();

    const allChecks: (() => Promise<HealthCheck>)[] = [
      checkVersionFreshness,
      checkNodeVersion,
      checkNpmVersion,
      checkClaudeCode,
      checkGit,
      checkGitRepo,
      checkConfigFile,
      checkDaemonStatus,
      checkMemoryDatabase,
      checkApiKeys,
      checkMcpServers,
      checkAIDefence, // #1807
      checkDiskSpace,
      checkBuildTools,
      checkAgenticFlow,
      checkEncryptionAtRest, // ADR-096 Phase 5
      checkFederationBreaker, // ADR-097 Phase 4
    ];

    const componentMap: Record<string, () => Promise<HealthCheck>> = {
      'version': checkVersionFreshness,
      'freshness': checkVersionFreshness,
      'node': checkNodeVersion,
      'npm': checkNpmVersion,
      'claude': checkClaudeCode,
      'config': checkConfigFile,
      'daemon': checkDaemonStatus,
      'memory': checkMemoryDatabase,
      'api': checkApiKeys,
      'git': checkGit,
      'mcp': checkMcpServers,
      'aidefence': checkAIDefence, // #1807
      'disk': checkDiskSpace,
      'typescript': checkBuildTools,
      'agentic-flow': checkAgenticFlow,
      'encryption': checkEncryptionAtRest, // ADR-096 Phase 5
      'federation': checkFederationBreaker, // ADR-097 Phase 4
    };

    let checksToRun = allChecks;
    if (component && componentMap[component]) {
      checksToRun = [componentMap[component]];
    }

    const results: HealthCheck[] = [];
    const fixes: string[] = [];

    // OPTIMIZATION: Run all checks in parallel for 3-5x faster execution
    const spinner = output.createSpinner({ text: 'Running health checks in parallel...', spinner: 'dots' });
    spinner.start();

    try {
      // Execute all checks concurrently
      const checkResults = await Promise.allSettled(checksToRun.map(check => check()));
      spinner.stop();

      // Process results in order
      for (const settledResult of checkResults) {
        if (settledResult.status === 'fulfilled') {
          const result = settledResult.value;
          results.push(result);
          output.writeln(formatCheck(result));

          if (result.fix && (result.status === 'fail' || result.status === 'warn')) {
            fixes.push(`${result.name}: ${result.fix}`);
          }
        } else {
          const errorResult: HealthCheck = {
            name: 'Check',
            status: 'fail',
            message: settledResult.reason?.message || 'Unknown error'
          };
          results.push(errorResult);
          output.writeln(formatCheck(errorResult));
        }
      }
    } catch (error) {
      spinner.stop();
      output.writeln(output.error('Failed to run health checks'));
    }

    // Auto-install missing dependencies if requested
    if (autoInstall) {
      const claudeCodeResult = results.find(r => r.name === 'Claude Code CLI');
      if (claudeCodeResult && claudeCodeResult.status !== 'pass') {
        const installed = await installClaudeCode();
        if (installed) {
          // Re-check Claude Code after installation
          const newCheck = await checkClaudeCode();
          const idx = results.findIndex(r => r.name === 'Claude Code CLI');
          if (idx !== -1) {
            results[idx] = newCheck;
            // Update fixes list
            const fixIdx = fixes.findIndex(f => f.startsWith('Claude Code CLI:'));
            if (fixIdx !== -1 && newCheck.status === 'pass') {
              fixes.splice(fixIdx, 1);
            }
          }
          output.writeln(formatCheck(newCheck));
        }
      }
    }

    // Summary
    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;

    output.writeln();
    output.writeln(output.dim('─'.repeat(50)));
    output.writeln();

    const summaryParts = [
      output.success(`${passed} passed`),
      warnings > 0 ? output.warning(`${warnings} warnings`) : null,
      failed > 0 ? output.error(`${failed} failed`) : null
    ].filter(Boolean);

    output.writeln(`Summary: ${summaryParts.join(', ')}`);

    // Show fixes — #1791.5: header makes it explicit these are commands you
    // run yourself, not actions doctor took.
    if (showFix && fixes.length > 0) {
      output.writeln();
      output.writeln(output.bold('Suggested commands (run them yourself):'));
      output.writeln();
      for (const fix of fixes) {
        output.writeln(output.dim(`  ${fix}`));
      }
    } else if (fixes.length > 0 && !showFix) {
      output.writeln();
      output.writeln(output.dim(`Run with --fix to see ${fixes.length} suggested command${fixes.length > 1 ? 's' : ''} (does not auto-apply)`));
    }

    // Overall result
    if (failed > 0) {
      output.writeln();
      output.writeln(output.error('Some checks failed. Please address the issues above.'));
      return { success: false, exitCode: 1, data: { passed, warnings, failed, results } };
    } else if (warnings > 0) {
      output.writeln();
      output.writeln(output.warning('All checks passed with some warnings.'));
      return { success: true, data: { passed, warnings, failed, results } };
    } else {
      output.writeln();
      output.writeln(output.success('All checks passed! System is healthy.'));
      return { success: true, data: { passed, warnings, failed, results } };
    }
  }
};

export default doctorCommand;

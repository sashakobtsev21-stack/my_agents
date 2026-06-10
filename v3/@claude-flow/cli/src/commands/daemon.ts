/**
 * V3 CLI Daemon Command
 * Manages background worker daemon (Node.js-based, similar to shell helpers)
 */

// This file is now a thin registrar: it assembles daemonCommand from the
// subcommands + process helpers extracted into the sibling daemon-*
// modules during the P3.19 god-file decomposition (W133-W134):
//   daemon-process · daemon-subcommands · daemon-supervisor
import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
import {
  startCommand, stopCommand, statusCommand, triggerCommand, enableCommand,
} from './daemon-subcommands.js';
import {
  installSupervisorCommand, uninstallSupervisorCommand,
} from './daemon-supervisor.js';
// Re-export the workspace-scope helpers so external/test callers that
// import them from './daemon.js' keep resolving byte-identically.
export { resolveWorkspaceFlag, daemonCommandLineBelongsToWorkspace } from './daemon-process.js';

// Main daemon command
export const daemonCommand: Command = {
  name: 'daemon',
  description: 'Manage background worker daemon (Node.js-based, auto-runs like shell helpers)',
  subcommands: [
    startCommand,
    stopCommand,
    statusCommand,
    triggerCommand,
    enableCommand,
    installSupervisorCommand,
    uninstallSupervisorCommand,
  ],
  options: [],
  examples: [
    { command: 'claude-flow daemon start', description: 'Start the daemon' },
    { command: 'claude-flow daemon start --headless', description: 'Start with headless workers (E2B sandbox)' },
    { command: 'claude-flow daemon status', description: 'Check daemon status' },
    { command: 'claude-flow daemon stop', description: 'Stop the daemon' },
    { command: 'claude-flow daemon trigger -w audit', description: 'Run security audit' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Daemon - Background Task Management'));
    output.writeln();
    output.writeln('Node.js-based background worker system that auto-runs like shell daemons.');
    output.writeln('Manages 12 specialized workers for continuous optimization and monitoring.');
    output.writeln();
    output.writeln(output.bold('Headless Mode'));
    output.writeln('Workers can run in headless mode using E2B sandboxes for isolated execution.');
    output.writeln('Use --headless flag with start/trigger commands. Sandbox modes: strict, permissive, disabled.');
    output.writeln();

    output.writeln(output.bold('Available Workers'));
    output.printList([
      `${output.highlight('map')}         - Codebase mapping (5 min interval)`,
      `${output.highlight('audit')}       - Security analysis (10 min interval)`,
      `${output.highlight('optimize')}    - Performance optimization (15 min interval)`,
      `${output.highlight('consolidate')} - Memory consolidation (30 min interval)`,
      `${output.highlight('testgaps')}    - Test coverage analysis (20 min interval)`,
      `${output.highlight('predict')}     - Predictive preloading (2 min, disabled by default)`,
      `${output.highlight('document')}    - Auto-documentation (60 min, disabled by default)`,
      `${output.highlight('ultralearn')}  - Deep knowledge acquisition (manual trigger)`,
      `${output.highlight('refactor')}    - Code refactoring suggestions (manual trigger)`,
      `${output.highlight('benchmark')}   - Performance benchmarking (manual trigger)`,
      `${output.highlight('deepdive')}    - Deep code analysis (manual trigger)`,
      `${output.highlight('preload')}     - Resource preloading (manual trigger)`,
    ]);

    output.writeln();
    output.writeln(output.bold('Subcommands'));
    output.printList([
      `${output.highlight('start')}   - Start the daemon`,
      `${output.highlight('stop')}    - Stop the daemon`,
      `${output.highlight('status')}  - Show daemon status`,
      `${output.highlight('trigger')} - Manually run a worker`,
      `${output.highlight('enable')}  - Enable/disable a worker`,
    ]);

    output.writeln();
    output.writeln('Run "claude-flow daemon <subcommand> --help" for details');

    return { success: true };
  },
};

export default daemonCommand;

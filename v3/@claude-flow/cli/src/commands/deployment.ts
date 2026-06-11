/**
 * V3 CLI Deployment Command
 * Deployment management, environments, rollbacks
 *
 * Created with ❤️ by ruv.io
 */


import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
// Subcommands/state extracted into ./deployment-state.ts,
// ./deployment-run.ts, ./deployment-info.ts during campaign-2 wave 67
// (W273).
import { deployCommand, rollbackCommand, statusCommand } from './deployment-run.js';
import {
  environmentsCommand,
  historyCommand,
  logsCommand,
  releaseCommand,
} from './deployment-info.js';

export const deploymentCommand: Command = {
  name: 'deployment',
  description: 'Deployment management, environments, rollbacks',
  aliases: ['deploy'],
  subcommands: [deployCommand, statusCommand, rollbackCommand, historyCommand, environmentsCommand, logsCommand, releaseCommand],
  examples: [
    { command: 'claude-flow deployment deploy -e prod', description: 'Deploy to production' },
    { command: 'claude-flow deployment status', description: 'Check all environments' },
    { command: 'claude-flow deployment rollback -e prod', description: 'Rollback production' },
    { command: 'claude-flow deployment release -v 3.5.0', description: 'Create a release' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Deployment'));
    output.writeln(output.dim('Multi-environment deployment management'));
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      'deploy       - Deploy to target environment',
      'status       - Check deployment status',
      'rollback     - Rollback to previous version',
      'history      - View deployment history',
      'environments - Manage deployment environments',
      'logs         - View deployment logs',
      'release      - Create a new release',
    ]);
    output.writeln();
    output.writeln('Features:');
    output.printList([
      'Zero-downtime rolling deployments',
      'Automatic rollback on failure',
      'Environment-specific configurations',
      'Deployment previews for PRs',
    ]);
    output.writeln();
    output.writeln(output.dim('Created with love by ruv.io'));
    return { success: true };
  },
};

export default deploymentCommand;

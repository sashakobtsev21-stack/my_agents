/**
 * V3 CLI Neural Command
 * Neural pattern training, MoE, Flash Attention, pattern learning
 *
 * Created with ❤️ by ruv.io
 */

// This file is now a thin registrar: it assembles neuralCommand from the
// subcommands extracted into the ./neural/ directory during the P3.9
// god-file decomposition (W94-W98). Sub-modules:
//   commands-train · commands-status · commands-optimize · commands-io ·
//   commands-benchmark
import type { Command, CommandResult } from '../types.js';
import { output } from '../output.js';
import { trainCommand } from './neural/commands-train.js';
import { statusCommand, patternsCommand, predictCommand } from './neural/commands-status.js';
import { optimizeCommand, exportCommand } from './neural/commands-optimize.js';
import { listCommand, importCommand } from './neural/commands-io.js';
import { benchmarkCommand } from './neural/commands-benchmark.js';

// Main neural command
export const neuralCommand: Command = {
  name: 'neural',
  description: 'Neural pattern training, MoE, Flash Attention, pattern learning',
  subcommands: [trainCommand, statusCommand, patternsCommand, predictCommand, optimizeCommand, benchmarkCommand, listCommand, exportCommand, importCommand],
  examples: [
    { command: 'claude-flow neural status', description: 'Check neural system status' },
    { command: 'claude-flow neural train -p coordination', description: 'Train coordination patterns' },
    { command: 'claude-flow neural patterns --action list', description: 'List learned patterns' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('AlexKo Neural System'));
    output.writeln(output.dim('Advanced AI pattern learning and inference'));
    output.writeln();
    output.writeln('Use --help with subcommands for more info');
    output.writeln();
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default neuralCommand;

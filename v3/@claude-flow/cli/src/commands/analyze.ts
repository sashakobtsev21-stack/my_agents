/**
 * V3 CLI Analyze Command
 * Code analysis, diff classification, AST analysis, and change risk assessment
 *
 * Features:
 * - AST analysis using ruvector (tree-sitter) with graceful fallback
 * - Symbol extraction (functions, classes, variables, types)
 * - Cyclomatic complexity scoring
 * - Diff classification and risk assessment
 * - Graph boundaries using MinCut algorithm
 * - Module communities using Louvain algorithm
 * - Circular dependency detection
 *
 * Created with ruv.io
 */

// This file is now a thin registrar: it assembles analyzeCommand from
// the subcommands extracted into the ./analyze/ directory during the
// P3.5 god-file decomposition (W72-W76). Sub-modules:
//   display-helpers · scan-helpers · commands-diff-code · commands-ast ·
//   commands-graph
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { diffCommand, codeCommand } from './analyze/commands-diff-code.js';
import {
  astCommand,
  complexityAstCommand,
  symbolsCommand,
  importsCommand,
} from './analyze/commands-ast.js';
import {
  depsCommand,
  boundariesCommand,
  modulesCommand,
  dependenciesCommand,
  circularCommand,
} from './analyze/commands-graph.js';

// Main analyze command
export const analyzeCommand: Command = {
  name: 'analyze',
  description: 'Code analysis, diff classification, graph boundaries, and change risk assessment',
  aliases: ['an'],
  subcommands: [
    diffCommand,
    codeCommand,
    depsCommand,
    astCommand,
    complexityAstCommand,
    symbolsCommand,
    importsCommand,
    boundariesCommand,
    modulesCommand,
    dependenciesCommand,
    circularCommand,
  ],
  options: [
    {
      name: 'format',
      short: 'f',
      description: 'Output format: text, json, table',
      type: 'string',
      default: 'text',
    },
  ],
  examples: [
    { command: 'claude-flow analyze ast src/', description: 'Analyze code with AST parsing' },
    { command: 'claude-flow analyze complexity src/ --threshold 15', description: 'Find high-complexity files' },
    { command: 'claude-flow analyze symbols src/ --type function', description: 'Extract all functions' },
    { command: 'claude-flow analyze imports src/ --external', description: 'List npm dependencies' },
    { command: 'claude-flow analyze diff --risk', description: 'Analyze diff with risk assessment' },
    { command: 'claude-flow analyze boundaries src/', description: 'Find code boundaries using MinCut' },
    { command: 'claude-flow analyze modules src/', description: 'Detect module communities with Louvain' },
    { command: 'claude-flow analyze dependencies src/ --format dot', description: 'Export dependency graph as DOT' },
    { command: 'claude-flow analyze circular src/', description: 'Find circular dependencies' },
    { command: 'claude-flow analyze deps --security', description: 'Check dependency vulnerabilities' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // If no subcommand, show help
    output.writeln();
    output.writeln(output.bold('Analyze Commands'));
    output.writeln(output.dim('-'.repeat(50)));
    output.writeln();

    output.writeln(output.bold('Available subcommands:'));
    output.writeln();
    output.writeln(`  ${output.highlight('diff')}         Analyze git diff for change risk and classification`);
    output.writeln(`  ${output.highlight('code')}         Static code analysis and quality assessment`);
    output.writeln(`  ${output.highlight('deps')}         Analyze project dependencies`);
    output.writeln(`  ${output.highlight('ast')}          AST analysis with symbol extraction and complexity`);
    output.writeln(`  ${output.highlight('complexity')}   Analyze cyclomatic and cognitive complexity`);
    output.writeln(`  ${output.highlight('symbols')}      Extract functions, classes, and types`);
    output.writeln(`  ${output.highlight('imports')}      Analyze import dependencies`);
    output.writeln(`  ${output.highlight('boundaries')}   Find code boundaries using MinCut algorithm`);
    output.writeln(`  ${output.highlight('modules')}      Detect module communities using Louvain algorithm`);
    output.writeln(`  ${output.highlight('dependencies')} Build and export full dependency graph`);
    output.writeln(`  ${output.highlight('circular')}     Detect circular dependencies in codebase`);
    output.writeln();

    output.writeln(output.bold('AST Analysis Examples:'));
    output.writeln();
    output.writeln(`  ${output.dim('claude-flow analyze ast src/')}                  # Full AST analysis`);
    output.writeln(`  ${output.dim('claude-flow analyze ast src/index.ts -c')}       # Include complexity`);
    output.writeln(`  ${output.dim('claude-flow analyze complexity src/ -t 15')}     # Flag high complexity`);
    output.writeln(`  ${output.dim('claude-flow analyze symbols src/ --type fn')}    # Extract functions`);
    output.writeln(`  ${output.dim('claude-flow analyze imports src/ --external')}   # Only npm imports`);
    output.writeln();

    output.writeln(output.bold('Graph Analysis Examples:'));
    output.writeln();
    output.writeln(`  ${output.dim('claude-flow analyze boundaries src/')}            # Find natural code boundaries`);
    output.writeln(`  ${output.dim('claude-flow analyze modules src/')}               # Detect module communities`);
    output.writeln(`  ${output.dim('claude-flow analyze dependencies -f dot src/')}   # Export to DOT format`);
    output.writeln(`  ${output.dim('claude-flow analyze circular src/')}              # Find circular deps`);
    output.writeln();

    output.writeln(output.bold('Diff Analysis Examples:'));
    output.writeln();
    output.writeln(`  ${output.dim('claude-flow analyze diff --risk')}              # Risk assessment`);
    output.writeln(`  ${output.dim('claude-flow analyze diff HEAD~1 --classify')}   # Classify changes`);
    output.writeln(`  ${output.dim('claude-flow analyze diff main..feature')}       # Compare branches`);
    output.writeln();

    return { success: true };
  },
};

export default analyzeCommand;

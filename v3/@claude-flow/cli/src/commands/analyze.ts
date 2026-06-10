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

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';
import { callMCPTool, MCPClientError } from '../mcp-client.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { resolve } from 'path';
// Pure display/formatting helpers (path truncation, complexity colour-
// coding, symbol type markers, risk/status badges) moved to
// ./analyze/display-helpers.ts (W72, P3.5 cut #1).
import {
  getRiskDisplay,
  getStatusDisplay,
} from './analyze/display-helpers.js';
// Shared analysis infrastructure — lazy AST/graph analyzer loaders +
// source-file scanner + regex fallback analyzer — moved to
// ./analyze/scan-helpers.ts (W73, P3.5 cut #2).
import { scanSourceFiles } from './analyze/scan-helpers.js';

// Diff subcommand
const diffCommand: Command = {
  name: 'diff',
  description: 'Analyze git diff for change risk assessment and classification',
  options: [
    {
      name: 'risk',
      short: 'r',
      description: 'Show risk assessment',
      type: 'boolean',
      default: false,
    },
    {
      name: 'classify',
      short: 'c',
      description: 'Classify change type',
      type: 'boolean',
      default: false,
    },
    {
      name: 'reviewers',
      description: 'Show recommended reviewers',
      type: 'boolean',
      default: false,
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format: text, json, table',
      type: 'string',
      default: 'text',
      choices: ['text', 'json', 'table'],
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Show detailed file-level analysis',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'claude-flow analyze diff --risk', description: 'Analyze current diff with risk assessment' },
    { command: 'claude-flow analyze diff HEAD~1 --classify', description: 'Classify changes from last commit' },
    { command: 'claude-flow analyze diff main..feature --format json', description: 'Compare branches with JSON output' },
    { command: 'claude-flow analyze diff --reviewers', description: 'Get recommended reviewers for changes' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const ref = ctx.args[0] || 'HEAD';
    const showRisk = ctx.flags.risk as boolean;
    const showClassify = ctx.flags.classify as boolean;
    const showReviewers = ctx.flags.reviewers as boolean;
    const formatType = ctx.flags.format as string || 'text';
    const verbose = ctx.flags.verbose as boolean;

    // If no specific flag, show all
    const showAll = !showRisk && !showClassify && !showReviewers;

    output.printInfo(`Analyzing diff: ${output.highlight(ref)}`);

    try {
      // Call MCP tool for diff analysis
      const result = await callMCPTool<{
        ref: string;
        timestamp: string;
        files: Array<{
          path: string;
          status: string;
          additions: number;
          deletions: number;
          binary: boolean;
        }>;
        risk: {
          overall: string;
          score: number;
          breakdown: {
            fileCount: number;
            totalChanges: number;
            highRiskFiles: string[];
            securityConcerns: string[];
            breakingChanges: string[];
            testCoverage: string;
          };
        };
        classification: {
          category: string;
          subcategory?: string;
          confidence: number;
          reasoning: string;
        };
        fileRisks: Array<{
          path: string;
          risk: string;
          score: number;
          reasons: string[];
        }>;
        recommendedReviewers: string[];
        summary: string;
      }>('analyze_diff', {
        ref,
        includeFileRisks: verbose,
        includeReviewers: showReviewers || showAll,
      });

      // JSON output
      if (formatType === 'json') {
        output.printJson(result);
        return { success: true, data: result };
      }

      output.writeln();

      // Summary box
      const files = result.files || [];
      const risk = result.risk || { overall: 'unknown', score: 0, breakdown: { fileCount: 0, totalChanges: 0, highRiskFiles: [], securityConcerns: [], breakingChanges: [], testCoverage: 'unknown' } };
      const classification = result.classification || { category: 'unknown', confidence: 0, reasoning: '' };

      output.printBox(
        [
          `Ref: ${result.ref || 'HEAD'}`,
          `Files: ${files.length}`,
          `Risk: ${getRiskDisplay(risk.overall)} (${risk.score}/100)`,
          `Type: ${classification.category}${classification.subcategory ? ` (${classification.subcategory})` : ''}`,
          ``,
          result.summary || 'No summary available',
        ].join('\n'),
        'Diff Analysis'
      );

      // Risk assessment
      if (showRisk || showAll) {
        output.writeln();
        output.writeln(output.bold('Risk Assessment'));
        output.writeln(output.dim('-'.repeat(50)));

        output.printTable({
          columns: [
            { key: 'metric', header: 'Metric', width: 25 },
            { key: 'value', header: 'Value', width: 30 },
          ],
          data: [
            { metric: 'Overall Risk', value: getRiskDisplay(risk.overall) },
            { metric: 'Risk Score', value: `${risk.score}/100` },
            { metric: 'Files Changed', value: risk.breakdown.fileCount },
            { metric: 'Total Lines Changed', value: risk.breakdown.totalChanges },
            { metric: 'Test Coverage', value: risk.breakdown.testCoverage },
          ],
        });

        // Security concerns
        if (risk.breakdown.securityConcerns.length > 0) {
          output.writeln();
          output.writeln(output.bold(output.warning('Security Concerns')));
          output.printList(risk.breakdown.securityConcerns.map(c => output.warning(c)));
        }

        // Breaking changes
        if (risk.breakdown.breakingChanges.length > 0) {
          output.writeln();
          output.writeln(output.bold(output.error('Potential Breaking Changes')));
          output.printList(risk.breakdown.breakingChanges.map(c => output.error(c)));
        }

        // High risk files
        if (risk.breakdown.highRiskFiles.length > 0) {
          output.writeln();
          output.writeln(output.bold('High Risk Files'));
          output.printList(risk.breakdown.highRiskFiles.map(f => output.warning(f)));
        }
      }

      // Classification
      if (showClassify || showAll) {
        output.writeln();
        output.writeln(output.bold('Classification'));
        output.writeln(output.dim('-'.repeat(50)));

        output.printTable({
          columns: [
            { key: 'field', header: 'Field', width: 15 },
            { key: 'value', header: 'Value', width: 40 },
          ],
          data: [
            { field: 'Category', value: classification.category },
            { field: 'Subcategory', value: classification.subcategory || '-' },
            { field: 'Confidence', value: `${(classification.confidence * 100).toFixed(0)}%` },
          ],
        });

        output.writeln();
        output.writeln(output.dim(`Reasoning: ${classification.reasoning}`));
      }

      // Reviewers
      if (showReviewers || showAll) {
        output.writeln();
        output.writeln(output.bold('Recommended Reviewers'));
        output.writeln(output.dim('-'.repeat(50)));

        const reviewers = result.recommendedReviewers || [];
        if (reviewers.length > 0) {
          output.printNumberedList(reviewers.map(r => output.highlight(r)));
        } else {
          output.writeln(output.dim('No specific reviewers recommended'));
        }
      }

      // Verbose file-level details
      if (verbose && result.fileRisks) {
        output.writeln();
        output.writeln(output.bold('File-Level Analysis'));
        output.writeln(output.dim('-'.repeat(50)));

        output.printTable({
          columns: [
            { key: 'path', header: 'File', width: 40 },
            { key: 'risk', header: 'Risk', width: 12, format: (v) => getRiskDisplay(String(v)) },
            { key: 'score', header: 'Score', width: 8, align: 'right' },
            { key: 'reasons', header: 'Reasons', width: 30, format: (v) => {
              const reasons = v as string[];
              return reasons.slice(0, 2).join('; ');
            }},
          ],
          data: result.fileRisks,
        });
      }

      // Files changed table
      if (formatType === 'table' || showAll) {
        output.writeln();
        output.writeln(output.bold('Files Changed'));
        output.writeln(output.dim('-'.repeat(50)));

        output.printTable({
          columns: [
            { key: 'status', header: 'Status', width: 10, format: (v) => getStatusDisplay(String(v)) },
            { key: 'path', header: 'File', width: 45 },
            { key: 'additions', header: '+', width: 8, align: 'right', format: (v) => output.success(`+${v}`) },
            { key: 'deletions', header: '-', width: 8, align: 'right', format: (v) => output.error(`-${v}`) },
          ],
          data: files.slice(0, 20),
        });

        if (files.length > 20) {
          output.writeln(output.dim(`  ... and ${files.length - 20} more files`));
        }
      }

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof MCPClientError) {
        output.printError(`Diff analysis failed: ${error.message}`);
      } else {
        output.printError(`Unexpected error: ${String(error)}`);
      }
      return { success: false, exitCode: 1 };
    }
  },
};

const codeCommand: Command = {
  name: 'code',
  description: 'Static code analysis and quality assessment',
  options: [
    { name: 'path', short: 'p', type: 'string', description: 'Path to analyze', default: '.' },
    { name: 'type', short: 't', type: 'string', description: 'Analysis type: quality, complexity, security', default: 'quality' },
    { name: 'format', short: 'f', type: 'string', description: 'Output format: text, json', default: 'text' },
  ],
  examples: [
    { command: 'claude-flow analyze code -p ./src', description: 'Analyze source directory' },
    { command: 'claude-flow analyze code --type complexity', description: 'Run complexity analysis' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetPath = resolve(ctx.flags.path as string || '.');
    const analysisType = ctx.flags.type as string || 'quality';
    const formatJson = (ctx.flags.format as string) === 'json';

    output.writeln();
    output.writeln(output.bold('Code Analysis'));
    output.writeln(output.dim('-'.repeat(50)));

    const spinner = output.createSpinner({ text: `Analyzing ${targetPath}...`, spinner: 'dots' });
    spinner.start();

    try {
      const files = await scanSourceFiles(targetPath);
      if (files.length === 0) {
        spinner.stop();
        output.printWarning('No source files found');
        return { success: true };
      }

      const fileStats: Array<{ file: string; loc: number; todos: number; functions: number; imports: number; maxNesting: number; securityIssues: string[] }> = [];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const nonEmpty = lines.filter(l => l.trim().length > 0 && !/^\s*(\/\/|\/\*|\*\s|#)/.test(l)).length;
        const todos = (content.match(/\b(TODO|FIXME|HACK|XXX)\b/gi) || []).length;
        const fns = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g) || []).length;
        const imps = (content.match(/^import\s+/gm) || []).length + (content.match(/require\s*\(/g) || []).length;

        let maxNesting = 0;
        let nesting = 0;
        for (const line of lines) {
          nesting += (line.match(/\{/g) || []).length;
          nesting -= (line.match(/\}/g) || []).length;
          if (nesting > maxNesting) maxNesting = nesting;
        }

        const securityIssues: string[] = [];
        if (/\beval\s*\(/.test(content)) securityIssues.push('eval()');
        if (/\bexec\s*\(/.test(content)) securityIssues.push('exec()');
        if (/\.innerHTML\s*=/.test(content)) securityIssues.push('innerHTML');
        if (/dangerouslySetInnerHTML/.test(content)) securityIssues.push('dangerouslySetInnerHTML');
        if (/['"](?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]{3,}['"]/i.test(content)) securityIssues.push('hardcoded secret');
        if (/new\s+Function\s*\(/.test(content)) securityIssues.push('new Function()');

        fileStats.push({
          file: filePath,
          loc: nonEmpty,
          todos,
          functions: fns,
          imports: imps,
          maxNesting,
          securityIssues,
        });
      }

      spinner.stop();

      const totalLoc = fileStats.reduce((s, f) => s + f.loc, 0);
      const totalTodos = fileStats.reduce((s, f) => s + f.todos, 0);
      const totalFunctions = fileStats.reduce((s, f) => s + f.functions, 0);
      const totalImports = fileStats.reduce((s, f) => s + f.imports, 0);
      const avgFileSize = Math.round(totalLoc / files.length);
      const longestFile = fileStats.reduce((a, b) => a.loc > b.loc ? a : b);
      const avgFnPerFile = (totalFunctions / files.length).toFixed(1);
      const deepestNesting = fileStats.reduce((a, b) => a.maxNesting > b.maxNesting ? a : b);
      const allSecurityIssues = fileStats.filter(f => f.securityIssues.length > 0);

      if (formatJson) {
        const jsonData = { type: analysisType, path: targetPath, files: files.length, totalLoc, totalTodos, totalFunctions, totalImports, avgFileSize, fileStats: fileStats.map(f => ({ relativePath: path.relative(targetPath, f.file), loc: f.loc, todos: f.todos, functions: f.functions, imports: f.imports, maxNesting: f.maxNesting, securityIssues: f.securityIssues })) };
        output.printJson(jsonData);
        return { success: true, data: jsonData };
      }

      if (analysisType === 'quality') {
        output.printBox(
          [`Files: ${files.length}`, `Lines of Code: ${totalLoc.toLocaleString()}`, `Avg File Size: ${avgFileSize} LOC`, `TODO/FIXME: ${totalTodos}`, `Functions: ${totalFunctions}`, `Imports: ${totalImports}`].join('\n'),
          'Quality Summary'
        );
        output.writeln();
        output.writeln(output.bold('Largest Files'));
        output.writeln(output.dim('-'.repeat(60)));
        const top10 = [...fileStats].sort((a, b) => b.loc - a.loc).slice(0, 10);
        output.printTable({
          columns: [
            { key: 'file', header: 'File', width: 45 },
            { key: 'loc', header: 'LOC', width: 8, align: 'right' as const },
            { key: 'fns', header: 'Fns', width: 6, align: 'right' as const },
            { key: 'todos', header: 'TODOs', width: 7, align: 'right' as const },
          ],
          data: top10.map(f => ({ file: path.relative(targetPath, f.file), loc: f.loc, fns: f.functions, todos: f.todos })),
        });
        if (totalTodos > 0) {
          output.writeln();
          output.printWarning(`${totalTodos} TODO/FIXME comments found across ${fileStats.filter(f => f.todos > 0).length} files`);
        }
      } else if (analysisType === 'complexity') {
        output.printBox(
          [`Files: ${files.length}`, `Total Functions: ${totalFunctions}`, `Avg Functions/File: ${avgFnPerFile}`, `Deepest Nesting: ${deepestNesting.maxNesting} levels (${path.relative(targetPath, deepestNesting.file)})`, `Longest File: ${longestFile.loc} LOC (${path.relative(targetPath, longestFile.file)})`].join('\n'),
          'Complexity Summary'
        );
        output.writeln();
        output.writeln(output.bold('High Complexity Files (nesting > 5)'));
        output.writeln(output.dim('-'.repeat(60)));
        const complex = fileStats.filter(f => f.maxNesting > 5).sort((a, b) => b.maxNesting - a.maxNesting);
        if (complex.length === 0) {
          output.printSuccess('No files with excessive nesting detected');
        } else {
          output.printTable({
            columns: [
              { key: 'file', header: 'File', width: 45 },
              { key: 'nesting', header: 'Max Nest', width: 10, align: 'right' as const },
              { key: 'fns', header: 'Fns', width: 6, align: 'right' as const },
              { key: 'loc', header: 'LOC', width: 8, align: 'right' as const },
            ],
            data: complex.slice(0, 15).map(f => ({ file: path.relative(targetPath, f.file), nesting: f.maxNesting, fns: f.functions, loc: f.loc })),
          });
        }
      } else if (analysisType === 'security') {
        output.printBox(
          [`Files Scanned: ${files.length}`, `Files with Issues: ${allSecurityIssues.length}`, `Total Issues: ${allSecurityIssues.reduce((s, f) => s + f.securityIssues.length, 0)}`].join('\n'),
          'Security Summary'
        );
        if (allSecurityIssues.length === 0) {
          output.writeln();
          output.printSuccess('No common security patterns detected');
        } else {
          output.writeln();
          output.writeln(output.bold('Security Concerns'));
          output.writeln(output.dim('-'.repeat(60)));
          output.printTable({
            columns: [
              { key: 'file', header: 'File', width: 40 },
              { key: 'issues', header: 'Issues', width: 35 },
            ],
            data: allSecurityIssues.map(f => ({ file: path.relative(targetPath, f.file), issues: f.securityIssues.join(', ') })),
          });
        }
      } else {
        output.printWarning(`Unknown analysis type: ${analysisType}. Use quality, complexity, or security.`);
      }

      return { success: true };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Code analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// AST analysis subcommands (astCommand, complexityAstCommand,
// symbolsCommand, importsCommand) moved to ./analyze/commands-ast.ts
// (W74, P3.5 cut #3). Imported so analyzeCommand can register them.
import {
  astCommand,
  complexityAstCommand,
  symbolsCommand,
  importsCommand,
} from './analyze/commands-ast.js';
// Graph / dependency-analysis subcommands (depsCommand, boundaries
// Command, modulesCommand, dependenciesCommand, circularCommand) moved
// to ./analyze/commands-graph.ts (W75, P3.5 cut #4).
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

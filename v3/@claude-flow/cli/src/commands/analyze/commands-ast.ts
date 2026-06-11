/**
 * AST-analysis subcommands for `analyze` — tree-sitter-backed structural
 * analysis with the regex fallback.
 *
 *   - astCommand            (full AST dump per file)
 *   - complexityAstCommand  (cyclomatic complexity ranking)
 *   - symbolsCommand        (function/class/type symbol extraction)
 *   - importsCommand        (import graph per file)
 *
 * Extracted from analyze.ts (W74, P3.5 cut #3).
 */
import * as fs from 'fs/promises';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { getASTAnalyzer, scanSourceFiles, fallbackAnalyze } from './scan-helpers.js';
import {
  truncatePathAst,
  formatComplexityValueAst,
  getTypeMarkerAst,
  getComplexityRatingAst,
} from './display-helpers.js';

/**
 * AST analysis subcommand
 */
export const astCommand: Command = {
  name: 'ast',
  description: 'Analyze code using AST parsing (tree-sitter via ruvector)',
  options: [
    {
      name: 'complexity',
      short: 'c',
      description: 'Include complexity metrics',
      type: 'boolean',
      default: false,
    },
    {
      name: 'symbols',
      short: 's',
      description: 'Include symbol extraction',
      type: 'boolean',
      default: false,
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (text, json, table)',
      type: 'string',
      default: 'text',
      choices: ['text', 'json', 'table'],
    },
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Show detailed analysis',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'claude-flow analyze ast src/', description: 'Analyze all files in src/' },
    { command: 'claude-flow analyze ast src/index.ts --complexity', description: 'Analyze with complexity' },
    { command: 'claude-flow analyze ast . --format json', description: 'JSON output' },
    { command: 'claude-flow analyze ast src/ --symbols', description: 'Extract symbols' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetPath = ctx.args[0] || ctx.cwd;
    const showComplexity = ctx.flags.complexity as boolean;
    const showSymbols = ctx.flags.symbols as boolean;
    const formatType = (ctx.flags.format as string) || 'text';
    const outputFile = ctx.flags.output as string | undefined;
    const verbose = ctx.flags.verbose as boolean;

    // If no specific flags, show summary
    const showAll = !showComplexity && !showSymbols;

    output.printInfo(`Analyzing: ${output.highlight(targetPath)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Parsing AST...', spinner: 'dots' });
    spinner.start();

    try {
      const astModule = await getASTAnalyzer();
      if (!astModule) {
        spinner.stop();
        output.printWarning('AST analyzer not available, using regex fallback');
      }

      // Resolve path and check if file or directory
      const resolvedPath = resolve(targetPath);
      const stat = await fs.stat(resolvedPath);
      const isDirectory = stat.isDirectory();

      let results: Array<{
        filePath: string;
        language: string;
        functions: Array<{ name: string; startLine: number; endLine: number }>;
        classes: Array<{ name: string; startLine: number; endLine: number }>;
        imports: string[];
        exports: string[];
        complexity: { cyclomatic: number; cognitive: number; loc: number; commentDensity: number };
      }> = [];

      if (isDirectory) {
        // Scan directory for source files
        const files = await scanSourceFiles(resolvedPath);
        spinner.stop();
        output.printInfo(`Found ${files.length} source files`);
        spinner.start();

        for (const file of files.slice(0, 100)) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            if (astModule) {
              const analyzer = astModule.createASTAnalyzer();
              const analysis = analyzer.analyze(content, file);
              results.push(analysis);
            } else {
              // Fallback analysis
              results.push(fallbackAnalyze(content, file));
            }
          } catch {
            // Skip files that can't be analyzed
          }
        }
      } else {
        // Single file
        const content = await fs.readFile(resolvedPath, 'utf-8');
        if (astModule) {
          const analyzer = astModule.createASTAnalyzer();
          const analysis = analyzer.analyze(content, resolvedPath);
          results.push(analysis);
        } else {
          results.push(fallbackAnalyze(content, resolvedPath));
        }
      }

      spinner.stop();

      if (results.length === 0) {
        output.printWarning('No files analyzed');
        return { success: true };
      }

      // Calculate totals
      const totals = {
        files: results.length,
        functions: results.reduce((sum, r) => sum + r.functions.length, 0),
        classes: results.reduce((sum, r) => sum + r.classes.length, 0),
        imports: results.reduce((sum, r) => sum + r.imports.length, 0),
        avgComplexity: results.reduce((sum, r) => sum + r.complexity.cyclomatic, 0) / results.length,
        totalLoc: results.reduce((sum, r) => sum + r.complexity.loc, 0),
      };

      // JSON output
      if (formatType === 'json') {
        const jsonOutput = { files: results, totals };
        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }
        return { success: true, data: jsonOutput };
      }

      // Summary box
      output.printBox(
        [
          `Files analyzed: ${totals.files}`,
          `Functions: ${totals.functions}`,
          `Classes: ${totals.classes}`,
          `Total LOC: ${totals.totalLoc}`,
          `Avg Complexity: ${formatComplexityValueAst(Math.round(totals.avgComplexity))}`,
        ].join('\n'),
        'AST Analysis Summary'
      );

      // Complexity view
      if (showComplexity || showAll) {
        output.writeln();
        output.writeln(output.bold('Complexity by File'));
        output.writeln(output.dim('-'.repeat(60)));

        const complexityData = results
          .map(r => ({
            file: truncatePathAst(r.filePath),
            cyclomatic: r.complexity.cyclomatic,
            cognitive: r.complexity.cognitive,
            loc: r.complexity.loc,
            rating: getComplexityRatingAst(r.complexity.cyclomatic),
          }))
          .sort((a, b) => b.cyclomatic - a.cyclomatic)
          .slice(0, 15);

        output.printTable({
          columns: [
            { key: 'file', header: 'File', width: 40 },
            { key: 'cyclomatic', header: 'Cyclo', width: 8, align: 'right', format: (v) => formatComplexityValueAst(v as number) },
            { key: 'cognitive', header: 'Cogni', width: 8, align: 'right' },
            { key: 'loc', header: 'LOC', width: 8, align: 'right' },
            { key: 'rating', header: 'Rating', width: 15 },
          ],
          data: complexityData,
        });

        if (results.length > 15) {
          output.writeln(output.dim(`  ... and ${results.length - 15} more files`));
        }
      }

      // Symbols view
      if (showSymbols || showAll) {
        output.writeln();
        output.writeln(output.bold('Extracted Symbols'));
        output.writeln(output.dim('-'.repeat(60)));

        const allSymbols: Array<{ name: string; type: string; file: string; line: number }> = [];

        for (const r of results) {
          for (const fn of r.functions) {
            allSymbols.push({ name: fn.name, type: 'function', file: truncatePathAst(r.filePath, 30), line: fn.startLine });
          }
          for (const cls of r.classes) {
            allSymbols.push({ name: cls.name, type: 'class', file: truncatePathAst(r.filePath, 30), line: cls.startLine });
          }
        }

        const displaySymbols = allSymbols.slice(0, 20);

        output.printTable({
          columns: [
            { key: 'type', header: 'Type', width: 8, format: (v) => getTypeMarkerAst(v as string) },
            { key: 'name', header: 'Symbol', width: 30 },
            { key: 'file', header: 'File', width: 35 },
            { key: 'line', header: 'Line', width: 8, align: 'right' },
          ],
          data: displaySymbols,
        });

        if (allSymbols.length > 20) {
          output.writeln(output.dim(`  ... and ${allSymbols.length - 20} more symbols`));
        }
      }

      // Verbose output
      if (verbose) {
        output.writeln();
        output.writeln(output.bold('Import Analysis'));
        output.writeln(output.dim('-'.repeat(60)));

        const importCounts: Map<string, number> = new Map();
        for (const r of results) {
          for (const imp of r.imports) {
            importCounts.set(imp, (importCounts.get(imp) || 0) + 1);
          }
        }

        const topImports = Array.from(importCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        for (const [imp, count] of topImports) {
          output.writeln(`  ${output.highlight(count.toString().padStart(3))} ${imp}`);
        }
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify({ files: results, totals }, null, 2));
        output.printSuccess(`Results written to ${outputFile}`);
      }

      return { success: true, data: { files: results, totals } };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`AST analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Complexity analysis subcommand
 */
export const complexityAstCommand: Command = {
  name: 'complexity',
  aliases: ['cx'],
  description: 'Analyze code complexity metrics',
  options: [
    {
      name: 'threshold',
      short: 't',
      description: 'Complexity threshold to flag (default: 10)',
      type: 'number',
      default: 10,
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (text, json)',
      type: 'string',
      default: 'text',
      choices: ['text', 'json'],
    },
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
    },
  ],
  examples: [
    { command: 'claude-flow analyze complexity src/', description: 'Analyze complexity' },
    { command: 'claude-flow analyze complexity src/ --threshold 15', description: 'Flag high complexity' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetPath = ctx.args[0] || ctx.cwd;
    const threshold = (ctx.flags.threshold as number) || 10;
    const formatType = (ctx.flags.format as string) || 'text';
    const outputFile = ctx.flags.output as string | undefined;

    output.printInfo(`Analyzing complexity: ${output.highlight(targetPath)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Calculating complexity...', spinner: 'dots' });
    spinner.start();

    try {
      const astModule = await getASTAnalyzer();
      const resolvedPath = resolve(targetPath);
      const stat = await fs.stat(resolvedPath);
      const files = stat.isDirectory() ? await scanSourceFiles(resolvedPath) : [resolvedPath];

      const results: Array<{
        file: string;
        cyclomatic: number;
        cognitive: number;
        loc: number;
        commentDensity: number;
        rating: string;
        flagged: boolean;
      }> = [];

      for (const file of files.slice(0, 100)) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          let analysis;

          if (astModule) {
            const analyzer = astModule.createASTAnalyzer();
            analysis = analyzer.analyze(content, file);
          } else {
            analysis = fallbackAnalyze(content, file);
          }

          const flagged = analysis.complexity.cyclomatic > threshold;
          const rating = analysis.complexity.cyclomatic <= 5 ? 'Simple' :
            analysis.complexity.cyclomatic <= 10 ? 'Moderate' :
            analysis.complexity.cyclomatic <= 20 ? 'Complex' : 'Very Complex';

          results.push({
            file: file,
            cyclomatic: analysis.complexity.cyclomatic,
            cognitive: analysis.complexity.cognitive,
            loc: analysis.complexity.loc,
            commentDensity: analysis.complexity.commentDensity,
            rating,
            flagged,
          });
        } catch {
          // Skip files that can't be analyzed
        }
      }

      spinner.stop();

      // Sort by complexity descending
      results.sort((a, b) => b.cyclomatic - a.cyclomatic);

      const flaggedCount = results.filter(r => r.flagged).length;
      const avgComplexity = results.length > 0
        ? results.reduce((sum, r) => sum + r.cyclomatic, 0) / results.length
        : 0;

      if (formatType === 'json') {
        const jsonOutput = { files: results, summary: { total: results.length, flagged: flaggedCount, avgComplexity, threshold } };
        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }
        return { success: true, data: jsonOutput };
      }

      // Summary
      output.printBox(
        [
          `Files analyzed: ${results.length}`,
          `Threshold: ${threshold}`,
          `Flagged files: ${flaggedCount > 0 ? output.error(String(flaggedCount)) : output.success('0')}`,
          `Average complexity: ${formatComplexityValueAst(Math.round(avgComplexity))}`,
        ].join('\n'),
        'Complexity Analysis'
      );

      // Show flagged files first
      if (flaggedCount > 0) {
        output.writeln();
        output.writeln(output.bold(output.warning(`High Complexity Files (>${threshold})`)));
        output.writeln(output.dim('-'.repeat(60)));

        const flaggedFiles = results.filter(r => r.flagged).slice(0, 10);
        output.printTable({
          columns: [
            { key: 'file', header: 'File', width: 40, format: (v) => truncatePathAst(v as string) },
            { key: 'cyclomatic', header: 'Cyclo', width: 8, align: 'right', format: (v) => output.error(String(v)) },
            { key: 'cognitive', header: 'Cogni', width: 8, align: 'right' },
            { key: 'loc', header: 'LOC', width: 8, align: 'right' },
            { key: 'rating', header: 'Rating', width: 15 },
          ],
          data: flaggedFiles,
        });
      }

      // Show all files in table format
      output.writeln();
      output.writeln(output.bold('All Files'));
      output.writeln(output.dim('-'.repeat(60)));

      const displayFiles = results.slice(0, 15);
      output.printTable({
        columns: [
          { key: 'file', header: 'File', width: 40, format: (v) => truncatePathAst(v as string) },
          { key: 'cyclomatic', header: 'Cyclo', width: 8, align: 'right', format: (v) => formatComplexityValueAst(v as number) },
          { key: 'cognitive', header: 'Cogni', width: 8, align: 'right' },
          { key: 'loc', header: 'LOC', width: 8, align: 'right' },
        ],
        data: displayFiles,
      });

      if (results.length > 15) {
        output.writeln(output.dim(`  ... and ${results.length - 15} more files`));
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify({ files: results, summary: { total: results.length, flagged: flaggedCount, avgComplexity, threshold } }, null, 2));
        output.printSuccess(`Results written to ${outputFile}`);
      }

      return { success: true, data: { files: results, flaggedCount } };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Complexity analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Symbol extraction subcommand
 */

// The symbols/imports subcommands were extracted into
// ./commands-ast-symbols.ts during campaign-2 wave 85 (W291).
export { symbolsCommand, importsCommand } from './commands-ast-symbols.js';

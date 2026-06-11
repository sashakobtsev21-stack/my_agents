/**
 * Analyze AST — symbols / imports subcommands
 *
 * Extracted verbatim from commands-ast.ts (lines 474-796) during
 * campaign-2 wave 85 (W291). commands-ast.ts stays the barrel.
 */
import * as fs from 'fs/promises';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { getASTAnalyzer, scanSourceFiles, fallbackAnalyze } from './scan-helpers.js';
import {
  truncatePathAst,
  getTypeMarkerAst,
} from './display-helpers.js';

export const symbolsCommand: Command = {
  name: 'symbols',
  aliases: ['sym'],
  description: 'Extract and list code symbols (functions, classes, types)',
  options: [
    {
      name: 'type',
      short: 't',
      description: 'Filter by symbol type (function, class, all)',
      type: 'string',
      default: 'all',
      choices: ['function', 'class', 'all'],
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
    { command: 'claude-flow analyze symbols src/', description: 'Extract all symbols' },
    { command: 'claude-flow analyze symbols src/ --type function', description: 'Only functions' },
    { command: 'claude-flow analyze symbols src/ --format json', description: 'JSON output' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetPath = ctx.args[0] || ctx.cwd;
    const symbolType = (ctx.flags.type as string) || 'all';
    const formatType = (ctx.flags.format as string) || 'text';
    const outputFile = ctx.flags.output as string | undefined;

    output.printInfo(`Extracting symbols: ${output.highlight(targetPath)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Parsing code...', spinner: 'dots' });
    spinner.start();

    try {
      const astModule = await getASTAnalyzer();
      const resolvedPath = resolve(targetPath);
      const stat = await fs.stat(resolvedPath);
      const files = stat.isDirectory() ? await scanSourceFiles(resolvedPath) : [resolvedPath];

      const symbols: Array<{
        name: string;
        type: string;
        file: string;
        startLine: number;
        endLine: number;
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

          if (symbolType === 'all' || symbolType === 'function') {
            for (const fn of analysis.functions) {
              symbols.push({
                name: fn.name,
                type: 'function',
                file,
                startLine: fn.startLine,
                endLine: fn.endLine,
              });
            }
          }

          if (symbolType === 'all' || symbolType === 'class') {
            for (const cls of analysis.classes) {
              symbols.push({
                name: cls.name,
                type: 'class',
                file,
                startLine: cls.startLine,
                endLine: cls.endLine,
              });
            }
          }
        } catch {
          // Skip files that can't be parsed
        }
      }

      spinner.stop();

      // Sort by file then name
      symbols.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

      if (formatType === 'json') {
        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(symbols, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(symbols);
        }
        return { success: true, data: symbols };
      }

      // Summary
      const functionCount = symbols.filter(s => s.type === 'function').length;
      const classCount = symbols.filter(s => s.type === 'class').length;

      output.printBox(
        [
          `Total symbols: ${symbols.length}`,
          `Functions: ${functionCount}`,
          `Classes: ${classCount}`,
          `Files: ${files.length}`,
        ].join('\n'),
        'Symbol Extraction'
      );

      output.writeln();
      output.writeln(output.bold('Symbols'));
      output.writeln(output.dim('-'.repeat(60)));

      const displaySymbols = symbols.slice(0, 30);
      output.printTable({
        columns: [
          { key: 'type', header: 'Type', width: 10, format: (v) => getTypeMarkerAst(v as string) },
          { key: 'name', header: 'Name', width: 30 },
          { key: 'file', header: 'File', width: 35, format: (v) => truncatePathAst(v as string, 33) },
          { key: 'startLine', header: 'Line', width: 8, align: 'right' },
        ],
        data: displaySymbols,
      });

      if (symbols.length > 30) {
        output.writeln(output.dim(`  ... and ${symbols.length - 30} more symbols`));
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify(symbols, null, 2));
        output.printSuccess(`Results written to ${outputFile}`);
      }

      return { success: true, data: symbols };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Symbol extraction failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Imports analysis subcommand
 */
export const importsCommand: Command = {
  name: 'imports',
  aliases: ['imp'],
  description: 'Analyze import dependencies across files',
  options: [
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
    {
      name: 'external',
      short: 'e',
      description: 'Show only external (npm) imports',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'claude-flow analyze imports src/', description: 'Analyze all imports' },
    { command: 'claude-flow analyze imports src/ --external', description: 'Only npm packages' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetPath = ctx.args[0] || ctx.cwd;
    const formatType = (ctx.flags.format as string) || 'text';
    const outputFile = ctx.flags.output as string | undefined;
    const externalOnly = ctx.flags.external as boolean;

    output.printInfo(`Analyzing imports: ${output.highlight(targetPath)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Scanning imports...', spinner: 'dots' });
    spinner.start();

    try {
      const astModule = await getASTAnalyzer();
      const resolvedPath = resolve(targetPath);
      const stat = await fs.stat(resolvedPath);
      const files = stat.isDirectory() ? await scanSourceFiles(resolvedPath) : [resolvedPath];

      const importCounts: Map<string, { count: number; files: string[] }> = new Map();
      const fileImports: Map<string, string[]> = new Map();

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

          const imports = analysis.imports.filter(imp => {
            if (externalOnly) {
              return !imp.startsWith('.') && !imp.startsWith('/');
            }
            return true;
          });

          fileImports.set(file, imports);

          for (const imp of imports) {
            const existing = importCounts.get(imp) || { count: 0, files: [] };
            existing.count++;
            existing.files.push(file);
            importCounts.set(imp, existing);
          }
        } catch {
          // Skip files that can't be parsed
        }
      }

      spinner.stop();

      // Sort by count
      const sortedImports = Array.from(importCounts.entries())
        .sort((a, b) => b[1].count - a[1].count);

      if (formatType === 'json') {
        const jsonOutput = {
          imports: Object.fromEntries(sortedImports),
          fileImports: Object.fromEntries(fileImports),
        };
        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }
        return { success: true, data: jsonOutput };
      }

      // Summary
      const externalImports = sortedImports.filter(([imp]) => !imp.startsWith('.') && !imp.startsWith('/'));
      const localImports = sortedImports.filter(([imp]) => imp.startsWith('.') || imp.startsWith('/'));

      output.printBox(
        [
          `Total unique imports: ${sortedImports.length}`,
          `External (npm): ${externalImports.length}`,
          `Local (relative): ${localImports.length}`,
          `Files scanned: ${files.length}`,
        ].join('\n'),
        'Import Analysis'
      );

      // Most used imports
      output.writeln();
      output.writeln(output.bold('Most Used Imports'));
      output.writeln(output.dim('-'.repeat(60)));

      const topImports = sortedImports.slice(0, 20);
      output.printTable({
        columns: [
          { key: 'count', header: 'Uses', width: 8, align: 'right' },
          { key: 'import', header: 'Import', width: 50 },
          { key: 'type', header: 'Type', width: 10 },
        ],
        data: topImports.map(([imp, data]) => ({
          count: data.count,
          import: imp,
          type: imp.startsWith('.') || imp.startsWith('/') ? output.dim('local') : output.highlight('npm'),
        })),
      });

      if (sortedImports.length > 20) {
        output.writeln(output.dim(`  ... and ${sortedImports.length - 20} more imports`));
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify({
          imports: Object.fromEntries(sortedImports),
          fileImports: Object.fromEntries(fileImports),
        }, null, 2));
        output.printSuccess(`Results written to ${outputFile}`);
      }

      return { success: true, data: { imports: sortedImports } };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Import analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

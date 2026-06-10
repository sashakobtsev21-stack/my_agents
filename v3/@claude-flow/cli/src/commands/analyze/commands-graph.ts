/**
 * Graph / dependency-analysis subcommands for `analyze` — backed by the
 * ruvector graph analyzer.
 *
 *   - depsCommand          (project dependency summary)
 *   - boundariesCommand    (module boundary / layering analysis)
 *   - modulesCommand       (module cohesion metrics)
 *   - dependenciesCommand  (full dependency graph export)
 *   - circularCommand      (circular-dependency detection)
 *
 * Extracted from analyze.ts (W75, P3.5 cut #4).
 */
import * as fs from 'fs/promises';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';
import { getGraphAnalyzer } from './scan-helpers.js';

// Dependencies subcommand
export const depsCommand: Command = {
  name: 'deps',
  description: 'Analyze project dependencies',
  options: [
    { name: 'outdated', short: 'o', type: 'boolean', description: 'Show only outdated dependencies' },
    { name: 'security', short: 's', type: 'boolean', description: 'Check for security vulnerabilities' },
    { name: 'format', short: 'f', type: 'string', description: 'Output format: text, json', default: 'text' },
  ],
  examples: [
    { command: 'claude-flow analyze deps --outdated', description: 'Show outdated dependencies' },
    { command: 'claude-flow analyze deps --security', description: 'Check for vulnerabilities' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const showOutdated = ctx.flags.outdated as boolean;
    const checkSecurity = ctx.flags.security as boolean;
    const formatJson = (ctx.flags.format as string) === 'json';

    output.writeln();
    output.writeln(output.bold('Dependency Analysis'));
    output.writeln(output.dim('-'.repeat(50)));

    try {
      const pkgPath = resolve('package.json');
      let pkgContent: string;
      try {
        pkgContent = await fs.readFile(pkgPath, 'utf-8');
      } catch {
        output.printError('No package.json found in current directory');
        return { success: false, exitCode: 1 };
      }

      const pkg = JSON.parse(pkgContent);
      const deps = Object.entries(pkg.dependencies || {}) as [string, string][];
      const devDeps = Object.entries(pkg.devDependencies || {}) as [string, string][];
      const optDeps = Object.entries(pkg.optionalDependencies || {}) as [string, string][];
      const peerDeps = Object.entries(pkg.peerDependencies || {}) as [string, string][];
      const total = deps.length + devDeps.length + optDeps.length + peerDeps.length;

      if (formatJson && !showOutdated && !checkSecurity) {
        const jsonData = { name: pkg.name, version: pkg.version, dependencies: deps.length, devDependencies: devDeps.length, optionalDependencies: optDeps.length, peerDependencies: peerDeps.length, total };
        output.printJson(jsonData);
        return { success: true, data: jsonData };
      }

      output.printBox(
        [`Package: ${pkg.name || 'unknown'} @ ${pkg.version || '0.0.0'}`, `Dependencies: ${deps.length}`, `Dev Dependencies: ${devDeps.length}`, `Optional: ${optDeps.length}`, `Peer: ${peerDeps.length}`, `Total: ${total}`].join('\n'),
        'Dependency Summary'
      );

      if (showOutdated) {
        output.writeln();
        output.writeln(output.bold('Outdated Check'));
        output.writeln(output.dim('-'.repeat(60)));
        const outdated: Array<{ name: string; declared: string; installed: string; category: string }> = [];

        const checkDeps = async (entries: [string, string][], category: string) => {
          for (const [name, declared] of entries) {
            try {
              const installedPkg = resolve('node_modules', name, 'package.json');
              const raw = await fs.readFile(installedPkg, 'utf-8');
              const installedContent = JSON.parse(raw) as { version?: string };
              const installed = installedContent.version || 'unknown';
              const cleanDeclared = (declared as string).replace(/^[\^~>=<]+/, '');
              if (installed !== cleanDeclared) {
                outdated.push({ name, declared: declared as string, installed, category });
              }
            } catch {
              outdated.push({ name, declared: declared as string, installed: 'not installed', category });
            }
          }
        };

        await checkDeps(deps, 'prod');
        await checkDeps(devDeps, 'dev');

        if (outdated.length === 0) {
          output.printSuccess('All dependencies match declared versions');
        } else {
          output.printTable({
            columns: [
              { key: 'name', header: 'Package', width: 30 },
              { key: 'declared', header: 'Declared', width: 14 },
              { key: 'installed', header: 'Installed', width: 14 },
              { key: 'category', header: 'Type', width: 6 },
            ],
            data: outdated.slice(0, 30),
          });
          if (outdated.length > 30) {
            output.writeln(output.dim(`  ... and ${outdated.length - 30} more`));
          }
        }
      }

      if (checkSecurity) {
        output.writeln();
        output.writeln(output.bold('Security Audit'));
        output.writeln(output.dim('-'.repeat(60)));

        try {
          // ADR-078: execFileSync (no shell). Stderr piped & discarded — npm audit
          // prints findings on stdout as JSON; stderr noise (e.g. registry warnings)
          // was previously dropped via `2>/dev/null` in the shell-string form.
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          const auditRaw = execFileSync(npmCmd, ['audit', '--json'], {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const audit = JSON.parse(auditRaw);
          const vulns = audit.metadata?.vulnerabilities || audit.vulnerabilities || {};
          const info = vulns.info || 0;
          const low = vulns.low || 0;
          const moderate = vulns.moderate || 0;
          const high = vulns.high || 0;
          const critical = vulns.critical || 0;
          const totalVulns = info + low + moderate + high + critical;

          if (totalVulns === 0) {
            output.printSuccess('No known vulnerabilities found');
          } else {
            output.printTable({
              columns: [
                { key: 'severity', header: 'Severity', width: 12 },
                { key: 'count', header: 'Count', width: 8, align: 'right' as const },
              ],
              data: [
                ...(critical > 0 ? [{ severity: 'Critical', count: critical }] : []),
                ...(high > 0 ? [{ severity: 'High', count: high }] : []),
                ...(moderate > 0 ? [{ severity: 'Moderate', count: moderate }] : []),
                ...(low > 0 ? [{ severity: 'Low', count: low }] : []),
                ...(info > 0 ? [{ severity: 'Info', count: info }] : []),
                { severity: 'Total', count: totalVulns },
              ],
            });
            if (critical > 0 || high > 0) {
              output.printWarning(`${critical + high} high/critical vulnerabilities found. Run 'npm audit' for details.`);
            }
          }
        } catch {
          output.printWarning('npm audit failed. Ensure npm is available and node_modules is installed.');
        }
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Dependency analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

// ============================================================================
// Graph Analysis Subcommands (MinCut, Louvain, Circular Dependencies)
// ============================================================================

/**
 * Analyze code boundaries using MinCut algorithm
 */
export const boundariesCommand: Command = {
  name: 'boundaries',
  aliases: ['boundary', 'mincut'],
  description: 'Find natural code boundaries using MinCut algorithm',
  options: [
    {
      name: 'partitions',
      short: 'p',
      description: 'Number of partitions to find',
      type: 'number',
      default: 2,
    },
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (text, json, dot)',
      type: 'string',
      default: 'text',
      choices: ['text', 'json', 'dot'],
    },
  ],
  examples: [
    { command: 'claude-flow analyze boundaries src/', description: 'Find code boundaries in src/' },
    { command: 'claude-flow analyze boundaries -p 3 src/', description: 'Find 3 partitions' },
    { command: 'claude-flow analyze boundaries -f dot -o graph.dot src/', description: 'Export to DOT format' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetDir = ctx.args[0] || ctx.cwd;
    const numPartitions = (ctx.flags.partitions as number) || 2;
    const outputFile = ctx.flags.output as string | undefined;
    const format = (ctx.flags.format as string) || 'text';

    output.printInfo(`Analyzing code boundaries in: ${output.highlight(targetDir)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Building dependency graph...', spinner: 'dots' });
    spinner.start();

    try {
      const analyzer = await getGraphAnalyzer();
      if (!analyzer) {
        spinner.stop();
        output.printError('Graph analyzer module not available');
        return { success: false, exitCode: 1 };
      }

      const result = await analyzer.analyzeGraph(resolve(targetDir), {
        includeBoundaries: true,
        includeModules: false,
        numPartitions,
      });

      spinner.stop();

      // Handle different output formats
      if (format === 'json') {
        const jsonOutput = {
          boundaries: result.boundaries,
          statistics: result.statistics,
          circularDependencies: result.circularDependencies,
        };

        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }

        return { success: true, data: jsonOutput };
      }

      if (format === 'dot') {
        const dotOutput = analyzer.exportToDot(result, {
          includeLabels: true,
          highlightCycles: true,
        });

        if (outputFile) {
          await writeFile(outputFile, dotOutput);
          output.printSuccess(`DOT graph written to ${outputFile}`);
          output.writeln(output.dim('Visualize with: dot -Tpng -o graph.png ' + outputFile));
        } else {
          output.writeln(dotOutput);
        }

        return { success: true };
      }

      // Text format (default)
      output.printBox(
        [
          `Files analyzed: ${result.statistics.nodeCount}`,
          `Dependencies: ${result.statistics.edgeCount}`,
          `Avg degree: ${result.statistics.avgDegree.toFixed(2)}`,
          `Density: ${(result.statistics.density * 100).toFixed(2)}%`,
          `Components: ${result.statistics.componentCount}`,
        ].join('\n'),
        'Graph Statistics'
      );

      if (result.boundaries && result.boundaries.length > 0) {
        output.writeln();
        output.writeln(output.bold('MinCut Boundaries'));
        output.writeln();

        for (let i = 0; i < result.boundaries.length; i++) {
          const boundary = result.boundaries[i];
          output.writeln(output.bold(`Boundary ${i + 1} (cut value: ${boundary.cutValue})`));
          output.writeln();

          output.writeln(output.dim('Partition 1:'));
          const p1Display = boundary.partition1.slice(0, 10);
          output.printList(p1Display);
          if (boundary.partition1.length > 10) {
            output.writeln(output.dim(`  ... and ${boundary.partition1.length - 10} more files`));
          }

          output.writeln();
          output.writeln(output.dim('Partition 2:'));
          const p2Display = boundary.partition2.slice(0, 10);
          output.printList(p2Display);
          if (boundary.partition2.length > 10) {
            output.writeln(output.dim(`  ... and ${boundary.partition2.length - 10} more files`));
          }

          output.writeln();
          output.writeln(output.success('Suggestion:'));
          output.writeln(`  ${boundary.suggestion}`);
          output.writeln();
        }
      }

      // Show circular dependencies
      if (result.circularDependencies.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.warning('Circular Dependencies Detected')));
        output.writeln();

        for (const cycle of result.circularDependencies.slice(0, 5)) {
          const severityColor = cycle.severity === 'high' ? output.error : cycle.severity === 'medium' ? output.warning : output.dim;
          output.writeln(`${severityColor(`[${cycle.severity.toUpperCase()}]`)} ${cycle.cycle.join(' -> ')}`);
          output.writeln(output.dim(`  ${cycle.suggestion}`));
          output.writeln();
        }

        if (result.circularDependencies.length > 5) {
          output.writeln(output.dim(`... and ${result.circularDependencies.length - 5} more cycles`));
        }
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify(result, null, 2));
        output.printSuccess(`Full results written to ${outputFile}`);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Analyze modules/communities using Louvain algorithm
 */
export const modulesCommand: Command = {
  name: 'modules',
  aliases: ['communities', 'louvain'],
  description: 'Detect module communities using Louvain algorithm',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (text, json, dot)',
      type: 'string',
      default: 'text',
      choices: ['text', 'json', 'dot'],
    },
    {
      name: 'min-size',
      short: 'm',
      description: 'Minimum community size to display',
      type: 'number',
      default: 2,
    },
  ],
  examples: [
    { command: 'claude-flow analyze modules src/', description: 'Detect module communities' },
    { command: 'claude-flow analyze modules -f dot -o modules.dot src/', description: 'Export colored DOT graph' },
    { command: 'claude-flow analyze modules -m 3 src/', description: 'Only show communities with 3+ files' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetDir = ctx.args[0] || ctx.cwd;
    const outputFile = ctx.flags.output as string | undefined;
    const format = (ctx.flags.format as string) || 'text';
    const minSize = (ctx.flags['min-size'] as number) || 2;

    output.printInfo(`Detecting module communities in: ${output.highlight(targetDir)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Building dependency graph...', spinner: 'dots' });
    spinner.start();

    try {
      const analyzer = await getGraphAnalyzer();
      if (!analyzer) {
        spinner.stop();
        output.printError('Graph analyzer module not available');
        return { success: false, exitCode: 1 };
      }

      const result = await analyzer.analyzeGraph(resolve(targetDir), {
        includeBoundaries: false,
        includeModules: true,
      });

      spinner.stop();

      // Filter communities by size
      const communities = result.communities?.filter(c => c.members.length >= minSize) || [];

      // Handle different output formats
      if (format === 'json') {
        const jsonOutput = {
          communities,
          statistics: result.statistics,
        };

        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }

        return { success: true, data: jsonOutput };
      }

      if (format === 'dot') {
        const dotOutput = analyzer.exportToDot(result, {
          includeLabels: true,
          colorByCommunity: true,
          highlightCycles: true,
        });

        if (outputFile) {
          await writeFile(outputFile, dotOutput);
          output.printSuccess(`DOT graph written to ${outputFile}`);
          output.writeln(output.dim('Visualize with: dot -Tpng -o modules.png ' + outputFile));
        } else {
          output.writeln(dotOutput);
        }

        return { success: true };
      }

      // Text format (default)
      output.printBox(
        [
          `Files analyzed: ${result.statistics.nodeCount}`,
          `Dependencies: ${result.statistics.edgeCount}`,
          `Communities found: ${result.communities?.length || 0}`,
          `Showing: ${communities.length} (min size: ${minSize})`,
        ].join('\n'),
        'Module Detection Results'
      );

      if (communities.length > 0) {
        output.writeln();
        output.writeln(output.bold('Detected Communities'));
        output.writeln();

        for (const community of communities.slice(0, 10)) {
          const cohesionIndicator = community.cohesion > 0.5 ? output.success('High') :
            community.cohesion > 0.2 ? output.warning('Medium') : output.dim('Low');

          output.writeln(output.bold(`Community ${community.id}: ${community.suggestedName || 'unnamed'}`));
          output.writeln(`  ${output.dim('Cohesion:')} ${cohesionIndicator} (${(community.cohesion * 100).toFixed(1)}%)`);
          output.writeln(`  ${output.dim('Central node:')} ${community.centralNode || 'none'}`);
          output.writeln(`  ${output.dim('Members:')} ${community.members.length} files`);

          const displayMembers = community.members.slice(0, 5);
          for (const member of displayMembers) {
            output.writeln(`    - ${member}`);
          }
          if (community.members.length > 5) {
            output.writeln(output.dim(`    ... and ${community.members.length - 5} more`));
          }
          output.writeln();
        }

        if (communities.length > 10) {
          output.writeln(output.dim(`... and ${communities.length - 10} more communities`));
        }
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify(result, null, 2));
        output.printSuccess(`Full results written to ${outputFile}`);
      }

      return { success: true, data: result };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Build and export dependency graph
 */
export const dependenciesCommand: Command = {
  name: 'dependencies',
  aliases: ['graph'],
  description: 'Build and export full dependency graph',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (text, json, dot)',
      type: 'string',
      default: 'text',
      choices: ['text', 'json', 'dot'],
    },
    {
      name: 'include',
      short: 'i',
      description: 'File extensions to include (comma-separated)',
      type: 'string',
      default: '.ts,.tsx,.js,.jsx,.mjs,.cjs',
    },
    {
      name: 'exclude',
      short: 'e',
      description: 'Patterns to exclude (comma-separated)',
      type: 'string',
      default: 'node_modules,dist,build,.git',
    },
    {
      name: 'depth',
      short: 'd',
      description: 'Maximum directory depth',
      type: 'number',
      default: 10,
    },
  ],
  examples: [
    { command: 'claude-flow analyze dependencies src/', description: 'Build dependency graph' },
    { command: 'claude-flow analyze dependencies -f dot -o deps.dot src/', description: 'Export to DOT' },
    { command: 'claude-flow analyze dependencies -i .ts,.tsx src/', description: 'Only TypeScript files' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetDir = ctx.args[0] || ctx.cwd;
    const outputFile = ctx.flags.output as string | undefined;
    const format = (ctx.flags.format as string) || 'text';
    const include = ((ctx.flags.include as string) || '.ts,.tsx,.js,.jsx,.mjs,.cjs').split(',');
    const exclude = ((ctx.flags.exclude as string) || 'node_modules,dist,build,.git').split(',');
    const maxDepth = (ctx.flags.depth as number) || 10;

    output.printInfo(`Building dependency graph for: ${output.highlight(targetDir)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Scanning files...', spinner: 'dots' });
    spinner.start();

    try {
      const analyzer = await getGraphAnalyzer();
      if (!analyzer) {
        spinner.stop();
        output.printError('Graph analyzer module not available');
        return { success: false, exitCode: 1 };
      }

      const graph = await analyzer.buildDependencyGraph(resolve(targetDir), {
        include,
        exclude,
        maxDepth,
      });

      spinner.stop();

      // Detect circular dependencies
      const circularDeps = analyzer.detectCircularDependencies(graph);

      // Handle different output formats
      if (format === 'json') {
        const jsonOutput = {
          nodes: Array.from(graph.nodes.values()),
          edges: graph.edges,
          metadata: graph.metadata,
          circularDependencies: circularDeps,
        };

        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Graph written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }

        return { success: true, data: jsonOutput };
      }

      if (format === 'dot') {
        const result = { graph, circularDependencies: circularDeps, statistics: {
          nodeCount: graph.nodes.size,
          edgeCount: graph.edges.length,
          avgDegree: 0,
          maxDegree: 0,
          density: 0,
          componentCount: 0,
        }};

        const dotOutput = analyzer.exportToDot(result, {
          includeLabels: true,
          highlightCycles: true,
        });

        if (outputFile) {
          await writeFile(outputFile, dotOutput);
          output.printSuccess(`DOT graph written to ${outputFile}`);
          output.writeln(output.dim('Visualize with: dot -Tpng -o deps.png ' + outputFile));
        } else {
          output.writeln(dotOutput);
        }

        return { success: true };
      }

      // Text format (default)
      output.printBox(
        [
          `Files: ${graph.metadata.totalFiles}`,
          `Dependencies: ${graph.metadata.totalEdges}`,
          `Build time: ${graph.metadata.buildTime}ms`,
          `Root: ${graph.metadata.rootDir}`,
        ].join('\n'),
        'Dependency Graph'
      );

      // Show top files by imports
      output.writeln();
      output.writeln(output.bold('Most Connected Files'));
      output.writeln();

      const nodesByDegree = Array.from(graph.nodes.values())
        .map(n => ({
          ...n,
          degree: graph.edges.filter(e => e.source === n.id || e.target === n.id).length,
        }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 10);

      output.printTable({
        columns: [
          { key: 'path', header: 'File', width: 50 },
          { key: 'degree', header: 'Connections', width: 12, align: 'right' },
          { key: 'complexity', header: 'Complexity', width: 12, align: 'right' },
        ],
        data: nodesByDegree.map(n => ({
          path: n.path.length > 48 ? '...' + n.path.slice(-45) : n.path,
          degree: n.degree,
          complexity: n.complexity || 0,
        })),
      });

      // Show circular dependencies
      if (circularDeps.length > 0) {
        output.writeln();
        output.writeln(output.bold(output.warning(`Circular Dependencies: ${circularDeps.length}`)));
        output.writeln();

        for (const cycle of circularDeps.slice(0, 3)) {
          output.writeln(`  ${cycle.cycle.join(' -> ')}`);
        }
        if (circularDeps.length > 3) {
          output.writeln(output.dim(`  ... and ${circularDeps.length - 3} more`));
        }
      }

      if (outputFile) {
        const fullOutput = {
          nodes: Array.from(graph.nodes.values()),
          edges: graph.edges,
          metadata: graph.metadata,
          circularDependencies: circularDeps,
        };
        await writeFile(outputFile, JSON.stringify(fullOutput, null, 2));
        output.printSuccess(`Full results written to ${outputFile}`);
      }

      return { success: true };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

/**
 * Detect circular dependencies
 */
export const circularCommand: Command = {
  name: 'circular',
  aliases: ['cycles'],
  description: 'Detect circular dependencies in codebase',
  options: [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string',
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
      name: 'severity',
      short: 's',
      description: 'Minimum severity to show (low, medium, high)',
      type: 'string',
      default: 'low',
      choices: ['low', 'medium', 'high'],
    },
  ],
  examples: [
    { command: 'claude-flow analyze circular src/', description: 'Find circular dependencies' },
    { command: 'claude-flow analyze circular -s high src/', description: 'Only high severity cycles' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const targetDir = ctx.args[0] || ctx.cwd;
    const outputFile = ctx.flags.output as string | undefined;
    const format = (ctx.flags.format as string) || 'text';
    const minSeverity = (ctx.flags.severity as string) || 'low';

    output.printInfo(`Detecting circular dependencies in: ${output.highlight(targetDir)}`);
    output.writeln();

    const spinner = output.createSpinner({ text: 'Analyzing dependencies...', spinner: 'dots' });
    spinner.start();

    try {
      const analyzer = await getGraphAnalyzer();
      if (!analyzer) {
        spinner.stop();
        output.printError('Graph analyzer module not available');
        return { success: false, exitCode: 1 };
      }

      const graph = await analyzer.buildDependencyGraph(resolve(targetDir));
      const cycles = analyzer.detectCircularDependencies(graph);

      spinner.stop();

      // Filter by severity
      const severityOrder = { low: 0, medium: 1, high: 2 };
      const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 0;
      const filtered = cycles.filter(c => severityOrder[c.severity] >= minLevel);

      if (format === 'json') {
        const jsonOutput = { cycles: filtered, total: cycles.length, filtered: filtered.length };

        if (outputFile) {
          await writeFile(outputFile, JSON.stringify(jsonOutput, null, 2));
          output.printSuccess(`Results written to ${outputFile}`);
        } else {
          output.printJson(jsonOutput);
        }

        return { success: true, data: jsonOutput };
      }

      // Text format
      if (filtered.length === 0) {
        output.printSuccess('No circular dependencies found!');
        return { success: true };
      }

      output.printBox(
        [
          `Total cycles: ${cycles.length}`,
          `Shown (${minSeverity}+): ${filtered.length}`,
          `High severity: ${cycles.filter(c => c.severity === 'high').length}`,
          `Medium severity: ${cycles.filter(c => c.severity === 'medium').length}`,
          `Low severity: ${cycles.filter(c => c.severity === 'low').length}`,
        ].join('\n'),
        'Circular Dependencies'
      );

      output.writeln();

      // Group by severity
      const grouped = {
        high: filtered.filter(c => c.severity === 'high'),
        medium: filtered.filter(c => c.severity === 'medium'),
        low: filtered.filter(c => c.severity === 'low'),
      };

      for (const [severity, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;

        const color = severity === 'high' ? output.error : severity === 'medium' ? output.warning : output.dim;
        output.writeln(color(output.bold(`${severity.toUpperCase()} SEVERITY (${items.length})`)));
        output.writeln();

        for (const cycle of items.slice(0, 5)) {
          output.writeln(`  ${cycle.cycle.join(' -> ')}`);
          output.writeln(output.dim(`  Fix: ${cycle.suggestion}`));
          output.writeln();
        }

        if (items.length > 5) {
          output.writeln(output.dim(`  ... and ${items.length - 5} more ${severity} cycles`));
          output.writeln();
        }
      }

      if (outputFile) {
        await writeFile(outputFile, JSON.stringify({ cycles: filtered }, null, 2));
        output.printSuccess(`Results written to ${outputFile}`);
      }

      return { success: true, data: { cycles: filtered } };
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : String(error);
      output.printError(`Analysis failed: ${message}`);
      return { success: false, exitCode: 1 };
    }
  },
};

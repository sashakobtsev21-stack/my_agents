/**
 * Memory database initialization subcommand — sql.js (WASM SQLite) setup
 * with vector embeddings, pattern tables, temporal decay, and optional
 * post-init verification.
 *
 *   - initMemoryCommand
 *
 * Extracted from memory.ts (W103, P3.10 cut #5 — final).
 */
import type { Command, CommandContext, CommandResult } from '../../types.js';
import { output } from '../../output.js';

// Init subcommand - initialize memory database using sql.js
export const initMemoryCommand: Command = {
  name: 'init',
  description: 'Initialize memory database with sql.js (WASM SQLite) - includes vector embeddings, pattern learning, temporal decay',
  options: [
    {
      name: 'backend',
      short: 'b',
      description: 'Backend type: hybrid (default), sqlite, or agentdb',
      type: 'string',
      default: 'hybrid'
    },
    {
      name: 'path',
      short: 'p',
      description: 'Database path',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Overwrite existing database',
      type: 'boolean',
      default: false
    },
    {
      name: 'verbose',
      description: 'Show detailed initialization output',
      type: 'boolean',
      default: false
    },
    {
      name: 'verify',
      description: 'Run verification tests after initialization',
      type: 'boolean',
      default: true
    },
    {
      name: 'load-embeddings',
      description: 'Pre-load ONNX embedding model (lazy by default)',
      type: 'boolean',
      default: false
    }
  ],
  examples: [
    { command: 'claude-flow memory init', description: 'Initialize hybrid backend with all features' },
    { command: 'claude-flow memory init -b agentdb', description: 'Initialize AgentDB backend' },
    { command: 'claude-flow memory init -p ./data/memory.db --force', description: 'Reinitialize at custom path' },
    { command: 'claude-flow memory init --verbose --verify', description: 'Initialize with full verification' }
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const backend = (ctx.flags.backend as string) || 'hybrid';
    const customPath = ctx.flags.path as string;
    const force = ctx.flags.force as boolean;
    const verbose = ctx.flags.verbose as boolean;
    const verify = ctx.flags.verify !== false; // Default true
    const loadEmbeddings = ctx.flags.loadEmbeddings as boolean;

    output.writeln();
    output.writeln(output.bold('Initializing Memory Database'));
    output.writeln(output.dim('─'.repeat(50)));

    const spinner = output.createSpinner({ text: 'Initializing schema...', spinner: 'dots' });
    spinner.start();

    try {
      // Import the memory initializer
      const { initializeMemoryDatabase, loadEmbeddingModel, verifyMemoryInit } = await import('../../memory/memory-initializer.js');

      const result = await initializeMemoryDatabase({
        backend,
        dbPath: customPath,
        force,
        verbose
      });

      if (!result.success) {
        spinner.fail('Initialization failed');
        output.printError(result.error || 'Unknown error');
        return { success: false, exitCode: 1 };
      }

      // #1791.6 — DB already initialized and --force not passed: friendly no-op.
      if (result.alreadyExists) {
        spinner.succeed(`Memory database already initialized at ${result.dbPath}`);
        output.printInfo('Use `--force` to reinitialize from scratch (destructive).');
        return { success: true, exitCode: 0 };
      }

      spinner.succeed('Schema initialized');

      // Lazy load or pre-load embedding model
      if (loadEmbeddings) {
        const embeddingSpinner = output.createSpinner({ text: 'Loading embedding model...', spinner: 'dots' });
        embeddingSpinner.start();

        const embeddingResult = await loadEmbeddingModel({ verbose });

        if (embeddingResult.success) {
          embeddingSpinner.succeed(`Embedding model loaded: ${embeddingResult.modelName} (${embeddingResult.dimensions}-dim, ${embeddingResult.loadTime}ms)`);
        } else {
          embeddingSpinner.stop(output.warning(`Embedding model: ${embeddingResult.error || 'Using fallback'}`));
        }
      }

      output.writeln();

      // Show features enabled with detailed capabilities
      const featureLines = [
        `Backend:           ${result.backend}`,
        `Schema Version:    ${result.schemaVersion}`,
        `Database Path:     ${result.dbPath}`,
        '',
        output.bold('Features:'),
        `  Vector Embeddings: ${result.features.vectorEmbeddings ? output.success('✓ Enabled') : output.dim('✗ Disabled')}`,
        `  Pattern Learning:  ${result.features.patternLearning ? output.success('✓ Enabled') : output.dim('✗ Disabled')}`,
        `  Temporal Decay:    ${result.features.temporalDecay ? output.success('✓ Enabled') : output.dim('✗ Disabled')}`,
        `  HNSW Indexing:     ${result.features.hnswIndexing ? output.success('✓ Enabled') : output.dim('✗ Disabled')}`,
        `  Migration Tracking: ${result.features.migrationTracking ? output.success('✓ Enabled') : output.dim('✗ Disabled')}`
      ];

      if (verbose) {
        featureLines.push(
          '',
          output.bold('HNSW Configuration:'),
          `  M (connections):     16`,
          `  ef (construction):   200`,
          `  ef (search):         100`,
          `  Metric:              cosine`,
          '',
          output.bold('Pattern Learning:'),
          `  Confidence scoring:  0.0 - 1.0`,
          `  Temporal decay:      Half-life 30 days`,
          `  Pattern versioning:  Enabled`,
          `  Types: task-routing, error-recovery, optimization, coordination, prediction`
        );
      }

      output.printBox(featureLines.join('\n'), 'Configuration');
      output.writeln();

      // ADR-053: Show ControllerRegistry activation results
      if (result.controllers) {
        const { activated, failed, initTimeMs } = result.controllers;
        if (activated.length > 0 || failed.length > 0) {
          const controllerLines = [
            output.bold('AgentDB Controllers:'),
            `  Activated: ${activated.length}  Failed: ${failed.length}  Init: ${Math.round(initTimeMs)}ms`,
          ];
          if (verbose && activated.length > 0) {
            controllerLines.push('');
            for (const name of activated) {
              controllerLines.push(`  ${output.success('✓')} ${name}`);
            }
          }
          if (failed.length > 0 && verbose) {
            controllerLines.push('');
            for (const name of failed) {
              controllerLines.push(`  ${output.dim('✗')} ${name}`);
            }
          }
          output.printBox(controllerLines.join('\n'), 'Controller Registry (ADR-053)');
          output.writeln();
        }
      }

      // Show tables created
      if (verbose && result.tablesCreated.length > 0) {
        output.writeln(output.bold('Tables Created:'));
        output.printTable({
          columns: [
            { key: 'table', header: 'Table', width: 22 },
            { key: 'purpose', header: 'Purpose', width: 38 }
          ],
          data: [
            { table: 'memory_entries', purpose: 'Core memory storage with embeddings' },
            { table: 'patterns', purpose: 'Learned patterns with confidence scores' },
            { table: 'pattern_history', purpose: 'Pattern versioning and evolution' },
            { table: 'trajectories', purpose: 'SONA learning trajectories' },
            { table: 'trajectory_steps', purpose: 'Individual trajectory steps' },
            { table: 'migration_state', purpose: 'Migration progress tracking' },
            { table: 'sessions', purpose: 'Context persistence' },
            { table: 'vector_indexes', purpose: 'HNSW index configuration' },
            { table: 'metadata', purpose: 'System metadata' }
          ]
        });
        output.writeln();

        output.writeln(output.bold('Indexes Created:'));
        output.printList(result.indexesCreated.slice(0, 8).map(idx => output.dim(idx)));
        if (result.indexesCreated.length > 8) {
          output.writeln(output.dim(`  ... and ${result.indexesCreated.length - 8} more`));
        }
        output.writeln();
      }

      // Run verification if enabled
      if (verify) {
        const verifySpinner = output.createSpinner({ text: 'Verifying initialization...', spinner: 'dots' });
        verifySpinner.start();

        const verification = await verifyMemoryInit(result.dbPath, { verbose });

        if (verification.success) {
          verifySpinner.succeed(`Verification passed (${verification.summary.passed}/${verification.summary.total} tests)`);
        } else {
          verifySpinner.fail(`Verification failed (${verification.summary.failed}/${verification.summary.total} tests failed)`);
        }

        if (verbose || !verification.success) {
          output.writeln();
          output.writeln(output.bold('Verification Results:'));
          output.printTable({
            columns: [
              { key: 'status', header: '', width: 3 },
              { key: 'name', header: 'Test', width: 22 },
              { key: 'details', header: 'Details', width: 30 },
              { key: 'duration', header: 'Time', width: 8, align: 'right' }
            ],
            data: verification.tests.map(t => ({
              status: t.passed ? output.success('✓') : output.error('✗'),
              name: t.name,
              details: t.details || '',
              duration: t.duration ? `${t.duration}ms` : '-'
            }))
          });
        }

        output.writeln();
      }

      // Show next steps
      output.writeln(output.bold('Next Steps:'));
      output.printList([
        `Store data: ${output.highlight('claude-flow memory store -k "key" --value "data"')}`,
        `Search: ${output.highlight('claude-flow memory search -q "query"')}`,
        `Train patterns: ${output.highlight('claude-flow neural train -p coordination')}`,
        `View stats: ${output.highlight('claude-flow memory stats')}`
      ]);

      // Also sync to .claude directory
      const fs = await import('fs');
      const path = await import('path');
      const claudeDir = path.join(process.cwd(), '.claude');
      const claudeDbPath = path.join(claudeDir, 'memory.db');

      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      if (fs.existsSync(result.dbPath) && (!fs.existsSync(claudeDbPath) || force)) {
        fs.copyFileSync(result.dbPath, claudeDbPath);
        output.writeln();
        output.writeln(output.dim(`Synced to: ${claudeDbPath}`));
      }

      // Fix #1428: ONNX worker threads keep the event loop alive after init.
      // Force-exit after a short delay to allow final I/O to flush.
      if (typeof globalThis !== 'undefined') {
        setTimeout(() => {
          process.exit(0);
        }, 500).unref();
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      spinner.fail('Initialization failed');
      output.printError(`Failed to initialize memory: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, exitCode: 1 };
    }
  }
};

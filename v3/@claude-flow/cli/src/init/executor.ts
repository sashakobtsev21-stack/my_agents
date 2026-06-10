/**
 * Init Executor
 * Main execution logic for V3 initialization
 */

// This file is now the thin executeInit orchestrator. The init pipeline
// was split into the executor-* sub-modules during the P3.6 god-file
// decomposition (W77-W83); executeInit just sequences their steps.
// Sub-modules: executor-maps · executor-fs-utils · executor-upgrade ·
// executor-copiers · executor-writers-config · executor-writers-runtime ·
// executor-writers-docs.
import type { InitOptions, InitResult } from './types.js';
import { detectPlatform } from './types.js';
import { countEnabledHooks } from './executor-fs-utils.js';
import { copySkills, copyCommands, copyAgents } from './executor-copiers.js';
import { createDirectories, writeSettings, writeMCPConfig } from './executor-writers-config.js';
import {
  writeHelpers,
  writeStatusline,
  writeRuntimeConfig,
  writeInitialMetrics,
} from './executor-writers-runtime.js';
import { writeClaudeMd } from './executor-writers-docs.js';
// Init upgrade path re-exported so the init command resolves it.
export type { UpgradeResult } from './executor-upgrade.js';
export { executeUpgrade, executeUpgradeWithMissing } from './executor-upgrade.js';

/**
 * Execute initialization
 */
export async function executeInit(options: InitOptions): Promise<InitResult> {
  // Detect platform
  const platform = detectPlatform();

  const result: InitResult = {
    success: true,
    platform,
    created: {
      directories: [],
      files: [],
    },
    skipped: [],
    errors: [],
    summary: {
      skillsCount: 0,
      commandsCount: 0,
      agentsCount: 0,
      hooksEnabled: 0,
    },
  };

  const targetDir = options.targetDir;

  try {
    // Create directory structure
    await createDirectories(targetDir, options, result);

    // Generate and write settings.json
    if (options.components.settings) {
      await writeSettings(targetDir, options, result);
    }

    // Generate and write .mcp.json
    if (options.components.mcp) {
      await writeMCPConfig(targetDir, options, result);
    }

    // Copy skills
    if (options.components.skills) {
      await copySkills(targetDir, options, result);
    }

    // Copy commands
    if (options.components.commands) {
      await copyCommands(targetDir, options, result);
    }

    // Copy agents
    if (options.components.agents) {
      await copyAgents(targetDir, options, result);
    }

    // Generate helpers
    if (options.components.helpers) {
      await writeHelpers(targetDir, options, result);
    }

    // Generate statusline
    if (options.components.statusline) {
      await writeStatusline(targetDir, options, result);
    }

    // Generate runtime config
    if (options.components.runtime) {
      await writeRuntimeConfig(targetDir, options, result);
    }

    // Create initial metrics for statusline (prevents "all zeros" display)
    if (options.components.statusline) {
      await writeInitialMetrics(targetDir, options, result);
    }

    // Generate CLAUDE.md
    if (options.components.claudeMd) {
      await writeClaudeMd(targetDir, options, result);
    }

    // Count enabled hooks
    result.summary.hooksEnabled = countEnabledHooks(options);

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}




export default executeInit;

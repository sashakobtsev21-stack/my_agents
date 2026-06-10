/**
 * Init asset copiers — copy the preset's skills / commands / agents from
 * the bundled source into the target project's .claude directory.
 *
 *   - copySkills    (per-preset skill files, SKILLS_MAP-driven)
 *   - copyCommands  (per-preset command files, COMMANDS_MAP-driven)
 *   - copyAgents    (per-preset agent files, AGENTS_MAP-driven)
 *
 * Extracted from executor.ts (W80, P3.6 cut #4).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { InitOptions, InitResult } from './types.js';
import { SKILLS_MAP, COMMANDS_MAP, AGENTS_MAP } from './executor-maps.js';
import { findSourceDir, copyDirRecursive, countFiles } from './executor-fs-utils.js';

export async function copySkills(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const skillsConfig = options.skills;
  const targetSkillsDir = path.join(targetDir, '.claude', 'skills');

  // Determine which skills to copy
  const skillsToCopy: string[] = [];

  if (skillsConfig.all) {
    // Copy all available skills
    Object.values(SKILLS_MAP).forEach(skills => skillsToCopy.push(...skills));
  } else {
    if (skillsConfig.core) skillsToCopy.push(...SKILLS_MAP.core);
    if (skillsConfig.agentdb) skillsToCopy.push(...SKILLS_MAP.agentdb);
    if (skillsConfig.github) skillsToCopy.push(...SKILLS_MAP.github);
    if (skillsConfig.flowNexus) skillsToCopy.push(...SKILLS_MAP.flowNexus);
    if (skillsConfig.browser) skillsToCopy.push(...SKILLS_MAP.browser);
    if (skillsConfig.v3) skillsToCopy.push(...SKILLS_MAP.v3);
    if (skillsConfig.dualMode) skillsToCopy.push(...SKILLS_MAP.dualMode);
  }

  // Find source skills directory
  const sourceSkillsDir = findSourceDir('skills', options.sourceBaseDir);
  if (!sourceSkillsDir) {
    result.errors.push('Could not find source skills directory');
    return;
  }

  // Copy each skill
  for (const skillName of [...new Set(skillsToCopy)]) {
    const sourcePath = path.join(sourceSkillsDir, skillName);
    const targetPath = path.join(targetSkillsDir, skillName);

    if (fs.existsSync(sourcePath)) {
      if (!fs.existsSync(targetPath) || options.force) {
        copyDirRecursive(sourcePath, targetPath);
        result.created.files.push(`.claude/skills/${skillName}`);
        result.summary.skillsCount++;
      } else {
        result.skipped.push(`.claude/skills/${skillName}`);
      }
    }
  }
}

/**
 * Copy commands from source
 */
export async function copyCommands(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const commandsConfig = options.commands;
  const targetCommandsDir = path.join(targetDir, '.claude', 'commands');

  // Determine which commands to copy
  const commandsToCopy: string[] = [];

  if (commandsConfig.all) {
    Object.values(COMMANDS_MAP).forEach(cmds => commandsToCopy.push(...cmds));
  } else {
    if (commandsConfig.core) commandsToCopy.push(...COMMANDS_MAP.core);
    if (commandsConfig.analysis) commandsToCopy.push(...COMMANDS_MAP.analysis);
    if (commandsConfig.automation) commandsToCopy.push(...COMMANDS_MAP.automation);
    if (commandsConfig.github) commandsToCopy.push(...COMMANDS_MAP.github);
    if (commandsConfig.hooks) commandsToCopy.push(...COMMANDS_MAP.hooks);
    if (commandsConfig.monitoring) commandsToCopy.push(...COMMANDS_MAP.monitoring);
    if (commandsConfig.optimization) commandsToCopy.push(...COMMANDS_MAP.optimization);
    if (commandsConfig.sparc) commandsToCopy.push(...COMMANDS_MAP.sparc);
    // ADR-128 Phase 4 substrate promotions
    if (commandsConfig.agents) commandsToCopy.push(...(COMMANDS_MAP.agents || []));
    if (commandsConfig.coordination) commandsToCopy.push(...(COMMANDS_MAP.coordination || []));
    if (commandsConfig.hiveMind) commandsToCopy.push(...(COMMANDS_MAP.hiveMind || []));
    if (commandsConfig.memory) commandsToCopy.push(...(COMMANDS_MAP.memory || []));
    if (commandsConfig.swarm) commandsToCopy.push(...(COMMANDS_MAP.swarm || []));
    if (commandsConfig.workflows) commandsToCopy.push(...(COMMANDS_MAP.workflows || []));
    // ADR-128 Phase 4 opt-in categories
    if (commandsConfig.pair) commandsToCopy.push(...(COMMANDS_MAP.pair || []));
    if (commandsConfig.training) commandsToCopy.push(...(COMMANDS_MAP.training || []));
    if (commandsConfig.streamChain) commandsToCopy.push(...(COMMANDS_MAP.streamChain || []));
    if (commandsConfig.truth) commandsToCopy.push(...(COMMANDS_MAP.truth || []));
    if (commandsConfig.verify) commandsToCopy.push(...(COMMANDS_MAP.verify || []));
  }

  // Find source commands directory
  const sourceCommandsDir = findSourceDir('commands', options.sourceBaseDir);
  if (!sourceCommandsDir) {
    result.errors.push('Could not find source commands directory');
    return;
  }

  // Copy each command/directory
  for (const cmdName of [...new Set(commandsToCopy)]) {
    const sourcePath = path.join(sourceCommandsDir, cmdName);
    const targetPath = path.join(targetCommandsDir, cmdName);

    if (fs.existsSync(sourcePath)) {
      if (!fs.existsSync(targetPath) || options.force) {
        if (fs.statSync(sourcePath).isDirectory()) {
          copyDirRecursive(sourcePath, targetPath);
        } else {
          fs.copyFileSync(sourcePath, targetPath);
        }
        result.created.files.push(`.claude/commands/${cmdName}`);
        result.summary.commandsCount++;
      } else {
        result.skipped.push(`.claude/commands/${cmdName}`);
      }
    }
  }
}

/**
 * Copy agents from source
 */
export async function copyAgents(
  targetDir: string,
  options: InitOptions,
  result: InitResult
): Promise<void> {
  const agentsConfig = options.agents;
  const targetAgentsDir = path.join(targetDir, '.claude', 'agents');

  // Determine which agents to copy
  const agentsToCopy: string[] = [];

  if (agentsConfig.all) {
    Object.values(AGENTS_MAP).forEach(agents => agentsToCopy.push(...agents));
  } else {
    if (agentsConfig.core) agentsToCopy.push(...AGENTS_MAP.core);
    if (agentsConfig.consensus) agentsToCopy.push(...AGENTS_MAP.consensus);
    if (agentsConfig.github) agentsToCopy.push(...AGENTS_MAP.github);
    if (agentsConfig.hiveMind) agentsToCopy.push(...AGENTS_MAP.hiveMind);
    if (agentsConfig.sparc) agentsToCopy.push(...AGENTS_MAP.sparc);
    if (agentsConfig.swarm) agentsToCopy.push(...AGENTS_MAP.swarm);
    if (agentsConfig.browser) agentsToCopy.push(...AGENTS_MAP.browser);
    // V3-specific agent categories
    if (agentsConfig.v3) agentsToCopy.push(...(AGENTS_MAP.v3 || []));
    if (agentsConfig.optimization) agentsToCopy.push(...(AGENTS_MAP.optimization || []));
    if (agentsConfig.testing) agentsToCopy.push(...(AGENTS_MAP.testing || []));
    // Dual-mode agents (Claude Code + Codex hybrid)
    if (agentsConfig.dualMode) agentsToCopy.push(...(AGENTS_MAP.dualMode || []));
  }

  // Find source agents directory
  const sourceAgentsDir = findSourceDir('agents', options.sourceBaseDir);
  if (!sourceAgentsDir) {
    result.errors.push('Could not find source agents directory');
    return;
  }

  // Copy each agent category
  for (const agentCategory of [...new Set(agentsToCopy)]) {
    const sourcePath = path.join(sourceAgentsDir, agentCategory);
    const targetPath = path.join(targetAgentsDir, agentCategory);

    if (fs.existsSync(sourcePath)) {
      if (!fs.existsSync(targetPath) || options.force) {
        copyDirRecursive(sourcePath, targetPath);
        // Count agent files (.md only — .yaml agents were migrated to .md)
        const mdFiles = countFiles(sourcePath, '.md');
        result.summary.agentsCount += mdFiles;
        result.created.files.push(`.claude/agents/${agentCategory}`);
      } else {
        result.skipped.push(`.claude/agents/${agentCategory}`);
      }
    }
  }
}

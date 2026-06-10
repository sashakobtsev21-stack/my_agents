/**
 * V3 CLI Init Command
 * Comprehensive initialization for Claude Flow with Claude Code integration
 */

// This file is now a thin registrar: it assembles initCommand from the
// action + subcommands extracted into the ./init/ directory during the
// P3.18 god-file decomposition (W131-W132). Sub-modules:
//   helpers · init-action · subcommands
import type { Command } from '../types.js';
import { initAction } from './init/init-action.js';
import {
  wizardCommand,
  checkCommand,
  skillsCommand,
  hooksCommand,
  upgradeCommand,
} from './init/subcommands.js';

// Main init command
export const initCommand: Command = {
  name: 'init',
  description: 'Initialize AlexKo in the current directory',
  subcommands: [wizardCommand, checkCommand, skillsCommand, hooksCommand, upgradeCommand],
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Overwrite existing configuration',
      type: 'boolean',
      default: false,
    },
    {
      name: 'minimal',
      short: 'm',
      description: 'Create minimal configuration',
      type: 'boolean',
      default: false,
    },
    {
      name: 'full',
      description: 'Create full configuration with all components',
      type: 'boolean',
      default: false,
    },
    {
      name: 'skip-claude',
      description: 'Skip .claude/ directory creation (runtime only)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'only-claude',
      description: 'Only create .claude/ directory (skip runtime)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'no-global',
      description: 'Skip the ~/.claude/CLAUDE.md "Ruflo Integration" pointer block (#1744)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'start-all',
      description: 'Auto-start daemon, memory, and swarm after init',
      type: 'boolean',
      default: false,
    },
    {
      name: 'start-daemon',
      description: 'Auto-start daemon after init',
      type: 'boolean',
      default: false,
    },
    {
      name: 'with-embeddings',
      description: 'Initialize ONNX embedding subsystem with hyperbolic support',
      type: 'boolean',
      default: false,
    },
    {
      name: 'embedding-model',
      description: 'ONNX embedding model to use',
      type: 'string',
      default: 'Xenova/all-MiniLM-L6-v2',
      choices: ['Xenova/all-MiniLM-L6-v2', 'Xenova/all-mpnet-base-v2'],
    },
    {
      name: 'codex',
      description: 'Initialize for OpenAI Codex CLI (creates AGENTS.md, .agents/)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'dual',
      description: 'Initialize for both Claude Code and OpenAI Codex',
      type: 'boolean',
      default: false,
    },
    {
      name: 'all-agents',
      description: 'Install all agent categories (ADR-128: default is ~24 substrate agents; this restores the full set of ~89)',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'claude-flow init', description: 'Initialize with default configuration' },
    { command: 'claude-flow init --start-all', description: 'Initialize and start daemon, memory, swarm' },
    { command: 'claude-flow init --start-daemon', description: 'Initialize and start daemon only' },
    { command: 'claude-flow init --minimal', description: 'Initialize with minimal configuration' },
    { command: 'claude-flow init --full', description: 'Initialize with all components' },
    { command: 'claude-flow init --force', description: 'Reinitialize and overwrite existing config' },
    { command: 'claude-flow init --only-claude', description: 'Only create Claude Code integration' },
    { command: 'claude-flow init --skip-claude', description: 'Only create V3 runtime' },
    { command: 'claude-flow init wizard', description: 'Interactive setup wizard' },
    { command: 'claude-flow init --with-embeddings', description: 'Initialize with ONNX embeddings' },
    { command: 'claude-flow init --with-embeddings --embedding-model Xenova/all-mpnet-base-v2', description: 'Use larger embedding model' },
    { command: 'claude-flow init skills --all', description: 'Install all available skills' },
    { command: 'claude-flow init hooks --minimal', description: 'Create minimal hooks configuration' },
    { command: 'claude-flow init upgrade', description: 'Update helpers while preserving data' },
    { command: 'claude-flow init upgrade --settings', description: 'Update helpers and merge new settings (Agent Teams)' },
    { command: 'claude-flow init upgrade --verbose', description: 'Show detailed upgrade info' },
    { command: 'claude-flow init --codex', description: 'Initialize for OpenAI Codex (AGENTS.md)' },
    { command: 'claude-flow init --codex --full', description: 'Codex init with all 137+ skills' },
    { command: 'claude-flow init --dual', description: 'Initialize for both Claude Code and Codex' },
    { command: 'claude-flow init --all-agents', description: 'Install all agent categories (~89 agents; ADR-128 opt-in)' },
  ],
  action: initAction,
};

export default initCommand;

/**
 * Generators — CLAUDE.md / CLAUDE.local.md templates
 *
 * generateClaudeMd + generateClaudeLocalMd. Extracted verbatim from
 * generators.ts (lines 138-397) during campaign-2 wave 30 (W236).
 * generators.ts stays the barrel.
 */

import type { LocalProfile, ProjectProfile } from './generators.js';

function getFrameworkRules(framework: string): string[] {
  const lower = framework.toLowerCase();
  const map: Record<string, string[]> = {
    react: [
      'Prefer functional components with hooks over class components.',
      'Use `useMemo`/`useCallback` only when profiling shows a need.',
      'Keep components small and focused. Extract custom hooks for shared logic.',
    ],
    nextjs: [
      'Use the App Router unless there is a specific reason for Pages Router.',
      'Prefer Server Components by default. Add `"use client"` only when needed.',
      'Use `next/image` for all images.',
    ],
    express: [
      'Use async error handling middleware.',
      'Validate all request bodies with a schema validator (zod, joi, etc.).',
      'Never expose stack traces in production error responses.',
    ],
    fastify: [
      'Use JSON Schema for request/response validation.',
      'Register plugins in a consistent order.',
    ],
    django: [
      'Use class-based views for CRUD, function-based for custom logic.',
      'Always use the ORM. Never write raw SQL unless performance-critical.',
      'Run `manage.py check` before deploying.',
    ],
    flask: [
      'Use blueprints for modular organization.',
      'Never use `app.run()` in production.',
    ],
    prisma: [
      'Run `prisma generate` after schema changes.',
      'Never edit generated client code.',
      'Use transactions for multi-table operations.',
    ],
    vitest: [
      'Use `describe` blocks to group related tests.',
      'Prefer `expect().toBe()` for primitives, `expect().toEqual()` for objects.',
      'Use `beforeEach` for shared setup, not `beforeAll` (test isolation).',
    ],
    jest: [
      'Use `describe` blocks to group related tests.',
      'Prefer `expect().toBe()` for primitives, `expect().toEqual()` for objects.',
      'Mock external dependencies, never internal implementation details.',
    ],
  };
  return map[lower] || [];
}

function getLanguageInvariants(lang: string): string[] {
  const lower = lang.toLowerCase();
  const map: Record<string, string[]> = {
    typescript: [
      'No `any` types. Use `unknown` if the type is truly unknown.',
      'Prefer `const` over `let`. Never use `var`.',
      'All public functions and exported types require JSDoc.',
      'Use strict TypeScript (`strict: true` in tsconfig).',
    ],
    javascript: [
      'Prefer `const` over `let`. Never use `var`.',
      'Use strict mode (`"use strict"` or ES modules).',
    ],
    python: [
      'Follow PEP 8 style guide.',
      'Use type hints for all function signatures.',
      'Prefer f-strings over `.format()` or `%` formatting.',
    ],
    rust: [
      'Run `cargo clippy` before committing.',
      'No `unwrap()` in production code. Use `?` or proper error handling.',
      'All public items require doc comments (`///`).',
    ],
    go: [
      'Run `go vet` and `golangci-lint` before committing.',
      'Always handle errors. Never use `_` for error returns.',
      'Follow Effective Go conventions.',
    ],
    java: [
      'Follow Google Java Style Guide.',
      'All public classes and methods require Javadoc.',
      'Prefer immutable objects where possible.',
    ],
  };
  return map[lower] || [`Follow established ${lang} conventions.`];
}

// ============================================================================
// CLAUDE.md Generator
// ============================================================================

export function generateClaudeMd(profile: ProjectProfile): string {
  const sections: string[] = [];

  // --- Constitution (lines 1-60, always loaded) ---
  sections.push(`# ${profile.name}`);
  sections.push('');
  if (profile.description) {
    sections.push(profile.description);
    sections.push('');
  }

  // Core invariants
  sections.push('## Core Invariants');
  sections.push('');
  sections.push('These rules are always active regardless of task type.');
  sections.push('');

  // Language-specific invariants
  for (const lang of profile.languages) {
    const invariants = getLanguageInvariants(lang);
    if (invariants.length > 0) {
      for (const inv of invariants) {
        sections.push(`- ${inv}`);
      }
    }
  }

  // Forbidden patterns
  if (profile.forbidden && profile.forbidden.length > 0) {
    sections.push('');
    for (const f of profile.forbidden) {
      sections.push(`- NEVER: ${f}`);
    }
  }

  // Required patterns
  if (profile.required && profile.required.length > 0) {
    for (const r of profile.required) {
      sections.push(`- ALWAYS: ${r}`);
    }
  }

  sections.push('');

  // --- Build & Test (tagged shard) ---
  sections.push('## Build & Test');
  sections.push('');
  const pm = profile.packageManager || 'npm';
  if (profile.buildCommand) {
    sections.push(`Build: \`${profile.buildCommand}\``);
  } else {
    sections.push(`Build: \`${pm} run build\``);
  }
  if (profile.testCommand) {
    sections.push(`Test: \`${profile.testCommand}\``);
  } else {
    sections.push(`Test: \`${pm} test\``);
  }
  if (profile.lintCommand) {
    sections.push(`Lint: \`${profile.lintCommand}\``);
  }
  sections.push('');
  sections.push('Run tests before committing. Run the build to catch type errors.');
  sections.push('');

  // --- Project Structure ---
  sections.push('## Project Structure');
  sections.push('');
  if (profile.monorepo) {
    sections.push('This is a monorepo. Each package has its own CLAUDE.md that layers on top of this root file.');
  }
  if (profile.srcDir) {
    sections.push(`Source code: \`${profile.srcDir}/\``);
  }
  if (profile.testDir) {
    sections.push(`Tests: \`${profile.testDir}/\``);
  }
  if (profile.architecture) {
    sections.push('');
    sections.push(profile.architecture);
  }
  sections.push('');

  // --- Coding Standards ---
  if (profile.conventions && profile.conventions.length > 0) {
    sections.push('## Coding Standards');
    sections.push('');
    for (const c of profile.conventions) {
      sections.push(`- ${c}`);
    }
    sections.push('');
  }

  // --- Domain Rules ---
  if (profile.domainRules && profile.domainRules.length > 0) {
    sections.push('## Domain Rules');
    sections.push('');
    for (const rule of profile.domainRules) {
      sections.push(`- ${rule}`);
    }
    sections.push('');
  }

  // --- Framework-specific shards ---
  if (profile.frameworks && profile.frameworks.length > 0) {
    for (const fw of profile.frameworks) {
      const fwRules = getFrameworkRules(fw);
      if (fwRules.length > 0) {
        sections.push(`## ${fw} Conventions`);
        sections.push('');
        for (const rule of fwRules) {
          sections.push(`- ${rule}`);
        }
        sections.push('');
      }
    }
  }

  // --- Security ---
  sections.push('## Security');
  sections.push('');
  sections.push('- Never commit secrets, API keys, or credentials to git');
  sections.push('- Never run destructive commands (`rm -rf /`, `DROP TABLE`, `git push --force`) without explicit confirmation');
  sections.push('- Validate all external input at system boundaries');
  sections.push('- Use parameterized queries for database operations');
  sections.push('');

  // --- Guidance Control Plane integration ---
  if (profile.guidanceControlPlane) {
    sections.push('## Guidance Control Plane');
    sections.push('');
    sections.push('This project uses `@claude-flow/guidance` to enforce these rules programmatically.');
    sections.push('The constitution (this section and above) is always loaded. Sections below are');
    sections.push('retrieved by intent classification — only relevant rules are injected per task.');
    sections.push('');
    sections.push('Gates enforce: destructive ops, secrets detection, diff size limits, tool allowlist.');
    sections.push('The optimizer watches violations and promotes winning CLAUDE.local.md experiments here.');
    sections.push('');
    if (profile.wasmKernel) {
      sections.push('WASM kernel: hot-path operations (hashing, secret scanning) use the Rust WASM kernel');
      sections.push('for 1.25-1.96x speedup. Falls back to JS automatically if WASM is unavailable.');
      sections.push('');
    }
  }

  // --- Swarm configuration ---
  if (profile.swarm) {
    sections.push('## Swarm Configuration');
    sections.push('');
    sections.push(`Topology: ${profile.swarm.topology || 'hierarchical'}`);
    sections.push(`Max agents: ${profile.swarm.maxAgents || 8}`);
    sections.push(`Strategy: ${profile.swarm.strategy || 'specialized'}`);
    sections.push('');
  }

  // --- Imports ---
  if (profile.imports && profile.imports.length > 0) {
    sections.push('## Individual Preferences');
    sections.push('');
    for (const imp of profile.imports) {
      sections.push(`@${imp}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

// ============================================================================
// CLAUDE.local.md Generator
// ============================================================================

export function generateClaudeLocalMd(local: LocalProfile): string {
  const sections: string[] = [];

  sections.push('# Local Development Notes');
  sections.push('');
  sections.push('> This file is auto-gitignored by Claude Code. It stays on this machine only.');
  sections.push('');

  if (local.developer) {
    sections.push(`Developer: ${local.developer}`);
    sections.push('');
  }

  // Local URLs
  if (local.localUrls && Object.keys(local.localUrls).length > 0) {
    sections.push('## Local URLs');
    sections.push('');
    for (const [name, url] of Object.entries(local.localUrls)) {
      sections.push(`- ${name}: ${url}`);
    }
    sections.push('');
  }

  // Databases
  if (local.databases && Object.keys(local.databases).length > 0) {
    sections.push('## Local Databases');
    sections.push('');
    for (const [name, conn] of Object.entries(local.databases)) {
      sections.push(`- ${name}: \`${conn}\``);
    }
    sections.push('');
  }

  // Environment
  if (local.envVars && Object.keys(local.envVars).length > 0) {
    sections.push('## Environment Variables');
    sections.push('');
    sections.push('```bash');
    for (const [key, val] of Object.entries(local.envVars)) {
      sections.push(`export ${key}="${val}"`);
    }
    sections.push('```');
    sections.push('');
  }

  // Preferences
  if (local.preferences && local.preferences.length > 0) {
    sections.push('## Preferences');
    sections.push('');
    for (const p of local.preferences) {
      sections.push(`- ${p}`);
    }
    sections.push('');
  }

  // Machine notes
  if (local.machineNotes && local.machineNotes.length > 0) {
    sections.push('## Machine Notes');
    sections.push('');
    if (local.os) {
      sections.push(`OS: ${local.os}`);
    }
    if (local.editor) {
      sections.push(`Editor: ${local.editor}`);
    }
    for (const note of local.machineNotes) {
      sections.push(`- ${note}`);
    }
    sections.push('');
  }

  // Debug
  if (local.debug && local.debug.length > 0) {
    sections.push('## Debug Settings');
    sections.push('');
    for (const d of local.debug) {
      sections.push(`- ${d}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}


/**
 * Git availability + repository detection checks.
 *
 * Pilot extraction (issue #7). Sibling of checks/node.ts.
 */
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type { HealthCheck } from '../utils.js';
import { runCommand } from '../utils.js';

export async function checkGit(): Promise<HealthCheck> {
  try {
    const version = await runCommand('git', ['--version']);
    return { name: 'Git', status: 'pass', message: version.replace('git version ', 'v') };
  } catch {
    return { name: 'Git', status: 'warn', message: 'Not installed', fix: 'Install git from https://git-scm.com' };
  }
}

/**
 * Check if cwd is inside a git repository.
 *
 * #1791.7 — `git rev-parse` was reported as failing on hosts where `.git`
 * clearly exists in cwd (linux-arm64 daemon contexts). Treat the git binary
 * as authoritative when it succeeds, but fall back to a `.git` walk-up so a
 * present repository is recognized even when the git invocation fails for
 * environment reasons (PATH, broken global config, EBADCWD, etc.).
 */
export async function checkGitRepo(): Promise<HealthCheck> {
  try {
    await runCommand('git', ['rev-parse', '--is-inside-work-tree']);
    return { name: 'Git Repository', status: 'pass', message: 'In a git repository' };
  } catch {
    // Walk parents of cwd for a .git directory before reporting "not a repo".
    let dir = process.cwd();
    while (true) {
      if (existsSync(join(dir, '.git'))) {
        return {
          name: 'Git Repository',
          status: 'warn',
          message: `Repo detected on disk (${join(dir, '.git')}) but \`git rev-parse\` failed — check git installation and PATH`,
          fix: 'Verify git is on PATH (try `git --version`) and that the working tree is not corrupted',
        };
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return { name: 'Git Repository', status: 'warn', message: 'Not a git repository', fix: 'git init' };
  }
}

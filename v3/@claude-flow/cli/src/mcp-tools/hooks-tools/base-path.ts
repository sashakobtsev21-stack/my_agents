/**
 * basePath override for hooks-tools (issue #7 N5).
 *
 * Lets tests pin every cwd-relative path in the hooks-tools module + its
 * extracted helpers to a tmp dir without process.chdir() (forbidden in
 * vitest worker_threads on Windows). Lives in its own file so both the
 * main hooks-tools.ts and the helper modules in hooks-tools/ can import
 * it without a circular dependency.
 */
import { getProjectCwd } from '../types.js';

let basePathOverride: string | null = null;

/** Pin every cwd-relative path resolved by hooks-tools to `p`. `null` resets. */
export function setHooksToolsBasePath(p: string | null): void {
  basePathOverride = p;
}

/** Resolve the project root: override -> getProjectCwd() (the env / cwd chain). */
export function projectRoot(): string {
  return basePathOverride ?? getProjectCwd();
}

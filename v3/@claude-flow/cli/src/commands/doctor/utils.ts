/**
 * Shared utilities for `doctor` checks — runCommand (ADR-078 safe execFile)
 * + the HealthCheck contract every check produces.
 *
 * Extracted from the 1180-line doctor.ts so individual check groups can be
 * decomposed into their own files (issue #7 pilot — checks/node.ts shipped
 * alongside this file as the first example).
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

// ADR-078: execFile (no shell) — argv-based, no string interpolation possible.
const execFileAsync = promisify(execFile);

/**
 * Resolve a platform-correct binary name. npm/npx/tsc on Windows are .cmd
 * shims that can't be exec'd directly without `shell:true`; we suffix .cmd
 * so execFile finds them without dropping into a shell.
 */
export function cmd(bin: string): string {
  return process.platform === 'win32' && /^(npm|npx|yarn|pnpm)$/.test(bin) ? `${bin}.cmd` : bin;
}

/**
 * Execute a command asynchronously via execFile (no shell). Caller passes
 * the binary and an argv array — no shell metacharacters can be injected.
 * Critical for Windows where PATH may not be inherited properly.
 */
export async function runCommand(file: string, args: string[], timeoutMs: number = 5000): Promise<string> {
  const { stdout } = await execFileAsync(cmd(file), args, {
    encoding: 'utf8' as BufferEncoding,
    timeout: timeoutMs,
    env: { ...process.env }, // Explicitly inherit full environment
    windowsHide: true, // Hide window on Windows
  });
  return (stdout as string).trim();
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

/**
 * Browser MCP Tools — session registry & sandbox detection
 *
 * Module-private in the original browser-tools.ts (campaign-2 W282);
 * NOT re-exported by the barrel.
 */

import { readFileSync, existsSync } from 'node:fs';
import type { MCPToolResult } from './types.js';

export const browserSessions = new Map<string, {
  sessionId: string;
  createdAt: string;
  lastActivity: string;
}>();

/**
 * Execute agent-browser CLI command.
 * Tries global agent-browser first, falls back to npx if ENOENT.
 */
export async function execBrowserCommand(args: string[], session = 'default'): Promise<MCPToolResult> {
  const { execFileSync } = await import('child_process');
  const fullArgs = ['--session', session, '--json', ...args];

  let result: string;
  try {
    result = execFileSync('agent-browser', fullArgs, {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      try {
        result = execFileSync('npx', ['--yes', 'agent-browser', ...fullArgs], {
          encoding: 'utf-8',
          timeout: 60000,
        });
      } catch (npxError) {
        const npxErr = npxError as NodeJS.ErrnoException;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: npxErr.code === 'ENOENT'
                ? 'Neither agent-browser nor npx found. Install with: npm i -g agent-browser'
                : npxErr instanceof Error ? npxErr.message : String(npxError),
            }),
          }],
          isError: true,
        };
      }
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : String(error),
          }),
        }],
        isError: true,
      };
    }
  }

  let data;
  try {
    data = JSON.parse(result);
  } catch {
    data = result.trim();
  }

  const sessionInfo = browserSessions.get(session);
  if (sessionInfo) {
    sessionInfo.lastActivity = new Date().toISOString();
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Read a sysctl value, returning the trimmed string or null.
 */
export function readSysctl(name: string): string | null {
  try {
    const p = `/proc/sys/kernel/${name}`;
    if (existsSync(p)) return readFileSync(p, 'utf-8').trim();
  } catch { /* not Linux or can't read */ }
  return null;
}

/**
 * Detect if Linux needs --no-sandbox for Chrome.
 * Checks both legacy userns flag and Ubuntu 24.04+ AppArmor restriction.
 */
export function needsNoSandbox(): boolean {
  if (process.platform !== 'linux') return false;
  return readSysctl('unprivileged_userns_clone') === '0' ||
    readSysctl('apparmor_restrict_unprivileged_userns') === '1';
}

/**
 * Browser MCP Tools
 */

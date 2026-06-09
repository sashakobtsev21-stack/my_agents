/**
 * Node.js + npm version health checks for `doctor`.
 *
 * Pilot extraction from doctor.ts (issue #7). Co-located with the other
 * 15 checks in this directory once they're moved out one group at a time.
 */
import type { HealthCheck } from '../utils.js';
import { runCommand } from '../utils.js';

export async function checkNodeVersion(): Promise<HealthCheck> {
  const requiredMajor = 20;
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= requiredMajor) {
    return { name: 'Node.js Version', status: 'pass', message: `${version} (>= ${requiredMajor} required)` };
  }
  if (major >= 18) {
    return {
      name: 'Node.js Version',
      status: 'warn',
      message: `${version} (>= ${requiredMajor} recommended)`,
      fix: 'nvm install 20 && nvm use 20',
    };
  }
  return {
    name: 'Node.js Version',
    status: 'fail',
    message: `${version} (>= ${requiredMajor} required)`,
    fix: 'nvm install 20 && nvm use 20',
  };
}

export async function checkNpmVersion(): Promise<HealthCheck> {
  try {
    const version = await runCommand('npm', ['--version']);
    const major = parseInt(version.split('.')[0], 10);
    if (major >= 9) {
      return { name: 'npm Version', status: 'pass', message: `v${version}` };
    }
    return {
      name: 'npm Version',
      status: 'warn',
      message: `v${version} (>= 9 recommended)`,
      fix: 'npm install -g npm@latest',
    };
  } catch {
    return {
      name: 'npm Version',
      status: 'fail',
      message: 'npm not found',
      fix: 'Install Node.js from https://nodejs.org',
    };
  }
}

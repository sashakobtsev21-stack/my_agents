/**
 * V3 CLI Claims Command
 * Claims-based authorization, permissions, and access control
 *
 * Created with ❤️ by ruv.io
 */

import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

// List subcommand
const listCommand: Command = {
  name: 'list',
  description: 'List claims and permissions',
  options: [
    { name: 'user', short: 'u', type: 'string', description: 'Filter by user ID' },
    { name: 'role', short: 'r', type: 'string', description: 'Filter by role' },
    { name: 'resource', type: 'string', description: 'Filter by resource' },
  ],
  examples: [
    { command: 'claude-flow claims list', description: 'List all claims' },
    { command: 'claude-flow claims list -u user123', description: 'List user claims' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // #1425: This command is not yet implemented — was displaying hardcoded fake claims
    output.writeln();
    output.printError('claims list is not yet implemented');
    output.writeln(output.dim('Claims listing requires reading from claims config file.'));
    output.writeln(output.dim('Use "claims check -c <claim>" to evaluate a specific claim.'));
    output.writeln(output.dim('Track progress: https://github.com/ruvnet/claude-flow/issues/1425'));
    return { success: false, exitCode: 1 };
  },
};

// Check subcommand
const checkCommand: Command = {
  name: 'check',
  description: 'Check if a specific claim is granted',
  options: [
    { name: 'claim', short: 'c', type: 'string', description: 'Claim to check', required: true },
    { name: 'user', short: 'u', type: 'string', description: 'User ID to check' },
    { name: 'resource', short: 'r', type: 'string', description: 'Resource context' },
  ],
  examples: [
    { command: 'claude-flow claims check -c swarm:create', description: 'Check swarm creation permission' },
    { command: 'claude-flow claims check -c admin:delete -u user123', description: 'Check user permission' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const claim = ctx.flags.claim as string;
    const user = ctx.flags.user as string || 'current';
    const resource = ctx.flags.resource as string;

    if (!claim) {
      output.printError('Claim is required');
      return { success: false, exitCode: 1 };
    }

    output.writeln();
    output.writeln(output.bold('Claim Check'));
    output.writeln(output.dim('─'.repeat(40)));

    const spinner = output.createSpinner({ text: 'Evaluating claim...', spinner: 'dots' });
    spinner.start();

    const fs = await import('fs');
    const path = await import('path');

    // Real claims evaluation from config file
    let isGranted = false;
    let reason = 'Claim not found in policy';
    let policySource = 'default';

    try {
      // Check for claims config file
      const claimsConfigPaths = [
        path.resolve('.claude-flow/claims.json'),
        path.resolve('claude-flow.claims.json'),
        path.resolve(process.env.HOME || '~', '.config/claude-flow/claims.json'),
      ];

      let claimsConfig: {
        roles?: Record<string, string[]>;
        users?: Record<string, { role?: string; claims?: string[] }>;
        defaultClaims?: string[];
      } = {
        // Default policy - allows basic operations
        roles: {
          admin: ['*'],
          developer: ['swarm:*', 'agent:*', 'memory:*', 'task:*', 'session:*'],
          operator: ['swarm:status', 'agent:list', 'memory:read', 'task:list'],
          viewer: ['*:list', '*:status', '*:read'],
        },
        defaultClaims: ['swarm:create', 'swarm:status', 'agent:spawn', 'agent:list', 'memory:read', 'memory:write', 'task:create'],
      };

      for (const configPath of claimsConfigPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          claimsConfig = { ...claimsConfig, ...JSON.parse(content) };
          policySource = configPath;
          break;
        }
      }

      // Resolve user's claims
      const userConfig = claimsConfig.users?.[user];
      let userClaims: string[] = [...(claimsConfig.defaultClaims || [])];

      if (userConfig) {
        // Add user-specific claims
        if (userConfig.claims) {
          userClaims = [...userClaims, ...userConfig.claims];
        }
        // Add role-based claims
        if (userConfig.role && claimsConfig.roles?.[userConfig.role]) {
          userClaims = [...userClaims, ...claimsConfig.roles[userConfig.role]];
        }
      }

      // Check if claim is granted
      const checkClaim = (claimToCheck: string, grantedClaims: string[]): boolean => {
        for (const granted of grantedClaims) {
          // Exact match
          if (granted === claimToCheck) return true;
          // Wildcard match (e.g., "swarm:*" matches "swarm:create")
          if (granted === '*') return true;
          if (granted.endsWith(':*')) {
            const prefix = granted.slice(0, -1);
            if (claimToCheck.startsWith(prefix)) return true;
          }
          // Pattern match (e.g., "*:list" matches "swarm:list")
          if (granted.startsWith('*:')) {
            const suffix = granted.slice(1);
            if (claimToCheck.endsWith(suffix)) return true;
          }
        }
        return false;
      };

      isGranted = checkClaim(claim, userClaims);
      if (isGranted) {
        reason = userConfig?.role
          ? `Granted via role: ${userConfig.role}`
          : 'Granted via default policy';
      } else {
        reason = 'Not in user claims or role permissions';
      }

      spinner.stop();
    } catch (error) {
      spinner.stop();
      // On error, fall back to permissive default
      isGranted = !claim.startsWith('admin:');
      reason = isGranted ? 'Granted (default permissive policy)' : 'Admin claims require explicit grant';
      policySource = 'fallback';
    }

    if (isGranted) {
      output.writeln(output.success('✓ Claim granted'));
    } else {
      output.writeln(output.error('✗ Claim denied'));
    }

    output.writeln();
    output.printBox([
      `Claim: ${claim}`,
      `User: ${user}`,
      `Resource: ${resource || 'global'}`,
      `Result: ${isGranted ? output.success('GRANTED') : output.error('DENIED')}`,
      ``,
      `Reason: ${reason}`,
      `Policy: ${policySource}`,
    ].join('\n'), 'Result');

    return { success: isGranted };
  },
};

// Grant subcommand
const grantCommand: Command = {
  name: 'grant',
  description: 'Grant a claim to user or role',
  options: [
    { name: 'claim', short: 'c', type: 'string', description: 'Claim to grant', required: true },
    { name: 'user', short: 'u', type: 'string', description: 'User ID' },
    { name: 'role', short: 'r', type: 'string', description: 'Role name' },
    { name: 'scope', short: 's', type: 'string', description: 'Scope: global, namespace, resource', default: 'global' },
    { name: 'expires', short: 'e', type: 'string', description: 'Expiration time (e.g., 24h, 7d)' },
  ],
  examples: [
    { command: 'claude-flow claims grant -c swarm:create -u user123', description: 'Grant to user' },
    { command: 'claude-flow claims grant -c agent:spawn -r developer', description: 'Grant to role' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const claim = ctx.flags.claim as string;
    const user = ctx.flags.user as string;
    const role = ctx.flags.role as string;
    const scope = ctx.flags.scope as string || 'global';

    if (!claim) {
      output.printError('Claim is required');
      return { success: false, exitCode: 1 };
    }

    if (!user && !role) {
      output.printError('Either user or role is required');
      return { success: false, exitCode: 1 };
    }

    // #1425: This command is not yet implemented — was faking claim grant
    output.writeln();
    output.printError('claims grant is not yet implemented');
    output.writeln(output.dim(`Cannot grant "${claim}" — claims persistence not yet built.`));
    output.writeln(output.dim('Track progress: https://github.com/ruvnet/claude-flow/issues/1425'));
    return { success: false, exitCode: 1 };
  },
};

// Revoke subcommand
const revokeCommand: Command = {
  name: 'revoke',
  description: 'Revoke a claim from user or role',
  options: [
    { name: 'claim', short: 'c', type: 'string', description: 'Claim to revoke', required: true },
    { name: 'user', short: 'u', type: 'string', description: 'User ID' },
    { name: 'role', short: 'r', type: 'string', description: 'Role name' },
  ],
  examples: [
    { command: 'claude-flow claims revoke -c swarm:delete -u user123', description: 'Revoke from user' },
    { command: 'claude-flow claims revoke -c admin:* -r guest', description: 'Revoke from role' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const claim = ctx.flags.claim as string;
    const user = ctx.flags.user as string;
    const role = ctx.flags.role as string;

    if (!claim) {
      output.printError('Claim is required');
      return { success: false, exitCode: 1 };
    }

    // #1425: This command is not yet implemented — was faking claim revocation
    output.writeln();
    output.printError('claims revoke is not yet implemented');
    output.writeln(output.dim(`Cannot revoke "${claim}" — claims persistence not yet built.`));
    output.writeln(output.dim('Track progress: https://github.com/ruvnet/claude-flow/issues/1425'));
    return { success: false, exitCode: 1 };
  },
};

// Roles subcommand
const rolesCommand: Command = {
  name: 'roles',
  description: 'Manage roles and their claims',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: list, create, delete, show', default: 'list' },
    { name: 'name', short: 'n', type: 'string', description: 'Role name' },
  ],
  examples: [
    { command: 'claude-flow claims roles', description: 'List all roles' },
    { command: 'claude-flow claims roles -a show -n admin', description: 'Show role details' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // #1425: This command is not yet implemented — was displaying hardcoded fake roles
    output.writeln();
    output.printError('claims roles is not yet implemented');
    output.writeln(output.dim('Role management requires claims config persistence not yet built.'));
    output.writeln(output.dim('Track progress: https://github.com/ruvnet/claude-flow/issues/1425'));
    return { success: false, exitCode: 1 };
  },
};

// Policies subcommand
const policiesCommand: Command = {
  name: 'policies',
  description: 'Manage claim policies',
  options: [
    { name: 'action', short: 'a', type: 'string', description: 'Action: list, create, delete', default: 'list' },
    { name: 'name', short: 'n', type: 'string', description: 'Policy name' },
  ],
  examples: [
    { command: 'claude-flow claims policies', description: 'List policies' },
    { command: 'claude-flow claims policies -a create -n rate-limit', description: 'Create policy' },
  ],
  action: async (_ctx: CommandContext): Promise<CommandResult> => {
    // #1425: This command is not yet implemented — was displaying hardcoded fake policies
    output.writeln();
    output.printError('claims policies is not yet implemented');
    output.writeln(output.dim('Policy management requires claims config persistence not yet built.'));
    output.writeln(output.dim('Track progress: https://github.com/ruvnet/claude-flow/issues/1425'));
    return { success: false, exitCode: 1 };
  },
};

// Main claims command
export const claimsCommand: Command = {
  name: 'claims',
  description: 'Claims-based authorization, permissions, and access control',
  subcommands: [listCommand, checkCommand, grantCommand, revokeCommand, rolesCommand, policiesCommand],
  examples: [
    { command: 'claude-flow claims list', description: 'List all claims' },
    { command: 'claude-flow claims check -c swarm:create', description: 'Check permission' },
    { command: 'claude-flow claims grant -c agent:spawn -r developer', description: 'Grant claim' },
  ],
  action: async (): Promise<CommandResult> => {
    output.writeln();
    output.writeln(output.bold('RuFlo Claims System'));
    output.writeln(output.dim('Fine-grained authorization and access control'));
    output.writeln();
    output.writeln('Subcommands:');
    output.printList([
      'list     - List claims and permissions',
      'check    - Check if a claim is granted',
      'grant    - Grant a claim to user or role',
      'revoke   - Revoke a claim',
      'roles    - Manage roles and their claims',
      'policies - Manage claim policies',
    ]);
    output.writeln();
    output.writeln('Claim Types:');
    output.printList([
      'swarm:*   - Swarm operations (create, delete, scale)',
      'agent:*   - Agent operations (spawn, terminate)',
      'memory:*  - Memory operations (read, write, delete)',
      'admin:*   - Administrative operations',
    ]);
    output.writeln();
    output.writeln(output.dim('Created with ❤️ by ruv.io'));
    return { success: true };
  },
};

export default claimsCommand;

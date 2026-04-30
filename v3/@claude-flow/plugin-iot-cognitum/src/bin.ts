#!/usr/bin/env node
/**
 * Standalone CLI shim for @claude-flow/plugin-iot-cognitum.
 * Maps `cognitum-iot <subcommand> [args]` -> CLICommandDefinition handlers.
 *
 * Endpoint default: when --endpoint/-e is omitted on `register`,
 * defaults to http://169.254.42.1 (the Cognitum Seed link-local USB address).
 */

import { IoTCognitumPlugin } from './plugin.js';
import type { PluginContext } from '@claude-flow/shared/src/plugin-interface.js';

const SEED_DEFAULT_ENDPOINT = 'http://169.254.42.1';

function makeContext(): PluginContext {
  // Minimal in-memory context for standalone CLI use.
  const noop = () => undefined;
  return {
    config: {
      fleetId: process.env.IOT_FLEET_ID ?? 'default',
      zoneId: process.env.IOT_ZONE_ID ?? 'zone-0',
      tlsInsecure: process.env.IOT_TLS_INSECURE !== 'false',
    },
    eventBus: {
      emit: noop,
      on: noop,
      off: noop,
      once: noop,
    } as unknown as PluginContext['eventBus'],
    logger: {
      info: (...a: unknown[]) => console.log('[info]', ...a),
      warn: (...a: unknown[]) => console.warn('[warn]', ...a),
      error: (...a: unknown[]) => console.error('[error]', ...a),
      debug: (...a: unknown[]) => process.env.DEBUG && console.error('[debug]', ...a),
    } as unknown as PluginContext['logger'],
    services: {
      get: () => undefined,
      register: noop,
      has: () => false,
    } as unknown as PluginContext['services'],
  };
}

interface ParsedArgs {
  _: string[];
  [k: string]: unknown;
}

/**
 * Parse argv minimally: positional -> _, --flag value, --flag=value, --boolean,
 * short -e value. Numeric values stay as strings (handlers coerce as needed).
 */
function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          out[key] = true;
        } else {
          out[key] = next;
          i++;
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function aliasShortToLong(args: ParsedArgs): ParsedArgs {
  // Most common short flags used across the iot commands.
  const aliases: Record<string, string> = {
    e: 'endpoint',
    f: 'fleet-id',
    z: 'zone-id',
    d: 'device-id',
    v: 'version',
    k: 'k',
    n: 'name',
    t: 'token',
  };
  for (const [s, l] of Object.entries(aliases)) {
    if (s in args && !(l in args)) {
      args[l] = args[s];
    }
  }
  return args;
}

/**
 * Resolve a subcommand path against command definitions.
 * Supports multi-word commands: `iot fleet add`, `iot firmware deploy`, etc.
 * Tries longest match first.
 */
function resolveCommand(
  argv: string[],
  commandNames: string[],
): { name: string; rest: string[] } | null {
  // Strip the leading "iot" prefix from each defined command for matching.
  const tokens = argv.slice();
  // Try longest match (3 tokens, then 2, then 1).
  for (const len of [3, 2, 1]) {
    if (tokens.length < len) continue;
    const probe = 'iot ' + tokens.slice(0, len).join(' ');
    if (commandNames.includes(probe)) {
      return { name: probe, rest: tokens.slice(len) };
    }
  }
  return null;
}

function printHelp(commandNames: string[]): void {
  console.log('cognitum-iot — Cognitum Seed device-agent CLI');
  console.log('');
  console.log('Usage: cognitum-iot <subcommand> [options]');
  console.log('');
  console.log('Default endpoint: ' + SEED_DEFAULT_ENDPOINT + ' (Seed link-local USB address)');
  console.log('');
  console.log('Subcommands:');
  for (const n of commandNames) {
    console.log('  ' + n.replace(/^iot /, ''));
  }
  console.log('');
  console.log('Run "cognitum-iot <subcommand> --help" for command-specific options.');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    // Need to bootstrap to enumerate commands.
  }

  const plugin = new IoTCognitumPlugin();
  const context = makeContext();
  await plugin.initialize(context);

  const commands = plugin.registerCLICommands();
  const commandNames = commands.map((c) => c.name);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp(commandNames);
    return;
  }

  const resolved = resolveCommand(argv, commandNames);
  if (!resolved) {
    console.error('Unknown subcommand: ' + argv.join(' '));
    console.error('Run "cognitum-iot --help" to list available subcommands.');
    process.exitCode = 1;
    return;
  }

  const cmd = commands.find((c) => c.name === resolved.name)!;
  const args = aliasShortToLong(parseArgs(resolved.rest));

  // Endpoint default for `iot register`: fall back to Seed link-local address.
  if (resolved.name === 'iot register' && !args['endpoint']) {
    args['endpoint'] = SEED_DEFAULT_ENDPOINT;
    console.error(`[info] No --endpoint supplied; defaulting to ${SEED_DEFAULT_ENDPOINT}`);
  }

  try {
    await cmd.handler(args as never);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error: ' + msg);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('Fatal: ' + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });

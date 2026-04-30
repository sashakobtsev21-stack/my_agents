#!/usr/bin/env node
/**
 * Full plugin smoke test against a live Cognitum Seed device.
 * Exercises register -> status -> mesh -> witness -> witness-verify -> anomalies
 * within a single in-process plugin instance (the published bin is one-shot,
 * so this is the only way to chain device-aware commands).
 *
 * Run from the plugin directory after `npm run build`.
 */
import { IoTCognitumPlugin } from '../../dist/plugin.js';

const SEED_ENDPOINT = process.env.SEED_ENDPOINT ?? 'http://169.254.42.1';

const plugin = new IoTCognitumPlugin();
const noop = () => undefined;
await plugin.initialize({
  config: { fleetId: 'test-fleet', zoneId: 'zone-test', tlsInsecure: true },
  eventBus: { emit: noop, on: noop, off: noop, once: noop },
  logger: {
    info: () => {},
    warn: (...a) => console.warn('[warn]', ...a),
    error: (...a) => console.error('[error]', ...a),
    debug: () => {},
  },
  services: { get: () => undefined, register: noop, has: () => false },
});

const commands = plugin.registerCLICommands();
const cmd = (name) => {
  const c = commands.find((c) => c.name === name);
  if (!c) throw new Error(`No command: ${name}`);
  return c;
};

const section = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
};

const run = async (label, fn) => {
  console.log(`\n--- ${label} ---`);
  try {
    await fn();
    console.log(`[ok] ${label}`);
  } catch (err) {
    console.error(`[fail] ${label}: ${err.message ?? err}`);
  }
};

section('iot init');
await cmd('iot init').handler({ _: [], 'fleet-id': 'test-fleet', 'zone-id': 'zone-test' });

section('iot register (default endpoint)');
let deviceId = null;
await run('register', async () => {
  await cmd('iot register').handler({ _: [], endpoint: SEED_ENDPOINT });
  // Capture the device-id from the in-memory list
  const list = await cmd('iot list').handler({ _: [] });
  void list;
});

// Pull device-id from the coordinator directly
const repo = plugin._coordinator?.deviceRepository ?? null;
section('iot list (post-register)');
await cmd('iot list').handler({ _: [] });

// Read device-id from console output of list — easier: introspect coordinator
// IoTCoordinator exposes listDevices() — peek into it
const coord = plugin['coordinator'];
const devices = coord ? coord.listDevices() : [];
if (devices.length > 0) {
  deviceId = devices[0].deviceId;
  console.log(`\n[info] discovered device id: ${deviceId}`);
}

if (!deviceId) {
  console.error('No device registered — skipping device-aware tests');
  process.exit(1);
}

section(`iot status ${deviceId}`);
await run('status', () => cmd('iot status').handler({ _: [deviceId] }));

section(`iot mesh ${deviceId}`);
await run('mesh', () => cmd('iot mesh').handler({ _: [deviceId] }));

section(`iot witness ${deviceId}`);
await run('witness', () => cmd('iot witness').handler({ _: [deviceId] }));

section(`iot witness verify ${deviceId}`);
await run('witness verify', () => cmd('iot witness verify').handler({ _: [deviceId] }));

section(`iot anomalies ${deviceId}`);
await run('anomalies', () => cmd('iot anomalies').handler({ _: [deviceId] }));

section(`iot baseline ${deviceId}`);
await run('baseline (read)', () => cmd('iot baseline').handler({ _: [deviceId] }));

section('iot fleet list');
await run('fleet list', () => cmd('iot fleet list').handler({ _: [] }));

section('iot fleet create');
await run('fleet create', () =>
  cmd('iot fleet create').handler({
    _: [],
    'fleet-id': 'smoke-fleet-1',
    name: 'smoke-test-fleet',
  }),
);

section('iot fleet list (after create)');
await run('fleet list', () => cmd('iot fleet list').handler({ _: [] }));

console.log('\n' + '='.repeat(60));
console.log('  Full plugin smoke test complete');
console.log('='.repeat(60));

process.exit(0);

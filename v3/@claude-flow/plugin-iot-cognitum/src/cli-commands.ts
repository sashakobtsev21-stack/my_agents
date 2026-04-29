import type { CLICommandDefinition, PluginContext } from '@claude-flow/shared/src/plugin-interface.js';
import type { IoTCoordinator } from './application/iot-coordinator.js';
import { getDeviceTrustLabel } from './domain/entities/device-trust-level.js';

type CoordinatorGetter = () => IoTCoordinator | null;
type ContextGetter = () => PluginContext | null;

function requireCoordinator(get: CoordinatorGetter): IoTCoordinator {
  const c = get();
  if (!c) throw new Error('IoT Cognitum not initialized. Run "iot register" first.');
  return c;
}

export function createCliCommands(
  getCoordinator: CoordinatorGetter,
  _getContext: ContextGetter,
): CLICommandDefinition[] {
  return [
    {
      name: 'iot register',
      description: 'Register a Cognitum Seed device by endpoint',
      options: [
        { name: 'endpoint', short: 'e', description: 'Device HTTP endpoint', type: 'string', required: true },
        { name: 'token', short: 't', description: 'Pairing token for mutual auth', type: 'string' },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const device = await coordinator.registerDevice(
          args['endpoint'] as string,
          args['token'] as string | undefined,
        );
        console.log(`Device registered: ${device.deviceId}`);
        console.log(`  Endpoint:  ${device.endpoint}`);
        console.log(`  Trust:     ${getDeviceTrustLabel(device.trustLevel)}`);
        console.log(`  Firmware:  ${device.firmwareVersion}`);
      },
    },
    {
      name: 'iot status',
      description: 'Get device status and trust score',
      arguments: [{ name: 'device-id', description: 'Device identifier', required: true }],
      options: [
        { name: 'format', short: 'f', description: 'Output format (table, json)', type: 'string', default: 'table' },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const device = await coordinator.getDeviceStatus(args._[0]!);
        const format = args['format'] as string;

        if (format === 'json') {
          console.log(JSON.stringify(device, null, 2));
        } else {
          console.log(`Device:    ${device.deviceId}`);
          console.log(`Status:    ${device.status}`);
          console.log(`Trust:     ${getDeviceTrustLabel(device.trustLevel)} (score: ${device.trustScore.overall.toFixed(3)})`);
          console.log(`Firmware:  ${device.firmwareVersion}`);
          console.log(`Endpoint:  ${device.endpoint}`);
          console.log(`Epoch:     ${device.epoch}`);
          console.log(`Vectors:   ${device.vectorStoreStats.totalVectors}`);
        }
      },
    },
    {
      name: 'iot list',
      description: 'List all registered devices',
      options: [
        { name: 'format', short: 'f', description: 'Output format (table, json)', type: 'string', default: 'table' },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const devices = coordinator.listDevices();
        const format = args['format'] as string;

        if (format === 'json') {
          console.log(JSON.stringify(devices, null, 2));
        } else {
          console.log('Device ID                        | Status    | Trust');
          console.log('-'.repeat(60));
          for (const d of devices) {
            console.log(
              `${d.deviceId.padEnd(33)}| ${d.status.padEnd(10)}| ${getDeviceTrustLabel(d.trustLevel)}`,
            );
          }
          console.log(`\nTotal: ${devices.length} device(s)`);
        }
      },
    },
    {
      name: 'iot remove',
      description: 'Remove a registered device',
      arguments: [{ name: 'device-id', description: 'Device identifier to remove', required: true }],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        await coordinator.removeDevice(args._[0]!);
        console.log(`Device ${args._[0]} removed.`);
      },
    },
    {
      name: 'iot query',
      description: 'Query device vector store with a k-NN search',
      options: [
        { name: 'device-id', short: 'd', description: 'Device identifier', type: 'string', required: true },
        { name: 'k', short: 'k', description: 'Number of nearest neighbours', type: 'number', default: 5 },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        // CLI cannot easily pass a vector; use a zero vector as placeholder
        const k = (args['k'] as number) ?? 5;
        const result = await coordinator.queryDeviceVectors(args['device-id'] as string, [], k);
        console.log(JSON.stringify(result, null, 2));
      },
    },
    {
      name: 'iot ingest',
      description: 'Ingest vectors into device store from stdin (JSON array)',
      options: [
        { name: 'device-id', short: 'd', description: 'Device identifier', type: 'string', required: true },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        // In a real implementation this would read stdin; stub for now
        const result = await coordinator.ingestDeviceTelemetry(args['device-id'] as string, []);
        console.log(`Ingested ${result.ingested} vector(s) for device ${result.deviceId}`);
      },
    },
    {
      name: 'iot mesh',
      description: 'Show mesh network topology for a device',
      arguments: [{ name: 'device-id', description: 'Device identifier', required: true }],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const topology = await coordinator.getDeviceMeshTopology(args._[0]!);
        console.log(`Device:      ${topology.deviceId}`);
        console.log(`AP Active:   ${topology.apActive}`);
        console.log(`Auto Mesh:   ${topology.autoMesh}`);
        console.log(`Cluster:     ${topology.clusterEnabled}`);
        console.log(`Peers:       ${topology.peerCount}`);
        if (topology.peers.length > 0) {
          for (const p of topology.peers) {
            console.log(`  - ${p.deviceId} ${p.address ? `(${p.address})` : ''}`);
          }
        }
      },
    },
    {
      name: 'iot witness',
      description: 'Show witness chain provenance for a device',
      arguments: [{ name: 'device-id', description: 'Device identifier', required: true }],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const chain = await coordinator.getDeviceWitnessChain(args._[0]!);
        console.log(`Length:    ${chain.length ?? chain.entries?.length ?? 0}`);
        console.log(`Head:      ${chain.head || '(empty)'}`);
        if (chain.entries && chain.entries.length > 0) {
          console.log(`Entries:   ${chain.entries.length}`);
          console.log(`  Latest epoch: ${chain.entries[0]?.epoch ?? 'n/a'}`);
        }
      },
    },
    {
      name: 'iot fleet',
      description: 'Show fleet overview of all registered devices',
      options: [
        { name: 'format', short: 'f', description: 'Output format (table, json)', type: 'string', default: 'table' },
      ],
      handler: async (args) => {
        const coordinator = requireCoordinator(getCoordinator);
        const status = coordinator.getStatus();
        const format = args['format'] as string;

        if (format === 'json') {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log(`Healthy:     ${status.healthy}`);
          console.log(`Devices:     ${status.deviceCount}`);
          for (const d of status.devices) {
            console.log(`  - ${d.deviceId} (${d.status})`);
          }
        }
      },
    },
  ];
}

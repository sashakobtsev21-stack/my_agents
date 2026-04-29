import type { MCPToolDefinition } from '@claude-flow/shared/src/plugin-interface.js';
import type { PluginContext } from '@claude-flow/shared/src/plugin-interface.js';
import type { IoTCoordinator } from './application/iot-coordinator.js';

type CoordinatorGetter = () => IoTCoordinator | null;
type ContextGetter = () => PluginContext | null;

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], isError };
}

export function createMcpTools(
  getCoordinator: CoordinatorGetter,
  _getContext: ContextGetter,
): MCPToolDefinition[] {
  function requireCoordinator(): IoTCoordinator {
    const c = getCoordinator();
    if (!c) throw new Error('IoT Cognitum not initialized');
    return c;
  }

  return [
    // -- Device lifecycle ----------------------------------------------------
    {
      name: 'iot_device_register',
      description: 'Register a Cognitum Seed device by endpoint',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'Device HTTP endpoint (e.g. http://169.254.42.1)' },
          pairingToken: { type: 'string', description: 'Optional pairing token for mutual auth' },
        },
        required: ['endpoint'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const device = await coordinator.registerDevice(
            params['endpoint'] as string,
            params['pairingToken'] as string | undefined,
          );
          return textResult(JSON.stringify(device, null, 2));
        } catch (err) {
          return textResult(`Registration failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_device_status',
      description: 'Get device status and trust score',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const status = await coordinator.getDeviceStatus(params['deviceId'] as string);
          return textResult(JSON.stringify(status, null, 2));
        } catch (err) {
          return textResult(`Status failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_device_list',
      description: 'List all registered devices',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const coordinator = requireCoordinator();
          const devices = coordinator.listDevices();
          return textResult(JSON.stringify(devices, null, 2));
        } catch (err) {
          return textResult(`List failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_device_remove',
      description: 'Remove a registered device',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier to remove' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          await coordinator.removeDevice(params['deviceId'] as string);
          return textResult(`Device ${params['deviceId']} removed`);
        } catch (err) {
          return textResult(`Remove failed: ${(err as Error).message}`, true);
        }
      },
    },

    // -- Vector store --------------------------------------------------------
    {
      name: 'iot_store_query',
      description: 'Query device vector store',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
          vector: { type: 'array', description: 'Query vector', items: { type: 'number' } },
          k: { type: 'number', description: 'Number of nearest neighbours to return' },
        },
        required: ['deviceId', 'vector', 'k'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const result = await coordinator.queryDeviceVectors(
            params['deviceId'] as string,
            params['vector'] as number[],
            params['k'] as number,
          );
          return textResult(JSON.stringify(result, null, 2));
        } catch (err) {
          return textResult(`Query failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_store_ingest',
      description: 'Ingest vectors into device store',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
          vectors: {
            type: 'array',
            description: 'Array of vectors with optional metadata',
            items: {
              type: 'object',
              properties: {
                values: { type: 'array', description: 'Vector values', items: { type: 'number' } },
                metadata: { type: 'object', description: 'Optional metadata' },
              },
              required: ['values'],
            },
          },
        },
        required: ['deviceId', 'vectors'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const result = await coordinator.ingestDeviceTelemetry(
            params['deviceId'] as string,
            params['vectors'] as Array<{ values: number[]; metadata?: Record<string, unknown> }>,
          );
          return textResult(JSON.stringify(result, null, 2));
        } catch (err) {
          return textResult(`Ingest failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_store_status',
      description: 'Get vector store health',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const health = await coordinator.getDeviceStoreStatus(params['deviceId'] as string);
          return textResult(JSON.stringify(health, null, 2));
        } catch (err) {
          return textResult(`Store status failed: ${(err as Error).message}`, true);
        }
      },
    },

    // -- Mesh / witness / custody --------------------------------------------
    {
      name: 'iot_mesh_topology',
      description: 'Get mesh network topology',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const topology = await coordinator.getDeviceMeshTopology(params['deviceId'] as string);
          return textResult(JSON.stringify(topology, null, 2));
        } catch (err) {
          return textResult(`Mesh topology failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_witness_chain',
      description: 'Get witness chain provenance',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const chain = await coordinator.getDeviceWitnessChain(params['deviceId'] as string);
          return textResult(JSON.stringify(chain, null, 2));
        } catch (err) {
          return textResult(`Witness chain failed: ${(err as Error).message}`, true);
        }
      },
    },
    {
      name: 'iot_custody_epoch',
      description: 'Get custody epoch',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Device identifier' },
        },
        required: ['deviceId'],
      },
      handler: async (params) => {
        try {
          const coordinator = requireCoordinator();
          const epoch = await coordinator.getDeviceCustodyEpoch(params['deviceId'] as string);
          return textResult(JSON.stringify(epoch, null, 2));
        } catch (err) {
          return textResult(`Custody epoch failed: ${(err as Error).message}`, true);
        }
      },
    },

    // -- Fleet ---------------------------------------------------------------
    {
      name: 'iot_fleet_status',
      description: 'Get fleet overview',
      pluginName: '@claude-flow/plugin-iot-cognitum',
      version: '1.0.0-alpha.1',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const coordinator = requireCoordinator();
          const status = coordinator.getStatus();
          return textResult(JSON.stringify(status, null, 2));
        } catch (err) {
          return textResult(`Fleet status failed: ${(err as Error).message}`, true);
        }
      },
    },
  ];
}

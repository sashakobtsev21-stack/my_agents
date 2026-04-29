import type {
  ClaudeFlowPlugin,
  PluginContext,
  MCPToolDefinition,
  CLICommandDefinition,
  AgentTypeDefinition,
} from '@claude-flow/shared/src/plugin-interface.js';

import { IoTCoordinator } from './application/iot-coordinator.js';
import { createMcpTools } from './mcp-tools.js';
import { createCliCommands } from './cli-commands.js';

export class IoTCognitumPlugin implements ClaudeFlowPlugin {
  readonly name = '@claude-flow/plugin-iot-cognitum';
  readonly version = '1.0.0-alpha.1';
  readonly description = 'IoT Cognitum Seed device-agent bridge';
  readonly author = 'Claude Flow Team';
  readonly dependencies = ['@claude-flow/shared'];

  private coordinator: IoTCoordinator | null = null;
  private context: PluginContext | null = null;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    const config = context.config;
    const defaultFleetId = (config['fleetId'] as string) ?? 'default';
    const defaultZoneId = (config['zoneId'] as string) ?? 'zone-0';
    const insecure = (config['tlsInsecure'] as boolean) ?? true;

    this.coordinator = new IoTCoordinator({
      defaultFleetId,
      defaultZoneId,
      defaultTls: { insecure },
    }, {
      onDeviceRegistered: (device) => {
        context.logger.info(`Device registered: ${device.deviceId} at ${device.endpoint}`);
        context.eventBus.emit('iot:device-registered', device);
      },
      onTrustChange: (deviceId, oldLevel, newLevel) => {
        context.logger.info(`Trust change for ${deviceId}: ${oldLevel} -> ${newLevel}`);
        context.eventBus.emit('iot:trust-change', { deviceId, oldLevel, newLevel });
      },
    });

    context.services.register('iot:coordinator', this.coordinator);
    context.logger.info('IoT Cognitum plugin initialized');
  }

  async shutdown(): Promise<void> {
    if (this.coordinator) {
      await this.coordinator.shutdown();
      this.coordinator = null;
    }
    this.context?.logger.info('IoT Cognitum plugin shut down');
    this.context = null;
  }

  registerMCPTools(): MCPToolDefinition[] {
    return createMcpTools(() => this.coordinator, () => this.context);
  }

  registerCLICommands(): CLICommandDefinition[] {
    return createCliCommands(() => this.coordinator, () => this.context);
  }

  registerAgentTypes(): AgentTypeDefinition[] {
    return [
      {
        type: 'device-coordinator',
        name: 'Device Coordinator',
        description: 'Manages Cognitum Seed device fleet as Ruflo agent swarm members',
        defaultConfig: {
          id: '',
          name: 'device-coordinator',
          type: 'coordinator',
          capabilities: ['iot:discover', 'iot:register', 'iot:monitor', 'iot:deploy'],
          maxConcurrentTasks: 10,
          priority: 85,
          timeout: 300_000,
          metadata: { pluginSource: '@claude-flow/plugin-iot-cognitum' },
        },
        requiredCapabilities: ['iot:discover', 'iot:register'],
        metadata: { trustAware: true, meshAware: true },
      },
    ];
  }

  async healthCheck(): Promise<boolean> {
    return this.coordinator !== null;
  }
}
